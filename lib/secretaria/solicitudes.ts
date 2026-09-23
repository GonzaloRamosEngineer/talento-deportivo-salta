import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lo que la Secretaría ve de sus propias solicitudes de disciplina o
 * protocolo, con la respuesta de la plataforma. Va con la sesión de la
 * persona: el RLS (`solicitud_lectura`, miembros del club) acota el alcance.
 * Lo usan `/api/secretaria/configuracion` y el e2e.
 */
export interface SolicitudSecretaria {
  id: string;
  tipo: "disciplina" | "protocolo";
  nombre: string;
  disciplinaObjetivo: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  resolucion: string | null;
  creadoEn: string;
  resueltoEn: string | null;
}

export async function solicitudesDelEspacio(supabase: SupabaseClient, clubId: string) {
  const { data, error } = await supabase
    .from("disciplina_solicitud")
    .select("id, tipo, nombre, estado, resolucion, creado_en, resuelto_en, objetivo:disciplina!disciplina_solicitud_disciplina_objetivo_id_fkey(nombre)")
    .eq("club_id", clubId)
    .order("creado_en", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((s): SolicitudSecretaria => {
    const objetivo = s.objetivo as { nombre: string } | { nombre: string }[] | null;
    return {
      id: s.id as string,
      tipo: s.tipo as SolicitudSecretaria["tipo"],
      nombre: s.nombre as string,
      disciplinaObjetivo: (Array.isArray(objetivo) ? objetivo[0] : objetivo)?.nombre ?? null,
      estado: s.estado as SolicitudSecretaria["estado"],
      resolucion: (s.resolucion as string | null) ?? null,
      creadoEn: s.creado_en as string,
      resueltoEn: (s.resuelto_en as string | null) ?? null,
    };
  });
}
