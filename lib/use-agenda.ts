"use client";

import { useEffect, useMemo, useState } from "react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { usePerfil } from "@/components/perfil-context";
import {
  CRONOGRAMA,
  ENTRENADORES,
  HOY_DEMO,
  LUGARES,
  PARTIDOS,
  SESIONES,
  type Horario,
  type Lugar,
  type Partido,
  type Sesion,
} from "@/lib/mock-data";
import type { Datos } from "@/lib/use-datos";

// Fuente de datos de la agenda (sesiones, asistencia, partidos,
// cronograma, lugares). Mismo contrato dual que useDatos:
// - Visitante anónimo: el mock de siempre, acotado por el perfil demo.
// - Sesión real: filas de Supabase (vía RLS) con la MISMA forma que el
//   mock, así EventoCard y las pantallas sirven para ambas fuentes.
//
// Asistencia POR EXCEPCIÓN: en la base solo se guardan las FALTAS
// (filas de sesion_asistencia con presente=false). Todo deportista del
// plantel sin fila se asume presente. Acá se materializa la lista
// completa para que la UI (y el mock) trabajen igual.
//
// Sesiones VIRTUALES: la semana se arma desde el cronograma
// (horario_entrenamiento). Un entrenamiento sin fila en la base es una
// sesión "programada" con id `v_<horarioId>_<fecha>`; recién se escribe
// en la base cuando el profe pasa lista o la cancela.

export interface Agenda {
  cargando: boolean;
  real: boolean;
  error: string | null;
  /** ancla temporal: HOY_DEMO en el mock, hoy de verdad con sesión */
  hoy: Date;
  lugares: Lugar[];
  horarios: Horario[];
  /** reales + virtuales de la semana, con asistencia materializada */
  sesiones: Sesion[];
  partidos: Partido[];
  /** miembros del club visibles (incluye al propio usuario) */
  staff: number;
  recargar: () => void;
  /** el useDatos que alimentó este hook (categorías, deportistas…) */
  datos: Datos;
}

