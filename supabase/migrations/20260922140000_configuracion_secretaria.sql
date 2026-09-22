-- ============================================================
-- CONFIGURACIÓN OPERATIVA DEL ESPACIO SECRETARÍA
-- Brief: docs/BRIEF_BACKEND_CONFIGURACION_SECRETARIA.md
-- Convergente. Staging yncidsgcypyyvurtyesx. NO aplicar a producción.
--
-- Principio: el club_id SIEMPRE se deriva de auth.uid(). Ningún id que
-- llegue del browser amplía alcance.
-- ============================================================

-- ---------- Esquema mínimo que falta ----------
alter table institucion_origen add column if not exists tipo text
  check (tipo is null or tipo in ('club','liga','asociacion','escuela','grupo','otro'));
alter table institucion_origen add column if not exists notas text;
alter table institucion_origen add column if not exists creado_por uuid references membresia(id) on delete set null;

-- La categoría necesita baja lógica: nunca se borra un grupo con historia.
alter table categoria add column if not exists activo boolean not null default true;
alter table categoria add column if not exists creado_por uuid references membresia(id) on delete set null;
alter table deportista add column if not exists creado_por uuid references membresia(id) on delete set null;

-- Auditoría: se amplían las entidades cubiertas sin tocar las filas ya escritas.
alter table correccion_auditoria drop constraint if exists correccion_auditoria_entidad_check;
alter table correccion_auditoria add constraint correccion_auditoria_entidad_check
  check (entidad in ('lote_importacion','jornada_evaluacion','institucion_origen','categoria','deportista','disciplina_solicitud'));

-- Normalización para detectar duplicados: sin tildes, sin dobles espacios,
-- en minúsculas. Es la misma regla para instituciones, grupos y personas.
create or replace function normalizar_clave(p_texto text)
returns text
language sql immutable
as $$
  select nullif(btrim(regexp_replace(
           lower(translate(coalesce(p_texto,''),
             'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
             'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC')),
           '\s+', ' ', 'g')), '')
$$;

-- Membresía + rol del usuario en su espacio. Una sola fuente para todas
-- las RPC de configuración.
create or replace function secretaria_actual()
returns table (membresia_id uuid, club_id uuid, rol text)
language sql stable security definer set search_path = public
as $$
  select m.id, m.club_id, m.rol
    from membresia m
    join club c on c.id = m.club_id
   where m.auth_user_id = auth.uid()
     and c.tipo_organizacion = 'secretaria'
   limit 1
$$;

revoke execute on function secretaria_actual() from public, anon;
grant execute on function secretaria_actual() to authenticated;

-- ---------- Solicitudes de disciplina ----------
-- Una disciplina nueva NO se crea desde la Secretaría: se solicita. Así el
-- catálogo no junta "Volley", "Vóley" y "Voley" con unidades incompatibles.
create table if not exists disciplina_solicitud (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references club(id) on delete cascade,
  nombre        text not null check (length(trim(nombre)) between 2 and 80),
  nombre_clave  text not null,
  descripcion   text,
  contexto      text,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','aprobada','rechazada')),
  disciplina_id uuid references disciplina(id) on delete set null,
  resolucion    text,
  solicitado_por uuid not null references membresia(id) on delete restrict,
  resuelto_por   uuid references membresia(id) on delete set null,
  creado_en     timestamptz not null default now(),
  resuelto_en   timestamptz
);
create unique index if not exists uq_disciplina_solicitud_pendiente
  on disciplina_solicitud (club_id, nombre_clave) where estado = 'pendiente';

alter table disciplina_solicitud enable row level security;
drop policy if exists "solicitud_lectura" on disciplina_solicitud;
create policy "solicitud_lectura" on disciplina_solicitud
  for select using (es_miembro_de(club_id) or es_plataforma());
drop policy if exists "solicitud_sin_escritura_directa" on disciplina_solicitud;
create policy "solicitud_sin_escritura_directa" on disciplina_solicitud
  for insert with check (false);

