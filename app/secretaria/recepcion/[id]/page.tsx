"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Download, FileSpreadsheet, Loader2, ShieldCheck } from "lucide-react";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { CargandoPelota } from "@/components/cargando-pelota";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";

interface Recepcion {
  id: string;
  numeroSeguimiento: string;
  archivo: string;
  contexto: { institucionOrigen?: string; disciplina?: string; grupo?: string; evaluadoPor?: string; fechaDeclarada?: string };
  estado: string;
  etiquetaEstado: string;
  motivo?: string | null;
  enviadoPor?: string;
  recibidaEn: string;
  retenerHasta?: string;
  archivoDisponible: boolean;
  notasRevision?: string | null;
}

function fecha(valor?: string) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(valor));
}

export default function DetalleRecepcionManual() {
  const { id } = useParams<{ id: string }>();
  const [recepcion, setRecepcion] = useState<Recepcion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => {
      fetch(`/api/secretaria/recepcion/${id}`, { signal: controlador.signal, cache: "no-store" })
        .then(async (respuesta) => {
          const cuerpo = await respuesta.json() as Recepcion & { error?: string };
          if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos abrir la recepción.");
          return cuerpo;
        })
        .then(setRecepcion)
        .catch((causa: unknown) => {
          if (causa instanceof DOMException && causa.name === "AbortError") return;
          setError(causa instanceof Error ? causa.message : "No pudimos abrir la recepción.");
        });
    }, 0);
    return () => { window.clearTimeout(temporizador); controlador.abort(); };
  }, [id]);

  async function descargar() {
    setDescargando(true); setError(null);
    try {
      const respuesta = await fetch(`/api/secretaria/recepcion/${id}?descarga=1`);
      const cuerpo = await respuesta.json() as { urlDescarga?: string; error?: string };
      if (!respuesta.ok || !cuerpo.urlDescarga) throw new Error(cuerpo.error ?? "No pudimos preparar el archivo.");
      window.location.assign(cuerpo.urlDescarga);
    } catch (causa) { setError(causa instanceof Error ? causa.message : "No pudimos descargar el archivo."); }
    finally { setDescargando(false); }
  }

  if (error && !recepcion) return <AvisoAcceso titulo="No pudimos abrir la recepción" detalle={error} accionHref="/secretaria/jornadas" accionLabel="Volver a planillas"/>;
  if (!recepcion) return <CargandoPelota texto="Cargando planilla recibida…"/>;

  return <GuardiaSecretaria><div className="mx-auto flex max-w-4xl flex-col gap-5">
    <Link href="/secretaria/jornadas" className="inline-flex w-fit items-center gap-1.5 text-xs font-extrabold text-primary"><ArrowLeft className="size-3.5"/>Planillas</Link>
    <section className="rounded-2xl border border-warning/30 bg-card p-4 sm:rounded-3xl sm:p-6">
      <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"><FileSpreadsheet className="size-5"/></span><div className="min-w-0 flex-1"><p className="text-[10px] font-extrabold uppercase tracking-widest text-warning">Recepción manual · {recepcion.numeroSeguimiento}</p><h1 className="mt-1 break-words text-xl font-extrabold">{recepcion.archivo}</h1><p className="mt-1 text-sm text-muted-foreground">{recepcion.contexto.institucionOrigen} · {recepcion.contexto.disciplina} · {recepcion.contexto.grupo}</p></div><span className="rounded-full bg-warning-soft px-2.5 py-1 text-[10px] font-extrabold text-warning">{recepcion.etiquetaEstado}</span></div>
      <div className="mt-5 rounded-2xl bg-secondary/50 p-4"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary"/><div><h2 className="text-sm font-extrabold">Todavía no se importaron datos</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">El archivo no pudo procesarse automáticamente. Secretaría revisará sus hojas y comprobará deportistas, pruebas y valores antes de incorporarlos.</p></div></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Recibida</p><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><CalendarDays className="size-3.5 text-primary"/>{fecha(recepcion.recibidaEn)}</p></div><div className="rounded-xl border border-border p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Enviado por</p><p className="mt-1 text-sm font-semibold">{recepcion.enviadoPor || "Cuenta de Secretaría"}</p></div></div>
      {recepcion.motivo && <div className="mt-3 rounded-xl border border-border p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Nota al recibir</p><p className="mt-1 text-sm">{recepcion.motivo}</p></div>}
      {recepcion.notasRevision && <div className="mt-3 rounded-xl border border-border p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Nota de revisión</p><p className="mt-1 text-sm">{recepcion.notasRevision}</p></div>}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] text-muted-foreground">{recepcion.archivoDisponible ? `El original se conserva hasta ${fecha(recepcion.retenerHasta)} según la política de retención.` : "El original ya no está disponible; se conserva el registro de recepción."}</p>{recepcion.archivoDisponible && <button type="button" onClick={() => void descargar()} disabled={descargando} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground disabled:opacity-60">{descargando ? <Loader2 className="size-4 animate-spin"/> : <Download className="size-4"/>}Descargar original</button>}</div>
      {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">{error}</p>}
    </section>
  </div></GuardiaSecretaria>;
}
