/**
 * Limpia lo que crea la prueba e2e de alta de clubes
 * (scratchpad/e2e-clubes.mjs): el club "Club E2E Salta" (con sus
 * membresías por cascada), su escudo en Storage y el usuario Auth del
 * admin de prueba. Idempotente — el e2e ya borra el club desde la
 * pantalla; esto es red de seguridad si el recorrido quedó a medias.
 *
 *   node scripts/limpiar-e2e-clubes.mjs
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

const CLUB_E2E = "Club E2E Salta";
const ADMIN_EMAIL = "e2e-admin-club@prueba.talento.ar";

const { data: club } = await admin
  .from("club")
  .select("id")
  .eq("nombre", CLUB_E2E)
  .maybeSingle();

if (club) {
  const { data: archivos } = await admin.storage.from("escudos").list("", { search: club.id });
  if (archivos && archivos.length > 0) {
    await admin.storage.from("escudos").remove(archivos.map((a) => a.name));
  }
  await admin.from("club").delete().eq("id", club.id);
  console.log(`Club "${CLUB_E2E}" borrado (membresías por cascada).`);
} else {
  console.log(`No hay club "${CLUB_E2E}" (ya limpio).`);
}

const { data: usuarios } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const user = usuarios?.users.find((u) => u.email === ADMIN_EMAIL);
if (user) {
  await admin.auth.admin.deleteUser(user.id);
  console.log(`Usuario Auth ${ADMIN_EMAIL} borrado.`);
} else {
  console.log(`No hay usuario ${ADMIN_EMAIL} (ya limpio).`);
}
console.log("Limpieza e2e de clubes: listo.");
