import { ErrorImportacion, respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function traducir(mensaje: string): never {
  const codigo = mensaje.match(/TDS:([A-Z_]+)/u)?.[1];
  const detalle = mensaje.match(/TDS:[A-Z_]+:(.+)$/u)?.[1]?.trim();
  const mapa: Record<string, [string, number]> = {
    SIN_ALCANCE: ["Esta planilla no pertenece a tu espacio.", 403],
    ROL_INSUFICIENTE: ["Tu rol no puede revisar planillas recibidas.", 403],
    ESTADO_INVALIDO: ["Ese estado no existe.", 400],
    TRANSICION_INVALIDA: ["Ese cambio de estado no está permitido.", 409],
    MOTIVO_REQUERIDO: ["Para rechazar hay que explicar por qué.", 400],
    LOTE_REQUERIDO: ["Para marcarla como procesada, indicá la planilla importada que la resolvió.", 422],
    LOTE_DESCONOCIDO: ["Esa planilla importada no pertenece a tu espacio.", 404],
    LOTE_NO_CONFIRMADO: ["Esa importación todavía no está confirmada.", 422],
  };
  const [texto, status] = mapa[codigo ?? ""] ?? ["No pudimos cambiar el estado.", 500];
  throw new ErrorImportacion(detalle ? `${texto} (${detalle})` : texto, status, codigo ?? "ERROR_INTERNO");
}

/** RECIBIDA_PARA_REVISION → EN_REVISION → PROCESADA | RECHAZADA */
export async function POST(pedido: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new ErrorImportacion("El identificador no es válido.", 400, "ID_INVALIDO");
    const { supabase } = await sesionSecretaria();
    const cuerpo = (await pedido.json()) as { estado?: string; motivo?: string; loteImportacionId?: string };
    if (!cuerpo.estado) throw new ErrorImportacion("Indicá el estado nuevo.", 400, "ESTADO_INVALIDO");

    const { data, error } = await supabase.rpc("cambiar_estado_recepcion", {
      p_id: id,
      p_estado: cuerpo.estado,
      p_motivo: cuerpo.motivo ?? null,
      p_lote_id: cuerpo.loteImportacionId ?? null,
    });
    if (error) traducir(error.message);
    return Response.json(data);
  } catch (error) {
    return respuestaError(error);
  }
}
