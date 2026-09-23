"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, LoaderCircle, Save, ShieldCheck } from "lucide-react";

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
  if (!revision) return <section className="rounded-2xl border border-destructive/30 bg-card p-4"><p className="text-sm font-bold">No pudimos abrir las decisiones pendientes</p><p className="mt-1 text-xs text-muted-foreground">{error}</p><button onClick={() => void cargar()} className="mt-3 rounded-lg border px-3 py-2 text-xs font-bold">Reintentar</button></section>;

  return <section className="scroll-mt-4 rounded-2xl border border-warning/40 bg-card p-4 shadow-sm sm:rounded-3xl sm:p-5" id="resolver-planilla">
    <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"><AlertTriangle className="size-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-extrabold uppercase tracking-widest text-warning">Revisión requerida</p><h2 className="mt-0.5 text-lg font-extrabold">Esta planilla todavía no está importada</h2><p className="mt-1 text-sm text-muted-foreground">Revisá lo que falta, dejá constancia del motivo y confirmá solo cuando las decisiones estén completas.</p></div></div>
    {(!puedeOperar) && <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{revision.vencido ? "La previsualización venció. Volvé a importar el archivo para iniciar una revisión vigente." : "Esta planilla no admite cambios en su estado actual."}</p>}
    {revision.avisos?.length > 0 && <div className="mt-4 space-y-2">{revision.avisos.map((aviso, i) => <div key={aviso.id ?? i} className="rounded-xl bg-muted/50 p-3 text-xs"><strong>{aviso.titulo}</strong><p className="mt-1 text-muted-foreground">{aviso.detalle}</p></div>)}</div>}

    <div className="mt-5 space-y-4">
      {bloqueos.map((bloqueo) => <article key={bloqueo.id} className="rounded-xl border border-border p-3 sm:p-4">
        <div className="flex items-start gap-2"><span className="mt-0.5 text-warning"><AlertTriangle className="size-4" /></span><div><h3 className="text-sm font-extrabold">{bloqueo.id.startsWith("fecha") ? "No encontramos la fecha de esta evaluación" : bloqueo.titulo || "Hay valores que necesitan revisión"}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{bloqueo.id.startsWith("fecha") ? "El archivo no indica qué día se hicieron estas pruebas. Consultá al club o a Secretaría y elegí la fecha real abajo. No adivines: sin la fecha correcta no podemos ubicar las mediciones en la jornada." : bloqueo.detalle || "Cada etiqueta original debe asignarse a un protocolo de esta disciplina o excluirse explícitamente."}</p></div></div>
        {bloqueo.id.startsWith("fecha") && <div className="mt-3 max-w-md"><label className="mb-1 block text-xs font-bold" htmlFor="fecha-oficial">¿Qué día se realizó la evaluación?</label><input id="fecha-oficial" type="date" value={contexto.fechaDeclarada ?? ""} onChange={(e) => setContexto((v) => ({ ...v, fechaDeclarada: e.target.value }))} disabled={!puedeOperar} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" /><p className="mt-1.5 text-[11px] text-muted-foreground">Ingresá la fecha confirmada por quien envió la planilla. Si todavía no la tenés, dejá la revisión pendiente y consultá antes de importar.</p></div>}
        {bloqueo.id === "protocolos-desconocidos" && <>
          {gruposCrudos.length === 0 && <div className="mt-3 rounded-lg bg-warning-soft p-3 text-xs text-warning">Este lote se creó con un lector anterior y no conservó esas filas. Para revisarlas sin perder datos, volvé a adjuntar el archivo original.</div>}
          {gruposCrudos.length > 0 && <div className="mt-3 space-y-2">
            {gruposCrudos.map(({ valor, filas }) => (
              <div key={valor} className="grid gap-3 rounded-xl bg-muted/35 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(190px,0.8fr)] sm:items-center">
                <div className="min-w-0"><p className="text-sm font-extrabold">“{valor || "(vacío)"}” <span className="font-medium text-muted-foreground">· {filas.length} {filas.length === 1 ? "fila" : "filas"}</span></p><p className="mt-1 truncate text-xs text-muted-foreground">{filas.slice(0, 3).map((f) => `${f.nombre}${f.apellido ? ` ${f.apellido}` : ""}`).join(" · ")}{filas.length > 3 ? " · …" : ""}</p></div>
                <select aria-label={`Resolver protocolo ${valor}`} value={selecciones[valor] ?? ""} onChange={(e) => setSelecciones((v) => ({ ...v, [valor]: e.target.value }))} disabled={!puedeOperar} className="h-11 min-w-0 rounded-xl border border-input bg-background px-3 text-sm"><option value="">Elegí protocolo o exclusión…</option>{revision.protocolosDisponibles.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre} ({p.codigo})</option>)}<option value="excluir">Excluir estas filas</option></select>
              </div>
            ))}
          </div>}
            <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />Asignar un protocolo no sobrescribe mediciones existentes: si hay una combinación ya registrada, la confirmación se rechazará. Revisá los resultados de abajo o excluí la fila si corresponde.</p>
            <button type="button" onClick={() => setSelecciones(Object.fromEntries(gruposCrudos.map(({ valor }) => [valor, "excluir"])))} disabled={!puedeOperar} className="mt-2 rounded-lg border border-border px-3 py-2 text-xs font-bold">Excluir todas explícitamente</button>
          </>}
        </article>
      )}
      {bloqueos.filter((b) => b.id !== bloqueoFecha?.id && b.id !== bloqueoProtocolos?.id).map((bloqueo) => <article key={bloqueo.id} className="rounded-xl border border-border p-3"><h3 className="text-sm font-extrabold">{bloqueo.titulo}</h3><p className="mt-1 text-xs text-muted-foreground">{bloqueo.detalle}</p><p className="mt-2 text-xs">Opciones de resolución: {bloqueo.opciones?.map((o) => typeof o === "string" ? o : JSON.stringify(o)).join(" · ") || "Contactá a Secretaría para definir el dato correcto."}</p></article>)}
    </div>

    {bloqueoProtocolos && gruposCrudos.length === 0 && puedeOperar && <form className="mt-4 flex flex-col gap-2 rounded-xl border border-dashed border-border p-3 sm:flex-row sm:items-center" action={(fd) => void reprocesar(fd)}><FileUp className="size-4 shrink-0 text-primary"/><div className="min-w-0 flex-1"><p className="text-xs font-bold">Releer el archivo original</p><p className="text-[11px] text-muted-foreground">Debe ser exactamente el mismo archivo; verificamos su huella antes de actualizar esta previsualización.</p></div><input name="archivo" type="file" required accept=".csv,.xlsx,.xls" className="max-w-full text-xs"/><button disabled={ocupado} className="h-10 shrink-0 rounded-lg bg-secondary px-3 text-xs font-bold">Reprocesar</button></form>}

    <details className="mt-4 rounded-xl border border-border"><summary className="cursor-pointer px-3 py-3 text-xs font-extrabold">Corregir datos del contexto</summary><div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">{CAMPOS_CONTEXTO.map(([key, label]) => <label key={key} className="text-xs font-bold">{label}<input value={contexto[key] ?? ""} onChange={(e) => setContexto((v) => ({ ...v, [key]: e.target.value }))} disabled={!puedeOperar} className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal" /></label>)}</div></details>

    <div className="mt-4"><label htmlFor="motivo-revision" className="mb-1 block text-xs font-extrabold">Motivo de la revisión <span className="font-medium text-muted-foreground">(queda en trazabilidad)</span></label><textarea id="motivo-revision" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} disabled={!puedeOperar} placeholder="Ej.: Secretaría confirmó la fecha oficial y revisamos el bloque de sprint…" className="min-h-20 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm"/><p className="mt-1 text-right text-[10px] text-muted-foreground">{motivo.length}/500</p></div>
    {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}{mensaje && <p role="status" className="mt-3 flex gap-2 rounded-xl bg-secondary p-3 text-sm font-semibold text-primary"><CheckCircle2 className="size-4 shrink-0"/>{mensaje}</p>}
    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => void enviar(false)} disabled={!puedeOperar || ocupado || motivo.trim().length < 3} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-extrabold disabled:opacity-45"><Save className="size-4"/>{ocupado ? "Guardando…" : "Guardar correcciones"}</button><button type="button" onClick={() => void enviar(true)} disabled={!puedeOperar || ocupado || motivo.trim().length < 3 || !bloqueosResueltos} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground disabled:opacity-45"><ShieldCheck className="size-4"/>{ocupado ? "Procesando…" : "Confirmar e importar"}</button></div>
    <p className="mt-2 text-right text-[10px] text-muted-foreground">{bloqueosResueltos ? "Decisiones completas. La importación ocurre únicamente al confirmar." : "La confirmación se habilita cuando completes cada decisión pendiente."}</p>
  </section>;
}
