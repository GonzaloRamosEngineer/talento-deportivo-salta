"use client";

import { useEffect, useMemo, useState } from "react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { useClub } from "@/lib/use-club";
import { usePerfil } from "@/components/perfil-context";
import {
  ATRIBUTOS,
  CATEGORIAS,
  CLUB,
  DEPORTISTAS,
  type Atributo,
  type Categoria,
  type Deportista,
  type HitoTrayectoria,
  type Medicion,
} from "@/lib/mock-data";
import { historialDe } from "@/lib/trayectoria";

// Fuente de datos de las pantallas de deportistas/medición/evolución.
// - Visitante anónimo (demo pública): devuelve el mock de siempre,
//   acotado por el selector de perfil (deep-links de demo intactos).
// - Sesión real con membresía: devuelve filas de Supabase (vía RLS)
//   ARMADAS con la misma forma que el mock, así las pantallas y la
//   lógica de tendencia (`lib/tendencia.ts`) sirven para ambas.
// Los ids acá son los UUID reales de la base, nunca los del mock.

export interface Datos {
  cargando: boolean;
  /** true = los datos salen de Supabase (sesión con membresía) */
  real: boolean;
  error: string | null;
  atributos: Atributo[];
  /** ya acotadas al alcance del rol (RLS + categorías asignadas) */
  categorias: Categoria[];
  deportistas: Deportista[];
  clubNombre: string;
  /** escudo del club (null en la demo mock o si no se cargó) */
  clubEscudoUrl: string | null;
  /** para `medicion.registrado_por` al guardar una jornada */
  membresiaId: string | null;
  /** nombre real del staff logueado (null en la demo mock) */
  membresiaNombre: string | null;
  clubId: string | null;
  recargar: () => void;
}

/** Fecha de HOY en horario local (nunca UTC: a la noche en Salta,
 *  toDateString UTC ya es "mañana" y rompería el tie-break por día). */
export function hoyLocalISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// El catálogo real coincide por nombre con el curado del mock; de ahí
// salen los extras de presentación (abreviatura de la tabla,
// descripción "qué mide"). Si un atributo nuevo no está en el mock,
// hay fallbacks razonables — nunca es un error.
const MOCK_POR_NOMBRE = new Map(ATRIBUTOS.map((a) => [a.nombre, a]));
const UNIDAD_CORTA: Record<string, string> = {
  segundos: "seg",
  metros: "m",
  escala: "1-10",
};

interface FilaAtributo {
  id: string;
  nombre: string;
  ambito: "fisico" | "tecnico";
  naturaleza: "objetivo" | "subjetivo";
  unidad: string;
  escala_min: number | null;
  escala_max: number | null;
  sentido: "mayor_mejor" | "menor_mejor" | null;
  protocolo: string | null;
}

function mapAtributo(f: FilaAtributo): Atributo {
  const mock = MOCK_POR_NOMBRE.get(f.nombre);
  return {
    id: f.id,
    nombre: f.nombre,
    abrev: mock?.abrev ?? f.nombre.slice(0, 3),
    ambito: f.ambito,
    naturaleza: f.naturaleza,
    unidad: UNIDAD_CORTA[f.unidad] ?? f.unidad,
    sentido: f.sentido,
    escalaMin: Number(f.escala_min ?? 0),
    escalaMax: Number(f.escala_max ?? 10),
    descripcion: mock?.descripcion ?? f.protocolo ?? "",
    entrenable: mock?.entrenable ?? f.ambito === "tecnico",
  };
}

const ORDEN_TIPO: Record<string, number> = {
  escuelita: 0,
  inferior: 1,
  reserva: 2,
  primera: 3,
};

interface Cargado {
  membresiaId: string;
  error: string | null;
  atributos: Atributo[];
  categorias: Categoria[];
  deportistas: Deportista[];
}

