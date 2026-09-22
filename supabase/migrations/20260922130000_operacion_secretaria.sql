-- ============================================================
-- OPERACIÓN DIARIA DEL ESPACIO SECRETARÍA
-- Brief: docs/BRIEF_BACKEND_OPERACION_SECRETARIA.md
-- Convergente: no modifica migraciones ya registradas.
-- Staging yncidsgcypyyvurtyesx. NO aplicar a producción.
-- ============================================================

-- ---------- 1 · Auditoría de correcciones ----------
-- Nunca se borra el valor anterior: cada fila es un hecho histórico.
create table if not exists correccion_auditoria (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references club(id) on delete cascade,
  entidad       text not null check (entidad in ('lote_importacion','jornada_evaluacion')),
  entidad_id    uuid not null,
  campo         text not null,
  valor_anterior text,
  valor_nuevo   text,
  motivo        text not null check (length(trim(motivo)) between 3 and 500),
  membresia_id  uuid not null references membresia(id) on delete restrict,
  creado_en     timestamptz not null default now()
);
create index if not exists idx_correccion_entidad on correccion_auditoria (entidad, entidad_id, creado_en desc);
create index if not exists idx_correccion_club on correccion_auditoria (club_id, creado_en desc);

alter table correccion_auditoria enable row level security;

drop policy if exists "correccion_lectura" on correccion_auditoria;
create policy "correccion_lectura" on correccion_auditoria
  for select using (es_miembro_de(club_id));
-- Se escribe SOLO desde las RPC (security definer); nadie inserta a mano.
drop policy if exists "correccion_sin_escritura_directa" on correccion_auditoria;
create policy "correccion_sin_escritura_directa" on correccion_auditoria
  for insert with check (false);

