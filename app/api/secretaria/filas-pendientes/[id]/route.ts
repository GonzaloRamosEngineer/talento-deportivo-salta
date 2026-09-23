import { ErrorImportacion, respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function traducir(mensaje: string): never {
  const codigo = mensaje.match(/TDS:([A-Z_]+)/u)?.[1];
  const mapa: Record<string, [string, number]> = {
    SIN_ALCANCE: ["Esta fila no pertenece a tu espacio.", 403],
    ROL_INSUFICIENTE: ["Tu rol no puede cerrar filas pendientes.", 403],
    FILA_YA_RESUELTA: ["Esta fila ya fue resuelta.", 409],
    JORNADA_INVALIDA: ["Elegí la jornada donde cargaste la fila.", 400],
    MOTIVO_REQUERIDO: ["Escribí por qué se descarta la fila.", 400],
    RESOLUCION_INVALIDA: ["La resolución debe ser 'cargada' (con jornada) o 'descartada' (con motivo).", 400],
  };
  const [texto, status] = mapa[codigo ?? ""] ?? ["No pudimos cerrar la fila.", 500];
  throw new ErrorImportacion(texto, status, codigo ?? "ERROR_INTERNO");
}

/**
 * Cierra una fila que quedó para carga manual.
 * Cuerpo: `{ tipo: "cargada", jornadaId }` o `{ tipo: "descartada", motivo }`.
 */
export async function POST(pedido: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new ErrorImportacion("El identificador de la fila no es válido.", 400, "ID_INVALIDO");
    const { supabase } = await sesionSecretaria();
    const cuerpo = (await pedido.json()) as { tipo?: string; jornadaId?: string; jornada_id?: string; motivo?: string };
    const { data, error } = await supabase.rpc("resolver_fila_pendiente", {
      p_id: id,
      p_resolucion: { tipo: cuerpo.tipo, jornada_id: cuerpo.jornadaId ?? cuerpo.jornada_id, motivo: cuerpo.motivo },
    });
    if (error) traducir(error.message);
    return Response.json(data);
  } catch (error) {
    return respuestaError(error);
  }
}
