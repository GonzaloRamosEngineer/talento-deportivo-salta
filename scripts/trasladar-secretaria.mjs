#!/usr/bin/env node
/**
 * Traslada los datos TRABAJADOS de un Espacio Secretaría entre proyectos.
 *
 * Por qué no sirve un pg_dump
 * ---------------------------
 * El catálogo (disciplina, atributo, protocolo) lo crean las MIGRACIONES,
 * con `gen_random_uuid()`. O sea que el mismo protocolo "CMJ" tiene un id
 * distinto en cada proyecto. Un dump copiaría `medicion.atributo_id` tal
 * cual y las mediciones quedarían apuntando al atributo equivocado —
 * silenciosamente, con números que se ven bien.
 *
 * Por eso este script exporta el catálogo por CLAVE NATURAL (`codigo` /
 * `nombre`) y lo vuelve a resolver contra el destino. Los ids propios del
 * espacio (club, deportista, jornada, lote, medición) SÍ se preservan, que
 * es lo que mantiene la trazabilidad y hace el traslado repetible.
 *
 * Garantías
 * ---------
 * - Una sola transacción en el destino: entra todo o no entra nada.
 * - Solo filas de ESE club. No toca ningún otro club.
 * - `on conflict do nothing`: reejecutarlo no duplica ni pisa.
 * - No cambia estados. Un lote previsualizado llega previsualizado; una
 *   recepción pendiente llega pendiente.
 *
 * Uso:
 *   ORIGEN=... DESTINO=... CLUB_ID=... node scripts/trasladar-secretaria.mjs [--ejecutar]
 * Sin --ejecutar solo escribe el SQL y no lo aplica.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGEN = process.env.ORIGEN;
const DESTINO = process.env.DESTINO;
const CLUB_ID = process.env.CLUB_ID;
const EJECUTAR = process.argv.includes("--ejecutar");
if (!ORIGEN || !DESTINO || !CLUB_ID) {
  console.error("Faltan ORIGEN, DESTINO y CLUB_ID.");
  process.exit(1);
}

// PGTZ y no `set timezone` dentro del -c: psql imprime "SET" como primera
// línea de salida y eso se cuela como cabecera del CSV, con lo cual el
// `\\copy ... header true` descarta la cabecera equivocada y trata los
// nombres de columna como datos. Ya lo rompió una vez.
const psql = (url, sql, args = []) =>
  execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql, ...args], {
    encoding: "utf8", maxBuffer: 1024 * 1024 * 512,
    env: { ...process.env, PGTZ: "UTC" },
  });

/**
 * Orden de dependencia. `natural` reemplaza columnas de catálogo por su
 * clave natural; `resolver` las vuelve a id en el destino.
 */
