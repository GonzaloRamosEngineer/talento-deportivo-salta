"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, FileUp, Info, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { PRESIONABLE } from "@/components/secretaria/presionable";
import { cn } from "@/lib/utils";

type FilaSinProtocolo = { fila: number; valorCrudo: string; nombre: string; apellido?: string | null; edad?: string | number | null; valores: Record<string, string | number | null> };
type Protocolo = { codigo: string; nombre: string };
type Bloqueo = { id: string; codigo: string; titulo: string; detalle: string; cantidad?: number; opciones?: unknown[]; resuelto?: boolean; resolucion?: unknown };
type Revision = {
  loteId: string; archivo: string; hash: string; estado: string; vencido: boolean; editable: boolean;
  contexto: Record<string, string | undefined>; resolucionesGuardadas: Record<string, unknown>;
  reprocesadoEn?: string | null; filasSinProtocolo: FilaSinProtocolo[]; protocolosDisponibles: Protocolo[];
  bloqueos: Bloqueo[]; avisos: Array<{ id?: string; titulo?: string; detalle?: string }>;
};

const CAMPOS_CONTEXTO = [
  ["institucionOrigen", "Institución"], ["disciplina", "Disciplina"], ["grupo", "Grupo o plantel"], ["evaluadoPor", "Evaluó"],
] as const;

function agruparFilas(filas: FilaSinProtocolo[]) {
  const grupos = new Map<string, FilaSinProtocolo[]>();
  filas.forEach((fila) => grupos.set(fila.valorCrudo, [...(grupos.get(fila.valorCrudo) ?? []), fila]));
  return [...grupos.entries()].map(([valor, filas]) => ({ valor, filas }));
}

