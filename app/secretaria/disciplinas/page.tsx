"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, FlaskConical, Shapes } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { DISCIPLINAS_SECRETARIA } from "@/lib/secretaria-demo";
import { useSecretaria } from "@/lib/use-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";

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
  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Catálogo habilitado</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Disciplinas</h1>
          <p className="mt-1 text-sm text-muted-foreground">La Secretaría habilita baterías validadas; las métricas no se inventan desde una planilla.</p>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-secondary/45 p-4">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div><p className="text-sm font-extrabold">Métrica y protocolo son cosas distintas</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Altura de salto es una métrica. CMJ, SJ y Abalakov son protocolos diferentes que pueden producirla.</p></div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4"><Shapes className="size-4 text-primary" aria-hidden /><h2 className="text-sm font-extrabold">{disciplinas.length} disciplinas detectadas</h2></div>
          <div className="divide-y divide-border">
            {disciplinas.map((disciplina) => {
              const detectada = disciplina.estado === "Batería detectada" || disciplina.estado === "Batería activa" || disciplina.estado === "Planilla recibida";
              return (
                <div key={disciplina.nombre} className="flex items-center gap-3 px-5 py-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-extrabold text-primary">{disciplina.nombre.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{disciplina.nombre}</p><p className="text-xs text-muted-foreground">{disciplina.grupos} grupo{disciplina.grupos === 1 ? "" : "s"} recibido{disciplina.grupos === 1 ? "" : "s"}</p></div>
                  <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-muted-foreground">
                    {detectada ? <CheckCircle2 className="size-3.5 text-primary" aria-hidden /> : <CircleDashed className="size-3.5 text-warning" aria-hidden />}
                    {disciplina.estado}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {real ? (
          <section className="space-y-3">
            <div><h2 className="text-sm font-extrabold">Cobertura real</h2><p className="text-xs text-muted-foreground">Protocolos y métricas efectivamente registrados, no solamente disponibles.</p></div>
            {!cobertura ? <CargandoPelota texto="Calculando cobertura…" /> : cobertura.map((disciplina) => (
              <article key={disciplina.disciplinaId} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-extrabold">{disciplina.disciplina}</h3><p className="mt-0.5 text-xs text-muted-foreground">{disciplina.deportistas} deportistas · {disciplina.jornadas} jornadas{disciplina.ultimaFecha ? ` · última ${disciplina.ultimaFecha}` : ""}</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-extrabold text-primary">{disciplina.instituciones.length} instituciones</span></div>
                <p className="mt-4 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">Protocolos usados</p>
                <div className="mt-2 flex flex-wrap gap-2">{disciplina.protocolosUsados.length ? disciplina.protocolosUsados.map((protocolo) => <span key={protocolo} className="rounded-full bg-primary px-3 py-1 text-xs font-extrabold text-primary-foreground">{protocolo}</span>) : <span className="text-xs text-muted-foreground">Todavía sin datos</span>}</div>
                <div className="mt-4 divide-y divide-border rounded-2xl border border-border">{disciplina.metricasUsadas.map((metrica) => <div key={metrica.codigo} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-bold">{metrica.nombre}</p><p className="text-xs text-muted-foreground">{metrica.unidad}</p></div><span className="text-xs font-extrabold text-primary">{metrica.cantidad}</span></div>)}{disciplina.metricasUsadas.length === 0 && <p className="px-4 py-3 text-xs text-muted-foreground">No hay métricas registradas todavía.</p>}</div>
                {(disciplina.protocolosSinDatos.length > 0 || disciplina.metricasSinDatos.length > 0) && <div className="mt-4 rounded-2xl bg-muted/45 p-3"><p className="text-xs font-extrabold">Disponible, todavía sin datos</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{[...disciplina.protocolosSinDatos, ...disciplina.metricasSinDatos].join(" · ")}</p></div>}
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-3xl border border-border bg-card p-5">
            <p className="text-sm font-extrabold">Batería detectada · Fútbol SUB13</p>
            <div className="mt-3 flex flex-wrap gap-2">{["CMJ", "Abalakov", "SJ"].map((p) => <span key={p} className="rounded-full bg-secondary px-3 py-1 text-xs font-extrabold text-primary">{p}</span>)}</div>
            <div className="mt-3 flex flex-wrap gap-2">{["Peso corporal", "Altura de salto", "Fuerza máxima", "Potencia relativa", "RSI-mod"].map((m) => <span key={m} className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted-foreground">{m}</span>)}</div>
          </section>
        )}
      </div>
    </GuardiaSecretaria>
  );
}
