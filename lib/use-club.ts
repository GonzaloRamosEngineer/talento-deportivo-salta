"use client";

import { useEffect, useState } from "react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import type { RolMembresia } from "@/lib/tipos-db";

export interface SesionClub {
  cargando: boolean;
  /** null = sin sesión real */
  usuario: { id: string; email: string | null } | null;
  /** null = sin membresía (visitante o perfil plataforma) */
  membresia: { id: string; rol: RolMembresia; clubId: string; nombre: string } | null;
  club: { id: string; nombre: string; escudoUrl: string | null; tipoOrganizacion: string } | null;
  /** ids REALES de las categorías asignadas; null = alcance de todo el club */
  categoriasAsignadas: string[] | null;
}

const VACIA: SesionClub = {
  cargando: true,
  usuario: null,
  membresia: null,
  club: null,
  categoriasAsignadas: null,
};

/**
 * Sesión + membresía + club REALES (vía RLS), con los UUID de la base
 * — a diferencia de usePerfil(), que traduce a los ids del mock para
 * las pantallas demo. Las pantallas de gestión usan esto.
 */
export function useClub(): SesionClub {
  const [estado, setEstado] = useState<SesionClub>(VACIA);

  useEffect(() => {
    let cancelado = false;
    const supabase = crearClienteBrowser();

    async function cargar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelado) return;
      if (!user) {
        setEstado({ ...VACIA, cargando: false });
        return;
      }

      let { data: membresias, error: eM } = await supabase
        .from("membresia")
        .select("id, rol, club_id, nombre, club:club_id(id, nombre, escudo_url, tipo_organizacion)")
        .eq("auth_user_id", user.id);
      // Transición segura: producción no recibe esta funcionalidad hasta
      // Gate A. Mientras tanto, las sesiones actuales siguen leyendo el
      // esquema anterior sin quedar rotas por la nueva columna de staging.
      if (eM?.message.includes("tipo_organizacion")) {
        const anterior = await supabase
          .from("membresia")
          .select("id, rol, club_id, nombre, club:club_id(id, nombre, escudo_url)")
          .eq("auth_user_id", user.id);
        membresias = (anterior.data ?? []).map((fila) => {
          const club = Array.isArray(fila.club) ? fila.club[0] : fila.club;
          return { ...fila, club: club ? [{ ...club, tipo_organizacion: "club" }] : [] };
        });
        eM = anterior.error;
      }
      if (cancelado) return;
      if (eM) {
        // Antes esto caía en la misma rama que "no tiene membresía" y el
        // problema quedaba invisible. No son lo mismo: acá hubo un fallo.
        console.error("[use-club] no se pudo leer la membresía:", eM.message);
      }
      const preferida = window.localStorage.getItem("tds-membresia-activa");
      const rutaSecretaria = window.location.pathname.startsWith("/secretaria")
        || window.location.pathname.startsWith("/evaluaciones");
      const m = (membresias ?? []).find((fila) => fila.id === preferida)
        ?? (rutaSecretaria
          ? (membresias ?? []).find((fila) => {
              const organizacion = Array.isArray(fila.club) ? fila.club[0] : fila.club;
              return organizacion?.tipo_organizacion === "secretaria";
            })
          : null)
        ?? (membresias ?? [])[0];
      if (!m) {
        setEstado({
          ...VACIA,
          cargando: false,
          usuario: { id: user.id, email: user.email ?? null },
        });
        return;
      }

      window.localStorage.setItem("tds-membresia-activa", m.id);
      const categorias = await (
        m.rol === "entrenador" || m.rol === "evaluador"
          ? supabase
              .from("membresia_categoria")
              .select("categoria_id")
              .eq("membresia_id", m.id)
              .then(({ data }) => (data ?? []).map((f) => f.categoria_id as string))
          : Promise.resolve(null)
      );
      if (cancelado) return;

      const club = Array.isArray(m.club) ? m.club[0] : m.club;

      setEstado({
        cargando: false,
        usuario: { id: user.id, email: user.email ?? null },
        membresia: { id: m.id, rol: m.rol, clubId: m.club_id, nombre: m.nombre },
        club: club
          ? { id: club.id, nombre: club.nombre, escudoUrl: club.escudo_url ?? null, tipoOrganizacion: club.tipo_organizacion }
          : null,
        categoriasAsignadas: categorias,
      });
    }

    void cargar();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void cargar());
    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return estado;
}