-- ---------- 1 · Instituciones ----------
create or replace function crear_institucion_secretaria(
  p_nombre    text,
  p_tipo      text default null,
  p_localidad text default null,
  p_notas     text default null,
  p_forzar    boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mem uuid; v_club uuid; v_rol text;
  v_clave text; v_dup record; v_id uuid;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_rol <> 'admin_secretaria' then raise exception 'TDS:ROL_INSUFICIENTE'; end if;

  v_clave := normalizar_clave(p_nombre);
  if v_clave is null then raise exception 'TDS:NOMBRE_REQUERIDO'; end if;
  if p_tipo is not null and p_tipo not in ('club','liga','asociacion','escuela','grupo','otro') then
    raise exception 'TDS:TIPO_INVALIDO';
  end if;

  -- Duplicado por nombre normalizado: no se crea otra variante en silencio.
  select id, nombre, activo into v_dup from institucion_origen
   where club_id = v_club and normalizar_clave(nombre) = v_clave limit 1;
  if v_dup.id is not null and not p_forzar then
    return jsonb_build_object(
      'estado','INSTITUCION_POSIBLE_DUPLICADO',
      'existente', jsonb_build_object('id',v_dup.id,'nombre',v_dup.nombre,'activo',v_dup.activo));
  end if;
  if v_dup.id is not null and p_forzar then raise exception 'TDS:INSTITUCION_DUPLICADA'; end if;

  insert into institucion_origen(club_id, nombre, tipo, localidad, notas, creado_por)
  values (v_club, trim(p_nombre), p_tipo, nullif(trim(p_localidad),''), nullif(trim(p_notas),''), v_mem)
  returning id into v_id;

  insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
  values (v_club,'institucion_origen',v_id,'alta',null,trim(p_nombre),'Alta de institución',v_mem);

  return jsonb_build_object('estado','CREADA','id',v_id,'nombre',trim(p_nombre));
end; $$;

create or replace function actualizar_institucion_secretaria(
  p_id      uuid,
  p_cambios jsonb,
  p_motivo  text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mem uuid; v_club uuid; v_rol text;
  v_i institucion_origen%rowtype; v_n int := 0;

begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_rol <> 'admin_secretaria' then raise exception 'TDS:ROL_INSUFICIENTE'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'TDS:MOTIVO_REQUERIDO'; end if;

  select * into v_i from institucion_origen where id = p_id and club_id = v_club for update;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;

  if p_cambios ? 'nombre'
     and normalizar_clave(p_cambios ->> 'nombre') is distinct from normalizar_clave(v_i.nombre) then
    if exists (select 1 from institucion_origen o
                where o.club_id = v_club and o.id <> v_i.id
                  and normalizar_clave(o.nombre) = normalizar_clave(p_cambios ->> 'nombre')) then
      raise exception 'TDS:INSTITUCION_DUPLICADA';
    end if;
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'institucion_origen',v_i.id,'nombre',v_i.nombre,trim(p_cambios ->> 'nombre'),p_motivo,v_mem);
    update institucion_origen set nombre = trim(p_cambios ->> 'nombre') where id = v_i.id;
    v_n := v_n + 1;
  end if;

  if p_cambios ? 'tipo' and (p_cambios ->> 'tipo') is distinct from v_i.tipo then
    if (p_cambios ->> 'tipo') is not null
       and (p_cambios ->> 'tipo') not in ('club','liga','asociacion','escuela','grupo','otro') then
      raise exception 'TDS:TIPO_INVALIDO';
    end if;
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'institucion_origen',v_i.id,'tipo',v_i.tipo,p_cambios ->> 'tipo',p_motivo,v_mem);
    update institucion_origen set tipo = p_cambios ->> 'tipo' where id = v_i.id;
    v_n := v_n + 1;
  end if;

  if p_cambios ? 'localidad' and (p_cambios ->> 'localidad') is distinct from v_i.localidad then
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'institucion_origen',v_i.id,'localidad',v_i.localidad,p_cambios ->> 'localidad',p_motivo,v_mem);
    update institucion_origen set localidad = nullif(trim(p_cambios ->> 'localidad'),'') where id = v_i.id;
    v_n := v_n + 1;
  end if;

  if p_cambios ? 'notas' and (p_cambios ->> 'notas') is distinct from v_i.notas then
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'institucion_origen',v_i.id,'notas',v_i.notas,p_cambios ->> 'notas',p_motivo,v_mem);
    update institucion_origen set notas = nullif(trim(p_cambios ->> 'notas'),'') where id = v_i.id;
    v_n := v_n + 1;
  end if;

  -- Baja LÓGICA. La institución con jornadas conserva su historia y sigue
  -- siendo consultable; simplemente deja de ofrecerse para medir.
  if p_cambios ? 'activo' and (p_cambios ->> 'activo')::boolean is distinct from v_i.activo then
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'institucion_origen',v_i.id,'activo',v_i.activo::text,p_cambios ->> 'activo',p_motivo,v_mem);
    update institucion_origen set activo = (p_cambios ->> 'activo')::boolean where id = v_i.id;
    v_n := v_n + 1;
  end if;

  return jsonb_build_object('id',v_i.id,'camposCorregidos',v_n);
