import { respuestaError, sesionSecretaria } from "@/lib/evaluaciones/backend";

function uno<T>(valor: T | T[] | null): T | null {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

export async function GET() {
  try {
    const { supabase, membresia } = await sesionSecretaria();
    const { data, error } = await supabase
      .from("deportista")
      .select("id, nombre, apellido, fecha_nacimiento, categoria_id, categoria:categoria_id(id, nombre, institucion:institucion_origen_id(id, nombre), disciplina:disciplina_id(id, nombre)), mediciones:medicion(count)")
      .eq("club_id", membresia.club_id)
      .eq("activo", true)
      .order("apellido")
      .order("nombre");
    if (error) throw error;
    return Response.json((data ?? []).map((deportista) => {
      const categoria = uno(deportista.categoria);
      return {
        id: deportista.id,
        nombre: deportista.nombre,
        apellido: deportista.apellido,
        fechaNacimiento: deportista.fecha_nacimiento,
        grupoId: deportista.categoria_id,
        grupo: categoria?.nombre ?? "Sin grupo",
        institucion: uno(categoria?.institucion ?? null)?.nombre ?? "Sin institución",
        disciplina: uno(categoria?.disciplina ?? null)?.nombre ?? "Sin disciplina",
        mediciones: uno(deportista.mediciones)?.count ?? 0,
      };
    }));
  } catch (error) {
    return respuestaError(error);
  }
}
