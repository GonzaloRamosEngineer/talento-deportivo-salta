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
}

export interface HojaTabular {
  nombre: string;
  filas: unknown[][];
}