export function useDatos(): Datos {
  const { permisos } = usePerfil();
  const club = useClub();
  const [cargado, setCargado] = useState<Cargado | null>(null);
  const [version, setVersion] = useState(0);

  const membresiaId = club.membresia?.id ?? null;

  useEffect(() => {
    if (!membresiaId) return;
    let cancelado = false;
    const supabase = crearClienteBrowser();

    async function cargar() {
      try {
        const [rCat, rAtr, rDep] = await Promise.all([
          supabase
            .from("categoria")
            .select("id, nombre, tipo, anio_nacimiento"),
          supabase
            .from("atributo")
            .select(
              "id, nombre, ambito, naturaleza, unidad, escala_min, escala_max, sentido, protocolo",
            )
            .eq("activo", true)
            .order("ambito")
            .order("creado_en"),
          supabase
            .from("deportista")
            .select(
              "id, nombre, apellido, categoria_id, fecha_nacimiento, sexo, lateralidad, doc_interno, consentimiento(otorgado, revocado_en), deportista_hito(id, tipo, fecha, categoria_origen_nombre, categoria_destino_nombre, club_destino_nombre, detalle)",
            )
            .eq("activo", true)
            .order("apellido")
            .order("nombre"),
        ]);
        const primerError = rCat.error ?? rAtr.error ?? rDep.error;
        if (primerError) throw primerError;

        // Todas las mediciones visibles, paginadas (PostgREST corta
        // en 1000 filas por pedido): la lista y la tabla necesitan la
        // serie completa para tendencia y último valor.
        type FilaMedicion = {
          deportista_id: string;
          atributo_id: string;
          valor: number | string;
          fecha: string;
          nota: string | null;
          quien: { nombre: string } | { nombre: string }[] | null;
        };
        const PAGINA = 1000;
        const mediciones: FilaMedicion[] = [];
        for (let desde = 0; ; desde += PAGINA) {
          const { data, error } = await supabase
            .from("medicion")
            .select(
              "deportista_id, atributo_id, valor, fecha, nota, quien:registrado_por(nombre)",
            )
            .order("fecha")
            .order("id")
            .range(desde, desde + PAGINA - 1);
          if (error) throw error;
          mediciones.push(...((data ?? []) as FilaMedicion[]));
          if (!data || data.length < PAGINA) break;
        }

        const series = new Map<string, Record<string, Medicion[]>>();
        for (const m of mediciones) {
          const quien = Array.isArray(m.quien) ? m.quien[0] : m.quien;
          const porAtributo = series.get(m.deportista_id) ?? {};
          (porAtributo[m.atributo_id] ??= []).push({
            fecha: m.fecha,
            valor: Number(m.valor),
            entrenador: quien?.nombre ?? "—",
            nota: m.nota ?? undefined,
          });
          series.set(m.deportista_id, porAtributo);
        }

        const categorias: Categoria[] = (rCat.data ?? [])
          .map((c) => ({
            id: c.id as string,
            nombre: c.nombre as string,
            tipo: c.tipo as Categoria["tipo"],
            anioNacimiento: c.anio_nacimiento ?? undefined,
          }))
          .sort(
            (a, b) =>
              (ORDEN_TIPO[a.tipo ?? ""] ?? 9) - (ORDEN_TIPO[b.tipo ?? ""] ?? 9) ||
              (b.anioNacimiento ?? 0) - (a.anioNacimiento ?? 0) ||
              a.nombre.localeCompare(b.nombre),
          );

        const deportistas: Deportista[] = (rDep.data ?? []).map((d) => {
          const hitos: HitoTrayectoria[] = (
            (d.deportista_hito ?? []) as {
              id: string;
              tipo: HitoTrayectoria["tipo"];
              fecha: string;
              categoria_origen_nombre: string | null;
              categoria_destino_nombre: string | null;
              club_destino_nombre: string | null;
              detalle: string | null;
            }[]
          )
            .map((h) => ({
              id: h.id,
              tipo: h.tipo,
              fecha: h.fecha,
              categoriaOrigenNombre: h.categoria_origen_nombre,
              categoriaDestinoNombre: h.categoria_destino_nombre,
              clubDestinoNombre: h.club_destino_nombre,
              detalle: h.detalle,
            }))
            .sort((a, b) => a.fecha.localeCompare(b.fecha));
          return {
            id: d.id as string,
            nombre: d.nombre as string,
            apellido: (d.apellido as string | null) ?? "",
            categoriaId: (d.categoria_id as string | null) ?? "",
            fechaNacimiento: (d.fecha_nacimiento as string | null) ?? "",
            sexo: d.sexo as Deportista["sexo"],
            lateralidad: d.lateralidad as Deportista["lateralidad"],
            docInterno: d.doc_interno as string | null,
            consentimientoOk: (d.consentimiento ?? []).some(
              (c: { otorgado: boolean; revocado_en: string | null }) =>
                c.otorgado && !c.revocado_en,
            ),
            mediciones: series.get(d.id as string) ?? {},
            hitos,
            historial: historialDe(hitos),
          };
        });

        if (cancelado) return;
        setCargado({
          membresiaId: membresiaId!,
          error: null,
          atributos: (rAtr.data ?? []).map((a) => mapAtributo(a as FilaAtributo)),
          categorias,
          deportistas,
        });
      } catch (e) {
        if (cancelado) return;
        setCargado({
          membresiaId: membresiaId!,
          error: e instanceof Error ? e.message : "No se pudieron cargar los datos",
          atributos: [],
          categorias: [],
          deportistas: [],
        });
      }
    }

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [membresiaId, version]);

  // El mock, acotado por el selector de perfil demo (igual que antes
  // del wiring). Solo lo ve el visitante sin sesión.
  const mock = useMemo(() => {
    const categorias = permisos.categorias
      ? CATEGORIAS.filter((c) => permisos.categorias!.includes(c.id))
      : CATEGORIAS;
    const deportistas = permisos.categorias
      ? DEPORTISTAS.filter((d) => permisos.categorias!.includes(d.categoriaId))
      : DEPORTISTAS;
    return { categorias, deportistas };
  }, [permisos.categorias]);

  return useMemo(() => {
    // ¿Datos reales listos y de ESTA membresía? (tras un logout/login
    // lo cargado de la sesión anterior no vale)
    const listo = membresiaId && cargado?.membresiaId === membresiaId ? cargado : null;

    if (!membresiaId) {
      return {
        cargando: club.cargando,
        real: false,
        error: null,
        atributos: ATRIBUTOS,
        categorias: mock.categorias,
        deportistas: mock.deportistas,
        clubNombre: CLUB.nombre,
        clubEscudoUrl: null,
        membresiaId: null,
        membresiaNombre: null,
        clubId: null,
        recargar: () => setVersion((v) => v + 1),
      };
    }

    const asignadas = club.categoriasAsignadas;
    return {
      cargando: !listo,
      real: true,
      error: listo?.error ?? null,
      atributos: listo?.atributos ?? [],
      categorias: (listo?.categorias ?? []).filter(
        (c) => !asignadas || asignadas.includes(c.id),
      ),
      deportistas: listo?.deportistas ?? [],
      clubNombre: club.club?.nombre ?? CLUB.nombre,
      clubEscudoUrl: club.club?.escudoUrl ?? null,
      membresiaId,
      membresiaNombre: club.membresia?.nombre ?? null,
      clubId: club.membresia?.clubId ?? null,
      recargar: () => setVersion((v) => v + 1),
    };
  }, [membresiaId, cargado, club, mock]);
}