end; $$;

revoke execute on function crear_institucion_secretaria(text,text,text,text,boolean) from public, anon;
grant execute on function crear_institucion_secretaria(text,text,text,text,boolean) to authenticated;
revoke execute on function actualizar_institucion_secretaria(uuid,jsonb,text) from public, anon;
grant execute on function actualizar_institucion_secretaria(uuid,jsonb,text) to authenticated;

-- ---------- 2 · Grupos ----------
create or replace function crear_grupo_secretaria(
  p_institucion_id uuid,
  p_disciplina_id  uuid,
  p_nombre         text,
  p_tipo           text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mem uuid; v_club uuid; v_rol text; v_clave text; v_id uuid; v_dup uuid;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_rol not in ('admin_secretaria','coordinador_secretaria') then raise exception 'TDS:ROL_INSUFICIENTE'; end if;

  if not exists (select 1 from institucion_origen
                  where id = p_institucion_id and club_id = v_club and activo) then
    raise exception 'TDS:INSTITUCION_DESCONOCIDA';
  end if;
  if not exists (select 1 from disciplina where id = p_disciplina_id and activo) then
    raise exception 'TDS:DISCIPLINA_DESCONOCIDA';
  end if;

  v_clave := normalizar_clave(p_nombre);
  if v_clave is null then raise exception 'TDS:NOMBRE_REQUERIDO'; end if;

  select id into v_dup from categoria
   where club_id = v_club and institucion_origen_id = p_institucion_id
     and disciplina_id = p_disciplina_id and normalizar_clave(nombre) = v_clave;
  if v_dup is not null then
    return jsonb_build_object('estado','GRUPO_POSIBLE_DUPLICADO','existente',v_dup);
  end if;

  -- tipo queda nullable a propósito: U14, Iniciación y Desarrollo no se
  -- fuerzan a 'inferior' ni 'primera' (el enum es del fútbol formador).
  insert into categoria(club_id, disciplina_id, institucion_origen_id, nombre, tipo, creado_por)
  values (v_club, p_disciplina_id, p_institucion_id, trim(p_nombre), p_tipo, v_mem)
  returning id into v_id;

  insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
  values (v_club,'categoria',v_id,'alta',null,trim(p_nombre),'Alta de grupo',v_mem);

  return jsonb_build_object('estado','CREADO','id',v_id,'nombre',trim(p_nombre));
end; $$;

create or replace function actualizar_grupo_secretaria(
  p_id      uuid,
  p_cambios jsonb,
  p_motivo  text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mem uuid; v_club uuid; v_rol text; v_c categoria%rowtype; v_n int := 0;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'TDS:MOTIVO_REQUERIDO'; end if;

  select * into v_c from categoria where id = p_id and club_id = v_club for update;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;
  -- El coordinador solo toca los grupos que tiene asignados.
  if v_rol = 'coordinador_secretaria' and not opera_categoria(v_club, v_c.id) then
    raise exception 'TDS:SIN_ALCANCE';
  end if;
  if v_rol not in ('admin_secretaria','coordinador_secretaria') then raise exception 'TDS:ROL_INSUFICIENTE'; end if;

  if p_cambios ? 'nombre' and trim(p_cambios ->> 'nombre') is distinct from v_c.nombre then
    if exists (select 1 from categoria o
                where o.club_id = v_club and o.id <> v_c.id
                  and o.institucion_origen_id is not distinct from v_c.institucion_origen_id
                  and o.disciplina_id = v_c.disciplina_id
                  and normalizar_clave(o.nombre) = normalizar_clave(p_cambios ->> 'nombre')) then
      raise exception 'TDS:GRUPO_DUPLICADO';
    end if;
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'categoria',v_c.id,'nombre',v_c.nombre,trim(p_cambios ->> 'nombre'),p_motivo,v_mem);
    update categoria set nombre = trim(p_cambios ->> 'nombre') where id = v_c.id;
    v_n := v_n + 1;
  end if;

  if p_cambios ? 'institucionOrigenId'
     and (p_cambios ->> 'institucionOrigenId')::uuid is distinct from v_c.institucion_origen_id then
    if not exists (select 1 from institucion_origen
                    where id = (p_cambios ->> 'institucionOrigenId')::uuid and club_id = v_club) then
      raise exception 'TDS:INSTITUCION_DESCONOCIDA';
    end if;
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'categoria',v_c.id,'institucionOrigenId',v_c.institucion_origen_id::text,p_cambios ->> 'institucionOrigenId',p_motivo,v_mem);
    update categoria set institucion_origen_id = (p_cambios ->> 'institucionOrigenId')::uuid where id = v_c.id;
    v_n := v_n + 1;
  end if;

  -- Cambiar la disciplina de un grupo YA MEDIDO invalidaría sus series:
  -- los protocolos y métricas pertenecen a la disciplina anterior.
  if p_cambios ? 'disciplinaId'
     and (p_cambios ->> 'disciplinaId')::uuid is distinct from v_c.disciplina_id then
    if exists (select 1 from medicion m join deportista d on d.id = m.deportista_id
                where d.categoria_id = v_c.id)
       or exists (select 1 from jornada_evaluacion j where j.categoria_id = v_c.id) then
      raise exception 'TDS:GRUPO_CON_MEDICIONES';
    end if;
    if not exists (select 1 from disciplina where id = (p_cambios ->> 'disciplinaId')::uuid and activo) then
      raise exception 'TDS:DISCIPLINA_DESCONOCIDA';
    end if;
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'categoria',v_c.id,'disciplinaId',v_c.disciplina_id::text,p_cambios ->> 'disciplinaId',p_motivo,v_mem);
    update categoria set disciplina_id = (p_cambios ->> 'disciplinaId')::uuid where id = v_c.id;
    v_n := v_n + 1;
  end if;

  if p_cambios ? 'activo' and (p_cambios ->> 'activo')::boolean is distinct from v_c.activo then
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'categoria',v_c.id,'activo',v_c.activo::text,p_cambios ->> 'activo',p_motivo,v_mem);
    update categoria set activo = (p_cambios ->> 'activo')::boolean where id = v_c.id;
    v_n := v_n + 1;
  end if;

  return jsonb_build_object('id',v_c.id,'camposCorregidos',v_n);
