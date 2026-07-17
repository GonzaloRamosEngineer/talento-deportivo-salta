"use server";

import { crearClienteServer } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";

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

async function esPlataforma(): Promise<boolean> {
  const supabase = await crearClienteServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user?.app_metadata?.plataforma);
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

/** Link de acceso para un email: invite si es nuevo, recovery si ya existe. */
async function generarLinkAcceso(
  email: string,
  nombre: string | undefined,
  origen: string,
): Promise<Resultado<{ authUserId: string; link: string; usuarioCreado: boolean }>> {
  const admin = crearClienteAdmin();
  const invite = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: nombre ? { data: { nombre } } : undefined,
  });
  if (!invite.error) {
    return {
      ok: true,
      data: {
        authUserId: invite.data.user.id,
        link: linkDeAcceso(origen, invite.data.properties.hashed_token, "invite"),
        usuarioCreado: true,
      },
    };
  }
  const existente = await buscarUsuarioPorEmail(email);
  if (!existente) {
    return { ok: false, error: `No se pudo generar el acceso: ${invite.error.message}` };
  }
  const recovery = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (recovery.error) {
    return { ok: false, error: `No se pudo generar el link: ${recovery.error.message}` };
  }
  return {
    ok: true,
    data: {
      authUserId: existente.id,
      link: linkDeAcceso(origen, recovery.data.properties.hashed_token, "recovery"),
      usuarioCreado: false,
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
