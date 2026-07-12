/**
 * Siembra (o limpia) 3 deportistas de DEMO en la 9ª División del club
 * Antoniana, con historial de mediciones de Velocidad 30m y Pases:
 * sirven para mostrar la jornada de medición y la curva de evolución
 * con datos reales sin arrancar de cero. Idempotente.
 *
 *   node scripts/sembrar-demo-9na.mjs            # siembra
 *   node scripts/sembrar-demo-9na.mjs --limpiar  # borra los 3 (cascade)
 *
 * Los identifica por doc_interno ANT-0101/0102/0103. La medición "de
 * hoy" NO se siembra a propósito: la carga el profe por /medicion.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DOCS = ["ANT-0101", "ANT-0102", "ANT-0103"];
const { data: club } = await admin
  .from("club")
  .select("id")
  .eq("nombre", "Club Atlético Antoniana")
  .single();

if (process.argv.includes("--limpiar")) {
  const { data, error } = await admin
    .from("deportista")
    .delete()
    .eq("club_id", club.id)
    .in("doc_interno", DOCS)
    .select("id");
  if (error) throw error;
  console.log(`Borrados ${data.length} deportistas demo (mediciones y consentimientos en cascada).`);
  process.exit(0);
}

const { data: cat } = await admin
  .from("categoria")
  .select("id")
  .eq("club_id", club.id)
  .eq("nombre", "9ª División")
  .single();
const { data: vel } = await admin.from("atributo").select("id").eq("nombre", "Velocidad 30m").single();
const { data: pases } = await admin.from("atributo").select("id").eq("nombre", "Pases").single();
const { data: profe } = await admin
  .from("membresia")
  .select("id")
  .eq("email", "profe@demo.talento.ar")
  .single();

const CHICOS = [
  { nombre: "Thiago", apellido: "Guaymás", fecha_nacimiento: "2013-04-18", sexo: "M", lateralidad: "diestro", doc_interno: "ANT-0101", consent: true },
  { nombre: "Lautaro", apellido: "Cardozo", fecha_nacimiento: "2013-09-02", sexo: "M", lateralidad: "zurdo", doc_interno: "ANT-0102", consent: true },
  { nombre: "Benjamín", apellido: "Yapura", fecha_nacimiento: "2013-01-27", sexo: "M", lateralidad: "diestro", doc_interno: "ANT-0103", consent: false },
];
const HISTORIA_VEL = [
  ["2026-05-14", [4.95, 5.1, 4.88]],
  ["2026-06-13", [4.82, 5.02, 4.9]],
];
const HISTORIA_PASES = [["2026-06-13", [6, 7, 5]]];

const ids = [];
for (const c of CHICOS) {
  const { consent, ...fila } = c;
  let { data: dep } = await admin
    .from("deportista")
    .select("id")
    .eq("club_id", club.id)
    .eq("doc_interno", c.doc_interno)
    .maybeSingle();
  if (!dep) {
    const r = await admin
      .from("deportista")
      .insert({ ...fila, club_id: club.id, categoria_id: cat.id })
      .select("id")
      .single();
    if (r.error) throw r.error;
    dep = r.data;
  }
  ids.push(dep.id);
  if (consent) {
    const { data: ya } = await admin
      .from("consentimiento")
      .select("id")
      .eq("deportista_id", dep.id)
      .maybeSingle();
    if (!ya) await admin.from("consentimiento").insert({ deportista_id: dep.id, otorgado: true, observacion: "Demo" });
  }
}

for (const [atributo, historia] of [
  [vel.id, HISTORIA_VEL],
  [pases.id, HISTORIA_PASES],
]) {
  for (const [fecha, valores] of historia) {
    const filas = ids.map((id, i) => ({
      deportista_id: id,
      atributo_id: atributo,
      valor: valores[i],
      fecha,
      registrado_por: profe.id,
      club_id: club.id,
    }));
    const { error } = await admin
      .from("medicion")
      .upsert(filas, { onConflict: "deportista_id,atributo_id,fecha" });
    if (error) throw error;
  }
}

console.log("Sembrados 3 deportistas demo en 9ª División con historial de mediciones.");
console.log("La 3ª medición la carga el profe por /medicion — así la tendencia sale de la jornada real.");
