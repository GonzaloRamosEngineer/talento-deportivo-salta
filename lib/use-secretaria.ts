"use client";

import { useEffect, useState } from "react";
import { usePerfil } from "@/components/perfil-context";

export interface LoteSecretaria {
  id: string;
  nombre_archivo: string;
  estado: "previsualizado" | "importando" | "importado" | "fallido" | "vencido";
  contexto: {
    institucionOrigen: string;
    disciplina: string;
    grupo: string;
    fechaDeclarada: string;
    evaluadoPor: string;
  };
  filas_ignoradas: number;
  duplicados_archivo: number;
  bloqueos_pendientes: number;
  creado_en: string;
  confirmado_en: string | null;
}

export interface ResumenSecretaria {
  organizacionId: string;
  rol: string;
  indicadores: {
    lotes: number;
    jornadas: number;
    grupos: number;
    disciplinas: number;
    equipo: number;
    deportistas: number;
    mediciones: number;
    lotesImportados: number;
    lotesPendientes: number;
  };
  lotes: LoteSecretaria[];
  jornadas: Array<{ id: string; fecha: string; estado: string; evaluadoPor: string; institucion: string; disciplina: string; grupo: string; mediciones: number }>;
  grupos: Array<{ id: string; nombre: string; institucion: string; disciplina: string; disciplinaId: string; deportistas: number }>;
  disciplinas: Array<{ id: string; nombre: string; grupos: number; lotes: number }>;
  equipo: Array<{ id: string; nombre: string; email: string | null; rol: string; funcion: string | null; creado_en: string }>;
}

export function useSecretaria() {
  const { perfil, sesionReal } = usePerfil();
  const habilitado = sesionReal && perfil === "secretaria";
  const [estado, setEstado] = useState<{
    resumen: ResumenSecretaria | null;
    error: string | null;
  }>({ resumen: null, error: null });

  useEffect(() => {
    if (!habilitado) return;
    const controlador = new AbortController();
    fetch("/api/secretaria/resumen", { credentials: "same-origin", signal: controlador.signal })
      .then(async (respuesta) => {
        if (!respuesta.ok) {
          const cuerpo = await respuesta.json().catch(() => ({})) as { error?: string };
          throw new Error(cuerpo.error ?? "No pudimos cargar el Espacio Secretaría.");
        }
        return respuesta.json() as Promise<ResumenSecretaria>;
      })
      .then((resumen) => setEstado({ resumen, error: null }))
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === "AbortError") return;
        setEstado({
          resumen: null,
          error:
            causa instanceof Error
              ? causa.message
              : "No pudimos cargar el Espacio Secretaría.",
        });
      });
    return () => controlador.abort();
  }, [habilitado]);

  const resumen = habilitado ? estado.resumen : null;
  const error = habilitado ? estado.error : null;

  return {
    resumen,
    cargando: habilitado && !resumen && !error,
    error,
    real: Boolean(habilitado && resumen),
  };
}
