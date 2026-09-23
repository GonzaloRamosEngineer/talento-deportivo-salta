-- ============================================================
-- Que ninguna planilla se pierda al cargarla — P0.
-- docs/BRIEF_BACKEND_CARGA_PLANILLAS.md, puntos 1 y 2.
--
-- 1) El original de TODO lote se guarda en un bucket privado. Hasta hoy
--    solo se guardaba el hash: con el lote vencido no había de dónde
--    retomar, y reprocesar exigía volver a subir exactamente el mismo
--    archivo.
-- 2) La revisión deja de vencer a los 30 minutos. Un lote con bloqueos
--    se puede retomar días después (7 días, que se renuevan con cada
--    decisión guardada), y un lote vencido se reabre reprocesando el
--    original guardado.
--
-- Convergente. Staging primero. REVISIÓN MANUAL REQUERIDA antes de
-- producción: guarda archivos con datos de menores y cambia los
-- privilegios de `lote_importacion`.
-- ============================================================

-- ---------- Bucket privado, paralelo al de la recepción manual ----------
-- Misma configuración que `planillas-recepcion`: sin URL pública, 20 MB,
-- solo csv/xls/xlsx. Ruta: <club_id>/<lote_id>.<ext>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'planillas-lotes',
  'planillas-lotes',
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

-- Lectura solo de roles de la Secretaría del MISMO espacio (el primer
-- segmento de la ruta es el club). Sin policies de escritura: la subida y
-- el borrado son siempre en servidor con la clave de servicio.
drop policy if exists "lotes_objetos_lectura" on storage.objects;
create policy "lotes_objetos_lectura" on storage.objects
  for select using (
    bucket_id = 'planillas-lotes'
    and exists (
      select 1 from membresia m
        join club c on c.id = m.club_id
       where m.auth_user_id = auth.uid()
         and c.tipo_organizacion = 'secretaria'
         and m.club_id::text = split_part(name, '/', 1)
         and m.rol in ('admin_secretaria','coordinador_secretaria','analista_secretaria')
    )
  );

-- ---------- Columnas del original ----------
alter table lote_importacion
  add column if not exists ruta_storage       text,
  add column if not exists tamano_bytes       bigint,
  add column if not exists tipo_mime          text,
  add column if not exists retener_hasta      date,
  add column if not exists purgado_en         timestamptz,
  add column if not exists detalle_error      text,
  add column if not exists original_requerido boolean not null default false;

-- Los lotes existentes quedan con `original_requerido = false` (nacieron
-- sin original y no hay de dónde sacarlo). Todo lote nuevo lo exige.
alter table lote_importacion alter column original_requerido set default true;
-- Misma retención que la recepción manual: 180 días, o 30 después de cerrado.
alter table lote_importacion alter column retener_hasta set default (current_date + 180);

comment on column lote_importacion.ruta_storage is
  'Original en el bucket privado planillas-lotes. Null = sin original (lote viejo, subida fallida o purgado).';
comment on column lote_importacion.original_requerido is
  'true en todo lote creado desde 20260923160000: no se confirma ni se revisa hasta que su original esté guardado.';

-- La ruta queda atada al club y al lote de la MISMA fila. Sin esto, alguien
-- podría apuntar la ruta al archivo de otro espacio y pedir su descarga.
alter table lote_importacion drop constraint if exists lote_ruta_storage_propia;
alter table lote_importacion add constraint lote_ruta_storage_propia check (
  ruta_storage is null
  or ruta_storage ~ ('^' || club_id::text || '/' || id::text || '\.(csv|xls|xlsx)$')
);
alter table lote_importacion drop constraint if exists lote_tamano_bytes_check;
alter table lote_importacion add constraint lote_tamano_bytes_check check (
  tamano_bytes is null or (tamano_bytes > 0 and tamano_bytes <= 20971520)
);

create index if not exists idx_lote_retencion
  on lote_importacion (retener_hasta) where purgado_en is null and ruta_storage is not null;

