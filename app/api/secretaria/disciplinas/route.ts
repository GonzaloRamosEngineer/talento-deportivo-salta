import { respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

export async function GET() {
  try {
    const { supabase } = await sesionSecretaria();
    const { data, error } = await supabase.rpc("resumen_por_disciplina");
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) {
    return respuestaError(error);
  }
}
