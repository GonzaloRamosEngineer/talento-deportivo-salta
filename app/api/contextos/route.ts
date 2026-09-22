import { crearClienteServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await crearClienteServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Iniciá sesión." }, { status: 401 });
  const { data, error } = await supabase
    .from("membresia")
    .select("id, rol, club:club_id(id, nombre, tipo_organizacion, escudo_url)")
    .eq("auth_user_id", user.id);
  if (error) return Response.json({ error: "No pudimos cargar tus espacios." }, { status: 500 });
  const contextos: Array<{
    id: string;
    tipo: "organizacion" | "observatorio";
    rol: string;
    organizacion: { id: string; nombre: string; tipo_organizacion: string; escudo_url: string | null } | null;
  }> = (data ?? []).map((fila) => {
    const organizacion = Array.isArray(fila.club) ? fila.club[0] : fila.club;
    return { id: fila.id, tipo: "organizacion", rol: fila.rol, organizacion };
  });
  if (user.app_metadata?.plataforma) {
    contextos.push({ id: "observatorio", tipo: "observatorio", rol: "plataforma", organizacion: null });
  }
  return Response.json({ contextos });
}
