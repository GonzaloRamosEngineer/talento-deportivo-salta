import { MAX_ARCHIVO_EVALUACION_BYTES, type ContextoEvaluacion } from "@/lib/evaluaciones-importacion";
import {
  ErrorImportacion,
  exigirEntornoImportacion,
  firmarPreview,
  hashArchivo,
  respuestaError,
  sesionOperativaSecretaria,
} from "@/lib/evaluaciones/backend";
import { aPrevisualizacion, parsearEvaluacion } from "@/lib/evaluaciones/importador/parsear";

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
    const normalizada = await parsearEvaluacion(archivo, contexto);
    const hash = await hashArchivo(archivo);
    const bloqueos = normalizada.hallazgos.filter((hallazgo) => hallazgo.severidad === "bloqueo").length;

    const { data: lote, error } = await supabase
      .from("lote_importacion")
      .insert({
        club_id: membresia.club_id,
        nombre_archivo: archivo.name,
        hash_sha256: hash,
        adaptador: normalizada.adaptador,
        contexto,
        preview_json: normalizada,
        hallazgos: normalizada.hallazgos,
        filas_ignoradas: normalizada.filasIgnoradas,
        duplicados_archivo: normalizada.duplicados,
        bloqueos_pendientes: bloqueos,
        importado_por: membresia.id,
        vence_en: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (error || !lote) {
      if (error?.code === "23505") throw new ErrorImportacion("Este archivo ya fue previsualizado o importado para el mismo contexto.", 409, "IMPORTACION_DUPLICADA");
      throw new ErrorImportacion("No pudimos guardar la previsualización.", 500, "PREVIEW_NO_GUARDADA");
    }

    const token = firmarPreview({
      loteId: lote.id,
      usuarioId: user.id,
      organizacionId: membresia.club_id,
      exp: Date.now() + 30 * 60 * 1000,
    });
    return Response.json(aPrevisualizacion(archivo.name, token, normalizada));
  } catch (error) {
    return respuestaError(error);
  }
}

