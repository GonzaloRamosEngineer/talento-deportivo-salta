import {
  ErrorImportacion,
  exigirEntornoImportacion,
  respuestaError,
  sesionOperativaSecretaria,
  verificarPreview,
} from "@/lib/evaluaciones/backend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    exigirEntornoImportacion();
    const { supabase, user, membresia } = await sesionOperativaSecretaria();
    const cuerpo = await request.json() as {
      previewToken?: string;
      resoluciones?: { hallazgos?: Record<string, string> };
    };
    if (!cuerpo.previewToken) throw new ErrorImportacion("Falta la previsualización.", 400, "TOKEN_INVALIDO");
    const payload = verificarPreview(cuerpo.previewToken, user.id);
    if (payload.organizacionId !== membresia.club_id) {
      throw new ErrorImportacion("La previsualización pertenece a otro espacio.", 403, "SIN_ALCANCE");
    }
    const { data, error } = await supabase.rpc("confirmar_lote_evaluacion", {
      p_lote_id: payload.loteId,
      p_resoluciones: cuerpo.resoluciones?.hallazgos ?? {},
    });
    if (error) {
      const codigo = error.message.match(/TDS:([A-Z_]+)/u)?.[1];
      if (codigo === "PREVIEW_EXPIRADO") throw new ErrorImportacion("La previsualización venció. Volvé a analizar el archivo.", 410, codigo);
      if (codigo === "BLOQUEOS_PENDIENTES") throw new ErrorImportacion("Todavía hay decisiones obligatorias sin resolver.", 422, codigo);
      if (codigo === "IMPORTACION_DUPLICADA") throw new ErrorImportacion("Este lote ya fue importado.", 409, codigo);
      if (codigo === "CONFLICTO_MEDICION") throw new ErrorImportacion("Ya existe una medición para la misma jornada, métrica, protocolo e intento. No se sobrescribió ningún dato.", 409, codigo);
      if (codigo === "SIN_ALCANCE") throw new ErrorImportacion("El grupo todavía no existe o no está asignado a tu cuenta. Pedile a coordinación que lo cree y te dé acceso.", 403, "GRUPO_SIN_ALCANCE");
      if (error.message.includes('row-level security policy for table "categoria"')) {
        throw new ErrorImportacion("El grupo todavía no existe o no está asignado a tu cuenta. Pedile a coordinación que lo cree y te dé acceso.", 403, "GRUPO_SIN_ALCANCE");
      }
      throw new ErrorImportacion("No pudimos confirmar la importación. Ningún dato fue guardado.", 500, "IMPORTACION_FALLIDA");
    }
    return Response.json(data);
  } catch (error) {
    return respuestaError(error);
  }
}
