-- ============================================================
-- Habilitar Evaluaciones en producción sin aflojar el aislamiento.
--
-- Hasta hoy el módulo estaba cerrado por ENTORNO: el server se negaba a
-- operar si el proyecto era el productivo. Eso se levanta en el código
-- (ver lib/evaluaciones/backend.ts). El problema de quitar una compuerta
-- es que lo que quedaba detrás nunca se probó sola, así que esta
-- migración pone en la BASE la garantía que el server ya promete:
--
--   ninguna cuenta de la vitrina pública puede ser miembro de una
--   organización de tipo `secretaria`.
--
-- Vive acá y no solo en TypeScript porque una guarda de server se saltea
-- con la service key, y los scripts de seed usan service key.
-- ============================================================

-- ---------- Quién es "cuenta demo", en un solo lugar ----------
create or replace function es_cuenta_demo(p_auth_user_id uuid)
returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_auth_user_id
      and (
        coalesce(u.raw_app_meta_data->>'demo', 'false') = 'true'
        or lower(u.email) like '%@demo.talento.ar'
        or lower(u.email) like '%.demo.local'
      )
  );
$$;

comment on function es_cuenta_demo(uuid) is
  'T-003/Evaluaciones: identifica las cuentas de la vitrina pública. Mira app_metadata.demo (solo escribible con service role) Y el dominio del email, para que la contención no dependa de que el flag se haya aplicado.';

revoke execute on function es_cuenta_demo(uuid) from anon, authenticated;

-- ---------- La regla ----------
create or replace function membresia_sin_demo_en_secretaria()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_tipo text;
begin
  select tipo_organizacion into v_tipo from club where id = new.club_id;
  if v_tipo is distinct from 'secretaria' then
    return new;
  end if;
  if es_cuenta_demo(new.auth_user_id) then
    raise exception 'TDS:CUENTA_DEMO Las cuentas de la demo no pueden pertenecer a un Espacio Secretaría.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_membresia_sin_demo_en_secretaria on membresia;
create trigger trg_membresia_sin_demo_en_secretaria
  before insert or update of club_id, auth_user_id on membresia
  for each row execute function membresia_sin_demo_en_secretaria();

comment on trigger trg_membresia_sin_demo_en_secretaria on membresia is
  'Impide dar acceso a Evaluaciones a una cuenta de la vitrina. Se dispara también en UPDATE: mover una membresía demo a la Secretaría es el mismo agujero que crearla ahí.';

-- ---------- Convergencia: nada demo debe estar ya adentro ----------
do $$
declare v_n int;
begin
  select count(*) into v_n
  from membresia m join club c on c.id = m.club_id
  where c.tipo_organizacion = 'secretaria' and es_cuenta_demo(m.auth_user_id);
  if v_n > 0 then
    raise exception 'Hay % membresías demo en un Espacio Secretaría. Resolvelas antes de aplicar esta migración.', v_n;
  end if;
end $$;
