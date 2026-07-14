-- ============================================================
-- Módulo A (negocio/10) — Tablero de entrenamiento con
-- persistencia real.
--
-- La planificación por jugador (a qué estación/área de trabajo va
-- cada uno) CUELGA de la sesión del día (sesion_entrenamiento); no
-- crea un mundo aparte con fecha propia. Misma integración con la
-- agenda que la asistencia: una sesión virtual (generada del
-- cronograma) se materializa recién al guardar el tablero, igual
-- que al pasar lista.
--
-- ⚠ REQUIERE REVISIÓN MANUAL (regla de CLAUDE.md): agrega una
-- tabla con RLS sobre datos de menores.
-- ============================================================

create table sesion_asignacion (
  sesion_id     uuid not null references sesion_entrenamiento(id) on delete cascade,
  deportista_id uuid not null references deportista(id) on delete cascade,
  atributo_id   uuid not null references atributo(id) on delete restrict, -- la estación/área de trabajo
  club_id       uuid not null references club(id) on delete cascade,      -- denormalizado (regla 6); lo fija el trigger
  creado_en     timestamptz not null default now(),
  primary key (sesion_id, deportista_id)   -- un jugador, una sola estación por sesión
);

-- club_id denormalizado desde la sesión padre (mismo patrón que
-- medicion.club_id — regla 6): el cliente nunca lo setea, lo pisa
-- el trigger antes de insertar/actualizar.
create or replace function fn_set_club_id_sesion_asignacion()
returns trigger language plpgsql
security definer set search_path = public
as $$
begin
  select club_id into new.club_id
  from sesion_entrenamiento where id = new.sesion_id;
  return new;
end; $$;
create trigger trg_sesion_asignacion_club_id
  before insert or update on sesion_asignacion
  for each row execute function fn_set_club_id_sesion_asignacion();

alter table sesion_asignacion enable row level security;

-- Lectura: quien ALCANZA la categoría de la sesión (admin_club y
-- comisión ven todo el club; el entrenador solo sus categorías).
-- Escritura: quien OPERA esa categoría (comisión directiva nunca).
-- Mismo patrón exacto que sesion_asistencia: se resuelve contra la
-- sesión padre. El club_id denormalizado no se usa en las policies
-- (existe para queries/agregados directos, como en medicion).
create policy "asignacion_lectura" on sesion_asignacion
  for select using (
    sesion_id in (select id from sesion_entrenamiento
                  where alcanza_categoria(club_id, categoria_id))
  );
create policy "asignacion_escritura" on sesion_asignacion
  for all using (
    sesion_id in (select id from sesion_entrenamiento
                  where opera_categoria(club_id, categoria_id))
  ) with check (
    sesion_id in (select id from sesion_entrenamiento
                  where opera_categoria(club_id, categoria_id))
  );

create index idx_sesion_asignacion_club on sesion_asignacion(club_id);
create index idx_sesion_asignacion_deportista on sesion_asignacion(deportista_id);