const TABLAS = [
  { t: "club", orden: "t.id", cols: "id,nombre,localidad,creado_en,departamento,escudo_url,tipo_organizacion",
    where: "t.id = $CLUB" },
  // auth_user_id NO se copia: la cuenta en el destino es otra fila de
  // auth.users, con otro uuid. Se resuelve por email, que es la identidad
  // estable de la persona entre proyectos. Si la cuenta no existe todavía,
  // el traslado falla acá y no a mitad de camino.
  { t: "membresia", orden: "t.id", cols: "id,club_id,nombre,email,rol,creado_en,funcion",
    natural: [["auth_user_id", "auth.users", "email"]], where: "t.club_id = $CLUB" },
  { t: "institucion_origen", orden: "t.id", cols: "id,club_id,nombre,localidad,activo,creado_en,tipo,notas,creado_por",
    where: "t.club_id = $CLUB" },
  { t: "categoria", orden: "t.id", cols: "id,club_id,nombre,tipo,anio_nacimiento,edad_min,edad_max,creado_en,institucion_origen_id,activo,creado_por",
    natural: [["disciplina_id", "disciplina", "nombre"]], where: "t.club_id = $CLUB" },
  { t: "deportista", orden: "t.id", cols: "id,club_id,categoria_id,nombre,apellido,doc_interno,fecha_nacimiento,sexo,lateralidad,activo,creado_en,actualizado_en,clave_importacion,creado_por",
    where: "t.club_id = $CLUB" },
  { t: "lote_importacion", orden: "t.id", cols: "id,club_id,nombre_archivo,hash_sha256,adaptador,contexto,preview_json,hallazgos,resoluciones,filas_ignoradas,duplicados_archivo,bloqueos_pendientes,importado_por,estado,resultado,vence_en,creado_en,confirmado_en,resoluciones_borrador,reprocesado_en",
    where: "t.club_id = $CLUB" },
  { t: "jornada_evaluacion", orden: "t.id", cols: "id,club_id,institucion_origen_id,categoria_id,fecha,evaluado_por,importado_por,estado,creado_en",
    natural: [["disciplina_id", "disciplina", "nombre"]], where: "t.club_id = $CLUB" },
  { t: "jornada_deportista", orden: "t.jornada_id, t.deportista_id", cols: "jornada_id,deportista_id,edad_declarada,creado_en",
    where: "t.jornada_id in (select id from jornada_evaluacion where club_id = $CLUB)" },
  { t: "medicion", orden: "t.id", cols: "id,club_id,deportista_id,valor,fecha,registrado_por,nota,creado_en,jornada_id,lote_importacion_id,intento,detalle",
    natural: [["atributo_id", "atributo", "codigo"], ["protocolo_id", "protocolo", "codigo"]],
    where: "t.club_id = $CLUB" },
  { t: "lote_importacion_evento", orden: "t.id", cols: "id,lote_id,membresia_id,tipo,detalle,creado_en",
    where: "t.lote_id in (select id from lote_importacion where club_id = $CLUB)" },
  { t: "planilla_recepcion", orden: "t.id", cols: "id,club_id,numero_seguimiento,nombre_archivo,hash_sha256,tamano_bytes,tipo_mime,contexto,ruta_storage,motivo,estado,enviado_por,revisado_por,notas_revision,retener_hasta,purgado_en,creado_en,actualizado_en,lote_importacion_id,detalle_error,intentos_subida,revisado_en",
    where: "t.club_id = $CLUB" },
  { t: "correccion_auditoria", orden: "t.id", cols: "id,club_id,entidad,entidad_id,campo,valor_anterior,valor_nuevo,motivo,membresia_id,creado_en",
    where: "t.club_id = $CLUB" },
];

const dir = mkdtempSync(join(tmpdir(), "traslado-"));
let sql = `-- Traslado de Espacio Secretaría ${CLUB_ID}
-- Generado ${new Date().toISOString()}
begin;
set local statement_timeout = '30min';
-- Las marcas de tiempo entran en el checksum: sin esto, un destino con otra
-- zona horaria daría "faltan filas" siendo que están todas.
set local timezone = 'UTC';
`;

const conteos = {};
const firmas = {};

for (const def of TABLAS) {
  const where = def.where.replaceAll("$CLUB", `'${CLUB_ID}'`);
  const nat = def.natural ?? [];
  const proyeccion = def.cols.split(",").map((c) => `t.${c}`);
  const joins = nat.map(([col, tabla, clave], i) => {
    proyeccion.push(`c${i}.${clave} as ${col}__nat`);
    return `left join ${tabla} c${i} on c${i}.id = t.${col}`;
  });
  const desde = `from ${def.t} t ${joins.join(" ")} where ${where}`;

  // Firma = cantidad + md5 de TODAS las filas, sobre la misma proyección que
  // se exporta. No es una muestra: si cambia un solo valor de una sola de las
  // 1.653 mediciones, el md5 cambia y el traslado aborta.
  const expr = proyeccion.map((e) => `coalesce((${e.replace(/ as .*/, "")})::text,'∅')`).join(", ");
  const firmaSQL = `select count(*)::text || ':' || coalesce(md5(string_agg(concat_ws(chr(31), ${expr}), chr(30) order by ${def.orden})), 'vacio') ${desde}`;

  const firma = psql(ORIGEN, firmaSQL).trim().split("\n").pop();
  firmas[def.t] = firma;

  const tsv = psql(ORIGEN, `copy (select ${proyeccion.join(",")} ${desde}) to stdout with (format csv, header true, null '\\N')`);
  const filas = Number(firma.split(":")[0]);
  conteos[def.t] = filas;

  if (filas === 0) { sql += `\n-- ${def.t}: 0 filas (firma ${firma})\n`; continue; }
  const archivo = join(dir, `${def.t}.csv`);
  writeFileSync(archivo, tsv);

  const colsDestino = def.cols.split(",").concat(nat.map(([c]) => c));
  const colsStage = def.cols.split(",").concat(nat.map(([c]) => `${c}__nat`));
  const selectFinal = def.cols.split(",").map((c) => `s.${c}`)
    .concat(nat.map(([col, tabla, clave]) => `(select id from ${tabla} where lower(${clave}::text) = lower(s.${col}__nat))`));
  const guardas = nat.map(([col, tabla, clave]) =>
    `  if exists (select 1 from _stage_${def.t} s where s.${col}__nat is not null and not exists (select 1 from ${tabla} where lower(${clave}::text) = lower(s.${col}__nat))) then
    raise exception 'ABORTA: falta en el catálogo del destino: ${tabla}.${clave} referenciado por ${def.t}.${col}';
  end if;`).join("\n");

  sql += `
-- ${def.t}: ${filas} filas · firma de origen ${firma}
create temp table _stage_${def.t} (like ${def.t} including defaults) on commit drop;
${nat.map(([c]) => `alter table _stage_${def.t} drop column if exists ${c}; alter table _stage_${def.t} add column ${c}__nat text;`).join("\n")}
\\copy _stage_${def.t} (${colsStage.join(",")}) from '${archivo}' with (format csv, header true, null '\\N')
${guardas ? `do $guard$ begin\n${guardas}\nend $guard$;\n` : ""}insert into ${def.t} (${colsDestino.join(",")})
select ${selectFinal.join(",")} from _stage_${def.t} s
on conflict do nothing;
`;
}

