export const EXTENSIONES_EVALUACION = [".xlsx", ".csv"] as const;
export const MAX_ARCHIVO_EVALUACION_BYTES = 20 * 1024 * 1024;

export type SeveridadHallazgo = "bloqueo" | "advertencia" | "info";

export interface ContextoEvaluacion {
  institucionOrigen: string;
  disciplina: string;
  grupo: string;
  fechaDeclarada: string;
  evaluadoPor: string;
}

export interface OpcionResolucion {
  valor: string;
  etiqueta: string;
  detalle?: string;
  recomendada?: boolean;
}

export interface HallazgoImportacion {
  id: string;
  codigo:
    | "fecha_inconsistente"
    | "fila_resumen"
    | "duplicado_en_archivo"
    | "duplicado_existente"
    | "protocolo_desconocido"
    | "metrica_desconocida"
    | "deportista_sin_identificador"
    | "valor_invalido"
    | "otro";
  severidad: SeveridadHallazgo;
  titulo: string;
  detalle: string;
  cantidad?: number;
  referencias?: string[];
  requiereResolucion?: boolean;
  opciones?: OpcionResolucion[];
}

export interface DeportistaPrevisualizado {
  id: string;
  etiqueta: string;
  mediciones: number;
  estado: "listo" | "revisar" | "ignorado";
  detalle?: string;
}

export interface PrevisualizacionEvaluacion {
  previewToken: string;
  demo?: boolean;
  archivo: {
    nombre: string;
    hojas: string[];
  };
  resumen: {
    deportistas: number;
    medicionesValidas: number;
    filasIgnoradas: number;
    duplicados: number;
  };
  protocolos: string[];
  metricas: string[];
  hallazgos: HallazgoImportacion[];
  deportistas: DeportistaPrevisualizado[];
}

export interface ResolucionesImportacion {
  hallazgos: Record<string, string>;
}

export interface ResultadoImportacion {
  loteId: string;
  jornadaId: string;
  jornadaIds: string[];
  jornadasCreadas: number;
  deportistasCreados: number;
  deportistasVinculados: number;
  medicionesGuardadas: number;
  filasIgnoradas: number;
}

async function leerError(respuesta: Response): Promise<string> {
  try {
    const cuerpo = (await respuesta.json()) as { error?: string; message?: string };
    return cuerpo.error ?? cuerpo.message ?? `Error ${respuesta.status}`;
  } catch {
    return `Error ${respuesta.status}`;
  }
}

export async function previsualizarEvaluacion(
  archivo: File,
  contexto: ContextoEvaluacion,
): Promise<PrevisualizacionEvaluacion> {
  const cuerpo = new FormData();
  cuerpo.append("archivo", archivo);
  cuerpo.append("contexto", JSON.stringify(contexto));

  const respuesta = await fetch("/api/evaluaciones/previsualizar", {
    method: "POST",
    body: cuerpo,
    credentials: "same-origin",
  });
  if (!respuesta.ok) throw new Error(await leerError(respuesta));
  return (await respuesta.json()) as PrevisualizacionEvaluacion;
}

export async function importarEvaluacion(
  previewToken: string,
  resoluciones: ResolucionesImportacion,
): Promise<ResultadoImportacion> {
  const respuesta = await fetch("/api/evaluaciones/importar", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ previewToken, resoluciones }),
  });
  if (!respuesta.ok) throw new Error(await leerError(respuesta));
  return (await respuesta.json()) as ResultadoImportacion;
}

export const DEMO_SUB13: PrevisualizacionEvaluacion = {
  previewToken: "demo-sub13",
  demo: true,
  archivo: {
    nombre: "SUB13 LIGA SALTEÑA FUTBOL.xlsx",
    hojas: ["Resultados 2 Feb 2026", "SJ-sub13 LSF-23_03"],
  },
  resumen: {
    deportistas: 21,
    medicionesValidas: 273,
    filasIgnoradas: 8,
    duplicados: 21,
  },
  protocolos: ["CMJ", "Abalakov (ABCMJ)", "SJ"],
  metricas: [
    "Peso corporal",
    "Altura de salto",
    "Fuerza máxima",
    "Potencia relativa",
    "RSI-mod",
  ],
  hallazgos: [
    {
      id: "fecha-sub13",
      codigo: "fecha_inconsistente",
      severidad: "bloqueo",
      titulo: "La jornada aparece con dos fechas",
      detalle:
        "El nombre de la hoja indica 9 de febrero, pero uno de los bloques contiene 2 de septiembre. Hay que elegir una fecha antes de cargar.",
      requiereResolucion: true,
      opciones: [
        {
          valor: "2026-02-09",
          etiqueta: "9 feb 2026",
          detalle:
            "Recomendada: coincide con el nombre de la hoja, el bloque SJ y el patrón de peso de una misma sesión.",
          recomendada: true,
        },
        { valor: "2026-09-02", etiqueta: "2 sep 2026", detalle: "Coincide con la celda del bloque CMJ/Abalakov" },
      ],
    },
    {
      id: "duplicados-sub13",
      codigo: "duplicado_en_archivo",
      severidad: "advertencia",
      titulo: "21 resultados SJ están repetidos",
      detalle: "Se conservará una sola medición por deportista, protocolo y fecha.",
      cantidad: 21,
    },
    {
      id: "resumen-sub13",
      codigo: "fila_resumen",
      severidad: "info",
      titulo: "Filas estadísticas separadas",
      detalle: "Media, máximo, mínimo y desvío estándar no se tratarán como deportistas.",
      cantidad: 8,
    },
  ],
  deportistas: Array.from({ length: 8 }, (_, indice) => ({
    id: `demo-${indice + 1}`,
    etiqueta: `Deportista ${String(indice + 1).padStart(2, "0")}`,
    mediciones: 13,
    estado: "listo" as const,
  })),
};
