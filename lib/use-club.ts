"use client";

import { useEffect, useState } from "react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import type { RolMembresia } from "@/lib/tipos-db";

export interface SesionClub {
  cargando: boolean;
  /** null = sin sesión real */
  usuario: { id: string; email: string | null } | null;
  /** null = sin membresía (visitante o perfil plataforma) */
  membresia: { id: string; rol: RolMembresia; clubId: string } | null;
  club: { id: string; nombre: string } | null;
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

      const { data: m } = await supabase
        .from("membresia")
        .select("id, rol, club_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (cancelado) return;
      if (!m) {
        setEstado({
          ...VACIA,
          cargando: false,
          usuario: { id: user.id, email: user.email ?? null },
        });
        return;
      }

      const [{ data: club }, categorias] = await Promise.all([
        supabase.from("club").select("id, nombre").eq("id", m.club_id).maybeSingle(),
        m.rol === "entrenador"
          ? supabase
              .from("membresia_categoria")
              .select("categoria_id")
              .eq("membresia_id", m.id)
              .then(({ data }) => (data ?? []).map((f) => f.categoria_id as string))
          : Promise.resolve(null),
      ]);
      if (cancelado) return;

      setEstado({
        cargando: false,
        usuario: { id: user.id, email: user.email ?? null },
        membresia: { id: m.id, rol: m.rol, clubId: m.club_id },
        club: club ?? null,
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
