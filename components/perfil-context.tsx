"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CATEGORIAS, PROFE_DEMO } from "@/lib/mock-data";
import { crearClienteBrowser } from "@/lib/supabase/client";

// Selector de perfil DEMO (sin sesión real): permite deep-links de
// demo (ej. QR directo al observatorio) para visitantes anónimos.
// Con SESIÓN REAL el rol manda siempre a la matriz de acceso de
// docs/PERFILES.md — se lee de `membresia`/`membresia_categoria` vía
// RLS, nunca de localStorage (ver cargarSesion() más abajo).
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

// Mapeo del rol REAL de `membresia.rol` (docs/PERFILES.md) al Perfil
// que ya consume toda la UI.
function perfilDeRolDB(rol: string): Perfil {
  if (rol === "admin_club") return "admin_club";
  if (rol === "comision_directiva") return "comision";
  return "profesor"; // 'entrenador'
}

const PerfilContext = createContext<{
  perfil: Perfil;
  setPerfil: (p: Perfil) => void;
  permisos: Permisos;
  /** true si el perfil viene de una sesión real (no del selector demo) */
  sesionReal: boolean;
}>({
  perfil: "profesor",
  setPerfil: () => {},
  permisos: permisosDe("profesor"),
  sesionReal: false,
});

export function PerfilProvider({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfilState] = useState<Perfil>("profesor");
  // undefined = sin sesión real (permisos.categorias sale de permisosDe);
  // definido = pisa permisos.categorias con el alcance real del entrenador.
  const [categoriasSesion, setCategoriasSesion] = useState<string[] | null | undefined>(
    undefined,
  );
  const [sesionReal, setSesionReal] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const supabase = crearClienteBrowser();

    function cargarDemo() {
      // ?perfil=super_admin permite deep-links de demo (ej. QR directo
      // al observatorio); tiene prioridad sobre lo guardado.
      const porUrl = new URLSearchParams(window.location.search).get(
        "perfil",
      ) as Perfil | null;
      if (porUrl && PERFILES.some((p) => p.id === porUrl)) {
        setPerfilState(porUrl);
        window.localStorage.setItem("tds-perfil", porUrl);
      } else {
        const guardado = window.localStorage.getItem("tds-perfil") as Perfil | null;
        if (guardado && PERFILES.some((p) => p.id === guardado)) {
          setPerfilState(guardado);
        }
      }
      setCategoriasSesion(undefined);
      setSesionReal(false);
    }

    async function cargarSesion() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelado) return;

      if (!user) {
        cargarDemo();
        return;
      }

      // Plataforma (Liga/Secretaría): sin fila en `membresia` a propósito
      // (regla #4 de CLAUDE.md) — se identifica por app_metadata.
      if (user.app_metadata?.plataforma) {
        setPerfilState("super_admin");
        setCategoriasSesion([]);
        setSesionReal(true);
        return;
      }

      const { data: m } = await supabase
        .from("membresia")
        .select("id, rol")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (cancelado) return;

      if (!m) {
        // Usuario autenticado sin membresía ni plataforma: no debería
        // pasar en el piloto, pero no se le asume ningún acceso.
        setPerfilState("profesor");
        setCategoriasSesion([]);
        setSesionReal(true);
        return;
      }

      let categorias: string[] | null = null;
      if (m.rol === "entrenador") {
        const { data: mc } = await supabase
          .from("membresia_categoria")
          .select("categoria:categoria_id(nombre)")
          .eq("membresia_id", m.id);
        if (cancelado) return;
        const nombres = new Set<string>();
        for (const fila of mc ?? []) {
          const cat = Array.isArray(fila.categoria) ? fila.categoria[0] : fila.categoria;
          if (cat?.nombre) nombres.add(cat.nombre);
        }
        categorias = CATEGORIAS.filter((c) => nombres.has(c.nombre)).map((c) => c.id);
      }

      setPerfilState(perfilDeRolDB(m.rol));
      setCategoriasSesion(categorias);
      setSesionReal(true);
    }

    cargarSesion();
    // Re-lee la sesión en cada login/logout: sin esto, el perfil queda
    // pegado al de la sesión anterior (el bug que este wiring arregla).
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      cargarSesion();
    });

    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const setPerfil = (p: Perfil) => {
    // Con sesión real el rol lo decide la base, no el selector demo.
    if (sesionReal) return;
    setPerfilState(p);
    window.localStorage.setItem("tds-perfil", p);
  };

  const permisos = useMemo(() => {
    const base = permisosDe(perfil);
    return categoriasSesion === undefined ? base : { ...base, categorias: categoriasSesion };
  }, [perfil, categoriasSesion]);

  return (
    <PerfilContext.Provider value={{ perfil, setPerfil, permisos, sesionReal }}>
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
