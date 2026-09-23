import { MAX_ARCHIVO_EVALUACION_BYTES } from "@/lib/evaluaciones-importacion";
import { clienteServicio, ErrorImportacion, respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";
import { reprocesarLote, type RevisionLote } from "@/lib/evaluaciones/originales";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/**
 * Vuelve a leer el original sobre el MISMO lote y reabre la revisión 7 días.
 * Es la forma de retomar un lote vencido o de releerlo con un lector mejor.
 *
 * - Lote con original guardado: no pide nada; si igual llega un archivo, se
 *   ignora (manda el guardado).
 * - Lote viejo, sin original: exige el mismo archivo, verificado por hash.
 */
export async function POST(pedido: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new ErrorImportacion("El identificador de la planilla no es válido.", 400, "ID_INVALIDO");
    const { supabase, membresia } = await sesionSecretaria();

    const { data: revision, error: errorRevision } = await supabase.rpc("bloqueos_lote", { p_lote_id: id });
    if (errorRevision) throw new ErrorImportacion("Esta planilla no pertenece a tu espacio.", 403, "SIN_ALCANCE");
    const lote = revision as RevisionLote;

    let archivoSubido: File | null = null;
    if (!lote.archivoGuardado && pedido.headers.get("content-type")?.includes("multipart/form-data")) {
      const archivo = (await pedido.formData()).get("archivo");
      if (archivo instanceof File) {
        if (archivo.size === 0 || archivo.size > MAX_ARCHIVO_EVALUACION_BYTES) {
          throw new ErrorImportacion("El archivo está vacío o supera los 20 MB.", 400, "ARCHIVO_INVALIDO");
        }
        archivoSubido = archivo;
      }
    }

    const resultado = await reprocesarLote({
      usuario: supabase, servicio: clienteServicio(), clubId: membresia.club_id, revision: lote, archivoSubido,
    });
    return Response.json(resultado);
  } catch (error) {
    return respuestaError(error);
  }
}
