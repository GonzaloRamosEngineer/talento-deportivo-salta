/**
 * Pre-flight de T-002B: verifica que NINGÚN auth_user_id tenga membresía en
 * más de un club antes de aplicar `unique (auth_user_id)` sobre `membresia`.
 *
 * Si hay aunque sea un caso, la migración falla al aplicarse. Correr SIEMPRE
 * contra la base a la que se va a aplicar, y volver a correrlo el mismo día:
 * el resultado envejece en cuanto alguien invita a un miembro nuevo.
 *
 *   node scripts/preflight-una-cuenta-un-club.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
  const m = linea.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await admin
  .from("membresia")
  .select("auth_user_id, club_id, rol, nombre");

if (error) {
  console.error("No se pudo leer membresia:", error.message);
  process.exit(1);
}

const porUsuario = new Map();
for (const m of data) {
  if (!porUsuario.has(m.auth_user_id)) porUsuario.set(m.auth_user_id, []);
  porUsuario.get(m.auth_user_id).push(m);
}

const duplicados = [...porUsuario.entries()].filter(([, ms]) => {
  const clubes = new Set(ms.map((x) => x.club_id));
  return clubes.size > 1;
});

console.log(`membresías totales: ${data.length}`);
console.log(`usuarios distintos: ${porUsuario.size}`);
console.log(`usuarios en más de un club: ${duplicados.length}`);

if (duplicados.length) {
  console.log("\n⛔ NO se puede aplicar la constraint todavía. Casos:");
  for (const [uid, ms] of duplicados) {
    console.log(`  ${uid} → ${ms.map((m) => `${m.club_id} (${m.rol})`).join(" | ")}`);
  }
  process.exit(1);
}

console.log("\n✅ Pre-flight OK: la constraint `unique (auth_user_id)` se puede aplicar sin migrar datos.");
