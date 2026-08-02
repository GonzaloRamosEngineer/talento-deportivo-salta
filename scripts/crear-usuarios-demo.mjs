/**
 * Crea (idempotente) los usuarios DEMO de la vitrina y sus membresías
 * en el club Antoniana, para que el login público permita recorrer cada
 * perfil con una sesión REAL (RLS de verdad, no visibilidad de UI).
 *
 *   node scripts/crear-usuarios-demo.mjs
 *
 * Lee SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL y DEMO_PASSWORD de
 * .env.local. Corre idempotente: al reejecutarlo sincroniza contraseña
 * y `app_metadata` de los usuarios que ya existan.
 *
 * T-001 del plan CTO — tres cambios respecto de la versión original:
 *
 * 1. NO se crea `plataforma@demo.talento.ar`. Tenía
 *    `app_metadata.plataforma`, y con la clave pública en el bundle
 *    cualquiera podía enumerar clubes y administradores reales y acuñar
 *    un recovery link para tomarle la cuenta a un admin. El observatorio
 *    de la demo se recorre anónimo, sobre el mock agregado.
 *    Para eliminarla de un proyecto donde ya exista:
 *    `node scripts/contener-demo.mjs`.
 * 2. La contraseña sale de `DEMO_PASSWORD`, no del código. Sigue siendo
 *    pública en el sentido de que cualquiera puede abrir la demo, pero
 *    ya no viaja en el bundle ni se rota con un redeploy.
 * 3. Todas las cuentas llevan `app_metadata.demo = true`, que es lo que
 *    `lib/demo.ts` usa para bloquearlas en toda action sensible.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export const PASSWORD_DEMO = env.DEMO_PASSWORD;
if (!PASSWORD_DEMO) {
  throw new Error(
    "Falta DEMO_PASSWORD en .env.local (y en las env vars de Vercel: la usa app/login/actions.ts).",
  );
}

const USUARIOS = [
  {
    email: "comision@demo.talento.ar",
    nombre: "Carlos Ibarra (demo)",
    rol: "comision_directiva",
  },
  {
    email: "admin@demo.talento.ar",
    nombre: "Diego Salvatierra (demo)",
    rol: "admin_club",
  },
  {
    email: "profe@demo.talento.ar",
    nombre: "Marcela Díaz (demo)",
    rol: "entrenador",
    categorias: ["9ª División", "Escuelita 2016"],
  },
];

const { data: club } = await supabase
  .from("club")
  .select("id")
  .eq("nombre", "Club Fundación Evolución Antoniana")
  .single();
if (!club) throw new Error("No existe el club de la vitrina: correr seed.sql antes");

for (const u of USUARIOS) {
  // Alta del usuario (o sincronización si ya existe)
  let userId;
  const creado = await supabase.auth.admin.createUser({
    email: u.email,
    password: PASSWORD_DEMO,
    email_confirm: true,
    app_metadata: { demo: true },
    user_metadata: { nombre: u.nombre },
  });
  if (creado.error) {
    if (!/already/i.test(creado.error.message)) throw creado.error;
    const { data } = await supabase.auth.admin.listUsers({ perPage: 200 });
    userId = data.users.find((x) => x.email === u.email)?.id;
    if (!userId) throw new Error(`No pude recuperar el usuario ${u.email}`);
    // Reejecución: alinear clave y flag demo con lo que espera la app.
    const { error: eSync } = await supabase.auth.admin.updateUserById(userId, {
      password: PASSWORD_DEMO,
      app_metadata: { demo: true },
    });
    if (eSync) throw eSync;
  } else {
    userId = creado.data.user.id;
  }

  if (u.rol) {
    const { data: memb, error } = await supabase
      .from("membresia")
      .upsert(
        {
          club_id: club.id,
          auth_user_id: userId,
          nombre: u.nombre,
          email: u.email,
          rol: u.rol,
        },
        { onConflict: "club_id,auth_user_id" },
      )
      .select("id")
      .single();
    if (error) throw error;

    if (u.categorias?.length) {
      const { data: cats, error: e1 } = await supabase
        .from("categoria")
        .select("id, nombre")
        .eq("club_id", club.id)
        .in("nombre", u.categorias);
      if (e1) throw e1;
      if (cats.length !== u.categorias.length)
        throw new Error(`Faltan categorías para ${u.email}`);
      const { error: e2 } = await supabase
        .from("membresia_categoria")
        .upsert(
          cats.map((c) => ({ membresia_id: memb.id, categoria_id: c.id })),
          { onConflict: "membresia_id,categoria_id" },
        );
      if (e2) throw e2;
    }
  }
  console.log(`✓ ${u.email} (${u.rol})`);
}
console.log(
  "Listo. La contraseña sale de DEMO_PASSWORD (no se imprime: rotarla es cambiar la env var).",
);
