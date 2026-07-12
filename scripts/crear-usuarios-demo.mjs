/**
 * Crea (idempotente) los 4 usuarios DEMO de la plataforma y sus
 * membresías en el club Antoniana, para que el login público permita
 * recorrer cada perfil con una sesión REAL (RLS de verdad, no
 * visibilidad de UI).
 *
 *   node scripts/crear-usuarios-demo.mjs
 *
 * Lee SUPABASE_SECRET_KEY y NEXT_PUBLIC_SUPABASE_URL de .env.local.
 * ⚠ Contraseña demo pública a propósito (la demo es abierta). Antes
 * de cargar datos reales del piloto: borrar estos usuarios o rotar
 * la contraseña.
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

export const PASSWORD_DEMO = "TalentoDemo26";

const USUARIOS = [
  {
    email: "plataforma@demo.talento.ar",
    nombre: "Secretaría de Deportes (demo)",
    rol: null, // plataforma: SIN membresía — solo observatorio agregado
    app_metadata: { plataforma: true },
  },
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
  .eq("nombre", "Club Atlético Antoniana")
  .single();
if (!club) throw new Error("No existe el club Antoniana: correr seed.sql antes");

for (const u of USUARIOS) {
  // Alta del usuario (o recuperación si ya existe)
  let userId;
  const creado = await supabase.auth.admin.createUser({
    email: u.email,
    password: PASSWORD_DEMO,
    email_confirm: true,
    app_metadata: u.app_metadata ?? {},
    user_metadata: { nombre: u.nombre },
  });
  if (creado.error) {
    if (!/already/i.test(creado.error.message)) throw creado.error;
    const { data } = await supabase.auth.admin.listUsers({ perPage: 200 });
    userId = data.users.find((x) => x.email === u.email)?.id;
    if (!userId) throw new Error(`No pude recuperar el usuario ${u.email}`);
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
  console.log(`✓ ${u.email} (${u.rol ?? "plataforma"})`);
}
console.log("Listo. Contraseña demo:", PASSWORD_DEMO);
