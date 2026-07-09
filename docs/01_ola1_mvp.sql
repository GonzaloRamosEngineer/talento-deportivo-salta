-- ============================================================
-- OLA 1 — MVP (v4, última versión)
-- v3: membresía+RLS completo, catálogo global de disciplina/atributo,
--     altura/peso como serie temporal, sexo, tutor/consentimiento,
--     uniques y tie-break.
-- v4: search_path fijado en funciones security definer (seguridad);
--     atributo.sentido + protocolo (sin sentido, el estado de
--     evolución lee al revés los atributos cronometrados);
--     es_admin_de() y permisos por rol (config = admin_club,
--     operación diaria = todo miembro); índice redundante eliminado;
--     seeds de referencia del catálogo.
-- v5 (2026-07-09 — ⚠ REQUIERE REVISIÓN MANUAL, aún sin ejecutar):
--     categoria.tipo + categoria.anio_nacimiento (cohortes por año
--     de nacimiento, estructura real de club de fútbol formador);
--     rol 'comision_directiva' (solo lectura) + puede_operar();
--     las policies de ESCRITURA de operación diaria pasan de
--     es_miembro_de() a puede_operar() para que comisión directiva
--     sea consulta pura; seeds del catálogo técnico 1-10 de fútbol.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- CLUB ----------
create table club (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  localidad     text,
  creado_en     timestamptz not null default now()
);

