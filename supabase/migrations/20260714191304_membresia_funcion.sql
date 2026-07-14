-- =============================================================
-- MEMBRESÍA: función/rol profesional (descriptivo).
--
-- `rol` (admin_club/entrenador/comision_directiva) gobierna el ACCESO
-- (RLS). `funcion` es ORTOGONAL y solo DESCRIPTIVO: qué profesional es
-- la persona dentro del cuerpo técnico — DT, ayudante de campo,
-- preparador físico, entrenador de arqueros, nutricionista, psicólogo,
-- asistente social, médico, kinesiólogo, coordinador… La formación es
-- integral: la plataforma registra QUIÉN acompaña al chico y en qué
-- rol, no solo la parte física.
--
-- Nullable y libre a propósito (la UI ofrece una lista sugerida): no
-- cambia ninguna policy ni el acceso. NO agrega datos del menor.
-- ⚠ Cambio de esquema aditivo; no toca RLS.
-- =============================================================

alter table membresia add column if not exists funcion text;
