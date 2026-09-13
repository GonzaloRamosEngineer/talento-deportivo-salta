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
