"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, Info, ShieldCheck } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { ResultadosPlanilla, type ResultadoPlanilla } from "@/components/secretaria/resultados-planilla";
import { RevisionPlanilla } from "@/components/secretaria/revision-planilla";
import { FilasCargaManual } from "@/components/secretaria/filas-carga-manual";
import { useSecretaria } from "@/lib/use-secretaria";

interface DetalleLote {
  loteId: string;
  archivo: string;
  estado: string;
  contexto: { institucionOrigen?: string; disciplina?: string; grupo?: string; fechaDeclarada?: string; evaluadoPor?: string };
  recibidoEn: string;
  confirmadoEn: string | null;
  filasIgnoradas: number;
  duplicados: number;
  bloqueosPendientes: number;
  deportistas: number;
  mediciones: number;
  protocolos: string[];
  metricas: Array<{ codigo: string; nombre: string; unidad: string | null; cantidad: number | null }>;
  hallazgos: Array<{ id: string; titulo?: string; detalle?: string; severidad?: string }>;
  correcciones: Array<{ campo: string; antes: unknown; despues: unknown; motivo: string; por: string; cuando: string }>;
  jornadas: Array<{ id: string; fecha: string; grupo: string; evaluadoPor: string; mediciones: number }>;
  resultados: ResultadoPlanilla[];
}

function fecha(valor?: string | null) {
  if (!valor) return "Sin fecha confirmada";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(valor));
}

