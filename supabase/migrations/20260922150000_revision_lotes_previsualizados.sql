-- ============================================================
-- REVISIÓN Y CONFIRMACIÓN DE PLANILLAS PREVISUALIZADAS
-- Convergente. Staging yncidsgcypyyvurtyesx. NO aplicar a producción.
--
-- Una planilla con bloqueos no se confirma hasta que una PERSONA
-- resuelve cada uno. Nada se propone por inferencia: ni fechas ni
-- protocolos. Las filas sin protocolo no se descartan en silencio.
-- ============================================================

alter table lote_importacion add column if not exists resoluciones_borrador jsonb not null default '{}'::jsonb;
alter table lote_importacion add column if not exists reprocesado_en timestamptz;

alter table correccion_auditoria drop constraint if exists correccion_auditoria_entidad_check;
alter table correccion_auditoria add constraint correccion_auditoria_entidad_check
  check (entidad in ('lote_importacion','jornada_evaluacion','institucion_origen',
                     'categoria','deportista','disciplina_solicitud','resolucion_lote'));

-- ---------- 1 · Bloqueos de un lote, con filas y opciones ----------
create or replace function bloqueos_lote(p_lote_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_l lote_importacion%rowtype; v_mem uuid; v_club uuid; v_rol text;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;

  select * into v_l from lote_importacion where id = p_lote_id and club_id = v_club;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;

  return jsonb_build_object(
    'loteId', v_l.id,
    'archivo', v_l.nombre_archivo,
    'hash', v_l.hash_sha256,
    'estado', v_l.estado,
    'vencido', v_l.vence_en < now(),
    'venceEn', v_l.vence_en,
    'editable', v_l.estado = 'previsualizado' and v_l.vence_en >= now(),
    'contexto', v_l.contexto,
    'resolucionesGuardadas', v_l.resoluciones_borrador,
    'reprocesadoEn', v_l.reprocesado_en,
    -- Sin preview (lote importado) no hay filas que mostrar: el detalle
    -- posterior se consulta con detalle_lote_importacion().
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

revoke execute on function bloqueos_lote(uuid) from public, anon;
grant execute on function bloqueos_lote(uuid) to authenticated;

-- ---------- 2 · Guardar resoluciones (borrador, auditado) ----------
create or replace function guardar_resoluciones_lote(
  p_lote_id     uuid,
  p_resoluciones jsonb,
  p_motivo      text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_l lote_importacion%rowtype; v_mem uuid; v_club uuid; v_rol text;
  v_id text; v_valor jsonb; v_antes jsonb; v_n int := 0;
  v_bloqueos text[]; v_faltan text[];
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_rol not in ('admin_secretaria','coordinador_secretaria') then raise exception 'TDS:ROL_INSUFICIENTE'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'TDS:MOTIVO_REQUERIDO'; end if;

  select * into v_l from lote_importacion where id = p_lote_id and club_id = v_club for update;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_l.estado <> 'previsualizado' then raise exception 'TDS:LOTE_NO_EDITABLE'; end if;
  if v_l.vence_en < now() then raise exception 'TDS:PREVIEW_EXPIRADO'; end if;

  select array_agg(h ->> 'id') into v_bloqueos
    from jsonb_array_elements(v_l.hallazgos) h where h ->> 'severidad' = 'bloqueo';

  for v_id, v_valor in select key, value from jsonb_each(p_resoluciones) loop
    if not (v_id = any(coalesce(v_bloqueos, array[]::text[]))) then
      raise exception 'TDS:HALLAZGO_DESCONOCIDO';
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
     set resoluciones_borrador = resoluciones_borrador || p_resoluciones
   where id = v_l.id
  returning resoluciones_borrador into v_valor;

  select array_agg(b) into v_faltan from unnest(coalesce(v_bloqueos, array[]::text[])) b
   where not (v_valor ? b);

  return jsonb_build_object(
    'loteId', v_l.id,
    'resoluciones', v_valor,
    'cambios', v_n,
    'bloqueosPendientes', coalesce(v_faltan, array[]::text[]),
    'listoParaConfirmar', coalesce(array_length(v_faltan,1),0) = 0
  );
end; $$;

revoke execute on function guardar_resoluciones_lote(uuid,jsonb,text) from public, anon;
grant execute on function guardar_resoluciones_lote(uuid,jsonb,text) to authenticated;

-- ---------- 3 · Reprocesar el MISMO archivo sobre el MISMO lote ----------
-- Los lotes previsualizados con el parser viejo no conservan las filas sin
-- protocolo. Para resolverlas hay que volver a subir el archivo: se valida
-- que sea el mismo por hash y se actualiza el lote existente. Nunca se crea
-- otro lote ni se toca uno importado.
create or replace function reprocesar_lote_previsualizado(
  p_lote_id  uuid,
  p_hash     text,
  p_preview  jsonb
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_l lote_importacion%rowtype; v_mem uuid; v_club uuid; v_rol text; v_bloq int;
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
         vence_en = greatest(vence_en, now() + interval '2 hours')
   where id = v_l.id;

  insert into lote_importacion_evento(lote_id, membresia_id, tipo, detalle)
  values (v_l.id, v_mem, 'corregido', jsonb_build_object('accion','reprocesado','bloqueos',v_bloq));

  return jsonb_build_object('loteId', v_l.id, 'bloqueos', v_bloq,
    'filasSinProtocolo', jsonb_array_length(coalesce(p_preview -> 'filasSinProtocolo','[]'::jsonb)));
end; $$;

revoke execute on function reprocesar_lote_previsualizado(uuid,text,jsonb) from public, anon;
grant execute on function reprocesar_lote_previsualizado(uuid,text,jsonb) to authenticated;

-- ---------- 4 · Confirmación que honra las resoluciones ----------
-- Se apoya en confirmar_lote_evaluacion (que ya es transaccional e
-- idempotente) y antes materializa las filas sin protocolo que la persona
-- decidió mapear. Las excluidas quedan registradas, no desaparecen.
create or replace function confirmar_lote_revisado(
  p_lote_id uuid,
  p_motivo  text default 'Confirmación de planilla revisada'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_l lote_importacion%rowtype; v_mem uuid; v_club uuid; v_rol text;
  v_res jsonb; v_mapa jsonb; v_fila jsonb; v_prot text; v_cod text;
  v_nuevas jsonb := '[]'::jsonb; v_excluidas int := 0; v_mapeadas int := 0;
  v_faltan text[]; v_fecha text; v_valor text;
  METRICAS constant text[] := array['peso_corporal','altura_salto','fuerza_pico_aterrizaje',
    'potencia_relativa','rsi_mod','asimetria_aterrizaje','asimetria_concentrica','handgrip'];
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_rol not in ('admin_secretaria','coordinador_secretaria') then raise exception 'TDS:ROL_INSUFICIENTE'; end if;

  select * into v_l from lote_importacion where id = p_lote_id and club_id = v_club for update;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_l.estado = 'importado' then return v_l.resultado; end if;
  if v_l.estado <> 'previsualizado' then raise exception 'TDS:IMPORTACION_DUPLICADA'; end if;
  if v_l.vence_en < now() then raise exception 'TDS:PREVIEW_EXPIRADO'; end if;

  v_res := v_l.resoluciones_borrador;

  -- Todo bloqueo tiene que estar resuelto por una persona.
  select array_agg(h ->> 'id') into v_faltan
    from jsonb_array_elements(v_l.hallazgos) h
   where h ->> 'severidad' = 'bloqueo' and not (v_res ? (h ->> 'id'));
  if coalesce(array_length(v_faltan,1),0) > 0 then raise exception 'TDS:BLOQUEOS_PENDIENTES'; end if;

  -- Protocolos desconocidos: excluir o mapear. Nunca inferir.
  if v_res ? 'protocolos-desconocidos' then
    v_mapa := v_res -> 'protocolos-desconocidos';
    for v_fila in select value from jsonb_array_elements(coalesce(v_l.preview_json -> 'filasSinProtocolo','[]'::jsonb)) loop
      v_cod := v_fila ->> 'valorCrudo';
      v_prot := case
        when jsonb_typeof(v_mapa) = 'string' and (v_mapa #>> '{}') = 'excluir_todo' then null
        when jsonb_typeof(v_mapa) = 'object' then nullif(v_mapa ->> v_cod, 'excluir')
        else null end;
      if v_prot is null then
        v_excluidas := v_excluidas + 1;
        continue;
      end if;
      if not exists (select 1 from protocolo where codigo = v_prot and activo) then
        raise exception 'TDS:PROTOCOLO_DESCONOCIDO';
      end if;
      -- La fecha sale de la resolución de fecha o del contexto; jamás se inventa.
      v_fecha := coalesce(v_res ->> 'fecha-ausente', nullif(v_l.contexto ->> 'fechaDeclarada',''));
      if v_fecha is null then raise exception 'TDS:FECHA_REQUERIDA'; end if;
      foreach v_cod in array METRICAS loop
        v_valor := v_fila -> 'valores' ->> v_cod;
        continue when v_valor is null or btrim(v_valor) = '' or v_valor !~ '^-?[0-9]+(\.[0-9]+)?$';
        v_nuevas := v_nuevas || jsonb_build_array(jsonb_build_object(
          'deportistaClave', normalizar_clave((v_fila ->> 'nombre') || ' ' || coalesce(v_fila ->> 'apellido','')),
          'nombre', v_fila ->> 'nombre',
          'apellido', v_fila ->> 'apellido',
          'edad', v_fila -> 'edad',
          'fecha', v_fecha,
          'protocoloCodigo', case when v_cod in ('peso_corporal','handgrip') then null else v_prot end,
          'atributoCodigo', v_cod,
          'valor', v_valor::numeric,
          'intento', 1,
          'detalle', jsonb_build_object('origen','resolucion_protocolo','valorCrudo', v_fila ->> 'valorCrudo')));
        v_mapeadas := v_mapeadas + 1;
      end loop;
    end loop;

    if jsonb_array_length(v_nuevas) > 0 then
      update lote_importacion
         set preview_json = jsonb_set(preview_json, '{mediciones}',
               coalesce(preview_json -> 'mediciones','[]'::jsonb) || v_nuevas)
       where id = v_l.id;
    end if;
  end if;

  insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
  values (v_club,'resolucion_lote',v_l.id,'confirmacion',
          jsonb_build_object('filasExcluidas',v_excluidas,'medicionesMapeadas',v_mapeadas)::text,
          v_res::text, p_motivo, v_mem);

  -- La escritura real sigue siendo transaccional e idempotente.
  return confirmar_lote_evaluacion(v_l.id, v_res)
         || jsonb_build_object('filasExcluidas', v_excluidas, 'medicionesMapeadas', v_mapeadas);
end; $$;

revoke execute on function confirmar_lote_revisado(uuid,text) from public, anon;
grant execute on function confirmar_lote_revisado(uuid,text) to authenticated;
