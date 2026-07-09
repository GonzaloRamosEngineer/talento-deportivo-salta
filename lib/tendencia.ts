import type { Atributo, Medicion } from "@/lib/mock-data";

export type Estado =
  | "creciendo"
  | "amesetado"
  | "en_baja"
  | "registro"
  | "sin_datos";

export interface Tendencia {
  estado: Estado;
  /** cambio absoluto entre la 1ª y la 3ª de las últimas 3 mediciones */
  delta: number | null;
}

// Regla simple y explicable (decisión D10): comparar la última medición
// contra la primera de las últimas 3. El umbral es 1.5% del rango de la
// escala del atributo. SIEMPRE interpretada según `sentido`:
// en 'menor_mejor' (ej. segundos en 30m) bajar es mejorar; con sentido
// null (talla/peso) se registra sin juzgar mejora/retroceso.
export function tendencia(serie: Medicion[] | undefined, atributo: Atributo): Tendencia {
  if (!serie || serie.length < 3) return { estado: "sin_datos", delta: null };

  const ultimas = serie.slice(-3);
  const delta = ultimas[2].valor - ultimas[0].valor;

  if (atributo.sentido === null) return { estado: "registro", delta };

  const umbral = (atributo.escalaMax - atributo.escalaMin) * 0.015;
  const mejora = atributo.sentido === "menor_mejor" ? -delta : delta;

  const estado: Estado =
    mejora > umbral ? "creciendo" : mejora < -umbral ? "en_baja" : "amesetado";
  return { estado, delta };
}

/** Mejor estado entre todos los atributos medidos (para listas y home) */
export function tendenciaGeneral(
  mediciones: Record<string, Medicion[]>,
  atributos: Atributo[],
): { estado: Estado; atributo: Atributo | null } {
  const orden: Estado[] = ["creciendo", "en_baja", "amesetado", "registro", "sin_datos"];
  let mejor: { estado: Estado; atributo: Atributo | null } = {
    estado: "sin_datos",
    atributo: null,
  };
  for (const a of atributos) {
    if (!mediciones[a.id]) continue;
    const t = tendencia(mediciones[a.id], a);
    if (orden.indexOf(t.estado) < orden.indexOf(mejor.estado)) {
      mejor = { estado: t.estado, atributo: a };
    }
  }
  return mejor;
}
