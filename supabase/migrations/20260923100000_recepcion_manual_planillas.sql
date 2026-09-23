-- ============================================================
-- RECEPCIÓN MANUAL DE PLANILLAS
-- Convergente. Staging yncidsgcypyyvurtyesx. NO aplicar a producción.
--
-- Cuando el importador no reconoce la estructura con seguridad, el archivo
-- NO se pierde ni se fuerza: se recibe, se guarda el original en un bucket
-- PRIVADO y queda en cola para que una persona lo revise. Recibir no crea
-- deportistas, mediciones ni jornadas: solo deja constancia del archivo.
-- ============================================================

-- ---------- Bucket privado ----------
-- public = false: no hay URL pública. La descarga es siempre por URL
-- firmada de vida corta, emitida en servidor tras validar el rol.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'planillas-recepcion',
  'planillas-recepcion',
  false,
  20971520,
  array[
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- Tabla de recepción ----------
create table if not exists planilla_recepcion (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references club(id) on delete cascade,
  numero_seguimiento text not null unique,
  nombre_archivo     text not null,
  hash_sha256        text not null check (length(hash_sha256) = 64),
  tamano_bytes       bigint not null check (tamano_bytes > 0 and tamano_bytes <= 20971520),
  tipo_mime          text not null,
  contexto           jsonb not null,
  ruta_storage       text,
  motivo             text,
  estado             text not null default 'RECIBIDA_PARA_REVISION'
                     check (estado in ('RECIBIDA_PARA_REVISION','EN_REVISION','PROCESADA','RECHAZADA','PURGADA')),
  enviado_por        uuid not null references membresia(id) on delete restrict,
  revisado_por       uuid references membresia(id) on delete set null,
  notas_revision     text,
  -- Retención: el original NO se guarda para siempre. Ver purgar_planillas_vencidas().
  retener_hasta      date not null default (current_date + interval '180 days'),
  purgado_en         timestamptz,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

-- Un mismo archivo para el mismo contexto no se recibe dos veces mientras
-- siga en cola o en revisión. Reenviarlo devuelve el seguimiento original.
create unique index if not exists uq_recepcion_hash_contexto
  on planilla_recepcion (
    club_id, hash_sha256,
    (contexto ->> 'institucionOrigen'),
    (contexto ->> 'disciplina'),
    (contexto ->> 'grupo')
  ) where estado in ('RECIBIDA_PARA_REVISION','EN_REVISION');

create index if not exists idx_recepcion_club_estado on planilla_recepcion (club_id, estado, creado_en desc);
create index if not exists idx_recepcion_retencion on planilla_recepcion (retener_hasta) where purgado_en is null;

alter table planilla_recepcion enable row level security;

-- Lectura: cualquier miembro del espacio. Escritura: solo por las RPC.
drop policy if exists "recepcion_lectura" on planilla_recepcion;
create policy "recepcion_lectura" on planilla_recepcion
  for select using (es_miembro_de(club_id));
drop policy if exists "recepcion_sin_escritura_directa" on planilla_recepcion;
create policy "recepcion_sin_escritura_directa" on planilla_recepcion
  for insert with check (false);

-- ---------- Storage: nada público, lectura solo del propio espacio ----------
-- La ruta es <club_id>/<id>.<ext>: el primer segmento ata el objeto a la
-- organización y la policy lo compara contra la membresía real.
drop policy if exists "recepcion_objetos_lectura" on storage.objects;
create policy "recepcion_objetos_lectura" on storage.objects
  for select using (
    bucket_id = 'planillas-recepcion'
    and exists (
      select 1 from membresia m
       where m.auth_user_id = auth.uid()
         and m.club_id::text = split_part(name, '/', 1)
         and m.rol in ('admin_secretaria','coordinador_secretaria','analista_secretaria')
    )
  );
-- Sin policies de insert/update/delete para authenticated: la subida y el
-- borrado ocurren en servidor con la clave de servicio, nunca desde el browser.

-- ---------- Registrar una recepción ----------
-- Devuelve el número de seguimiento. Si el mismo archivo ya está en cola
-- para el mismo contexto, devuelve el existente en vez de duplicar.
create or replace function registrar_recepcion_manual(
  p_nombre_archivo text,
  p_hash           text,
  p_tamano         bigint,
  p_tipo_mime      text,
  p_contexto       jsonb,
  p_motivo         text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mem uuid; v_club uuid; v_rol text; v_id uuid; v_num text; v_exist planilla_recepcion%rowtype;
  MIMES constant text[] := array[
    'text/csv','application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_rol not in ('admin_secretaria','coordinador_secretaria','evaluador') then
    raise exception 'TDS:ROL_INSUFICIENTE';
  end if;

  if length(coalesce(p_hash,'')) <> 64 then raise exception 'TDS:HASH_INVALIDO'; end if;
  if p_tamano is null or p_tamano <= 0 then raise exception 'TDS:ARCHIVO_VACIO'; end if;
  if p_tamano > 20971520 then raise exception 'TDS:ARCHIVO_DEMASIADO_GRANDE'; end if;
  if not (p_tipo_mime = any(MIMES)) then raise exception 'TDS:TIPO_NO_SOPORTADO'; end if;
  if coalesce(trim(p_contexto ->> 'institucionOrigen'),'') = ''
     or coalesce(trim(p_contexto ->> 'disciplina'),'') = ''
     or coalesce(trim(p_contexto ->> 'grupo'),'') = '' then
    raise exception 'TDS:CONTEXTO_INCOMPLETO';
  end if;

  -- Duplicado en cola: se devuelve el seguimiento original.
  select * into v_exist from planilla_recepcion
   where club_id = v_club and hash_sha256 = p_hash
     and contexto ->> 'institucionOrigen' = p_contexto ->> 'institucionOrigen'
     and contexto ->> 'disciplina' = p_contexto ->> 'disciplina'
     and contexto ->> 'grupo' = p_contexto ->> 'grupo'
     and estado in ('RECIBIDA_PARA_REVISION','EN_REVISION');
  if found then
    return jsonb_build_object(
      'estado', v_exist.estado, 'numeroSeguimiento', v_exist.numero_seguimiento,
      'id', v_exist.id, 'duplicada', true, 'rutaStorage', v_exist.ruta_storage,
      'recibidaEn', v_exist.creado_en);
  end if;

  v_id := gen_random_uuid();
  v_num := 'RM-' || to_char(now(),'YYYYMMDD') || '-' || upper(substring(replace(v_id::text,'-','') from 1 for 6));

  insert into planilla_recepcion(
    id, club_id, numero_seguimiento, nombre_archivo, hash_sha256,
    tamano_bytes, tipo_mime, contexto, motivo, enviado_por)
  values (v_id, v_club, v_num, p_nombre_archivo, p_hash,
          p_tamano, p_tipo_mime, p_contexto, nullif(trim(p_motivo),''), v_mem);

  return jsonb_build_object(
    'estado','RECIBIDA_PARA_REVISION','numeroSeguimiento',v_num,'id',v_id,
    'duplicada', false, 'rutaStorage', v_club::text || '/' || v_id::text);
end; $$;

-- La ruta del objeto se confirma recién cuando la subida terminó bien.
create or replace function confirmar_archivo_recepcion(p_id uuid, p_ruta text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_mem uuid; v_club uuid;
begin
  select membresia_id, club_id into v_mem, v_club from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  update planilla_recepcion
     set ruta_storage = p_ruta, actualizado_en = now()
   where id = p_id and club_id = v_club and ruta_storage is null;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;
  return jsonb_build_object('id', p_id, 'rutaStorage', p_ruta);
end; $$;

-- ---------- Consulta ----------
create or replace function recepciones_manuales(p_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_club uuid; v_rol text;
begin
  select club_id, rol into v_club, v_rol from secretaria_actual();
  if v_club is null then raise exception 'TDS:SIN_ALCANCE'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'numeroSeguimiento', r.numero_seguimiento,
      'archivo', r.nombre_archivo,
      'hash', r.hash_sha256,
      'tamanoBytes', r.tamano_bytes,
      'tipoMime', r.tipo_mime,
      'contexto', r.contexto,
      'motivo', r.motivo,
      'estado', r.estado,
      'etiquetaEstado', case r.estado
        when 'RECIBIDA_PARA_REVISION' then 'Revisión manual pendiente'
        when 'EN_REVISION' then 'En revisión'
        when 'PROCESADA' then 'Procesada a mano'
        when 'RECHAZADA' then 'Rechazada'
        else 'Archivo purgado' end,
      'enviadoPor', me.nombre,
      'recibidaEn', r.creado_en,
      'retenerHasta', r.retener_hasta,
      'purgadoEn', r.purgado_en,
      'archivoDisponible', r.ruta_storage is not null and r.purgado_en is null,
      'notasRevision', r.notas_revision)
      order by r.creado_en desc)
      from planilla_recepcion r
      join membresia me on me.id = r.enviado_por
     where r.club_id = v_club
       and (p_id is null or r.id = p_id)
  ), '[]'::jsonb);
end; $$;

revoke execute on function registrar_recepcion_manual(text,text,bigint,text,jsonb,text) from public, anon;
grant execute on function registrar_recepcion_manual(text,text,bigint,text,jsonb,text) to authenticated;
revoke execute on function confirmar_archivo_recepcion(uuid,text) from public, anon;
grant execute on function confirmar_archivo_recepcion(uuid,text) to authenticated;
revoke execute on function recepciones_manuales(uuid) from public, anon;
grant execute on function recepciones_manuales(uuid) to authenticated;

-- ---------- Retención ----------
-- El original se conserva 180 días desde la recepción, o 30 días desde que
-- se resolvió (procesada o rechazada), lo que ocurra primero. Vencido el
-- plazo se borra el ARCHIVO; la fila queda como constancia auditable con
-- estado PURGADA. Esta función devuelve las rutas a borrar del bucket: el
-- borrado físico lo hace el job con la clave de servicio.
create or replace function planillas_a_purgar()
returns table (id uuid, ruta text, numero text)
language sql stable security definer set search_path = public
as $$
  select r.id, r.ruta_storage, r.numero_seguimiento
    from planilla_recepcion r
   where r.purgado_en is null
     and r.ruta_storage is not null
     and (r.retener_hasta < current_date
          or (r.estado in ('PROCESADA','RECHAZADA')
              and r.actualizado_en < now() - interval '30 days'))
$$;

create or replace function marcar_planilla_purgada(p_id uuid)
returns void
language sql security definer set search_path = public
as $$
  update planilla_recepcion
     set estado = 'PURGADA', purgado_en = now(), ruta_storage = null, actualizado_en = now()
   where id = p_id
$$;

revoke execute on function planillas_a_purgar() from public, anon, authenticated;
revoke execute on function marcar_planilla_purgada(uuid) from public, anon, authenticated;
