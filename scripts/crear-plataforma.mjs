/**
 * Alta de una cuenta REAL con perfil PLATAFORMA (el rol
 * "Liga / Secretaría de Deportes", `perfil = "super_admin"` en la UI).
 *
 *   node scripts/crear-plataforma.mjs <email>              # auditoría, no toca nada
 *   node scripts/crear-plataforma.mjs <email> --aplicar    # crea o promueve
 *   node scripts/crear-plataforma.mjs <email> --aplicar --nueva-clave
 *
 * Cómo se identifica este perfil (no es un rol de `membresia`):
 *
 * - `app_metadata.plataforma = true`, que solo se escribe con service
 *   role — el usuario no puede autoasignárselo. Es el mismo gate que
 *   usan `esPlataforma()` en `app/plataforma/actions.ts` y
 *   `es_plataforma()` en la RPC del observatorio.
 * - **Sin fila en `membresia`**, a propósito (regla #4 de CLAUDE.md):
 *   plataforma y club son mutuamente excluyentes. Si el email ya es
 *   staff de un club, este script se niega en vez de dejarlo a mitad de
 *   camino.
 *
 * Por qué existe: la cuenta `plataforma@demo.talento.ar` se eliminó en
 * T-001 (clave pública en el bundle ⇒ cualquiera podía acuñar recovery
 * links de administradores reales). La demo recorre el observatorio
 * anónima sobre el mock; para ver los agregados REALES hace falta una
 * cuenta de verdad, y esa cuenta se da de alta acá.
 *
 * ⚠ RIESGO VIGENTE, leer antes de usar: una cuenta de plataforma puede
 * `linkAdminClub()`, o sea acuñar un link de recuperación del admin de
 * cualquier club. Eso es T-002 del plan CTO y todavía está abierto. Con
 * un solo club ficticio no hay nada que tomar, pero esta cuenta hay que
 * tratarla como la llave maestra de la instancia: clave larga y única,
 * en un gestor, y una sola cuenta de plataforma.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const APLICAR = process.argv.includes("--aplicar");
const NUEVA_CLAVE = process.argv.includes("--nueva-clave");
const email = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"))?.trim().toLowerCase();

if (!email || !email.includes("@")) {
  console.error("Uso: node scripts/crear-plataforma.mjs <email> [--aplicar] [--nueva-clave]");
  process.exit(1);
}

// Espeja `EMAILS_DEMO` de lib/demo.ts. Una cuenta demo NO puede ser
// plataforma: `esPlataforma()` la rechaza aunque tenga el flag, así que
// el alta quedaría muerta.
const EMAILS_DEMO = [
  "profe@demo.talento.ar",
  "admin@demo.talento.ar",
  "comision@demo.talento.ar",
];
if (EMAILS_DEMO.includes(email) || email.endsWith("@demo.talento.ar")) {
  console.error(
    `✗ ${email} es una cuenta de la vitrina. lib/demo.ts las rechaza en el gate de\n` +
      "  plataforma, así que el privilegio no serviría. Usá un email real.",
  );
  process.exit(1);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Clave larga y aleatoria; se imprime UNA vez y no se guarda en ningún archivo. */
const generarClave = () =>
  "TdsPlat-" + randomBytes(18).toString("base64url").replace(/[-_]/g, "").slice(0, 22);

const { data: lista, error: eLista } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (eLista) throw eLista;
const existente = lista.users.find((u) => u.email?.toLowerCase() === email);

console.log(`\n── Estado de ${email} ──`);

// ---------- 1. ¿Ya hay otra cuenta de plataforma? ----------
const otras = lista.users.filter(
  (u) => u.app_metadata?.plataforma === true && u.email?.toLowerCase() !== email,
);
if (otras.length === 0) {
  console.log("✓ No hay ninguna otra cuenta con privilegio de plataforma.");
} else {
  console.log("⚠ Ya existen otras cuentas de plataforma (conviene tener UNA sola):");
  for (const u of otras) console.log(`   · ${u.email} (${u.id})`);
}

// ---------- 2. ¿El email es staff de algún club? ----------
const { data: membresias, error: eMem } = await supabase
  .from("membresia")
  .select("id, club_id, rol, email, auth_user_id")
  .eq("email", email);
