-- ============================================================
-- Que ninguna planilla se pierda al cargarla — P1.
-- docs/BRIEF_BACKEND_CARGA_PLANILLAS.md, puntos 3, 4 y 5.
--
-- 3) Las filas que el lector no puede incorporar (sin fecha, sin nombre,
--    con un valor ilegible) ya no desaparecen: llegan en
--    `preview_json.filasPendientes` con un bloqueo `filas-pendientes` que
--    exige una decisión.
-- 4) Resolución nueva, `carga_manual`, válida para `protocolos-desconocidos`
--    y `filas-pendientes`: se importa lo reconocido y el resto queda en
--    `lote_fila_pendiente`. Explícita, con motivo y trazable; NUNCA
--    automática. La fecha NO puede ir a carga manual.
-- 5) `pendientes_de_carga()`: una sola bandeja con las recepciones manuales
--    abiertas y los lotes con filas por cargar.
--
-- Convergente. Staging primero. REVISIÓN MANUAL REQUERIDA antes de
-- producción: tabla nueva con datos de menores (nombres y valores).
-- NO aplicar a producción antes de que el frontend sepa resolver el
-- bloqueo `filas-pendientes`: sin eso, una planilla con esas filas no se
-- puede confirmar desde la pantalla (sí puede ir a recepción manual).
-- ============================================================

-- ---------- Quién opera la Secretaría ----------
create or replace function opera_secretaria(p_club uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from membresia m
      join club c on c.id = m.club_id
     where m.club_id = p_club
       and m.auth_user_id = auth.uid()
       and c.tipo_organizacion = 'secretaria'
       and m.rol in ('admin_secretaria','coordinador_secretaria','evaluador')
  )
$$;
revoke execute on function opera_secretaria(uuid) from public, anon;
grant execute on function opera_secretaria(uuid) to authenticated;

-- ---------- Filas que quedaron para carga manual ----------
create table if not exists lote_fila_pendiente (
  id           uuid primary key default gen_random_uuid(),
  lote_id      uuid not null references lote_importacion(id) on delete cascade,
  -- Denormalizado por trigger desde el lote (regla 6): RLS directa.
  club_id      uuid not null references club(id) on delete cascade,
  -- Posición en la decisión: una misma fila física puede aparecer en dos
  -- bloques (SUB13), así que el número de fila solo no es único.
  orden        int  not null,
  fila         int  not null,
  motivo       text not null
               check (motivo in ('sin_fecha','protocolo_desconocido','valor_ilegible','sin_nombre')),
  -- La fila tal como vino en la planilla (nombre, valores crudos, hoja).
  datos        jsonb not null,
  estado       text not null default 'pendiente'
               check (estado in ('pendiente','cargada','descartada')),
  resuelto_por uuid references membresia(id) on delete set null,
  resuelto_en  timestamptz,
  resolucion   jsonb,
  creado_en    timestamptz not null default now(),
  unique (lote_id, orden),
  check ((estado = 'pendiente') = (resuelto_en is null))
);

create index if not exists idx_fila_pendiente_club_estado on lote_fila_pendiente (club_id, estado, lote_id);

create or replace function fn_set_club_id_lote_fila_pendiente()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select club_id into new.club_id from lote_importacion where id = new.lote_id;
  if new.club_id is null then raise exception 'TDS:LOTE_DESCONOCIDO'; end if;
  return new;
end; $$;
revoke execute on function fn_set_club_id_lote_fila_pendiente() from public, anon, authenticated;

drop trigger if exists trg_lote_fila_pendiente_club on lote_fila_pendiente;
create trigger trg_lote_fila_pendiente_club
  before insert or update of lote_id, club_id on lote_fila_pendiente
  for each row execute function fn_set_club_id_lote_fila_pendiente();

