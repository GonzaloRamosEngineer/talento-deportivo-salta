"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronRight, Users } from "lucide-react";
import { CampoBusqueda } from "@/components/secretaria/campo-busqueda";
import { PRESIONABLE } from "@/components/secretaria/presionable";
import { paraBuscar as normalizar } from "@/lib/utils";

export interface OpcionInstitucion {
  id: string;
  nombre: string;
  disciplinas: number;
  planteles: number;
}

export interface OpcionPlantel {
  id: string;
  nombre: string;
  institucionId: string;
  institucion: string;
  disciplina: string;
  deportistas: number;
}


const MAXIMO_RESULTADOS = 8;

/**
 * "¿Dónde van a medir?" pensado para una provincia, no para seis clubes.
 *
 * Un solo campo busca en instituciones Y en planteles: escribir "sub13" o
 * "liga" muestra el plantel listo para elegir, así se saltean los pasos
 * institución → disciplina → plantel con un toque. Sin texto, lista las
 * instituciones como antes.
 */
export function BuscadorLugarMedicion({ instituciones, planteles, onInstitucion, onPlantel }: {
  instituciones: OpcionInstitucion[];
  planteles: OpcionPlantel[];
  onInstitucion: (id: string) => void;
  onPlantel: (id: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const termino = normalizar(texto);

  const { plantelesEncontrados, institucionesEncontradas } = useMemo(() => {
    if (!termino) return { plantelesEncontrados: [], institucionesEncontradas: instituciones };
    return {
      plantelesEncontrados: planteles
        .filter((p) => normalizar(`${p.institucion} ${p.disciplina} ${p.nombre}`).includes(termino))
        .slice(0, MAXIMO_RESULTADOS),
      institucionesEncontradas: instituciones.filter((i) => normalizar(i.nombre).includes(termino)).slice(0, MAXIMO_RESULTADOS),
    };
  }, [termino, instituciones, planteles]);

  const sinResultados = termino && plantelesEncontrados.length === 0 && institucionesEncontradas.length === 0;
  const detalleInstitucion = (i: OpcionInstitucion) =>
    i.planteles === 0 ? "Sin planteles todavía" : `${i.disciplinas} ${i.disciplinas === 1 ? "disciplina" : "disciplinas"} · ${i.planteles} ${i.planteles === 1 ? "plantel" : "planteles"}`;

  return (
    <div className="flex flex-col gap-3">
      <CampoBusqueda valor={texto} onCambio={setTexto} etiqueta="Buscar institución o plantel" placeholder="Buscá institución o plantel" />

      {plantelesEncontrados.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Planteles</p>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {plantelesEncontrados.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onPlantel(p.id)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border border-primary/25 bg-secondary/40 p-3 text-left hover:border-primary/50 ${PRESIONABLE}`}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Users className="size-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold leading-snug">{p.nombre}</span>
                    <span className="block text-xs text-muted-foreground">{`${p.institucion} · ${p.disciplina} · ${p.deportistas} ${p.deportistas === 1 ? "deportista" : "deportistas"}`}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {institucionesEncontradas.length > 0 && (
        <div>
          {termino && <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Instituciones</p>}
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {institucionesEncontradas.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => onInstitucion(i.id)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-primary/35 ${PRESIONABLE}`}>
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-primary"><Building2 className="size-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold leading-snug">{i.nombre}</span>
                    <span className="block text-xs text-muted-foreground">{detalleInstitucion(i)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!termino && instituciones.length > MAXIMO_RESULTADOS && (
            <p className="mt-2 text-xs text-muted-foreground">{`${instituciones.length} instituciones. Escribí para encontrar la tuya más rápido.`}</p>
          )}
        </div>
      )}

      {sinResultados && (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {`No encontramos "${texto.trim()}". Probá con otra parte del nombre.`}
        </p>
      )}
    </div>
  );
}
