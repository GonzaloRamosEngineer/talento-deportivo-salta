/**
 * T-001 del plan CTO — contención de las cuentas demo privilegiadas.
 *
 *   node scripts/contener-demo.mjs              # auditoría, no toca nada
 *   node scripts/contener-demo.mjs --aplicar    # ejecuta la contención
 *
 * Qué audita (siempre):
 *   1. Si el proyecto tiene datos REALES además de la vitrina ficticia.
 *   2. Qué cuentas tienen `app_metadata.plataforma` (el privilegio que
 *      habilita `linkAdminClub` → toma de cuenta de un admin real).
 *   3. Pre-flight de T-002B: usuarios con membresía en más de un club
 *      (rompen los lookups con `.maybeSingle()` en silencio).
 *
 * Qué aplica con --aplicar:
 *   1. Elimina `plataforma@demo.talento.ar`, que además mata sus
 *      sesiones activas.
 *   2. Rota la clave de las 3 cuentas demo restantes a DEMO_PASSWORD y
 *      les pone `app_metadata.demo = true` (lo que `lib/demo.ts` usa
 *      para bloquearlas en toda action sensible).
 *
 * OJO: rotar la contraseña NO invalida las sesiones demo ya abiertas.
 * No es un problema abierto: esas sesiones quedan contenidas por el
 * guard del server, y la única cuenta cuyo privilegio importaba
 * (plataforma) se elimina, con sus sesiones. La invalidación dura de
 * todas las sesiones llega con T-003, cuando la demo pase a su propio
 * proyecto Supabase.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const APLICAR = process.argv.includes("--aplicar");

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL_PLATAFORMA_DEMO = "plataforma@demo.talento.ar";
const EMAILS_DEMO = [
  "profe@demo.talento.ar",
  "admin@demo.talento.ar",
  "comision@demo.talento.ar",
];
const CLUB_VITRINA = "Club Fundación Evolución Antoniana";

const { data: usuarios, error: eUsuarios } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (eUsuarios) throw eUsuarios;
const porEmail = new Map(usuarios.users.map((u) => [u.email?.toLowerCase(), u]));

// ---------- 1. ¿Hay datos reales en esta instancia? ----------
const [{ data: clubes }, { data: membresias }] = await Promise.all([
  supabase.from("club").select("id, nombre"),
  supabase.from("membresia").select("auth_user_id, club_id, email, rol"),
]);

const otrosClubes = (clubes ?? []).filter((c) => c.nombre !== CLUB_VITRINA);
console.log("\n── 1. Datos reales en la instancia ──");
console.log(`Clubes: ${clubes?.length ?? 0} (vitrina + ${otrosClubes.length} más)`);
if (otrosClubes.length > 0) {
  console.log("⚠ HAY CLUBES ADEMÁS DE LA VITRINA. Revisar si tienen menores reales:");
  for (const c of otrosClubes) console.log(`   · ${c.nombre} (${c.id})`);
  console.log("  Si los hay: revisar logs de Auth y avisar antes de seguir.");
} else {
  console.log("✓ Solo la vitrina ficticia. La ventana se cierra sin incidente.");
}

// ---------- 2. Privilegio de plataforma ----------
console.log("\n── 2. Cuentas con app_metadata.plataforma ──");
const conPlataforma = usuarios.users.filter((u) => u.app_metadata?.plataforma === true);
if (conPlataforma.length === 0) {
  console.log("✓ Ninguna.");
} else {
  for (const u of conPlataforma) {
    const esDemo = u.email?.toLowerCase() === EMAIL_PLATAFORMA_DEMO;
    console.log(`${esDemo ? "⚠ DEMO PÚBLICA" : "·  real"}: ${u.email} (${u.id})`);
  }
}

// ---------- 3. Pre-flight T-002B: multi-club ----------
console.log("\n── 3. Pre-flight T-002B (una cuenta = un club) ──");
const clubesPorUsuario = new Map();
for (const m of membresias ?? []) {
  const set = clubesPorUsuario.get(m.auth_user_id) ?? new Set();
  set.add(m.club_id);
  clubesPorUsuario.set(m.auth_user_id, set);
}
const multiClub = [...clubesPorUsuario.entries()].filter(([, s]) => s.size > 1);
if (multiClub.length === 0) {
  console.log("✓ Nadie tiene membresía en más de un club: `unique (auth_user_id)` se puede aplicar.");
} else {
  console.log("⚠ Estos usuarios romperían la constraint de T-002B (resolver antes):");
  for (const [uid, s] of multiClub) {
    const mail = (membresias ?? []).find((m) => m.auth_user_id === uid)?.email;
    console.log(`   · ${mail ?? uid} → ${s.size} clubes`);
  }
}

// ---------- Aplicar ----------
if (!APLICAR) {
  console.log("\nAuditoría solamente. Para ejecutar la contención:");
  console.log("  node scripts/contener-demo.mjs --aplicar\n");
  process.exit(0);
}

const password = env.DEMO_PASSWORD;
if (!password) {
  throw new Error(
    "Falta DEMO_PASSWORD en .env.local. Generá una clave nueva, ponela ahí y en Vercel, y volvé a correr.",
  );
}

console.log("\n── Aplicando contención ──");

// a) Eliminar la cuenta de plataforma demo (mata sus sesiones).
const plataformaDemo = porEmail.get(EMAIL_PLATAFORMA_DEMO);
if (!plataformaDemo) {
  console.log(`✓ ${EMAIL_PLATAFORMA_DEMO} ya no existe.`);
} else {
  const { error } = await supabase.auth.admin.deleteUser(plataformaDemo.id);
  if (error) throw error;
  console.log(`✓ Eliminada ${EMAIL_PLATAFORMA_DEMO} (${plataformaDemo.id}) y sus sesiones.`);
}

// b) Rotar clave + marcar demo en las cuentas que quedan.
for (const mail of EMAILS_DEMO) {
  const u = porEmail.get(mail);
  if (!u) {
    console.log(`·  ${mail} no existe (correr scripts/crear-usuarios-demo.mjs).`);
    continue;
  }
  const { error } = await supabase.auth.admin.updateUserById(u.id, {
    password,
    app_metadata: { demo: true },
  });
  if (error) throw error;
  console.log(`✓ ${mail}: clave rotada + app_metadata.demo = true.`);
}

console.log("\nListo. Verificar con: node scripts/verificar-contencion-demo.mjs\n");
