-- ============================================================
-- Corrección convergente de 20260922150000.
--
-- Al materializar una fila sin protocolo, su columna de "edad" no siempre
-- es una edad: en el bloque de sprint de Atletismo trae un parcial decimal
-- (ej. 2.384) y el cast a int de jornada_deportista aborta la confirmación
-- entera. Solo se acepta un entero de 1 a 3 dígitos; si no, queda nula.
-- No modifica la migración anterior: la reemplaza por create or replace.
-- ============================================================

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
