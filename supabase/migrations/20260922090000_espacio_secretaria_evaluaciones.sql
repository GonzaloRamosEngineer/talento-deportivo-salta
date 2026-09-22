-- ============================================================
-- ESPACIO SECRETARÍA + EVALUACIONES MULTIDISCIPLINA
--
-- IMPORTANTE: esta migración se versiona para un proyecto de staging
-- separado. No aplicarla al proyecto productivo hjaeihdrrictmgilzaic
-- hasta completar Gate A, pruebas RLS y ensayo de importación.
-- ============================================================

-- ---------- Organización y membresías multiespacio ----------
alter table club
  add column if not exists tipo_organizacion text not null default 'club'
  check (tipo_organizacion in ('club', 'secretaria', 'liga', 'federacion'));

alter table membresia drop constraint if exists membresia_auth_user_id_key;
alter table membresia drop constraint if exists membresia_rol_check;
alter table membresia add constraint membresia_rol_check check (rol in (
  'admin_club', 'entrenador', 'comision_directiva',
  'admin_secretaria', 'coordinador_secretaria', 'evaluador', 'analista_secretaria'
));

create or replace function es_admin_de(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from membresia
    where club_id = p_club_id and auth_user_id = auth.uid()
      and rol in ('admin_club', 'admin_secretaria', 'coordinador_secretaria')
  )
$$;

create or replace function puede_operar(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from membresia
    where club_id = p_club_id and auth_user_id = auth.uid()
      and rol in ('admin_club', 'entrenador', 'admin_secretaria', 'coordinador_secretaria', 'evaluador')
  )
$$;

create or replace function alcanza_categoria(p_club uuid, p_categoria uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from membresia m
    where m.club_id = p_club and m.auth_user_id = auth.uid()
      and (
        m.rol in ('admin_club', 'comision_directiva', 'admin_secretaria', 'coordinador_secretaria', 'analista_secretaria')
        or (m.rol in ('entrenador', 'evaluador') and exists (
          select 1 from membresia_categoria mc
          where mc.membresia_id = m.id and mc.categoria_id = p_categoria
        ))
      )
  )
$$;

create or replace function opera_categoria(p_club uuid, p_categoria uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from membresia m
    where m.club_id = p_club and m.auth_user_id = auth.uid()
      and (
        m.rol in ('admin_club', 'admin_secretaria', 'coordinador_secretaria')
        or (m.rol in ('entrenador', 'evaluador') and exists (
          select 1 from membresia_categoria mc
          where mc.membresia_id = m.id and mc.categoria_id = p_categoria
        ))
      )
  )
$$;

-- ---------- Procedencia y grupos ----------
create table institucion_origen (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references club(id) on delete cascade,
  nombre     text not null,
  localidad  text,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now(),
  unique (club_id, nombre)
);

alter table categoria add column if not exists institucion_origen_id uuid
  references institucion_origen(id) on delete restrict;
alter table categoria drop constraint if exists categoria_club_id_disciplina_id_nombre_key;
alter table categoria add constraint categoria_organizacion_disciplina_institucion_nombre_key
  unique nulls not distinct (club_id, disciplina_id, institucion_origen_id, nombre);

-- ---------- Catálogo métrica/protocolo ----------
alter table atributo add column if not exists codigo text;
create unique index if not exists uq_atributo_codigo on atributo(codigo) where codigo is not null;