end; $$;

-- ---------- Solicitud de disciplina ----------
create or replace function solicitar_disciplina_secretaria(
  p_nombre      text,
  p_descripcion text default null,
  p_contexto    text default null
)
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
   where club_id = v_club and nombre_clave = v_clave and estado = 'pendiente';
  if v_id is not null then
    return jsonb_build_object('estado','SOLICITUD_YA_PENDIENTE','id',v_id);
  end if;

  insert into disciplina_solicitud(club_id, nombre, nombre_clave, descripcion, contexto, solicitado_por)
  values (v_club, trim(p_nombre), v_clave, nullif(trim(p_descripcion),''), nullif(trim(p_contexto),''), v_mem)
  returning id into v_id;

  return jsonb_build_object('estado','SOLICITADA','id',v_id,'estadoSolicitud','pendiente');
end; $$;

revoke execute on function crear_grupo_secretaria(uuid,uuid,text,text) from public, anon;
grant execute on function crear_grupo_secretaria(uuid,uuid,text,text) to authenticated;
revoke execute on function actualizar_grupo_secretaria(uuid,jsonb,text) from public, anon;
grant execute on function actualizar_grupo_secretaria(uuid,jsonb,text) to authenticated;
revoke execute on function solicitar_disciplina_secretaria(text,text,text) from public, anon;
grant execute on function solicitar_disciplina_secretaria(text,text,text) to authenticated;

