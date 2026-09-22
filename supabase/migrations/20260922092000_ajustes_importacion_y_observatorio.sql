-- Ajustes posteriores al ensayo completo en staging:
-- 1) la resolución de fecha se referencia por el id declarado en cada
--    medición normalizada, no por el nombre hardcodeado de SUB13;
-- 2) la respuesta enumera todas las jornadas creadas por un lote;
-- 3) el observatorio de clubes no presenta organizaciones Secretaría
--    como si fueran clubes adheridos.

create or replace function confirmar_lote_evaluacion(
  p_lote_id uuid,
  p_resoluciones jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lote lote_importacion%rowtype;
  v_disciplina uuid;
  v_institucion uuid;
  v_categoria uuid;
  v_jornada uuid;
  v_medicion jsonb;
  v_deportista uuid;
  v_atributo uuid;
  v_protocolo uuid;
  v_fecha date;
  v_creados int := 0;
  v_vinculados int := 0;
  v_guardadas int := 0;
  v_resultado jsonb;
  v_bloqueo jsonb;
  v_claves_vistas text[] := array[]::text[];
  v_jornadas uuid[] := array[]::uuid[];
begin
  select * into v_lote
    from lote_importacion
   where id = p_lote_id
   for update;

  if not found then raise exception 'TDS:SIN_ALCANCE'; end if;
  if v_lote.estado = 'importado' then return v_lote.resultado; end if;
  if v_lote.estado <> 'previsualizado' then raise exception 'TDS:IMPORTACION_DUPLICADA'; end if;
  if v_lote.vence_en < now() then raise exception 'TDS:PREVIEW_EXPIRADO'; end if;

  for v_bloqueo in
    select value from jsonb_array_elements(v_lote.hallazgos)
    where value ->> 'severidad' = 'bloqueo'
      and coalesce((value ->> 'requiereResolucion')::boolean, false)
  loop
    if not (p_resoluciones ? (v_bloqueo ->> 'id')) then
      raise exception 'TDS:BLOQUEOS_PENDIENTES';
    end if;
  end loop;

  if exists (
    select 1 from lote_importacion li
     where li.club_id = v_lote.club_id
       and li.hash_sha256 = v_lote.hash_sha256
       and li.contexto ->> 'institucionOrigen' = v_lote.contexto ->> 'institucionOrigen'
       and li.contexto ->> 'disciplina' = v_lote.contexto ->> 'disciplina'
       and li.contexto ->> 'grupo' = v_lote.contexto ->> 'grupo'
       and li.estado = 'importado'
       and li.id <> v_lote.id
  ) then raise exception 'TDS:IMPORTACION_DUPLICADA'; end if;

  select id into v_disciplina from disciplina
   where lower(nombre) = lower(v_lote.contexto ->> 'disciplina') and activo;
  if v_disciplina is null then raise exception 'TDS:DISCIPLINA_DESCONOCIDA'; end if;

  select id into v_institucion from institucion_origen
   where club_id = v_lote.club_id
     and lower(nombre) = lower(v_lote.contexto ->> 'institucionOrigen');
  if v_institucion is null then
    insert into institucion_origen(club_id, nombre)
    values (v_lote.club_id, v_lote.contexto ->> 'institucionOrigen')
    returning id into v_institucion;
  end if;

  select id into v_categoria from categoria
   where club_id = v_lote.club_id
     and disciplina_id = v_disciplina
     and institucion_origen_id = v_institucion
     and lower(nombre) = lower(v_lote.contexto ->> 'grupo');
  if v_categoria is null then
    insert into categoria(club_id, disciplina_id, institucion_origen_id, nombre, tipo)
    values (v_lote.club_id, v_disciplina, v_institucion, v_lote.contexto ->> 'grupo', null)
    returning id into v_categoria;
  end if;

  if not opera_categoria(v_lote.club_id, v_categoria) then
    raise exception 'TDS:SIN_ALCANCE';
  end if;

  for v_medicion in select value from jsonb_array_elements(v_lote.preview_json -> 'mediciones')
  loop
    v_fecha := coalesce(
      case
        when nullif(v_medicion ->> 'fechaResolucionId', '') is not null
        then nullif(p_resoluciones ->> (v_medicion ->> 'fechaResolucionId'), '')::date
        else null
      end,
      nullif(v_medicion ->> 'fecha', '')::date,
      nullif(v_lote.contexto ->> 'fechaDeclarada', '')::date
    );
    if v_fecha is null then raise exception 'TDS:FECHA_REQUERIDA'; end if;

    select id into v_deportista from deportista
     where club_id = v_lote.club_id
       and categoria_id = v_categoria
       and clave_importacion = v_medicion ->> 'deportistaClave';
    if not ((v_medicion ->> 'deportistaClave') = any(v_claves_vistas)) then
      v_claves_vistas := array_append(v_claves_vistas, v_medicion ->> 'deportistaClave');
      if v_deportista is null then
        insert into deportista(club_id, categoria_id, nombre, apellido, clave_importacion)
        values (
          v_lote.club_id, v_categoria, v_medicion ->> 'nombre',
          nullif(v_medicion ->> 'apellido', ''), v_medicion ->> 'deportistaClave'
        ) returning id into v_deportista;
        v_creados := v_creados + 1;
      else
        v_vinculados := v_vinculados + 1;
      end if;
    end if;

    select id into v_jornada from jornada_evaluacion
     where club_id = v_lote.club_id
       and institucion_origen_id = v_institucion
       and disciplina_id = v_disciplina
       and categoria_id = v_categoria
       and fecha = v_fecha
       and evaluado_por = v_lote.contexto ->> 'evaluadoPor';
    if v_jornada is null then
      insert into jornada_evaluacion(
        club_id, institucion_origen_id, disciplina_id, categoria_id,
        fecha, evaluado_por, importado_por
      ) values (
        v_lote.club_id, v_institucion, v_disciplina, v_categoria,
        v_fecha, v_lote.contexto ->> 'evaluadoPor', v_lote.importado_por
      ) returning id into v_jornada;
    end if;
    if not (v_jornada = any(v_jornadas)) then
      v_jornadas := array_append(v_jornadas, v_jornada);
    end if;

    insert into jornada_deportista(jornada_id, deportista_id, edad_declarada)
    values (v_jornada, v_deportista, nullif(v_medicion ->> 'edad', '')::int)
    on conflict (jornada_id, deportista_id) do update
      set edad_declarada = coalesce(excluded.edad_declarada, jornada_deportista.edad_declarada);

    select id into v_atributo from atributo
     where codigo = v_medicion ->> 'atributoCodigo' and activo;
    if v_atributo is null then raise exception 'TDS:METRICA_DESCONOCIDA'; end if;

    v_protocolo := null;
    if nullif(v_medicion ->> 'protocoloCodigo', '') is not null then
      select id into v_protocolo from protocolo
       where codigo = v_medicion ->> 'protocoloCodigo' and activo;
      if v_protocolo is null then raise exception 'TDS:PROTOCOLO_DESCONOCIDO'; end if;
    end if;

    insert into medicion(
      club_id, deportista_id, atributo_id, valor, fecha, registrado_por,
      jornada_id, protocolo_id, lote_importacion_id, intento, detalle
    ) values (
      v_lote.club_id, v_deportista, v_atributo,
      (v_medicion ->> 'valor')::numeric, v_fecha, v_lote.importado_por,
      v_jornada, v_protocolo, v_lote.id,
      (v_medicion ->> 'intento')::int,
      coalesce(v_medicion -> 'detalle', '{}'::jsonb)
    );
    v_guardadas := v_guardadas + 1;
  end loop;

  v_resultado := jsonb_build_object(
    'loteId', v_lote.id,
    'jornadaId', v_jornada,
    'jornadaIds', to_jsonb(v_jornadas),
    'jornadasCreadas', cardinality(v_jornadas),
    'deportistasCreados', v_creados,
    'deportistasVinculados', v_vinculados,
    'medicionesGuardadas', v_guardadas,
    'filasIgnoradas', v_lote.filas_ignoradas
  );

  update lote_importacion
     set estado = 'importado', resoluciones = p_resoluciones,
         resultado = v_resultado, confirmado_en = now(), preview_json = '{}'::jsonb
   where id = v_lote.id;
  insert into lote_importacion_evento(lote_id, membresia_id, tipo, detalle)
  values (v_lote.id, v_lote.importado_por, 'confirmado', jsonb_build_object('resoluciones', p_resoluciones));
  return v_resultado;
exception
  when unique_violation then raise exception 'TDS:CONFLICTO_MEDICION';
end;
$$;

revoke execute on function confirmar_lote_evaluacion(uuid, jsonb) from public, anon;
grant execute on function confirmar_lote_evaluacion(uuid, jsonb) to authenticated;

-- Enriquece también los resultados ya confirmados durante el ensayo de
-- staging (por ejemplo, Gimnasia: un lote que produjo ocho jornadas).
update lote_importacion li
set resultado = li.resultado || jsonb_build_object(
  'jornadaIds', coalesce((
    select jsonb_agg(distinct m.jornada_id)
    from medicion m
    where m.lote_importacion_id = li.id and m.jornada_id is not null
  ), '[]'::jsonb),
  'jornadasCreadas', (
    select count(distinct m.jornada_id)::int
    from medicion m
    where m.lote_importacion_id = li.id and m.jornada_id is not null
  )
)
where li.estado = 'importado' and li.resultado is not null;

drop function if exists observatorio_clubes();

create or replace function observatorio_clubes()
returns table (
  id uuid,
  nombre text,
  localidad text,
  departamento text,
  escudo_url text,
  deportistas int,
  mediciones_30d int,
  consentimiento_pct int,
  categorias_activas int,
  ultima_medicion date,
  pases_12m int
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
    (select count(*)::int from deportista d where d.club_id = c.id and d.activo),
    (select count(*)::int from medicion m where m.club_id = c.id and m.fecha >= current_date - 30),
    coalesce((
      select round(
        100.0 * count(*) filter (where exists (
          select 1 from consentimiento k
           where k.deportista_id = d.id and k.otorgado and k.revocado_en is null
        )) / nullif(count(*), 0)
      )::int
      from deportista d where d.club_id = c.id and d.activo
    ), 0),
    (select count(distinct d.categoria_id)::int
       from deportista d where d.club_id = c.id and d.activo and d.categoria_id is not null),
    (select max(m.fecha) from medicion m where m.club_id = c.id),
    (select count(*)::int from deportista_hito h
      where h.club_id = c.id and h.tipo = 'pase_salida' and h.fecha >= current_date - 365)
  from club c
  where es_plataforma()
    and c.tipo_organizacion = 'club'
  order by c.nombre
$$;

revoke execute on function observatorio_clubes() from public, anon;
grant execute on function observatorio_clubes() to authenticated;