create table protocolo (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  nombre       text not null,
  version      text not null default '1',
  descripcion  text,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create table disciplina_protocolo (
  disciplina_id uuid not null references disciplina(id) on delete cascade,
  protocolo_id  uuid not null references protocolo(id) on delete cascade,
  orden         int not null default 0,
  activo        boolean not null default true,
  primary key (disciplina_id, protocolo_id)
);

create table protocolo_atributo (
  protocolo_id uuid not null references protocolo(id) on delete cascade,
  atributo_id  uuid not null references atributo(id) on delete cascade,
  requerido    boolean not null default false,
  unidad       text not null,
  minimo       numeric,
  maximo       numeric,
  primary key (protocolo_id, atributo_id)
);

-- ---------- Jornada y lote auditable ----------
create table jornada_evaluacion (
  id                    uuid primary key default gen_random_uuid(),
  club_id               uuid not null references club(id) on delete cascade,
  institucion_origen_id uuid not null references institucion_origen(id) on delete restrict,
  disciplina_id         uuid not null references disciplina(id) on delete restrict,
  categoria_id          uuid not null references categoria(id) on delete restrict,
  fecha                 date not null,
  evaluado_por          text not null,
  importado_por         uuid not null references membresia(id) on delete restrict,
  estado                text not null default 'confirmada'
                        check (estado in ('borrador', 'confirmada', 'anulada')),
  creado_en             timestamptz not null default now(),
  unique (club_id, institucion_origen_id, disciplina_id, categoria_id, fecha, evaluado_por)
);

create table jornada_deportista (
  jornada_id      uuid not null references jornada_evaluacion(id) on delete cascade,
  deportista_id   uuid not null references deportista(id) on delete cascade,
  edad_declarada  int check (edad_declarada between 0 and 120),
  creado_en       timestamptz not null default now(),
  primary key (jornada_id, deportista_id)
);

create table lote_importacion (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references club(id) on delete cascade,
  nombre_archivo       text not null,
  hash_sha256          text not null check (length(hash_sha256) = 64),
  adaptador            text not null,
  contexto             jsonb not null,
  preview_json         jsonb not null,
  hallazgos            jsonb not null default '[]'::jsonb,
  resoluciones         jsonb not null default '{}'::jsonb,
  filas_ignoradas      int not null default 0,
  duplicados_archivo   int not null default 0,
  bloqueos_pendientes  int not null default 0,
  importado_por        uuid not null references membresia(id) on delete restrict,
  estado               text not null default 'previsualizado'
                       check (estado in ('previsualizado', 'importando', 'importado', 'fallido', 'vencido')),
  resultado            jsonb,
  vence_en             timestamptz not null,
  creado_en            timestamptz not null default now(),
  confirmado_en        timestamptz
);

create unique index uq_lote_importado_hash_contexto
  on lote_importacion (
    club_id,
    hash_sha256,
    (contexto ->> 'institucionOrigen'),
    (contexto ->> 'disciplina'),
    (contexto ->> 'grupo')
  ) where estado = 'importado';

create table lote_importacion_evento (
  id             uuid primary key default gen_random_uuid(),
  lote_id        uuid not null references lote_importacion(id) on delete cascade,
  membresia_id   uuid not null references membresia(id) on delete restrict,
  tipo           text not null check (tipo in ('previsualizado', 'confirmado', 'corregido', 'anulado')),
  detalle        jsonb not null default '{}'::jsonb,
  creado_en      timestamptz not null default now()
);

-- ---------- Evolución compatible de medición ----------
alter table medicion add column if not exists jornada_id uuid
  references jornada_evaluacion(id) on delete restrict;
alter table medicion add column if not exists protocolo_id uuid
  references protocolo(id) on delete restrict;
alter table medicion add column if not exists lote_importacion_id uuid
  references lote_importacion(id) on delete restrict;
alter table medicion add column if not exists intento int not null default 1 check (intento > 0);
alter table medicion add column if not exists detalle jsonb not null default '{}'::jsonb;

alter table medicion drop constraint if exists medicion_deportista_id_atributo_id_fecha_key;
create unique index uq_medicion_jornada_identidad
  on medicion (jornada_id, deportista_id, atributo_id, protocolo_id, intento)
  nulls not distinct
  where jornada_id is not null;
create index idx_medicion_jornada on medicion(jornada_id);

alter table deportista add column if not exists clave_importacion text;
create unique index uq_deportista_clave_importacion
  on deportista (club_id, categoria_id, clave_importacion)
  where clave_importacion is not null;

-- ---------- RLS ----------
alter table institucion_origen enable row level security;
alter table protocolo enable row level security;
alter table disciplina_protocolo enable row level security;
alter table protocolo_atributo enable row level security;
alter table jornada_evaluacion enable row level security;
alter table jornada_deportista enable row level security;
alter table lote_importacion enable row level security;
alter table lote_importacion_evento enable row level security;

create policy "institucion_lectura" on institucion_origen
  for select using (es_miembro_de(club_id));
create policy "institucion_escritura" on institucion_origen
  for all using (es_admin_de(club_id)) with check (es_admin_de(club_id));

create policy "protocolo_lectura" on protocolo
  for select using (auth.role() = 'authenticated');
create policy "disciplina_protocolo_lectura" on disciplina_protocolo
  for select using (auth.role() = 'authenticated');
create policy "protocolo_atributo_lectura" on protocolo_atributo
  for select using (auth.role() = 'authenticated');

create policy "jornada_lectura" on jornada_evaluacion
  for select using (alcanza_categoria(club_id, categoria_id));
create policy "jornada_escritura" on jornada_evaluacion
  for all using (opera_categoria(club_id, categoria_id))
  with check (opera_categoria(club_id, categoria_id));

create policy "jornada_deportista_lectura" on jornada_deportista
  for select using (
    jornada_id in (select id from jornada_evaluacion where alcanza_categoria(club_id, categoria_id))
  );
create policy "jornada_deportista_escritura" on jornada_deportista
  for all using (
    jornada_id in (select id from jornada_evaluacion where opera_categoria(club_id, categoria_id))
  ) with check (
    jornada_id in (select id from jornada_evaluacion where opera_categoria(club_id, categoria_id))
  );

create policy "lote_lectura" on lote_importacion
  for select using (
    es_admin_de(club_id)
    or importado_por in (select id from membresia where auth_user_id = auth.uid() and club_id = lote_importacion.club_id)
  );
create policy "lote_insert" on lote_importacion
  for insert with check (
    puede_operar(club_id)
    and importado_por in (select id from membresia where auth_user_id = auth.uid() and club_id = lote_importacion.club_id)
  );
create policy "lote_update" on lote_importacion
  for update using (
    es_admin_de(club_id)
    or importado_por in (select id from membresia where auth_user_id = auth.uid() and club_id = lote_importacion.club_id)
  ) with check (
    es_admin_de(club_id)
    or importado_por in (select id from membresia where auth_user_id = auth.uid() and club_id = lote_importacion.club_id)
  );

create policy "lote_evento_lectura" on lote_importacion_evento
  for select using (lote_id in (select id from lote_importacion));
create policy "lote_evento_insert" on lote_importacion_evento
  for insert with check (
    lote_id in (select id from lote_importacion)
    and membresia_id in (select id from membresia where auth_user_id = auth.uid())
  );

-- ---------- Confirmación atómica e idempotente ----------
create or replace function confirmar_lote_evaluacion(
  p_lote_id uuid,
  p_resoluciones jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lote lote_importacion%rowtype;
  v_disciplina uuid;
  v_institucion uuid;
  v_categoria uuid;
  v_jornada uuid;
  v_medicion jsonb;
  v_deportista uuid;
  v_atributo uuid;
  v_protocolo uuid;
  v_fecha date;
  v_creados int := 0;
  v_vinculados int := 0;
  v_guardadas int := 0;
  v_resultado jsonb;
  v_bloqueo jsonb;
  v_claves_vistas text[] := array[]::text[];
  v_jornadas uuid[] := array[]::uuid[];
begin
  select * into v_lote
    from lote_importacion
   where id = p_lote_id
   for update;

  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_lote.estado = 'importado' then
    return v_lote.resultado;
  end if;
  if v_lote.estado <> 'previsualizado' then raise exception 'TDS:IMPORTACION_DUPLICADA'; end if;
  if v_lote.vence_en < now() then
    update lote_importacion set estado = 'vencido' where id = p_lote_id;
    raise exception 'TDS:PREVIEW_EXPIRADO';
  end if;

  for v_bloqueo in
    select value from jsonb_array_elements(v_lote.hallazgos)
    where value ->> 'severidad' = 'bloqueo'
      and coalesce((value ->> 'requiereResolucion')::boolean, false)
  loop
    if not (p_resoluciones ? (v_bloqueo ->> 'id')) then
      raise exception 'TDS:BLOQUEOS_PENDIENTES';
    end if;
  end loop;

  if exists (
    select 1 from lote_importacion li
     where li.club_id = v_lote.club_id
       and li.hash_sha256 = v_lote.hash_sha256
       and li.contexto ->> 'institucionOrigen' = v_lote.contexto ->> 'institucionOrigen'
       and li.contexto ->> 'disciplina' = v_lote.contexto ->> 'disciplina'
       and li.contexto ->> 'grupo' = v_lote.contexto ->> 'grupo'
       and li.estado = 'importado'
       and li.id <> v_lote.id
  ) then raise exception 'TDS:IMPORTACION_DUPLICADA'; end if;

  select id into v_disciplina from disciplina
   where lower(nombre) = lower(v_lote.contexto ->> 'disciplina') and activo;
  if v_disciplina is null then raise exception 'TDS:DISCIPLINA_DESCONOCIDA'; end if;

  select id into v_institucion from institucion_origen
   where club_id = v_lote.club_id
     and lower(nombre) = lower(v_lote.contexto ->> 'institucionOrigen');
  if v_institucion is null then
    insert into institucion_origen(club_id, nombre)
    values (v_lote.club_id, v_lote.contexto ->> 'institucionOrigen')
    returning id into v_institucion;
  end if;

  select id into v_categoria from categoria
   where club_id = v_lote.club_id
     and disciplina_id = v_disciplina
     and institucion_origen_id = v_institucion
     and lower(nombre) = lower(v_lote.contexto ->> 'grupo');
  if v_categoria is null then
    insert into categoria(club_id, disciplina_id, institucion_origen_id, nombre, tipo)
    values (v_lote.club_id, v_disciplina, v_institucion, v_lote.contexto ->> 'grupo', null)
    returning id into v_categoria;
  end if;

  if not opera_categoria(v_lote.club_id, v_categoria) then
    raise exception 'TDS:SIN_ALCANCE';
  end if;

  for v_medicion in select value from jsonb_array_elements(v_lote.preview_json -> 'mediciones')
  loop
    v_fecha := coalesce(
      case
        when nullif(v_medicion ->> 'fechaResolucionId', '') is not null
        then nullif(p_resoluciones ->> (v_medicion ->> 'fechaResolucionId'), '')::date
        else null
      end,
      nullif(v_medicion ->> 'fecha', '')::date,
      nullif(v_lote.contexto ->> 'fechaDeclarada', '')::date
    );
    if v_fecha is null then raise exception 'TDS:FECHA_REQUERIDA'; end if;

    select id into v_deportista from deportista
      where club_id = v_lote.club_id
        and categoria_id = v_categoria
        and clave_importacion = v_medicion ->> 'deportistaClave';
    if not ((v_medicion ->> 'deportistaClave') = any(v_claves_vistas)) then
      v_claves_vistas := array_append(v_claves_vistas, v_medicion ->> 'deportistaClave');
      if v_deportista is null then
        -- La edad informada en una planilla NO se transforma en una fecha
        -- de nacimiento inventada. Queda preservada en el lote de origen.
        insert into deportista(
          club_id, categoria_id, nombre, apellido, clave_importacion
        ) values (
          v_lote.club_id,
          v_categoria,
          v_medicion ->> 'nombre',
          nullif(v_medicion ->> 'apellido', ''),
          v_medicion ->> 'deportistaClave'
        ) returning id into v_deportista;
        v_creados := v_creados + 1;
      else
        v_vinculados := v_vinculados + 1;
      end if;
    end if;

    select id into v_jornada from jornada_evaluacion
     where club_id = v_lote.club_id
       and institucion_origen_id = v_institucion
       and disciplina_id = v_disciplina
       and categoria_id = v_categoria
       and fecha = v_fecha
       and evaluado_por = v_lote.contexto ->> 'evaluadoPor';
    if v_jornada is null then
      insert into jornada_evaluacion(
        club_id, institucion_origen_id, disciplina_id, categoria_id,
        fecha, evaluado_por, importado_por
      ) values (
        v_lote.club_id, v_institucion, v_disciplina, v_categoria,
        v_fecha, v_lote.contexto ->> 'evaluadoPor', v_lote.importado_por
      ) returning id into v_jornada;
    end if;
    if not (v_jornada = any(v_jornadas)) then
      v_jornadas := array_append(v_jornadas, v_jornada);
    end if;

    insert into jornada_deportista(jornada_id, deportista_id, edad_declarada)
    values (
      v_jornada,
      v_deportista,
      nullif(v_medicion ->> 'edad', '')::int
    )
    on conflict (jornada_id, deportista_id) do update
      set edad_declarada = coalesce(excluded.edad_declarada, jornada_deportista.edad_declarada);

    select id into v_atributo from atributo
     where codigo = v_medicion ->> 'atributoCodigo' and activo;
    if v_atributo is null then raise exception 'TDS:METRICA_DESCONOCIDA'; end if;

    v_protocolo := null;
    if nullif(v_medicion ->> 'protocoloCodigo', '') is not null then
      select id into v_protocolo from protocolo
       where codigo = v_medicion ->> 'protocoloCodigo' and activo;
      if v_protocolo is null then raise exception 'TDS:PROTOCOLO_DESCONOCIDO'; end if;
    end if;

    insert into medicion(
      club_id, deportista_id, atributo_id, valor, fecha, registrado_por,
      jornada_id, protocolo_id, lote_importacion_id, intento, detalle
    ) values (
      v_lote.club_id, v_deportista, v_atributo,
      (v_medicion ->> 'valor')::numeric, v_fecha, v_lote.importado_por,
      v_jornada, v_protocolo, v_lote.id,
      (v_medicion ->> 'intento')::int,
      coalesce(v_medicion -> 'detalle', '{}'::jsonb)
    );
    v_guardadas := v_guardadas + 1;
  end loop;

  v_resultado := jsonb_build_object(
    'loteId', v_lote.id,
    'jornadaId', v_jornada,
    'jornadaIds', to_jsonb(v_jornadas),
    'jornadasCreadas', cardinality(v_jornadas),
    'deportistasCreados', v_creados,
    'deportistasVinculados', v_vinculados,
    'medicionesGuardadas', v_guardadas,
    'filasIgnoradas', v_lote.filas_ignoradas
  );

  update lote_importacion
     set estado = 'importado', resoluciones = p_resoluciones,
         resultado = v_resultado, confirmado_en = now(), preview_json = '{}'::jsonb
   where id = v_lote.id;
  insert into lote_importacion_evento(lote_id, membresia_id, tipo, detalle)
  values (v_lote.id, v_lote.importado_por, 'confirmado', jsonb_build_object('resoluciones', p_resoluciones));
  return v_resultado;
exception
  when unique_violation then
    raise exception 'TDS:CONFLICTO_MEDICION';
end;
$$;

revoke execute on function confirmar_lote_evaluacion(uuid, jsonb) from public, anon;
grant execute on function confirmar_lote_evaluacion(uuid, jsonb) to authenticated;
