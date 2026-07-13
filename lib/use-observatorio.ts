"use client";

import { useEffect, useMemo, useState } from "react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { usePerfil } from "@/components/perfil-context";
import { CLUBES, type ClubResumen } from "@/lib/mock-data";

// Fuente de datos del observatorio. Mismo contrato dual de siempre:
// - Visitante anónimo (demo): los clubes mock de CLUBES.
// - Sesión real de plataforma: rpc `observatorio_clubes()` — la única
//   ventana de la plataforma a los datos, y devuelve SOLO agregados
//   por club (la RPC además gatea por app_metadata.plataforma: otro
//   rol recibe 0 filas).
// El resto de los roles reales nunca llega acá: /observatorio y el
// panel de plataforma ya cortan por perfil antes.

export interface Observatorio {
  cargando: boolean;
  real: boolean;
  error: string | null;
  clubes: ClubResumen[];
  /** fecha de última medición por club (solo con datos reales) */
  ultimaMedicion: Map<string, string>;
}

interface FilaObservatorio {
  id: string;
  nombre: string;
  localidad: string | null;
  departamento: string | null;
  escudo_url: string | null;
  deportistas: number;
  mediciones_30d: number;
  consentimiento_pct: number;
  categorias_activas: number;
  ultima_medicion: string | null;
}

export function useObservatorio(): Observatorio {
  const { perfil, sesionReal } = usePerfil();
  const [cargado, setCargado] = useState<{
    clubes: FilaObservatorio[];
    error: string | null;
  } | null>(null);
  const esPlataformaReal = sesionReal && perfil === "super_admin";

  useEffect(() => {
    if (!esPlataformaReal) return;
    let cancelado = false;

    async function cargar() {
      const { data, error } = await crearClienteBrowser().rpc("observatorio_clubes");
      if (cancelado) return;
      setCargado({
        clubes: (data as FilaObservatorio[] | null) ?? [],
        error: error ? error.message : null,
      });
    }

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [esPlataformaReal]);

  return useMemo(() => {
    if (!esPlataformaReal) {
      return {
        cargando: false,
        real: false,
        error: null,
        clubes: CLUBES,
        ultimaMedicion: new Map<string, string>(),
      };
    }
    return {
      cargando: cargado === null,
      real: true,
      error: cargado?.error ?? null,
      clubes: (cargado?.clubes ?? []).map((c) => ({
        id: c.id,
        nombre: c.nombre,
        localidad: c.localidad ?? "",
        departamento: c.departamento ?? "",
        escudoUrl: c.escudo_url,
        esEsteClub: false,
        deportistas: c.deportistas,
        medicionesMes: c.mediciones_30d,
        consentimientoPct: c.consentimiento_pct,
        categoriasActivas: c.categorias_activas,
      })),
      ultimaMedicion: new Map(
        (cargado?.clubes ?? [])
          .filter((c) => c.ultima_medicion)
          .map((c) => [c.id, c.ultima_medicion!]),
      ),
    };
  }, [esPlataformaReal, cargado]);
}
