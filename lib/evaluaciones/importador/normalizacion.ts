const RESUMEN = new Set([
  "media",
  "promedio",
  "maximo",
  "minimo",
  "desv est",
  "desvio estandar",
  "desviacion estandar",
  // Pies de estadística de las planillas de rugby y gimnasia: sin esto,
  // "Mín", "Máx" o "DS" parecían deportistas sin fecha.
  "min",
  "max",
  "ds",
  "sd",
  "desvio",
  "mediana",
  "total",
  "totales",
  "estadisticas",
  "estadistica",
]);

/**
 * Filas que abren el pie de la planilla (estadísticas, tabla de
 * clasificación). Todo lo que viene después es resumen, no deportistas.
 */
const INICIO_PIE = [/^estadisticas?\b/u, /^tabla de clasificacion\b/u, /^clasificacion$/u];

export function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/\s+/g, " ").trim();
}

export function normalizarTexto(valor: unknown): string {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function claveDeportista(nombre: string, apellido?: string | null): string {
  return normalizarTexto([nombre, apellido].filter(Boolean).join(" "));
}

export function esFilaResumen(valor: unknown): boolean {
  const normalizado = normalizarTexto(valor);
  return RESUMEN.has(normalizado);
}

export function esInicioPie(valor: unknown): boolean {
  const normalizado = normalizarTexto(valor);
  return INICIO_PIE.some((patron) => patron.test(normalizado));
}

/** Guiones y marcas de "sin dato": la celda está vacía a propósito, no es ilegible. */
const SIN_DATO = /^(?:[-–—.\s]+|n\/?a|s\/?d|nd)$/iu;

/**
 * Una celda con texto que no se puede leer como número ("ausente",
 * "lesionado", "12,5,,"). No es lo mismo que una vacía: alguien escribió
 * algo y hay que mostrárselo a una persona.
 */
export function esIlegible(valor: unknown): boolean {
  if (typeof valor === "number") return !Number.isFinite(valor);
  const crudo = texto(valor);
  if (!crudo || SIN_DATO.test(crudo)) return false;
  return numeros(crudo).length === 0;
}

export function numero(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  const limpio = texto(valor).replace(",", ".").match(/-?\d+(?:\.\d+)?/u)?.[0];
  if (!limpio) return null;
  const resultado = Number(limpio);
  return Number.isFinite(resultado) ? resultado : null;
}

export function numeros(valor: unknown): number[] {
  if (typeof valor === "number" && Number.isFinite(valor)) return [valor];
  return (texto(valor).replaceAll(",", ".").match(/-?\d+(?:\.\d+)?/gu) ?? [])
    .map(Number)
    .filter(Number.isFinite);
}

export function fechaISO(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }
  const crudo = texto(valor);
  if (!crudo) return null;
  const iso = crudo.match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = crudo.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/u);
  if (!local) return null;
  return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
}

export function fechaEnTitulo(valor: unknown): string | null {
  return fechaISO(texto(valor));
}

export function separarNombreCompleto(valor: unknown, apellidoPrimero = false) {
  const completo = texto(valor);
  if (!completo) return { nombre: "", apellido: null as string | null };
  if (apellidoPrimero && completo.includes(",")) {
    const [apellido, ...nombre] = completo.split(",");
    return { nombre: texto(nombre.join(" ")), apellido: texto(apellido) || null };
  }
  return { nombre: completo, apellido: null as string | null };
}

export function ladoAsimetria(valor: unknown): "L" | "R" | null {
  const encontrado = texto(valor).toUpperCase().match(/\b([LR])\b/u)?.[1];
  return encontrado === "L" || encontrado === "R" ? encontrado : null;
}

export function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[medio]
    : (ordenados[medio - 1] + ordenados[medio]) / 2;
}
