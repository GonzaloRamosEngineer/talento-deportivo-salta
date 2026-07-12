-- ============================================================
-- OLA 1 — MVP — migración inicial (2026-07-12)
-- Consolida docs/01_ola1_mvp.sql:
--   v5: cohortes por año de nacimiento, rol comision_directiva
--       (consulta pura) + puede_operar()
--   v6: alcance por categoría del entrenador (membresia_categoria
--       + alcanza_categoria / opera_categoria) — APROBADA 2026-07-12
--   v7: agenda real (lugar, horario_entrenamiento, estado de sesión,
--       partido + citaciones) — APROBADA 2026-07-12
-- Matriz de acceso: docs/PERFILES.md (fuente de verdad).
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
-- disciplina_id null = físico/global, común a todas las disciplinas.
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
  unidad        text not null default 'escala',  -- 'escala','segundos','cm','kg','metros'
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
  rol           text not null default 'entrenador'
                check (rol in ('admin_club','entrenador','comision_directiva')),
  creado_en     timestamptz not null default now(),
  unique (club_id, auth_user_id)
);

-- ---------- MEMBRESÍA↔CATEGORÍA (v6 — alcance del entrenador) ----------
-- Minimización de datos de menores: un profe de escuelita no accede
-- a las fichas de Primera. admin_club y comision_directiva ven todo
-- el club (no necesitan filas acá).
create table membresia_categoria (
  membresia_id  uuid not null references membresia(id) on delete cascade,
  categoria_id  uuid not null references categoria(id) on delete cascade,
  creado_en     timestamptz not null default now(),
  primary key (membresia_id, categoria_id)
);

-- ---------- Helpers de RLS ----------
-- search_path fijado: obligatorio en security definer para impedir
-- que un search_path manipulado resuelva objetos ajenos con
-- privilegios elevados (lo marca el linter de Supabase).

-- ¿El usuario autenticado es miembro de este club? (cualquier rol)
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

-- ¿Puede cargar/editar la operación diaria? (excluye a comisión
-- directiva, que es consulta pura)
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

-- v6 — ¿VE datos de esta categoría? admin_club y comision_directiva
-- ven todo el club; el entrenador solo sus categorías asignadas.
-- Con p_categoria null (deportista/sesión sin categoría) solo
-- acceden admin y comisión — decisión consciente de minimización.
create or replace function alcanza_categoria(p_club uuid, p_categoria uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from membresia m
    where m.club_id = p_club and m.auth_user_id = auth.uid()
      and (
        m.rol in ('admin_club','comision_directiva')
        or exists (select 1 from membresia_categoria mc
                   where mc.membresia_id = m.id
                     and mc.categoria_id = p_categoria)
      )
  )
$$;

