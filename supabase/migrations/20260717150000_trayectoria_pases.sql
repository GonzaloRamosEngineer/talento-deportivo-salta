-- ============================================================
-- Trayectoria del deportista + registro de pases entre clubes.
--
-- deportista_hito: los eventos institucionales de la trayectoria —
-- ingreso al club, promociones de categoría, debut en Primera, pase
-- de salida a otro club, otros. Habilita la métrica "cuánto tardó de
-- escuelita a Primera" y el historial visual de la ficha/informe.
--
-- El PASE NO MUEVE DATOS: es un hito de salida que registra el club
-- de origen. El destino es TEXTO LIBRE a propósito (sin FK a club):
-- no insinúa vínculo de datos y la mayoría de los clubes destino no
-- están en la plataforma. Los datos del menor quedan donde estaban.
--
-- ⚠ REQUIERE REVISIÓN MANUAL (esquema + RLS + datos de menores +
--   recreación de la única ventana de la plataforma).
-- ============================================================

create table deportista_hito (
  id            uuid primary key default gen_random_uuid(),
  deportista_id uuid not null references deportista(id) on delete cascade,
  -- denormalizado por trigger desde deportista (regla 6, como medicion)
  club_id       uuid not null references club(id) on delete cascade,
  tipo          text not null check (tipo in
                  ('ingreso', 'promocion', 'debut_primera', 'pase_salida', 'otro')),
  fecha         date not null,
  -- Promoción: snapshot de TEXTO siempre (sobrevive al borrado de la
  -- categoría) + FK nullable para navegar mientras exista.
  categoria_origen_id      uuid references categoria(id) on delete set null,
  categoria_destino_id     uuid references categoria(id) on delete set null,
  categoria_origen_nombre  text,
  categoria_destino_nombre text,
  -- Pase de salida: destino en texto libre, SIN FK a club (ver arriba).
  club_destino_nombre      text,
  detalle       text check (length(detalle) <= 300),
  registrado_por uuid references membresia(id) on delete set null,
  creado_en     timestamptz not null default now(),
  -- Un hito de cada tipo por deportista/día: corregir = actualizar,
  -- no duplicar (regla 7 por analogía).
  unique (deportista_id, tipo, fecha),
  check (tipo <> 'promocion' or categoria_destino_nombre is not null),
  check (tipo <> 'pase_salida' or club_destino_nombre is not null)
);

-- Ingreso y debut en Primera: una sola vez en la vida del registro.
create unique index uq_hito_ingreso on deportista_hito (deportista_id)
  where tipo = 'ingreso';
create unique index uq_hito_debut on deportista_hito (deportista_id)
  where tipo = 'debut_primera';

create index idx_deportista_hito_dep on deportista_hito (deportista_id, fecha);
create index idx_deportista_hito_club on deportista_hito (club_id, tipo, fecha);

-- club_id denormalizado desde deportista (patrón de sesion_asignacion)
create or replace function fn_set_club_id_deportista_hito()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select club_id into new.club_id from deportista where id = new.deportista_id;
  return new;
end;
$$;

create trigger trg_deportista_hito_club_id
  before insert or update of deportista_id on deportista_hito
  for each row execute function fn_set_club_id_deportista_hito();

alter table deportista_hito enable row level security;

-- Alcance heredado vía el deportista (patrón tutor/consentimiento):
-- lectura = quien alcanza su categoría; escritura/borrado = quien la
-- opera. Con categoria_id null (caso residual) solo admin + comisión
-- leen (decisión v6 vigente). La baja por pase deja categoria_id
-- INTACTA (solo activo=false), así el profe sigue viendo el hito.
create policy "hito_lectura" on deportista_hito
  for select using (
    deportista_id in (select id from deportista
                      where alcanza_categoria(club_id, categoria_id))
  );
create policy "hito_escritura" on deportista_hito
  for all using (
    deportista_id in (select id from deportista
                      where opera_categoria(club_id, categoria_id))
  ) with check (
    deportista_id in (select id from deportista
                      where opera_categoria(club_id, categoria_id))
  );

-- ---------- Observatorio: pases informados (últimos 12 meses) ----------
-- Agregado nuevo de la ÚNICA ventana de la plataforma: total de pases
-- de SALIDA registrados por cada club. Sin nombres, como siempre.
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
  ultima_medicion    date,
  pases_12m          int
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
      where m.club_id = c.id),
    (select count(*)::int
       from deportista_hito h
      where h.club_id = c.id
        and h.tipo = 'pase_salida'
        and h.fecha >= current_date - 365)
  from club c
  where es_plataforma()
  order by c.nombre
$$;

revoke execute on function observatorio_clubes() from public, anon;
grant execute on function observatorio_clubes() to authenticated;
