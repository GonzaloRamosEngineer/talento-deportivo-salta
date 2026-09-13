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

/**
 * "Olvidé mi contraseña" (T-002C del plan CTO).
 *
 * Existe para que recuperar el acceso DEJE DE SER TAREA DEL ADMIN. Hasta
 * hoy, si alguien del staff perdía la clave, el admin del club generaba un
 * link de recuperación y se lo pasaba — o sea que el admin tenía en la mano
 * un token capaz de entrar como esa persona. Eso es lo que elimina T-002, y
 * no se puede eliminar sin esto: si no, la gente queda afuera sin salida.
 *
 * El enlace viaja EXCLUSIVAMENTE al correo del titular. El mail lo arma la
 * plantilla de Supabase (ver `docs/PLANTILLAS_EMAIL.md`), que apunta a
 * `/auth/confirmar?type=recovery` en NUESTRO dominio, valida el token con
 * verifyOtp y aterriza en `/cuenta/clave`.
 *
 * NO REVELA SI EL EMAIL EXISTE. La respuesta es la misma siempre, exista la
 * cuenta o no: cualquier diferencia convierte esta pantalla en un oráculo
 * para saber quién es staff de un club — de nuevo con datos de menores
 * detrás. Por eso los errores se registran en el server y nunca se devuelven.
 */
export async function pedirRecuperacion(email: string): Promise<Resultado> {
  const mail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    return { ok: false, error: "Revisá el email." };
  }

  // Las cuentas demo no recuperan clave: su contraseña vive en
  // DEMO_PASSWORD y es compartida por todos los visitantes. Se devuelve la
  // MISMA respuesta genérica, para no delatar cuáles son demo.
  if (esEmailDemo(mail)) return { ok: true };

  const supabase = await crearClienteServer();
  const { error } = await supabase.auth.resetPasswordForEmail(mail);

  if (error) {
    // El límite de envíos sí se puede informar: depende del ritmo de pedidos,
    // no de que la cuenta exista, así que no filtra nada.
    if (error.status === 429 || /rate limit/i.test(error.message)) {
      return {
        ok: false,
        error: "Hubo muchos intentos seguidos. Probá de nuevo en unos minutos.",
      };
    }
    console.error("[recuperacion] falló el envío:", error.message);
  }

  return { ok: true };
}
