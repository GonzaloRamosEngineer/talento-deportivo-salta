-- ============================================================
-- Que las solicitudes de disciplina lleguen a alguien.
-- docs/BRIEF_BACKEND_SOLICITUDES_DISCIPLINA.md, puntos 1 a 3.
--
-- Hoy `disciplina_solicitud` se llena y nadie la lee. Esta migración:
--   1) distingue dos pedidos: una disciplina nueva, o un protocolo que
--      falta en una disciplina existente (`tipo`, `disciplina_objetivo_id`);
--   2) registra QUIÉN de la plataforma resolvió (`resuelto_por_usuario`:
--      la cuenta de plataforma no tiene membresía) y qué protocolos
--      quedaron habilitados;
--   3) agrega el pedido de protocolo y la aprobación transaccional.
--
-- La aprobación solo elige protocolos del catálogo existente: NUNCA crea
-- protocolos ni métricas (eso es la edición del catálogo, con el PF).
-- El catálogo sigue sin políticas de escritura para `authenticated`
-- (regla 2): la aprobación es security definer y solo la ejecuta
-- `service_role`, desde la server action de plataforma.
--
-- Convergente. Staging primero. REVISIÓN MANUAL REQUERIDA (esquema y
-- funciones security definer sobre el catálogo global).
-- ============================================================

-- ---------- 1. Esquema ----------
alter table disciplina_solicitud
  add column if not exists tipo text not null default 'disciplina',
  add column if not exists disciplina_objetivo_id uuid references disciplina(id),
  add column if not exists resuelto_por_usuario uuid references auth.users(id) on delete set null,
  add column if not exists protocolos_habilitados text[];

alter table disciplina_solicitud drop constraint if exists disciplina_solicitud_tipo_check;
alter table disciplina_solicitud add constraint disciplina_solicitud_tipo_check
  check (tipo in ('disciplina','protocolo'));

-- Un pedido de protocolo siempre apunta a una disciplina existente; uno de
-- disciplina nueva, nunca.
alter table disciplina_solicitud drop constraint if exists disciplina_solicitud_objetivo_check;
alter table disciplina_solicitud add constraint disciplina_solicitud_objetivo_check
  check ((tipo = 'protocolo') = (disciplina_objetivo_id is not null));

