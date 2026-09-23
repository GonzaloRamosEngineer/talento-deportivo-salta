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

export interface ImportacionNormalizada {
  version: 1;
  adaptador: "saltos_tabular" | "gimnasia_cmj" | "rugby_sprint" | "sub13_bloques";
  contexto: ContextoEvaluacion;
  hojas: string[];
  mediciones: MedicionNormalizada[];
  protocolos: string[];
  metricas: string[];
  hallazgos: HallazgoImportacion[];
  filasIgnoradas: number;
  duplicados: number;
  filasSinProtocolo?: FilaSinProtocolo[];
}

export interface HojaTabular {
  nombre: string;
  filas: unknown[][];
}
