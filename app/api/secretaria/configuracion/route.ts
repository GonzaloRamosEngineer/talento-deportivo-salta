import {
  ErrorImportacion,
  exigirEntornoImportacion,
  respuestaError,
  sesionOperativaSecretaria,
} from "@/lib/evaluaciones/backend";

function errorRpc(error: { message: string }) {
  const codigo = error.message.match(/TDS:([A-Z_]+)/u)?.[1] ?? "CONFIGURACION_NO_GUARDADA";
  const mensajes: Record<string, string> = {
    SIN_ALCANCE: "Tu cuenta no tiene acceso a este espacio o grupo.",
    ROL_INSUFICIENTE: "Tu rol no permite realizar esta operación.",
    MOTIVO_REQUERIDO: "Indicá el motivo de la modificación.",
    NOMBRE_REQUERIDO: "Completá el nombre.",
    TIPO_INVALIDO: "El tipo seleccionado no es válido.",
    INSTITUCION_DUPLICADA: "Ya existe una institución con ese nombre.",
    INSTITUCION_DESCONOCIDA: "La institución seleccionada ya no está disponible.",
    GRUPO_DESCONOCIDO: "El grupo seleccionado ya no está disponible.",
    GRUPO_DUPLICADO: "Ya existe ese grupo para la institución y disciplina.",
    GRUPO_CON_MEDICIONES: "No se puede cambiar la disciplina de un grupo que ya tiene mediciones.",
    DISCIPLINA_DESCONOCIDA: "La disciplina seleccionada ya no está disponible.",
  };
  const status = codigo === "SIN_ALCANCE" || codigo === "ROL_INSUFICIENTE" ? 403
    : codigo.includes("DUPLICAD") || codigo === "GRUPO_CON_MEDICIONES" ? 409
      : 422;
  return new ErrorImportacion(mensajes[codigo] ?? "No pudimos guardar la configuración.", status, codigo);
}

export async function GET() {
  try {
    const { supabase, membresia } = await sesionOperativaSecretaria();
    const [arbol, disciplinas] = await Promise.all([
      supabase.rpc("arbol_secretaria", { p_incluir_inactivos: false }),
      supabase.from("disciplina").select("id, nombre").eq("activo", true).order("nombre"),
    ]);
    const error = arbol.error ?? disciplinas.error;
    if (error) throw error;
    return Response.json({
      arbol: arbol.data ?? [],
      disciplinas: disciplinas.data ?? [],
      rol: membresia.rol,
    });
  } catch (error) {
    return respuestaError(error);
  }
}

export async function POST(request: Request) {
  try {
    exigirEntornoImportacion();
    const { supabase } = await sesionOperativaSecretaria();
    const cuerpo = await request.json() as Record<string, unknown>;
    let operacion;
    switch (cuerpo.accion) {
      case "crear_institucion":
        operacion = await supabase.rpc("crear_institucion_secretaria", {
          p_nombre: cuerpo.nombre,
          p_tipo: cuerpo.tipo || null,
          p_localidad: cuerpo.localidad || null,
          p_notas: cuerpo.notas || null,
          p_forzar: false,
        });
        break;
      case "crear_grupo":
        operacion = await supabase.rpc("crear_grupo_secretaria", {
          p_institucion_id: cuerpo.institucionId,
          p_disciplina_id: cuerpo.disciplinaId,
          p_nombre: cuerpo.nombre,
          p_tipo: cuerpo.tipo || null,
        });
        break;
      case "crear_deportista":
        operacion = await supabase.rpc("crear_deportista_secretaria", {
          p_grupo_id: cuerpo.grupoId,
          p_identidad: cuerpo.identidad,
          p_resolucion: cuerpo.resolucion || null,
        });
        break;
      case "solicitar_disciplina":
        operacion = await supabase.rpc("solicitar_disciplina_secretaria", {
          p_nombre: cuerpo.nombre,
          p_descripcion: cuerpo.descripcion || null,
          p_contexto: cuerpo.contexto || null,
        });
        break;
      default:
        throw new ErrorImportacion("La operación solicitada no es válida.", 400, "ACCION_INVALIDA");
    }
    if (operacion.error) throw errorRpc(operacion.error);
    return Response.json(operacion.data);
  } catch (error) {
    return respuestaError(error);
  }
}