export default function DetallePlanillaSecretaria() {
  const { id } = useParams<{ id: string }>();
  const [detalle, setDetalle] = useState<DetalleLote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmada, setConfirmada] = useState(false);
  const { resumen: resumenSecretaria } = useSecretaria();
  const [original, setOriginal] = useState<{ guardado: boolean; descargando: boolean; error: string | null }>({ guardado: false, descargando: false, error: null });

  // Solo se ofrece la descarga si el original está guardado (las planillas
  // anteriores a que se guardaran no lo tienen, o ya se purgó).
  useEffect(() => {
    const controlador = new AbortController();
    fetch(`/api/secretaria/planillas/${id}/revision`, { signal: controlador.signal, cache: "no-store" })
      .then((respuesta) => respuesta.ok ? respuesta.json() : null)
      .then((cuerpo: { archivoGuardado?: boolean } | null) => setOriginal((actual) => ({ ...actual, guardado: Boolean(cuerpo?.archivoGuardado) })))
      .catch(() => undefined);
    return () => controlador.abort();
  }, [id]);

  async function descargarOriginal() {
    setOriginal((actual) => ({ ...actual, descargando: true, error: null }));
    try {
      const respuesta = await fetch(`/api/secretaria/planillas/${id}/original`, { cache: "no-store" });
      const cuerpo = await respuesta.json() as { urlDescarga?: string; error?: string };
      if (!respuesta.ok || !cuerpo.urlDescarga) throw new Error(cuerpo.error ?? "No pudimos preparar la descarga.");
      window.location.assign(cuerpo.urlDescarga);
      setOriginal((actual) => ({ ...actual, descargando: false }));
    } catch (causa) {
      setOriginal((actual) => ({ ...actual, descargando: false, error: causa instanceof Error ? causa.message : "No pudimos descargar el archivo." }));
    }
  }

  const recargarDetalle = () => {
    fetch(`/api/secretaria/planillas/${id}`, { cache: "no-store" })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos actualizar la planilla.");
        return cuerpo as DetalleLote;
      })
      .then(setDetalle)
      .catch((causa: unknown) => setError(causa instanceof Error ? causa.message : "No pudimos actualizar la planilla."));
  };

  useEffect(() => {
    const controlador = new AbortController();
    fetch(`/api/secretaria/planillas/${id}`, { signal: controlador.signal })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos abrir la planilla.");
        return cuerpo as DetalleLote;
      })
      .then(setDetalle)
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === "AbortError") return;
        setError(causa instanceof Error ? causa.message : "No pudimos abrir la planilla.");
      });
    return () => controlador.abort();
  }, [id]);

  if (error) return <AvisoAcceso titulo="No pudimos abrir la planilla" detalle={error} accionHref="/secretaria/jornadas" accionLabel="Volver a planillas" />;
  if (!detalle) return <CargandoPelota texto="Reconstruyendo la planilla…" />;

  const importada = detalle.estado === "importado";
  const enRevision = detalle.estado === "previsualizado";
  const titulo = [detalle.contexto.institucionOrigen, detalle.contexto.grupo].filter(Boolean).join(" · ") || detalle.archivo;
  const estado = importada
    ? { texto: "Importada", clase: "bg-secondary text-primary" }
    : enRevision && detalle.bloqueosPendientes > 0
      ? { texto: "Necesita decisión", clase: "bg-destructive/10 text-destructive" }
      : enRevision
        ? { texto: "Lista para confirmar", clase: "bg-warning-soft text-warning" }
        : { texto: detalle.estado, clase: "bg-muted text-muted-foreground" };
  const cuando = importada && detalle.confirmadoEn ? `Importada el ${fecha(detalle.confirmadoEn)}` : `Recibida el ${fecha(detalle.recibidoEn)}`;
  const calidad = [
    detalle.duplicados > 0 && `${detalle.duplicados} ${detalle.duplicados === 1 ? "valor repetido" : "valores repetidos"} en el archivo`,
    detalle.filasIgnoradas > 0 && `${detalle.filasIgnoradas} ${detalle.filasIgnoradas === 1 ? "fila que no se importa" : "filas que no se importan"}`,
  ].filter(Boolean) as string[];

  const jornadasVisibles = detalle.jornadas.slice(0, 3);
  const jornadasOcultas = detalle.jornadas.slice(3);
  const filaJornada = (jornada: DetalleLote["jornadas"][number]) => (
    <li key={jornada.id} className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0"><p className="text-sm font-bold">{fecha(jornada.fecha)} · {jornada.grupo}</p><p className="truncate text-xs text-muted-foreground">Evaluó {jornada.evaluadoPor}</p></div>
      <span className="shrink-0 text-xs font-extrabold tabular-nums text-primary">{jornada.mediciones} mediciones</span>
    </li>
  );

  const trazabilidad = (detalle.hallazgos.length > 0 || detalle.correcciones.length > 0) && (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 sm:min-h-8"><ShieldCheck className="size-4 text-primary" aria-hidden /><span className="flex-1 text-sm font-extrabold">Trazabilidad</span><span className="text-[11px] font-bold text-muted-foreground">{`${detalle.hallazgos.length + detalle.correcciones.length} registros`}<span className="group-open:hidden"> · ver</span></span></summary>
      <div className="mt-3 space-y-3">{detalle.hallazgos.map((hallazgo) => <div key={hallazgo.id} className="rounded-2xl bg-muted/50 p-3"><p className="text-xs font-extrabold">{hallazgo.titulo ?? hallazgo.id}</p><p className="mt-1 text-xs text-muted-foreground">{hallazgo.detalle}</p></div>)}{detalle.correcciones.map((correccion, indice) => <div key={`${correccion.campo}-${indice}`} className="flex gap-3 rounded-2xl border border-border p-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /><div><p className="text-xs font-extrabold">{correccion.campo} corregido por {correccion.por}</p><p className="mt-1 text-xs text-muted-foreground">{correccion.motivo} · {fecha(correccion.cuando)}</p></div></div>)}</div>
    </details>
  );

  // Con decisiones pendientes el resumen es una columna angosta al costado;
  // sin decisiones, es la card principal y lleva adentro las jornadas y la
  // trazabilidad (la misma historia: qué entró, cuándo y quién lo tocó).
  const resumen = (principal: boolean) => (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-5">
      <h2 className="text-sm font-extrabold">{importada ? "Lo que se incorporó" : "Lo que se va a incorporar"}</h2>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
        {[
          [detalle.deportistas, detalle.deportistas === 1 ? "deportista" : "deportistas"],
          [detalle.mediciones, detalle.mediciones === 1 ? "medición" : "mediciones"],
          ...(principal && detalle.jornadas.length > 0 ? [[detalle.jornadas.length, detalle.jornadas.length === 1 ? "jornada" : "jornadas"]] : []),
        ].map(([valor, etiqueta]) => (
          <div key={String(etiqueta)} className="flex items-baseline gap-1.5">
            <dt className="text-sm font-bold text-muted-foreground">{String(etiqueta)}</dt>
            <dd className="order-first text-2xl font-extrabold tabular-nums tracking-tight">{Number(valor).toLocaleString("es-AR")}</dd>
          </div>
        ))}
      </dl>
      {calidad.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-muted/50 p-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{`${calidad.join(" · ")}.`}</span>
        </p>
      )}
      {principal && detalle.jornadas.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{detalle.jornadas.length === 1 ? "Jornada producida" : "Jornadas producidas"}</h3>
          <ul className="mt-1 divide-y divide-border">{jornadasVisibles.map(filaJornada)}</ul>
          {jornadasOcultas.length > 0 && (
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center text-xs font-extrabold text-primary group-open:hidden sm:min-h-8">{`Ver las ${detalle.jornadas.length} jornadas`}</summary>
              <ul className="divide-y divide-border border-t border-border">{jornadasOcultas.map(filaJornada)}</ul>
            </details>
          )}
        </div>
      )}
      {principal && trazabilidad && <div className="mt-auto border-t border-border pt-3">{trazabilidad}</div>}
    </section>
  );

  const queSeMidio = (dosColumnas: boolean) => (
    <section className="rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-5">
      <h2 className="text-sm font-extrabold">Qué se midió</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Cada protocolo se conserva por separado. El número es la cantidad de registros válidos de cada métrica.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{detalle.protocolos.length ? detalle.protocolos.map((protocolo) => <span key={protocolo} className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-extrabold text-primary-foreground">{protocolo}</span>) : <span className="text-xs text-muted-foreground">Sin protocolo confirmado</span>}</div>
      <ul className={`mt-3 grid gap-px overflow-hidden rounded-xl border border-border bg-border ${dosColumnas ? "sm:grid-cols-2" : ""}`}>
        {detalle.metricas.map((metrica) => <li key={metrica.codigo} className="flex items-center justify-between gap-2 bg-card px-3 py-2 text-xs"><span className="min-w-0"><span className="font-bold first-letter:uppercase">{metrica.nombre}</span> <span className="text-muted-foreground">{metrica.unidad || "sin unidad"}</span></span>{metrica.cantidad !== null && <strong className="shrink-0 tabular-nums text-primary">{metrica.cantidad}</strong>}</li>)}
        {dosColumnas && detalle.metricas.length % 2 === 1 && <li aria-hidden className="hidden bg-card sm:block" />}
      </ul>
    </section>
  );

  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-4 sm:gap-5">
        <div>
          <Link href="/secretaria/jornadas" className="-ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-extrabold text-primary sm:min-h-8 sm:text-xs"><ArrowLeft className="size-4 sm:size-3.5" aria-hidden />Planillas</Link>
          <p className="mt-2 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{detalle.contexto.disciplina ?? "Evaluación"}</p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <h1 className="min-w-0 text-2xl font-extrabold tracking-tight">{titulo}</h1>
            <span className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${estado.clase}`}>{estado.texto}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="min-w-0 break-words text-sm text-muted-foreground">{`${detalle.archivo} · ${cuando}`}</p>
            {original.guardado && (
              <button type="button" onClick={() => void descargarOriginal()} disabled={original.descargando} className="-ml-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-xs font-extrabold text-primary disabled:opacity-50 sm:min-h-8">
                <Download className="size-3.5" aria-hidden />{original.descargando ? "Preparando…" : "Descargar original"}
              </button>
            )}
          </div>
          {original.error && <p role="alert" className="mt-2 text-xs font-semibold text-destructive">{original.error}</p>}
        </div>

        {confirmada && <p role="status" className="rounded-xl bg-secondary px-4 py-3 text-sm font-bold text-primary">Planilla confirmada e importada correctamente.</p>}

        {enRevision ? (
          // Con decisiones: lo que hay que hacer a la izquierda y el resumen
          // fijo a la derecha. Mobile: una columna, las decisiones primero.
          <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <div className="min-w-0">
              <RevisionPlanilla id={id} contextoInicial={detalle.contexto} onConfirmada={() => { setConfirmada(true); recargarDetalle(); }} />
            </div>
            <aside className="flex flex-col gap-4 sm:gap-5 xl:sticky xl:top-6">
              {resumen(false)}
              {queSeMidio(false)}
              {trazabilidad && <div className="rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-5">{trazabilidad}</div>}
            </aside>
          </div>
        ) : (
          // Sin decisiones no hay columna "principal": dos cards parejas.
          // Antes la izquierda quedaba con una jornada y un hueco al lado.
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2 lg:items-stretch">
            {resumen(true)}
            {queSeMidio(true)}
          </div>
        )}

        {importada && (
          <FilasCargaManual
            loteId={id}
            // La fila se pudo haber cargado en una jornada de esta planilla o
            // en una nueva del mismo plantel (por ejemplo, desde Medir).
            jornadas={[
              ...detalle.jornadas.map((j) => ({ id: j.id, fecha: j.fecha, grupo: j.grupo })),
              ...(resumenSecretaria?.jornadas ?? [])
                .filter((j) => j.institucion === detalle.contexto.institucionOrigen && j.grupo === detalle.contexto.grupo && j.disciplina === detalle.contexto.disciplina)
                .map((j) => ({ id: j.id, fecha: j.fecha, grupo: j.grupo })),
            ]
              .filter((j, i, todas) => todas.findIndex((o) => o.id === j.id) === i)
              .sort((a, b) => b.fecha.localeCompare(a.fecha))
              .map((j) => ({ id: j.id, etiqueta: `${fecha(j.fecha)} · ${j.grupo}` }))}
          />
        )}

        <ResultadosPlanilla resultados={detalle.resultados ?? []} />
      </div>
    </GuardiaSecretaria>
  );
}
