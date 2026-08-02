import type { User } from "@supabase/supabase-js";

/**
 * Cuentas DEMO de la vitrina pública (T-001 del plan CTO).
 *
 * La demo y producción comparten hoy el mismo proyecto Supabase (la
 * separación es T-003). Hasta entonces, las cuentas demo son públicas
 * por diseño pero NO pueden ejecutar nada sensible: toda action que
 * toque Auth o use service role las rechaza en el SERVER, no
 * escondiendo botones.
 *
 * Los emails no son secretos (identifican perfiles de una demo
 * abierta). La CONTRASEÑA sí: vive solo en `DEMO_PASSWORD` del server
 * y nunca viaja al bundle — el login demo pasa por la server action
 * `entrarComoDemo` (`app/login/actions.ts`). Rotarla es cambiar la
 * variable de entorno, sin redeploy de código.
 *
 * El perfil PLATAFORMA quedó fuera de esta lista a propósito: la
 * cuenta `plataforma@demo.talento.ar` se eliminó (tenía
 * `app_metadata.plataforma` y podía acuñar links de recuperación de
 * administradores reales). El observatorio de la demo se recorre
 * anónimo, con el mock que ya existe en `lib/use-observatorio.ts`.
 */

export const EMAILS_DEMO = [
  "profe@demo.talento.ar",
  "admin@demo.talento.ar",
  "comision@demo.talento.ar",
] as const;

export type EmailDemo = (typeof EMAILS_DEMO)[number];

export function esEmailDemo(email: string | null | undefined): email is EmailDemo {
  if (!email) return false;
  return (EMAILS_DEMO as readonly string[]).includes(email.toLowerCase());
}

/**
 * ¿Esta sesión es una cuenta de la vitrina? Se apoya en
 * `app_metadata.demo` (solo se escribe con service role, el usuario no
 * puede autoasignárselo ni quitárselo) y además contra la lista de
 * emails, para que la contención no dependa de que el flag haya sido
 * aplicado.
 */
export function esCuentaDemo(user: Pick<User, "email" | "app_metadata"> | null): boolean {
  if (!user) return false;
  return user.app_metadata?.demo === true || esEmailDemo(user.email);
}

/** Motivo único, para que el mensaje sea el mismo en toda la app. */
export const MOTIVO_DEMO =
  "Esto no se puede hacer desde la demo pública: toca cuentas y accesos reales. " +
  "Pedí un club de prueba propio para recorrerlo completo.";
