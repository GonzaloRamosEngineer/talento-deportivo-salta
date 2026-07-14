/**
 * Backup pilot-grade de talento-deportivo-salta.
 *
 * Genera, en una carpeta con fecha, DOS piezas:
 *   1. db_public.sql  — volcado del esquema `public` (todos nuestros
 *      datos: club, categorías, deportistas, mediciones, sesiones,
 *      consentimientos, asignaciones…) vía pg_dump en un contenedor
 *      postgres:17 (matchea la versión del servidor Supabase 17.x, sin
 *      instalar Postgres local).
 *   2. consentimientos/ — todos los archivos del bucket privado de
 *      consentimientos (fotos/PDF de las firmas), bajados con la
 *      service key. Si el bucket todavía no existe (Módulo C sin
 *      desplegar), se omite sin fallar.
 *
 * DÓNDE CAE:  variable de entorno TDS_BACKUP_DIR (apuntala a la carpeta
 * de Google Drive para escritorio para que se vaya OFFSITE solo).
 * Si no está seteada, cae en ~/talento-backups (local — moverla a Drive
 * a mano).
 *
 * REQUISITOS:  Docker corriendo + .env.local con SUPABASE_DB_URL
 * (session pooler) y SUPABASE_SECRET_KEY.
 *
 *   TDS_BACKUP_DIR="/ruta/a/Drive/Backups Talento" node scripts/backup.mjs
 *
 * Restore: ver docs/BACKUPS.md
 */
import { readFileSync, mkdirSync, openSync, closeSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const DB_URL = env.SUPABASE_DB_URL;
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = env.SUPABASE_SECRET_KEY;
if (!DB_URL) {
  console.error("✗ Falta SUPABASE_DB_URL en .env.local (cadena del session pooler).");
  process.exit(1);
}

// carpeta destino con fecha+hora local (ej. 2026-07-14_1630)
const now = new Date();
const p = (n) => String(n).padStart(2, "0");
const stamp =
  `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}` +
  `_${p(now.getHours())}${p(now.getMinutes())}`;
const destConfigurado = process.env.TDS_BACKUP_DIR || env.TDS_BACKUP_DIR;
const dest = destConfigurado || join(homedir(), "talento-backups");
const outDir = join(dest, stamp);
mkdirSync(outDir, { recursive: true });
console.log(`📦 Backup → ${outDir}`);

// ---------- 1) volcado de la base (esquema public) ----------
const dumpFile = join(outDir, "db_public.sql");
console.log("• pg_dump del esquema public (docker postgres:17)…");
try {
  const fd = openSync(dumpFile, "w");
  execFileSync(
    "docker",
    [
      "run", "--rm", "-i", "postgres:17",
      "pg_dump", DB_URL,
      "--schema=public",
      "--no-owner",
      "--no-privileges",
    ],
    { stdio: ["ignore", fd, "inherit"] },
  );
  closeSync(fd);
  const kb = (statSync(dumpFile).size / 1024).toFixed(0);
  console.log(`  ✓ db_public.sql (${kb} KB)`);
} catch (e) {
  console.error(`  ✗ pg_dump falló: ${e.message}`);
  console.error("    ¿Docker está corriendo? ¿SUPABASE_DB_URL es válida?");
  process.exit(1);
}

// ---------- 2) archivos del bucket de consentimientos ----------
const BUCKET = "consentimientos";
if (!URL_ || !SECRET) {
  console.log(`• bucket ${BUCKET}: sin credenciales de service role — se omite.`);
} else {
  const admin = createClient(URL_, SECRET, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function listarTodo(prefijo = "") {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(prefijo, { limit: 1000 });
    if (error) throw error;
    let archivos = [];
    for (const item of data) {
      const ruta = prefijo ? `${prefijo}/${item.name}` : item.name;
      // las carpetas vuelven con id null; los archivos con id
      if (item.id === null) archivos = archivos.concat(await listarTodo(ruta));
      else archivos.push(ruta);
    }
    return archivos;
  }

  try {
    console.log(`• bucket ${BUCKET}: listando…`);
    const rutas = await listarTodo();
    if (rutas.length === 0) {
      console.log("  (vacío — nada que bajar todavía)");
    }
    let bajados = 0;
    for (const ruta of rutas) {
      const { data, error } = await admin.storage.from(BUCKET).download(ruta);
      if (error) {
        console.error(`  ✗ ${ruta}: ${error.message}`);
        continue;
      }
      const destino = join(outDir, BUCKET, ruta);
      mkdirSync(join(destino, ".."), { recursive: true });
      await writeFile(destino, Buffer.from(await data.arrayBuffer()));
      bajados++;
    }
    if (rutas.length > 0) console.log(`  ✓ ${bajados}/${rutas.length} archivos`);
  } catch (e) {
    const msg = e.message || String(e);
    if (/not.*found|does not exist|Bucket not found/i.test(msg)) {
      console.log(`  el bucket ${BUCKET} aún no existe (Módulo C sin desplegar) — se omite.`);
    } else {
      console.error(`  ✗ error con el bucket: ${msg}`);
    }
  }
}

console.log("\n✅ Backup completo.");
console.log(
  destConfigurado
    ? "   (cae en tu carpeta de Drive — Google Drive lo sube offsite solo)"
    : "   ⚠ cayó en ~/talento-backups (LOCAL). Seteá TDS_BACKUP_DIR a tu carpeta de Drive para que quede offsite.",
);
