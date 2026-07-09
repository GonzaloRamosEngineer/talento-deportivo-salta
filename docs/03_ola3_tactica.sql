-- ============================================================
-- OLA 3 — Ejecutar SOBRE Olas 1 y 2 (roadmap lejano)
-- ============================================================

create table tactica (
  id            uuid primary key default gen_random_uuid(),
  categoria_id  uuid references categoria(id) on delete cascade,
  nombre        text not null,       -- 'Titular', 'vs rival X'...
  formacion     text,                -- '4-4-2'...
  estilo        text,                -- 'ofensivo'/'normal'/'defensivo'
  creado_en     timestamptz not null default now()
);

create table tactica_posicion (
  id            uuid primary key default gen_random_uuid(),
  tactica_id    uuid not null references tactica(id) on delete cascade,
  deportista_id uuid references deportista(id) on delete set null,
  posicion      text not null,       -- 'ARQ','DEF','MED','DEL'...
  pos_x         numeric(5,2),        -- coords en el campo (0-100)
  pos_y         numeric(5,2)
);