/** fecha local YYYY-MM-DD de un Date (nunca UTC) */
export function fechaLocalISO(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** lunes (00:00 local) de la semana a la que pertenece `d` */
export function lunesDe(d: Date): Date {
  const lunes = new Date(d);
  lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

export function esVirtual(sesionId: string): boolean {
  return sesionId.startsWith("v_");
}

/** Clave estable de un horario: su uuid con datos reales; en el mock
 *  (sin id) se deriva de categoría+día+hora. Es lo que viaja en el id
 *  de las sesiones virtuales. */
export function claveHorario(h: Horario): string {
  return h.id ?? `${h.categoriaId}~${h.diaSemana}~${h.hora}`;
}

/** sesión virtual (aún no registrada) de un horario del cronograma en
 *  una fecha local YYYY-MM-DD */
export function sesionVirtual(h: Horario, iso: string): Sesion {
  return {
    id: `v_${claveHorario(h)}_${iso}`,
    fecha: `${iso}T${h.hora}:00`,
    categoriaId: h.categoriaId,
    atributoFocoId: null,
    entrenador: h.entrenador,
    lugarId: h.lugarId,
    estado: "programada",
    descripcion: "",
    asistencia: [],
    asignaciones: [],
  };
}

/** Sesiones virtuales de la semana que arranca en `lunes`: un horario
 *  del cronograma sin sesión registrada ese día (misma categoría +
 *  misma fecha local). Sirve para CUALQUIER semana — la agenda navega
 *  pasado y futuro con esto. */
export function virtualesDeSemana(
  horarios: Horario[],
  sesiones: Sesion[],
  lunes: Date,
): Sesion[] {
  const registradas = new Set(
    sesiones
      .filter((s) => !esVirtual(s.id))
      .map((s) => `${s.categoriaId}|${fechaLocalISO(new Date(s.fecha))}`),
  );
  const virtuales: Sesion[] = [];
  for (const h of horarios) {
    const dia = new Date(lunes);
    dia.setDate(lunes.getDate() + (h.diaSemana - 1));
    const iso = fechaLocalISO(dia);
    if (registradas.has(`${h.categoriaId}|${iso}`)) continue;
    virtuales.push(sesionVirtual(h, iso));
  }
  return virtuales;
}

interface FilaSesion {
  id: string;
  categoria_id: string | null;
  responsable_id: string | null;
  atributo_foco: string | null;
  fecha: string;
  lugar_id: string | null;
  estado: "programada" | "realizada" | "cancelada";
  descripcion: string | null;
  sesion_asistencia: { deportista_id: string; presente: boolean }[];
  sesion_asignacion: { deportista_id: string; atributo_id: string }[];
}

interface FilaPartido {
  id: string;
  categoria_id: string;
  fecha: string;
  torneo: string | null;
  rival: string;
  condicion: "local" | "visitante";
  lugar_id: string | null;
  lugar_texto: string | null;
  goles_favor: number | null;
  goles_contra: number | null;
  partido_citacion: { deportista_id: string; presente: boolean }[];
}

interface Crudo {
  membresiaId: string;
  error: string | null;
  lugares: Lugar[];
  horarios: Horario[];
  sesiones: FilaSesion[];
  partidos: FilaPartido[];
  /** membresia_id → nombre (para "quién dio la sesión") */
  nombres: Map<string, string>;
  /** categoria_id → nombres de profes asignados */
  profesDe: Map<string, string[]>;
}

export function useAgenda(datos: Datos): Agenda {
  const { permisos } = usePerfil();
  const [crudo, setCrudo] = useState<Crudo | null>(null);
  const [version, setVersion] = useState(0);

  const membresiaId = datos.membresiaId;

  useEffect(() => {
    if (!membresiaId) return;
    let cancelado = false;
    const supabase = crearClienteBrowser();

    async function cargar() {
      try {
        const [rLug, rHor, rSes, rPar, rMem, rMemCat] = await Promise.all([
          supabase.from("lugar").select("id, nombre, direccion").order("nombre"),
          supabase
            .from("horario_entrenamiento")
            .select("id, categoria_id, dia_semana, hora, lugar_id")
            .order("dia_semana")
            .order("hora"),
          supabase
            .from("sesion_entrenamiento")
            .select(
              "id, categoria_id, responsable_id, atributo_foco, fecha, lugar_id, estado, descripcion, sesion_asistencia(deportista_id, presente), sesion_asignacion(deportista_id, atributo_id)",
            )
            .order("fecha", { ascending: false })
            .limit(500),
          supabase
            .from("partido")
            .select(
              "id, categoria_id, fecha, torneo, rival, condicion, lugar_id, lugar_texto, goles_favor, goles_contra, partido_citacion(deportista_id, presente)",
            )
            .order("fecha", { ascending: false })
            .limit(200),
          supabase.from("membresia").select("id, nombre"),
          supabase
            .from("membresia_categoria")
            .select("categoria_id, membresia:membresia_id(nombre)"),
        ]);
        const primerError =
          rLug.error ?? rHor.error ?? rSes.error ?? rPar.error ?? rMem.error ?? rMemCat.error;
        if (primerError) throw primerError;
        if (cancelado) return;

        const nombres = new Map(
          (rMem.data ?? []).map((m) => [m.id as string, m.nombre as string]),
        );
        const profesDe = new Map<string, string[]>();
        for (const f of rMemCat.data ?? []) {
          const m = Array.isArray(f.membresia) ? f.membresia[0] : f.membresia;
          if (!m?.nombre) continue;
          const lista = profesDe.get(f.categoria_id as string) ?? [];
          if (!lista.includes(m.nombre)) lista.push(m.nombre);
          profesDe.set(f.categoria_id as string, lista);
        }

        setCrudo({
          membresiaId: membresiaId!,
          error: null,
          lugares: (rLug.data ?? []).map((l) => ({
            id: l.id as string,
            nombre: l.nombre as string,
            direccion: (l.direccion as string | null) ?? undefined,
          })),
          horarios: (rHor.data ?? []).map((h) => ({
            id: h.id as string,
            categoriaId: h.categoria_id as string,
            diaSemana: h.dia_semana as number,
            hora: (h.hora as string).slice(0, 5),
            lugarId: (h.lugar_id as string | null) ?? "",
            entrenador: "", // se resuelve al derivar, con profesDe
          })),
          sesiones: (rSes.data ?? []) as FilaSesion[],
          partidos: (rPar.data ?? []) as FilaPartido[],
          nombres,
          profesDe,
        });
      } catch (e) {
        if (cancelado) return;
        setCrudo({
          membresiaId: membresiaId!,
          error: e instanceof Error ? e.message : "No se pudo cargar la agenda",
          lugares: [],
          horarios: [],
          sesiones: [],
          partidos: [],
          nombres: new Map(),
          profesDe: new Map(),
        });
      }
    }

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [membresiaId, version]);

  return useMemo<Agenda>(() => {
    const recargar = () => setVersion((v) => v + 1);

    // ---------- rama mock (visitante anónimo, demo pública) ----------
    if (!membresiaId) {
      const enAlcance = (c: string) =>
        !permisos.categorias || permisos.categorias.includes(c);
      return {
        cargando: datos.cargando,
        real: false,
        error: null,
        hoy: HOY_DEMO,
        lugares: LUGARES,
        horarios: CRONOGRAMA.filter((h) => enAlcance(h.categoriaId)),
        sesiones: SESIONES.filter((s) => enAlcance(s.categoriaId)),
        partidos: PARTIDOS.filter((p) => enAlcance(p.categoriaId)),
        staff: ENTRENADORES.length + 1,
        recargar,
        datos,
      };
    }

    // ---------- rama real ----------
    const listo = crudo?.membresiaId === membresiaId ? crudo : null;
    const hoy = new Date();

    if (!listo || datos.cargando) {
      return {
        cargando: true,
        real: true,
        error: listo?.error ?? null,
        hoy,
        lugares: [],
        horarios: [],
        sesiones: [],
        partidos: [],
        staff: 0,
        recargar,
        datos,
      };
    }

    // Alcance: RLS ya acotó sesiones/partidos; el cronograma y los
    // lugares son de todo el club, así que el profe los filtra acá.
    const idsCategorias = new Set(datos.categorias.map((c) => c.id));
    const horarios = listo.horarios
      .filter((h) => idsCategorias.has(h.categoriaId))
      .map((h) => ({
        ...h,
        entrenador: listo.profesDe.get(h.categoriaId)?.join(" · ") ?? "A designar",
      }));

    const plantelDe = new Map<string, string[]>();
    for (const d of datos.deportistas) {
      const lista = plantelDe.get(d.categoriaId) ?? [];
      lista.push(d.id);
      plantelDe.set(d.categoriaId, lista);
    }

    const sesiones: Sesion[] = listo.sesiones.map((s) => {
      // por excepción: fila = override (falta); sin fila = presente
      const overrides = new Map(
        s.sesion_asistencia.map((a) => [a.deportista_id, a.presente]),
      );
      const plantel = s.categoria_id ? (plantelDe.get(s.categoria_id) ?? []) : [];
      return {
        id: s.id,
        fecha: s.fecha,
        categoriaId: s.categoria_id ?? "",
        atributoFocoId: s.atributo_foco,
        entrenador:
          (s.responsable_id && listo.nombres.get(s.responsable_id)) || "—",
        lugarId: s.lugar_id ?? "",
        estado: s.estado,
        descripcion: s.descripcion ?? "",
        asistencia:
          s.estado === "realizada"
            ? plantel.map((deportistaId) => ({
                deportistaId,
                presente: overrides.get(deportistaId) ?? true,
              }))
            : [],
        asignaciones: s.sesion_asignacion.map((a) => ({
          deportistaId: a.deportista_id,
          atributoId: a.atributo_id,
        })),
      };
    });

    // Sesiones virtuales de la semana de HOY (el panel y el tablero se
    // paran acá; la agenda genera además las de la semana que se mire,
    // con el mismo helper).
    sesiones.push(...virtualesDeSemana(horarios, sesiones, lunesDe(hoy)));

    const partidos: Partido[] = listo.partidos.map((p) => ({
      id: p.id,
      fecha: p.fecha,
      categoriaId: p.categoria_id,
      torneo: p.torneo ?? "Amistoso",
      rival: p.rival,
      condicion: p.condicion,
      lugarId: p.lugar_id ?? undefined,
      lugarTexto: p.lugar_texto ?? undefined,
      citados: p.partido_citacion.map((c) => c.deportista_id),
      resultado:
        p.goles_favor !== null && p.goles_contra !== null
          ? { favor: p.goles_favor, contra: p.goles_contra }
          : undefined,
    }));

    return {
      cargando: false,
      real: true,
      error: listo.error,
      hoy,
      lugares: listo.lugares,
      horarios,
      sesiones,
      partidos,
      staff: listo.nombres.size,
      recargar,
      datos,
    };
  }, [membresiaId, crudo, datos, permisos.categorias]);
}
