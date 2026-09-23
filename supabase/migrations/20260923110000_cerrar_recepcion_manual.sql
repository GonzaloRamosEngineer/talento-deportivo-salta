-- ============================================================
-- CIERRE DEL CIRCUITO DE RECEPCIÓN MANUAL
-- Convergente. Staging yncidsgcypyyvurtyesx. NO aplicar a producción.
--
-- 1) Transiciones de estado auditadas.
-- 2) PROCESADA exige un lote_importacion CONFIRMADO del mismo espacio.
-- 3) Retención efectiva: job diario que borra del bucket privado y recién
--    entonces marca la fila. Idempotente y reintentable.
-- 4) Fallo de subida recuperable: una recepción sin archivo no se presenta
--    como recibida ni bloquea el reintento.
-- ============================================================

alter table planilla_recepcion drop constraint if exists planilla_recepcion_estado_check;
alter table planilla_recepcion add constraint planilla_recepcion_estado_check
  check (estado in ('PENDIENTE_ARCHIVO','ERROR_SUBIDA','RECIBIDA_PARA_REVISION',
                    'EN_REVISION','PROCESADA','RECHAZADA','PURGADA'));

alter table planilla_recepcion add column if not exists lote_importacion_id uuid
  references lote_importacion(id) on delete restrict;
alter table planilla_recepcion add column if not exists detalle_error text;
alter table planilla_recepcion add column if not exists intentos_subida int not null default 0;
alter table planilla_recepcion add column if not exists revisado_en timestamptz;

alter table correccion_auditoria drop constraint if exists correccion_auditoria_entidad_check;
alter table correccion_auditoria add constraint correccion_auditoria_entidad_check
  check (entidad in ('lote_importacion','jornada_evaluacion','institucion_origen','categoria',
                     'deportista','disciplina_solicitud','resolucion_lote','planilla_recepcion'));

-- El duplicado solo aplica a recepciones COMPLETAS. Una fila sin archivo no
-- bloquea el reintento: se reutiliza.
drop index if exists uq_recepcion_hash_contexto;
create unique index if not exists uq_recepcion_hash_contexto
  on planilla_recepcion (
    club_id, hash_sha256,
    (contexto ->> 'institucionOrigen'),
    (contexto ->> 'disciplina'),
    (contexto ->> 'grupo')
  ) where estado in ('RECIBIDA_PARA_REVISION','EN_REVISION') and ruta_storage is not null;

