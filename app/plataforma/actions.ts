"use server";

import { crearClienteServer } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { generarAccesoOnboarding, linkDeAcceso } from "@/lib/acceso";
import {
  esUsuarioPlataforma,
  listarSolicitudesDisciplina as listarSolicitudes,
  resolverSolicitudDisciplina as resolverSolicitud,
  type ResolucionSolicitud,
  type SolicitudDisciplinaPlataforma,
} from "@/lib/plataforma/solicitudes";

/**
 * Server actions de la PLATAFORMA (pasos 1-2 de docs/OPERACION.md,
 * antes por script — Ola 1.5 los hace pantalla): alta y edición de
 * clubes, escudo y link de acceso del primer admin.
 *
 * Seguridad: el perfil plataforma NO tiene membresía ni filas por RLS
 * (a propósito). Por eso acá TODO va con el cliente admin (service
 * role), y CADA action verifica primero que quien llama tenga
 * `app_metadata.plataforma` — el mismo gate que `es_plataforma()` en
 * la RPC del observatorio; app_metadata solo se escribe con service
 * role, el usuario no puede autoasignárselo.
 *
 * La invitación del admin es POR LINK (igual que el staff del club):
 * el server genera el link y la plataforma se lo pasa al referente
 * por WhatsApp. Sin dependencia del SMTP default de Supabase.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ClubPlataforma {
  id: string;
  nombre: string;
  localidad: string | null;
  departamento: string | null;
  escudoUrl: string | null;
  deportistas: number;
  staff: number;
  admin: { nombre: string; email: string | null; entro: boolean } | null;
}

/**
 * Gate de plataforma. `app_metadata` solo se escribe con service role,
 * así que el usuario no puede autoasignárselo.
 *
 * T-001 del plan CTO: ninguna cuenta de la vitrina pública pasa este
 * gate, ni siquiera si alguien le devolviera el flag. La cuenta
 * `plataforma@demo.talento.ar` se eliminó porque desde acá podía
 * enumerar clubes y administradores reales y acuñar un recovery link
 * para tomar la cuenta de un admin (`linkAdminClub`). Es defensa en
 * profundidad, no la contención principal.
 */
async function esPlataforma(): Promise<boolean> {
  return esUsuarioPlataforma(await usuarioActual());
}

async function usuarioActual() {
  const supabase = await crearClienteServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}


function origenValido(origen: string) {
  return /^https?:\/\/[^\s/]+$/.test(origen);
}


/**
 * Link de acceso de onboarding para un email.
 *
 * T-002: antes esto caía en `recovery` cuando el email ya existía, y le
 * devolvía ese token a la plataforma — con él se podía fijar la contraseña
 * del admin de cualquier club y entrar como él. La regla vive ahora en
 * `lib/acceso.ts` y es única para las tres vías de emisión: si la cuenta ya
 * fue activada, no se emite nada.
 */
async function generarLinkAcceso(
  email: string,
  nombre: string | undefined,
  origen: string,
): Promise<Resultado<{ authUserId: string; link: string; usuarioCreado: boolean }>> {
  const acceso = await generarAccesoOnboarding(email, nombre);
  if (!acceso.ok) return { ok: false, error: acceso.error };
  return {
    ok: true,
    data: {
      authUserId: acceso.data.authUserId,
      link: linkDeAcceso(origen, acceso.data.tokenHash, acceso.data.tipo),
      usuarioCreado: acceso.data.usuarioCreado,
    },
  };
}