-- ---------- 3 · Deportistas ----------
-- Deduplicación de identidad: nombre normalizado + fecha de nacimiento,
-- SIEMPRE dentro del mismo espacio. Nunca se reutiliza ni se expone una
-- ficha de un club ajeno por coincidencia de nombre.
create or replace function buscar_duplicados_deportista(
  p_nombre_completo text,
  p_fecha_nacimiento date default null
)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_club uuid; v_clave text;
begin
  select club_id into v_club from secretaria_actual();
  if v_club is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  v_clave := normalizar_clave(p_nombre_completo);
  if v_clave is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', d.id,
      'nombre', d.nombre,
      'apellido', d.apellido,
      'fechaNacimiento', d.fecha_nacimiento,
      'grupo', c.nombre,
      'institucion', io.nombre,
      'activo', d.activo,
      'coincidencia', case
        when p_fecha_nacimiento is not null and d.fecha_nacimiento = p_fecha_nacimiento then 'nombre_y_fecha'
        else 'solo_nombre' end)
      order by d.nombre)
    from deportista d
    left join categoria c on c.id = d.categoria_id
    left join institucion_origen io on io.id = c.institucion_origen_id
   where d.club_id = v_club
     and normalizar_clave(coalesce(d.nombre,'') || ' ' || coalesce(d.apellido,'')) = v_clave
  ), '[]'::jsonb);
end; $$;

create or replace function crear_deportista_secretaria(
  p_grupo_id  uuid,
  p_identidad jsonb,
  p_resolucion text default null   -- null | 'crear_igual' | 'vincular:<uuid>'
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mem uuid; v_club uuid; v_rol text;
  v_nombre text; v_apellido text; v_completo text;
  v_fnac date; v_dups jsonb; v_id uuid; v_vinc uuid;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_rol not in ('admin_secretaria','coordinador_secretaria') then raise exception 'TDS:ROL_INSUFICIENTE'; end if;

  if not exists (select 1 from categoria where id = p_grupo_id and club_id = v_club and activo) then
    raise exception 'TDS:GRUPO_DESCONOCIDO';
  end if;
  if not opera_categoria(v_club, p_grupo_id) then raise exception 'TDS:SIN_ALCANCE'; end if;

  v_nombre   := nullif(trim(p_identidad ->> 'nombre'),'');
  v_apellido := nullif(trim(p_identidad ->> 'apellido'),'');
  v_completo := coalesce(nullif(trim(p_identidad ->> 'nombreCompleto'),''),
                         trim(coalesce(v_nombre,'') || ' ' || coalesce(v_apellido,'')));
  if normalizar_clave(v_completo) is null then raise exception 'TDS:NOMBRE_REQUERIDO'; end if;
  if v_nombre is null then v_nombre := v_completo; end if;
  v_fnac := nullif(p_identidad ->> 'fechaNacimiento','')::date;

  -- Vincular a una ficha existente en vez de crear otra.
  if p_resolucion like 'vincular:%' then
    v_vinc := substring(p_resolucion from 10)::uuid;
    if not exists (select 1 from deportista where id = v_vinc and club_id = v_club) then
      raise exception 'TDS:SIN_ALCANCE';
    end if;
    update deportista set categoria_id = p_grupo_id, actualizado_en = now() where id = v_vinc;
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'deportista',v_vinc,'grupo',null,p_grupo_id::text,'Vinculación a ficha existente',v_mem);
    return jsonb_build_object('estado','VINCULADO','id',v_vinc);
  end if;

  -- Sin resolución explícita, los candidatos se devuelven para que decida
  -- una persona. No se crea ni se fusiona nada en silencio.
  if p_resolucion is null then
    v_dups := buscar_duplicados_deportista(v_completo, v_fnac);
    if jsonb_array_length(v_dups) > 0 then
      return jsonb_build_object('estado','DEPORTISTA_POSIBLE_DUPLICADO','candidatos',v_dups);
    end if;
  end if;

  insert into deportista(club_id, categoria_id, nombre, apellido, fecha_nacimiento,
                         sexo, lateralidad, doc_interno, creado_por)
  values (v_club, p_grupo_id, v_nombre, v_apellido, v_fnac,
          nullif(p_identidad ->> 'sexo',''), nullif(p_identidad ->> 'lateralidad',''),
          nullif(p_identidad ->> 'docInterno',''), v_mem)
  returning id into v_id;

  insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
  values (v_club,'deportista',v_id,'alta',null,v_completo,'Alta de deportista',v_mem);

  return jsonb_build_object('estado','CREADO','id',v_id,'nombre',v_nombre,'apellido',v_apellido);
