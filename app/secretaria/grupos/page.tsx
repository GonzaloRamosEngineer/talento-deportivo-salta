"use client";

import { Building2, Filter, Users } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { EstadoJornada } from "@/components/secretaria/estado-jornada";
import { GRUPOS_SECRETARIA } from "@/lib/secretaria-demo";
import { useSecretaria } from "@/lib/use-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";

export default function GruposSecretaria() {
  const { resumen, cargando, error, real } = useSecretaria();
  if (cargando) return <CargandoPelota texto="Cargando grupos…" />;
  if (error) return <AvisoAcceso titulo="No pudimos cargar los grupos" detalle={error} accionHref="/secretaria/grupos" accionLabel="Reintentar" />;
  const grupos = real && resumen
    ? resumen.grupos.map((grupo) => ({
        id: grupo.id,
        institucion: grupo.institucion,
        disciplina: grupo.disciplina,
        grupo: grupo.nombre,
        estado: "lista" as const,
        evaluados: grupo.deportistas,
        resultados: resumen.jornadas.filter((jornada) => jornada.grupo === grupo.nombre && jornada.institucion === grupo.institucion).reduce((total, jornada) => total + jornada.mediciones, 0),
      }))
    : GRUPOS_SECRETARIA;
  const instituciones = new Set(grupos.map((grupo) => grupo.institucion)).size;
  const disciplinas = new Set(grupos.map((grupo) => grupo.disciplina)).size;

  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Espacio Secretaría</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Grupos evaluados</h1>
          <p className="mt-1 text-sm text-muted-foreground">La institución es procedencia; el grupo vive dentro del espacio de Secretaría.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border bg-card p-3.5"><Building2 className="size-4 text-primary" aria-hidden /><p className="mt-3 text-2xl font-extrabold">{instituciones}</p><p className="text-[11px] font-semibold text-muted-foreground">instituciones</p></div>
          <div className="rounded-2xl border border-border bg-card p-3.5"><Users className="size-4 text-primary" aria-hidden /><p className="mt-3 text-2xl font-extrabold">{grupos.length}</p><p className="text-[11px] font-semibold text-muted-foreground">grupos</p></div>
          <div className="rounded-2xl border border-border bg-card p-3.5"><Filter className="size-4 text-primary" aria-hidden /><p className="mt-3 text-2xl font-extrabold">{disciplinas}</p><p className="text-[11px] font-semibold text-muted-foreground">disciplinas</p></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {grupos.map((grupo) => (
            <article key={grupo.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-extrabold text-primary">{grupo.disciplina}</span>
                <EstadoJornada estado={grupo.estado} />
              </div>
              <h2 className="mt-4 text-base font-extrabold">{grupo.grupo}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{grupo.institucion}</p>
              {grupo.evaluados ? (
                <div className="mt-4 flex gap-4 border-t border-border pt-3 text-xs">
                  <span><strong className="text-foreground">{grupo.evaluados}</strong> <span className="text-muted-foreground">evaluados</span></span>
                  <span><strong className="text-foreground">{grupo.resultados}</strong> <span className="text-muted-foreground">resultados</span></span>
                </div>
              ) : (
                <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Los conteos aparecerán al mapear la planilla.</p>
              )}
            </article>
          ))}
        </div>
      </div>
    </GuardiaSecretaria>
  );
}
