import type { Medicion } from "@/lib/mock-data";

// ---------------------------------------------------------------
// Módulo D ("el estirón") aterrizado — negocio/10, sección 5.
// Velocidad de crecimiento en cm/año sobre la serie de TALLA que ya
// existe. Es un REGISTRO OBSERVADO, nunca una estimación de madurez
// ni una proyección de talla adulta: la estimación Moore et al. quedó
// explícitamente afuera hasta que el PF de la Fundación la avale.
// ---------------------------------------------------------------

/**
 * Separación mínima entre las dos mediciones de un tramo. Con menos
 * días, el error de medición del tallímetro (±0,5 cm) anualizado
 * fabrica velocidades absurdas; 3 meses es el piso explicable
 * ("entre mediciones separadas al menos 3 meses").
 */
export const MIN_DIAS_TRAMO = 90;

/**
 * Umbral de "crecimiento acelerado": por debajo de ~5-6 cm/año crece
 * un chico prepuberal típico; el pico puberal ronda 8-10 cm/año.
 * 7 cm/año marca la zona de aceleración sin diagnosticar nada.
 * Valor base sujeto a revisión del PF de la Fundación (mismo régimen
 * que GUIA_PENDIENTE_REVISION del Módulo B).
 */
export const UMBRAL_ACELERACION_CM_ANIO = 7;

export interface TramoCrecimiento {
  desdeFecha: string;
  hastaFecha: string;
  dias: number;
  /** cm ganados en el tramo */
  deltaCm: number;
  /** velocidad anualizada del tramo */
  cmPorAnio: number;
  acelerado: boolean;
}

export interface Crecimiento {
  tramos: TramoCrecimiento[];
  /** el tramo más reciente (el "ritmo actual" que muestra la UI) */
  actual: TramoCrecimiento | null;
  /** true si el tramo más reciente supera el umbral */
  enAceleracion: boolean;
}

function dias(desde: string, hasta: string): number {
  return Math.round(
    (new Date(hasta + "T12:00:00").getTime() -
      new Date(desde + "T12:00:00").getTime()) /
      86_400_000,
  );
}

/**
 * Recorre la serie de talla (ordenada por fecha) armando tramos entre
 * mediciones separadas al menos MIN_DIAS_TRAMO: cada medición que no
 * llega a esa distancia del ancla se saltea (queda absorbida en el
 * tramo), así una re-medición a la semana no genera un tramo ruidoso.
 */
export function crecimiento(serie: Medicion[] | undefined): Crecimiento {
  const tramos: TramoCrecimiento[] = [];
  if (serie && serie.length >= 2) {
    let ancla = serie[0];
    for (const m of serie.slice(1)) {
      const d = dias(ancla.fecha, m.fecha);
      if (d < MIN_DIAS_TRAMO) continue;
      const deltaCm = m.valor - ancla.valor;
      const cmPorAnio = (deltaCm / d) * 365.25;
      tramos.push({
        desdeFecha: ancla.fecha,
        hastaFecha: m.fecha,
        dias: d,
        deltaCm,
        cmPorAnio,
        acelerado: cmPorAnio >= UMBRAL_ACELERACION_CM_ANIO,
      });
      ancla = m;
    }
  }
  const actual = tramos.at(-1) ?? null;
  return { tramos, actual, enAceleracion: actual?.acelerado ?? false };
}

/**
 * Zonas de crecimiento acelerado para marcar en la curva de talla:
 * tramos acelerados consecutivos fusionados en un solo rango.
 */
export function zonasAceleracion(
  tramos: TramoCrecimiento[],
): { desde: string; hasta: string }[] {
  const zonas: { desde: string; hasta: string }[] = [];
  for (const t of tramos) {
    if (!t.acelerado) continue;
    const ultima = zonas.at(-1);
    if (ultima && ultima.hasta === t.desdeFecha) ultima.hasta = t.hastaFecha;
    else zonas.push({ desde: t.desdeFecha, hasta: t.hastaFecha });
  }
  return zonas;
}