end; $$;

create or replace function actualizar_deportista_secretaria(
  p_id      uuid,
  p_cambios jsonb,
  p_motivo  text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_mem uuid; v_club uuid; v_rol text; v_d deportista%rowtype; v_n int := 0;
  v_campo text; v_antes text; v_nuevo text;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_mem is null then raise exception 'TDS:SIN_ALCANCE'; end if;
  if coalesce(trim(p_motivo),'') = '' then raise exception 'TDS:MOTIVO_REQUERIDO'; end if;

  select * into v_d from deportista where id = p_id and club_id = v_club for update;
  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;
  if not opera_categoria(v_club, v_d.categoria_id) then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_rol = 'evaluador' then raise exception 'TDS:ROL_INSUFICIENTE'; end if;

  foreach v_campo in array array['nombre','apellido','sexo','lateralidad','docInterno'] loop
    if p_cambios ? v_campo then
      v_antes := case v_campo when 'nombre' then v_d.nombre when 'apellido' then v_d.apellido
                              when 'sexo' then v_d.sexo when 'lateralidad' then v_d.lateralidad
                              else v_d.doc_interno end;
      v_nuevo := nullif(trim(p_cambios ->> v_campo),'');
      if v_nuevo is distinct from v_antes then
        case v_campo
          when 'nombre'      then update deportista set nombre = v_nuevo where id = v_d.id;
          when 'apellido'    then update deportista set apellido = v_nuevo where id = v_d.id;
          when 'sexo'        then update deportista set sexo = v_nuevo where id = v_d.id;
          when 'lateralidad' then update deportista set lateralidad = v_nuevo where id = v_d.id;
          else                    update deportista set doc_interno = v_nuevo where id = v_d.id;
        end case;
        insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
        values (v_club,'deportista',v_d.id,v_campo,v_antes,v_nuevo,p_motivo,v_mem);
        v_n := v_n + 1;
      end if;
    end if;
  end loop;

  if p_cambios ? 'fechaNacimiento'
     and nullif(p_cambios ->> 'fechaNacimiento','')::date is distinct from v_d.fecha_nacimiento then
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'deportista',v_d.id,'fechaNacimiento',v_d.fecha_nacimiento::text,p_cambios ->> 'fechaNacimiento',p_motivo,v_mem);
    update deportista set fecha_nacimiento = nullif(p_cambios ->> 'fechaNacimiento','')::date where id = v_d.id;
    v_n := v_n + 1;
  end if;

  -- Mover de grupo cambia la pertenencia FUTURA. Las jornadas pasadas
  -- conservan su contexto: jornada_deportista y medicion no se reescriben.
  if p_cambios ? 'grupoId' and (p_cambios ->> 'grupoId')::uuid is distinct from v_d.categoria_id then
    if not exists (select 1 from categoria where id = (p_cambios ->> 'grupoId')::uuid and club_id = v_club and activo) then
      raise exception 'TDS:GRUPO_DESCONOCIDO';
    end if;
    if not opera_categoria(v_club, (p_cambios ->> 'grupoId')::uuid) then raise exception 'TDS:SIN_ALCANCE'; end if;
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'deportista',v_d.id,'grupoId',v_d.categoria_id::text,p_cambios ->> 'grupoId',p_motivo,v_mem);
    update deportista set categoria_id = (p_cambios ->> 'grupoId')::uuid where id = v_d.id;
    v_n := v_n + 1;
  end if;

  -- Baja lógica: con mediciones NUNCA se borra.
  if p_cambios ? 'activo' and (p_cambios ->> 'activo')::boolean is distinct from v_d.activo then
    insert into correccion_auditoria(club_id, entidad, entidad_id, campo, valor_anterior, valor_nuevo, motivo, membresia_id)
    values (v_club,'deportista',v_d.id,'activo',v_d.activo::text,p_cambios ->> 'activo',p_motivo,v_mem);
    update deportista set activo = (p_cambios ->> 'activo')::boolean where id = v_d.id;
    v_n := v_n + 1;
  end if;

  update deportista set actualizado_en = now() where id = v_d.id;
  return jsonb_build_object('id',v_d.id,'camposCorregidos',v_n);
