import { ErrorImportacion, respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function traducir(mensaje: string): never {
  const codigo = mensaje.match(/TDS:([A-Z_]+)/u)?.[1];
  const mapa: Record<string, [string, number]> = {
    SIN_ALCANCE: ["Esta planilla no pertenece a tu espacio.", 403],
    ROL_INSUFICIENTE: ["Tu rol no puede revisar planillas.", 403],
    LOTE_NO_EDITABLE: ["La planilla ya fue importada: no admite correcciones por esta vía.", 409],
    PREVIEW_EXPIRADO: ["La previsualización venció. Volvé a subir el archivo.", 410],
    MOTIVO_REQUERIDO: ["Escribí el motivo de la corrección.", 400],
    HALLAZGO_DESCONOCIDO: ["Esa resolución no corresponde a ningún bloqueo de la planilla.", 400],
    FECHA_INVALIDA: ["La fecha ingresada no es válida.", 400],
    BLOQUEOS_PENDIENTES: ["Todavía hay decisiones sin resolver.", 422],
    IMPORTACION_DUPLICADA: ["Esta planilla ya fue importada.", 409],
    PROTOCOLO_DESCONOCIDO: ["El protocolo elegido no existe en el catálogo.", 400],
    FECHA_REQUERIDA: ["Falta la fecha oficial de la jornada.", 422],
    ARCHIVO_DISTINTO: ["El archivo no coincide con el de esta planilla.", 409],
    MAPA_INCOMPLETO: ["Falta decidir qué hacer con algunos valores sin protocolo. Ninguno se excluye solo.", 422],
    MAPA_CON_CLAVES_EXTRA: ["El mapa incluye valores que no están en la planilla.", 400],
    PROTOCOLO_NO_DISPONIBLE: ["Ese protocolo no está habilitado para la disciplina de la planilla.", 400],
    RESOLUCION_INVALIDA: ["La resolución debe ser 'excluir_todo', o un protocolo o 'excluir' por cada valor.", 400],
  };
  const [texto, status] = mapa[codigo ?? ""] ?? ["No pudimos completar la operación.", 500];
  // Los códigos de mapa traen los valores concretos después del segundo ":".
  const detalle = mensaje.match(/TDS:[A-Z_]+:(.+)$/u)?.[1]?.trim();
  throw new ErrorImportacion(detalle ? `${texto} (${detalle})` : texto, status, codigo ?? "ERROR_INTERNO");
}

/** Bloqueos, filas afectadas y opciones de resolución. */
export async function GET(_pedido: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new ErrorImportacion("El identificador de la planilla no es válido.", 400, "ID_INVALIDO");
    const { supabase } = await sesionSecretaria();
    const { data, error } = await supabase.rpc("bloqueos_lote", { p_lote_id: id });
    if (error) traducir(error.message);
    return Response.json(data);
  } catch (error) {
    return respuestaError(error);
  }
}

/** Guarda resoluciones y/o correcciones de contexto. Nada se escribe en firme. */
export async function POST(pedido: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new ErrorImportacion("El identificador de la planilla no es válido.", 400, "ID_INVALIDO");
    const { supabase } = await sesionSecretaria();
    const cuerpo = (await pedido.json()) as {
      resoluciones?: Record<string, unknown>;
      contexto?: Record<string, string>;
      motivo?: string;
      confirmar?: boolean;
    };
    if (!cuerpo.motivo?.trim()) throw new ErrorImportacion("Escribí el motivo de la corrección.", 400, "MOTIVO_REQUERIDO");

    if (cuerpo.contexto && Object.keys(cuerpo.contexto).length) {
      const { error } = await supabase.rpc("corregir_contexto_lote", {
        p_lote_id: id, p_cambios: cuerpo.contexto, p_motivo: cuerpo.motivo,
      });
      if (error) traducir(error.message);
    }
    if (cuerpo.resoluciones && Object.keys(cuerpo.resoluciones).length) {
      const { error } = await supabase.rpc("guardar_resoluciones_lote", {
        p_lote_id: id, p_resoluciones: cuerpo.resoluciones, p_motivo: cuerpo.motivo,
      });
      if (error) traducir(error.message);
    }
    if (cuerpo.confirmar) {
      const { data, error } = await supabase.rpc("confirmar_lote_revisado", {
        p_lote_id: id, p_motivo: cuerpo.motivo,
      });
      if (error) traducir(error.message);
      return Response.json({ confirmado: true, resultado: data });
    }
    const { data, error } = await supabase.rpc("bloqueos_lote", { p_lote_id: id });
    if (error) traducir(error.message);
    return Response.json({ confirmado: false, revision: data });
  } catch (error) {
    return respuestaError(error);
  }
}
