-- Catálogo curado para los nueve archivos recibidos. No contiene PII.

insert into disciplina(nombre, descripcion) values
  ('Atletismo', 'Evaluaciones de atletismo'),
  ('Gimnasia rítmica', 'Evaluaciones de gimnasia rítmica'),
  ('Levantamiento', 'Levantamiento olímpico'),
  ('MMA', 'Artes marciales mixtas'),
  ('Rugby', 'Rugby formativo y competitivo'),
  ('Vóley', 'Vóley formativo y competitivo')
on conflict (nombre) do update set activo = true;

update atributo set codigo = 'peso_corporal' where nombre = 'Peso' and disciplina_id is null and codigo is null;
update atributo set codigo = 'tiempo_30m' where nombre = 'Velocidad 30m' and disciplina_id is null and codigo is null;

insert into atributo(codigo, nombre, ambito, naturaleza, unidad, escala_min, escala_max, sentido, protocolo) values
  ('altura_salto', 'Altura de salto', 'fisico', 'objetivo', 'cm', 0, 150, 'mayor_mejor', 'Resultado estructurado por protocolo'),
  ('fuerza_pico_aterrizaje', 'Fuerza pico de aterrizaje', 'fisico', 'objetivo', 'N', 0, 20000, null, 'Plataforma de fuerza'),
  ('potencia_relativa', 'Potencia relativa', 'fisico', 'objetivo', 'W/kg', 0, 150, 'mayor_mejor', 'Potencia pico dividida por masa corporal'),
  ('rsi_mod', 'RSI modificado', 'fisico', 'objetivo', 'm/s', 0, 5, 'mayor_mejor', 'Plataforma de fuerza'),
  ('asimetria_aterrizaje', 'Asimetría de aterrizaje', 'fisico', 'objetivo', '%', 0, 100, 'menor_mejor', 'Conservar lateralidad dominante en detalle'),
  ('asimetria_concentrica', 'Asimetría concéntrica', 'fisico', 'objetivo', '%', 0, 100, 'menor_mejor', 'Conservar lateralidad dominante en detalle'),
  ('handgrip', 'Fuerza de prensión', 'fisico', 'objetivo', 'kg', 0, 150, 'mayor_mejor', 'Dinamometría manual'),
  ('tiempo_10m', 'Tiempo 10 m', 'fisico', 'objetivo', 'segundos', 0, 20, 'menor_mejor', 'Sprint, partida detenida'),
  ('tiempo_tramo_10_30m', 'Tiempo tramo 10–30 m', 'fisico', 'objetivo', 'segundos', 0, 20, 'menor_mejor', 'Parcial de sprint'),
  ('velocidad_10m', 'Velocidad 0–10 m', 'fisico', 'objetivo', 'm/s', 0, 20, 'mayor_mejor', 'Derivada del sprint'),
  ('velocidad_10_30m', 'Velocidad 10–30 m', 'fisico', 'objetivo', 'm/s', 0, 20, 'mayor_mejor', 'Derivada del sprint')
on conflict (codigo) where codigo is not null do update set
  nombre = excluded.nombre,
  unidad = excluded.unidad,
  sentido = excluded.sentido,
  protocolo = excluded.protocolo,
  activo = true;

-- Si no existían los atributos físicos históricos, garantizar los códigos.
insert into atributo(codigo, nombre, ambito, naturaleza, unidad, escala_min, escala_max, sentido, protocolo)
select 'peso_corporal', 'Peso corporal', 'fisico', 'objetivo', 'kg', 10, 250, null, 'Balanza o plataforma de fuerza'
where not exists (select 1 from atributo where codigo = 'peso_corporal');
insert into atributo(codigo, nombre, ambito, naturaleza, unidad, escala_min, escala_max, sentido, protocolo)
select 'tiempo_30m', 'Tiempo 30 m', 'fisico', 'objetivo', 'segundos', 0, 20, 'menor_mejor', 'Sprint 30 m'
where not exists (select 1 from atributo where codigo = 'tiempo_30m');

insert into protocolo(codigo, nombre, version, descripcion) values
  ('CMJ', 'Countermovement Jump (CMJ)', '1', 'Salto con contramovimiento sin asistencia de brazos'),
  ('SJ', 'Squat Jump (SJ)', '1', 'Salto desde posición estática; acción concéntrica'),
  ('ABALAKOV', 'Abalakov (ABCMJ)', '1', 'Salto con contramovimiento y participación de brazos'),
  ('DJ', 'Drop Jump (DJ)', '1', 'Salto reactivo tras caída'),
  ('SPRINT_30M', 'Sprint 30 m', '1', 'Sprint con parciales 0–10 m y 10–30 m')
on conflict (codigo) do update set nombre = excluded.nombre, descripcion = excluded.descripcion, activo = true;

insert into protocolo_atributo(protocolo_id, atributo_id, requerido, unidad)
select p.id, a.id, false, a.unidad
from protocolo p
join atributo a on a.codigo in (
  'altura_salto', 'fuerza_pico_aterrizaje', 'potencia_relativa', 'rsi_mod',
  'asimetria_aterrizaje', 'asimetria_concentrica'
)
where p.codigo in ('CMJ', 'SJ', 'ABALAKOV', 'DJ')
on conflict (protocolo_id, atributo_id) do update set unidad = excluded.unidad;

insert into protocolo_atributo(protocolo_id, atributo_id, requerido, unidad)
select p.id, a.id, true, a.unidad
from protocolo p
join atributo a on a.codigo in ('tiempo_10m', 'tiempo_tramo_10_30m', 'tiempo_30m', 'velocidad_10m', 'velocidad_10_30m')
where p.codigo = 'SPRINT_30M'
on conflict (protocolo_id, atributo_id) do update set unidad = excluded.unidad;

insert into disciplina_protocolo(disciplina_id, protocolo_id, orden)
select d.id, p.id,
  case p.codigo when 'CMJ' then 1 when 'SJ' then 2 when 'ABALAKOV' then 3 when 'DJ' then 4 else 5 end
from disciplina d cross join protocolo p
where d.nombre in ('Atletismo', 'Fútbol', 'Gimnasia rítmica', 'Levantamiento', 'MMA', 'Rugby', 'Vóley')
  and p.codigo in ('CMJ', 'SJ', 'ABALAKOV', 'DJ')
on conflict (disciplina_id, protocolo_id) do update set activo = true;

insert into disciplina_protocolo(disciplina_id, protocolo_id, orden)
select d.id, p.id, 1
from disciplina d cross join protocolo p
where d.nombre = 'Rugby' and p.codigo = 'SPRINT_30M'
on conflict (disciplina_id, protocolo_id) do update set activo = true;

