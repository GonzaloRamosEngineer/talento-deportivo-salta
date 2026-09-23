#!/usr/bin/env node
/**
 * Alta (o verificación) de la cuenta privada del Espacio Secretaría.
 *
 * Hace tres cosas, todas idempotentes:
 *   1. ¿Existe ya la cuenta en Auth de este proyecto? Si no, la invita.
 *   2. ¿Existe el club de tipo `secretaria`? Si no, lo crea.
 *   3. ¿Existe la membresía con rol operativo? Si no, la crea.
 *
 * Nunca fija una contraseña. El acceso se entrega como link de invitación
 * construido con `linkDeAcceso()` — que apunta a NUESTRO /auth/confirmar.
 * Usar el `redirectTo` nativo de Supabase manda el token en el fragmento y
 * el link muere antes de llegar: ya nos pasó.
 *
 * Se niega a operar sobre una cuenta demo. Además del trigger en la base,
 * porque este script corre con service key y el error tiene que ser claro.
 *
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... \
 *   SECRETARIA_EMAIL=... [SITE_URL=...] \
 *   node scripts/alta-secretaria.mjs [--ejecutar]
 */
import { createClient } from "@supabase/supabase-js";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const EMAIL = (process.env.SECRETARIA_EMAIL ?? "").trim().toLowerCase();
const ORIGEN = process.env.SITE_URL ?? "http://localhost:3000";
const EJECUTAR = process.argv.includes("--ejecutar");

if (!URL_SB || !KEY || !EMAIL) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY o SECRETARIA_EMAIL.");
  process.exit(1);
}
if (/@demo\.talento\.ar$/.test(EMAIL) || /\.demo\.local$/.test(EMAIL)) {
  console.error("Esa es una cuenta de la demo. No puede acceder a Evaluaciones.");
  process.exit(1);
}

const sb = createClient(URL_SB, KEY, { auth: { persistSession: false } });
const plan = [];
const hacer = async (etiqueta, fn) => {
  if (!EJECUTAR) { plan.push(`[haría] ${etiqueta}`); return null; }
  const r = await fn();
  plan.push(`[hecho] ${etiqueta}`);
  return r;
};

// 1) la cuenta
let { data: lista, error: eL } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (eL) throw new Error(`No pude listar cuentas: ${eL.message}`);
let usuario = lista.users.find((u) => (u.email ?? "").toLowerCase() === EMAIL);
if (usuario) {
  plan.push(`[ok] la cuenta ${EMAIL} YA EXISTE (id ${usuario.id.slice(0, 8)}…, confirmada: ${Boolean(usuario.email_confirmed_at)})`);
} else {
  await hacer(`invitar a ${EMAIL}`, async () => {
    const { data, error } = await sb.auth.admin.generateLink({ type: "invite", email: EMAIL });
    if (error) throw new Error(`No pude generar la invitación: ${error.message}`);
    usuario = data.user;
    const { linkDeAcceso } = await import("../lib/acceso.ts").catch(() => ({
      linkDeAcceso: (o, t, tipo) => `${o}/auth/confirmar?token_hash=${encodeURIComponent(t)}&type=${tipo}`,
    }));
    console.log("\nLINK DE ACCESO (entregar por un canal privado, vence pronto):");
    console.log(linkDeAcceso(ORIGEN, data.properties.hashed_token, "invite"));
    return data;
  });
}

// El club y la membresía NO se crean acá.
//
// Los creaba, y estaba mal: los generaba con UUID nuevos, mientras el
// traslado trae el club y la membresía de staging con SUS uuid. Resultado:
// dos organizaciones Secretaría y dos membresías para la misma persona, una
// de ellas huérfana de datos. Y con "una cuenta = un club" restituido
// (migración 20260923140000) la segunda membresía ni siquiera entra: el
// traslado falla por unicidad.
//
// La división correcta es por quién es dueño del identificador:
//   - auth.users lo gobierna Auth del proyecto destino  -> lo crea este script
//   - club y membresia los gobierna el traslado         -> los trae él, con
//     los uuid de origen, y resuelve auth_user_id por email.
//
// Por eso este script corre PRIMERO y solo deja la cuenta lista.
const { data: yaClub } = await sb.from("club").select("id,nombre").eq("tipo_organizacion", "secretaria");
if (yaClub?.length) {
  plan.push(`[atención] ya hay ${yaClub.length} Espacio(s) Secretaría en el destino: ${yaClub.map((c) => c.nombre).join(", ")}.`);
  plan.push("           El traslado usa el uuid de origen. Si no es el mismo club, revisalo antes de seguir.");
} else {
  plan.push("[ok] no hay ningún Espacio Secretaría en el destino: el traslado lo va a crear.");
}
plan.push("[siguiente] correr scripts/trasladar-secretaria.mjs, que crea club + membresía con los uuid de origen.");

console.log("\n" + plan.join("\n"));
if (!EJECUTAR) console.log("\n(ensayo: no se aplicó nada — agregá --ejecutar)");
