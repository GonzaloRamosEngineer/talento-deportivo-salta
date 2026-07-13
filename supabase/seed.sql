-- ============================================================
-- SEED — Ola 1 (2026-07-12). Idempotente: se puede re-ejecutar.
-- Se corre con service role / conexión directa (el catálogo global
-- no tiene UI de administración en el MVP y las tablas de club no
-- tienen políticas de INSERT para authenticated).
-- ============================================================

-- ---------- Catálogo global: disciplina ----------
insert into disciplina (nombre, descripcion)
values ('Fútbol', 'Fútbol formativo — escuelitas, inferiores, reserva y primera')
on conflict (nombre) do nothing;

-- ---------- Catálogo global: atributos físicos (comunes) ----------
insert into atributo (nombre, ambito, naturaleza, unidad, escala_min, escala_max, sentido, protocolo) values
  ('Talla',          'fisico', 'objetivo', 'cm',      50,  220, null,          'Descalzo, contra pared, con tallímetro'),
  ('Peso',           'fisico', 'objetivo', 'kg',      10,  150, null,          'Balanza, ropa liviana'),
  ('Velocidad 30m',  'fisico', 'objetivo', 'segundos', 3,   10, 'menor_mejor', 'Sprint 30m, partida detenida, cronómetro'),
  ('Salto vertical', 'fisico', 'objetivo', 'cm',       5,  100, 'mayor_mejor', 'Salto con contramovimiento, marca en pared'),
  ('Resistencia',    'fisico', 'objetivo', 'metros', 400, 4000, 'mayor_mejor', 'Test de Cooper (12 minutos)')
on conflict (coalesce(disciplina_id, '00000000-0000-0000-0000-000000000000'::uuid), nombre) do nothing;

-- ---------- Catálogo global: técnicos de fútbol (1-10, subjetivos) ----------
-- "Experiencia" y "Estado físico" quedan afuera a propósito: se
-- derivarán de sesiones/asistencia, no se cargan a mano.
insert into atributo (disciplina_id, nombre, ambito, naturaleza, unidad, escala_min, escala_max, sentido, protocolo)
select d.id, a.nombre, 'tecnico', 'subjetivo', 'escala', 1, 10, 'mayor_mejor', a.protocolo
from disciplina d,
     (values
       ('Pases',            'Precisión y criterio en el pase corto'),
       ('Pases largos',     'Pase aéreo y centro: distancia y precisión'),
       ('Remates',          'Precisión y potencia del remate al arco'),
       ('Cabezazos',        'Juego aéreo: pase y definición de cabeza'),
       ('Control de balón', 'Control al recibir y conducción'),
       ('Entradas',         'Presión y quite en el 1 contra 1'),
       ('Atajando',         'Arqueros: atajadas, anticipo y decisiones'),
       ('Balón parado',     'Córners, tiros libres y penales'),
       ('Visión de juego',  'Lectura del juego y pases posibles que detecta')
     ) as a(nombre, protocolo)
where d.nombre = 'Fútbol'
on conflict (coalesce(disciplina_id, '00000000-0000-0000-0000-000000000000'::uuid), nombre) do nothing;

-- ---------- Club piloto: Antoniana ----------
insert into club (nombre, localidad, departamento)
select 'Club Atlético Antoniana', 'Salta', 'Capital'
where not exists (select 1 from club where nombre = 'Club Atlético Antoniana');

-- Ubicación en el mapa para clubes sembrados antes de la columna
update club set departamento = 'Capital'
 where nombre = 'Club Atlético Antoniana' and departamento is null;

-- ---------- Categorías reales del club (cohortes 2026) ----------
insert into categoria (club_id, disciplina_id, nombre, tipo, anio_nacimiento)
select c.id, d.id, cat.nombre, cat.tipo, cat.anio
from club c, disciplina d,
     (values
       ('Escuelita 2019',      'escuelita', 2019),
       ('Escuelita 2018',      'escuelita', 2018),
       ('Escuelita 2017',      'escuelita', 2017),
       ('Escuelita 2016',      'escuelita', 2016),
       ('Escuelita 2015',      'escuelita', 2015),
       ('Escuelita 2014',      'escuelita', 2014),
       ('9ª División',         'inferior',  2013),
       ('8ª División',         'inferior',  2012),
       ('7ª División',         'inferior',  2011),
       ('6ª División',         'inferior',  2010),
       ('5ª División',         'inferior',  2009),
       ('4ª División',         'inferior',  2008),
       ('3ª División',         'inferior',  2007),
       ('Reserva (La Local)',  'reserva',   null::int),
       ('Primera',             'primera',   null::int)
     ) as cat(nombre, tipo, anio)
where c.nombre = 'Club Atlético Antoniana' and d.nombre = 'Fútbol'
on conflict (club_id, disciplina_id, nombre) do nothing;

-- ---------- Lugares del club ----------
insert into lugar (club_id, nombre, direccion)
select c.id, l.nombre, l.direccion
from club c,
     (values
       ('Cancha principal — Sede', 'Av. Independencia 910, Salta'),
       ('Predio de inferiores',    'B° El Tribuno, Salta')
     ) as l(nombre, direccion)
where c.nombre = 'Club Atlético Antoniana'
on conflict (club_id, nombre) do nothing;
