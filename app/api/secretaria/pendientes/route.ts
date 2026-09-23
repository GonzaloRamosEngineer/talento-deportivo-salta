import { ErrorImportacion, respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

/**
 * Bandeja única de lo que falta cargar a mano: recepciones manuales abiertas
 * y lotes importados con filas que quedaron para carga manual.
 */
export async function GET() {
  try {
    const { supabase } = await sesionSecretaria();
    const { data, error } = await supabase.rpc("pendientes_de_carga");
    if (error) throw new ErrorImportacion("No pudimos cargar los pendientes.", error.message.includes("TDS:SIN_ALCANCE") ? 403 : 500, "PENDIENTES_NO_DISPONIBLES");
    return Response.json({ pendientes: data ?? [] });
  } catch (error) {
    return respuestaError(error);
  }
}
