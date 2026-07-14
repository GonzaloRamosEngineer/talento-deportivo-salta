"use server";

import { crearClienteServer } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import type { RolMembresia } from "@/lib/tipos-db";

/**
 * Server actions del circuito de staff (pasos 4-5 de docs/OPERACION.md).
 *
 * La invitación es POR LINK, no por email: el server genera el link de
 * acceso (auth.admin.generateLink, sin enviar mail) y el admin se lo
 * comparte al profe por WhatsApp — que es como se comunica un club de
 * verdad, y evita depender del SMTP por defecto de Supabase (límite de
 * ~2 mails/hora). Cuando haya SMTP propio (Resend), agregar el envío
 * es un paso más acá, no un cambio de modelo.
 *
 * Seguridad: solo el cliente admin (secret key) puede tocar Auth, así
 * que TODA action verifica primero que quien llama sea admin_club de
 * su club (misma regla que es_admin_de en RLS). La escritura de
 * membresia/membresia_categoria se hace con el cliente de SESIÓN del
 * que llama, para que RLS siga siendo la última palabra.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

async function adminActual() {
  const supabase = await crearClienteServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: m } = await supabase
    .from("membresia")
    .select("id, club_id, rol")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!m || m.rol !== "admin_club") return null;
  return { supabase, membresiaId: m.id as string, clubId: m.club_id as string };
}

function linkDeAcceso(origen: string, tokenHash: string, tipo: "invite" | "recovery") {
  return `${origen}/auth/confirmar?token_hash=${encodeURIComponent(tokenHash)}&type=${tipo}`;
}

function origenValido(origen: string) {
  return /^https?:\/\/[^\s/]+$/.test(origen);
}

async function buscarUsuarioPorEmail(email: string) {
  const admin = crearClienteAdmin();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;
  return data.users.find((u) => u.email?.toLowerCase() === email) ?? null;
}

export async function invitarMiembro(input: {
  nombre: string;
  email: string;
  rol: RolMembresia;
  categoriaIds: string[];
  /** función profesional (descriptiva, opcional) */
  funcion?: string;
  /** location.origin del admin — solo se usa para armar el link que se le devuelve */
  origen: string;
}): Promise<Resultado<{ link: string }>> {
  const ctx = await adminActual();
  if (!ctx) return { ok: false, error: "Solo el admin del club puede invitar staff." };

  const nombre = input.nombre.trim();
  const email = input.email.trim().toLowerCase();
  if (!nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Revisá el nombre y el email." };
  }
  if (!origenValido(input.origen)) return { ok: false, error: "Origen inválido." };
  if (!["admin_club", "entrenador", "comision_directiva"].includes(input.rol)) {
    return { ok: false, error: "Rol inválido." };
  }

  const admin = crearClienteAdmin();

  // 1) Usuario en Auth: invitación nueva, o link de acceso si ya existe
  //    (ej. lo quitaron del staff y vuelve).
  let authUserId: string;
  let tipoLink: "invite" | "recovery" = "invite";
  let tokenHash: string;
  let usuarioCreado = false;

  const invite = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { nombre } },
  });
  if (!invite.error) {
    authUserId = invite.data.user.id;
    tokenHash = invite.data.properties.hashed_token;
    usuarioCreado = true;
  } else {
    const existente = await buscarUsuarioPorEmail(email);
    if (!existente) {
      return { ok: false, error: `No se pudo invitar: ${invite.error.message}` };
    }
    const recovery = await admin.auth.admin.generateLink({ type: "recovery", email });
    if (recovery.error) {
      return { ok: false, error: `No se pudo generar el link: ${recovery.error.message}` };
    }
    authUserId = existente.id;
    tokenHash = recovery.data.properties.hashed_token;
    tipoLink = "recovery";
  }

  // 2) Membresía con el cliente de sesión: RLS (es_admin_de) manda.
  const { data: memb, error: eMemb } = await ctx.supabase
    .from("membresia")
    .insert({
      club_id: ctx.clubId,
      auth_user_id: authUserId,
      nombre,
      email,
      rol: input.rol,
      funcion: input.funcion?.trim() || null,
    })
    .select("id")
    .single();
  if (eMemb || !memb) {
    // No dejar un usuario huérfano en Auth si lo acabamos de crear.
    if (usuarioCreado) await admin.auth.admin.deleteUser(authUserId);
    return {
      ok: false,
      error:
        eMemb?.code === "23505"
          ? "Esa persona ya es parte del staff del club."
          : `No se pudo crear la membresía: ${eMemb?.message ?? "error desconocido"}`,
    };
  }

  // 3) Categorías asignadas (solo tiene sentido para el profe).
  if (input.rol === "entrenador" && input.categoriaIds.length > 0) {
    const { error: eCat } = await ctx.supabase.from("membresia_categoria").insert(
      input.categoriaIds.map((categoria_id) => ({ membresia_id: memb.id, categoria_id })),
    );
    if (eCat) {
      return {
        ok: false,
        error: `Se invitó, pero falló la asignación de categorías: ${eCat.message}. Asignalas desde la lista.`,
      };
    }
  }

  return { ok: true, data: { link: linkDeAcceso(input.origen, tokenHash, tipoLink) } };
}