-- ---------- Privilegios por columna ----------
-- La policy `lote_update` deja al importador actualizar su lote. Nadie lo
-- hace directo desde la app (todo pasa por RPC), pero la policy mira filas,
-- no columnas: sin esto un cliente podría reescribir ruta_storage,
-- retener_hasta, purgado_en o original_requerido. Se concede solo lo que
-- usa `confirmar_lote_evaluacion` (security invoker) y el alta del lote.
-- OJO: una migración futura que haga `grant update on lote_importacion`
-- a nivel tabla deshace esto.
revoke insert, update on lote_importacion from authenticated;
grant insert (
  id, club_id, nombre_archivo, hash_sha256, adaptador, contexto, preview_json,
  hallazgos, filas_ignoradas, duplicados_archivo, bloqueos_pendientes,
  importado_por, vence_en, tamano_bytes, tipo_mime
) on lote_importacion to authenticated;
grant update (estado, resoluciones, resultado, confirmado_en, preview_json)
  on lote_importacion to authenticated;

-- ---------- Eventos nuevos de la trazabilidad ----------
alter table lote_importacion_evento drop constraint if exists lote_importacion_evento_tipo_check;
alter table lote_importacion_evento add constraint lote_importacion_evento_tipo_check check (
  tipo in ('previsualizado','confirmado','corregido','anulado',
           'archivo_guardado','archivo_fallido')
);

-- ---------- Invariante: sin original guardado no se importa ----------
-- Vive en un trigger para cubrir los DOS caminos de confirmación (el de la
-- revisión y el del token de /api/evaluaciones/importar). Solo mira los
-- lotes nuevos: los viejos no tienen original y no se les puede exigir.
create or replace function lote_importacion_invariantes()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.estado = 'importado' and old.estado is distinct from 'importado'
     and new.original_requerido and new.ruta_storage is null and new.purgado_en is null then
    raise exception 'TDS:ORIGINAL_PENDIENTE';
  end if;
  return new;
end; $$;

drop trigger if exists trg_lote_importacion_invariantes on lote_importacion;
create trigger trg_lote_importacion_invariantes
  before update of estado on lote_importacion
  for each row execute function lote_importacion_invariantes();

