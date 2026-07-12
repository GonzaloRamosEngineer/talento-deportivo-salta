import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente ADMIN (secret key): salta RLS. SOLO para operaciones que
 * el modelo delega explícitamente al service role — alta de clubes,
 * primera membresía, curaduría del catálogo global. Nunca importarlo
 * desde código de cliente ("server-only" lo hace explotar en build
 * si alguien lo intenta) y nunca usarlo para lecturas de datos de
 * deportistas en flujos de usuario: para eso está el cliente con
 * sesión, que respeta RLS.
 */
export function crearClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
