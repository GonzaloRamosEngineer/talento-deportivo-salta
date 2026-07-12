import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada request (patrón @supabase/ssr, vía `proxy` — `middleware` está deprecado en este Next):
 * sin esto, el token expira y los Server Components ven sesión vencida.
 * No protege rutas todavía — la app sigue siendo demo pública; el
 * gating por rol llega con el wiring de pantallas.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() refresca el token si hace falta (más liviano que getUser)
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // Todo menos estáticos e imágenes: la sesión viaja por las páginas
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
