import type { HitoTrayectoria } from "@/lib/mock-data";

// ---------------------------------------------------------------
// Trayectoria institucional del deportista: ingreso al club,
// promociones de categoría, debut en Primera y pase de salida.
// Lógica PURA sobre los hitos (tabla deportista_hito). Habilita la
// métrica "cuánto tardó de escuelita a Primera". Framing de
// registro: los copys describen eventos, nunca juzgan.
// ---------------------------------------------------------------

/** Copy único de cada hito (una sola fuente para timeline, curva e informe). */
export function etiquetaHito(h: HitoTrayectoria): string {
  switch (h.tipo) {
    case "ingreso":
      return "Ingresó al club";
    case "promocion":
      return h.categoriaOrigenNombre
        ? `Pasó de ${h.categoriaOrigenNombre} a ${h.categoriaDestinoNombre}`
        : `Pasó a ${h.categoriaDestinoNombre}`;
    case "debut_primera":
      return "Debut en Primera";
    case "pase_salida":
      return `Pase a ${h.clubDestinoNombre}`;
    default:
      return h.detalle ?? "Hito";
  }
}

/** Los hitos como {fecha, evento} para la curva y el informe (ya los consumen). */
export function historialDe(
  hitos: HitoTrayectoria[] | undefined,
): { fecha: string; evento: string }[] | undefined {
  if (!hitos?.length) return undefined;
  return [...hitos]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((h) => ({ fecha: h.fecha, evento: etiquetaHito(h) }));
}

function mesesEntre(desdeISO: string, hastaISO: string): number {
  const d = new Date(desdeISO + "T12:00:00");
  const h = new Date(hastaISO + "T12:00:00");
  const meses =
    (h.getFullYear() - d.getFullYear()) * 12 + (h.getMonth() - d.getMonth());
  return Math.max(0, h.getDate() >= d.getDate() ? meses : meses - 1);
}

/** "3 años y 4 meses" / "8 meses" / "menos de un mes" — para chips e informe. */
export function formatearDuracion(meses: number): string {
  if (meses < 1) return "menos de un mes";
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const parteAnios = anios > 0 ? `${anios} ${anios === 1 ? "año" : "años"}` : "";
  const parteMeses = resto > 0 ? `${resto} ${resto === 1 ? "mes" : "meses"}` : "";
  if (parteAnios && parteMeses) return `${parteAnios} y ${parteMeses}`;
  return parteAnios || parteMeses;
}

/**
 * Meses desde el ingreso hasta el pase de salida (si lo hay) o hasta
 * hoy. null sin hito de ingreso.
 */
export function tiempoEnElClub(
  hitos: HitoTrayectoria[] | undefined,
  hoyISO: string,
): { meses: number; cerrado: boolean } | null {
  const ingreso = hitos?.find((h) => h.tipo === "ingreso");
  if (!ingreso) return null;
  const pase = hitos?.find((h) => h.tipo === "pase_salida");
  const hasta = pase ? pase.fecha : hoyISO;
  if (hasta < ingreso.fecha) return null;
  return { meses: mesesEntre(ingreso.fecha, hasta), cerrado: Boolean(pase) };
}

const esEscuelita = (nombre: string | null | undefined) =>
  Boolean(nombre?.toLowerCase().startsWith("escuelita"));
const esPrimera = (nombre: string | null | undefined) =>
  nombre?.toLowerCase() === "primera";

/**
 * La métrica estrella: meses entre el arranque en escuelita (ingreso,
 * si su primera promoción parte de una Escuelita) y la llegada a
 * Primera (primera promoción con destino Primera, o el debut). null si
 * la trayectoria registrada no cubre ambos extremos.
 */
export function escuelitaAPrimera(
  hitos: HitoTrayectoria[] | undefined,
): number | null {
  if (!hitos?.length) return null;
  const orden = [...hitos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ingreso = orden.find((h) => h.tipo === "ingreso");
  if (!ingreso) return null;
  const primeraPromocion = orden.find((h) => h.tipo === "promocion");
  // El arranque tiene que ser en escuelita: lo prueba la primera
  // promoción saliendo de una Escuelita (snapshot de nombre).
  if (!esEscuelita(primeraPromocion?.categoriaOrigenNombre)) return null;
  const llegada = orden.find(
    (h) =>
      (h.tipo === "promocion" && esPrimera(h.categoriaDestinoNombre)) ||
      h.tipo === "debut_primera",
  );
  if (!llegada || llegada.fecha < ingreso.fecha) return null;
  return mesesEntre(ingreso.fecha, llegada.fecha);
}