-- Resuelve la membresía del usuario en una organización, o falla.
create or replace function membresia_actual(p_club_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from membresia
   where club_id = p_club_id and auth_user_id = auth.uid()
   limit 1
$$;

-- ---------- 1a · Corregir el contexto de un lote previsualizado ----------
create or replace function corregir_contexto_lote(
  p_lote_id uuid,
  p_cambios jsonb,
  p_motivo  text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_lote   lote_importacion%rowtype;
  v_mem    uuid;
  v_campo  text;
  v_antes  text;
  v_nuevo  text;
  v_ctx    jsonb;
  v_n      int := 0;
  CAMPOS constant text[] := array['institucionOrigen','disciplina','grupo','fechaDeclarada','evaluadoPor'];
begin
  select * into v_lote from lote_importacion where id = p_lote_id for update;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;

  v_mem := membresia_actual(v_lote.club_id);
  if v_mem is null or not es_admin_de(v_lote.club_id) then
    raise exception 'TDS:SIN_ALCANCE';
  end if;
  -- Un lote ya importado no se corrige por esta vía: se corrige la jornada.
  if v_lote.estado <> 'previsualizado' then raise exception 'TDS:LOTE_NO_EDITABLE'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'TDS:MOTIVO_REQUERIDO'; end if;

  v_ctx := v_lote.contexto;
  foreach v_campo in array CAMPOS loop
    if p_cambios ? v_campo then
      v_antes := v_ctx ->> v_campo;
      v_nuevo := p_cambios ->> v_campo;
      if v_nuevo is distinct from v_antes then
        v_ctx := jsonb_set(v_ctx, array[v_campo], to_jsonb(v_nuevo));
        insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
        values (v_lote.club_id, 'lote_importacion', v_lote.id, v_campo, v_antes, v_nuevo, p_motivo, v_mem);
        v_n := v_n + 1;
      end if;
    end if;
  end loop;

  if v_n > 0 then
    update lote_importacion set contexto = v_ctx where id = v_lote.id;
    insert into lote_importacion_evento(lote_id, membresia_id, tipo, detalle)
    values (v_lote.id, v_mem, 'corregido', jsonb_build_object('motivo', p_motivo, 'campos', v_n));
  end if;

  return jsonb_build_object('loteId', v_lote.id, 'camposCorregidos', v_n, 'contexto', v_ctx);
end; $$;

revoke execute on function corregir_contexto_lote(uuid, jsonb, text) from public, anon;
grant execute on function corregir_contexto_lote(uuid, jsonb, text) to authenticated;

-- ---------- 1b · Corregir una jornada ya confirmada ----------
-- Nunca un update aislado: si cambia la fecha, se mueven jornada Y mediciones
-- en la misma transacción, validando antes los índices únicos.
create or replace function corregir_jornada_evaluacion(
  p_jornada_id uuid,
  p_cambios    jsonb,
  p_motivo     text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_j        jornada_evaluacion%rowtype;
  v_mem      uuid;
  v_inst     uuid;
  v_inst_ant text;
  v_fecha    date;
  v_resp     text;
  v_mov      int := 0;
  v_n        int := 0;
begin
  select * into v_j from jornada_evaluacion where id = p_jornada_id for update;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;

  v_mem := membresia_actual(v_j.club_id);
  if v_mem is null or not es_admin_de(v_j.club_id) then raise exception 'TDS:SIN_ALCANCE'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'TDS:MOTIVO_REQUERIDO'; end if;

  -- Institución de origen
  if p_cambios ? 'institucionOrigen' then
    select nombre into v_inst_ant from institucion_origen where id = v_j.institucion_origen_id;
    if (p_cambios ->> 'institucionOrigen') is distinct from v_inst_ant then
      select id into v_inst from institucion_origen
       where club_id = v_j.club_id and lower(nombre) = lower(p_cambios ->> 'institucionOrigen');
      if v_inst is null then
        insert into institucion_origen(club_id, nombre)
        values (v_j.club_id, p_cambios ->> 'institucionOrigen') returning id into v_inst;
      end if;
      insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
      values (v_j.club_id,'jornada_evaluacion',v_j.id,'institucionOrigen',v_inst_ant,p_cambios ->> 'institucionOrigen',p_motivo,v_mem);
      v_n := v_n + 1;
    end if;
  end if;

  -- Responsable
  if p_cambios ? 'evaluadoPor' then
    v_resp := p_cambios ->> 'evaluadoPor';
    if v_resp is distinct from v_j.evaluado_por then
      insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
      values (v_j.club_id,'jornada_evaluacion',v_j.id,'evaluadoPor',v_j.evaluado_por,v_resp,p_motivo,v_mem);
      v_n := v_n + 1;
    end if;
  end if;

  -- Fecha
  if p_cambios ? 'fecha' then
    v_fecha := (p_cambios ->> 'fecha')::date;
    if v_fecha is distinct from v_j.fecha then
      insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
      values (v_j.club_id,'jornada_evaluacion',v_j.id,'fecha',v_j.fecha::text,v_fecha::text,p_motivo,v_mem);
      v_n := v_n + 1;
    end if;
  end if;

  -- Conflicto con el único de jornada ANTES de tocar nada
  if exists (
    select 1 from jornada_evaluacion o
     where o.id <> v_j.id
       and o.club_id = v_j.club_id
       and o.institucion_origen_id = coalesce(v_inst, v_j.institucion_origen_id)
       and o.disciplina_id = v_j.disciplina_id
       and o.categoria_id  = v_j.categoria_id
       and o.fecha = coalesce(v_fecha, v_j.fecha)
       and o.evaluado_por = coalesce(v_resp, v_j.evaluado_por)
  ) then raise exception 'TDS:CONFLICTO_JORNADA'; end if;

  update jornada_evaluacion
     set institucion_origen_id = coalesce(v_inst, institucion_origen_id),
         evaluado_por          = coalesce(v_resp, evaluado_por),
         fecha                 = coalesce(v_fecha, fecha)
   where id = v_j.id;

  -- Las mediciones viajan con la jornada, siempre en la misma transacción.
  if v_fecha is not null and v_fecha is distinct from v_j.fecha then
    update medicion set fecha = v_fecha where jornada_id = v_j.id;
    get diagnostics v_mov = row_count;
  end if;

  return jsonb_build_object(
    'jornadaId', v_j.id,
    'camposCorregidos', v_n,
    'medicionesMovidas', v_mov
  );
exception
  when unique_violation then raise exception 'TDS:CONFLICTO_JORNADA';
end; $$;

revoke execute on function corregir_jornada_evaluacion(uuid, jsonb, text) from public, anon;
grant execute on function corregir_jornada_evaluacion(uuid, jsonb, text) to authenticated;

-- ---------- 2 · Exploración: detalle de un lote ----------
-- Para lotes importados, preview_json está vacío: el detalle se reconstruye
-- desde jornadas y mediciones, que son la fuente después de confirmar.
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
    'filasIgnoradas', v_lote.filas_ignoradas,
    'duplicados', v_lote.duplicados_archivo,
    'bloqueosPendientes', v_lote.bloqueos_pendientes,
    'hallazgos', v_lote.hallazgos,
    'resoluciones', v_lote.resoluciones,
    'resultado', v_lote.resultado,
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

revoke execute on function detalle_lote_importacion(uuid) from public, anon;
grant execute on function detalle_lote_importacion(uuid) to authenticated;

-- ---------- 2b · Agregado por disciplina ----------
-- Agrega en el servidor: el browser nunca baja todas las mediciones.
create or replace function resumen_por_disciplina()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from membresia where auth_user_id = auth.uid() limit 1;
  if v_club is null then raise exception 'TDS:SIN_ALCANCE'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'disciplinaId', d.id,
      'disciplina',   d.nombre,
      'instituciones', coalesce((
        select jsonb_agg(distinct io.nombre) from jornada_evaluacion j
          join institucion_origen io on io.id = j.institucion_origen_id
         where j.club_id = v_club and j.disciplina_id = d.id), '[]'::jsonb),
      'grupos', (select count(*)::int from categoria c where c.club_id = v_club and c.disciplina_id = d.id),
      'deportistas', (select count(distinct dep.id)::int from deportista dep
                        join categoria c on c.id = dep.categoria_id
                       where c.club_id = v_club and c.disciplina_id = d.id),
      'jornadas', (select count(*)::int from jornada_evaluacion j
                    where j.club_id = v_club and j.disciplina_id = d.id),
      'ultimaFecha', (select max(j.fecha) from jornada_evaluacion j
                       where j.club_id = v_club and j.disciplina_id = d.id),
      'protocolosUsados', coalesce((
        select jsonb_agg(distinct p.codigo) from medicion m
          join jornada_evaluacion j on j.id = m.jornada_id
          join protocolo p on p.id = m.protocolo_id
         where j.club_id = v_club and j.disciplina_id = d.id), '[]'::jsonb),
      'metricasUsadas', coalesce((
        select jsonb_agg(jsonb_build_object('codigo', a.codigo, 'nombre', a.nombre,
                                            'unidad', a.unidad, 'cantidad', t.n))
          from (select m.atributo_id, count(*)::int n from medicion m
                  join jornada_evaluacion j on j.id = m.jornada_id
                 where j.club_id = v_club and j.disciplina_id = d.id
                 group by 1) t
          join atributo a on a.id = t.atributo_id), '[]'::jsonb),
      'protocolosSinDatos', coalesce((
        select jsonb_agg(p.codigo) from disciplina_protocolo dp
          join protocolo p on p.id = dp.protocolo_id
         where dp.disciplina_id = d.id and dp.activo
           and not exists (select 1 from medicion m
                             join jornada_evaluacion j on j.id = m.jornada_id
                            where j.club_id = v_club and j.disciplina_id = d.id
                              and m.protocolo_id = p.id)), '[]'::jsonb),
      'metricasSinDatos', coalesce((
        select jsonb_agg(distinct a.codigo)
          from disciplina_protocolo dp
          join protocolo_atributo pa on pa.protocolo_id = dp.protocolo_id
          join atributo a on a.id = pa.atributo_id
         where dp.disciplina_id = d.id and dp.activo
           and not exists (select 1 from medicion m
                             join jornada_evaluacion j on j.id = m.jornada_id
                            where j.club_id = v_club and j.disciplina_id = d.id
                              and m.atributo_id = a.id)), '[]'::jsonb)
    ) order by d.nombre)
    from disciplina d where d.activo
  ), '[]'::jsonb);
