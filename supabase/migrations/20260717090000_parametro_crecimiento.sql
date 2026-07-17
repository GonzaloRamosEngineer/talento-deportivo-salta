-- Parámetros globales del Módulo D ("el estirón"), curados centralmente
-- (misma filosofía que disciplina/atributo: catálogo GLOBAL, sin club_id).
-- La plataforma los edita por pantalla (/plataforma/parametros) vía
-- server action con service role; ningún rol de club escribe acá.
--
-- Singleton: PK boolean con check → la tabla no puede tener más de una
-- fila. Leerla es `select * ... limit 1` sin ambigüedad.
--
-- REQUIERE REVISIÓN MANUAL (cambio de esquema + RLS).

create table parametro_crecimiento (
  id boolean primary key default true check (id),
  -- umbral de "crecimiento acelerado" en cm/año, por sexo (el pico
  -- puberal femenino es más temprano y algo menor). Valores base
  -- pendientes de revisión del PF de la Fundación.
  umbral_aceleracion_m numeric not null default 7 check (umbral_aceleracion_m between 3 and 15),
  umbral_aceleracion_f numeric not null default 6.5 check (umbral_aceleracion_f between 3 and 15),
  -- separación mínima (días) entre las dos mediciones de un tramo:
  -- con menos días, el error del tallímetro anualizado fabrica
  -- velocidades absurdas.
  min_dias_tramo integer not null default 90 check (min_dias_tramo between 30 and 365),
  actualizado_en timestamptz not null default now(),
  -- quién lo tocó por última vez (email del perfil plataforma; audit).
  actualizado_por text
);

insert into parametro_crecimiento default values;

alter table parametro_crecimiento enable row level security;

-- Lectura: cualquier usuario con sesión (la card "El estirón" y las
-- zonas de la curva los leen desde el club). Escritura: NADIE por RLS
-- — solo la server action de plataforma con service role, gateada por
-- app_metadata.plataforma (mismo patrón que /plataforma/clubes).
create policy parametro_crecimiento_lectura
  on parametro_crecimiento for select
  to authenticated
  using (true);