-- ---------- Registrar el original ----------
-- El server inserta el lote, sube el archivo con la clave de servicio y
-- recién entonces lo registra acá. Idempotente para la misma ruta.
create or replace function confirmar_archivo_lote(p_lote_id uuid, p_ruta text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_mem uuid; v_club uuid; v_l lote_importacion%rowtype;
begin
  select membresia_id, club_id into v_mem, v_club from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;

  select * into v_l from lote_importacion
   where id = p_lote_id and club_id = v_club and importado_por = v_mem for update;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;

  if v_l.ruta_storage is not null then
    if v_l.ruta_storage = p_ruta then
      return jsonb_build_object('loteId', v_l.id, 'rutaStorage', v_l.ruta_storage);
    end if;
    raise exception 'TDS:ARCHIVO_YA_GUARDADO';
  end if;
  if v_l.estado <> 'previsualizado' then raise exception 'TDS:LOTE_NO_EDITABLE'; end if;

  begin
    update lote_importacion
       set ruta_storage = p_ruta, detalle_error = null
     where id = v_l.id;
  exception when check_violation then
    raise exception 'TDS:RUTA_INVALIDA';
  end;

  insert into lote_importacion_evento(lote_id, membresia_id, tipo, detalle)
  values (v_l.id, v_mem, 'archivo_guardado', jsonb_build_object('ruta', p_ruta));

  return jsonb_build_object('loteId', v_l.id, 'rutaStorage', p_ruta);
end; $$;

-- Si la subida falla, el lote NO queda como previsualizado usable: se
-- cierra como `fallido` con el detalle, igual que marcar_error_subida_recepcion.
create or replace function marcar_error_subida_lote(p_lote_id uuid, p_detalle text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_mem uuid; v_club uuid; v_id uuid;
begin
  select membresia_id, club_id into v_mem, v_club from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  update lote_importacion
     set estado = 'fallido', detalle_error = left(coalesce(p_detalle,''), 400)
   where id = p_lote_id and club_id = v_club and importado_por = v_mem
     and ruta_storage is null and estado = 'previsualizado'
  returning id into v_id;
  if v_id is not null then
    insert into lote_importacion_evento(lote_id, membresia_id, tipo, detalle)
    values (v_id, v_mem, 'archivo_fallido', jsonb_build_object('detalle', left(coalesce(p_detalle,''), 400)));
  end if;
end; $$;

-- ---------- Guardar resoluciones: ahora renueva la revisión ----------
-- Cada decisión guardada extiende el lote a `now() + 7 días`. Si hay que
-- pedirle la fecha al club, el lote espera la respuesta.
create or replace function guardar_resoluciones_lote(p_lote_id uuid, p_resoluciones jsonb, p_motivo text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_l lote_importacion%rowtype; v_mem uuid; v_club uuid; v_rol text;
  v_id text; v_valor jsonb; v_antes jsonb; v_n int := 0;
  v_bloqueos text[]; v_faltan text[]; v_vence timestamptz;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_rol not in ('admin_secretaria','coordinador_secretaria') then raise exception 'TDS:ROL_INSUFICIENTE'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'TDS:MOTIVO_REQUERIDO'; end if;

  select * into v_l from lote_importacion where id = p_lote_id and club_id = v_club for update;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_l.estado <> 'previsualizado' then raise exception 'TDS:LOTE_NO_EDITABLE'; end if;
  if v_l.vence_en < now() then raise exception 'TDS:PREVIEW_EXPIRADO'; end if;
  if v_l.original_requerido and v_l.ruta_storage is null and v_l.purgado_en is null then
    raise exception 'TDS:ORIGINAL_PENDIENTE';
  end if;

  select array_agg(h ->> 'id') into v_bloqueos
    from jsonb_array_elements(v_l.hallazgos) h where h ->> 'severidad' = 'bloqueo';

  for v_id, v_valor in select key, value from jsonb_each(p_resoluciones) loop
    if not (v_id = any(coalesce(v_bloqueos, array[]::text[]))) then
      raise exception 'TDS:HALLAZGO_DESCONOCIDO';
    end if;
    if v_id = 'protocolos-desconocidos' then
      perform validar_mapa_protocolos(v_l.id, v_valor);
    end if;
    -- La fecha la ingresa la persona. Acá solo se valida que sea una fecha.
    if v_id like 'fecha%' then
      begin
        perform (v_valor #>> '{}')::date;
      exception when others then raise exception 'TDS:FECHA_INVALIDA'; end;
    end if;
    v_antes := v_l.resoluciones_borrador -> v_id;
    if v_antes is distinct from v_valor then
      insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
      values (v_club,'resolucion_lote',v_l.id,v_id,v_antes #>> '{}', v_valor #>> '{}', p_motivo, v_mem);
      v_n := v_n + 1;
    end if;
  end loop;

  update lote_importacion
     set resoluciones_borrador = resoluciones_borrador || p_resoluciones,
         vence_en = greatest(vence_en, now() + interval '7 days')
   where id = v_l.id
  returning resoluciones_borrador, vence_en into v_valor, v_vence;

  select array_agg(b) into v_faltan from unnest(coalesce(v_bloqueos, array[]::text[])) b
   where not (v_valor ? b);

  return jsonb_build_object(
    'loteId', v_l.id,
    'resoluciones', v_valor,
    'cambios', v_n,
    'venceEn', v_vence,
    'bloqueosPendientes', coalesce(v_faltan, array[]::text[]),
    'listoParaConfirmar', coalesce(array_length(v_faltan,1),0) = 0
  );
end; $$;

-- ---------- Reprocesar: reabre la revisión por 7 días ----------
-- Es la forma de retomar un lote vencido. El server lee el original del
-- bucket (o, en lotes viejos sin original, el archivo que suba la persona)
-- y verifica el hash antes de llamar acá.
create or replace function reprocesar_lote_previsualizado(p_lote_id uuid, p_hash text, p_preview jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_l lote_importacion%rowtype; v_mem uuid; v_club uuid; v_rol text; v_bloq int; v_vence timestamptz;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_rol not in ('admin_secretaria','coordinador_secretaria') then raise exception 'TDS:ROL_INSUFICIENTE'; end if;

  select * into v_l from lote_importacion where id = p_lote_id and club_id = v_club for update;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_l.estado <> 'previsualizado' then raise exception 'TDS:LOTE_NO_EDITABLE'; end if;
  if v_l.hash_sha256 is distinct from p_hash then raise exception 'TDS:ARCHIVO_DISTINTO'; end if;

  select count(*)::int into v_bloq
    from jsonb_array_elements(coalesce(p_preview -> 'hallazgos','[]'::jsonb)) h
   where h ->> 'severidad' = 'bloqueo';

  update lote_importacion
     set preview_json = p_preview,
         hallazgos = coalesce(p_preview -> 'hallazgos','[]'::jsonb),
         filas_ignoradas = coalesce((p_preview ->> 'filasIgnoradas')::int, 0),
         duplicados_archivo = coalesce((p_preview ->> 'duplicados')::int, 0),
         bloqueos_pendientes = v_bloq,
         reprocesado_en = now(),
         vence_en = greatest(vence_en, now() + interval '7 days')
   where id = v_l.id
  returning vence_en into v_vence;

  insert into lote_importacion_evento(lote_id, membresia_id, tipo, detalle)
  values (v_l.id, v_mem, 'corregido', jsonb_build_object('accion','reprocesado','bloqueos',v_bloq));

  return jsonb_build_object('loteId', v_l.id, 'bloqueos', v_bloq, 'venceEn', v_vence,
    'filasSinProtocolo', jsonb_array_length(coalesce(p_preview -> 'filasSinProtocolo','[]'::jsonb)));
end; $$;

-- ---------- Revisión: dice si hay original y si se puede reprocesar ----------
create or replace function bloqueos_lote(p_lote_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_l lote_importacion%rowtype; v_mem uuid; v_club uuid; v_rol text; v_disponible boolean;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;

  select * into v_l from lote_importacion where id = p_lote_id and club_id = v_club;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;
  v_disponible := v_l.ruta_storage is not null and v_l.purgado_en is null;

  return jsonb_build_object(
    'loteId', v_l.id,
    'archivo', v_l.nombre_archivo,
    'hash', v_l.hash_sha256,
    'estado', v_l.estado,
    'vencido', v_l.vence_en < now(),
    'venceEn', v_l.vence_en,
    'editable', v_l.estado = 'previsualizado' and v_l.vence_en >= now()
                and not (v_l.original_requerido and v_l.ruta_storage is null and v_l.purgado_en is null),
    'contexto', v_l.contexto,
    'resolucionesGuardadas', v_l.resoluciones_borrador,
    'reprocesadoEn', v_l.reprocesado_en,
    -- Original: el reproceso ya no pide el archivo cuando está guardado.
    'archivoGuardado', v_disponible,
    'rutaStorage', case when v_disponible then v_l.ruta_storage end,
    'reprocesable', v_l.estado = 'previsualizado',
    'reprocesoPideArchivo', v_l.estado = 'previsualizado' and not v_disponible,
    'retenerHasta', v_l.retener_hasta,
    'purgadoEn', v_l.purgado_en,
    'filasSinProtocolo', coalesce(v_l.preview_json -> 'filasSinProtocolo', '[]'::jsonb),
    'protocolosDisponibles', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', p.codigo, 'nombre', p.nombre) order by p.codigo)
        from protocolo p
        join disciplina_protocolo dp on dp.protocolo_id = p.id and dp.activo
        join disciplina d on d.id = dp.disciplina_id
       where p.activo and lower(d.nombre) = lower(v_l.contexto ->> 'disciplina')
    ), '[]'::jsonb),
    'bloqueos', coalesce((
      select jsonb_agg(h || jsonb_build_object(
               'resuelto', v_l.resoluciones_borrador ? (h ->> 'id'),
               'resolucion', v_l.resoluciones_borrador -> (h ->> 'id')))
        from jsonb_array_elements(v_l.hallazgos) h
       where h ->> 'severidad' = 'bloqueo'
    ), '[]'::jsonb),
    'avisos', coalesce((
      select jsonb_agg(h) from jsonb_array_elements(v_l.hallazgos) h
       where h ->> 'severidad' <> 'bloqueo'
    ), '[]'::jsonb)
  );
end; $$;

-- ---------- Detalle: también informa el original ----------
create or replace function detalle_lote_importacion(p_lote_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_lote lote_importacion%rowtype;
  v_res  jsonb;
begin
  select * into v_lote from lote_importacion where id = p_lote_id;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;
  if membresia_actual(v_lote.club_id) is null then raise exception 'TDS:SIN_ALCANCE'; end if;

  select jsonb_build_object(
    'loteId', v_lote.id,
    'archivo', v_lote.nombre_archivo,
    'hash', v_lote.hash_sha256,
    'adaptador', v_lote.adaptador,
    'estado', v_lote.estado,
    'contexto', v_lote.contexto,
    'recibidoEn', v_lote.creado_en,
    'confirmadoEn', v_lote.confirmado_en,
    'venceEn', v_lote.vence_en,
    'filasIgnoradas', v_lote.filas_ignoradas,
    'duplicados', v_lote.duplicados_archivo,
    'bloqueosPendientes', v_lote.bloqueos_pendientes,
    'hallazgos', v_lote.hallazgos,
    'resoluciones', v_lote.resoluciones,
    'resultado', v_lote.resultado,
    'archivoDisponible', v_lote.ruta_storage is not null and v_lote.purgado_en is null,
    'retenerHasta', v_lote.retener_hasta,
    'purgadoEn', v_lote.purgado_en,
    'detalleError', v_lote.detalle_error,
    'correcciones', coalesce((
      select jsonb_agg(jsonb_build_object(
               'campo', c.campo, 'antes', c.valor_anterior, 'despues', c.valor_nuevo,
               'motivo', c.motivo, 'por', m.nombre, 'cuando', c.creado_en)
             order by c.creado_en)
        from correccion_auditoria c join membresia m on m.id = c.membresia_id
       where c.entidad = 'lote_importacion' and c.entidad_id = v_lote.id
    ), '[]'::jsonb)
  ) into v_res;

  if v_lote.estado = 'importado' then
    -- Reconstrucción desde los datos reales, no desde el preview vaciado.
    v_res := v_res || jsonb_build_object(
      'deportistas', (select count(distinct m.deportista_id)::int from medicion m where m.lote_importacion_id = v_lote.id),
      'mediciones',  (select count(*)::int from medicion m where m.lote_importacion_id = v_lote.id),
      'jornadas', coalesce((
        select jsonb_agg(jsonb_build_object('id', j.id, 'fecha', j.fecha, 'grupo', cat.nombre,
                                            'evaluadoPor', j.evaluado_por, 'mediciones', x.n) order by j.fecha)
          from (select jornada_id, count(*)::int n from medicion where lote_importacion_id = v_lote.id group by 1) x
          join jornada_evaluacion j on j.id = x.jornada_id
          join categoria cat on cat.id = j.categoria_id
      ), '[]'::jsonb),
      'protocolos', coalesce((
        select jsonb_agg(distinct p.codigo) from medicion m
          join protocolo p on p.id = m.protocolo_id where m.lote_importacion_id = v_lote.id
      ), '[]'::jsonb),
      'metricas', coalesce((
        select jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nombre', a.nombre, 'unidad', a.unidad, 'cantidad', t.n))
          from (select atributo_id, count(*)::int n from medicion where lote_importacion_id = v_lote.id group by 1) t
          join atributo a on a.id = t.atributo_id
      ), '[]'::jsonb)
    );
  else
    -- Todavía previsualizado: el preview es la única fuente disponible.
    v_res := v_res || jsonb_build_object(
      'deportistas', (select count(distinct value ->> 'deportistaClave')::int
                        from jsonb_array_elements(coalesce(v_lote.preview_json -> 'mediciones','[]'::jsonb))),
      'mediciones',  (select count(*)::int
                        from jsonb_array_elements(coalesce(v_lote.preview_json -> 'mediciones','[]'::jsonb))),
      'jornadas', '[]'::jsonb,
      'protocolos', coalesce(v_lote.preview_json -> 'protocolos', '[]'::jsonb),
      'metricas', coalesce((
        select jsonb_agg(distinct value ->> 'atributoCodigo')
          from jsonb_array_elements(coalesce(v_lote.preview_json -> 'mediciones','[]'::jsonb))
      ), '[]'::jsonb)
    );
  end if;

  return v_res;
end; $$;

-- ---------- Retención de los originales de lotes ----------
-- 180 días desde la subida, o 30 días después de importado o fallido.
create or replace function lotes_a_purgar()
returns table(id uuid, ruta text)
language sql stable security definer set search_path = public
as $$
  select l.id, l.ruta_storage
    from lote_importacion l
   where l.purgado_en is null
     and l.ruta_storage is not null
     and (l.retener_hasta < current_date
          or (l.estado in ('importado','fallido')
              and coalesce(l.confirmado_en, l.creado_en) < now() - interval '30 days'))
$$;

create or replace function marcar_lote_purgado(p_id uuid)
returns void
language sql security definer set search_path = public
as $$
  update lote_importacion
     set purgado_en = now(), ruta_storage = null
   where id = p_id
$$;

-- El job existente (`purgar-planillas-recepcion`, 04:15 UTC) ahora recorre
-- los dos buckets. Mismas reglas: 200/404 = purgado; cualquier otro error
-- deja la fila para la próxima corrida y queda en purga_ejecucion.
create or replace function purgar_planillas_recepcion()
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_url text; v_clave text; v_fila record;
  v_resp extensions.http_response; v_cand int := 0; v_ok int := 0; v_mal int := 0;
  v_detalle jsonb := '[]'::jsonb;
begin
  select decrypted_secret into v_url   from vault.decrypted_secrets where name = 'supabase_url';
  select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'service_key';
  if v_url is null or v_clave is null then
    raise exception 'Faltan los secretos supabase_url/service_key en el Vault';
  end if;

  for v_fila in
    select 'recepcion'::text as tipo, p.id, p.ruta, p.numero as ref, 'planillas-recepcion'::text as bucket
      from planillas_a_purgar() p
    union all
    -- Del lote solo se registra el id: purga_ejecucion la lee la plataforma,
    -- que nunca ve nombres de archivo de un espacio.
    select 'lote'::text, l.id, l.ruta, l.id::text, 'planillas-lotes'::text
      from lotes_a_purgar() l
  loop
    v_cand := v_cand + 1;
    begin
      select * into v_resp from extensions.http((
        'DELETE',
        v_url || '/storage/v1/object/' || v_fila.bucket || '/' || v_fila.ruta,
        array[
          extensions.http_header('authorization','Bearer ' || v_clave),
          extensions.http_header('apikey', v_clave)
        ],
        null, null)::extensions.http_request);

      -- 200 = borrado. 404 = ya no estaba: el objetivo igual se cumplió.
      if v_resp.status in (200, 404) then
        if v_fila.tipo = 'recepcion' then
          perform marcar_planilla_purgada(v_fila.id);
        else
          perform marcar_lote_purgado(v_fila.id);
        end if;
        v_ok := v_ok + 1;
      else
        v_mal := v_mal + 1;
        v_detalle := v_detalle || jsonb_build_array(jsonb_build_object(
          'tipo', v_fila.tipo, 'numero', v_fila.ref, 'status', v_resp.status));
      end if;
    exception when others then
      -- La fila queda para el próximo intento; nunca se marca a ciegas.
      v_mal := v_mal + 1;
      v_detalle := v_detalle || jsonb_build_array(jsonb_build_object(
        'tipo', v_fila.tipo, 'numero', v_fila.ref, 'error', left(SQLERRM, 200)));
    end;
  end loop;

  insert into purga_ejecucion(candidatas, purgadas, fallidas, detalle)
  values (v_cand, v_ok, v_mal, v_detalle);

  return jsonb_build_object('candidatas', v_cand, 'purgadas', v_ok, 'fallidas', v_mal);
end; $$;

-- ---------- Quién ejecuta qué ----------
revoke execute on function lote_importacion_invariantes() from public, anon, authenticated;
revoke execute on function confirmar_archivo_lote(uuid, text) from public, anon;
revoke execute on function marcar_error_subida_lote(uuid, text) from public, anon;
grant execute on function confirmar_archivo_lote(uuid, text) to authenticated;
grant execute on function marcar_error_subida_lote(uuid, text) to authenticated;
-- La purga y sus piezas: solo el job (postgres) y la clave de servicio.
revoke execute on function lotes_a_purgar() from public, anon, authenticated;
revoke execute on function marcar_lote_purgado(uuid) from public, anon, authenticated;
revoke execute on function purgar_planillas_recepcion() from public, anon, authenticated;
grant execute on function lotes_a_purgar() to service_role;
grant execute on function marcar_lote_purgado(uuid) to service_role;
grant execute on function purgar_planillas_recepcion() to service_role;
