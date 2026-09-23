import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContextoEvaluacion } from "@/lib/evaluaciones-importacion";
import { ErrorImportacion } from "./errores";
import { parsearEvaluacion } from "./importador/parsear";
import type { ImportacionNormalizada } from "./importador/tipos";

/**
 * El original de cada lote. Todo archivo que se lee (aunque sea en parte)
 * se guarda en el bucket privado `planillas-lotes`, así un lote vencido se
 * reabre sin volver a subir nada y se puede releer con un lector mejor.
 *
 * Sin `server-only` a propósito: lo usan las rutas Y el e2e
 * (scripts/e2e-carga-planillas.mts), para que el script pruebe el mismo
 * código. No lee credenciales: recibe los dos clientes armados.
 *   - `usuario`: sesión de la persona. Todo lo que toca tablas va por acá,
 *     con RLS y las RPC.
 *   - `servicio`: clave de servicio, SOLO para Storage (el bucket no tiene
 *     policies de escritura).
 */

export const BUCKET_LOTES = "planillas-lotes";
export const DESCARGA_SEGUNDOS = 300;
/** Un lote con bloqueos espera días: hay que poder pedirle la fecha al club. */
export const REVISION_MS = 7 * 24 * 60 * 60 * 1000;
/** Sin bloqueos se confirma en el momento; la sesión de vista previa sigue corta. */
export const SESION_MS = 30 * 60 * 1000;

