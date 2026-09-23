-- ============================================================
-- Aislamiento de Evaluaciones. Corre en cualquier ambiente.
--
-- Todo pasa dentro de una transacción que TERMINA EN ROLLBACK: no deja
-- datos de prueba ni siquiera si falla a la mitad.
--
-- Simula sesiones reales poniendo el rol `authenticated` y el claim `sub`,
-- que es de donde sale `auth.uid()`. O sea que ejercita el RLS de verdad,
-- no una consulta como superusuario.
--
--   psql "$URL" -v ON_ERROR_STOP=1 -f scripts/verificar-aislamiento-evaluaciones.sql
-- ============================================================
\set ON_ERROR_STOP on
begin;

create temp table _r(n text, esperado text, obtenido text, ok boolean) on commit drop;
-- La tabla de resultados se escribe desde sesiones simuladas (`authenticated`,
-- `anon`), así que necesita permiso explícito: es del arnés, no del modelo.
grant insert on _r to public;

create or replace function pg_temp.chk(p_n text, p_esperado text, p_obtenido text) returns void
language plpgsql as $$ begin
  insert into _r values (p_n, p_esperado, p_obtenido, p_esperado = p_obtenido);
end $$;

create or replace function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub',p_uid,'role','authenticated')::text, true);
end $$;

do $todo$
declare
  v_sec_club uuid; v_sec_uid uuid; v_demo_uid uuid; v_club_demo uuid;
  v_n int; v_msg text; v_dep_objetivo uuid; v_atr uuid;
begin
  select id into v_sec_club from club where tipo_organizacion='secretaria' limit 1;
  select auth_user_id into v_sec_uid from membresia where club_id=v_sec_club limit 1;
  select m.auth_user_id, m.club_id into v_demo_uid, v_club_demo
    from membresia m join club c on c.id=m.club_id
    where c.tipo_organizacion='club' and es_cuenta_demo(m.auth_user_id) and m.rol='admin_club' limit 1;
  select id into v_dep_objetivo from deportista where club_id=v_sec_club limit 1;
  select id into v_atr from atributo limit 1;
  if v_sec_club is null or v_demo_uid is null then
    raise exception 'Faltan datos base: Secretaría=% demo=%', v_sec_club, v_demo_uid;
  end if;

  -- ---------- 1. La demo NO llega a Evaluaciones ----------
  perform pg_temp.como(v_demo_uid);
  select count(*) into v_n from deportista where club_id=v_sec_club;
  perform pg_temp.chk('demo lee deportistas de Secretaría','0',v_n::text);
  select count(*) into v_n from lote_importacion where club_id=v_sec_club;
  perform pg_temp.chk('demo lee planillas de Secretaría','0',v_n::text);
  select count(*) into v_n from planilla_recepcion where club_id=v_sec_club;
  perform pg_temp.chk('demo lee recepciones de Secretaría','0',v_n::text);
  select count(*) into v_n from jornada_evaluacion where club_id=v_sec_club;
  perform pg_temp.chk('demo lee jornadas de Secretaría','0',v_n::text);
  select count(*) into v_n from medicion where club_id=v_sec_club;
  perform pg_temp.chk('demo lee mediciones de Secretaría','0',v_n::text);
  select count(*) into v_n from institucion_origen where club_id=v_sec_club;
  perform pg_temp.chk('demo lee instituciones de Secretaría','0',v_n::text);

  -- ---------- 2. La demo no puede ESCRIBIR en Evaluaciones ----------
  begin
    update deportista set nombre='HACKEADO' where club_id=v_sec_club;
    get diagnostics v_n = row_count;
    perform pg_temp.chk('demo modifica deportistas de Secretaría (filas)','0',v_n::text);
  exception when others then perform pg_temp.chk('demo modifica deportistas de Secretaría (filas)','0','0'); end;
  -- Ojo: acá NO sirve `insert ... select ... from deportista`, porque el
  -- RLS ya le esconde la fila y el insert mete 0 filas sin fallar — la
  -- prueba pasaría por el motivo equivocado. El ataque de verdad es con un
  -- UUID que el atacante YA CONOCE, así que se pasa literal.
  begin
    insert into medicion(club_id, deportista_id, atributo_id, valor, fecha)
    values (v_sec_club, v_dep_objetivo, v_atr, 99, current_date);
    get diagnostics v_n = row_count;
    perform pg_temp.chk('demo inserta medición en Secretaría (uuid conocido)','rechazado','INSERTÓ '||v_n);
  exception when others then perform pg_temp.chk('demo inserta medición en Secretaría (uuid conocido)','rechazado','rechazado'); end;

  -- ---------- 3. Las demos siguen viendo LO SUYO ----------
  select count(*) into v_n from deportista where club_id=v_club_demo;
  perform pg_temp.chk('demo sigue viendo su propio club (>0)','si', case when v_n>0 then 'si' else 'no' end);

  -- ---------- 4. La cuenta privada SÍ ve lo suyo ----------
  perform pg_temp.como(v_sec_uid);
  select count(*) into v_n from deportista where club_id=v_sec_club;
  perform pg_temp.chk('Secretaría ve sus deportistas (>0)','si', case when v_n>0 then 'si' else 'no' end);
  select count(*) into v_n from lote_importacion where club_id=v_sec_club;
  perform pg_temp.chk('Secretaría ve sus planillas (>0)','si', case when v_n>0 then 'si' else 'no' end);
  select count(*) into v_n from deportista where club_id=v_club_demo;
  perform pg_temp.chk('Secretaría NO ve deportistas de los clubes','0',v_n::text);

  -- ---------- 5. Anónimo no ve nada ----------
  -- Hay que limpiar LAS DOS: `auth.uid()` de Supabase lee primero
  -- `request.jwt.claim.sub` y si no, `request.jwt.claims->>'sub'`. Limpiando
  -- solo la primera, la sesión anterior sigue vigente y el "anónimo" lee como
  -- ella. Esta prueba pasó en verde por ese motivo equivocado una vez.
  perform set_config('role','anon',true);
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from deportista;
  perform pg_temp.chk('anónimo lee deportistas','0',v_n::text);
  select count(*) into v_n from medicion;
  perform pg_temp.chk('anónimo lee mediciones','0',v_n::text);

  -- ---------- 6. El trigger anti-demo ----------
  perform set_config('role','postgres',true);
  begin
    insert into membresia(club_id, auth_user_id, nombre, email, rol)
    values (v_sec_club, v_demo_uid, 'x', 'x@demo.talento.ar', 'admin_secretaria');
    perform pg_temp.chk('dar membresía de Secretaría a una demo','rechazado','PASÓ');
  exception when others then
    get stacked diagnostics v_msg = message_text;
    perform pg_temp.chk('dar membresía de Secretaría a una demo','rechazado',
      case when v_msg like '%CUENTA_DEMO%' then 'rechazado' else 'rechazado por otro motivo: '||left(v_msg,40) end);
  end;
end $todo$;

reset role;
select case when ok then '✅' else '❌' end as r, n as prueba, esperado, obtenido from _r order by ctid;
select count(*) filter (where ok) || '/' || count(*) || ' pruebas OK' as resumen,
       case when count(*) filter (where not ok)=0 then 'TODO BIEN' else 'HAY FALLAS' end as veredicto from _r;

rollback;
