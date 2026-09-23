-- ============================================================
-- Restituye "una cuenta = un club" (T-002B).
--
-- Qué pasó: `20260922090000` hizo
--     alter table membresia drop constraint if exists membresia_auth_user_id_key;
-- para permitir que una persona tuviera membresía en un club Y en la
-- Secretaría a la vez. Eso revierte una decisión P0 tomada el 2026-09-13,
-- y lo hacía de costado, como efecto colateral de una migración cuyo tema
-- era otro.
--
-- Revisado el caso real: el Espacio Secretaría lo opera una CUENTA PRIVADA
-- DEDICADA (secretaria@evolucionantoniana.com), que no tiene ni va a tener
-- membresía en ningún club. O sea que la ampliación no hacía falta.
--
-- Como las migraciones ya aplicadas no se reescriben, esta la vuelve a
-- poner al final. Es convergente: si la constraint ya está, no hace nada.
--
-- Por qué importa que esté: los lookups de membresía de la app resuelven
-- sin filtrar por club. Con dos filas se rompen EN SILENCIO — devuelven
-- cualquiera de las dos. El selector de espacios (`/api/contextos`) ya
-- existe, pero mientras no haya un caso real que lo necesite, la garantía
-- fuerte es preferible a la flexibilidad no usada.
--
-- PARA LEVANTARLA (si algún día una persona debe trabajar en dos espacios):
--   alter table membresia drop constraint membresia_auth_user_id_key;
-- Es instantáneo y no toca datos. Pero antes hay que verificar que TODOS
-- los lookups elijan membresía activa explícitamente, no con el primero
-- que venga.
-- ============================================================

-- No la agregamos a ciegas: si hay una cuenta con dos membresías, la
-- constraint fallaría con un mensaje de índice que no dice nada útil.
do $$
declare v_det text;
begin
  select string_agg(format('%s (%s membresías)', email, n), ', ')
    into v_det
  from (
    select min(email) as email, auth_user_id, count(*) as n
    from membresia
    where auth_user_id is not null
    group by auth_user_id
    having count(*) > 1
  ) t;
  if v_det is not null then
    raise exception
      'Hay cuentas con más de una membresía: %. Resolvelas (o decidí NO restituir la constraint) antes de aplicar esta migración.', v_det;
  end if;
end $$;

alter table membresia drop constraint if exists membresia_auth_user_id_key;
alter table membresia add constraint membresia_auth_user_id_key unique (auth_user_id);

comment on constraint membresia_auth_user_id_key on membresia is
  'T-002B, restituida por 20260923140000 tras la apertura de 20260922090000. Una cuenta = un club/espacio. La Secretaría se opera con una cuenta dedicada, así que la apertura no hacía falta. Los lookups de membresía resuelven sin filtrar por club: dos filas los rompen en silencio. Ver docs/PLAN_CTO_PRIORIZADO.md.';
