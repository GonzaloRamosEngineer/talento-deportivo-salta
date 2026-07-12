import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para componentes "use client".
 * Usa la publishable key: segura en el browser porque TODA tabla
 * con datos tiene RLS activo (ver supabase/migrations/).
 */
export function crearClienteBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