end; $$;

revoke execute on function buscar_duplicados_deportista(text,date) from public, anon;
grant execute on function buscar_duplicados_deportista(text,date) to authenticated;
revoke execute on function crear_deportista_secretaria(uuid,jsonb,text) from public, anon;
grant execute on function crear_deportista_secretaria(uuid,jsonb,text) to authenticated;
revoke execute on function actualizar_deportista_secretaria(uuid,jsonb,text) from public, anon;
grant execute on function actualizar_deportista_secretaria(uuid,jsonb,text) to authenticated;

-- ---------- 5 · Consulta jerárquica institución → disciplina → grupo → plantel ----------
create or replace function arbol_secretaria(p_incluir_inactivos boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_club uuid; v_mem uuid; v_rol text;
begin
  select membresia_id, club_id, rol into v_mem, v_club, v_rol from secretaria_actual();
  if v_club is null then raise exception 'TDS:SIN_ALCANCE'; end if;

  return coalesce((
    select jsonb_agg(inst order by inst ->> 'nombre')
    from (
      select jsonb_build_object(
        'id', io.id, 'nombre', io.nombre, 'tipo', io.tipo,
        'localidad', io.localidad, 'activo', io.activo,
        'disciplinas', coalesce((
          select jsonb_agg(d2 order by d2 ->> 'nombre') from (
            select jsonb_build_object(
              'id', di.id, 'nombre', di.nombre,
              'grupos', coalesce((
                select jsonb_agg(jsonb_build_object(
                         'id', c.id, 'nombre', c.nombre, 'tipo', c.tipo, 'activo', c.activo,
                         'deportistas', (select count(*)::int from deportista dd
                                          where dd.categoria_id = c.id and dd.activo))
                       order by c.nombre)
                  from categoria c
                 where c.club_id = v_club and c.institucion_origen_id = io.id
                   and c.disciplina_id = di.id
                   and (p_incluir_inactivos or c.activo)
                   -- Minimización: el evaluador solo ve sus grupos asignados.
                   and (v_rol in ('admin_secretaria','coordinador_secretaria','analista_secretaria')
                        or alcanza_categoria(v_club, c.id))
              ), '[]'::jsonb)) as d2
              from disciplina di
             where exists (select 1 from categoria c
                            where c.club_id = v_club and c.institucion_origen_id = io.id
                              and c.disciplina_id = di.id
                              and (p_incluir_inactivos or c.activo)
                              and (v_rol in ('admin_secretaria','coordinador_secretaria','analista_secretaria')
                                   or alcanza_categoria(v_club, c.id)))
          ) s2), '[]'::jsonb)) as inst
        from institucion_origen io
       where io.club_id = v_club
         and (p_incluir_inactivos
              or io.activo
              or exists (select 1 from jornada_evaluacion j where j.institucion_origen_id = io.id))
    ) s
  ), '[]'::jsonb);
end; $$;

revoke execute on function arbol_secretaria(boolean) from public, anon;
grant execute on function arbol_secretaria(boolean) to authenticated;
