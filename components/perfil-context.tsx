"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { PROFE_DEMO } from "@/lib/mock-data";

// Selector de perfil DEMO: sin auth real. Refleja la matriz de acceso
// de docs/PERFILES.md (en producción la aplica el RLS, nunca la UI).
export type Perfil = "profesor" | "admin_club" | "comision" | "super_admin";

export const PERFILES: { id: Perfil; label: string; descripcion: string }[] = [
  { id: "profesor", label: "Profesor/a (Marcela)", descripcion: "Solo sus categorías: 9ª División y Escuelita 2016 — carga y planifica" },
  { id: "admin_club", label: "Admin del club", descripcion: "Todo el club: opera y además gestiona categorías, staff y consentimientos" },
  { id: "comision", label: "Comisión directiva", descripcion: "Todo el club, solo consulta — no carga ni edita" },
  { id: "super_admin", label: "Plataforma (super admin)", descripcion: "Observatorio interclubes: solo agregados, sin acceso a fichas" },
];

export interface Permisos {
  /** puede cargar mediciones, planificar, registrar consentimientos */
  opera: boolean;
  /** gestiona categorías, staff, borrado de deportistas (admin) */
  gestiona: boolean;
  /** accede a datos individuales del club */
  veClub: boolean;
  /** null = todas las categorías del club; lista = solo esas */
  categorias: string[] | null;
}

export function permisosDe(perfil: Perfil): Permisos {
  switch (perfil) {
    case "profesor":
      return { opera: true, gestiona: false, veClub: true, categorias: PROFE_DEMO.categorias };
    case "admin_club":
      return { opera: true, gestiona: true, veClub: true, categorias: null };
    case "comision":
      return { opera: false, gestiona: false, veClub: true, categorias: null };
    case "super_admin":
      return { opera: false, gestiona: false, veClub: false, categorias: [] };
  }
}

const PerfilContext = createContext<{
  perfil: Perfil;
  setPerfil: (p: Perfil) => void;
}>({ perfil: "profesor", setPerfil: () => {} });

export function PerfilProvider({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfilState] = useState<Perfil>("profesor");

  useEffect(() => {
    // ?perfil=super_admin permite deep-links de demo (ej. QR directo
    // al observatorio); tiene prioridad sobre lo guardado.
    const porUrl = new URLSearchParams(window.location.search).get(
      "perfil",
    ) as Perfil | null;
    if (porUrl && PERFILES.some((p) => p.id === porUrl)) {
      setPerfilState(porUrl);
      window.localStorage.setItem("tds-perfil", porUrl);
      return;
    }
    const guardado = window.localStorage.getItem("tds-perfil") as Perfil | null;
    if (guardado && PERFILES.some((p) => p.id === guardado)) {
      setPerfilState(guardado);
    }
  }, []);

  const setPerfil = (p: Perfil) => {
    setPerfilState(p);
    window.localStorage.setItem("tds-perfil", p);
  };

  return (
    <PerfilContext.Provider value={{ perfil, setPerfil }}>
      {children}
    </PerfilContext.Provider>
  );
}

export function usePerfil() {
  return useContext(PerfilContext);
}

/** ¿El perfil actual puede cargar/editar datos? */
export function puedeCargar(perfil: Perfil) {
  return perfil === "profesor" || perfil === "admin_club";
}
