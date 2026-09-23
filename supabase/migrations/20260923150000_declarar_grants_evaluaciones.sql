-- ============================================================
-- Declara los privilegios de las tablas de Evaluaciones.
--
-- Hasta ahora ninguna migración declaraba GRANTs: se confiaba en los
-- privilegios por defecto que Supabase aplica al crear el proyecto
-- (`anon`, `authenticated` y `service_role` con arwdDxtm sobre todo
-- `public`). Eso tiene dos problemas:
--
--   1. No es igual en todos lados. En el stack local esos roles reciben
--      solo `Dxtm`, así que el entorno local NO reproduce al real y hay
--      que parchear a mano. Ya nos costó un rato de depuración.
--   2. `anon` termina con permiso de escritura y TRUNCATE sobre tablas
--      con datos de menores. Hoy no pasa nada porque el RLS lo frena,
--      pero **TRUNCATE no pasa por RLS**: un `anon` con ese privilegio
--      vacía una tabla entera sin que ninguna policy lo mire.
--
-- Esta migración no cambia lo que la app puede hacer. Solo escribe lo que
-- ya se asumía, y saca lo que nunca se usó.
-- ============================================================

do $$
declare
  r record;
  -- Todo lo que nació con el Espacio Secretaría. `anon` no tiene nada que
  -- hacer acá: estas pantallas exigen sesión.
  v_secretaria text[] := array[
    'lote_importacion','lote_importacion_evento','planilla_recepcion','purga_ejecucion',
    'jornada_evaluacion','jornada_deportista','institucion_origen','correccion_auditoria',
    'disciplina_solicitud','protocolo','protocolo_atributo','disciplina_protocolo'
  ];
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    -- TRUNCATE fuera para todos los roles de la API, en TODA tabla.
    -- Saltea RLS; no hay ningún caso en que un cliente deba tenerlo.
    execute format('revoke truncate on public.%I from anon, authenticated, service_role', r.tablename);

    if r.tablename = any(v_secretaria) then
      execute format('revoke all on public.%I from anon', r.tablename);
      execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', r.tablename);
    else
      -- El resto conserva lo que ya tenía, pero declarado en vez de heredado.
      execute format('grant select, insert, update, delete on public.%I to anon, authenticated, service_role', r.tablename);
    end if;
  end loop;
end $$;

-- Verificación: que no haya quedado nadie con TRUNCATE.
do $$
declare v_det text;
begin
  select string_agg(distinct table_name, ', ') into v_det
  from information_schema.role_table_grants
  where table_schema = 'public' and privilege_type = 'TRUNCATE'
    and grantee in ('anon','authenticated','service_role');
  if v_det is not null then
    raise exception 'Quedó TRUNCATE concedido en: %', v_det;
  end if;
end $$;
