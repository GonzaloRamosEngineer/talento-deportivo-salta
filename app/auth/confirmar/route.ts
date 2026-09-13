import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Destino de TODOS los links de acceso del producto. Valida el token,
 * deja la sesión en cookies y manda a crear la contraseña. El link vive
 * en NUESTRO dominio — no depende del allowlist de redirects de Supabase,
 * y además evita que el mail apunte a un host de terceros, que es lo que
 * lo mandaba a spam.
 *
 * Tres tipos, y la diferencia entre ellos es de seguridad, no de forma:
 *
 *   invite     · cuenta nueva, la crea el admin al invitar.
 *   magiclink  · cuenta que existe pero NUNCA se usó: reemitir su
 *                onboarding no le saca el acceso a nadie (T-002).
 *   recovery   · lo pide el titular desde /login y le llega SOLO a su
 *                correo (T-002C). Un admin no puede emitirlo.
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

  const tiposValidos = ["invite", "magiclink", "recovery"] as const;
  type TipoValido = (typeof tiposValidos)[number];
  const esTipoValido = (t: string | null): t is TipoValido =>
    tiposValidos.includes(t as TipoValido);

  if (tokenHash && esTipoValido(tipo)) {
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
