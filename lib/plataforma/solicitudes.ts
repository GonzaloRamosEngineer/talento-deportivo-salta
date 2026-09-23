import type { SupabaseClient, User } from "@supabase/supabase-js";
import { esCuentaDemo } from "@/lib/demo";

/**
 * Bandeja de solicitudes de disciplina/protocolo que la Secretaría le hace
 * a la plataforma (docs/BRIEF_BACKEND_SOLICITUDES_DISCIPLINA.md).
 *
 * Mismo patrón que las sugerencias de las guías: la plataforma no tiene
 * membresía ni filas por RLS, así que lee y escribe con el cliente admin, y
 * CADA operación verifica antes el gate. Sin `server-only` a propósito: la
 * usan las server actions (`app/plataforma/actions.ts`) y el e2e
 * (`scripts/e2e-solicitudes-disciplina.mts`), para que el script pruebe el
 * mismo código. No lee credenciales: recibe el cliente admin y el usuario.
 */

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * `app_metadata` solo se escribe con service role: el usuario no puede
 * autoasignárselo. Las cuentas de la vitrina no pasan ni con el flag (T-001).
 */
export function esUsuarioPlataforma(user: User | null | undefined): user is User {
  if (!user || esCuentaDemo(user)) return false;
  return Boolean(user.app_metadata?.plataforma);
}

const SOLO_PLATAFORMA = { ok: false, error: "Solo para la plataforma." } as const;

export interface SolicitudDisciplinaPlataforma {
  id: string;
  tipo: "disciplina" | "protocolo";
  /** Nombre de la disciplina pedida, o el texto libre del protocolo pedido. */
  nombre: string;
  descripcion: string | null;
  contexto: string | null;
  club: string;
  autor: string;
  funcion: string | null;
  disciplinaObjetivo: { id: string; nombre: string } | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  resolucion: string | null;
  /** Disciplina con la que quedó resuelta (creada o vinculada). */
  disciplina: { id: string; nombre: string } | null;
  protocolosHabilitados: string[];
  creadoEn: string;
  resueltoEn: string | null;
}

// Dos FKs a `disciplina` y dos a `membresia`: sin el nombre de la constraint,
// PostgREST no sabe cuál embeber (PGRST201).
const SELECT_SOLICITUD = [
  "id, tipo, nombre, descripcion, contexto, estado, resolucion, protocolos_habilitados, creado_en, resuelto_en",
  "club:club_id(nombre)",
  "autor:membresia!disciplina_solicitud_solicitado_por_fkey(nombre, funcion)",
  "objetivo:disciplina!disciplina_solicitud_disciplina_objetivo_id_fkey(id, nombre)",
  "resuelta:disciplina!disciplina_solicitud_disciplina_id_fkey(id, nombre)",
].join(", ");

function uno<T>(valor: T | T[] | null | undefined): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : (valor ?? null);
}

