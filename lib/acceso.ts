import "server-only";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { SOPORTE_EMAIL } from "@/lib/site";

/**
 * Emisión de accesos de onboarding (T-002 del plan CTO).
 *
 * EL PROBLEMA QUE ESTE MÓDULO EXISTE PARA CERRAR: las tres funciones que
 * daban acceso —invitarMiembro, regenerarLink y el generarLinkAcceso de
 * plataforma— hacían lo mismo: pedir un `invite` y, si fallaba porque el
 * email ya existía, caer en un `recovery`. Ese recovery se le devolvía al
 * ADMIN. Con ese link, el admin podía fijar la contraseña de esa persona y
 * entrar como ella. No es un bug de una pantalla: era el diseño.
 *
 * La regla ahora depende del ESTADO DE LA CUENTA, no de si el email existe:
 *
 *   No existe            → invite. Onboarding normal.
 *   Existe, nunca entró  → magiclink. No hay nada que robar: la cuenta
 *                          todavía no es de nadie. Reemitir el onboarding
 *                          es lo mismo que emitirlo la primera vez.
 *   Existe y ya entró    → NADA. Ningún token sale hacia el admin. Esa
 *                          persona entra con su clave, o la recupera sola
 *                          desde /login (T-002C).
 *
 * La tercera rama es la que cierra el agujero, y es la que hay que
 * mantener: cualquier camino nuevo que emita un token para una cuenta
 * activada lo reabre.
 */

/** MOTIVO por el que no se emite un acceso, en palabras para el admin. */
export const MOTIVO_CUENTA_ACTIVADA =
  "Esa persona ya activó su cuenta, así que entra con su propia contraseña. " +
  "Si la perdió, la recupera desde la pantalla de ingreso con “¿Olvidaste tu contraseña?”. " +
  "Por seguridad, nadie más puede generarle un acceso.";

export type EstadoCuenta =
  | { existe: false }
  | { existe: true; id: string; activada: boolean };

/**
 * Estado de la cuenta de Auth para un email.
 *
 * `activada` = alguien ya inició sesión con ella alguna vez. Es el mismo
 * criterio que usa `estadoStaff()` para el badge "pendiente", a propósito:
 * que la pantalla y la regla de seguridad no puedan discrepar.
 */
export async function estadoDeCuenta(email: string): Promise<EstadoCuenta> {
  const admin = crearClienteAdmin();
  // La API de Auth no expone búsqueda por email, solo listado. Con el
  // volumen del piloto (17 cuentas) alcanza de sobra; si esto crece hay que
  // paginar, porque más allá de perPage el usuario simplemente "no existe"
  // y volveríamos a caer en la rama de invitar a alguien que ya está.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`No se pudo consultar la cuenta: ${error.message}`);

  const mail = email.trim().toLowerCase();
  const u = data.users.find((x) => x.email?.toLowerCase() === mail);
  if (!u) return { existe: false };
  return { existe: true, id: u.id, activada: Boolean(u.last_sign_in_at) };
}

export type Acceso = {
  authUserId: string;
  tokenHash: string;
  tipo: "invite" | "magiclink";
  /** true si la cuenta de Auth se creó en esta llamada (para poder revertir) */
  usuarioCreado: boolean;
};

export type ResultadoAcceso =
  | { ok: true; data: Acceso }
  | { ok: false; error: string };

/**
 * Emite un acceso de onboarding, o se niega.
 *
 * Nunca devuelve un token de una cuenta ya activada: esa es la garantía que
 * sostiene T-002 y no debe relajarse por conveniencia de ninguna pantalla.
 */
export async function generarAccesoOnboarding(
  email: string,
  nombre?: string,
): Promise<ResultadoAcceso> {
  const admin = crearClienteAdmin();
  const mail = email.trim().toLowerCase();

  let estado: EstadoCuenta;
  try {
    estado = await estadoDeCuenta(mail);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error consultando la cuenta." };
  }

  if (estado.existe && estado.activada) {
    return { ok: false, error: MOTIVO_CUENTA_ACTIVADA };
  }

  if (!estado.existe) {
    const invite = await admin.auth.admin.generateLink({
      type: "invite",
      email: mail,
      options: nombre ? { data: { nombre } } : undefined,
    });
    if (invite.error) {
      return { ok: false, error: `No se pudo generar el acceso: ${invite.error.message}` };
    }
    return {
      ok: true,
      data: {
        authUserId: invite.data.user.id,
        tokenHash: invite.data.properties.hashed_token,
        tipo: "invite",
        usuarioCreado: true,
      },
    };
  }

  // Existe y NUNCA entró. `generateLink({type:'invite'})` rechaza emails
  // existentes —ése es justamente el error que antes empujaba al recovery—,
  // así que el onboarding se reemite como magiclink.
  const magic = await admin.auth.admin.generateLink({ type: "magiclink", email: mail });
  if (magic.error) {
    return { ok: false, error: `No se pudo generar el acceso: ${magic.error.message}` };
  }
  return {
    ok: true,
    data: {
      authUserId: estado.id,
      tokenHash: magic.data.properties.hashed_token,
      tipo: "magiclink",
      usuarioCreado: false,
    },
  };
}

/** El link vive en NUESTRO dominio: lo valida app/auth/confirmar/route.ts. */
export function linkDeAcceso(
  origen: string,
  tokenHash: string,
  tipo: "invite" | "magiclink",
) {
  return `${origen}/auth/confirmar?token_hash=${encodeURIComponent(tokenHash)}&type=${tipo}`;
}

/** Para mensajes de UI que quieran ofrecer soporte. */
export const CONTACTO_SOPORTE = SOPORTE_EMAIL;
