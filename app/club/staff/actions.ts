"use server";

import { crearClienteServer } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { esCuentaDemo, MOTIVO_DEMO } from "@/lib/demo";
import type { RolMembresia } from "@/lib/tipos-db";
import { SOPORTE_EMAIL } from "@/lib/site";
import { generarAccesoOnboarding, linkDeAcceso } from "@/lib/acceso";

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
 *
 * T-001 del plan CTO: las cuentas de la VITRINA pública quedan fuera de
 * todo lo que toque Auth. El admin demo sigue viendo la pantalla de
 * staff (son lecturas por RLS sobre datos ficticios), pero no puede
 * invitar, regenerar links ni quitar miembros: hasta que demo y
 * producción sean proyectos separados (T-003), una clave pública con
 * acceso a `generateLink` es una vía de toma de cuenta.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

async function adminActual() {
  const supabase = await crearClienteServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // Sin filtrar por club: desde T-002B la base impone
  // `unique (auth_user_id)`, así que no puede haber dos filas.
  const { data: m, error: eM } = await supabase
    .from("membresia")
    .select("id, club_id, rol")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (eM) {
    // Devolver null acá bloquea TODAS las server actions del admin. Que
    // quede en el log del server y no como un "no sos admin" inexplicable.
    console.error("[adminActual] no se pudo leer la membresía:", eM.message);
  }
  if (!m || m.rol !== "admin_club") return null;
  return {
    supabase,
    membresiaId: m.id as string,
    clubId: m.club_id as string,
    esDemo: esCuentaDemo(user),
  };
}


function origenValido(origen: string) {
  return /^https?:\/\/[^\s/]+$/.test(origen);
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
  if (ctx.esDemo) return { ok: false, error: MOTIVO_DEMO };

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
  // T-002: si la cuenta ya fue activada, acá no se emite ningún token —
  // ni siquiera para incorporarla al club. Esa persona entra con su clave
  // o la recupera sola. Ver lib/acceso.ts.
  const acceso = await generarAccesoOnboarding(email, nombre);
  if (!acceso.ok) return { ok: false, error: acceso.error };
  const { authUserId, tokenHash, tipo: tipoLink, usuarioCreado } = acceso.data;

  // 1.5) T-002B · una cuenta = un club.
  //
  // Se consulta con el cliente ADMIN a propósito: el RLS del admin de este
  // club no ve membresías de otros clubes, así que desde la sesión esta
  // pregunta es imposible de responder.
  //
  // Por qué no alcanza con dejar que reviente la constraint: las dos
  // violaciones son `23505`, y el código de la fila 2) solo mira el código.
  // Verificado en el Supabase local (2026-09-13): el mismo club reporta
  // `membresia_club_id_auth_user_id_key` y otro club reporta
  // `membresia_auth_user_id_key`, así que el NOMBRE sí los distingue — pero
  // eso depende del orden en que Postgres evalúa los índices, que es un
  // detalle de implementación, y obligaría a parsear el mensaje de error.
  // El chequeo explícito no depende de nada de eso.
  const { data: membresiasPrevias } = await admin
    .from("membresia")
    .select("club_id")
    .eq("auth_user_id", authUserId);

  const yaEnAlgunClub = membresiasPrevias?.[0];
  if (yaEnAlgunClub) {
    if (usuarioCreado) await admin.auth.admin.deleteUser(authUserId);
    return {
      ok: false,
      error:
        yaEnAlgunClub.club_id === ctx.clubId
          ? "Esa persona ya es parte del staff del club."
          : // Mensaje GENÉRICO: decir "ya pertenece a otro club" le confirmaría
            // al admin que ese email es staff de otra institución. No es asunto
            // suyo y es exactamente el tipo de filtración que cierra T-002.
            `No se puede incorporar ese email. Si creés que es un error, escribinos a ${SOPORTE_EMAIL}.`,
    };
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
        // Backstop: con el chequeo de 1.5 esto solo se alcanza en una
        // carrera entre dos invitaciones simultáneas. Genérico a propósito:
        // acá ya no se puede saber cuál de las dos constraints falló.
        eMemb?.code === "23505"
          ? "No se pudo incorporar a esa persona: ya tiene una membresía."
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
  if (ctx.esDemo) return { ok: false, error: MOTIVO_DEMO };
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

  // T-002: reemitir el acceso solo tiene sentido para una cuenta que nunca
  // se usó. Si ya la activaron, generar un link acá sería entregarle al
  // admin la llave de esa persona — el agujero que esta tarea cierra.
  const acceso = await generarAccesoOnboarding(email);
  if (!acceso.ok) return { ok: false, error: acceso.error };
  return {
    ok: true,
    data: { link: linkDeAcceso(input.origen, acceso.data.tokenHash, acceso.data.tipo) },
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
  if (ctx.esDemo) return { ok: false, error: MOTIVO_DEMO };
  if (membresiaId === ctx.membresiaId) {
    return { ok: false, error: "No podés quitarte a vos mismo del club." };
  }
  const { error } = await ctx.supabase.from("membresia").delete().eq("id", membresiaId);
  if (error) return { ok: false, error: `No se pudo quitar: ${error.message}` };
  return { ok: true, data: null };
}