-- RLS desde el primer commit. Lectura: roles operativos de la Secretaría
-- del club. Escritura: NADIE directo; solo confirmar_lote_revisado (alta)
-- y resolver_fila_pendiente (cierre), ambas con el rol verificado adentro.
alter table lote_fila_pendiente enable row level security;
drop policy if exists "fila_pendiente_lectura" on lote_fila_pendiente;
create policy "fila_pendiente_lectura" on lote_fila_pendiente
  for select using (opera_secretaria(club_id));

revoke all on lote_fila_pendiente from anon, authenticated;
grant select on lote_fila_pendiente to authenticated;
-- TRUNCATE saltea RLS: ni siquiera service_role lo necesita.
revoke truncate on lote_fila_pendiente from service_role;
grant select, insert, update, delete on lote_fila_pendiente to service_role;

-- La trazabilidad acepta la entidad nueva.
alter table correccion_auditoria drop constraint if exists correccion_auditoria_entidad_check;
alter table correccion_auditoria add constraint correccion_auditoria_entidad_check check (
  entidad in ('lote_importacion','jornada_evaluacion','institucion_origen','categoria','deportista',
              'disciplina_solicitud','resolucion_lote','planilla_recepcion','lote_fila_pendiente')
);

-- ---------- Invariantes del lote, ahora también de la carga manual ----------
-- Excluir o dejar filas para carga manual es una decisión con motivo, así
-- que un lote con `protocolos-desconocidos` o `filas-pendientes` solo se
-- importa por confirmar_lote_revisado, que marca la transacción. El camino
-- rápido (/api/evaluaciones/importar, sin motivo) no puede, y antes un
-- "mapear" elegido ahí descartaba las filas sin avisar.
create or replace function lote_importacion_invariantes()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.estado = 'importado' and old.estado is distinct from 'importado' then
    if new.original_requerido and new.ruta_storage is null and new.purgado_en is null then
      raise exception 'TDS:ORIGINAL_PENDIENTE';
    end if;
    if exists (
         select 1 from jsonb_array_elements(old.hallazgos) h
          where h ->> 'severidad' = 'bloqueo'
            and h ->> 'id' in ('protocolos-desconocidos','filas-pendientes'))
       and current_setting('tds.confirmacion_revisada', true) is distinct from new.id::text then
      raise exception 'TDS:REQUIERE_REVISION';
    end if;
  end if;
  return new;
end; $$;
revoke execute on function lote_importacion_invariantes() from public, anon, authenticated;