-- v6 — ¿OPERA (escribe) sobre esta categoría? admin_club todo el
-- club; entrenador solo sus categorías; comisión directiva nunca.
create or replace function opera_categoria(p_club uuid, p_categoria uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from membresia m
    where m.club_id = p_club and m.auth_user_id = auth.uid()
      and (
        m.rol = 'admin_club'
        or (m.rol = 'entrenador' and exists (
              select 1 from membresia_categoria mc
              where mc.membresia_id = m.id
                and mc.categoria_id = p_categoria))
      )
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
returns trigger language plpgsql
security definer set search_path = public
as $$
begin
  select club_id into new.club_id from deportista where id = new.deportista_id;
  return new;
end; $$;
create trigger trg_medicion_club_id
  before insert or update on medicion
  for each row execute function fn_set_club_id_medicion();

-- ---------- LUGAR (v7 — canchas/predios del club) ----------
create table lugar (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references club(id) on delete cascade,
  nombre    text not null,
  direccion text,
  creado_en timestamptz not null default now(),
  unique (club_id, nombre)
);

-- ---------- HORARIO (v7 — cronograma semanal fijo por categoría) ----------
-- La rutina estable por temporada. La sesión es la instancia de un
-- día; se crea prellenada desde acá.
create table horario_entrenamiento (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references club(id) on delete cascade,
  categoria_id uuid not null references categoria(id) on delete cascade,
  dia_semana   int  not null check (dia_semana between 1 and 7), -- 1=lunes
  hora         time not null,
  lugar_id     uuid references lugar(id) on delete set null,
  creado_en    timestamptz not null default now()
);

-- ---------- SESIÓN DE ENTRENAMIENTO (con estado y lugar, v7) ----------
create table sesion_entrenamiento (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references club(id) on delete cascade,
  categoria_id   uuid references categoria(id) on delete set null,
  responsable_id uuid references membresia(id) on delete set null,
  atributo_foco  uuid references atributo(id) on delete set null,
  fecha          timestamptz not null default now(),
  lugar_id       uuid references lugar(id) on delete set null,
  estado         text not null default 'programada'
                 check (estado in ('programada','realizada','cancelada')),
  descripcion    text,
  creado_en      timestamptz not null default now()
);

create table sesion_asistencia (
  sesion_id     uuid not null references sesion_entrenamiento(id) on delete cascade,
  deportista_id uuid not null references deportista(id) on delete cascade,
  presente      boolean not null default true,
  primary key (sesion_id, deportista_id)
);

-- ---------- PARTIDO (v7 — SOLO datos grupales) ----------
-- Sin estadísticas individuales de menores. En categorías tipo
-- 'escuelita' NO se registra resultado (regla de APLICACIÓN, no
-- constraint, para permitir excepciones conscientes del club).
create table partido (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references club(id) on delete cascade,
  categoria_id uuid not null references categoria(id) on delete cascade,
  fecha        timestamptz not null,
  torneo       text,                -- 'Liga Salteña — Infantiles', 'Amistoso'...
  rival        text not null,
  condicion    text not null check (condicion in ('local','visitante')),
  lugar_id     uuid references lugar(id) on delete set null, -- si es local
  lugar_texto  text,                -- si es visitante (cancha del rival)
  goles_favor  int,                 -- null en escuelitas (regla de app)
  goles_contra int,
  creado_en    timestamptz not null default now()
);

create table partido_citacion (
  partido_id    uuid not null references partido(id) on delete cascade,
  deportista_id uuid not null references deportista(id) on delete cascade,
  presente      boolean not null default true,
  primary key (partido_id, deportista_id)
);

-- ============================================================
-- ROW LEVEL SECURITY (escrita junto al DDL, no como anexo)
-- Matriz: docs/PERFILES.md. Reparto:
--   * Config institucional (club, membresías, categorías, lugares,
--     cronograma, asignaciones profe↔categoría) = solo admin_club.
--   * Operación diaria (deportistas, tutores, consentimientos,
--     mediciones, sesiones, partidos) = admin_club en todo el club,
--     entrenador SOLO en sus categorías asignadas (v6).
--   * comision_directiva = consulta pura de todo su club.
--   * Borrar deportistas (cascada sobre TODAS sus mediciones) =
--     solo admin_club.
-- El alta de clubes y la primera membresía siguen siendo por
-- service role (sin onboarding self-service en el MVP).
-- ============================================================
alter table club enable row level security;
alter table disciplina enable row level security;
alter table atributo enable row level security;
alter table categoria enable row level security;
alter table membresia enable row level security;
alter table membresia_categoria enable row level security;
alter table deportista enable row level security;
alter table tutor enable row level security;
alter table consentimiento enable row level security;
alter table medicion enable row level security;
alter table lugar enable row level security;
alter table horario_entrenamiento enable row level security;
alter table sesion_entrenamiento enable row level security;
alter table sesion_asistencia enable row level security;
alter table partido enable row level security;
alter table partido_citacion enable row level security;

-- Catálogo global: lectura para cualquier staff autenticado, sin
-- escritura (curaduría solo por service role — regla #2 de CLAUDE.md)
create policy "catalogo_disciplina_lectura" on disciplina
  for select using (auth.role() = 'authenticated');
create policy "catalogo_atributo_lectura" on atributo
  for select using (auth.role() = 'authenticated');

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

-- v6: las asignaciones profe↔categoría las ve todo el club y las
-- gestiona solo admin_club.
create policy "membresia_categoria_lectura" on membresia_categoria
  for select using (
    membresia_id in (select id from membresia where es_miembro_de(club_id))
  );
create policy "membresia_categoria_escritura" on membresia_categoria
  for all using (
    membresia_id in (select id from membresia where es_admin_de(club_id))
  ) with check (
    membresia_id in (select id from membresia where es_admin_de(club_id))
  );

-- La lista de categorías (nombres, sin datos personales) la ve todo
-- el staff del club; la gestiona solo admin_club.
create policy "categoria_lectura" on categoria
  for select using (es_miembro_de(club_id));
create policy "categoria_insert_admin" on categoria
  for insert with check (es_admin_de(club_id));
create policy "categoria_update_admin" on categoria
  for update using (es_admin_de(club_id)) with check (es_admin_de(club_id));
create policy "categoria_delete_admin" on categoria
  for delete using (es_admin_de(club_id));

-- v6: fichas de deportistas — lectura y escritura scoped por
-- categoría para el entrenador; admin todo; comisión solo lectura.
create policy "deportista_lectura" on deportista
  for select using (alcanza_categoria(club_id, categoria_id));
create policy "deportista_insert" on deportista
  for insert with check (opera_categoria(club_id, categoria_id));
create policy "deportista_update" on deportista
  for update using (opera_categoria(club_id, categoria_id))
  with check (opera_categoria(club_id, categoria_id));
create policy "deportista_delete_admin" on deportista
  for delete using (es_admin_de(club_id));

-- tutor/consentimiento heredan el alcance vía deportista.
create policy "tutor_lectura" on tutor
  for select using (
    deportista_id in (select id from deportista
                      where alcanza_categoria(club_id, categoria_id))
  );
create policy "tutor_escritura" on tutor
  for all using (
    deportista_id in (select id from deportista
                      where opera_categoria(club_id, categoria_id))
  ) with check (
    deportista_id in (select id from deportista
                      where opera_categoria(club_id, categoria_id))
  );

create policy "consentimiento_lectura" on consentimiento
  for select using (
    deportista_id in (select id from deportista
                      where alcanza_categoria(club_id, categoria_id))
  );
create policy "consentimiento_escritura" on consentimiento
  for all using (
    deportista_id in (select id from deportista
                      where opera_categoria(club_id, categoria_id))
  ) with check (
    deportista_id in (select id from deportista
                      where opera_categoria(club_id, categoria_id))
  );

-- v6: la medición hereda el alcance vía el deportista (su categoría
-- ACTUAL — el acceso es control de datos del chico, no histórico).
create policy "medicion_lectura" on medicion
  for select using (
    deportista_id in (select id from deportista
                      where alcanza_categoria(club_id, categoria_id))
  );
create policy "medicion_escritura" on medicion
  for all using (
    deportista_id in (select id from deportista
                      where opera_categoria(club_id, categoria_id))
  ) with check (
    deportista_id in (select id from deportista
                      where opera_categoria(club_id, categoria_id))
  );

-- v7: lugares y cronograma semanal — sin datos personales; lectura
-- de todo el club, gestión solo admin_club (matriz PERFILES.md).
create policy "lugar_lectura" on lugar
  for select using (es_miembro_de(club_id));
create policy "lugar_escritura" on lugar
  for all using (es_admin_de(club_id)) with check (es_admin_de(club_id));

create policy "horario_lectura" on horario_entrenamiento
  for select using (es_miembro_de(club_id));
create policy "horario_escritura" on horario_entrenamiento
  for all using (es_admin_de(club_id)) with check (es_admin_de(club_id));

-- v6: sesiones scoped por categoría para el entrenador.
create policy "sesion_lectura" on sesion_entrenamiento
  for select using (alcanza_categoria(club_id, categoria_id));
create policy "sesion_escritura" on sesion_entrenamiento
  for all using (opera_categoria(club_id, categoria_id))
  with check (opera_categoria(club_id, categoria_id));

create policy "asistencia_lectura" on sesion_asistencia
  for select using (
    sesion_id in (select id from sesion_entrenamiento
                  where alcanza_categoria(club_id, categoria_id))
  );
create policy "asistencia_escritura" on sesion_asistencia
  for all using (
    sesion_id in (select id from sesion_entrenamiento
                  where opera_categoria(club_id, categoria_id))
  ) with check (
    sesion_id in (select id from sesion_entrenamiento
                  where opera_categoria(club_id, categoria_id))
  );

-- v7: partidos — mismo patrón que sesiones (solo datos grupales).
create policy "partido_lectura" on partido
  for select using (alcanza_categoria(club_id, categoria_id));
create policy "partido_escritura" on partido
  for all using (opera_categoria(club_id, categoria_id))
  with check (opera_categoria(club_id, categoria_id));

create policy "citacion_lectura" on partido_citacion
  for select using (
    partido_id in (select id from partido
                   where alcanza_categoria(club_id, categoria_id))
  );
create policy "citacion_escritura" on partido_citacion
  for all using (
    partido_id in (select id from partido
                   where opera_categoria(club_id, categoria_id))
  ) with check (
    partido_id in (select id from partido
                   where opera_categoria(club_id, categoria_id))
  );
