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
    const detalle = (data ?? {}) as Record<string, unknown>;
    const metricas = Array.isArray(detalle.metricas) ? detalle.metricas : [];
    const codigos = metricas.filter((metrica): metrica is string => typeof metrica === "string");
    if (codigos.length > 0) {
      const { data: atributos, error: errorAtributos } = await supabase
        .from("atributo")
        .select("codigo, nombre, unidad")
        .in("codigo", codigos);
      if (errorAtributos) throw errorAtributos;
      const porCodigo = new Map((atributos ?? []).map((atributo) => [atributo.codigo, atributo]));
      detalle.metricas = metricas.map((metrica) => {
        if (typeof metrica !== "string") return metrica;
        const atributo = porCodigo.get(metrica);
        return {
          codigo: metrica,
          nombre: atributo?.nombre ?? metrica.replaceAll("_", " "),
          unidad: atributo?.unidad ?? null,
          cantidad: null,
        };
      });
    }
    return Response.json(detalle);
  } catch (error) {
    return respuestaError(error);
  }
}
