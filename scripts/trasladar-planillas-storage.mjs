#!/usr/bin/env node
/**
 * Copia los archivos originales de recepción manual entre proyectos.
 *
 * Va aparte del traslado de filas a propósito: las filas se mueven en una
 * transacción y los archivos no: son HTTP, fallan de a uno y se reintentan.
 * Mezclarlos haría que un timeout de red revierta un traslado de datos que
 * ya estaba bien.
 *
 * Orden correcto: PRIMERO los archivos, DESPUÉS las filas. Si se hace al
 * revés queda una ventana en la que `planilla_recepcion.ruta_storage`
 * apunta a un objeto que todavía no existe, y la pantalla muestra una
 * planilla que no se puede descargar.
 *
 * Solo copia lo que sigue vivo: las filas PURGADAS no tienen ruta y no se
 * tocan — su archivo se borró por política de retención y revivirlo sería
 * violarla.
 *
 * Uso:
 *   ORIGEN_URL=... ORIGEN_KEY=... DESTINO_URL=... DESTINO_KEY=... \
 *   CLUB_ID=... node scripts/trasladar-planillas-storage.mjs [--ejecutar]
 */
import { createClient } from "@supabase/supabase-js";

const BUCKET = "planillas-recepcion";
const { ORIGEN_URL, ORIGEN_KEY, DESTINO_URL, DESTINO_KEY, CLUB_ID } = process.env;
const EJECUTAR = process.argv.includes("--ejecutar");
if (!ORIGEN_URL || !ORIGEN_KEY || !DESTINO_URL || !DESTINO_KEY || !CLUB_ID) {
  console.error("Faltan ORIGEN_URL/KEY, DESTINO_URL/KEY o CLUB_ID.");
  process.exit(1);
}

const origen = createClient(ORIGEN_URL, ORIGEN_KEY, { auth: { persistSession: false } });
const destino = createClient(DESTINO_URL, DESTINO_KEY, { auth: { persistSession: false } });

const { data: filas, error } = await origen
  .from("planilla_recepcion")
  .select("numero_seguimiento, ruta_storage, tipo_mime, estado")
  .eq("club_id", CLUB_ID)
  .not("ruta_storage", "is", null);
if (error) throw new Error(`No pude listar las recepciones: ${error.message}`);

console.log(`archivos vivos a copiar: ${filas.length}`);
if (filas.length === 0) {
  console.log("Nada que copiar. (Las recepciones purgadas no tienen archivo: es correcto.)");
  process.exit(0);
}
if (!EJECUTAR) {
  for (const f of filas) console.log(`[copiaría] ${f.numero_seguimiento} -> ${f.ruta_storage}`);
  console.log("\n(ensayo: no se copió nada — agregá --ejecutar)");
  process.exit(0);
}

let ok = 0, fallos = 0;
for (const f of filas) {
  try {
    const { data: blob, error: eD } = await origen.storage.from(BUCKET).download(f.ruta_storage);
    if (eD) throw new Error(`descarga: ${eD.message}`);
    const { error: eU } = await destino.storage.from(BUCKET).upload(
      f.ruta_storage, blob, { contentType: f.tipo_mime ?? "application/octet-stream", upsert: false },
    );
    // Un objeto que ya está no es un error: hace el script reejecutable.
    if (eU && !/exists/i.test(eU.message)) throw new Error(`subida: ${eU.message}`);
    ok++;
    console.log(`✅ ${f.numero_seguimiento}`);
  } catch (e) {
    fallos++;
    console.error(`❌ ${f.numero_seguimiento}: ${e.message}`);
  }
}
console.log(`\ncopiados: ${ok} · fallidos: ${fallos}`);
if (fallos > 0) {
  console.error("Hay archivos sin copiar. NO sigas con el traslado de filas: quedarían planillas sin original.");
  process.exit(1);
}
