import { MAX_ARCHIVO_EVALUACION_BYTES, type ContextoEvaluacion } from "@/lib/evaluaciones-importacion";
import { ErrorImportacion, hashArchivo, respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";
import { parsearEvaluacion } from "@/lib/evaluaciones/importador/parsear";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/**
 * Vuelve a leer el MISMO archivo sobre el MISMO lote previsualizado. Sirve
 * para los lotes creados antes de que el adaptador preservara las filas sin
 * protocolo. El hash decide si es el mismo archivo; si no coincide, se
 * rechaza en vez de crear otro lote.
 */
export async function POST(pedido: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new ErrorImportacion("El identificador de la planilla no es válido.", 400, "ID_INVALIDO");
    const { supabase } = await sesionSecretaria();

    const { data: revision, error: errorRevision } = await supabase.rpc("bloqueos_lote", { p_lote_id: id });
    if (errorRevision) throw new ErrorImportacion("Esta planilla no pertenece a tu espacio.", 403, "SIN_ALCANCE");
    const lote = revision as { estado: string; contexto: ContextoEvaluacion; hash: string };
    if (lote.estado !== "previsualizado") {
      throw new ErrorImportacion("La planilla ya fue importada: no se reprocesa.", 409, "LOTE_NO_EDITABLE");
    }

    const formulario = await pedido.formData();
    const archivo = formulario.get("archivo");
    if (!(archivo instanceof File)) throw new ErrorImportacion("Adjuntá el archivo original.", 400, "ARCHIVO_INVALIDO");
    if (archivo.size === 0 || archivo.size > MAX_ARCHIVO_EVALUACION_BYTES) {
      throw new ErrorImportacion("El archivo está vacío o supera los 20 MB.", 400, "ARCHIVO_INVALIDO");
    }

    const hash = await hashArchivo(archivo);
    if (hash !== lote.hash) {
      throw new ErrorImportacion(
        "El archivo no coincide con el de esta planilla. Subí exactamente el mismo.",
        409, "ARCHIVO_DISTINTO",
      );
    }

    const normalizada = await parsearEvaluacion(archivo, lote.contexto);
    const { data, error } = await supabase.rpc("reprocesar_lote_previsualizado", {
      p_lote_id: id, p_hash: hash, p_preview: normalizada,
    });
    if (error) {
      const codigo = error.message.match(/TDS:([A-Z_]+)/u)?.[1] ?? "ERROR_INTERNO";
      throw new ErrorImportacion("No pudimos reprocesar la planilla.", codigo === "ARCHIVO_DISTINTO" ? 409 : 500, codigo);
    }
    return Response.json(data);
  } catch (error) {
    return respuestaError(error);
  }
}