// ---------- La verificación: condición de commit, no un aviso ----------
//
// Antes esto era RAISE NOTICE, o sea decoración: imprimía "141 vs 141" y
// commiteaba igual pasara lo que pasara. Y `on conflict do nothing` puede
// saltarse en silencio una fila que YA existe con datos DISTINTOS.
//
// Ahora se recalcula la misma firma en el destino y se compara con la de
// origen. Si no coinciden exactamente —falta una fila, sobra una, o alguna
// difiere en un solo campo— esto lanza excepción y la transacción entera se
// revierte. No hay traslado a medias.
sql += `
do $verif$
declare v_firma text; v_fallas text := '';
begin
`;
for (const def of TABLAS) {
  const where = def.where.replaceAll("$CLUB", `'${CLUB_ID}'`);
  const nat = def.natural ?? [];
  const proyeccion = def.cols.split(",").map((c) => `t.${c}`);
  const joins = nat.map(([col, tabla, clave], i) => {
    proyeccion.push(`c${i}.${clave}`);
    return `left join ${tabla} c${i} on c${i}.id = t.${col}`;
  });
  const expr = proyeccion.map((e) => `coalesce((${e})::text,'∅')`).join(", ");
  sql += `  select count(*)::text || ':' || coalesce(md5(string_agg(concat_ws(chr(31), ${expr}), chr(30) order by ${def.orden})), 'vacio')
    into v_firma from ${def.t} t ${joins.join(" ")} where ${where};
  if v_firma is distinct from ${JSON.stringify(firmas[def.t]).replaceAll("'", "''").replace(/^"/, "'").replace(/"$/, "'")} then
    v_fallas := v_fallas || format(E'  %s: origen=%s destino=%s\n', '${def.t}', '${firmas[def.t]}', v_firma);
  end if;
`;
}
sql += `  if v_fallas <> '' then
    raise exception E'ABORTA: el traslado no quedó idéntico al origen.\n%', v_fallas;
  end if;
  raise notice 'VERIFICACIÓN OK: las ${TABLAS.length} tablas coinciden exactamente con el origen.';
end $verif$;

-- Una sola membresía operativa de Secretaría
do $unica$
declare v_n int; v_det text;
begin
  select count(*), coalesce(string_agg(m.email || ' (' || m.rol || ')', ', '), '')
    into v_n, v_det
  from membresia m join club c on c.id = m.club_id
  where c.tipo_organizacion = 'secretaria';
  if v_n <> 1 then
    raise exception 'ABORTA: debe quedar exactamente 1 membresía de Secretaría y hay %: %', v_n, v_det;
  end if;
  raise notice 'Membresía única de Secretaría: %', v_det;
end $unica$;
commit;
`;

const salida = join(dir, "traslado.sql");
writeFileSync(salida, sql);
console.log("Conteos en origen:", JSON.stringify(conteos, null, 2));
console.log("SQL generado en:", salida);

if (EJECUTAR) {
  const out = execFileSync("psql", [DESTINO, "-v", "ON_ERROR_STOP=1", "-f", salida], { encoding: "utf8", env: { ...process.env, PGTZ: "UTC" } });
  console.log(out);
} else {
  console.log("\n(ensayo: no se aplicó nada — agregá --ejecutar)");
}
