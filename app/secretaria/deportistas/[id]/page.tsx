"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ClipboardPlus, Table2 } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { EvolutionChart } from "@/components/evolution-chart";
import type { Atributo, Medicion } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { PRESIONABLE } from "@/components/secretaria/presionable";
import { TablaMediciones } from "@/components/secretaria/tabla-mediciones";

interface FichaSecretaria {
  deportista: { id: string; nombre: string; apellido: string | null; fechaNacimiento: string | null; sexo: string | null; lateralidad: string | null; grupoId: string; grupo: string; institucion: string; disciplina: string };
  mediciones: Array<{ id: string; fecha: string; valor: number; intento: number; nota: string | null; evaluadoPor: string; loteId: string | null; jornadaId: string | null; atributo: { id: string; codigo: string; nombre: string; unidad: string; sentido: Atributo["sentido"] } | null; protocolo: { id: string; codigo: string; nombre: string } | null }>;
}

interface SerieSecretaria {
  clave: string;
  nombre: string;
  protocolo: string;
  unidad: string;
  sentido: Atributo["sentido"];
  mediciones: Medicion[];
  filas: FichaSecretaria["mediciones"];
}

function fecha(valor: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(valor));
}

export default function FichaDeportistaSecretaria() {
  const { id } = useParams<{ id: string }>();
  const [ficha, setFicha] = useState<FichaSecretaria | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "todo" = la tabla con todas las métricas; si no, la clave de una serie.
  const [serieActiva, setSerieActiva] = useState("todo");
  const detalleRef = useRef<HTMLElement>(null);

  // Elegir una métrica desde la tabla lleva a su detalle: se sube hasta él
  // (sin animación si el usuario pidió menos movimiento).
  function elegirSerie(clave: string, desplazar = false) {
    setSerieActiva(clave);
    if (!desplazar) return;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => detalleRef.current?.scrollIntoView({ block: "start", behavior: suave ? "smooth" : "auto" }));
  }

  useEffect(() => {
    const controlador = new AbortController();
    fetch(`/api/secretaria/deportistas/${id}`, { signal: controlador.signal })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos cargar la ficha.");
        return cuerpo as FichaSecretaria;
      })
      .then(setFicha)
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === "AbortError") return;
        setError(causa instanceof Error ? causa.message : "No pudimos cargar la ficha.");
      });
    return () => controlador.abort();
  }, [id]);

  const series = (() => {
    const mapa = new Map<string, SerieSecretaria>();
    for (const medicion of ficha?.mediciones ?? []) {
      if (!medicion.atributo) continue;
      const protocolo = medicion.protocolo?.codigo ?? "General";
      const clave = `${medicion.atributo.codigo}:${protocolo}`;
      const actual = mapa.get(clave) ?? { clave, nombre: medicion.atributo.nombre, protocolo, unidad: medicion.atributo.unidad, sentido: medicion.atributo.sentido, mediciones: [], filas: [] };
      actual.mediciones.push({ fecha: medicion.fecha, valor: medicion.valor, entrenador: medicion.evaluadoPor, nota: medicion.nota ?? undefined });
      actual.filas.push(medicion);
      mapa.set(clave, actual);
    }
    for (const serie of mapa.values()) serie.filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.intento - b.intento);
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.protocolo.localeCompare(b.protocolo, "es"));
  })();
  const verTodo = serieActiva === "todo";
  const activa = verTodo ? null : series.find((serie) => serie.clave === serieActiva) ?? null;
  const fechasActiva = activa ? new Set(activa.mediciones.map((medicion) => medicion.fecha)).size : 0;

  if (error) return <AvisoAcceso titulo="No pudimos cargar la ficha" detalle={error} accionHref="/secretaria/deportistas" accionLabel="Volver" />;
  if (!ficha) return <CargandoPelota texto="Cargando ficha y evolución…" />;
  const deportista = ficha.deportista;
  const atributo: Atributo | null = activa ? { id: activa.clave, nombre: `${activa.nombre} · ${activa.protocolo}`, abrev: activa.nombre.slice(0, 3), ambito: "fisico", naturaleza: "objetivo", unidad: activa.unidad, sentido: activa.sentido, escalaMin: Math.min(...activa.mediciones.map((item) => item.valor), 0), escalaMax: Math.max(...activa.mediciones.map((item) => item.valor), 10), descripcion: "", entrenable: false } : null;

  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-5">
        <Link href="/secretaria/deportistas" className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1.5 px-1 text-sm font-extrabold text-primary sm:min-h-8 sm:text-xs"><ArrowLeft className="size-4 sm:size-3.5" aria-hidden />Deportistas</Link>
        <div className="flex items-start gap-3">
          <AvatarIniciales nombre={deportista.nombre} apellido={deportista.apellido} className="size-12 text-base sm:size-14 sm:text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold leading-tight">{deportista.apellido?.trim() ? `${deportista.nombre} ${deportista.apellido}` : deportista.nombre}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{`${deportista.grupo} · ${deportista.institucion} · ${deportista.disciplina}`}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ficha.mediciones.length === 0
                ? "Sin registros todavía"
                : `${ficha.mediciones.length} ${ficha.mediciones.length === 1 ? "registro" : "registros"} · ${series.length} ${series.length === 1 ? "métrica" : "métricas"} · última evaluación ${fecha(ficha.mediciones.map((m) => m.fecha).sort().at(-1)!)}`}
            </p>
          </div>
          <Link href={`/secretaria/medir?grupo=${deportista.grupoId}`} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 sm:px-4 ${PRESIONABLE}`} aria-label="Medir su plantel"><ClipboardPlus className="size-4" aria-hidden /><span className="hidden sm:inline">Medir plantel</span></Link>
        </div>

        {series.length > 0 ? <>
          <section ref={detalleRef} className="scroll-mt-20">
            <h2 className="mb-2 text-sm font-extrabold">Métricas y protocolos</h2>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              <button type="button" aria-pressed={verTodo} onClick={() => elegirSerie("todo")} className={cn(`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-xs font-extrabold sm:min-h-9 ${PRESIONABLE}`, verTodo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
                <Table2 className="size-3.5" aria-hidden />{`Todo · ${series.length}`}
              </button>
              {series.map((serie) => (
                <button key={serie.clave} type="button" aria-pressed={activa?.clave === serie.clave} onClick={() => elegirSerie(serie.clave)} className={cn(`min-h-11 shrink-0 rounded-full border px-3.5 text-xs font-bold sm:min-h-9 ${PRESIONABLE}`, activa?.clave === serie.clave ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
                  {`${serie.nombre} · ${serie.protocolo}`}
                </button>
              ))}
            </div>
          </section>

          {verTodo && <section className="rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-5">
            <h2 className="mb-3 text-base font-extrabold">Todas las mediciones</h2>
            <TablaMediciones series={series} onElegir={(clave) => elegirSerie(clave, true)} />
          </section>}

          {activa && atributo && <section className="rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-5">
            <div>
              <h2 className="text-base font-extrabold">{activa.nombre} <span className="text-sm text-muted-foreground">· {activa.protocolo}</span></h2>
              <p className="text-xs text-muted-foreground">Cada protocolo conserva su propia serie; los intentos no se promedian.</p>
            </div>
            {fechasActiva > 1
              ? <div className="mt-3"><EvolutionChart serie={activa.mediciones} atributo={atributo} /></div>
              : <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">Primer registro</p>
                  <p className="mt-1 text-xs text-muted-foreground">La curva aparece cuando se lo vuelva a medir con el mismo protocolo.</p>
                </div>}
            <ul className="mt-4 divide-y divide-border">{[...activa.filas].reverse().map((medicion) => <li key={medicion.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">{`${fecha(medicion.fecha)}${medicion.intento > 1 ? ` · intento ${medicion.intento}` : ""}`}</p>
                <p className="text-xs text-muted-foreground">Evaluó {medicion.evaluadoPor}</p>
                {medicion.loteId && <Link href={`/secretaria/jornadas/${medicion.loteId}`} className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-xs font-extrabold text-primary sm:min-h-7">Ver planilla de origen <ArrowUpRight className="size-3" aria-hidden /></Link>}
              </div>
              <p className="shrink-0 text-base font-extrabold tabular-nums text-primary">{medicion.valor.toLocaleString("es-AR")} <span className="text-xs text-muted-foreground">{activa.unidad}</span></p>
            </li>)}</ul>
          </section>}
        </> : <section className="rounded-3xl border border-border bg-card p-8 text-center"><p className="text-sm font-extrabold">Todavía no tiene mediciones</p><p className="mt-1 text-xs text-muted-foreground">La evolución aparece cuando se registre su primera jornada.</p></section>}
      </div>
    </GuardiaSecretaria>
  );
}
