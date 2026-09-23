import { createClient } from "@supabase/supabase-js";
import { ErrorImportacion, respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

export const runtime = "nodejs";
const BUCKET = "planillas-recepcion";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
/** Solo estos roles pueden descargar el original. Un evaluador puede enviar, no leer. */
const PUEDEN_DESCARGAR = new Set(["admin_secretaria", "coordinador_secretaria", "analista_secretaria"]);

/** Detalle del archivo recibido. `?descarga=1` agrega una URL firmada de 5 minutos. */
export async function GET(pedido: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new ErrorImportacion("El identificador no es válido.", 400, "ID_INVALIDO");
    const { supabase, membresia } = await sesionSecretaria();

    const { data, error } = await supabase.rpc("recepciones_manuales", { p_id: id });
    if (error) throw new ErrorImportacion("No tenés acceso a esta planilla.", 403, "SIN_ALCANCE");
    const lista = (data ?? []) as Array<Record<string, unknown>>;
    if (!lista.length) throw new ErrorImportacion("No encontramos esa planilla.", 404, "NO_ENCONTRADA");
    const recepcion = lista[0];

    const quiereDescarga = new URL(pedido.url).searchParams.get("descarga") === "1";
    if (!quiereDescarga) return Response.json(recepcion);

    if (!PUEDEN_DESCARGAR.has(membresia.rol as string)) {
      throw new ErrorImportacion("Tu rol no puede descargar el archivo original.", 403, "ROL_INSUFICIENTE");
    }
    if (!recepcion.archivoDisponible) {
      throw new ErrorImportacion(
        "El archivo original ya no está disponible: fue purgado por la política de retención.",
        410, "ARCHIVO_PURGADO",
      );
    }

    // URL firmada y efímera. El bucket es privado: no existe URL pública.
    const servicio = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: firmada, error: errorFirma } = await servicio.storage
      .from(BUCKET)
      .createSignedUrl(`${membresia.club_id}/${id}${String(recepcion.archivo).slice(String(recepcion.archivo).lastIndexOf("."))}`, 300);
    if (errorFirma || !firmada) {
      throw new ErrorImportacion("No pudimos preparar la descarga.", 500, "DESCARGA_FALLIDA");
    }
    return Response.json({ ...recepcion, urlDescarga: firmada.signedUrl, expiraEnSegundos: 300 });
  } catch (error) {
    return respuestaError(error);
  }
}
