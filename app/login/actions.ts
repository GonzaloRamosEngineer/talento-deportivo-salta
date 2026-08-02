"use server";

import { crearClienteServer } from "@/lib/supabase/server";
import { esEmailDemo } from "@/lib/demo";

/**
 * Acceso rápido a la demo, del lado del SERVER (T-001 del plan CTO).
 *
 * Antes el login demo era `signInWithPassword` en el cliente con la
 * contraseña escrita en `app/login/page.tsx` — o sea, publicada en el
 * bundle y usable contra la API de Auth desde cualquier script, sin
 * forma de rotarla salvo un redeploy. Ahora el visitante pide "entrar
 * como profe" y la contraseña nunca sale del server: vive en
 * `DEMO_PASSWORD`.
 *
 * La sesión que se crea es real (RLS de verdad, es el punto de la
 * demo), pero las cuentas demo están bloqueadas en toda action
 * sensible — ver `lib/demo.ts`.
 */

type Resultado = { ok: true } | { ok: false; error: string };

export async function entrarComoDemo(email: string): Promise<Resultado> {
  const mail = email.trim().toLowerCase();
  if (!esEmailDemo(mail)) {
    return { ok: false, error: "Ese no es un perfil de la demo." };
  }

  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    return {
      ok: false,
      error: "La demo no está configurada en este entorno (falta DEMO_PASSWORD).",
    };
  }

  const supabase = await crearClienteServer();
  const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
  if (error) {
    // No filtrar el detalle: si la clave demo quedó desincronizada es
    // un problema de configuración nuestro, no del visitante.
    console.error("[demo] login falló:", error.message);
    return { ok: false, error: "No se pudo abrir la demo. Probá de nuevo en un rato." };
  }
  return { ok: true };
}
