import { respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase } = await sesionSecretaria();
    const { data, error } = await supabase.rpc("detalle_lote_importacion", {
      p_lote_id: id,
    });
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return respuestaError(error);
  }
}
