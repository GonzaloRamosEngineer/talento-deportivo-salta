import { ErrorImportacion, respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/**
 * Filas de un lote que quedaron para carga manual. La lectura va por RLS
 * (`fila_pendiente_lectura`: roles operativos de la Secretaría del club);
 * otro espacio recibe una lista vacía, no un error que confirme que existe.
 */
export async function GET(_pedido: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new ErrorImportacion("El identificador de la planilla no es válido.", 400, "ID_INVALIDO");
    const { supabase } = await sesionSecretaria();
    const { data, error } = await supabase
      .from("lote_fila_pendiente")
      .select("id, orden, fila, motivo, datos, estado, resuelto_en, resolucion, resuelto_por:resuelto_por(nombre)")
      .eq("lote_id", id)
      .order("orden");
    if (error) throw new ErrorImportacion("No pudimos cargar las filas pendientes.", 500, "FILAS_NO_DISPONIBLES");
    return Response.json({
      filas: (data ?? []).map((fila) => {
        const quien = Array.isArray(fila.resuelto_por) ? fila.resuelto_por[0] : fila.resuelto_por;
        return {
          id: fila.id, orden: fila.orden, fila: fila.fila, motivo: fila.motivo, datos: fila.datos,
          estado: fila.estado, resueltoEn: fila.resuelto_en, resolucion: fila.resolucion,
          resueltoPor: (quien as { nombre?: string } | null)?.nombre ?? null,
        };
      }),
    });
  } catch (error) {
    return respuestaError(error);
  }
}
