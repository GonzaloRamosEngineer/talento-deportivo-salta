import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route
 * Handlers. Lleva la sesión del usuario en cookies (en este Next,
 * cookies() es async). Mismo alcance que el browser: RLS manda.
 */
export async function crearClienteServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // set() falla en Server Components (solo se puede escribir
            // en Server Actions / Route Handlers); el middleware o la
            // próxima action refrescan la sesión.
          }
        },
      },
    },
  );
}
