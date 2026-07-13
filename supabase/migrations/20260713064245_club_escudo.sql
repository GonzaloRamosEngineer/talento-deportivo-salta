-- =============================================================
-- CLUB: escudo (imagen institucional) + alta por pantalla (Ola 1.5)
-- ⚠ REQUIERE REVISIÓN MANUAL: toca la tabla club, el bucket de
--   Storage y la RPC del observatorio.
--
-- Modelo (docs/OPERACION.md, pasos 1-2): el alta de clubes y del
-- primer admin sigue siendo EXCLUSIVA de la plataforma vía service
-- role — esta migración NO agrega ninguna policy de INSERT sobre
-- club ni membresia. Lo único nuevo:
--   * club.escudo_url: URL pública del escudo (bucket 'escudos').
--   * bucket 'escudos': lectura pública (el escudo es la cara
--     institucional del club, no es dato personal); SIN policies de
--     escritura → solo el service role puede subir/borrar.
--   * observatorio_clubes(): devuelve también el escudo (sigue
--     siendo un dato institucional agregado, nunca individual).
-- =============================================================

alter table club add column if not exists escudo_url text;

-- Bucket público de escudos: 2MB máximo, solo imágenes. La lectura
-- pública es por diseño; la escritura queda sin policy (service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'escudos',
  'escudos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- La RPC cambia su tipo de retorno (columna nueva) → drop + create.
drop function if exists observatorio_clubes();

create or replace function observatorio_clubes()
returns table (
  id                 uuid,
  nombre             text,
  localidad          text,
  departamento       text,
  escudo_url         text,
  deportistas        int,
  mediciones_30d     int,
  consentimiento_pct int,
  categorias_activas int,
  ultima_medicion    date
)
language sql stable security definer
set search_path = public
as $$
  select
    c.id,
    c.nombre,
    c.localidad,
    c.departamento,
    c.escudo_url,
    (select count(*)::int
       from deportista d
      where d.club_id = c.id and d.activo),
    (select count(*)::int
       from medicion m
      where m.club_id = c.id
        and m.fecha >= current_date - 30),
    coalesce((
      select round(
               100.0 * count(*) filter (where exists (
                 select 1 from consentimiento k
                  where k.deportista_id = d.id
                    and k.otorgado
                    and k.revocado_en is null))
               / nullif(count(*), 0)
             )::int
        from deportista d
       where d.club_id = c.id and d.activo
    ), 0),
    (select count(distinct d.categoria_id)::int
       from deportista d
      where d.club_id = c.id and d.activo and d.categoria_id is not null),
    (select max(m.fecha)
       from medicion m
      where m.club_id = c.id)
  from club c
  where es_plataforma()
  order by c.nombre
$$;

revoke execute on function observatorio_clubes() from public, anon;
grant execute on function observatorio_clubes() to authenticated;
