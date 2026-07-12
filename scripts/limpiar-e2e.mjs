/**
 * Limpia los datos que crea la prueba e2e del circuito de alta
 * (scratchpad/e2e-circuito-alta.mjs): deportista+tutor+consentimiento
 * de prueba, membresía y usuario Auth del profe e2e, y la categoría
 * "Escuelita 2020". Idempotente. También VERIFICA (--verificar) que
 * el alta del deportista haya quedado completa antes de borrar.
 *
 *   node scripts/limpiar-e2e.mjs [--verificar]
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

const EMAIL_E2E = "e2e-profe@prueba.talento.ar";
const verificar = process.argv.includes("--verificar");

// ---------- Verificación del alta (antes de borrar) ----------
if (verificar) {
  const { data: dep } = await admin
    .from("deportista")
    .select("id, nombre, apellido, fecha_nacimiento, categoria:categoria_id(nombre), tutor(nombre, relacion), consentimiento(otorgado, fecha_firma, observacion)")
    .eq("apellido", "Prueba E2E")
    .maybeSingle();
  if (!dep) {
    console.error("❌ No existe el deportista de prueba — el alta NO se guardó");
    process.exit(1);
  }
  console.log("✓ deportista:", dep.nombre, dep.apellido, "·", dep.fecha_nacimiento, "·", dep.categoria?.nombre);
  console.log("✓ tutor:", JSON.stringify(dep.tutor));
  console.log("✓ consentimiento:", JSON.stringify(dep.consentimiento));
  if (!dep.tutor?.length || !dep.consentimiento?.length) {
    console.error("❌ Falta tutor o consentimiento");
    process.exit(1);
  }
}

// ---------- Limpieza ----------
const { data: deps } = await admin.from("deportista").select("id").eq("apellido", "Prueba E2E");
for (const d of deps ?? []) {
  await admin.from("deportista").delete().eq("id", d.id); // cascade tutor+consentimiento
  console.log("· borrado deportista", d.id);
}

const { data: membs } = await admin.from("membresia").select("id").eq("email", EMAIL_E2E);
for (const m of membs ?? []) {
  await admin.from("membresia").delete().eq("id", m.id);
  console.log("· borrada membresía", m.id);
}

const { data: usuarios } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const u = usuarios.users.find((x) => x.email === EMAIL_E2E);
if (u) {
  await admin.auth.admin.deleteUser(u.id);
  console.log("· borrado usuario Auth", u.email);
}

const { error: eCat } = await admin.from("categoria").delete().eq("nombre", "Escuelita 2020");
if (eCat) console.log("· categoría Escuelita 2020:", eCat.message);
else console.log("· borrada categoría Escuelita 2020 (si existía)");

console.log("✅ limpieza e2e lista");
