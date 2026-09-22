import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SECRET_KEY;
const email = process.env.SECRETARIA_ADMIN_EMAIL;
const nombre = process.env.SECRETARIA_ADMIN_NOMBRE ?? "Administración Secretaría";
const projectRef = url ? new URL(url).hostname.split(".")[0] : null;

if (!url || !clave || !email) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY o SECRETARIA_ADMIN_EMAIL.");
}
if (projectRef === "hjaeihdrrictmgilzaic") {
  throw new Error("BLOQUEADO: este script nunca se ejecuta contra producción.");
}
if (process.env.APP_ENV !== "staging") {
  throw new Error("Definí APP_ENV=staging para continuar.");
}

const supabase = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
let { data: organizaciones, error: errorOrganizaciones } = await supabase
  .from("club")
  .select("id")
  .eq("nombre", "Secretaría de Deportes de la Provincia de Salta")
  .eq("tipo_organizacion", "secretaria")
  .limit(1);
if (errorOrganizaciones) throw errorOrganizaciones;
let organizacionId = organizaciones?.[0]?.id;
if (!organizacionId) {
  const { data, error } = await supabase.from("club").insert({
    nombre: "Secretaría de Deportes de la Provincia de Salta",
    localidad: "Salta",
    departamento: "Capital",
    tipo_organizacion: "secretaria",
  }).select("id").single();
  if (error) throw error;
  organizacionId = data.id;
}

const { data: invitacion, error: errorInvitacion } = await supabase.auth.admin.inviteUserByEmail(email, {
  data: { nombre, origen: "secretaria-staging" },
});
if (errorInvitacion && !errorInvitacion.message.toLowerCase().includes("already")) throw errorInvitacion;
let usuarioId = invitacion.user?.id;
if (!usuarioId) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  usuarioId = data.users.find((usuario) => usuario.email?.toLowerCase() === email.toLowerCase())?.id;
}
if (!usuarioId) throw new Error("No se pudo resolver el usuario invitado.");

const { error: errorMembresia } = await supabase.from("membresia").upsert({
  club_id: organizacionId,
  auth_user_id: usuarioId,
  nombre,
  email,
  rol: "admin_secretaria",
  funcion: "Administración de Secretaría",
}, { onConflict: "club_id,auth_user_id" });
if (errorMembresia) throw errorMembresia;

console.log(`Espacio Secretaría configurado en staging para ${email}.`);

