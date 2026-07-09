"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Selector de perfil DEMO: sin auth real. Refleja el modelo de acceso
// del esquema (membresia.rol) + el super admin de plataforma, para
// poder demostrar permisos y la visión multi-club en el prototipo.
export type Perfil = "profesor" | "admin_club" | "comision" | "super_admin";

export const PERFILES: { id: Perfil; label: string; descripcion: string }[] = [
  { id: "profesor", label: "Profesor/a", descripcion: "Carga mediciones y planifica entrenamientos" },
  { id: "admin_club", label: "Admin del club", descripcion: "Gestiona categorías, staff y consentimientos" },
  { id: "comision", label: "Comisión directiva", descripcion: "Consulta todo, solo lectura" },
  { id: "super_admin", label: "Plataforma (super admin)", descripcion: "Observatorio interclubes, solo datos agregados" },
];

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
