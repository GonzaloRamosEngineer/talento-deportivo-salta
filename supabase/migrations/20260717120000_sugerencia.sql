-- Circuito de sugerencias sobre las guías del catálogo (sesión C de
-- negocio/10): el staff de un club propone agregar/modificar/eliminar
-- contenido de una guía ("¿Cómo medir?" / ideas de trabajo); la
-- plataforma (Secretaría/Liga) cura en su bandeja y resuelve. El
-- contenido en sí NO cambia por acá: sigue siendo curaduría central
-- (lib/como-medir.ts) — esta tabla registra el pedido y su estado.
--
-- Modelo de acceso (REQUIERE REVISIÓN MANUAL — tabla nueva + RLS):
--   · No contiene datos de deportistas: solo texto de un adulto del
--     staff sobre contenido metodológico.
--   · INSERT: cualquier miembro del club, SOLO a nombre de su propia
--     membresía y su propio club.
--   · SELECT: únicamente el autor (el profe ve el estado de las suyas).
--   · DELETE: el autor, solo mientras esté pendiente (retirarla).
--   · UPDATE: NADIE por RLS. La plataforma resuelve vía server action
--     con service role gateada por app_metadata.plataforma (mismo
--     patrón que /plataforma/clubes) — el RLS de plataforma sigue
--     siendo 0 filas en todo.

create table sugerencia (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id) on delete cascade,
  membresia_id uuid not null references membresia(id) on delete cascade,
  -- nombre de la guía/atributo del catálogo global sobre la que sugiere
  guia text not null check (length(guia) between 2 and 80),
  tipo text not null check (tipo in ('agregar', 'modificar', 'eliminar')),
  texto text not null check (length(texto) between 10 and 2000),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'rechazada')),
  -- nota opcional de la plataforma al resolver (la ve el autor)
  respuesta text check (length(respuesta) <= 1000),
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz
);

create index sugerencia_estado_idx on sugerencia (estado, creado_en desc);

alter table sugerencia enable row level security;

create policy sugerencia_insert_propia
  on sugerencia for insert
  to authenticated
  with check (
    es_miembro_de(club_id)
    and membresia_id in (
      select id from membresia where auth_user_id = (select auth.uid())
    )
  );

create policy sugerencia_select_autor
  on sugerencia for select
  to authenticated
  using (
    membresia_id in (
      select id from membresia where auth_user_id = (select auth.uid())
    )
  );

create policy sugerencia_delete_autor_pendiente
  on sugerencia for delete
  to authenticated
  using (
    estado = 'pendiente'
    and membresia_id in (
      select id from membresia where auth_user_id = (select auth.uid())
    )
  );
