import { MAX_ARCHIVO_EVALUACION_BYTES, type ContextoEvaluacion } from "@/lib/evaluaciones-importacion";
import {
  clienteServicio,
  ErrorImportacion,
  exigirEntornoImportacion,
  firmarPreview,
  respuestaError,
  sesionOperativaSecretaria,
} from "@/lib/evaluaciones/backend";
import { aPrevisualizacion, parsearEvaluacion } from "@/lib/evaluaciones/importador/parsear";
import { registrarLote } from "@/lib/evaluaciones/originales";

export const runtime = "nodejs";

function validarContexto(valor: FormDataEntryValue | null): ContextoEvaluacion {
  if (typeof valor !== "string") throw new ErrorImportacion("Falta el contexto de la jornada.", 400, "CONTEXTO_INVALIDO");
  let contexto: ContextoEvaluacion;
  try {
    contexto = JSON.parse(valor) as ContextoEvaluacion;
  } catch {
    throw new ErrorImportacion("El contexto de la jornada no es válido.", 400, "CONTEXTO_INVALIDO");
  }
  if (!contexto.institucionOrigen?.trim() || !contexto.disciplina?.trim() || !contexto.grupo?.trim() || !contexto.evaluadoPor?.trim()) {
    throw new ErrorImportacion("Completá institución, disciplina, grupo y evaluador.", 400, "CONTEXTO_INCOMPLETO");
  }
  return {
    institucionOrigen: contexto.institucionOrigen.trim(),
    disciplina: contexto.disciplina.trim(),
    grupo: contexto.grupo.trim(),
    fechaDeclarada: contexto.fechaDeclarada?.trim() ?? "",
    evaluadoPor: contexto.evaluadoPor.trim(),
  };
}

export async function POST(request: Request) {
  try {
    exigirEntornoImportacion();
    const { supabase, user, membresia } = await sesionOperativaSecretaria();
    const formulario = await request.formData();
    const archivo = formulario.get("archivo");
    if (!(archivo instanceof File)) throw new ErrorImportacion("Seleccioná una planilla.", 400, "ARCHIVO_INVALIDO");
    if (archivo.size === 0 || archivo.size > MAX_ARCHIVO_EVALUACION_BYTES) {
      throw new ErrorImportacion("El archivo está vacío o supera los 20 MB.", 400, "ARCHIVO_INVALIDO");
    }
    const contexto = validarContexto(formulario.get("contexto"));
    let normalizada: Awaited<ReturnType<typeof parsearEvaluacion>>;
    try {
      normalizada = await parsearEvaluacion(archivo, contexto);
    } catch (error) {
      const detalle = error instanceof Error ? error.message : "";
      if (
        detalle.includes("La estructura de esta planilla todavía no tiene un adaptador reconocido")
        || detalle.includes("No reconocimos la cabecera")
        || detalle.includes("No encontramos la hoja")
        || detalle.includes("El formato .xls antiguo no se admite todavía")
      ) {
        throw new ErrorImportacion(
          "No pudimos leer esta estructura con seguridad. Podés enviarla al equipo para revisión manual; todavía no se guardó ni se importó.",
          422,
          "FORMATO_NO_RECONOCIDO",
        );
      }
      throw error;
    }
    // El original se guarda ANTES de responder: si no se pudo guardar, no
    // hay previsualización que devolver (el lote queda `fallido`).
    const { loteId, venceEn } = await registrarLote({
      usuario: supabase,
      servicio: clienteServicio(),
      membresia,
      nombreArchivo: archivo.name,
      bytes: new Uint8Array(await archivo.arrayBuffer()),
      contexto,
      normalizada,
    });

    // El token vence junto con el lote. Igual, /importar no lo usa para
    // decidir si el lote sigue abierto: eso lo dice la base.
    const token = firmarPreview({
      loteId,
      usuarioId: user.id,
      organizacionId: membresia.club_id,
      exp: venceEn.getTime(),
    });
    return Response.json(aPrevisualizacion(archivo.name, token, normalizada));
  } catch (error) {
    return respuestaError(error);
  }
}
