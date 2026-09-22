import { respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

function uno<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function conteo(valor: { count: number } | { count: number }[] | null | undefined) {
  return uno(valor)?.count ?? 0;
}

export async function GET() {
  try {
    const { supabase, membresia } = await sesionSecretaria();
    const clubId = membresia.club_id;
    const [lotes, jornadas, grupos, equipo, catalogoDisciplinas] = await Promise.all([
      supabase
        .from("lote_importacion")
        .select("id, nombre_archivo, estado, contexto, filas_ignoradas, duplicados_archivo, bloqueos_pendientes, creado_en, confirmado_en")
        .eq("club_id", clubId)
        .order("creado_en", { ascending: false })
        .limit(100),
      supabase
        .from("jornada_evaluacion")
        .select("id, fecha, estado, evaluado_por, institucion:institucion_origen_id(id, nombre), disciplina:disciplina_id(id, nombre), grupo:categoria_id(id, nombre), mediciones:medicion(count)")
        .eq("club_id", clubId)
        .order("fecha", { ascending: false })
        .limit(100),
      supabase
        .from("categoria")
        .select("id, nombre, institucion:institucion_origen_id(id, nombre), disciplina:disciplina_id(id, nombre), deportistas:deportista(count)")
        .eq("club_id", clubId)
        .order("nombre"),
      supabase
        .from("membresia")
        .select("id, nombre, email, rol, funcion, creado_en")
        .eq("club_id", clubId)
        .order("nombre"),
      supabase
        .from("disciplina")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
    ]);
    const error = lotes.error ?? jornadas.error ?? grupos.error ?? equipo.error ?? catalogoDisciplinas.error;
    if (error) throw error;
    const gruposLimpios = (grupos.data ?? []).map((grupo) => ({
      id: grupo.id,
      nombre: grupo.nombre,
      institucion: uno(grupo.institucion)?.nombre ?? "Sin institución",
      disciplina: uno(grupo.disciplina)?.nombre ?? "Sin disciplina",
      disciplinaId: uno(grupo.disciplina)?.id ?? "",
      deportistas: conteo(grupo.deportistas),
    }));
    const disciplinas = new Map<string, { id: string; nombre: string; grupos: number; lotes: number }>();
    for (const disciplina of catalogoDisciplinas.data ?? []) {
      disciplinas.set(disciplina.id, { ...disciplina, grupos: 0, lotes: 0 });
    }
    for (const grupo of gruposLimpios) {
      if (!grupo.disciplinaId) continue;
      const actual = disciplinas.get(grupo.disciplinaId) ?? { id: grupo.disciplinaId, nombre: grupo.disciplina, grupos: 0, lotes: 0 };
      actual.grupos += 1;
      disciplinas.set(grupo.disciplinaId, actual);
    }
    for (const lote of lotes.data ?? []) {
      const contexto = lote.contexto as { disciplina?: string };
      if (!contexto.disciplina) continue;
      const clave = contexto.disciplina.toLocaleLowerCase("es");
      const actual = [...disciplinas.values()].find((item) => item.nombre.toLocaleLowerCase("es") === clave);
      if (actual) actual.lotes += 1;
      else disciplinas.set(`lote:${clave}`, { id: `lote:${clave}`, nombre: contexto.disciplina, grupos: 0, lotes: 1 });
    }
    const jornadasLimpias = (jornadas.data ?? []).map((jornada) => ({
      id: jornada.id,
      fecha: jornada.fecha,
      estado: jornada.estado,
      evaluadoPor: jornada.evaluado_por,
      institucion: uno(jornada.institucion)?.nombre ?? "Sin institución",
      disciplina: uno(jornada.disciplina)?.nombre ?? "Sin disciplina",
      grupo: uno(jornada.grupo)?.nombre ?? "Sin grupo",
      mediciones: conteo(jornada.mediciones),
    }));
    const deportistas = gruposLimpios.reduce((total, grupo) => total + grupo.deportistas, 0);
    const mediciones = jornadasLimpias.reduce((total, jornada) => total + jornada.mediciones, 0);
    return Response.json({
      organizacionId: clubId,
      rol: membresia.rol,
      indicadores: {
        lotes: lotes.data?.length ?? 0,
        jornadas: jornadas.data?.length ?? 0,
        grupos: grupos.data?.length ?? 0,
        disciplinas: disciplinas.size,
        equipo: equipo.data?.length ?? 0,
        deportistas,
        mediciones,
        lotesImportados: (lotes.data ?? []).filter((lote) => lote.estado === "importado").length,
        lotesPendientes: (lotes.data ?? []).filter((lote) => lote.estado === "previsualizado").length,
      },
      lotes: lotes.data ?? [],
      jornadas: jornadasLimpias,
      grupos: gruposLimpios,
      disciplinas: [...disciplinas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      equipo: equipo.data ?? [],
    });
  } catch (error) {
    return respuestaError(error);
  }
}