end; $$;

revoke execute on function resumen_por_disciplina() from public, anon;
grant execute on function resumen_por_disciplina() to authenticated;

-- ---------- 3 · Registro manual de una jornada ----------
-- Idempotencia por clave del cliente: reintentar desde el celular con mala
-- señal devuelve el mismo resultado, nunca duplica.
create table if not exists jornada_manual_idempotencia (
  idempotency_key uuid primary key,
  club_id         uuid not null references club(id) on delete cascade,
  membresia_id    uuid not null references membresia(id) on delete restrict,
  resultado       jsonb not null,
  creado_en       timestamptz not null default now()
);
alter table jornada_manual_idempotencia enable row level security;
drop policy if exists "idempotencia_lectura" on jornada_manual_idempotencia;
create policy "idempotencia_lectura" on jornada_manual_idempotencia
  for select using (es_miembro_de(club_id));

create or replace function guardar_jornada_evaluacion_manual(
  p_contexto        jsonb,
  p_mediciones      jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_club      uuid;
  v_mem       uuid;
  v_rol       text;
  v_disc      uuid;
  v_inst      uuid;
  v_cat       uuid;
  v_prot      uuid;
  v_jornada   uuid;
  v_fecha     date;
  v_med       jsonb;
  v_dep       uuid;
  v_atr       uuid;
  v_valor     numeric;
  v_min       numeric;
  v_max       numeric;
  v_unidad    text;
  v_guardadas int := 0;
  v_deps      uuid[] := array[]::uuid[];
  v_previo    jsonb;
  v_res       jsonb;
begin
  if p_idempotency_key is null then raise exception 'TDS:IDEMPOTENCIA_REQUERIDA'; end if;

  -- 1 · La membresía sale de auth.uid(), NUNCA de un club_id del browser.
  select m.id, m.club_id, m.rol into v_mem, v_club, v_rol
    from membresia m where m.auth_user_id = auth.uid() limit 1;
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;

  select resultado into v_previo from jornada_manual_idempotencia
   where idempotency_key = p_idempotency_key and club_id = v_club;
  if v_previo is not null then return v_previo; end if;

  v_fecha := nullif(p_contexto ->> 'fecha','')::date;
  if v_fecha is null then raise exception 'TDS:FECHA_REQUERIDA'; end if;
  if coalesce(trim(p_contexto ->> 'evaluadoPor'),'') = '' then raise exception 'TDS:EVALUADOR_REQUERIDO'; end if;

  select id into v_disc from disciplina
   where lower(nombre) = lower(p_contexto ->> 'disciplina') and activo;
  if v_disc is null then raise exception 'TDS:DISCIPLINA_DESCONOCIDA'; end if;

  select id into v_inst from institucion_origen
   where club_id = v_club and lower(nombre) = lower(p_contexto ->> 'institucionOrigen');
  if v_inst is null then
    insert into institucion_origen(club_id, nombre)
    values (v_club, p_contexto ->> 'institucionOrigen') returning id into v_inst;
  end if;

  select id into v_cat from categoria
   where club_id = v_club and disciplina_id = v_disc
     and institucion_origen_id = v_inst
     and lower(nombre) = lower(p_contexto ->> 'grupo');
  if v_cat is null then raise exception 'TDS:GRUPO_DESCONOCIDO'; end if;

  -- 2 · Alcance sobre la categoría
  if not opera_categoria(v_club, v_cat) then raise exception 'TDS:SIN_ALCANCE'; end if;

  -- 3 · El protocolo debe pertenecer a la disciplina
  select p.id into v_prot from protocolo p
    join disciplina_protocolo dp on dp.protocolo_id = p.id and dp.disciplina_id = v_disc and dp.activo
   where p.codigo = p_contexto ->> 'protocolo' and p.activo;
  if v_prot is null and nullif(p_contexto ->> 'protocolo','') is not null then
    raise exception 'TDS:PROTOCOLO_NO_APLICA';
  end if;

  -- 5 · Jornada idempotente por su identidad natural
  select id into v_jornada from jornada_evaluacion
   where club_id = v_club and institucion_origen_id = v_inst and disciplina_id = v_disc
     and categoria_id = v_cat and fecha = v_fecha
     and evaluado_por = p_contexto ->> 'evaluadoPor';
  if v_jornada is null then
    insert into jornada_evaluacion(club_id, institucion_origen_id, disciplina_id, categoria_id,
                                   fecha, evaluado_por, importado_por)
    values (v_club, v_inst, v_disc, v_cat, v_fecha, p_contexto ->> 'evaluadoPor', v_mem)
    returning id into v_jornada;
  end if;

  -- 6 · Participantes y mediciones, todo en la misma transacción
  for v_med in select value from jsonb_array_elements(p_mediciones) loop
    v_dep := (v_med ->> 'deportistaId')::uuid;
    -- 4 · El deportista tiene que pertenecer al grupo
    if not exists (select 1 from deportista d
                    where d.id = v_dep and d.club_id = v_club and d.categoria_id = v_cat) then
      raise exception 'TDS:DEPORTISTA_FUERA_DE_GRUPO';
    end if;

    select id, unidad into v_atr, v_unidad from atributo
     where codigo = v_med ->> 'atributoCodigo' and activo;
    if v_atr is null then raise exception 'TDS:METRICA_DESCONOCIDA'; end if;

    -- 3 · El atributo tiene que pertenecer al protocolo
    if v_prot is not null and not exists (
      select 1 from protocolo_atributo pa where pa.protocolo_id = v_prot and pa.atributo_id = v_atr
    ) then raise exception 'TDS:METRICA_NO_APLICA'; end if;

    -- 4 · Rango declarado en el catálogo
    v_valor := (v_med ->> 'valor')::numeric;
    select escala_min, escala_max into v_min, v_max from atributo where id = v_atr;
    if v_min is not null and v_valor < v_min then raise exception 'TDS:VALOR_FUERA_DE_RANGO'; end if;
    if v_max is not null and v_valor > v_max then raise exception 'TDS:VALOR_FUERA_DE_RANGO'; end if;

    if not (v_dep = any(v_deps)) then
      v_deps := array_append(v_deps, v_dep);
      insert into jornada_deportista(jornada_id, deportista_id)
      values (v_jornada, v_dep) on conflict (jornada_id, deportista_id) do nothing;
    end if;

    -- 7 · Los intentos se conservan separados: nunca se promedian ni se
    -- reduce al mejor. El único los distingue por (…, intento).
    insert into medicion(club_id, deportista_id, atributo_id, valor, fecha, registrado_por,
                         jornada_id, protocolo_id, intento, detalle, nota)
    values (v_club, v_dep, v_atr, v_valor, v_fecha, v_mem, v_jornada, v_prot,
            coalesce((v_med ->> 'intento')::int, 1),
            jsonb_build_object('origen','manual'),
            nullif(v_med ->> 'nota',''));
    v_guardadas := v_guardadas + 1;
  end loop;

  -- 8 · Respuesta
  v_res := jsonb_build_object(
    'jornadaId', v_jornada,
    'deportistas', cardinality(v_deps),
    'medicionesGuardadas', v_guardadas
  );
  insert into jornada_manual_idempotencia(idempotency_key, club_id, membresia_id, resultado)
  values (p_idempotency_key, v_club, v_mem, v_res);
  return v_res;
exception
  when unique_violation then raise exception 'TDS:CONFLICTO_MEDICION';
end; $$;

revoke execute on function guardar_jornada_evaluacion_manual(jsonb, jsonb, uuid) from public, anon;
grant execute on function guardar_jornada_evaluacion_manual(jsonb, jsonb, uuid) to authenticated;

-- ---------- 4 · Doble contexto: Observatorio para Secretaría ----------
-- Habilita el AGREGADO, no el acceso individual: observatorio_clubes() es
-- security definer y no expone ninguna fila de deportista ni de medicion.
-- Las policies de deportista/medicion siguen intactas, así que la Secretaría
-- continúa con cero SELECT sobre fichas de clubes ajenos.
create or replace function puede_ver_observatorio()
returns boolean
language sql stable security definer set search_path = public
as $$
  select es_plataforma() or exists (
    select 1 from membresia m
      join club c on c.id = m.club_id
     where m.auth_user_id = auth.uid()
       and c.tipo_organizacion in ('secretaria','liga','federacion')
       and m.rol in ('admin_secretaria','coordinador_secretaria','analista_secretaria')
  )
$$;

create or replace function observatorio_clubes()
returns table (
  id uuid, nombre text, localidad text, departamento text, escudo_url text,
  deportistas int, mediciones_30d int, consentimiento_pct int,
  categorias_activas int, ultima_medicion date, pases_12m int
)
language sql stable security definer set search_path = public
as $$
  select
    c.id, c.nombre, c.localidad, c.departamento, c.escudo_url,
    (select count(*)::int from deportista d where d.club_id = c.id and d.activo),
    (select count(*)::int from medicion m where m.club_id = c.id and m.fecha >= current_date - 30),
    coalesce((
      select round(100.0 * count(*) filter (where exists (
               select 1 from consentimiento k
                where k.deportista_id = d.id and k.otorgado and k.revocado_en is null))
             / nullif(count(*), 0))::int
        from deportista d where d.club_id = c.id and d.activo), 0),
    (select count(distinct d.categoria_id)::int from deportista d
      where d.club_id = c.id and d.activo and d.categoria_id is not null),
    (select max(m.fecha) from medicion m where m.club_id = c.id),
    (select count(*)::int from deportista_hito h
      where h.club_id = c.id and h.tipo = 'pase_salida' and h.fecha >= current_date - 365)
  from club c
  where puede_ver_observatorio()
    and c.tipo_organizacion = 'club'
  order by c.nombre
$$;

revoke execute on function observatorio_clubes() from public, anon;
grant execute on function observatorio_clubes() to authenticated;
revoke execute on function puede_ver_observatorio() from public, anon;
grant execute on function puede_ver_observatorio() to authenticated;