export function RevisionPlanilla({ id, contextoInicial, onConfirmada }: {
  id: string; contextoInicial: Revision["contexto"]; onConfirmada: () => void;
}) {
  const [revision, setRevision] = useState<Revision | null>(null);
  const [contexto, setContexto] = useState<Record<string, string>>({});
  const [selecciones, setSelecciones] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState("");
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [archivoElegido, setArchivoElegido] = useState<string | null>(null);
  const gruposCrudos = useMemo(() => agruparFilas(revision?.filasSinProtocolo ?? []), [revision?.filasSinProtocolo]);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const respuesta = await fetch(`/api/secretaria/planillas/${id}/revision`, { cache: "no-store" });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos cargar las decisiones pendientes.");
      const dato = cuerpo as Revision;
      setRevision(dato);
      const guardadas = dato.resolucionesGuardadas ?? {};
      setContexto({
        ...Object.fromEntries(CAMPOS_CONTEXTO.map(([key]) => [key, dato.contexto?.[key] ?? contextoInicial?.[key] ?? ""])),
        fechaDeclarada: dato.contexto?.fechaDeclarada ?? String(guardadas["fecha-ausente"] ?? ""),
      });
      const previas = guardadas["protocolos-desconocidos"];
      setSelecciones(typeof previas === "object" && previas !== null
        ? Object.fromEntries(Object.entries(previas as Record<string, unknown>).map(([key, val]) => [key, String(val)]))
        : previas === "excluir_todo" ? Object.fromEntries(agruparFilas(dato.filasSinProtocolo ?? []).map(({ valor }) => [valor, "excluir"])) : {});
    } catch (causa) { setError(causa instanceof Error ? causa.message : "No pudimos cargar la revisión."); }
    finally { setCargando(false); }
  }, [id, contextoInicial]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => { void cargar(); }, 0);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  const bloqueos = revision?.bloqueos ?? [];
  const bloqueoFecha = bloqueos.find((b) => b.id.startsWith("fecha"));
  const bloqueoProtocolos = bloqueos.find((b) => b.id === "protocolos-desconocidos");
  const fechaResuelta = Boolean(contexto.fechaDeclarada || revision?.resolucionesGuardadas?.[bloqueoFecha?.id ?? ""]);
  const decisionesCompletas = gruposCrudos.every(({ valor }) => Boolean(selecciones[valor]));
  const bloqueosResueltos = bloqueos.every((b) => b.id === bloqueoFecha?.id ? fechaResuelta : b.id === "protocolos-desconocidos" ? (gruposCrudos.length > 0 && decisionesCompletas) : Boolean(b.resuelto));
  const puedeOperar = Boolean(revision?.editable && !revision.vencido);

  async function enviar(confirmar: boolean) {
    if (!revision) return;
    if (motivo.trim().length < 3) { setError("Indicá el motivo de la corrección (al menos 3 caracteres)."); return; }
    if (confirmar && !bloqueosResueltos) { setError("Todavía falta resolver una o más decisiones."); return; }
    setOcupado(true); setError(null); setMensaje(null);
    const resoluciones: Record<string, unknown> = {};
    if (bloqueoFecha && contexto.fechaDeclarada) resoluciones[bloqueoFecha.id] = contexto.fechaDeclarada;
    if (bloqueoProtocolos && gruposCrudos.length) resoluciones[bloqueoProtocolos.id] = gruposCrudos.every(({ valor }) => selecciones[valor] === "excluir")
      ? "excluir_todo" : Object.fromEntries(gruposCrudos.map(({ valor }) => [valor, selecciones[valor]]));
    const contextoCambios = Object.fromEntries(CAMPOS_CONTEXTO.filter(([key]) => contexto[key]?.trim()).map(([key]) => [key, contexto[key].trim()]));
    try {
      const respuesta = await fetch(`/api/secretaria/planillas/${id}/revision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo: motivo.trim(), contexto: contextoCambios, resoluciones, confirmar }) });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos guardar la revisión.");
      if (cuerpo.confirmado) {
        setMensaje("Planilla confirmada e importada. Las mediciones ya están disponibles en el plantel.");
        onConfirmada();
      } else {
        setRevision(cuerpo.revision as Revision);
        setMensaje("Resoluciones guardadas en la trazabilidad. Todavía no se importó la planilla.");
      }
    } catch (causa) { setError(causa instanceof Error ? causa.message : "No pudimos completar la operación."); }
    finally { setOcupado(false); }
  }

  async function reprocesar(formulario: FormData) {
    setOcupado(true); setError(null); setMensaje(null);
    try {
      const respuesta = await fetch(`/api/secretaria/planillas/${id}/reprocesar`, { method: "POST", body: formulario });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos leer el archivo.");
      await cargar(); setMensaje(`Archivo original releído: ${cuerpo.filasSinProtocolo} filas sin protocolo ahora están disponibles para decidir.`);
    } catch (causa) { setError(causa instanceof Error ? causa.message : "No pudimos reprocesar el archivo."); }
    finally { setOcupado(false); }
  }

  if (cargando) return <section className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground"><LoaderCircle className="mr-2 inline size-4 animate-spin" />Cargando la revisión de esta planilla…</section>;
  if (!revision) return <section className="rounded-2xl border border-destructive/30 bg-card p-4"><p className="text-sm font-bold">No pudimos abrir las decisiones pendientes</p><p className="mt-1 text-xs text-muted-foreground">{error}</p><button onClick={() => void cargar()} className="mt-3 min-h-11 rounded-xl border border-border px-4 text-sm font-bold">Reintentar</button></section>;

  // Estado de cada decisión, con la MISMA regla que habilita la confirmación
  // (bloqueosResueltos): la pantalla no puede decir "resuelta" si el botón
  // sigue deshabilitado.
  const resuelta = (b: Bloqueo) => b.id === bloqueoFecha?.id ? fechaResuelta : b.id === "protocolos-desconocidos" ? (gruposCrudos.length > 0 && decisionesCompletas) : Boolean(b.resuelto);
  const resueltas = bloqueos.filter(resuelta).length;
  const motivoListo = motivo.trim().length >= 3;
  const faltantes = [
    ...bloqueos.filter((b) => !resuelta(b)).map((b) => b.id === bloqueoFecha?.id ? "elegir la fecha" : b.id === "protocolos-desconocidos" ? "resolver los protocolos" : (b.titulo ?? "una decisión").toLocaleLowerCase("es")),
    ...(motivoListo ? [] : ["escribir el motivo"]),
  ];
  const campo = "w-full rounded-xl border border-input bg-background px-3 text-base sm:text-sm disabled:opacity-60";

  return <section className="scroll-mt-4 rounded-2xl border border-warning/40 bg-card p-4 shadow-sm sm:rounded-3xl sm:p-5" id="resolver-planilla">
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"><AlertTriangle className="size-5" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-warning">Antes de importar</p>
        <h2 className="mt-0.5 text-lg font-extrabold leading-snug">
          {bloqueos.length === 0 ? "Revisá y confirmá la planilla" : `${bloqueos.length} ${bloqueos.length === 1 ? "decisión pendiente" : "decisiones pendientes"}`}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Resolvé cada punto, dejá constancia del motivo y confirmá. Nada se importa hasta que confirmes.</p>
      </div>
    </div>

    {bloqueos.length > 0 && (
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-bold">
          <span>{`${resueltas} de ${bloqueos.length} resueltas`}</span>
        </div>
        <div className="mt-1.5 flex gap-1" aria-hidden>
          {bloqueos.map((b) => <span key={b.id} className={cn("h-1.5 flex-1 rounded-full", resuelta(b) ? "bg-primary" : "bg-muted")} />)}
        </div>
      </div>
    )}

    {(!puedeOperar) && <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{revision.vencido ? "La previsualización venció. Volvé a importar el archivo para iniciar una revisión vigente." : "Esta planilla no admite cambios en su estado actual."}</p>}

    <ol className="mt-5 space-y-3">
      {bloqueos.map((bloqueo, indice) => {
        const ok = resuelta(bloqueo);
        const esFecha = bloqueo.id === bloqueoFecha?.id;
        const esProtocolos = bloqueo.id === "protocolos-desconocidos";
        const valores = esProtocolos ? valoresSinProtocolo(bloqueo.detalle) : [];
        const numericos = valores.filter((v) => /^-?\d+([.,]\d+)?$/.test(v)).length;
        return <li key={bloqueo.id} className={cn("rounded-xl border p-3 sm:p-4", ok ? "border-primary/25 bg-secondary/30" : "border-border")}>
          <div className="flex items-start gap-3">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-extrabold", ok ? "border-primary bg-primary text-primary-foreground" : "border-warning text-warning")}>
              {ok ? <Check className="size-3.5" aria-hidden /> : indice + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold leading-snug">
                {esFecha ? "¿Qué día se hizo la evaluación?" : esProtocolos ? "Filas con un protocolo que no reconocemos" : bloqueo.titulo || "Hay valores que necesitan revisión"}
                <span className="sr-only">{ok ? " (resuelta)" : " (pendiente)"}</span>
              </h3>

              {esFecha && <>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">El archivo no trae la fecha. Pedísela a quien envió la planilla: sin la fecha real las mediciones no se pueden ubicar en su jornada. No la adivines.</p>
                <label className="mt-3 block max-w-xs text-xs font-bold" htmlFor="fecha-oficial">Fecha de la evaluación
                  <input id="fecha-oficial" type="date" value={contexto.fechaDeclarada ?? ""} onChange={(e) => setContexto((v) => ({ ...v, fechaDeclarada: e.target.value }))} disabled={!puedeOperar} className={cn(campo, "mt-1 h-12 font-normal")} />
                </label>
              </>}

              {esProtocolos && <>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {`${valores.length} ${valores.length === 1 ? "valor distinto" : "valores distintos"} en la columna de protocolo no coinciden con ningún protocolo de la disciplina.`}
                  {numericos >= valores.length / 2 && numericos > 1 && ` ${numericos} son números, no nombres: puede que en esas filas la columna esté corrida.`}
                </p>
                {valores.length > 0 && (
                  <details className="group mt-2">
                    <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-1.5 text-xs sm:min-h-9">
                      {valores.slice(0, 4).map((v) => <span key={v} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">{v}</span>)}
                      {valores.length > 4 && <span className="font-bold text-primary group-open:hidden">{`y ${valores.length - 4} más`}</span>}
                    </summary>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">{valores.slice(4).map((v) => <span key={v} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">{v}</span>)}</div>
                  </details>
                )}

                {gruposCrudos.length === 0 && <div className="mt-3 rounded-xl bg-warning-soft/60 p-3">
                  <p className="text-xs font-bold text-warning">Esta planilla se leyó con una versión anterior y no guardó esas filas.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Para decidir qué hacer con ellas, volvé a subir el archivo original: tiene que ser exactamente el mismo, verificamos su huella antes de actualizar.</p>
                  {puedeOperar && <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center" action={(fd) => void reprocesar(fd)}>
                    <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-card px-3 text-sm font-bold">
                      <FileUp className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{archivoElegido ?? "Elegir el archivo original"}</span>
                      <input name="archivo" type="file" required accept=".csv,.xlsx,.xls" className="sr-only" onChange={(e) => setArchivoElegido(e.target.files?.[0]?.name ?? null)} />
                    </label>
                    <button disabled={ocupado || !archivoElegido} className={`min-h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground disabled:opacity-45 ${PRESIONABLE}`}>{ocupado ? "Leyendo…" : "Releer archivo"}</button>
                  </form>}
                </div>}

                {gruposCrudos.length > 0 && <>
                  <div className="mt-3 space-y-2">
                    {gruposCrudos.map(({ valor, filas }) => (
                      <div key={valor} className="grid gap-2 rounded-xl bg-muted/35 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(200px,0.8fr)] sm:items-center">
                        <div className="min-w-0"><p className="text-sm font-extrabold">“{valor || "(vacío)"}” <span className="font-medium text-muted-foreground">· {filas.length} {filas.length === 1 ? "fila" : "filas"}</span></p><p className="mt-1 truncate text-xs text-muted-foreground">{filas.slice(0, 3).map((f) => `${f.nombre}${f.apellido ? ` ${f.apellido}` : ""}`).join(" · ")}{filas.length > 3 ? " · …" : ""}</p></div>
                        <select aria-label={`Resolver protocolo ${valor}`} value={selecciones[valor] ?? ""} onChange={(e) => setSelecciones((v) => ({ ...v, [valor]: e.target.value }))} disabled={!puedeOperar} className={cn(campo, "h-12 min-w-0")}><option value="">Elegí protocolo o exclusión…</option>{revision.protocolosDisponibles.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre} ({p.codigo})</option>)}<option value="excluir">Excluir estas filas</option></select>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />Asignar un protocolo no pisa mediciones existentes: si la combinación ya está registrada, la confirmación se rechaza.</p>
                  <button type="button" onClick={() => setSelecciones(Object.fromEntries(gruposCrudos.map(({ valor }) => [valor, "excluir"])))} disabled={!puedeOperar} className="mt-2 min-h-11 rounded-xl border border-border px-4 text-sm font-bold">Excluir todas</button>
                </>}
              </>}

              {!esFecha && !esProtocolos && <>
                <p className="mt-1 text-xs text-muted-foreground">{bloqueo.detalle}</p>
                <p className="mt-2 text-xs">{opcionesLegibles(bloqueo.opciones) || "Contactá a Secretaría para definir el dato correcto."}</p>
              </>}
            </div>
          </div>
        </li>;
      })}
    </ol>

    {revision.avisos?.length > 0 && <div className="mt-4 space-y-2">{revision.avisos.map((aviso, i) => <div key={aviso.id ?? i} className="flex gap-2 rounded-xl bg-muted/50 p-3 text-xs"><Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden /><div><strong>{aviso.titulo}</strong><p className="mt-1 text-muted-foreground">{aviso.detalle}</p></div></div>)}</div>}

    <details className="mt-4 rounded-xl border border-border"><summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm font-extrabold">Corregir datos del contexto</summary><div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">{CAMPOS_CONTEXTO.map(([key, label]) => <label key={key} className="text-xs font-bold">{label}<input value={contexto[key] ?? ""} onChange={(e) => setContexto((v) => ({ ...v, [key]: e.target.value }))} disabled={!puedeOperar} className={cn(campo, "mt-1 h-11 font-normal")} /></label>)}</div></details>

    <div className="mt-4"><label htmlFor="motivo-revision" className="mb-1 block text-xs font-extrabold">Motivo de la revisión <span className="font-medium text-muted-foreground">(queda en la trazabilidad)</span></label><textarea id="motivo-revision" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} disabled={!puedeOperar} placeholder="Ej.: el club confirmó la fecha oficial por WhatsApp." className={cn(campo, "min-h-20 resize-y py-3")}/><p className="mt-1 text-right text-[11px] text-muted-foreground">{motivo.length}/500</p></div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}{mensaje && <p role="status" className="mt-3 flex gap-2 rounded-xl bg-secondary p-3 text-sm font-semibold text-primary"><CheckCircle2 className="size-4 shrink-0"/>{mensaje}</p>}

    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {faltantes.length === 0 ? "Todo listo. La importación ocurre recién al confirmar." : `Para confirmar falta: ${faltantes.join(" · ")}.`}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button type="button" onClick={() => void enviar(false)} disabled={!puedeOperar || ocupado || !motivoListo} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-extrabold disabled:opacity-45 ${PRESIONABLE}`}><Save className="size-4" aria-hidden/>{ocupado ? "Guardando…" : "Guardar sin importar"}</button>
        <button type="button" onClick={() => void enviar(true)} disabled={!puedeOperar || ocupado || !motivoListo || !bloqueosResueltos} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground disabled:opacity-45 ${PRESIONABLE}`}><ShieldCheck className="size-4" aria-hidden/>{ocupado ? "Procesando…" : "Confirmar e importar"}</button>
      </div>
    </div>
  </section>;
}

/** El backend manda los valores sin protocolo como una lista separada por comas. */
function valoresSinProtocolo(detalle?: string) {
  return (detalle ?? "").split(",").map((v) => v.trim()).filter(Boolean);
}

/** Opciones de un bloqueo genérico en texto (antes salían como JSON crudo). */
function opcionesLegibles(opciones?: unknown[]) {
  return (opciones ?? [])
    .map((o) => typeof o === "string" ? o : typeof o === "object" && o !== null && "etiqueta" in o ? String((o as { etiqueta: unknown }).etiqueta) : null)
    .filter(Boolean)
    .join(" · ");
}
