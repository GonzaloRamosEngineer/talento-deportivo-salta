-- =============================================================
-- OBSERVATORIO PROVINCIAL — agregados de solo lectura (Ola 1)
-- ⚠ REQUIERE REVISIÓN MANUAL antes de aplicar: define la ÚNICA
--   ventana de la plataforma hacia los datos de los clubes.
--
-- Regla de diseño (docs/PERFILES.md): el perfil plataforma NUNCA
-- accede a datos individuales. El RLS ya le da 0 filas en todas las
-- tablas y eso NO cambia acá. Esta función security definer es la
-- única puerta, y devuelve exclusivamente TOTALES por club: ningún
-- nombre, ninguna fecha de nacimiento, ninguna medición individual.
-- Cualquier columna que se agregue en el futuro debe seguir siendo
-- un agregado.
-- =============================================================

-- Ubicación del club en el mapa IGN del observatorio (nombre oficial
-- del departamento, ej. 'Capital', 'Cerrillos'). La carga por ahora
-- es de la plataforma vía service role, junto con el alta del club.
alter table club add column if not exists departamento text;

-- ¿El usuario autenticado es el perfil plataforma? (sin fila en
-- membresia a propósito: se identifica por app_metadata, que solo
-- se escribe con service role — el usuario no puede autoasignárselo)
create or replace function es_plataforma()
returns boolean
language sql stable
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'plataforma')::boolean,
    false
  )
$$;

-- Totales por club para el observatorio. security definer para poder
-- agregar por encima del RLS, con search_path fijado (linter Supabase)
-- y el gate es_plataforma() DENTRO de la función: cualquier otro rol
-- recibe 0 filas, igual que con RLS.
create or replace function observatorio_clubes()
returns table (
  id                 uuid,
  nombre             text,
  localidad          text,
  departamento       text,
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

-- Sin ejecución anónima: el observatorio es de la plataforma logueada.
revoke execute on function observatorio_clubes() from public, anon;
grant execute on function observatorio_clubes() to authenticated;
