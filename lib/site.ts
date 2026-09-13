// Dominio canónico de la aplicación. Fuente de verdad única: lo usan la
// metadata (og:image absoluta, que WhatsApp exige), la política de
// privacidad y el consentimiento imprimible que firma el tutor/a.
//
// Dominio propio del producto, registrado el 13/09/2026 en NIC Argentina.
// Para cambiarlo: acá y en NEXT_PUBLIC_SITE_URL (Vercel), que lo pisa.
// No hardcodear el host en ningún otro lado:
// el consentimiento es un documento que se firma en papel y quedó apuntando
// a un dominio muerto por estar escrito a mano.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://talentodeportivo.com.ar";

/** Host sin esquema, para imprimir en documentos legales. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

/**
 * Casilla de soporte que se le muestra al staff de un club cuando algo se
 * rechaza y la explicación no puede darse en pantalla (ver el rechazo por
 * "una cuenta = un club" en app/club/staff/actions.ts).
 *
 * ⚠️ REQUIERE QUE LA CASILLA EXISTA Y RECIBA. El dominio se delegó a Vercel
 * para servir el sitio y firmar el correo SALIENTE de Resend; el MX del
 * dominio raíz está vacío, así que hasta que se configure un buzón
 * (Workspace, Zoho, o un reenvío) cualquier mail a esta dirección rebota.
 * Un contacto que rebota es peor que no dar contacto.
 */
export const SOPORTE_EMAIL = "info@talentodeportivo.com.ar";
