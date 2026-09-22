import { respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function uno<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID.test(id)) {
      return Response.json({ error: "El identificador del deportista no es válido.", codigo: "ID_INVALIDO" }, { status: 400 });
    }
    const { supabase, membresia } = await sesionSecretaria();
    const [ficha, mediciones] = await Promise.all([
      supabase
        .from("deportista")
        .select("id, nombre, apellido, fecha_nacimiento, sexo, lateralidad, categoria_id, categoria:categoria_id(id, nombre, institucion:institucion_origen_id(id, nombre), disciplina:disciplina_id(id, nombre))")
        .eq("id", id)
        .eq("club_id", membresia.club_id)
        .maybeSingle(),
      supabase
        .from("medicion")
        .select("id, fecha, valor, intento, nota, lote_importacion_id, atributo:atributo_id(id, codigo, nombre, unidad, sentido), protocolo:protocolo_id(id, codigo, nombre), jornada:jornada_id(id, evaluado_por)")
        .eq("deportista_id", id)
        .eq("club_id", membresia.club_id)
        .order("fecha")
        .order("intento"),
    ]);
    const error = ficha.error ?? mediciones.error;
    if (error) throw error;
    if (!ficha.data) return Response.json({ error: "Ficha no encontrada." }, { status: 404 });
    const categoria = uno(ficha.data.categoria);
    return Response.json({
      deportista: {
        id: ficha.data.id,
        nombre: ficha.data.nombre,
        apellido: ficha.data.apellido,
        fechaNacimiento: ficha.data.fecha_nacimiento,
        sexo: ficha.data.sexo,
        lateralidad: ficha.data.lateralidad,
        grupoId: ficha.data.categoria_id,
        grupo: categoria?.nombre ?? "Sin grupo",
        institucion: uno(categoria?.institucion ?? null)?.nombre ?? "Sin institución",
        disciplina: uno(categoria?.disciplina ?? null)?.nombre ?? "Sin disciplina",
      },
      mediciones: (mediciones.data ?? []).map((medicion) => ({
        id: medicion.id,
        fecha: medicion.fecha,
        valor: Number(medicion.valor),
        intento: medicion.intento,
        nota: medicion.nota,
        loteId: medicion.lote_importacion_id,
        jornadaId: uno(medicion.jornada)?.id ?? null,
        atributo: uno(medicion.atributo),
        protocolo: uno(medicion.protocolo),
        evaluadoPor: uno(medicion.jornada)?.evaluado_por ?? "Equipo Secretaría",
      })),
    });
  } catch (error) {
    return respuestaError(error);
  }
}
