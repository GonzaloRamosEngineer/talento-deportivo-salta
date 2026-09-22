-- ============================================================
-- Correcciones necesarias para que 20260922091000 (catálogo)
-- pueda aplicarse. Va DELIBERADAMENTE entre 090000 y 091000.
--
-- 1) numeric(6,2) tiene techo 9999.99. El catálogo declara la fuerza
--    pico de aterrizaje con escala_max 20000 y aborta con
--    "numeric field overflow": sin esto, la migración de catálogo NO
--    se aplica. Además medicion.valor comparte el techo, y los nueve
--    archivos recibidos ya llegan a 9698 N (MMA) y 8964 N (atletismo):
--    entran con 3% de margen y la próxima jornada de adultos desborda,
--    abortando la transacción entera de importación.
--
-- 2) La disciplina Fútbol solo existía en supabase/seed.sql, que no es
--    una migración y que el procedimiento de puesta en marcha no manda
--    correr. En una base limpia, confirmar_lote_evaluacion falla con
--    TDS:DISCIPLINA_DESCONOCIDA justo en SUB13, que es el primer
--    archivo que se importa.
--
-- 3) 20260922090000 dropea medicion_deportista_id_atributo_id_fecha_key
--    y la reemplaza por un índice PARCIAL (where jornada_id is not null).
--    Las mediciones que los clubes cargan a mano desde /medicion no
--    tienen jornada: pierden la garantía de "una por día" y el upsert de
--    app/medicion/page.tsx apunta a una constraint inexistente (42P10).
-- ============================================================

alter table medicion  alter column valor      type numeric(10,2);
alter table atributo  alter column escala_min type numeric(10,2);
alter table atributo  alter column escala_max type numeric(10,2);
alter table protocolo_atributo alter column minimo type numeric(10,2);
alter table protocolo_atributo alter column maximo type numeric(10,2);

insert into disciplina (nombre, descripcion)
values ('Fútbol', 'Fútbol formativo — escuelitas, inferiores, reserva y primera')
on conflict (nombre) do update set activo = true;

-- Restituye "una medición por deportista/atributo/día" para la carga
-- manual de los clubes, sin chocar con el camino de jornadas.
create unique index if not exists uq_medicion_manual_dia
  on medicion (deportista_id, atributo_id, fecha)
  where jornada_id is null;
