"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, CircleDashed, FlaskConical, Shapes } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { DISCIPLINAS_SECRETARIA } from "@/lib/secretaria-demo";
import { useSecretaria } from "@/lib/use-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { Ayuda } from "@/components/ayuda";

interface DisciplinaReal {
  disciplinaId: string;
  disciplina: string;
  instituciones: string[];
  grupos: number;
  deportistas: number;
  jornadas: number;
  ultimaFecha: string | null;
  protocolosUsados: string[];
  metricasUsadas: Array<{ codigo: string; nombre: string; unidad: string; cantidad: number }>;
  protocolosSinDatos: string[];
  metricasSinDatos: string[];
}

export default function DisciplinasSecretaria() {
  const { resumen, cargando, error, real } = useSecretaria();
  const [cobertura, setCobertura] = useState<DisciplinaReal[] | null>(null);
  const [errorCobertura, setErrorCobertura] = useState<string | null>(null);
  useEffect(() => {
    if (!real) return;
    const controlador = new AbortController();
    fetch("/api/secretaria/disciplinas", { signal: controlador.signal })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos cargar la cobertura.");
        return cuerpo as DisciplinaReal[];
      })
      .then(setCobertura)
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === "AbortError") return;
        setErrorCobertura(causa instanceof Error ? causa.message : "No pudimos cargar la cobertura.");
      });
    return () => controlador.abort();
  }, [real]);
  if (cargando) return <CargandoPelota texto="Cargando disciplinas…" />;
  if (error) return <AvisoAcceso titulo="No pudimos cargar las disciplinas" detalle={error} accionHref="/secretaria/disciplinas" accionLabel="Reintentar" />;
  if (errorCobertura) return <AvisoAcceso titulo="No pudimos cargar la cobertura" detalle={errorCobertura} accionHref="/secretaria/disciplinas" accionLabel="Reintentar" />;
  const disciplinas = real && resumen
    ? resumen.disciplinas.map((disciplina) => ({
        nombre: disciplina.nombre,
        grupos: disciplina.grupos,
        estado: disciplina.grupos > 0
          ? "Batería activa"
          : disciplina.lotes > 0
            ? "Planilla recibida"
            : "Catálogo listo",
      }))
    : DISCIPLINAS_SECRETARIA;
  const disciplinasConRegistros = cobertura?.filter((item) => item.jornadas > 0).length ?? 0;
  const disciplinasPorIniciar = cobertura ? Math.max(0, cobertura.length - disciplinasConRegistros) : 0;
  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-4 sm:gap-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Catálogo habilitado</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Disciplinas</h1>
          <p className="mt-1 text-sm text-muted-foreground">La Secretaría habilita baterías validadas; las métricas no se inventan desde una planilla.</p>
        </div>

        <Ayuda titulo="¿Qué muestra esta sección?" bullets={[
          "La cobertura indica qué instituciones, grupos y jornadas tienen datos para cada disciplina.",
          "Los protocolos describen cómo se hizo una prueba; las métricas son los resultados que se registran.",
          "Las baterías habilitadas mantienen criterios comparables. Una planilla no crea métricas nuevas automáticamente.",
        ]} />

        <details className="group rounded-2xl border border-primary/20 bg-secondary/45">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 p-3"><FlaskConical className="size-4 shrink-0 text-primary" aria-hidden /><span className="min-w-0 flex-1 text-xs"><strong className="font-extrabold">Métrica y protocolo son distintos.</strong> Altura de salto puede medirse con CMJ, SJ o Abalakov.</span><ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" /></summary>
        </details>

        {real && cobertura && <section className="hidden grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card lg:grid">
          <div className="border-r border-border p-4"><p className="text-2xl font-extrabold tabular-nums">{cobertura.length}</p><p className="text-xs font-semibold text-muted-foreground">disciplinas en el catálogo</p></div>
          <div className="border-r border-border p-4"><p className="text-2xl font-extrabold tabular-nums text-primary">{disciplinasConRegistros}</p><p className="text-xs font-semibold text-muted-foreground">con jornadas registradas</p></div>
          <div className="p-4"><p className="text-2xl font-extrabold tabular-nums">{disciplinasPorIniciar}</p><p className="text-xs font-semibold text-muted-foreground">sin jornadas todavía</p></div>
        </section>}

        {real ? (
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-3 py-3 sm:px-5"><Shapes className="size-4 text-primary" aria-hidden /><div><h2 className="text-sm font-extrabold">Cobertura por disciplina</h2><p className="text-[11px] text-muted-foreground">{disciplinas.length} disciplinas · tocá para ver el detalle</p></div></div>
            {!cobertura ? <div className="p-4"><CargandoPelota texto="Calculando cobertura…" /></div> : <div className="divide-y divide-border xl:grid xl:grid-cols-2 xl:gap-3 xl:divide-y-0 xl:p-3">{cobertura.map((item) => {
              const catalogo = disciplinas.find((disciplina) => disciplina.nombre === item.disciplina);
              const estado = catalogo?.estado ?? (catalogo?.grupos ? "Batería activa" : "Catálogo listo");
              const tieneDatos = item.jornadas > 0 || item.deportistas > 0;
              return <details key={item.disciplinaId} className="group xl:overflow-hidden xl:rounded-2xl xl:border xl:border-border xl:bg-card">
                <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-3 sm:px-5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-[11px] font-extrabold text-primary">{item.disciplina.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{item.disciplina}</span><span className="block truncate text-[11px] text-muted-foreground">{item.deportistas} deportistas · {item.jornadas} jornadas</span></span><span className="hidden items-center gap-1 text-[10px] font-bold text-muted-foreground min-[420px]:inline-flex">{tieneDatos ? <CheckCircle2 className="size-3.5 text-primary" aria-hidden /> : <CircleDashed className="size-3.5 text-warning" aria-hidden />}{estado}</span><ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary>
                <div className="space-y-3 border-t border-border bg-muted/20 px-3 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Protocolos</span>{item.protocolosUsados.length ? item.protocolosUsados.map((protocolo) => <span key={protocolo} className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-extrabold text-primary-foreground">{protocolo}</span>) : <span className="text-xs text-muted-foreground">Sin mediciones registradas</span>}</div>
                  <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2 lg:grid-cols-3">{item.metricasUsadas.map((metrica) => <div key={metrica.codigo} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"><span className="min-w-0"><span className="block truncate text-xs font-bold">{metrica.nombre}</span><span className="text-[10px] text-muted-foreground">{metrica.unidad}</span></span><span className="shrink-0 text-xs font-extrabold text-primary">{metrica.cantidad}</span></div>)}{item.metricasUsadas.length === 0 && <p className="rounded-xl bg-card px-3 py-2 text-xs text-muted-foreground">Todavía no hay métricas medidas en esta disciplina.</p>}</div>
                  {(item.protocolosSinDatos.length > 0 || item.metricasSinDatos.length > 0) && <details className="rounded-xl bg-card px-3 py-2"><summary className="cursor-pointer text-xs font-bold text-muted-foreground">Ver batería disponible sin registros</summary><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{[...item.protocolosSinDatos, ...item.metricasSinDatos].join(" · ")}</p></details>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground"><span>{catalogo?.grupos ?? 0} grupos activos</span><span>{item.instituciones.length} instituciones</span>{item.ultimaFecha && <span>Última jornada: {item.ultimaFecha}</span>}</div>
                </div>
              </details>;
            })}</div>}
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border px-3 py-3"><h2 className="text-sm font-extrabold">Catálogo de disciplinas</h2></div><div className="divide-y divide-border">{disciplinas.map((item) => <div key={item.nombre} className="flex items-center gap-3 px-3 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-[11px] font-extrabold text-primary">{item.nombre.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-sm font-bold">{item.nombre}</span><CircleDashed className="size-4 text-muted-foreground" aria-hidden /></div>)}</div></section>
        )}
      </div>
    </GuardiaSecretaria>
  );
}
