-- ============================================================
-- ENDURECIMIENTO DE LAS RESOLUCIONES DE PROTOCOLO
-- Convergente sobre 20260922150000/151000. Staging. NO producción.
--
-- Antes, un mapa parcial dejaba fuera los valores no mencionados y la
-- confirmación los excluía en silencio (nullif(NULL,'excluir') -> NULL).
-- Una decisión faltante YA NO se interpreta: se rechaza.
--
-- Reglas cuando protocolos-desconocidos es un objeto:
--   · una clave por CADA valorCrudo distinto de filasSinProtocolo;
--   · ni una clave de más;
--   · cada valor es 'excluir' o el código de un protocolo ACTIVO y
--     habilitado para la disciplina del lote.
-- 'excluir_todo' (string) sigue siendo una decisión explícita válida.
-- ============================================================

create or replace function validar_mapa_protocolos(p_lote_id uuid, p_valor jsonb)
returns void
language plpgsql stable security definer set search_path = public
as $$
declare
  v_l lote_importacion%rowtype;
  v_esperadas text[]; v_recibidas text[]; v_faltan text[]; v_sobran text[];
  v_clave text; v_valor text; v_disponibles text[];
begin
  select * into v_l from lote_importacion where id = p_lote_id;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;

  if jsonb_typeof(p_valor) = 'string' then
    if (p_valor #>> '{}') = 'excluir_todo' then return; end if;
    raise exception 'TDS:RESOLUCION_INVALIDA';
  end if;
  if jsonb_typeof(p_valor) <> 'object' then raise exception 'TDS:RESOLUCION_INVALIDA'; end if;

  select coalesce(array_agg(distinct f ->> 'valorCrudo'), array[]::text[])
    into v_esperadas
    from jsonb_array_elements(coalesce(v_l.preview_json -> 'filasSinProtocolo','[]'::jsonb)) f;

  select coalesce(array_agg(key), array[]::text[]) into v_recibidas from jsonb_object_keys(p_valor) key;

  select array_agg(e) into v_faltan from unnest(v_esperadas) e where not (p_valor ? e);
  if coalesce(array_length(v_faltan,1),0) > 0 then
    raise exception 'TDS:MAPA_INCOMPLETO:%', array_to_string(v_faltan, ', ');
  end if;

  select array_agg(r) into v_sobran from unnest(v_recibidas) r where not (r = any(v_esperadas));
  if coalesce(array_length(v_sobran,1),0) > 0 then
    raise exception 'TDS:MAPA_CON_CLAVES_EXTRA:%', array_to_string(v_sobran, ', ');
  end if;

  -- Protocolos activos habilitados para la disciplina de ESTE lote.
  select coalesce(array_agg(p.codigo), array[]::text[]) into v_disponibles
    from protocolo p
    join disciplina_protocolo dp on dp.protocolo_id = p.id and dp.activo
    join disciplina d on d.id = dp.disciplina_id
   where p.activo and lower(d.nombre) = lower(v_l.contexto ->> 'disciplina');

  for v_clave, v_valor in select key, value #>> '{}' from jsonb_each(p_valor) loop
    if v_valor is null or btrim(v_valor) = '' then raise exception 'TDS:RESOLUCION_INVALIDA:%', v_clave; end if;
    if v_valor = 'excluir' then continue; end if;
    if not (v_valor = any(v_disponibles)) then
      raise exception 'TDS:PROTOCOLO_NO_DISPONIBLE:% -> %', v_clave, v_valor;
    end if;
  end loop;
end; $$;

revoke execute on function validar_mapa_protocolos(uuid, jsonb) from public, anon;
grant execute on function validar_mapa_protocolos(uuid, jsonb) to authenticated;

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
    if v_id = 'protocolos-desconocidos' then
      perform validar_mapa_protocolos(v_l.id, v_valor);
    end if;
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
    perform validar_mapa_protocolos(v_l.id, v_mapa);
    for v_fila in select value from jsonb_array_elements(coalesce(v_l.preview_json -> 'filasSinProtocolo','[]'::jsonb)) loop
      v_cod := v_fila ->> 'valorCrudo';
      v_prot := case
        when jsonb_typeof(v_mapa) = 'string' and (v_mapa #>> '{}') = 'excluir_todo' then null
        when jsonb_typeof(v_mapa) = 'object' then nullif(v_mapa ->> v_cod, 'excluir')  -- validado arriba: la clave existe
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
          'edad', case when (v_fila ->> 'edad') ~ '^[0-9]{1,3}$' then v_fila -> 'edad' else null end,
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