const TIPOS: Record<string, string> = {
  ".csv": "text/csv",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function tipoPlanilla(nombre: string) {
  const ext = nombre.slice(nombre.lastIndexOf(".")).toLowerCase();
  const mime = TIPOS[ext];
  if (!mime) throw new ErrorImportacion("Solo aceptamos .csv, .xls o .xlsx.", 400, "TIPO_NO_SOPORTADO");
  return { ext, mime };
}

/** La ruta sale del club y del lote, nunca de un dato que mande el cliente. */
export function rutaOriginal(clubId: string, loteId: string, nombreArchivo: string) {
  return `${clubId}/${loteId}${tipoPlanilla(nombreArchivo).ext}`;
}

function hash(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function codigoTds(mensaje: string) {
  return mensaje.match(/TDS:([A-Z_]+)/u)?.[1] ?? null;
}

export function vencimientoInicial(normalizada: ImportacionNormalizada, ahora = Date.now()) {
  const bloqueos = normalizada.hallazgos.filter((hallazgo) => hallazgo.severidad === "bloqueo").length;
  return new Date(ahora + (bloqueos > 0 ? REVISION_MS : SESION_MS));
}

/**
 * Crea el lote previsualizado y guarda su original. Si la subida falla, el
 * lote queda `fallido` (no usable): nunca un previsualizado sin original.
 */
export async function registrarLote({
  usuario, servicio, membresia, nombreArchivo, bytes, contexto, normalizada,
}: {
  usuario: SupabaseClient;
  servicio: SupabaseClient;
  membresia: { id: string; club_id: string };
  nombreArchivo: string;
  bytes: Uint8Array;
  contexto: ContextoEvaluacion;
  normalizada: ImportacionNormalizada;
}) {
  const { mime } = tipoPlanilla(nombreArchivo);
  const loteId = randomUUID();
  const venceEn = vencimientoInicial(normalizada);
  const bloqueos = normalizada.hallazgos.filter((hallazgo) => hallazgo.severidad === "bloqueo").length;

  const { error } = await usuario.from("lote_importacion").insert({
    id: loteId,
    club_id: membresia.club_id,
    nombre_archivo: nombreArchivo,
    hash_sha256: hash(bytes),
    adaptador: normalizada.adaptador,
    contexto,
    preview_json: normalizada,
    hallazgos: normalizada.hallazgos,
    filas_ignoradas: normalizada.filasIgnoradas,
    duplicados_archivo: normalizada.duplicados,
    bloqueos_pendientes: bloqueos,
    importado_por: membresia.id,
    vence_en: venceEn.toISOString(),
    tamano_bytes: bytes.byteLength,
    tipo_mime: mime,
  });
  if (error) {
    if (error.code === "23505") throw new ErrorImportacion("Este archivo ya fue previsualizado o importado para el mismo contexto.", 409, "IMPORTACION_DUPLICADA");
    throw new ErrorImportacion("No pudimos guardar la previsualización.", 500, "PREVIEW_NO_GUARDADA");
  }

  const ruta = rutaOriginal(membresia.club_id, loteId, nombreArchivo);
  const { error: errorSubida } = await servicio.storage
    .from(BUCKET_LOTES)
    .upload(ruta, bytes, { contentType: mime, upsert: false });
  const { error: errorRegistro } = errorSubida
    ? { error: null }
    : await usuario.rpc("confirmar_archivo_lote", { p_lote_id: loteId, p_ruta: ruta });

  if (errorSubida || errorRegistro) {
    const detalle = errorSubida?.message ?? errorRegistro?.message ?? "";
    await usuario.rpc("marcar_error_subida_lote", { p_lote_id: loteId, p_detalle: detalle });
    // Si el archivo llegó al bucket pero no se pudo registrar, no queda
    // un original huérfano sin retención.
    if (!errorSubida) await servicio.storage.from(BUCKET_LOTES).remove([ruta]);
    throw new ErrorImportacion(
      "No pudimos guardar el archivo original, así que la planilla no quedó lista para revisar. Volvé a subirla.",
      502, "SUBIDA_FALLIDA",
    );
  }

  return { loteId, venceEn, ruta };
}

/** Lo que devuelve `bloqueos_lote()`, en la parte que usa el reproceso. */
export interface RevisionLote {
  loteId: string;
  archivo: string;
  hash: string;
  estado: string;
  contexto: ContextoEvaluacion;
  archivoGuardado?: boolean;
  rutaStorage?: string | null;
}

export async function leerOriginal(servicio: SupabaseClient, clubId: string, revision: RevisionLote) {
  const ruta = revision.rutaStorage;
  // Defensa en profundidad: la base ya ata la ruta al club y al lote (check
  // `lote_ruta_storage_propia`), pero la descarga usa la clave de servicio.
  if (!ruta || !ruta.startsWith(`${clubId}/${revision.loteId}.`)) {
    throw new ErrorImportacion("El original de esta planilla no está disponible.", 410, "ORIGINAL_NO_DISPONIBLE");
  }
  const { data, error } = await servicio.storage.from(BUCKET_LOTES).download(ruta);
  if (error || !data) throw new ErrorImportacion("No pudimos leer el archivo original guardado.", 502, "ORIGINAL_ILEGIBLE");
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (hash(bytes) !== revision.hash) {
    throw new ErrorImportacion("El original guardado no coincide con el de la planilla.", 409, "ORIGINAL_ALTERADO");
  }
  return bytes;
}

/**
 * Vuelve a leer el original sobre el MISMO lote y reabre la revisión.
 * Con original guardado no pide nada; en lotes viejos (sin original) exige
 * el mismo archivo, verificado por hash.
 */
export async function reprocesarLote({
  usuario, servicio, clubId, revision, archivoSubido,
}: {
  usuario: SupabaseClient;
  servicio: SupabaseClient;
  clubId: string;
  revision: RevisionLote;
  archivoSubido?: File | null;
}) {
  if (revision.estado !== "previsualizado") {
    throw new ErrorImportacion("La planilla ya fue importada: no se reprocesa.", 409, "LOTE_NO_EDITABLE");
  }
  let bytes: Uint8Array<ArrayBuffer>;
  if (revision.archivoGuardado) {
    bytes = await leerOriginal(servicio, clubId, revision);
  } else {
    if (!archivoSubido) throw new ErrorImportacion("Esta planilla es anterior al guardado de originales: adjuntá el archivo original.", 400, "ARCHIVO_INVALIDO");
    bytes = new Uint8Array(await archivoSubido.arrayBuffer());
    if (hash(bytes) !== revision.hash) {
      throw new ErrorImportacion("El archivo no coincide con el de esta planilla. Subí exactamente el mismo.", 409, "ARCHIVO_DISTINTO");
    }
  }

  const normalizada = await parsearEvaluacion(new File([bytes], revision.archivo), revision.contexto);
  const { data, error } = await usuario.rpc("reprocesar_lote_previsualizado", {
    p_lote_id: revision.loteId, p_hash: revision.hash, p_preview: normalizada,
  });
  if (error) {
    const codigo = codigoTds(error.message) ?? "ERROR_INTERNO";
    const status = codigo === "ARCHIVO_DISTINTO" ? 409 : codigo === "ROL_INSUFICIENTE" || codigo === "SIN_ALCANCE" ? 403 : 500;
    throw new ErrorImportacion("No pudimos reprocesar la planilla.", status, codigo);
  }
  return { ...(data as Record<string, unknown>), usoOriginalGuardado: Boolean(revision.archivoGuardado) };
}
