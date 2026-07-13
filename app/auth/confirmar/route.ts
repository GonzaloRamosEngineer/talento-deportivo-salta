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
  const { searchParams } = new URL(request.url);
  // Origen desde el header Host (o x-forwarded-host detrás de proxy):
  // request.url puede traer la dirección de BIND del server (ej.
  // 0.0.0.0 con `dev -H 0.0.0.0`) y un redirect a otro host pierde
  // las cookies de sesión que este handler acaba de setear.
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
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