export async function listarClubes(): Promise<Resultado<ClubPlataforma[]>> {
  if (!(await esPlataforma())) return { ok: false, error: "Solo para la plataforma." };
  const admin = crearClienteAdmin();

  const [{ data: clubes, error }, { data: membresias }, { data: deportistas }, usuarios] =
    await Promise.all([
      admin
        .from("club")
        .select("id, nombre, localidad, departamento, escudo_url")
        .order("nombre"),
      admin.from("membresia").select("club_id, nombre, email, rol, auth_user_id, creado_en"),
      admin.from("deportista").select("club_id").eq("activo", true),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
  if (error) return { ok: false, error: error.message };

  const entroPorUsuario = new Map(
    (usuarios.data?.users ?? []).map((u) => [u.id, Boolean(u.last_sign_in_at)]),
  );
  const deportistasPorClub = new Map<string, number>();
  for (const d of deportistas ?? []) {
    deportistasPorClub.set(d.club_id, (deportistasPorClub.get(d.club_id) ?? 0) + 1);
  }

  const lista: ClubPlataforma[] = (clubes ?? []).map((c) => {
    const delClub = (membresias ?? []).filter((m) => m.club_id === c.id);
    const admins = delClub
      .filter((m) => m.rol === "admin_club")
      .sort((a, b) => String(a.creado_en).localeCompare(String(b.creado_en)));
    const primero = admins[0] ?? null;
    return {
      id: c.id,
      nombre: c.nombre,
      localidad: c.localidad,
      departamento: c.departamento,
      escudoUrl: c.escudo_url,
      deportistas: deportistasPorClub.get(c.id) ?? 0,
      staff: delClub.length,
      admin: primero
        ? {
            nombre: primero.nombre,
            email: primero.email,
            entro: entroPorUsuario.get(primero.auth_user_id) ?? false,
          }
        : null,
    };
  });
  return { ok: true, data: lista };
}

export async function crearClub(input: {
  nombre: string;
  localidad: string;
  departamento: string;
  adminNombre: string;
  adminEmail: string;
  /** location.origin de la plataforma — solo para armar el link devuelto */
  origen: string;
}): Promise<Resultado<{ clubId: string; link: string }>> {
  if (!(await esPlataforma())) return { ok: false, error: "Solo para la plataforma." };

  const nombre = input.nombre.trim();
  const adminNombre = input.adminNombre.trim();
  const adminEmail = input.adminEmail.trim().toLowerCase();
  if (!nombre) return { ok: false, error: "El club necesita un nombre." };
  if (!adminNombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    return { ok: false, error: "Revisá el nombre y el email del referente admin." };
  }
  if (!origenValido(input.origen)) return { ok: false, error: "Origen inválido." };

  const admin = crearClienteAdmin();

  const { data: club, error: eClub } = await admin
    .from("club")
    .insert({
      nombre,
      localidad: input.localidad.trim() || null,
      departamento: input.departamento.trim() || null,
    })
    .select("id")
    .single();
  if (eClub || !club) {
    return { ok: false, error: `No se pudo crear el club: ${eClub?.message ?? "error"}` };
  }

  const acceso = await generarLinkAcceso(adminEmail, adminNombre, input.origen);
  if (!acceso.ok) {
    await admin.from("club").delete().eq("id", club.id);
    return acceso;
  }

  const { error: eMemb } = await admin.from("membresia").insert({
    club_id: club.id,
    auth_user_id: acceso.data.authUserId,
    nombre: adminNombre,
    email: adminEmail,
    rol: "admin_club",
  });
  if (eMemb) {
    // no dejar club vacío ni usuario huérfano recién creado
    await admin.from("club").delete().eq("id", club.id);
    if (acceso.data.usuarioCreado) {
      await admin.auth.admin.deleteUser(acceso.data.authUserId);
    }
    return { ok: false, error: `No se pudo crear la membresía admin: ${eMemb.message}` };
  }

  return { ok: true, data: { clubId: club.id as string, link: acceso.data.link } };
}

export async function editarClub(input: {
  id: string;
  nombre: string;
  localidad: string;
  departamento: string;
}): Promise<Resultado<null>> {
  if (!(await esPlataforma())) return { ok: false, error: "Solo para la plataforma." };
  const nombre = input.nombre.trim();
  if (!nombre) return { ok: false, error: "El club necesita un nombre." };
  const { error } = await crearClienteAdmin()
    .from("club")
    .update({
      nombre,
      localidad: input.localidad.trim() || null,
      departamento: input.departamento.trim() || null,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

const EXT_POR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/** Sube (o reemplaza) el escudo del club. FormData: clubId + archivo. */
export async function subirEscudo(formData: FormData): Promise<Resultado<{ url: string }>> {
  if (!(await esPlataforma())) return { ok: false, error: "Solo para la plataforma." };

  const clubId = String(formData.get("clubId") ?? "");
  const archivo = formData.get("archivo");
  if (!clubId || !(archivo instanceof File)) {
    return { ok: false, error: "Falta el archivo del escudo." };
  }
  const ext = EXT_POR_MIME[archivo.type];
  if (!ext) return { ok: false, error: "Formato no soportado: usá PNG, JPG, WEBP o SVG." };
  if (archivo.size > 2 * 1024 * 1024) {
    return { ok: false, error: "El escudo no puede superar los 2 MB." };
  }

  const admin = crearClienteAdmin();

  // Limpia versiones anteriores (pueden tener otra extensión)
  const { data: previos } = await admin.storage.from("escudos").list("", { search: clubId });
  if (previos && previos.length > 0) {
    await admin.storage.from("escudos").remove(previos.map((p) => p.name));
  }

  const ruta = `${clubId}.${ext}`;
  const { error: eSubida } = await admin.storage
    .from("escudos")
    .upload(ruta, archivo, { contentType: archivo.type, upsert: true });
  if (eSubida) return { ok: false, error: `No se pudo subir: ${eSubida.message}` };

  // ?v= para que el reemplazo se vea sin esperar el caché del CDN
  const base = admin.storage.from("escudos").getPublicUrl(ruta).data.publicUrl;
  const url = `${base}?v=${Date.now()}`;
  const { error: eClub } = await admin.from("club").update({ escudo_url: url }).eq("id", clubId);
  if (eClub) return { ok: false, error: eClub.message };
  return { ok: true, data: { url } };
}

export async function quitarEscudo(clubId: string): Promise<Resultado<null>> {
  if (!(await esPlataforma())) return { ok: false, error: "Solo para la plataforma." };
  const admin = crearClienteAdmin();
  const { data: previos } = await admin.storage.from("escudos").list("", { search: clubId });
  if (previos && previos.length > 0) {
    await admin.storage.from("escudos").remove(previos.map((p) => p.name));
  }
  const { error } = await admin.from("club").update({ escudo_url: null }).eq("id", clubId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/** Nuevo link de acceso para el admin de un club (perdió el link o la clave). */
export async function linkAdminClub(input: {
  clubId: string;
  email: string;
  origen: string;
}): Promise<Resultado<{ link: string }>> {
  if (!(await esPlataforma())) return { ok: false, error: "Solo para la plataforma." };
  if (!origenValido(input.origen)) return { ok: false, error: "Origen inválido." };
  const email = input.email.trim().toLowerCase();

  // Solo emails que son admin de ESE club (no cualquier email).
  const { data: memb } = await crearClienteAdmin()
    .from("membresia")
    .select("id")
    .eq("club_id", input.clubId)
    .eq("email", email)
    .eq("rol", "admin_club")
    .maybeSingle();
  if (!memb) return { ok: false, error: "Ese email no es admin de ese club." };

  const acceso = await generarLinkAcceso(email, undefined, input.origen);
  if (!acceso.ok) return acceso;
  return { ok: true, data: { link: acceso.data.link } };
}

/** Borra un club SOLO si no tiene deportistas (typo, prueba, etc.). */
export async function borrarClub(clubId: string): Promise<Resultado<null>> {
  if (!(await esPlataforma())) return { ok: false, error: "Solo para la plataforma." };
  const admin = crearClienteAdmin();
  const { count } = await admin
    .from("deportista")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "Ese club tiene deportistas cargados: no se borra desde acá.",
    };
  }
  const { data: previos } = await admin.storage.from("escudos").list("", { search: clubId });
  if (previos && previos.length > 0) {
    await admin.storage.from("escudos").remove(previos.map((p) => p.name));
  }
  const { error } = await admin.from("club").delete().eq("id", clubId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ---------- Parámetros globales del Módulo D (el estirón) ----------

export interface ParametrosPlataforma {
  umbralM: number;
  umbralF: number;
  minDias: number;
  actualizadoEn: string | null;
  actualizadoPor: string | null;
}

/** Fila singleton de `parametro_crecimiento`, con su metadata de auditoría. */
export async function leerParametros(): Promise<Resultado<ParametrosPlataforma>> {
  if (!(await esPlataforma())) return { ok: false, error: "Solo para la plataforma." };
  const admin = crearClienteAdmin();
  const { data, error } = await admin
    .from("parametro_crecimiento")
    .select("umbral_aceleracion_m, umbral_aceleracion_f, min_dias_tramo, actualizado_en, actualizado_por")
    .limit(1)
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message ?? "Sin fila de parámetros." };
  return {
    ok: true,
    data: {
      umbralM: Number(data.umbral_aceleracion_m),
      umbralF: Number(data.umbral_aceleracion_f),
      minDias: data.min_dias_tramo,
      actualizadoEn: data.actualizado_en,
      actualizadoPor: data.actualizado_por,
    },
  };
}

/**
 * Actualiza los parámetros GLOBALES del módulo de crecimiento. Impacta
 * a todos los clubes de la plataforma: cambia qué deportistas aparecen
 * marcados "en crecimiento acelerado". La tabla no tiene políticas de
 * escritura (nadie escribe por RLS): solo esta action con service role.
 */
export async function guardarParametros(input: {
  umbralM: number;
  umbralF: number;
  minDias: number;
}): Promise<Resultado<null>> {
  if (!(await esPlataforma())) return { ok: false, error: "Solo para la plataforma." };
  // espejo de los checks de la tabla, con mensajes en criollo
  if (!(input.umbralM >= 3 && input.umbralM <= 15) || !(input.umbralF >= 3 && input.umbralF <= 15)) {
    return { ok: false, error: "Los umbrales tienen que estar entre 3 y 15 cm/año." };
  }
  if (!Number.isInteger(input.minDias) || input.minDias < 30 || input.minDias > 365) {
    return { ok: false, error: "La separación mínima tiene que ser un entero entre 30 y 365 días." };
  }
  const supabase = await crearClienteServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = crearClienteAdmin();
  const { error } = await admin
    .from("parametro_crecimiento")
    .update({
      umbral_aceleracion_m: input.umbralM,
      umbral_aceleracion_f: input.umbralF,
      min_dias_tramo: input.minDias,
      actualizado_en: new Date().toISOString(),
      actualizado_por: user?.email ?? null,
    })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// ---------- Bandeja de sugerencias sobre las guías (sesión C) ----------

export interface SugerenciaPlataforma {
  id: string;
  guia: string;
  tipo: "agregar" | "modificar" | "eliminar";
  texto: string;
  estado: "pendiente" | "aceptada" | "rechazada";
  respuesta: string | null;
  creadoEn: string;
  resueltoEn: string | null;
  club: string;
  autor: string;
  funcion: string | null;
}

/**
 * Todas las sugerencias, pendientes primero. La plataforma lee vía
 * service role (el RLS de plataforma sigue en 0 filas): son textos de
 * adultos del staff sobre contenido metodológico, sin datos de menores.
 */
export async function listarSugerencias(): Promise<Resultado<SugerenciaPlataforma[]>> {
  if (!(await esPlataforma())) return { ok: false, error: "Solo para la plataforma." };
  const admin = crearClienteAdmin();
  const { data, error } = await admin
    .from("sugerencia")
    .select(
      "id, guia, tipo, texto, estado, respuesta, creado_en, resuelto_en, club(nombre), membresia(nombre, funcion)",
    )
    .order("creado_en", { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: error.message };
  const filas = (data ?? []).map((s) => {
    const club = s.club as unknown as { nombre: string } | null;
    const autor = s.membresia as unknown as { nombre: string; funcion: string | null } | null;
    return {
      id: s.id as string,
      guia: s.guia as string,
      tipo: s.tipo as SugerenciaPlataforma["tipo"],
      texto: s.texto as string,
      estado: s.estado as SugerenciaPlataforma["estado"],
      respuesta: (s.respuesta as string | null) ?? null,
      creadoEn: s.creado_en as string,
      resueltoEn: (s.resuelto_en as string | null) ?? null,
      club: club?.nombre ?? "—",
      autor: autor?.nombre ?? "—",
      funcion: autor?.funcion ?? null,
    };
  });
  filas.sort((a, b) =>
    a.estado === "pendiente" && b.estado !== "pendiente" ? -1
    : a.estado !== "pendiente" && b.estado === "pendiente" ? 1
    : 0,
  );
  return { ok: true, data: filas };
}

/**
 * Resuelve una sugerencia (aceptada/rechazada, con respuesta opcional
 * que ve el autor). Registra la DECISIÓN: si se acepta, el contenido
 * de la guía se actualiza aparte, por curaduría central
 * (lib/como-medir.ts) — esta action no toca el catálogo.
 */
export async function resolverSugerencia(input: {
  id: string;
  estado: "aceptada" | "rechazada";
  respuesta?: string;
}): Promise<Resultado<null>> {
  if (!(await esPlataforma())) return { ok: false, error: "Solo para la plataforma." };
  const respuesta = input.respuesta?.trim() || null;
  if (respuesta && respuesta.length > 1000) {
    return { ok: false, error: "La respuesta supera los 1000 caracteres." };
  }
  const admin = crearClienteAdmin();
  const { error, data } = await admin
    .from("sugerencia")
    .update({
      estado: input.estado,
      respuesta,
      resuelto_en: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("estado", "pendiente")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Esa sugerencia ya fue resuelta (o no existe)." };
  return { ok: true, data: null };
}

// ---------- Bandeja de solicitudes de disciplina/protocolo ----------
// La lógica vive en lib/plataforma/solicitudes.ts (la prueba el e2e);
// el gate se verifica ahí, con el mismo esUsuarioPlataforma de arriba.

export type { SolicitudDisciplinaPlataforma, ResolucionSolicitud };

/** Pendientes primero, después resueltas (200 como máximo). */
export async function listarSolicitudesDisciplina(): Promise<Resultado<SolicitudDisciplinaPlataforma[]>> {
  return listarSolicitudes(crearClienteAdmin(), await usuarioActual());
}

/**
 * Rechazar (con resolución), vincular a una disciplina existente o aprobar
 * eligiendo protocolos del catálogo. Nunca crea protocolos ni métricas.
 */
export async function resolverSolicitudDisciplina(
  input: ResolucionSolicitud,
): Promise<Resultado<{ id: string; estado: string; disciplinaId: string | null; protocolosNuevos?: number }>> {
  return resolverSolicitud(crearClienteAdmin(), await usuarioActual(), input);
}
