"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CATEGORIAS, PROFE_DEMO } from "@/lib/mock-data";
import { crearClienteBrowser } from "@/lib/supabase/client";

// Selector de perfil DEMO (sin sesión real): permite deep-links de
// demo (ej. QR directo al observatorio) para visitantes anónimos.
// Con SESIÓN REAL el rol manda siempre a la matriz de acceso de
// docs/PERFILES.md — se lee de `membresia`/`membresia_categoria` vía
// RLS, nunca de localStorage (ver cargarSesion() más abajo).
export type Perfil =
  | "profesor"
  | "admin_club"
  | "comision"
  | "secretaria"
  | "super_admin";

/**
 * `corto` es para la píldora del header mobile, donde no entra el label
 * completo y se cortaba a la mitad. No se reusa ROL_CORTO del shell porque
 * ése es el vocabulario de las sesiones REALES: ahí `super_admin` es
 * "Plataforma", y en la demo el mismo perfil se presenta como la Liga.
 */
export const PERFILES: { id: Perfil; label: string; corto: string; descripcion: string }[] = [
  { id: "profesor", label: "Profesor/a (Marcela)", corto: "Profe", descripcion: "Solo sus categorías: 9ª División y Escuelita 2016 — carga y planifica" },
  { id: "admin_club", label: "Admin del club", corto: "Admin", descripcion: "Todo el club: opera y además gestiona categorías, staff y consentimientos" },
  { id: "comision", label: "Comisión directiva", corto: "Comisión", descripcion: "Todo el club, solo consulta — no carga ni edita" },
  { id: "secretaria", label: "Secretaría · evaluaciones", corto: "Evaluaciones", descripcion: "Sus evaluadores, grupos, jornadas y mediciones multidisciplina" },
  // "Liga / Secretaría" y no "Plataforma (super admin)": es el mismo texto
  // con el que se entra desde /login, y "super admin" le suena a rol de
  // sistemas a un funcionario, que es justamente el visitante que este
  // perfil viene a mostrarle el observatorio.
  { id: "super_admin", label: "Secretaría · observatorio", corto: "Observatorio", descripcion: "Vista provincial agregada, sin acceso a fichas de clubes" },
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
    case "secretaria":
      return { opera: true, gestiona: true, veClub: true, categorias: null };
    case "super_admin":
      return { opera: false, gestiona: false, veClub: false, categorias: [] };
  }
}

// Mapeo del rol REAL de `membresia.rol` (docs/PERFILES.md) al Perfil
// que ya consume toda la UI.
function perfilDeRolDB(rol: string): Perfil {
  if (["admin_secretaria", "coordinador_secretaria", "evaluador", "analista_secretaria"].includes(rol)) return "secretaria";
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
  /**
   * Sesión real válida que NO pertenece a ningún club ni a plataforma.
   *
   * Pasa, por ejemplo, con alguien a quien dieron de baja del staff y que
   * ahora puede volver a entrar por su cuenta (T-002C). Sin esto, el
   * fallback lo dejaba como "profesor" con el mock: una app que parece
   * andar, con un club y deportistas que no son de nadie.
   *
   * Solo se marca cuando la consulta SALIÓ BIEN y no hay membresía. Si
   * falló la lectura no se afirma nada: no es lo mismo "no estás en ningún
   * club" que "no pudimos averiguarlo".
   */
  sinMembresia: boolean;
  /**
   * true hasta que se sabe si hay sesión real o no.
   *
   * Sin esto, el provider arranca en `sesionReal: false` y la UI muestra el
   * selector de perfil de la DEMO —con el personaje "(Marcela)"— durante el
   * instante que tarda `getUser()`. A un profe real le aparecía un rol que no
   * es el suyo y desaparecía solo. Es el mismo error que mostrar el club del
   * mock, pero en la ventana de carga.
   */
  cargandoSesion: boolean;
  contextosDisponibles: { secretaria: boolean; observatorio: boolean };
}>({
  perfil: "profesor",
  setPerfil: () => {},
  permisos: permisosDe("profesor"),
  sesionReal: false,
  sinMembresia: false,
  cargandoSesion: true,
  contextosDisponibles: { secretaria: false, observatorio: false },
});

