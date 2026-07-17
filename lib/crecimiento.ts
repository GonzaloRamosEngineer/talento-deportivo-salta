import type { Medicion } from "@/lib/mock-data";

// ---------------------------------------------------------------
// Módulo D ("el estirón") aterrizado — negocio/10, sección 5.
// Velocidad de crecimiento en cm/año sobre la serie de TALLA que ya
// existe, más la estimación de madurez de Moore et al. (2015). Todo
// es lenguaje de REGISTRO/ESTIMACIÓN con margen explícito: nunca un
// diagnóstico ni una proyección de talla adulta (Mirwald/Khamis-Roche
// siguen prohibidos por diseño).
// ---------------------------------------------------------------

/**
 * Defaults de los parámetros del módulo. La fuente de verdad real es
 * la tabla global `parametro_crecimiento` (editable por la plataforma
 * en /plataforma/parametros); estos valores son el fallback para la
 * demo anónima y para cuando la consulta falla. Pendientes de revisión
 * del PF de la Fundación (mismo régimen que GUIA_PENDIENTE_REVISION).
 */
export const PARAMETROS_CRECIMIENTO_DEFAULT = {
  /** umbral de "crecimiento acelerado" (cm/año) para varones */
  umbralM: 7,
  /** para mujeres: el pico puberal femenino es más temprano y algo menor */
  umbralF: 6.5,
  /**
   * separación mínima entre las dos mediciones de un tramo. Con menos
   * días, el error de medición del tallímetro anualizado fabrica
   * velocidades absurdas; 3 meses es el piso explicable.
   */
  minDiasTramo: 90,
};

export interface ParametrosCrecimiento {
  umbralM: number;
  umbralF: number;
  minDiasTramo: number;
}

/** Umbral que corresponde a un deportista según su sexo (X/null → el masculino). */
export function umbralPara(
  sexo: "M" | "F" | "X" | null | undefined,
  p: ParametrosCrecimiento,
): number {
  return sexo === "F" ? p.umbralF : p.umbralM;
}

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
 * mediciones separadas al menos `minDias`: cada medición que no llega
 * a esa distancia del ancla se saltea (queda absorbida en el tramo),
 * así una re-medición a la semana no genera un tramo ruidoso.
 */
export function crecimiento(
  serie: Medicion[] | undefined,
  opts?: { umbral?: number; minDias?: number },
): Crecimiento {
  const umbral = opts?.umbral ?? PARAMETROS_CRECIMIENTO_DEFAULT.umbralM;
  const minDias = opts?.minDias ?? PARAMETROS_CRECIMIENTO_DEFAULT.minDiasTramo;
  const tramos: TramoCrecimiento[] = [];
  if (serie && serie.length >= 2) {
    let ancla = serie[0];
    for (const m of serie.slice(1)) {
      const d = dias(ancla.fecha, m.fecha);
      if (d < minDias) continue;
      const deltaCm = m.valor - ancla.valor;
      const cmPorAnio = (deltaCm / d) * 365.25;
      tramos.push({
        desdeFecha: ancla.fecha,
        hastaFecha: m.fecha,
        dias: d,
        deltaCm,
        cmPorAnio,
        acelerado: cmPorAnio >= umbral,
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

// ---------------------------------------------------------------
// Estimación de madurez — Moore et al. 2015 (Med Sci Sports Exerc,
// DOI 10.1249/MSS.0000000000000588). Estima el "maturity offset"
// (años hasta/desde el pico de crecimiento) con SOLO edad y talla —
// compatible con nuestro catálogo, a diferencia de Mirwald (talla
// sentado) o Khamis-Roche (talla de los padres), descartados.
// ---------------------------------------------------------------

/**
 * El contenido y la presentación de esta estimación están pendientes
 * del aval del PF de la Fundación: cuando lo revise, se apaga el flag
 * (mismo mecanismo que GUIA_PENDIENTE_REVISION del Módulo B).
 */
export const MOORE_PENDIENTE_AVAL = true;

export const MOORE_PAPER_URL = "https://doi.org/10.1249/MSS.0000000000000588";
export const MOORE_CITA =
  "Moore et al. (2015), «Enhancing a Somatic Maturity Prediction Model», Medicine & Science in Sports & Exercise 47(8)";

/** error estándar del estimado reportado por el paper (~medio año) */
export const MOORE_MARGEN_ANIOS = 0.55;

// Rango etario de las muestras de calibración del modelo edad×talla.
const RANGO_EDAD = { M: [8, 18], F: [8, 16] } as const;

export interface EstimacionMadurez {
  /** años hasta (negativo) o desde (positivo) el pico de crecimiento */
  offsetAnios: number;
  /** edad decimal a la fecha de la talla usada */
  edadEnMedicion: number;
  /** edad estimada a la que ocurre/ocurrió el pico */
  edadPico: number;
  fechaMedicion: string;
  margenAnios: number;
}

/**
 * Estimación Moore et al. sobre la ÚLTIMA talla de la serie. Devuelve
 * null cuando el modelo no aplica: sin sexo M/F, sin fecha de
 * nacimiento, edad fuera del rango de calibración, o menos de 2
 * mediciones de talla (una sola medición posiblemente mal tomada no
 * alcanza para estimar madurez).
 */
export function estimacionMadurez(
  deportista: { sexo: "M" | "F" | "X" | null; fechaNacimiento: string },
  serieTalla: Medicion[] | undefined,
): EstimacionMadurez | null {
  const { sexo, fechaNacimiento } = deportista;
  if (sexo !== "M" && sexo !== "F") return null;
  if (!fechaNacimiento) return null;
  if (!serieTalla || serieTalla.length < 2) return null;

  const ultima = serieTalla[serieTalla.length - 1];
  const edad =
    (new Date(ultima.fecha + "T12:00:00").getTime() -
      new Date(fechaNacimiento + "T12:00:00").getTime()) /
    (365.25 * 86_400_000);
  const [min, max] = RANGO_EDAD[sexo];
  if (edad < min || edad > max) return null;

  const offsetAnios =
    sexo === "M"
      ? -7.999994 + 0.0036124 * edad * ultima.valor
      : -7.709133 + 0.0042232 * edad * ultima.valor;

  return {
    offsetAnios,
    edadEnMedicion: edad,
    edadPico: edad - offsetAnios,
    fechaMedicion: ultima.fecha,
    margenAnios: MOORE_MARGEN_ANIOS,
  };
}