-- ---------- DISCIPLINA (catálogo global, curado centralmente) ----------
create table disciplina (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null unique,
  descripcion   text,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

-- ---------- ATRIBUTO (catálogo global, curado centralmente) ----------
-- disciplina_id null = físico/global, común a todas las disciplinas
-- ambito distingue mediciones OBJETIVAS (segundos/cm/kg) de
-- SUBJETIVAS (escala a criterio del entrenador) — no tratarlas igual.
create table atributo (
  id            uuid primary key default gen_random_uuid(),
  disciplina_id uuid references disciplina(id) on delete cascade,
  nombre        text not null,
  ambito        text not null default 'tecnico'
                check (ambito in ('fisico','tecnico')),
  naturaleza    text not null default 'subjetivo'
                check (naturaleza in ('objetivo','subjetivo')),
  unidad        text not null default 'escala',  -- 'escala','segundos','cm','kg'
  escala_min    numeric(6,2) default 0,
  escala_max    numeric(6,2) default 10,
  sentido       text check (sentido in ('mayor_mejor','menor_mejor')),
                -- 'menor_mejor': ej. 'Velocidad 30m' en segundos, mejorar
                -- es BAJAR el valor. null = neutro (talla/peso: se
                -- registran, no se juzgan como mejora/retroceso).
  protocolo     text,          -- cómo se mide — clave para que la medición
                               -- sea comparable entre clubes
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);
-- Unicidad de nombre por disciplina, incluyendo el caso "global" (null)
create unique index uq_atributo_nombre
  on atributo (coalesce(disciplina_id, '00000000-0000-0000-0000-000000000000'::uuid), nombre);

-- ---------- CATEGORÍA (del club, sobre el catálogo global) ----------
-- ⚠ v5 REQUIERE REVISIÓN MANUAL: tipo + anio_nacimiento.
-- En fútbol formador las categorías son cohortes por año de
-- nacimiento ("Escuelita 2019", "9ª División" = nacidos 2013) que se
-- renuevan cada año; anio_nacimiento captura eso. edad_min/edad_max
-- quedan para disciplinas que agrupan por rango y no por cohorte.
create table categoria (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references club(id) on delete cascade,
  disciplina_id   uuid not null references disciplina(id) on delete restrict,
  nombre          text not null,
  tipo            text check (tipo in ('escuelita','inferior','reserva','primera')),
  anio_nacimiento int,           -- cohorte (null si agrupa por rango de edad)
  edad_min        int,
  edad_max        int,
  creado_en       timestamptz not null default now(),
  unique (club_id, disciplina_id, nombre)
);

-- ---------- MEMBRESÍA (única entidad con login — staff del club) ----------
create table membresia (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references club(id) on delete cascade,
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  nombre        text not null,
  email         text,
  -- ⚠ v5 REQUIERE REVISIÓN MANUAL: se suma 'comision_directiva',
  -- un rol de CONSULTA PURA (ve todo su club, no escribe nada).
  rol           text not null default 'entrenador'
                check (rol in ('admin_club','entrenador','comision_directiva')),
  creado_en     timestamptz not null default now(),
  unique (club_id, auth_user_id)
);

-- Helper de RLS: ¿el usuario autenticado es miembro de este club?
-- search_path fijado: obligatorio en security definer para impedir
-- que un search_path manipulado resuelva objetos ajenos con
-- privilegios elevados (lo marca el linter de Supabase).
create or replace function es_miembro_de(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from membresia
    where club_id = p_club_id and auth_user_id = auth.uid()
  )
$$;

-- ¿...y además es admin del club? (gestiona la config institucional)
create or replace function es_admin_de(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from membresia
    where club_id = p_club_id and auth_user_id = auth.uid()
      and rol = 'admin_club'
  )
$$;

-- ⚠ v5: ¿puede cargar/editar la operación diaria? (excluye a
-- comisión directiva, que es consulta pura)
create or replace function puede_operar(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from membresia
    where club_id = p_club_id and auth_user_id = auth.uid()
      and rol in ('admin_club','entrenador')
  )
$$;

-- ---------- DEPORTISTA ----------
-- altura/peso NO están acá: se registran como mediciones (regla #1)
create table deportista (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references club(id) on delete cascade,
  categoria_id      uuid references categoria(id) on delete set null,
  nombre            text not null,
  apellido          text,
  doc_interno       text,
  fecha_nacimiento  date,
  sexo              text check (sexo in ('M','F','X') or sexo is null),
  lateralidad       text check (lateralidad in ('diestro','zurdo','ambidiestro') or lateralidad is null),
  activo            boolean not null default true,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

-- ---------- TUTOR Y CONSENTIMIENTO (mínimo, no negociable) ----------
create table tutor (
  id            uuid primary key default gen_random_uuid(),
  deportista_id uuid not null references deportista(id) on delete cascade,
  nombre        text not null,
  relacion      text,          -- 'madre','padre','tutor legal'...
  telefono      text,
  email         text,
  creado_en     timestamptz not null default now()
);

create table consentimiento (
  id               uuid primary key default gen_random_uuid(),
  deportista_id    uuid not null references deportista(id) on delete cascade,
  tutor_id         uuid references tutor(id) on delete set null,
  otorgado         boolean not null default true,
  fecha_firma      date not null default current_date,
  observacion      text,      -- ej. referencia al papel firmado físico
  revocado_en      timestamptz,
  creado_en        timestamptz not null default now()
);

-- ---------- MEDICIÓN (serie temporal — corazón del sistema) ----------
create table medicion (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references club(id) on delete cascade,
  deportista_id  uuid not null references deportista(id) on delete cascade,
  atributo_id    uuid not null references atributo(id) on delete restrict,
  valor          numeric(6,2) not null,
  fecha          date not null default current_date,
  registrado_por uuid references membresia(id) on delete set null,
  nota           text,
  creado_en      timestamptz not null default now(),
  unique (deportista_id, atributo_id, fecha)  -- tie-break: una medición por día
);
-- El unique ya crea el índice (deportista, atributo, fecha) que
-- reconstruye la curva de evolución; no hace falta otro.

create or replace function fn_set_club_id_medicion()
returns trigger language plpgsql as $$
begin
  select club_id into new.club_id from deportista where id = new.deportista_id;
  return new;
end; $$;
create trigger trg_medicion_club_id
  before insert or update on medicion
  for each row execute function fn_set_club_id_medicion();

-- ---------- SESIÓN DE ENTRENAMIENTO ----------
create table sesion_entrenamiento (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references club(id) on delete cascade,
  categoria_id   uuid references categoria(id) on delete set null,
  responsable_id uuid references membresia(id) on delete set null,
  atributo_foco  uuid references atributo(id) on delete set null,
  fecha          timestamptz not null default now(),
  descripcion    text,
  creado_en      timestamptz not null default now()
);

create table sesion_asistencia (
  sesion_id     uuid not null references sesion_entrenamiento(id) on delete cascade,
  deportista_id uuid not null references deportista(id) on delete cascade,
  presente      boolean not null default true,
  primary key (sesion_id, deportista_id)
);

-- ============================================================
-- ROW LEVEL SECURITY (escrita junto al DDL, no como anexo)
-- ============================================================
alter table club enable row level security;
alter table disciplina enable row level security;
alter table atributo enable row level security;
alter table categoria enable row level security;
alter table membresia enable row level security;
alter table deportista enable row level security;
alter table tutor enable row level security;
alter table consentimiento enable row level security;
alter table medicion enable row level security;
alter table sesion_entrenamiento enable row level security;
alter table sesion_asistencia enable row level security;

-- Catálogo global: lectura para cualquier staff autenticado, sin escritura
create policy "catalogo_disciplina_lectura" on disciplina
  for select using (auth.role() = 'authenticated');
create policy "catalogo_atributo_lectura" on atributo
  for select using (auth.role() = 'authenticated');

-- Resto: scoped por club. Regla de roles:
--   * Config institucional (club, membresías, categorías) la escribe
--     solo admin_club.
--   * Operación diaria (deportistas, tutores, consentimientos,
--     mediciones, sesiones) la hace cualquier miembro.
--   * Borrar deportistas (cascada sobre TODAS sus mediciones) es
--     solo admin_club.
-- El alta de clubes y la primera membresía siguen siendo por
-- service role (sin onboarding self-service en el MVP).

create policy "club_propio" on club
  for select using (es_miembro_de(id));
create policy "club_update_admin" on club
  for update using (es_admin_de(id)) with check (es_admin_de(id));

create policy "membresia_de_mi_club" on membresia
  for select using (es_miembro_de(club_id));
create policy "membresia_insert_admin" on membresia
  for insert with check (es_admin_de(club_id));
create policy "membresia_update_admin" on membresia
  for update using (es_admin_de(club_id)) with check (es_admin_de(club_id));
create policy "membresia_delete_admin" on membresia
  for delete using (es_admin_de(club_id));

create policy "categoria_lectura" on categoria
  for select using (es_miembro_de(club_id));
create policy "categoria_insert_admin" on categoria
  for insert with check (es_admin_de(club_id));
create policy "categoria_update_admin" on categoria
  for update using (es_admin_de(club_id)) with check (es_admin_de(club_id));
create policy "categoria_delete_admin" on categoria
  for delete using (es_admin_de(club_id));

-- ⚠ v5: lectura = todo miembro (incluida comisión directiva);
-- escritura = puede_operar() (admin_club y entrenador).
create policy "deportista_lectura" on deportista
  for select using (es_miembro_de(club_id));
create policy "deportista_insert" on deportista
  for insert with check (puede_operar(club_id));
create policy "deportista_update" on deportista
  for update using (puede_operar(club_id)) with check (puede_operar(club_id));
create policy "deportista_delete_admin" on deportista
  for delete using (es_admin_de(club_id));

-- ⚠ v5: en tutor/consentimiento/medicion/sesion/asistencia se separa
-- lectura (es_miembro_de) de escritura (puede_operar) por el rol
-- comision_directiva. Antes eran policies "for all" de miembro.
create policy "tutor_lectura" on tutor
  for select using (
    deportista_id in (select id from deportista where es_miembro_de(club_id))
  );
create policy "tutor_escritura" on tutor
  for all using (
    deportista_id in (select id from deportista where puede_operar(club_id))
  ) with check (
    deportista_id in (select id from deportista where puede_operar(club_id))
  );

create policy "consentimiento_lectura" on consentimiento
  for select using (
    deportista_id in (select id from deportista where es_miembro_de(club_id))
  );
create policy "consentimiento_escritura" on consentimiento
  for all using (
    deportista_id in (select id from deportista where puede_operar(club_id))
  ) with check (
    deportista_id in (select id from deportista where puede_operar(club_id))
  );

create policy "medicion_lectura" on medicion
  for select using (es_miembro_de(club_id));
create policy "medicion_escritura" on medicion
  for all using (puede_operar(club_id)) with check (puede_operar(club_id));

create policy "sesion_lectura" on sesion_entrenamiento
  for select using (es_miembro_de(club_id));
create policy "sesion_escritura" on sesion_entrenamiento
  for all using (puede_operar(club_id)) with check (puede_operar(club_id));

create policy "asistencia_lectura" on sesion_asistencia
  for select using (
    sesion_id in (select id from sesion_entrenamiento where es_miembro_de(club_id))
  );
create policy "asistencia_escritura" on sesion_asistencia
  for all using (
    sesion_id in (select id from sesion_entrenamiento where puede_operar(club_id))
  ) with check (
    sesion_id in (select id from sesion_entrenamiento where puede_operar(club_id))
  );

-- ============================================================
-- SEEDS DE REFERENCIA del catálogo global de atributos físicos.
-- Ejecutar con service role al implementar (el catálogo no tiene
-- UI de administración en el MVP). Nótese el uso de `sentido`.
-- ============================================================
-- insert into atributo (nombre, ambito, naturaleza, unidad, escala_min, escala_max, sentido, protocolo) values
--   ('Talla',          'fisico', 'objetivo', 'cm',      50,  220, null,          'Descalzo, contra pared, con tallímetro'),
--   ('Peso',           'fisico', 'objetivo', 'kg',      10,  150, null,          'Balanza, ropa liviana'),
--   ('Velocidad 30m',  'fisico', 'objetivo', 'segundos', 3,   10, 'menor_mejor', 'Sprint 30m, partida detenida, cronómetro'),
--   ('Salto vertical', 'fisico', 'objetivo', 'cm',       5,  100, 'mayor_mejor', 'Salto con contramovimiento, marca en pared'),
--   ('Resistencia',    'fisico', 'objetivo', 'metros', 400, 4000, 'mayor_mejor', 'Test de Cooper (12 minutos)');

-- ⚠ v5: catálogo técnico de FÚTBOL (apreciación 1-10 del entrenador,
-- naturaleza 'subjetivo'). Requiere el id de la disciplina Fútbol.
-- "Experiencia" y "Estado físico" quedan afuera a propósito: se
-- derivarán de sesiones/asistencia, no se cargan a mano.
-- insert into atributo (disciplina_id, nombre, ambito, naturaleza, unidad, escala_min, escala_max, sentido, protocolo) values
--   (:futbol_id, 'Pases',            'tecnico', 'subjetivo', 'escala', 1, 10, 'mayor_mejor', 'Precisión y criterio en el pase corto'),
--   (:futbol_id, 'Pases largos',     'tecnico', 'subjetivo', 'escala', 1, 10, 'mayor_mejor', 'Pase aéreo y centro: distancia y precisión'),
--   (:futbol_id, 'Remates',          'tecnico', 'subjetivo', 'escala', 1, 10, 'mayor_mejor', 'Precisión y potencia del remate al arco'),
--   (:futbol_id, 'Cabezazos',        'tecnico', 'subjetivo', 'escala', 1, 10, 'mayor_mejor', 'Juego aéreo: pase y definición de cabeza'),
--   (:futbol_id, 'Control de balón', 'tecnico', 'subjetivo', 'escala', 1, 10, 'mayor_mejor', 'Control al recibir y conducción'),
--   (:futbol_id, 'Entradas',         'tecnico', 'subjetivo', 'escala', 1, 10, 'mayor_mejor', 'Presión y quite en el 1 contra 1'),
--   (:futbol_id, 'Atajando',         'tecnico', 'subjetivo', 'escala', 1, 10, 'mayor_mejor', 'Arqueros: atajadas, anticipo y decisiones'),
--   (:futbol_id, 'Balón parado',     'tecnico', 'subjetivo', 'escala', 1, 10, 'mayor_mejor', 'Córners, tiros libres y penales'),
--   (:futbol_id, 'Visión de juego',  'tecnico', 'subjetivo', 'escala', 1, 10, 'mayor_mejor', 'Lectura del juego y pases posibles que detecta');

-- ============================================================
-- ⚠ PROPUESTA v6 (2026-07-09, pendiente de decisión — NO incluida
-- en el DDL de arriba): alcance por categoría para entrenadores.
-- Matriz completa en docs/PERFILES.md. Racional: minimización de
-- datos de menores — un profe de escuelita no necesita las fichas
-- de Primera. El prototipo ya lo refleja en la UI (PROFE_DEMO).
-- ============================================================
-- create table membresia_categoria (
--   membresia_id  uuid not null references membresia(id) on delete cascade,
--   categoria_id  uuid not null references categoria(id) on delete cascade,
--   creado_en     timestamptz not null default now(),
--   primary key (membresia_id, categoria_id)
-- );
-- alter table membresia_categoria enable row level security;
--
-- Helper: ¿el usuario tiene la categoría asignada (o es admin/comisión,
-- que ven todo el club)?
-- create or replace function alcanza_categoria(p_club uuid, p_categoria uuid)
-- returns boolean language sql stable security definer set search_path = public
-- as $$
--   select exists (
--     select 1 from membresia m
--     where m.club_id = p_club and m.auth_user_id = auth.uid()
--       and (
--         m.rol in ('admin_club','comision_directiva')
--         or exists (select 1 from membresia_categoria mc
--                    where mc.membresia_id = m.id
--                      and mc.categoria_id = p_categoria)
--       )
--   )
-- $$;
--
-- Cambio de policies asociado (esbozado): en deportista, medicion,
-- sesion_entrenamiento y asistencia, el SELECT del entrenador pasa de
-- es_miembro_de(club_id) a alcanza_categoria(club_id, categoria_id)
-- (en medicion vía join a deportista o denormalizando categoria_id);
-- la escritura sigue exigiendo puede_operar() Y alcance de categoría.
-- Decidir antes de conectar Supabase.