export async function listarSolicitudesDisciplina(
  admin: SupabaseClient,
  user: User | null,
): Promise<Resultado<SolicitudDisciplinaPlataforma[]>> {
  if (!esUsuarioPlataforma(user)) return SOLO_PLATAFORMA;
  const { data, error } = await admin
    .from("disciplina_solicitud")
    .select(SELECT_SOLICITUD)
    .order("creado_en", { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: error.message };
  const filas = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((s) => {
    const club = uno(s.club as { nombre: string } | null);
    const autor = uno(s.autor as { nombre: string; funcion: string | null } | null);
    return {
      id: s.id as string,
      tipo: s.tipo as SolicitudDisciplinaPlataforma["tipo"],
      nombre: s.nombre as string,
      descripcion: (s.descripcion as string | null) ?? null,
      contexto: (s.contexto as string | null) ?? null,
      club: club?.nombre ?? "—",
      autor: autor?.nombre ?? "—",
      funcion: autor?.funcion ?? null,
      disciplinaObjetivo: uno(s.objetivo as { id: string; nombre: string } | null),
      estado: s.estado as SolicitudDisciplinaPlataforma["estado"],
      resolucion: (s.resolucion as string | null) ?? null,
      disciplina: uno(s.resuelta as { id: string; nombre: string } | null),
      protocolosHabilitados: (s.protocolos_habilitados as string[] | null) ?? [],
      creadoEn: s.creado_en as string,
      resueltoEn: (s.resuelto_en as string | null) ?? null,
    };
  });
  // Pendientes primero; dentro de cada grupo, lo más nuevo arriba.
  filas.sort((a, b) =>
    a.estado === "pendiente" && b.estado !== "pendiente" ? -1
    : a.estado !== "pendiente" && b.estado === "pendiente" ? 1
    : 0,
  );
  return { ok: true, data: filas };
}

export type ResolucionSolicitud =
  | { id: string; accion: "rechazar"; resolucion: string }
  | { id: string; accion: "vincular"; disciplinaId: string; resolucion?: string }
  | { id: string; accion: "aprobar"; nombre?: string; protocolos: string[]; resolucion?: string };

const MENSAJES: Record<string, string> = {
  SOLICITUD_DESCONOCIDA: "Esa solicitud no existe.",
  SOLICITUD_YA_RESUELTA: "Esa solicitud ya fue resuelta.",
  PROTOCOLOS_REQUERIDOS: "Elegí al menos un protocolo del catálogo.",
  PROTOCOLO_DESCONOCIDO: "Hay protocolos que no están en el catálogo (acá no se crean protocolos nuevos)",
  DISCIPLINA_YA_EXISTE: "Esa disciplina ya existe en el catálogo: vinculá la solicitud en lugar de aprobarla.",
  DISCIPLINA_DESCONOCIDA: "La disciplina ya no está en el catálogo.",
  NOMBRE_INVALIDO: "El nombre de la disciplina tiene que tener entre 2 y 80 caracteres.",
  USUARIO_NO_PLATAFORMA: "Solo para la plataforma.",
};

/**
 * Tres salidas, todas sobre una solicitud PENDIENTE (no se re-resuelve):
 * - rechazar: con resolución obligatoria (quien pidió tiene que saber por qué);
 * - vincular: "ya existe como Vóley", para un pedido de disciplina;
 * - aprobar: crea la disciplina o suma protocolos del catálogo, en una
 *   transacción (RPC `aprobar_solicitud_disciplina`, solo service_role).
 */
export async function resolverSolicitudDisciplina(
  admin: SupabaseClient,
  user: User | null,
  input: ResolucionSolicitud,
): Promise<Resultado<{ id: string; estado: string; disciplinaId: string | null; protocolosNuevos?: number }>> {
  if (!esUsuarioPlataforma(user)) return SOLO_PLATAFORMA;
  const resolucion = input.resolucion?.trim() || null;
  if (resolucion && resolucion.length > 1000) return { ok: false, error: "La resolución supera los 1000 caracteres." };

  if (input.accion === "aprobar") {
    const { data, error } = await admin.rpc("aprobar_solicitud_disciplina", {
      p_id: input.id,
      p_usuario: user.id,
      p_protocolos: input.protocolos,
      p_nombre: input.nombre?.trim() || null,
      p_resolucion: resolucion,
    });
    if (error) {
      const codigo = error.message.match(/TDS:([A-Z_]+)/u)?.[1] ?? "";
      const detalle = error.message.match(/TDS:[A-Z_]+:(.+)$/u)?.[1]?.trim();
      const texto = MENSAJES[codigo] ?? "No pudimos aprobar la solicitud.";
      return { ok: false, error: detalle ? `${texto}: ${detalle}.` : texto };
    }
    const resultado = data as { id: string; estado: string; disciplinaId: string; protocolosNuevos: number };
    return { ok: true, data: resultado };
  }

  const ahora = new Date().toISOString();
  let cambios: Record<string, unknown>;
  if (input.accion === "rechazar") {
    if (!resolucion || resolucion.length < 3) {
      return { ok: false, error: "Escribí por qué se rechaza: quien la pidió va a ver esta respuesta." };
    }
    cambios = { estado: "rechazada", resolucion };
  } else {
    const { data: solicitud } = await admin.from("disciplina_solicitud").select("tipo").eq("id", input.id).maybeSingle();
    if (solicitud?.tipo === "protocolo") {
      return { ok: false, error: "Un pedido de protocolo no se vincula: se aprueba eligiendo protocolos o se rechaza." };
    }
    const { data: disciplina } = await admin.from("disciplina").select("id, nombre").eq("id", input.disciplinaId).eq("activo", true).maybeSingle();
    if (!disciplina) return { ok: false, error: MENSAJES.DISCIPLINA_DESCONOCIDA };
    cambios = {
      estado: "aprobada",
      disciplina_id: disciplina.id,
      resolucion: resolucion ?? `Ya existe en el catálogo como «${disciplina.nombre}».`,
    };
  }

  const { data, error } = await admin
    .from("disciplina_solicitud")
    .update({ ...cambios, resuelto_por_usuario: user.id, resuelto_en: ahora })
    .eq("id", input.id)
    .eq("estado", "pendiente")
    .select("id, estado, disciplina_id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Esa solicitud ya fue resuelta (o no existe)." };
  return { ok: true, data: { id: data[0].id, estado: data[0].estado, disciplinaId: data[0].disciplina_id ?? null } };
}
