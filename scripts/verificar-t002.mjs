/**
 * T-002 · Ningún camino emite un token de una cuenta YA ACTIVADA.
 *
 * Este script no prueba el código de la app: prueba el COMPORTAMIENTO DEL
 * BACKEND del que depende la regla, que es lo que puede cambiar sin avisar
 * bajo nuestros pies. Verificado el 2026-09-13 contra el proyecto real.
 *
 * El resultado importante: `magiclink` y `recovery` devuelven un token
 * perfectamente usable para una cuenta activada, sin error ni advertencia.
 * Es decir: **la API no protege nada**. Lo único que impide entregarle a un
 * admin la llave de otra persona es el chequeo explícito de
 * `lib/acceso.ts` (`estado.activada` → negarse). Si alguien lo quita
 * pensando que "magiclink es inofensivo", reabre el agujero de T-002.
 *
 * No deja nada persistente: borra sus cuentas de prueba pase lo que pase.
 *
 *   node scripts/verificar-t002.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const publico = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);

const sello = Date.now();
const creados = [];
let ok = 0, fallo = 0;
const assert = (cond, txt) => {
  console.log(`  ${cond ? "✅" : "❌"} ${txt}`);
  if (cond) ok++;
  else fallo++;
};
const token = (r) => Boolean(r.data?.properties?.hashed_token);

try {
  // ---------- Cuenta PENDIENTE (existe, nunca entró) ----------
  console.log("\n1) Cuenta nueva y cuenta pendiente → el onboarding funciona");
  const pendiente = `pendiente-${sello}@prueba.local`;
  const a = await admin.auth.admin.generateLink({ type: "invite", email: pendiente });
  if (a.data?.user) creados.push(a.data.user.id);
  assert(!a.error && token(a), "invite emite token para un email nuevo");
  assert(!Boolean(a.data?.user?.last_sign_in_at), "la cuenta nace sin activar (last_sign_in_at vacío)");

  const b = await admin.auth.admin.generateLink({ type: "magiclink", email: pendiente });
  assert(!b.error && token(b), "magiclink reemite onboarding a una cuenta pendiente");

  // ---------- Cuenta ACTIVADA ----------
  console.log("\n2) Cuenta ACTIVADA → la API NO protege: emite tokens igual");
  const activada = `activada-${sello}@prueba.local`;
  const clave = `Prueba-${sello}-xyz`;
  const c = await admin.auth.admin.createUser({ email: activada, password: clave, email_confirm: true });
  if (c.error || !c.data?.user) throw new Error(`createUser: ${c.error?.message ?? "sin data"}`);
  creados.push(c.data.user.id);
  const s = await publico.auth.signInWithPassword({ email: activada, password: clave });
  if (s.error) throw new Error(`login: ${s.error.message}`);

  const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = lista.users.find((x) => x.email === activada);
  assert(Boolean(u?.last_sign_in_at), "last_sign_in_at queda seteado → la regla puede detectarla");

  const inv = await admin.auth.admin.generateLink({ type: "invite", email: activada });
  assert(Boolean(inv.error) && !token(inv), "invite SÍ se niega para una cuenta activada");

  const mag = await admin.auth.admin.generateLink({ type: "magiclink", email: activada });
  assert(token(mag), "⚠️  magiclink ENTREGA token de una cuenta activada (por eso hace falta el guard)");

  const rec = await admin.auth.admin.generateLink({ type: "recovery", email: activada });
  assert(token(rec), "⚠️  recovery ENTREGA token de una cuenta activada (el agujero original de T-002)");

  // ---------- La regla ----------
  console.log("\n3) El dato que distingue está disponible y es fiable");
  const p = lista.users.find((x) => x.email === pendiente);
  assert(!Boolean(p?.last_sign_in_at) && Boolean(u?.last_sign_in_at),
    "pendiente y activada se distinguen con last_sign_in_at");
  console.log("\n  → Conclusión: la seguridad la pone lib/acceso.ts, no la API.");
} catch (e) {
  console.error("\n💥", e.message);
  fallo++;
} finally {
  for (const id of creados) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log(`\n🧹 ${creados.length} cuentas de prueba borradas`);
  console.log(`\n${fallo === 0 ? "✅" : "❌"} ${ok} OK · ${fallo} fallos`);
  process.exit(fallo === 0 ? 0 : 1);
}
