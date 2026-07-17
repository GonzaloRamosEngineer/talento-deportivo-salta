"use client";

import { useEffect, useState } from "react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import {
  PARAMETROS_CRECIMIENTO_DEFAULT,
  type ParametrosCrecimiento,
} from "@/lib/crecimiento";

/**
 * Parámetros globales del Módulo D (tabla `parametro_crecimiento`,
 * editable por la plataforma). Hook dual como useDatos: el visitante
 * anónimo (demo) y cualquier error de red usan los defaults de código,
 * así la card "El estirón" nunca queda bloqueada por esta consulta.
 */
export function useParametrosCrecimiento(): ParametrosCrecimiento & {
  real: boolean;
} {
  const [estado, setEstado] = useState({
    ...PARAMETROS_CRECIMIENTO_DEFAULT,
    real: false,
  });

  useEffect(() => {
    let vivo = true;
    async function cargar() {
      const supabase = crearClienteBrowser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return; // demo anónima: defaults del código
      const { data, error } = await supabase
        .from("parametro_crecimiento")
        .select("umbral_aceleracion_m, umbral_aceleracion_f, min_dias_tramo")
        .limit(1)
        .maybeSingle();
      if (!vivo || error || !data) return;
      setEstado({
        umbralM: Number(data.umbral_aceleracion_m),
        umbralF: Number(data.umbral_aceleracion_f),
        minDiasTramo: data.min_dias_tramo,
        real: true,
      });
    }
    void cargar();
    return () => {
      vivo = false;
    };
  }, []);

  return estado;
}