-- ---------- Mapa de protocolos: acepta carga manual ----------
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
    if (p_valor #>> '{}') in ('excluir_todo','carga_manual') then return; end if;
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
    if v_valor in ('excluir','carga_manual') then continue; end if;
    if not (v_valor = any(v_disponibles)) then
      raise exception 'TDS:PROTOCOLO_NO_DISPONIBLE:% -> %', v_clave, v_valor;
    end if;
  end loop;
end; $$;

-- ---------- Guardar resoluciones: valida las decisiones nuevas ----------
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
    if v_id = 'filas-pendientes'
       and (jsonb_typeof(v_valor) <> 'string' or (v_valor #>> '{}') not in ('carga_manual','excluir')) then
      raise exception 'TDS:RESOLUCION_INVALIDA';
    end if;
    -- La fecha la ingresa la persona. Sin fecha no hay jornada: no admite
    -- carga manual; o se ingresa, o la planilla va a recepción manual.
    if v_id like 'fecha%' then
      if (v_valor #>> '{}') = 'carga_manual' then raise exception 'TDS:FECHA_NO_ADMITE_CARGA_MANUAL'; end if;
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

-- ---------- Confirmar: importa lo reconocido, deja el resto en la bandeja ----------
create or replace function confirmar_lote_revisado(p_lote_id uuid, p_motivo text default 'Confirmación de planilla revisada')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_l lote_importacion%rowtype; v_mem uuid; v_club uuid; v_rol text;
  v_res jsonb; v_mapa jsonb; v_fila jsonb; v_prot text; v_cod text; v_decision text;
  v_nuevas jsonb := '[]'::jsonb; v_excluidas int := 0; v_mapeadas int := 0;
  v_manual jsonb := '[]'::jsonb; v_resultado jsonb;
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
  if v_l.original_requerido and v_l.ruta_storage is null and v_l.purgado_en is null then
    raise exception 'TDS:ORIGINAL_PENDIENTE';
  end if;

  v_res := v_l.resoluciones_borrador;

  -- Todo bloqueo tiene que estar resuelto por una persona.
  select array_agg(h ->> 'id') into v_faltan
    from jsonb_array_elements(v_l.hallazgos) h
   where h ->> 'severidad' = 'bloqueo' and not (v_res ? (h ->> 'id'));
  if coalesce(array_length(v_faltan,1),0) > 0 then raise exception 'TDS:BLOQUEOS_PENDIENTES'; end if;

  -- Protocolos desconocidos: excluir, mapear o dejar para carga manual. Nunca inferir.
  if v_res ? 'protocolos-desconocidos' then
    v_mapa := v_res -> 'protocolos-desconocidos';
    perform validar_mapa_protocolos(v_l.id, v_mapa);
    for v_fila in select value from jsonb_array_elements(coalesce(v_l.preview_json -> 'filasSinProtocolo','[]'::jsonb)) loop
      v_cod := v_fila ->> 'valorCrudo';
      -- validado arriba: o es un string global, o la clave existe en el mapa.
      v_decision := case when jsonb_typeof(v_mapa) = 'string' then v_mapa #>> '{}' else v_mapa ->> v_cod end;
      if v_decision in ('excluir_todo','excluir') then
        v_excluidas := v_excluidas + 1;
        continue;
      end if;
      if v_decision = 'carga_manual' then
        v_manual := v_manual || jsonb_build_array(jsonb_build_object(
          'fila', v_fila -> 'fila', 'motivo', 'protocolo_desconocido', 'datos', v_fila));
        continue;
      end if;
      v_prot := v_decision;
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

  -- Filas que el lector no pudo incorporar: una sola decisión para todas.
  if v_res ? 'filas-pendientes' then
    for v_fila in select value from jsonb_array_elements(coalesce(v_l.preview_json -> 'filasPendientes','[]'::jsonb)) loop
      if (v_res ->> 'filas-pendientes') = 'carga_manual' then
        v_manual := v_manual || jsonb_build_array(jsonb_build_object(
          'fila', v_fila -> 'fila', 'motivo', v_fila ->> 'motivo', 'datos', v_fila));
      else
        v_excluidas := v_excluidas + 1;
      end if;
    end loop;
  end if;

  insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
  values (v_club,'resolucion_lote',v_l.id,'confirmacion',
          jsonb_build_object('filasExcluidas',v_excluidas,'medicionesMapeadas',v_mapeadas,
                             'filasCargaManual',jsonb_array_length(v_manual))::text,
          v_res::text, p_motivo, v_mem);

  -- Habilita al trigger de invariantes: este lote se confirma por revisión.
  perform set_config('tds.confirmacion_revisada', v_l.id::text, true);
  -- La escritura real sigue siendo transaccional e idempotente.
  v_resultado := confirmar_lote_evaluacion(v_l.id, v_res);
  perform set_config('tds.confirmacion_revisada', '', true);

  insert into lote_fila_pendiente(lote_id, club_id, orden, fila, motivo, datos)
  select v_l.id, v_club, e.orden::int, coalesce((e.item ->> 'fila')::int, 0), e.item ->> 'motivo', e.item -> 'datos'
    from jsonb_array_elements(v_manual) with ordinality as e(item, orden);

  return v_resultado
         || jsonb_build_object('filasExcluidas', v_excluidas, 'medicionesMapeadas', v_mapeadas,
                               'filasCargaManual', jsonb_array_length(v_manual));
end; $$;

-- ---------- Revisión: expone las filas pendientes y los conteos ----------
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
    'archivoGuardado', v_disponible,
    'rutaStorage', case when v_disponible then v_l.ruta_storage end,
    'reprocesable', v_l.estado = 'previsualizado',
    'reprocesoPideArchivo', v_l.estado = 'previsualizado' and not v_disponible,
    'retenerHasta', v_l.retener_hasta,
    'purgadoEn', v_l.purgado_en,
    'filasSinProtocolo', coalesce(v_l.preview_json -> 'filasSinProtocolo', '[]'::jsonb),
    -- Sin fecha, sin nombre o con valores ilegibles. Mismo formato que
    -- filasSinProtocolo más `motivo`.
    'filasPendientes', coalesce(v_l.preview_json -> 'filasPendientes', '[]'::jsonb),
    'conteoFilas', jsonb_build_object(
      'pendientes', jsonb_array_length(coalesce(v_l.preview_json -> 'filasPendientes', '[]'::jsonb)),
      'resumen', coalesce((v_l.preview_json ->> 'filasResumen')::int, 0),
      'vacias', coalesce((v_l.preview_json ->> 'filasVacias')::int, 0),
      'ignoradas', v_l.filas_ignoradas),
    -- Ya importado: cuántas filas quedaron en la bandeja y cuántas se cerraron.
    'filasCargaManual', (
      select jsonb_build_object(
               'pendientes', count(*) filter (where f.estado = 'pendiente'),
               'resueltas', count(*) filter (where f.estado <> 'pendiente'))
        from lote_fila_pendiente f where f.lote_id = v_l.id),
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

-- ---------- Cerrar una fila pendiente ----------
-- { "tipo": "cargada", "jornada_id": "<uuid>" }  → se cargó a mano en esa jornada
-- { "tipo": "descartada", "motivo": "<texto>" }  → no se carga, con motivo
create or replace function resolver_fila_pendiente(p_id uuid, p_resolucion jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mem uuid; v_club uuid; v_rol text; v_f lote_fila_pendiente%rowtype;
  v_tipo text; v_jornada uuid; v_motivo text; v_restantes int;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  -- Cerrar una fila es una decisión de gestión, como resolver un lote.
  if v_rol not in ('admin_secretaria','coordinador_secretaria') then raise exception 'TDS:ROL_INSUFICIENTE'; end if;

  select * into v_f from lote_fila_pendiente where id = p_id and club_id = v_club for update;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_f.estado <> 'pendiente' then raise exception 'TDS:FILA_YA_RESUELTA'; end if;

  v_tipo := p_resolucion ->> 'tipo';
  if v_tipo = 'cargada' then
    begin
      v_jornada := coalesce(p_resolucion ->> 'jornada_id', p_resolucion ->> 'jornadaId')::uuid;
    exception when others then raise exception 'TDS:JORNADA_INVALIDA'; end;
    if v_jornada is null
       or not exists (select 1 from jornada_evaluacion where id = v_jornada and club_id = v_club) then
      raise exception 'TDS:JORNADA_INVALIDA';
    end if;
    v_motivo := coalesce(nullif(btrim(p_resolucion ->> 'motivo'), ''), 'Fila cargada a mano en una jornada');
  elsif v_tipo = 'descartada' then
    v_motivo := nullif(btrim(p_resolucion ->> 'motivo'), '');
    if v_motivo is null or length(v_motivo) < 3 then raise exception 'TDS:MOTIVO_REQUERIDO'; end if;
  else
    raise exception 'TDS:RESOLUCION_INVALIDA';
  end if;

  update lote_fila_pendiente
     set estado = v_tipo, resuelto_por = v_mem, resuelto_en = now(),
         resolucion = jsonb_strip_nulls(jsonb_build_object('tipo', v_tipo, 'jornada_id', v_jornada, 'motivo', v_motivo))
   where id = v_f.id;

  insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
  values (v_club, 'lote_fila_pendiente', v_f.id, 'estado', 'pendiente', v_tipo, left(v_motivo, 500), v_mem);

  select count(*)::int into v_restantes from lote_fila_pendiente where lote_id = v_f.lote_id and estado = 'pendiente';

  return jsonb_build_object('id', v_f.id, 'loteId', v_f.lote_id, 'estado', v_tipo,
    'jornadaId', v_jornada, 'restantesEnLote', v_restantes);
end; $$;

-- ---------- Una sola bandeja ----------
-- Recepciones manuales abiertas + lotes con filas por cargar. Mismo alcance
-- que recepciones_manuales(): el espacio de la sesión. Solo conteos y
-- metadatos del archivo; las filas se leen aparte, con RLS.
create or replace function pendientes_de_carga()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_club uuid;
begin
  select club_id into v_club from secretaria_actual();
  if v_club is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  return coalesce((
    select jsonb_agg(x.item order by x.recibida desc)
      from (
        select r.creado_en as recibida, jsonb_build_object(
                 'tipo', 'recepcion',
                 'id', r.id,
                 'loteId', r.lote_importacion_id,
                 'archivo', r.nombre_archivo,
                 'numeroSeguimiento', r.numero_seguimiento,
                 'contexto', jsonb_build_object(
                   'institucionOrigen', r.contexto ->> 'institucionOrigen',
                   'disciplina', r.contexto ->> 'disciplina',
                   'grupo', r.contexto ->> 'grupo'),
                 'estado', r.estado,
                 'etiquetaEstado', case r.estado
                   when 'RECIBIDA_PARA_REVISION' then 'Revisión manual pendiente'
                   else 'En revisión' end,
                 'filasPendientes', 0,
                 'recibidaEn', r.creado_en) as item
          from planilla_recepcion r
         where r.club_id = v_club
           and r.estado in ('RECIBIDA_PARA_REVISION','EN_REVISION')
        union all
        select l.creado_en, jsonb_build_object(
                 'tipo', 'filas',
                 'id', l.id,
                 'loteId', l.id,
                 'archivo', l.nombre_archivo,
                 'numeroSeguimiento', null,
                 'contexto', jsonb_build_object(
                   'institucionOrigen', l.contexto ->> 'institucionOrigen',
                   'disciplina', l.contexto ->> 'disciplina',
                   'grupo', l.contexto ->> 'grupo'),
                 'estado', l.estado,
                 'etiquetaEstado', case when f.n = 1 then '1 fila para carga manual'
                                        else f.n || ' filas para carga manual' end,
                 'filasPendientes', f.n,
                 'recibidaEn', l.creado_en)
          from lote_importacion l
          join (select lote_id, count(*)::int as n
                  from lote_fila_pendiente
                 where club_id = v_club and estado = 'pendiente'
                 group by lote_id) f on f.lote_id = l.id
         where l.club_id = v_club
      ) x
  ), '[]'::jsonb);
end; $$;

-- ---------- Retención: el original espera mientras haya filas abiertas ----------
-- Un lote importado con filas para carga manual conserva su original hasta
-- que se cierren (quien las carga puede necesitar mirarlo), con el tope
-- duro de 180 días igual que todo.
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
              and coalesce(l.confirmado_en, l.creado_en) < now() - interval '30 days'
              and not exists (select 1 from lote_fila_pendiente f
                               where f.lote_id = l.id and f.estado = 'pendiente')))
$$;

-- ---------- Quién ejecuta qué ----------
revoke execute on function resolver_fila_pendiente(uuid, jsonb) from public, anon;
revoke execute on function pendientes_de_carga() from public, anon;
grant execute on function resolver_fila_pendiente(uuid, jsonb) to authenticated;
grant execute on function pendientes_de_carga() to authenticated;
revoke execute on function lotes_a_purgar() from public, anon, authenticated;
grant execute on function lotes_a_purgar() to service_role;
