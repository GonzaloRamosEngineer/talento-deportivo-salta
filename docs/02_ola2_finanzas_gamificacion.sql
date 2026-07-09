-- ============================================================
-- OLA 2 — Ejecutar SOBRE la Ola 1 (roadmap cercano)
-- NOTA: documento de roadmap, NO ejecutar en el MVP. Al implementar,
-- agregar RLS a todas las tablas (mismo patrón que Ola 1).
-- ============================================================

-- ---------- INVERSIÓN FORMATIVA (serie temporal, a nivel CLUB) ----------
-- Decisión 2026-07-05 (revisión pre-código): NO existe valorización
-- monetaria por deportista — poner un valor en pesos a un menor en
-- una base con visibilidad institucional es un riesgo legal, ético y
-- reputacional inaceptable. Lo que se registra es la INVERSIÓN del
-- club en formación, agregada por disciplina/categoría, nunca por
-- deportista. No agregar deportista_id a esta tabla.
create table inversion_formativa (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references club(id) on delete cascade,
  disciplina_id uuid references disciplina(id) on delete set null,
  categoria_id  uuid references categoria(id) on delete set null,
  monto         numeric(14,2) not null,
  moneda        text not null default 'ARS',
  concepto      text,          -- 'entrenadores','equipamiento','viajes'...
  fecha         date not null default current_date,
  creado_en     timestamptz not null default now()
);
create index idx_inversion_club_fecha on inversion_formativa (club_id, fecha);

-- ---------- MOVIMIENTO FINANCIERO (por área/disciplina) ----------
create table movimiento_financiero (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references club(id) on delete cascade,
  disciplina_id uuid references disciplina(id) on delete set null,  -- área
  deportista_id uuid references deportista(id) on delete set null,  -- opcional: costo/ingreso ligado a jugador
  tipo          text not null check (tipo in ('ingreso','egreso')),
  categoria     text,          -- 'cuota','sueldo','indumentaria','sponsor','transferencia'...
  monto         numeric(14,2) not null,
  moneda        text not null default 'ARS',
  fecha         date not null default current_date,
  descripcion   text,
  creado_en     timestamptz not null default now()
);
create index idx_mov_club_fecha on movimiento_financiero (club_id, fecha);

-- ---------- LOGROS / GAMIFICACIÓN ----------
create table logro (
  id            uuid primary key default gen_random_uuid(),
  disciplina_id uuid references disciplina(id) on delete cascade,
  nombre        text not null,
  descripcion   text,
  criterio      jsonb,         -- regla flexible (ej. {"atributo":"Velocidad","mejora":2})
  creado_en     timestamptz not null default now()
);

create table deportista_logro (
  deportista_id uuid not null references deportista(id) on delete cascade,
  logro_id      uuid not null references logro(id) on delete cascade,
  obtenido_en   timestamptz not null default now(),
  primary key (deportista_id, logro_id)
);