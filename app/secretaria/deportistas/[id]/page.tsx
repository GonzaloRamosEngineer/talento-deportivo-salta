"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, ClipboardPlus, Gauge, UserRound } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { EvolutionChart } from "@/components/evolution-chart";
import type { Atributo, Medicion } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface FichaSecretaria {
  deportista: { id: string; nombre: string; apellido: string; fechaNacimiento: string | null; sexo: string | null; lateralidad: string | null; grupoId: string; grupo: string; institucion: string; disciplina: string };
  mediciones: Array<{ id: string; fecha: string; valor: number; intento: number; nota: string | null; evaluadoPor: string; atributo: { id: string; codigo: string; nombre: string; unidad: string; sentido: Atributo["sentido"] } | null; protocolo: { id: string; codigo: string; nombre: string } | null }>;
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
  const [serieActiva, setSerieActiva] = useState("");

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

  const series = useMemo(() => {
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
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.protocolo.localeCompare(b.protocolo, "es"));
  }, [ficha]);
  const activa = series.find((serie) => serie.clave === serieActiva) ?? series[0] ?? null;

  if (error) return <AvisoAcceso titulo="No pudimos cargar la ficha" detalle={error} accionHref="/secretaria/deportistas" accionLabel="Volver" />;
  if (!ficha) return <CargandoPelota texto="Cargando ficha y evolución…" />;
  const deportista = ficha.deportista;
  const atributo: Atributo | null = activa ? { id: activa.clave, nombre: `${activa.nombre} · ${activa.protocolo}`, abrev: activa.nombre.slice(0, 3), ambito: "fisico", naturaleza: "objetivo", unidad: activa.unidad, sentido: activa.sentido, escalaMin: Math.min(...activa.mediciones.map((item) => item.valor), 0), escalaMax: Math.max(...activa.mediciones.map((item) => item.valor), 10), descripcion: "", entrenable: false } : null;

  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-5">
        <Link href="/secretaria/deportistas" className="inline-flex w-fit items-center gap-1.5 text-xs font-extrabold text-primary"><ArrowLeft className="size-3.5" />Deportistas</Link>
        <div className="flex items-center gap-3"><AvatarIniciales nombre={deportista.nombre} apellido={deportista.apellido} className="size-14 text-lg" /><div className="min-w-0 flex-1"><h1 className="text-xl font-extrabold">{deportista.nombre} {deportista.apellido}</h1><p className="text-sm text-muted-foreground">{deportista.institucion} · {deportista.disciplina} · {deportista.grupo}</p></div><Link href="/secretaria/medir" className="flex h-10 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-extrabold text-primary-foreground"><ClipboardPlus className="size-4" />Medir</Link></div>

        <div className="grid grid-cols-3 gap-3"><div className="rounded-2xl border border-border bg-card p-4"><Gauge className="size-4 text-primary" /><p className="mt-2 text-2xl font-extrabold">{ficha.mediciones.length}</p><p className="text-[11px] text-muted-foreground">mediciones</p></div><div className="rounded-2xl border border-border bg-card p-4"><CalendarDays className="size-4 text-primary" /><p className="mt-2 text-lg font-extrabold">{ficha.mediciones.length ? fecha(ficha.mediciones[ficha.mediciones.length - 1].fecha) : "—"}</p><p className="text-[11px] text-muted-foreground">última evaluación</p></div><div className="rounded-2xl border border-border bg-card p-4"><UserRound className="size-4 text-primary" /><p className="mt-2 text-lg font-extrabold">{series.length}</p><p className="text-[11px] text-muted-foreground">series comparables</p></div></div>

        {series.length > 0 ? <><section><h2 className="mb-2 text-sm font-extrabold">Evolución por métrica y protocolo</h2><div className="flex gap-2 overflow-x-auto pb-1">{series.map((serie) => <button key={serie.clave} onClick={() => setSerieActiva(serie.clave)} className={cn("shrink-0 rounded-full border px-4 py-2 text-xs font-bold", activa?.clave === serie.clave ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{serie.nombre} · {serie.protocolo}</button>)}</div></section>{activa && atributo && <section className="rounded-3xl border border-border bg-card p-5"><div><h2 className="text-base font-extrabold">{activa.nombre} <span className="text-sm text-muted-foreground">· {activa.protocolo}</span></h2><p className="text-xs text-muted-foreground">Cada protocolo conserva su propia serie; los intentos no se promedian.</p></div><div className="mt-3"><EvolutionChart serie={activa.mediciones} atributo={atributo} /></div><div className="mt-4 divide-y divide-border">{[...activa.filas].reverse().map((medicion) => <div key={medicion.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold">{fecha(medicion.fecha)} · intento {medicion.intento}</p><p className="text-xs text-muted-foreground">Evaluó {medicion.evaluadoPor}</p></div><p className="text-base font-extrabold text-primary">{medicion.valor.toLocaleString("es-AR")} <span className="text-xs text-muted-foreground">{activa.unidad}</span></p></div>)}</div></section>}</> : <section className="rounded-3xl border border-border bg-card p-8 text-center"><p className="text-sm font-extrabold">Todavía no tiene mediciones</p><p className="mt-1 text-xs text-muted-foreground">La evolución aparecerá cuando se registre su primera jornada.</p></section>}
      </div>
    </GuardiaSecretaria>
  );
}
