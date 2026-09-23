import {
  ErrorImportacion,
  respuestaError,
  sesionOperativaSecretaria,
} from "@/lib/evaluaciones/backend";

export async function GET() {
  try {
    const { supabase, membresia } = await sesionOperativaSecretaria();
    const [grupos, deportistas, enlaces, responsable, arbol, disciplinas] = await Promise.all([
      supabase
        .from("categoria")
        .select("id, nombre, institucion:institucion_origen_id(id, nombre), disciplina:disciplina_id(id, nombre)")
        .eq("club_id", membresia.club_id)
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("deportista")
        .select("id, nombre, apellido, categoria_id")
        .eq("club_id", membresia.club_id)
        .eq("activo", true)
        .order("apellido")
        .order("nombre"),
      supabase
        .from("disciplina_protocolo")
        .select("disciplina_id, orden, protocolo:protocolo_id(id, codigo, nombre, descripcion, protocolo_atributo(requerido, unidad, minimo, maximo, atributo:atributo_id(id, codigo, nombre)))")
        .eq("activo", true)
        .order("orden"),
      supabase
        .from("membresia")
        .select("nombre")
        .eq("id", membresia.id)
        .single(),
      supabase.rpc("arbol_secretaria", { p_incluir_inactivos: false }),
      supabase.from("disciplina").select("id, nombre").eq("activo", true).order("nombre"),
    ]);
    const error = grupos.error ?? deportistas.error ?? enlaces.error ?? responsable.error ?? arbol.error ?? disciplinas.error;
    if (error) throw error;
    return Response.json({
      grupos: grupos.data ?? [],
      deportistas: deportistas.data ?? [],
      protocolos: enlaces.data ?? [],
      responsable: responsable.data?.nombre ?? "Equipo Secretaría",
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
    const { supabase } = await sesionOperativaSecretaria();
    const cuerpo = await request.json() as {
      contexto?: Record<string, unknown>;
      mediciones?: Array<Record<string, unknown>>;
      idempotencyKey?: string;
    };
    if (!cuerpo.contexto || !cuerpo.mediciones?.length || !cuerpo.idempotencyKey) {
      throw new ErrorImportacion("Completá la jornada y al menos una medición.", 400, "DATOS_INCOMPLETOS");
    }
    const { data, error } = await supabase.rpc("guardar_jornada_evaluacion_manual", {
      p_contexto: cuerpo.contexto,
      p_mediciones: cuerpo.mediciones,
      p_idempotency_key: cuerpo.idempotencyKey,
    });
    if (error) {
      const codigo = error.message.match(/TDS:([A-Z_]+)/u)?.[1] ?? "JORNADA_NO_GUARDADA";
      const mensajes: Record<string, string> = {
        FECHA_REQUERIDA: "Elegí la fecha oficial de la jornada.",
        EVALUADOR_REQUERIDO: "Indicá quién realizó la evaluación.",
        GRUPO_DESCONOCIDO: "El grupo seleccionado ya no está disponible.",
        PROTOCOLO_NO_APLICA: "El protocolo no corresponde a la disciplina.",
        METRICA_NO_APLICA: "La métrica no corresponde al protocolo.",
        VALOR_FUERA_DE_RANGO: "Uno de los valores está fuera del rango permitido.",
        DEPORTISTA_FUERA_DE_GRUPO: "Uno de los deportistas ya no pertenece al grupo.",
        CONFLICTO_MEDICION: "Ya existen mediciones para esa jornada, protocolo e intento.",
        SIN_ALCANCE: "Tu cuenta no tiene alcance sobre este grupo.",
      };
      throw new ErrorImportacion(mensajes[codigo] ?? "No pudimos guardar la jornada.", codigo === "CONFLICTO_MEDICION" ? 409 : 422, codigo);
    }
    return Response.json(data);
  } catch (error) {
    return respuestaError(error);
  }
}