-- ---------- 1 · Transiciones auditadas ----------
create or replace function cambiar_estado_recepcion(
  p_id     uuid,
  p_estado text,
  p_motivo text default null,
  p_lote_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mem uuid; v_club uuid; v_rol text; v_r planilla_recepcion%rowtype; v_lote lote_importacion%rowtype;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  -- Revisar es una decisión de gestión: el evaluador envía, no resuelve.
  if v_rol not in ('admin_secretaria','coordinador_secretaria') then raise exception 'TDS:ROL_INSUFICIENTE'; end if;

  select * into v_r from planilla_recepcion where id = p_id and club_id = v_club for update;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;

  if p_estado not in ('EN_REVISION','PROCESADA','RECHAZADA') then raise exception 'TDS:ESTADO_INVALIDO'; end if;

  -- Máquina de estados: RECIBIDA → EN_REVISION → PROCESADA | RECHAZADA.
  if p_estado = 'EN_REVISION' and v_r.estado <> 'RECIBIDA_PARA_REVISION' then
    raise exception 'TDS:TRANSICION_INVALIDA:% -> %', v_r.estado, p_estado;
  end if;
  if p_estado in ('PROCESADA','RECHAZADA') and v_r.estado <> 'EN_REVISION' then
    raise exception 'TDS:TRANSICION_INVALIDA:% -> %', v_r.estado, p_estado;
  end if;

  if p_estado = 'RECHAZADA' and coalesce(trim(p_motivo),'') = '' then
    raise exception 'TDS:MOTIVO_REQUERIDO';
  end if;

  -- PROCESADA exige la importación que la resolvió: sin lote confirmado no
  -- hay trazabilidad entre el archivo original y los datos cargados.
  if p_estado = 'PROCESADA' then
    if p_lote_id is null then raise exception 'TDS:LOTE_REQUERIDO'; end if;
    select * into v_lote from lote_importacion where id = p_lote_id and club_id = v_club;
    if not found then raise exception 'TDS:LOTE_DESCONOCIDO'; end if;
    if v_lote.estado <> 'importado' then raise exception 'TDS:LOTE_NO_CONFIRMADO'; end if;
  end if;

  insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
  values (v_club,'planilla_recepcion',v_r.id,'estado',v_r.estado,p_estado,
          coalesce(nullif(trim(p_motivo),''),'Cambio de estado de recepción'), v_mem);

  update planilla_recepcion
     set estado = p_estado,
         revisado_por = v_mem,
         revisado_en = now(),
         notas_revision = coalesce(nullif(trim(p_motivo),''), notas_revision),
         lote_importacion_id = coalesce(p_lote_id, lote_importacion_id),
         actualizado_en = now()
   where id = v_r.id;

  return (select jsonb_build_object(
    'id', r.id, 'numeroSeguimiento', r.numero_seguimiento, 'estado', r.estado,
    'responsable', me.nombre, 'revisadoEn', r.revisado_en,
    'motivo', r.notas_revision,
    'loteImportacionId', r.lote_importacion_id,
    'planillaImportada', li.nombre_archivo)
    from planilla_recepcion r
    join membresia me on me.id = r.revisado_por
    left join lote_importacion li on li.id = r.lote_importacion_id
   where r.id = v_r.id);
end; $$;

revoke execute on function cambiar_estado_recepcion(uuid,text,text,uuid) from public, anon;
grant execute on function cambiar_estado_recepcion(uuid,text,text,uuid) to authenticated;

-- ---------- 4 · Fallo de subida recuperable ----------
create or replace function marcar_error_subida_recepcion(p_id uuid, p_detalle text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_club uuid;
begin
  select club_id into v_club from secretaria_actual();
  if v_club is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  update planilla_recepcion
     set estado = 'ERROR_SUBIDA', detalle_error = left(coalesce(p_detalle,''), 400), actualizado_en = now()
   where id = p_id and club_id = v_club and ruta_storage is null;
end; $$;

-- Reutiliza una recepción sin archivo (nueva o fallida) en vez de crear otra.
create or replace function recuperar_recepcion_sin_archivo(p_hash text, p_contexto jsonb)
returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare v_club uuid; v_id uuid;
begin
  select club_id into v_club from secretaria_actual();
  if v_club is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  select id into v_id from planilla_recepcion
   where club_id = v_club and hash_sha256 = p_hash and ruta_storage is null
     and estado in ('PENDIENTE_ARCHIVO','ERROR_SUBIDA')
     and contexto ->> 'institucionOrigen' = p_contexto ->> 'institucionOrigen'
     and contexto ->> 'disciplina' = p_contexto ->> 'disciplina'
     and contexto ->> 'grupo' = p_contexto ->> 'grupo'
   order by creado_en desc limit 1;
  return v_id;
end; $$;

-- Al confirmar la ruta, la recepción pasa a estar realmente recibida.
create or replace function confirmar_archivo_recepcion(p_id uuid, p_ruta text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_mem uuid; v_club uuid; v_num text;
begin
  select membresia_id, club_id into v_mem, v_club from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  update planilla_recepcion
     set ruta_storage = p_ruta,
         estado = 'RECIBIDA_PARA_REVISION',
         detalle_error = null,
         intentos_subida = intentos_subida + 1,
         actualizado_en = now()
   where id = p_id and club_id = v_club and ruta_storage is null
  returning numero_seguimiento into v_num;
  if v_num is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  return jsonb_build_object('id', p_id, 'rutaStorage', p_ruta, 'numeroSeguimiento', v_num,
                            'estado','RECIBIDA_PARA_REVISION');
end; $$;

revoke execute on function marcar_error_subida_recepcion(uuid,text) from public, anon;
grant execute on function marcar_error_subida_recepcion(uuid,text) to authenticated;
revoke execute on function recuperar_recepcion_sin_archivo(text,jsonb) from public, anon;
grant execute on function recuperar_recepcion_sin_archivo(text,jsonb) to authenticated;

-- La recepción NACE sin archivo: recién se declara recibida cuando la subida
-- confirmó. Así un fallo de subida nunca se presenta como "recibida".
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

  -- Duplicado real: solo cuenta una recepción CON archivo.
  select * into v_exist from planilla_recepcion
   where club_id = v_club and hash_sha256 = p_hash and ruta_storage is not null
     and contexto ->> 'institucionOrigen' = p_contexto ->> 'institucionOrigen'
     and contexto ->> 'disciplina' = p_contexto ->> 'disciplina'
     and contexto ->> 'grupo' = p_contexto ->> 'grupo'
     and estado in ('RECIBIDA_PARA_REVISION','EN_REVISION');
  if found then
    return jsonb_build_object('estado', v_exist.estado, 'numeroSeguimiento', v_exist.numero_seguimiento,
      'id', v_exist.id, 'duplicada', true, 'reintento', false, 'recibidaEn', v_exist.creado_en);
  end if;

  -- Reintento: hay una fila previa sin archivo (nueva o fallida). Se reutiliza.
  v_id := recuperar_recepcion_sin_archivo(p_hash, p_contexto);
  if v_id is not null then
    select * into v_exist from planilla_recepcion where id = v_id;
    return jsonb_build_object('estado', v_exist.estado, 'numeroSeguimiento', v_exist.numero_seguimiento,
      'id', v_id, 'duplicada', false, 'reintento', true,
      'rutaStorage', v_club::text || '/' || v_id::text);
  end if;

  v_id := gen_random_uuid();
  v_num := 'RM-' || to_char(now(),'YYYYMMDD') || '-' || upper(substring(replace(v_id::text,'-','') from 1 for 6));
  insert into planilla_recepcion(
    id, club_id, numero_seguimiento, nombre_archivo, hash_sha256,
    tamano_bytes, tipo_mime, contexto, motivo, enviado_por, estado)
  values (v_id, v_club, v_num, p_nombre_archivo, p_hash,
          p_tamano, p_tipo_mime, p_contexto, nullif(trim(p_motivo),''), v_mem, 'PENDIENTE_ARCHIVO');

  return jsonb_build_object('estado','PENDIENTE_ARCHIVO','numeroSeguimiento',v_num,'id',v_id,
    'duplicada', false, 'reintento', false, 'rutaStorage', v_club::text || '/' || v_id::text);
end; $$;

revoke execute on function registrar_recepcion_manual(text,text,bigint,text,jsonb,text) from public, anon;
grant execute on function registrar_recepcion_manual(text,text,bigint,text,jsonb,text) to authenticated;

create or replace function recepciones_manuales(p_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_club uuid;
begin
  select club_id into v_club from secretaria_actual();
  if v_club is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'numeroSeguimiento', r.numero_seguimiento, 'archivo', r.nombre_archivo,
      'hash', r.hash_sha256, 'tamanoBytes', r.tamano_bytes, 'tipoMime', r.tipo_mime,
      'contexto', r.contexto, 'motivo', r.motivo, 'estado', r.estado,
      'etiquetaEstado', case r.estado
        when 'PENDIENTE_ARCHIVO' then 'Subida incompleta'
        when 'ERROR_SUBIDA' then 'Error al guardar el archivo'
        when 'RECIBIDA_PARA_REVISION' then 'Revisión manual pendiente'
        when 'EN_REVISION' then 'En revisión'
        when 'PROCESADA' then 'Procesada a mano'
        when 'RECHAZADA' then 'Rechazada'
        else 'Archivo purgado' end,
      'enviadoPor', me.nombre, 'recibidaEn', r.creado_en,
      'revisadoPor', mr.nombre, 'revisadoEn', r.revisado_en,
      'retenerHasta', r.retener_hasta, 'purgadoEn', r.purgado_en,
      'archivoDisponible', r.ruta_storage is not null and r.purgado_en is null,
      'reintentable', r.ruta_storage is null and r.estado in ('PENDIENTE_ARCHIVO','ERROR_SUBIDA'),
      'detalleError', r.detalle_error, 'intentosSubida', r.intentos_subida,
      'loteImportacionId', r.lote_importacion_id, 'planillaImportada', li.nombre_archivo,
      'notasRevision', r.notas_revision)
      order by r.creado_en desc)
      from planilla_recepcion r
      join membresia me on me.id = r.enviado_por
      left join membresia mr on mr.id = r.revisado_por
      left join lote_importacion li on li.id = r.lote_importacion_id
     where r.club_id = v_club and (p_id is null or r.id = p_id)
  ), '[]'::jsonb);
end; $$;

revoke execute on function recepciones_manuales(uuid) from public, anon;
grant execute on function recepciones_manuales(uuid) to authenticated;

-- Las incompletas también se purgan: a los 7 días sin archivo, la fila se cierra.
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
