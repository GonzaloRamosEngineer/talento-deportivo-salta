import type {
  ContextoEvaluacion,
  HallazgoImportacion,
} from "@/lib/evaluaciones-importacion";

export interface MedicionNormalizada {
  deportistaClave: string;
  nombre: string;
  apellido: string | null;
  edad: number | null;
  fecha: string | null;
  /** Hallazgo cuya resolución aporta la fecha cuando la fuente se contradice. */
  fechaResolucionId?: string | null;
  protocoloCodigo: string | null;
  atributoCodigo: string;
  valor: number;
  intento: number;
  detalle: Record<string, string | number | boolean | null>;
}

/**
 * Fila que el adaptador no pudo mapear a un protocolo conocido. NO se
 * descarta: se preserva con sus valores originales para que una persona
 * decida mapearla o excluirla explícitamente.
 */
export interface FilaSinProtocolo {
  fila: number;
  valorCrudo: string;
  nombre: string;
  apellido: string | null;
  edad: number | null;
  valores: Record<string, string | null>;
}

export type MotivoFilaPendiente = "sin_fecha" | "protocolo_desconocido" | "valor_ilegible" | "sin_nombre";

/**
 * Fila con datos que el adaptador no pudo incorporar porque le falta algo
 * (fecha, nombre, un valor legible). Antes sumaba a `ignoradas` y
 * desaparecía; ahora se conserva para que una persona decida: dejarla para
 * carga manual o excluirla, siempre con motivo.
 */
export interface FilaPendiente {
  fila: number;
  motivo: MotivoFilaPendiente;
  hoja: string;
  nombre: string;
  apellido: string | null;
  edad: number | null;
  valores: Record<string, string | null>;
  /** Solo en `valor_ilegible`: las columnas que no se pudieron leer. */
  columnasIlegibles?: string[];
  /**
   * true si el resto de la fila SÍ entró como medición y lo pendiente son
   * solo `columnasIlegibles`. false/ausente: no entró nada de esta fila.
   */
  seImportoElResto?: boolean;
}

export interface ImportacionNormalizada {
  version: 1;
  adaptador: "saltos_tabular" | "gimnasia_cmj" | "rugby_sprint" | "sub13_bloques";
  contexto: ContextoEvaluacion;
  hojas: string[];
  mediciones: MedicionNormalizada[];
  protocolos: string[];
  metricas: string[];
  hallazgos: HallazgoImportacion[];
  /** Suma de filasPendientes + filasResumen + filasVacias (compatibilidad). */
  filasIgnoradas: number;
  duplicados: number;
  filasSinProtocolo?: FilaSinProtocolo[];
  filasPendientes?: FilaPendiente[];
  /** Media, máximo, pie de estadísticas: no son deportistas. */
  filasResumen?: number;
  /** Filas sin ningún dato para incorporar. */
  filasVacias?: number;
}

export interface HojaTabular {
  nombre: string;
  filas: unknown[][];
}