export function PerfilProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [perfil, setPerfilState] = useState<Perfil>("profesor");
  // undefined = sin sesión real (permisos.categorias sale de permisosDe);
  // definido = pisa permisos.categorias con el alcance real del entrenador.
  const [categoriasSesion, setCategoriasSesion] = useState<string[] | null | undefined>(
    undefined,
  );
  const [sesionReal, setSesionReal] = useState(false);
  const [sinMembresia, setSinMembresia] = useState(false);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [rolSesion, setRolSesion] = useState<string | null>(null);
  const [contextosDisponibles, setContextosDisponibles] = useState({ secretaria: false, observatorio: false });

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
      setSinMembresia(false);
      setRolSesion(null);
      setContextosDisponibles({ secretaria: true, observatorio: true });
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

      let { data: membresias, error: eM } = await supabase
        .from("membresia")
        .select("id, rol, club:club_id(tipo_organizacion)")
        .eq("auth_user_id", user.id);
      if (eM?.message.includes("tipo_organizacion")) {
        const anterior = await supabase
          .from("membresia")
          .select("id, rol")
          .eq("auth_user_id", user.id);
        membresias = (anterior.data ?? []).map((fila) => ({
          ...fila,
          club: [{ tipo_organizacion: "club" }],
        }));
        eM = anterior.error;
      }
      if (cancelado) return;

      if (eM) {
        console.error("[perfil-context] no se pudo leer la membresía:", eM.message);
      }

      const membresiaSecretaria = (membresias ?? []).find((fila) => {
        const organizacion = Array.isArray(fila.club) ? fila.club[0] : fila.club;
        return organizacion?.tipo_organizacion === "secretaria";
      });
      const puedeObservatorio = Boolean(user.app_metadata?.plataforma);
      setContextosDisponibles({ secretaria: Boolean(membresiaSecretaria), observatorio: puedeObservatorio });
      const preferencia = window.localStorage.getItem("tds-contexto-activo");
      const quiereObservatorio = pathname.startsWith("/observatorio") || preferencia === "observatorio" && pathname === "/panel";
      if (puedeObservatorio && quiereObservatorio) {
        setPerfilState("super_admin");
        setCategoriasSesion([]);
        setRolSesion("plataforma");
        setSesionReal(true);
        setSinMembresia(false);
        return;
      }

      const preferida = window.localStorage.getItem("tds-membresia-activa");
      const m = (membresias ?? []).find((fila) => fila.id === preferida)
        ?? (pathname.startsWith("/secretaria") || pathname.startsWith("/evaluaciones") || preferencia === "secretaria"
          ? membresiaSecretaria
          : null)
        ?? (membresias ?? [])[0];

      if (!m) {
        if (puedeObservatorio) {
          setPerfilState("super_admin");
          setCategoriasSesion([]);
          setRolSesion("plataforma");
          setSesionReal(true);
          setSinMembresia(false);
          return;
        }
        // Usuario autenticado sin membresía ni plataforma: no se le asume
        // ningún acceso. `sinMembresia` solo se afirma si la consulta
        // funcionó — con `eM` no sabemos si no tiene club o si no pudimos
        // leerlo, y decirle lo primero cuando pasa lo segundo es peor.
        setPerfilState("profesor");
        setCategoriasSesion([]);
        setSesionReal(true);
        setSinMembresia(!eM);
        setRolSesion(null);
        return;
      }

      window.localStorage.setItem("tds-membresia-activa", m.id);

      let categorias: string[] | null = null;
      if (m.rol === "entrenador" || m.rol === "evaluador") {
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
      setRolSesion(m.rol);
      setSesionReal(true);
      setSinMembresia(false);
    }

    // `finally` y no una llamada por rama: cada `return` temprano de
    // cargarSesion() es una rama terminal, y olvidarse de una dejaría la UI
    // colgada en estado de carga para siempre.
    void cargarSesion().finally(() => {
      if (!cancelado) setCargandoSesion(false);
    });
    // Re-lee la sesión en cada login/logout: sin esto, el perfil queda
    // pegado al de la sesión anterior (el bug que este wiring arregla).
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      cargarSesion();
    });

    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, [pathname]);

  const setPerfil = (p: Perfil) => {
    // Con sesión real el rol lo decide la base, no el selector demo.
    if (sesionReal) return;
    setPerfilState(p);
    window.localStorage.setItem("tds-perfil", p);
  };

  const permisos = useMemo(() => {
    const base = permisosDe(perfil);
    const porRol = rolSesion === "analista_secretaria"
      ? { opera: false, gestiona: false, veClub: true }
      : rolSesion === "evaluador"
        ? { opera: true, gestiona: false, veClub: true }
        : rolSesion === "coordinador_secretaria" || rolSesion === "admin_secretaria"
          ? { opera: true, gestiona: true, veClub: true }
          : null;
    const combinado = porRol ? { ...base, ...porRol } : base;
    return categoriasSesion === undefined ? combinado : { ...combinado, categorias: categoriasSesion };
  }, [perfil, categoriasSesion, rolSesion]);

  return (
    <PerfilContext.Provider value={{ perfil, setPerfil, permisos, sesionReal, sinMembresia, cargandoSesion, contextosDisponibles }}>
      {children}
    </PerfilContext.Provider>
  );
}

export function usePerfil() {
  return useContext(PerfilContext);
}

/** ¿El perfil actual puede cargar/editar datos? */
export function puedeCargar(perfil: Perfil) {
  return perfil === "profesor" || perfil === "admin_club" || perfil === "secretaria";
}
