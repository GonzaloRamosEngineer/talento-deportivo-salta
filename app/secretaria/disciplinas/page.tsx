"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, CircleDashed, FlaskConical } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { DISCIPLINAS_SECRETARIA } from "@/lib/secretaria-demo";
import { useSecretaria } from "@/lib/use-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { Ayuda } from "@/components/ayuda";
import { CampoBusqueda } from "@/components/secretaria/campo-busqueda";
import { cn, paraBuscar } from "@/lib/utils";

const MES = new Intl.DateTimeFormat("es-AR", { month: "short" });
function fechaCorta(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MES.format(new Date(a, m - 1, d)).replace(".", "")} ${a}`;
}
/** "rsi_mod" → "Rsi mod": último recurso cuando el código no tiene nombre conocido. */
function legible(codigo: string) {
  const texto = codigo.replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

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
  const [busqueda, setBusqueda] = useState("");
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
  // Nombres de métrica por código, tomados de donde sí vienen (las usadas),
  // para no mostrar "altura_salto" en la batería sin registros.
  const nombreMetrica = new Map((cobertura ?? []).flatMap((item) => item.metricasUsadas.map((m) => [m.codigo, m.nombre] as const)));
  const termino = paraBuscar(busqueda);
  // Primero las que tienen datos (más deportistas arriba), después las que
  // todavía no se midieron.
  const visibles = (cobertura ?? [])
    .filter((item) => !termino || paraBuscar(`${item.disciplina} ${item.instituciones.join(" ")}`).includes(termino))
    .toSorted((a, b) => Number(b.jornadas > 0) - Number(a.jornadas > 0) || b.deportistas - a.deportistas || a.disciplina.localeCompare(b.disciplina, "es"));
  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-4 sm:gap-5">
        <div>
          <p className="hidden text-xs font-extrabold uppercase tracking-[0.16em] text-primary sm:block">Catálogo habilitado</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:mt-1">Disciplinas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {real && cobertura
              ? `${cobertura.length} en el catálogo · ${disciplinasConRegistros} con jornadas · ${disciplinasPorIniciar} sin jornadas todavía`
              : "La Secretaría habilita baterías validadas; las métricas no se inventan desde una planilla."}
          </p>
        </div>

        <Ayuda titulo="¿Qué muestra esta sección?" bullets={[
          "Qué se mide en cada disciplina, en qué instituciones y cuántas jornadas hay registradas.",
          "Un protocolo es cómo se hace la prueba (CMJ, SJ…); una métrica es el resultado (altura de salto). La misma métrica puede medirse con protocolos distintos.",
          "Una planilla no crea métricas nuevas: la batería de cada disciplina la habilita la Secretaría para que los datos sean comparables.",
        ]} />

        {real ? (
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:px-5">
              <div className="flex items-start gap-2">
                <FlaskConical className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <p className="text-xs text-muted-foreground"><strong className="font-extrabold text-foreground">Cobertura:</strong> cuántos protocolos de la batería de cada disciplina ya tienen mediciones.</p>
              </div>
              {(cobertura?.length ?? 0) > 6 && <CampoBusqueda valor={busqueda} onCambio={setBusqueda} etiqueta="Buscar disciplinas" placeholder="Buscar disciplina o institución" />}
            </div>
            {!cobertura ? <div className="p-4"><CargandoPelota texto="Calculando cobertura…" /></div> : visibles.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{`No encontramos "${busqueda.trim()}".`}</p> : <div className="divide-y divide-border xl:grid xl:grid-cols-2 xl:gap-3 xl:divide-y-0 xl:p-3">{visibles.map((item) => {
              const tieneDatos = item.jornadas > 0;
              const totalProtocolos = item.protocolosUsados.length + item.protocolosSinDatos.length;
              const planteles = disciplinas.find((disciplina) => disciplina.nombre === item.disciplina)?.grupos ?? 0;
              return <details key={item.disciplinaId} className="group xl:overflow-hidden xl:rounded-2xl xl:border xl:border-border xl:bg-card">
                <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3 py-3 hover:bg-muted/30 sm:px-5">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", tieneDatos ? "bg-secondary text-primary" : "bg-warning-soft text-warning")}>
                    {tieneDatos ? <CheckCircle2 className="size-4" aria-hidden /> : <CircleDashed className="size-4" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">{item.disciplina}</span>
                    <span className="block text-xs text-muted-foreground">
                      {tieneDatos
                        ? `${item.deportistas} ${item.deportistas === 1 ? "deportista" : "deportistas"} · ${item.jornadas} ${item.jornadas === 1 ? "jornada" : "jornadas"}${item.ultimaFecha ? ` · última ${fechaCorta(item.ultimaFecha)}` : ""}`
                        : "Sin jornadas todavía"}
                    </span>
                    {totalProtocolos > 0 && (
                      <span className="mt-1.5 flex items-center gap-2" aria-label={`${item.protocolosUsados.length} de ${totalProtocolos} protocolos con mediciones`}>
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${(item.protocolosUsados.length / totalProtocolos) * 100}%` }} /></span>
                        <span className="text-[11px] font-bold text-muted-foreground">{`${item.protocolosUsados.length} de ${totalProtocolos} protocolos`}</span>
                      </span>
                    )}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-(--ease-out) group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                </summary>
                <div className="space-y-3 border-t border-border bg-muted/20 px-3 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Protocolos medidos</span>{item.protocolosUsados.length ? item.protocolosUsados.map((protocolo) => <span key={protocolo} className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-extrabold text-primary-foreground">{protocolo}</span>) : <span className="text-xs text-muted-foreground">Ninguno todavía</span>}</div>
                  {item.metricasUsadas.length > 0 && <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2 lg:grid-cols-3">{item.metricasUsadas.map((metrica) => <div key={metrica.codigo} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"><span className="min-w-0"><span className="block text-xs font-bold">{metrica.nombre}</span><span className="text-[11px] text-muted-foreground">{metrica.unidad}</span></span><span className="shrink-0 text-xs font-extrabold tabular-nums text-primary">{metrica.cantidad}</span></div>)}</div>}
                  {(item.protocolosSinDatos.length > 0 || item.metricasSinDatos.length > 0) && <div className="rounded-xl bg-card px-3 py-2.5 text-xs">
                    <p className="font-bold text-muted-foreground">Disponible en la batería, sin registros todavía</p>
                    {item.protocolosSinDatos.length > 0 && <p className="mt-1"><span className="font-bold">Protocolos: </span>{item.protocolosSinDatos.join(" · ")}</p>}
                    {item.metricasSinDatos.length > 0 && <p className="mt-1"><span className="font-bold">Métricas: </span>{item.metricasSinDatos.map((codigo) => nombreMetrica.get(codigo) ?? legible(codigo)).join(" · ")}</p>}
                  </div>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{`${planteles} ${planteles === 1 ? "plantel" : "planteles"}`}</span>
                    <span>{item.instituciones.length ? item.instituciones.join(", ") : "Ninguna institución todavía"}</span>
                    {item.jornadas > 0 && <Link href="/secretaria/reportes" className="-my-2 inline-flex min-h-11 items-center font-extrabold text-primary sm:min-h-8">Ver reportes</Link>}
                  </div>
                </div>
              </details>;
            })}</div>}
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border px-3 py-3"><h2 className="text-sm font-extrabold">Catálogo de disciplinas</h2></div><div className="divide-y divide-border">{disciplinas.map((item) => <div key={item.nombre} className="flex min-h-14 items-center gap-3 px-3 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><CircleDashed className="size-4" aria-hidden /></span><span className="min-w-0 flex-1 text-sm font-bold">{item.nombre}</span></div>)}</div></section>
        )}
      </div>
    </GuardiaSecretaria>
  );
}