/** Nuevo link de acceso para alguien ya invitado (perdió el link o la clave). */
export async function regenerarLink(input: {
  email: string;
  origen: string;
}): Promise<Resultado<{ link: string }>> {
  const ctx = await adminActual();
  if (!ctx) return { ok: false, error: "Solo el admin del club puede generar links." };
  if (!origenValido(input.origen)) return { ok: false, error: "Origen inválido." };
  const email = input.email.trim().toLowerCase();

  // Solo para gente del PROPIO club (no cualquier email de la plataforma).
  const { data: memb } = await ctx.supabase
    .from("membresia")
    .select("id")
    .eq("club_id", ctx.clubId)
    .eq("email", email)
    .maybeSingle();
  if (!memb) return { ok: false, error: "Ese email no es del staff de tu club." };

  const admin = crearClienteAdmin();
  const invite = await admin.auth.admin.generateLink({ type: "invite", email });
  if (!invite.error) {
    return {
      ok: true,
      data: { link: linkDeAcceso(input.origen, invite.data.properties.hashed_token, "invite") },
    };
  }
  const recovery = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (recovery.error) {
    return { ok: false, error: `No se pudo generar el link: ${recovery.error.message}` };
  }
  return {
    ok: true,
    data: { link: linkDeAcceso(input.origen, recovery.data.properties.hashed_token, "recovery") },
  };
}

/** ¿Quiénes ya entraron al menos una vez? (para el badge "pendiente") */
export async function estadoStaff(): Promise<Resultado<Record<string, { entro: boolean }>>> {
  const ctx = await adminActual();
  if (!ctx) return { ok: false, error: "Solo para el admin del club." };

  const { data: miembros } = await ctx.supabase
    .from("membresia")
    .select("email")
    .eq("club_id", ctx.clubId);
  const emails = new Set((miembros ?? []).map((m) => m.email?.toLowerCase()).filter(Boolean));

  const admin = crearClienteAdmin();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return { ok: false, error: error.message };

  const estado: Record<string, { entro: boolean }> = {};
  for (const u of data.users) {
    const mail = u.email?.toLowerCase();
    if (mail && emails.has(mail)) {
      estado[mail] = { entro: Boolean(u.last_sign_in_at) };
    }
  }
  return { ok: true, data: estado };
}

/** Quita a alguien del staff (la cuenta de Auth queda, pero sin ningún acceso). */
export async function quitarMiembro(membresiaId: string): Promise<Resultado<null>> {
  const ctx = await adminActual();
  if (!ctx) return { ok: false, error: "Solo el admin del club puede quitar staff." };
  if (membresiaId === ctx.membresiaId) {
    return { ok: false, error: "No podés quitarte a vos mismo del club." };
  }
  const { error } = await ctx.supabase.from("membresia").delete().eq("id", membresiaId);
  if (error) return { ok: false, error: `No se pudo quitar: ${error.message}` };
  return { ok: true, data: null };
}