if (eMem) throw eMem;
const membresiasUsuario = existente
  ? [
      ...(membresias ?? []),
      ...((
        await supabase
          .from("membresia")
          .select("id, club_id, rol, email, auth_user_id")
          .eq("auth_user_id", existente.id)
      ).data ?? []),
    ].filter((m, i, arr) => arr.findIndex((o) => o.id === m.id) === i)
  : (membresias ?? []);

if (membresiasUsuario.length === 0) {
  console.log("✓ No tiene membresía en ningún club: puede ser plataforma.");
} else {
  console.log("✗ Tiene membresía de club, así que NO puede ser plataforma (regla #4):");
  for (const m of membresiasUsuario) console.log(`   · club ${m.club_id} como ${m.rol}`);
  console.log(
    "\n  Plataforma y club son mutuamente excluyentes: `perfil-context.tsx` resuelve\n" +
      "  plataforma ANTES de mirar `membresia`, así que la cuenta perdería el acceso\n" +
      "  al club sin avisar. Usá otro email para la plataforma.",
  );
  process.exit(1);
}

// ---------- 3. La cuenta ----------
if (!existente) {
  console.log("·  El usuario no existe todavía: se crearía con clave nueva.");
} else {
  const yaEs = existente.app_metadata?.plataforma === true;
  console.log(
    `·  El usuario existe (${existente.id}), plataforma = ${yaEs}` +
      `, último ingreso: ${existente.last_sign_in_at ?? "nunca"}`,
  );
  if (existente.app_metadata?.demo === true) {
    console.log("✗ Está marcada como cuenta demo (app_metadata.demo): el gate la rechaza.");
    process.exit(1);
  }
}

if (!APLICAR) {
  console.log("\nAuditoría solamente. Para ejecutar:");
  console.log(`  node scripts/crear-plataforma.mjs ${email} --aplicar\n`);
  process.exit(0);
}

console.log("\n── Aplicando ──");
let clave = null;

if (!existente) {
  clave = generarClave();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: clave,
    email_confirm: true, // sin mail de confirmación: el SMTP default da ~2/hora
    app_metadata: { plataforma: true },
    user_metadata: { nombre: "Plataforma" },
  });
  if (error) throw error;
  console.log(`✓ Cuenta creada (${data.user.id}) con app_metadata.plataforma = true.`);
} else {
  if (NUEVA_CLAVE) clave = generarClave();
  const { error } = await supabase.auth.admin.updateUserById(existente.id, {
    // app_metadata se mergea, pero lo mandamos completo para no depender de eso.
    app_metadata: { ...(existente.app_metadata ?? {}), plataforma: true },
    ...(clave ? { password: clave } : {}),
  });
  if (error) throw error;
  console.log(`✓ ${email} promovida a plataforma${clave ? " + clave nueva" : ""}.`);
}

// ---------- 4. Verificar contra el backend ----------
const { data: verif } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
const u = verif.users.find((x) => x.email?.toLowerCase() === email);
const { data: memPost } = await supabase
  .from("membresia")
  .select("id")
  .eq("auth_user_id", u.id);

console.log("\n── Verificación ──");
console.log(`${u.app_metadata?.plataforma === true ? "✓" : "✗"} app_metadata.plataforma = true`);
console.log(`${(memPost ?? []).length === 0 ? "✓" : "✗"} sin fila en membresia`);
console.log(`${u.app_metadata?.demo !== true ? "✓" : "✗"} no está marcada como demo`);

if (clave) {
  console.log("\n┌─ CLAVE (se muestra una sola vez, no queda en ningún archivo) ─");
  console.log(`│  ${email}`);
  console.log(`│  ${clave}`);
  console.log("└─ Guardala en el gestor de claves y cambiala en /cuenta/clave.\n");
} else {
  console.log("\nLa cuenta ya tenía clave; no se tocó. Para rotarla: --nueva-clave\n");
}

console.log("Entrá por /login con 'O CON TU CUENTA' (no por las tarjetas de la demo).");
console.log("El nav de plataforma es Clubes · Parámetros · Sugerencias + /observatorio real.\n");
