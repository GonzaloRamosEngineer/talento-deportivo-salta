"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Inbox, LoaderCircle, X } from "lucide-react";
import { PRESIONABLE } from "@/components/secretaria/presionable";
import { cn } from "@/lib/utils";

interface FilaManual {
  id: string;
  fila: number;
  motivo: string;
  datos: { nombre?: string; apellido?: string | null; hoja?: string; columnasIlegibles?: string[] } & Record<string, unknown>;
  estado: string;
  resueltoEn: string | null;
  resolucion: { tipo?: string; motivo?: string; jornada_id?: string } | null;
  resueltoPor: string | null;
}

const MOTIVO: Record<string, string> = {
  sin_fecha: "Sin fecha",
  sin_nombre: "Sin nombre",
  valor_ilegible: "Valor ilegible",
  protocolo_desconocido: "Protocolo desconocido",
};

/**
 * Filas de una planilla importada que quedaron para carga manual. Se cierran
 * de a una: "ya la cargué" (en qué jornada) o "descartar" (con motivo). Nada
 * se cierra solo: es la contracara de no haber descartado nada al importar.
 */
export function FilasCargaManual({ loteId, jornadas }: {
  loteId: string;
  /** jornadas donde se pudo haber cargado la fila (las del mismo plantel) */
  jornadas: Array<{ id: string; etiqueta: string }>;
}) {
  const [filas, setFilas] = useState<FilaManual[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<{ id: string; modo: "cargada" | "descartada" } | null>(null);
  const [jornadaId, setJornadaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const respuesta = await fetch(`/api/secretaria/planillas/${loteId}/filas-pendientes`, { cache: "no-store" });
      const cuerpo = await respuesta.json() as { filas?: FilaManual[]; error?: string };
      if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos cargar las filas pendientes.");
      setFilas(cuerpo.filas ?? []);
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No pudimos cargar las filas pendientes.");
    }
  }, [loteId]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => { void cargar(); }, 0);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  async function cerrar(id: string) {
    if (!abierta) return;
    setOcupado(true); setError(null);
    try {
      const cuerpo = abierta.modo === "cargada" ? { tipo: "cargada", jornadaId } : { tipo: "descartada", motivo: motivo.trim() };
      const respuesta = await fetch(`/api/secretaria/filas-pendientes/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo),
      });
      const resultado = await respuesta.json() as { error?: string };
      if (!respuesta.ok) throw new Error(resultado.error ?? "No pudimos cerrar la fila.");
      setAbierta(null); setJornadaId(""); setMotivo("");
      await cargar();
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : "No pudimos cerrar la fila.");
    } finally {
      setOcupado(false);
    }
  }

  if (filas === null && !error) {
    return <section className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground sm:rounded-3xl sm:p-5"><LoaderCircle className="mr-2 inline size-4 animate-spin" aria-hidden />Cargando las filas para carga manual…</section>;
  }
  if (!filas?.length && !error) return null;

  const abiertas = (filas ?? []).filter((f) => f.estado === "pendiente");
  const cerradas = (filas ?? []).filter((f) => f.estado !== "pendiente");
  const campo = "w-full rounded-xl border border-input bg-background px-3 text-base sm:text-sm";

  return (
    <section className="rounded-2xl border border-warning/40 bg-card p-4 sm:rounded-3xl sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning"><Inbox className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold">
            {abiertas.length > 0
              ? `${abiertas.length} ${abiertas.length === 1 ? "fila espera" : "filas esperan"} carga manual`
              : "Filas de carga manual cerradas"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            El resto de la planilla ya se importó. Cargá estas filas a mano —por ejemplo desde{" "}
            <Link href="/secretaria/medir" className="font-bold text-primary underline-offset-2 hover:underline">Medir</Link>
            {"— y marcá en qué jornada quedaron, o descartalas con el motivo."}
          </p>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}

      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {abiertas.map((fila) => {
          const nombre = [fila.datos.apellido, fila.datos.nombre].filter(Boolean).join(", ") || "(sin nombre)";
          const estaAbierta = abierta?.id === fila.id;
          return (
            <li key={fila.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{nombre}</p>
                  <p className="text-xs text-muted-foreground">{`Fila ${fila.fila}${fila.datos.hoja ? ` · ${fila.datos.hoja}` : ""}${fila.datos.columnasIlegibles?.length ? ` · ilegible: ${fila.datos.columnasIlegibles.join(", ")}` : ""}`}</p>
                </div>
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning">{MOTIVO[fila.motivo] ?? fila.motivo}</span>
              </div>
              {!estaAbierta && (
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => { setAbierta({ id: fila.id, modo: "cargada" }); setJornadaId(jornadas[0]?.id ?? ""); }} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-extrabold sm:min-h-9 ${PRESIONABLE}`}><Check className="size-3.5" aria-hidden />Ya la cargué</button>
                  <button type="button" onClick={() => setAbierta({ id: fila.id, modo: "descartada" })} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-extrabold text-muted-foreground sm:min-h-9 ${PRESIONABLE}`}><X className="size-3.5" aria-hidden />Descartar</button>
                </div>
              )}
              {estaAbierta && (
                <div className="mt-3 flex flex-col gap-2 rounded-xl bg-muted/40 p-3 sm:flex-row sm:items-end">
                  {abierta.modo === "cargada" ? (
                    <label className="min-w-0 flex-1 text-xs font-bold">¿En qué jornada la cargaste?
                      <select value={jornadaId} onChange={(e) => setJornadaId(e.target.value)} className={cn(campo, "mt-1 h-11 font-normal")}>
                        {jornadas.length === 0 && <option value="">No hay jornadas de este plantel</option>}
                        {jornadas.map((j) => <option key={j.id} value={j.id}>{j.etiqueta}</option>)}
                      </select>
                    </label>
                  ) : (
                    <label className="min-w-0 flex-1 text-xs font-bold">¿Por qué se descarta?
                      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} placeholder="Ej.: el club confirmó que es una fila de prueba" className={cn(campo, "mt-1 h-11 font-normal")} />
                    </label>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAbierta(null)} className="min-h-11 rounded-xl px-3 text-xs font-bold text-muted-foreground">Cancelar</button>
                    <button
                      type="button"
                      onClick={() => void cerrar(fila.id)}
                      disabled={ocupado || (abierta.modo === "cargada" ? !jornadaId : motivo.trim().length < 3)}
                      className={`min-h-11 rounded-xl bg-primary px-4 text-xs font-extrabold text-primary-foreground disabled:opacity-45 ${PRESIONABLE}`}
                    >
                      {ocupado ? "Guardando…" : abierta.modo === "cargada" ? "Marcar como cargada" : "Descartar fila"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {abiertas.length === 0 && <li className="p-3 text-xs text-muted-foreground">No queda ninguna fila por cargar.</li>}
      </ul>

      {cerradas.length > 0 && (
        <details className="group mt-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-xs font-bold text-primary sm:min-h-8">{`${cerradas.length} ${cerradas.length === 1 ? "cerrada" : "cerradas"}`}<span className="group-open:hidden">{" · ver"}</span></summary>
          <ul className="divide-y divide-border text-xs">
            {cerradas.map((fila) => (
              <li key={fila.id} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0"><span className="font-bold">{[fila.datos.apellido, fila.datos.nombre].filter(Boolean).join(", ") || "(sin nombre)"}</span><span className="block text-muted-foreground">{fila.resolucion?.tipo === "descartada" ? `Descartada: ${fila.resolucion.motivo ?? ""}` : "Cargada a mano"}{fila.resueltoPor ? ` · ${fila.resueltoPor}` : ""}</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
