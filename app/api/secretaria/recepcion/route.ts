import { createClient } from "@supabase/supabase-js";
import { MAX_ARCHIVO_EVALUACION_BYTES, type ContextoEvaluacion } from "@/lib/evaluaciones-importacion";
import { ErrorImportacion, hashArchivo, respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

export const runtime = "nodejs";

const BUCKET = "planillas-recepcion";
const TIPOS: Record<string, string> = {
  ".csv": "text/csv",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** El navegador manda un mime poco confiable: mandan la extensión y el mime, y gana la extensión. */
function tipoDe(nombre: string): string {
  const ext = nombre.slice(nombre.lastIndexOf(".")).toLowerCase();
  const tipo = TIPOS[ext];
  if (!tipo) throw new ErrorImportacion("Solo aceptamos .csv, .xls o .xlsx.", 400, "TIPO_NO_SOPORTADO");
  return tipo;
}

function traducir(mensaje: string): never {
  const codigo = mensaje.match(/TDS:([A-Z_]+)/u)?.[1];
  const mapa: Record<string, [string, number]> = {
    SIN_ALCANCE: ["No tenés acceso al Espacio Secretaría.", 403],
    ROL_INSUFICIENTE: ["Tu rol no puede enviar planillas a revisión.", 403],
    TIPO_NO_SOPORTADO: ["Solo aceptamos .csv, .xls o .xlsx.", 400],
    ARCHIVO_VACIO: ["El archivo está vacío.", 400],
    ARCHIVO_DEMASIADO_GRANDE: ["El archivo supera los 20 MB.", 400],
    CONTEXTO_INCOMPLETO: ["Completá institución, disciplina y grupo.", 400],
    HASH_INVALIDO: ["No pudimos verificar el archivo.", 400],
  };
  const [texto, status] = mapa[codigo ?? ""] ?? ["No pudimos recibir la planilla.", 500];
  throw new ErrorImportacion(texto, status, codigo ?? "ERROR_INTERNO");
}

/** Recepción para procesamiento manual. NO importa nada: solo guarda el original. */
export async function POST(pedido: Request) {
  try {
    const { supabase, membresia } = await sesionSecretaria();
    const formulario = await pedido.formData();
    const archivo = formulario.get("archivo");
    if (!(archivo instanceof File)) throw new ErrorImportacion("Adjuntá la planilla.", 400, "ARCHIVO_INVALIDO");
    if (archivo.size === 0) throw new ErrorImportacion("El archivo está vacío.", 400, "ARCHIVO_VACIO");
    if (archivo.size > MAX_ARCHIVO_EVALUACION_BYTES) {
      throw new ErrorImportacion("El archivo supera los 20 MB.", 400, "ARCHIVO_DEMASIADO_GRANDE");
    }
    const tipo = tipoDe(archivo.name);

    const crudo = formulario.get("contexto");
    let contexto: ContextoEvaluacion;
    try {
      contexto = JSON.parse(typeof crudo === "string" ? crudo : "") as ContextoEvaluacion;
    } catch {
      throw new ErrorImportacion("Falta el contexto de la planilla.", 400, "CONTEXTO_INCOMPLETO");
    }
    const motivo = formulario.get("motivo");
    const hash = await hashArchivo(archivo);

    const { data: registro, error } = await supabase.rpc("registrar_recepcion_manual", {
      p_nombre_archivo: archivo.name,
      p_hash: hash,
      p_tamano: archivo.size,
      p_tipo_mime: tipo,
      p_contexto: contexto,
      p_motivo: typeof motivo === "string" ? motivo : null,
    });
    if (error) traducir(error.message);
    const resultado = registro as {
      id: string; numeroSeguimiento: string; estado: string;
      duplicada: boolean; reintento: boolean; rutaStorage: string | null;
    };

    // Ya estaba en cola: no se vuelve a subir ni se duplica el seguimiento.
    if (resultado.duplicada) {
      return Response.json({
        estado: resultado.estado,
        numeroSeguimiento: resultado.numeroSeguimiento,
        duplicada: true,
        mensaje: "Esta planilla ya había sido recibida para revisión. Te devolvemos el mismo número de seguimiento.",
      });
    }

    // La subida va con la clave de servicio: el bucket es privado y el
    // browser nunca escribe en él.
    const servicio = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ext = archivo.name.slice(archivo.name.lastIndexOf("."));
    const ruta = `${membresia.club_id}/${resultado.id}${ext}`;
    const { error: errorSubida } = await servicio.storage
      .from(BUCKET)
      // upsert en un reintento: la fila es la misma y la ruta también.
      .upload(ruta, Buffer.from(await archivo.arrayBuffer()), { contentType: tipo, upsert: resultado.reintento });
    if (errorSubida) {
      // La recepción NO queda como "recibida": se marca recuperable y el
      // mismo envío se puede reintentar sobre la misma fila.
      await supabase.rpc("marcar_error_subida_recepcion", { p_id: resultado.id, p_detalle: errorSubida.message });
      throw new ErrorImportacion(
        "No pudimos guardar el archivo. La planilla quedó pendiente: volvé a enviarla para reintentar.",
        502, "SUBIDA_FALLIDA",
      );
    }
    const { error: errorConfirmar } = await supabase.rpc("confirmar_archivo_recepcion", {
      p_id: resultado.id, p_ruta: ruta,
    });
    if (errorConfirmar) traducir(errorConfirmar.message);

    return Response.json({
      estado: "RECIBIDA_PARA_REVISION",
      numeroSeguimiento: resultado.numeroSeguimiento,
      duplicada: false,
      reintento: resultado.reintento,
      mensaje:
        "Recibimos la planilla para revisión. El formato no se pudo procesar automáticamente, así que el equipo de Secretaría revisará sus hojas y datos. Todavía no se importó nada.",
    });
  } catch (error) {
    return respuestaError(error);
  }
}

/** Listado para la pantalla de Planillas. */
export async function GET() {
  try {
    const { supabase } = await sesionSecretaria();
    const { data, error } = await supabase.rpc("recepciones_manuales", { p_id: null });
    if (error) traducir(error.message);
    return Response.json({ recepciones: data });
  } catch (error) {
    return respuestaError(error);
  }
}
