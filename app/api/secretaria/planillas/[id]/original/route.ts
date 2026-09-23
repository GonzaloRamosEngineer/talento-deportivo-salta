import { clienteServicio, ErrorImportacion, respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";
import { BUCKET_LOTES, DESCARGA_SEGUNDOS } from "@/lib/evaluaciones/originales";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
/** Los mismos roles que descargan una recepción manual. Un evaluador sube, no lee. */
const PUEDEN_DESCARGAR = new Set(["admin_secretaria", "coordinador_secretaria", "analista_secretaria"]);

/** URL firmada de 5 minutos al original del lote. El bucket es privado: no hay URL pública. */
export async function GET(_pedido: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new ErrorImportacion("El identificador de la planilla no es válido.", 400, "ID_INVALIDO");
    const { supabase, membresia } = await sesionSecretaria();
    if (!PUEDEN_DESCARGAR.has(membresia.rol as string)) {
      throw new ErrorImportacion("Tu rol no puede descargar el archivo original.", 403, "ROL_INSUFICIENTE");
    }

    // bloqueos_lote ya filtra por el espacio de la sesión.
    const { data, error } = await supabase.rpc("bloqueos_lote", { p_lote_id: id });
    if (error) throw new ErrorImportacion("Esta planilla no pertenece a tu espacio.", 403, "SIN_ALCANCE");
    const lote = data as { loteId: string; archivo: string; archivoGuardado?: boolean; rutaStorage?: string | null; purgadoEn?: string | null };

    if (!lote.archivoGuardado || !lote.rutaStorage) {
      throw new ErrorImportacion(
        lote.purgadoEn
          ? "El archivo original ya no está disponible: fue purgado por la política de retención."
          : "Esta planilla no tiene el original guardado (es anterior a que se guardaran).",
        410, lote.purgadoEn ? "ARCHIVO_PURGADO" : "ORIGINAL_NO_DISPONIBLE",
      );
    }
    if (!lote.rutaStorage.startsWith(`${membresia.club_id}/${lote.loteId}.`)) {
      throw new ErrorImportacion("Esta planilla no pertenece a tu espacio.", 403, "SIN_ALCANCE");
    }

    const { data: firmada, error: errorFirma } = await clienteServicio().storage
      .from(BUCKET_LOTES)
      .createSignedUrl(lote.rutaStorage, DESCARGA_SEGUNDOS, { download: lote.archivo });
    if (errorFirma || !firmada) throw new ErrorImportacion("No pudimos preparar la descarga.", 500, "DESCARGA_FALLIDA");
    return Response.json({ archivo: lote.archivo, urlDescarga: firmada.signedUrl, expiraEnSegundos: DESCARGA_SEGUNDOS });
  } catch (error) {
    return respuestaError(error);
  }
}