-- El pedido de protocolo es texto libre ("Drop Jump para Vóley, con
-- plataforma de contacto"): la Secretaría no conoce el catálogo. Admite más
-- largo que el nombre de una disciplina.
alter table disciplina_solicitud drop constraint if exists disciplina_solicitud_nombre_check;
alter table disciplina_solicitud add constraint disciplina_solicitud_nombre_check
  check (length(trim(nombre)) >= 2
         and length(trim(nombre)) <= case when tipo = 'protocolo' then 200 else 80 end);

-- Dos pedidos distintos para la misma disciplina no son duplicados.
drop index if exists uq_disciplina_solicitud_pendiente;
create unique index uq_disciplina_solicitud_pendiente
  on disciplina_solicitud (club_id, tipo, disciplina_objetivo_id, nombre_clave)
  nulls not distinct
  where estado = 'pendiente';

create index if not exists idx_disciplina_solicitud_estado
  on disciplina_solicitud (estado, creado_en desc);

comment on column disciplina_solicitud.resuelto_por_usuario is
  'Cuenta de plataforma que resolvió (no tiene membresía). resuelto_por (membresía) queda por compatibilidad.';
comment on column disciplina_solicitud.protocolos_habilitados is
  'En una aprobación: códigos de protocolo que quedaron habilitados, legibles sin reconstruir joins.';

-- RLS: se mantiene (lectura miembro del club o plataforma; sin escritura
-- directa). Privilegios declarados: `anon` nada; `authenticated` solo lee
-- (escribe por las RPC security definer); nadie con TRUNCATE.
revoke all on disciplina_solicitud from anon;
revoke insert, update, delete, truncate on disciplina_solicitud from authenticated;
grant select on disciplina_solicitud to authenticated;
revoke truncate on disciplina_solicitud from service_role;
grant select, insert, update, delete on disciplina_solicitud to service_role;

-- ---------- Pedir una disciplina (mismo contrato, ahora con tipo) ----------
create or replace function solicitar_disciplina_secretaria(p_nombre text, p_descripcion text default null, p_contexto text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mem uuid; v_club uuid; v_rol text; v_clave text; v_id uuid; v_exist uuid;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_rol not in ('admin_secretaria','coordinador_secretaria') then raise exception 'TDS:ROL_INSUFICIENTE'; end if;

  v_clave := normalizar_clave(p_nombre);
  if v_clave is null then raise exception 'TDS:NOMBRE_REQUERIDO'; end if;

  -- Si ya existe en el catálogo global, no hay nada que solicitar.
  select id into v_exist from disciplina where normalizar_clave(nombre) = v_clave;
  if v_exist is not null then
    return jsonb_build_object('estado','DISCIPLINA_YA_EXISTE','disciplinaId',v_exist);
  end if;

  select id into v_id from disciplina_solicitud
   where club_id = v_club and tipo = 'disciplina' and nombre_clave = v_clave and estado = 'pendiente';
  if v_id is not null then
    return jsonb_build_object('estado','SOLICITUD_YA_PENDIENTE','id',v_id);
  end if;

  insert into disciplina_solicitud(club_id, tipo, nombre, nombre_clave, descripcion, contexto, solicitado_por)
  values (v_club, 'disciplina', trim(p_nombre), v_clave, nullif(trim(p_descripcion),''), nullif(trim(p_contexto),''), v_mem)
  returning id into v_id;

  return jsonb_build_object('estado','SOLICITADA','id',v_id,'estadoSolicitud','pendiente');
end; $$;

-- ---------- 2. Pedir un protocolo para una disciplina existente ----------
create or replace function solicitar_protocolo_secretaria(p_disciplina_id uuid, p_texto text, p_contexto text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mem uuid; v_club uuid; v_rol text; v_clave text; v_id uuid;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_rol not in ('admin_secretaria','coordinador_secretaria') then raise exception 'TDS:ROL_INSUFICIENTE'; end if;

  if not exists (select 1 from disciplina where id = p_disciplina_id and activo) then
    raise exception 'TDS:DISCIPLINA_DESCONOCIDA';
  end if;
  v_clave := normalizar_clave(p_texto);
  if v_clave is null or length(trim(p_texto)) < 2 then raise exception 'TDS:TEXTO_REQUERIDO'; end if;
  if length(trim(p_texto)) > 200 then raise exception 'TDS:TEXTO_DEMASIADO_LARGO'; end if;

  select id into v_id from disciplina_solicitud
   where club_id = v_club and tipo = 'protocolo' and disciplina_objetivo_id = p_disciplina_id
     and nombre_clave = v_clave and estado = 'pendiente';
  if v_id is not null then
    return jsonb_build_object('estado','SOLICITUD_YA_PENDIENTE','id',v_id);
  end if;

  insert into disciplina_solicitud(club_id, tipo, disciplina_objetivo_id, nombre, nombre_clave, contexto, solicitado_por)
  values (v_club, 'protocolo', p_disciplina_id, trim(p_texto), v_clave, nullif(trim(p_contexto),''), v_mem)
  returning id into v_id;

  return jsonb_build_object('estado','SOLICITADA','id',v_id,'estadoSolicitud','pendiente');
end; $$;

-- ---------- 3. Aprobar (plataforma, una sola transacción) ----------
-- tipo 'disciplina': crea la disciplina y le habilita los protocolos.
-- tipo 'protocolo': suma los protocolos a la disciplina objetivo, sin
-- duplicar (si estaba inactivo, se reactiva).
-- Los protocolos tienen que existir y estar activos: acá no se crea nada
-- del catálogo de protocolos ni de métricas.
create or replace function aprobar_solicitud_disciplina(
  p_id uuid,
  p_usuario uuid,
  p_protocolos text[],
  p_nombre text default null,
  p_resolucion text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_s disciplina_solicitud%rowtype; v_disc uuid; v_nombre text; v_faltan text[];
  v_protocolos text[]; v_orden int; v_nuevos int := 0; v_n int; v_cod text;
begin
  -- Defensa en profundidad: la action ya verificó el gate, pero esta
  -- función escribe el catálogo global.
  if not exists (select 1 from auth.users
                  where id = p_usuario
                    and coalesce(raw_app_meta_data ->> 'plataforma', 'false') = 'true'
                    and coalesce(raw_app_meta_data ->> 'demo', 'false') <> 'true') then
    raise exception 'TDS:USUARIO_NO_PLATAFORMA';
  end if;

  select * into v_s from disciplina_solicitud where id = p_id for update;
  if not found then raise exception 'TDS:SOLICITUD_DESCONOCIDA'; end if;
  if v_s.estado <> 'pendiente' then raise exception 'TDS:SOLICITUD_YA_RESUELTA'; end if;

  select array_agg(distinct upper(btrim(c))) into v_protocolos
    from unnest(coalesce(p_protocolos, array[]::text[])) c where btrim(c) <> '';
  if coalesce(cardinality(v_protocolos), 0) = 0 then raise exception 'TDS:PROTOCOLOS_REQUERIDOS'; end if;

  select array_agg(c order by c) into v_faltan
    from unnest(v_protocolos) c
   where not exists (select 1 from protocolo p where p.codigo = c and p.activo);
  if coalesce(cardinality(v_faltan), 0) > 0 then
    raise exception 'TDS:PROTOCOLO_DESCONOCIDO:%', array_to_string(v_faltan, ', ');
  end if;

  if v_s.tipo = 'disciplina' then
    v_nombre := coalesce(nullif(btrim(p_nombre), ''), v_s.nombre);
    if length(v_nombre) < 2 or length(v_nombre) > 80 then raise exception 'TDS:NOMBRE_INVALIDO'; end if;
    -- Si ya existe (con otro nombre en el pedido), la salida es "vincular".
    if exists (select 1 from disciplina where normalizar_clave(nombre) = normalizar_clave(v_nombre)) then
      raise exception 'TDS:DISCIPLINA_YA_EXISTE';
    end if;
    insert into disciplina(nombre, descripcion) values (v_nombre, v_s.descripcion)
    returning id into v_disc;
  else
    v_disc := v_s.disciplina_objetivo_id;
    if not exists (select 1 from disciplina where id = v_disc) then raise exception 'TDS:DISCIPLINA_DESCONOCIDA'; end if;
  end if;

  select coalesce(max(orden), 0) into v_orden from disciplina_protocolo where disciplina_id = v_disc;
  foreach v_cod in array v_protocolos loop
    v_orden := v_orden + 1;
    insert into disciplina_protocolo(disciplina_id, protocolo_id, orden, activo)
    select v_disc, p.id, v_orden, true from protocolo p where p.codigo = v_cod
    on conflict (disciplina_id, protocolo_id) do update
      set activo = true
      where disciplina_protocolo.activo is distinct from true;
    get diagnostics v_n = row_count;
    v_nuevos := v_nuevos + v_n;
  end loop;

  update disciplina_solicitud
     set estado = 'aprobada',
         disciplina_id = v_disc,
         protocolos_habilitados = v_protocolos,
         resolucion = nullif(btrim(p_resolucion), ''),
         resuelto_por_usuario = p_usuario,
         resuelto_en = now()
   where id = v_s.id;

  return jsonb_build_object(
    'id', v_s.id, 'tipo', v_s.tipo, 'estado', 'aprobada', 'disciplinaId', v_disc,
    'protocolosHabilitados', to_jsonb(v_protocolos),
    -- Cuántos se sumaron de verdad: los que ya estaban activos no cuentan.
    'protocolosNuevos', v_nuevos);
end; $$;

-- ---------- Quién ejecuta qué ----------
revoke execute on function solicitar_protocolo_secretaria(uuid, text, text) from public, anon;
grant execute on function solicitar_protocolo_secretaria(uuid, text, text) to authenticated;
revoke execute on function solicitar_disciplina_secretaria(text, text, text) from public, anon;
grant execute on function solicitar_disciplina_secretaria(text, text, text) to authenticated;
-- Escribe el catálogo global: solo la server action de plataforma.
revoke execute on function aprobar_solicitud_disciplina(uuid, uuid, text[], text, text) from public, anon, authenticated;
grant execute on function aprobar_solicitud_disciplina(uuid, uuid, text[], text, text) to service_role;
