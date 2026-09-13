-- ============================================================
-- T-002B · "Una cuenta = un club" para el MVP.
--
-- `membresia` tenía `unique (club_id, auth_user_id)`: unicidad POR CLUB,
-- no por usuario. O sea que la base ya permitía que una misma cuenta
-- tuviera membresía en dos clubes.
--
-- Nadie lo usó nunca, pero la aplicación no está preparada para eso y
-- falla EN SILENCIO: tres lookups resuelven la membresía sin filtrar por
-- club y con `.maybeSingle()` (lib/use-club.ts, components/perfil-context.tsx,
-- adminActual() en app/club/staff/actions.ts). Con dos filas PostgREST
-- devuelve 2, `.maybeSingle()` falla y `data` queda null; el fallback de
-- perfil-context degrada el perfil a "profesor" con sesión real y sin
-- categorías, mientras adminActual() lo rechaza en todas las server
-- actions. Bloqueo total, sin un solo mensaje que lo explique.
--
-- NO es un bypass de RLS: el alcance de los datos lo sigue gobernando
-- `membresia_categoria` en el server. Es rotura funcional, no fuga.
--
-- Decisión de MVP, REVERSIBLE y no un límite del modelo: en Salta un
-- preparador físico puede trabajar en dos clubes. Cuando el piloto lo
-- pida, esto se levanta y se reemplaza por selector de club + membresía
-- activa explícita + server actions que reciban y validen el club activo.
--
-- La cuenta de plataforma NO tiene fila en `membresia` (regla #4 de
-- CLAUDE.md), así que esta constraint no la afecta.
--
-- Pre-flight ejecutado contra la base real el 2026-09-13 con
-- scripts/preflight-una-cuenta-un-club.mjs: 17 membresías, 17 usuarios
-- distintos, 0 en más de un club. Se aplica sin migrar datos.
-- ============================================================

-- La unicidad por usuario IMPLICA la de (club_id, auth_user_id), así que
-- la anterior queda redundante. Se deja igual: es la que hay que
-- restaurar si algún día se revierte esta decisión, y borrarla no aporta
-- nada más que riesgo.

alter table membresia
  add constraint membresia_auth_user_id_key unique (auth_user_id);

comment on constraint membresia_auth_user_id_key on membresia is
  'T-002B: una cuenta = un club (decisión de MVP, reversible). Los lookups de membresía de la app resuelven sin filtrar por club y con maybeSingle(); dos filas los rompen en silencio. Ver docs/PLAN_CTO_PRIORIZADO.md.';
