import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Destino del link de acceso que genera el admin en /club/staff:
 * valida el token (invite para gente nueva, recovery para quien ya
 * tenía cuenta), deja la sesión en cookies y manda a crear la
 * contraseña. El link vive en NUESTRO dominio — no depende del
 * allowlist de redirects de Supabase.
 *
 * Las cookies de sesión se atan EXPLÍCITAMENTE a la respuesta de
 * redirect (patrón de proxy.ts): con el helper de cookies() del
 * server component no llegaban al browser en este Next.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type");

  if (tokenHash && (tipo === "invite" || tipo === "recovery")) {
    const respuesta = NextResponse.redirect(`${origin}/cuenta/clave`);
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              respuesta.cookies.set(name, value, options),
            );
          },
        },
      },
    );
    const { error } = await supabase.auth.verifyOtp({
      type: tipo,
      token_hash: tokenHash,
    });
    if (!error) return respuesta;
  }

  return NextResponse.redirect(`${origin}/login?aviso=link-vencido`);
}
