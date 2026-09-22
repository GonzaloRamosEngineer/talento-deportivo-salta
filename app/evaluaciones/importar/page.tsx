"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  FileSpreadsheet,
  Info,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { CargandoPelota } from "@/components/cargando-pelota";
import { usePerfil } from "@/components/perfil-context";
import { useClub } from "@/lib/use-club";
import { cn } from "@/lib/utils";
import {
  DEMO_SUB13,
  EXTENSIONES_EVALUACION,
  MAX_ARCHIVO_EVALUACION_BYTES,
  importarEvaluacion,
  previsualizarEvaluacion,
  type ContextoEvaluacion,
  type PrevisualizacionEvaluacion,
  type ResultadoImportacion,
} from "@/lib/evaluaciones-importacion";

const DISCIPLINAS = [
  "Atletismo",
  "Fútbol",
  "Gimnasia rítmica",
  "Levantamiento",
  "MMA",
  "Rugby",
  "Vóley",
  "Otra",
];

const PASOS = ["Archivo", "Contexto", "Revisión", "Carga"];

const CONTEXTO_INICIAL: ContextoEvaluacion = {
  institucionOrigen: "",
  disciplina: "",
  grupo: "",
  fechaDeclarada: "",
  evaluadoPor: "",
};

function etiquetaBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function TarjetaResumen({
  valor,
  etiqueta,
}: {
  valor: number;
  etiqueta: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-2xl font-extrabold tracking-tight">{valor}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{etiqueta}</p>
    </div>
  );
}

export default function PaginaImportarEvaluacion() {
  const { perfil, permisos, cargandoSesion, sesionReal } = usePerfil();
  const club = useClub();
  const inputArchivo = useRef<HTMLInputElement>(null);
  const [paso, setPaso] = useState(1);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [contexto, setContexto] = useState(CONTEXTO_INICIAL);
  const [preview, setPreview] = useState<PrevisualizacionEvaluacion | null>(null);
  const [resoluciones, setResoluciones] = useState<Record<string, string>>({});
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);

  const pendientes = useMemo(
    () =>
      preview?.hallazgos.filter(
        (hallazgo) =>
          hallazgo.severidad === "bloqueo" &&
          hallazgo.requiereResolucion &&
          !resoluciones[hallazgo.id],
      ) ?? [],
    [preview, resoluciones],
  );

  if (cargandoSesion || club.cargando) return <CargandoPelota />;

  if (!permisos.opera) {
    return (
      <AvisoAcceso
        titulo="Este perfil no carga evaluaciones"
        detalle="La carga queda en manos del equipo operativo. La Secretaría consulta los resultados agregados desde el observatorio."
        accionHref="/panel"
        accionLabel="Volver al inicio"
      />
    );
  }

  const membresiaRealValida = !sesionReal || Boolean(club.membresia && club.club);

  if (!membresiaRealValida) {
    return (
      <AvisoAcceso
        titulo="Falta asociar tu cuenta"
        detalle="Para cargar datos reales necesitás una membresía operativa en el espacio de la Secretaría."
        accionHref="/panel"
        accionLabel="Volver al inicio"
      />
    );
  }

  function elegirArchivo(seleccionado: File | null) {
    if (!seleccionado) return;
    const nombre = seleccionado.name.toLowerCase();
    const extensionValida = EXTENSIONES_EVALUACION.some((ext) => nombre.endsWith(ext));
    if (!extensionValida) {
      setError("Usá una planilla Excel (.xlsx) o un archivo CSV.");
      return;
    }
    if (seleccionado.size > MAX_ARCHIVO_EVALUACION_BYTES) {
      setError("El archivo supera el máximo de 20 MB.");
      return;
    }
    setArchivo(seleccionado);
    setPreview(null);
    setResultado(null);
    setResoluciones({});
    setError(null);
    setPaso(2);
  }

  function cambiarContexto(campo: keyof ContextoEvaluacion, valor: string) {
    setContexto((actual) => ({ ...actual, [campo]: valor }));
  }

  const contextoCompleto =
    contexto.institucionOrigen.trim() &&
    contexto.disciplina &&
    contexto.grupo.trim() &&
    contexto.evaluadoPor.trim();

  async function revisarArchivo() {
    if (!archivo || !contextoCompleto) return;
    setProcesando(true);
    setError(null);
    try {
      const respuesta = await previsualizarEvaluacion(archivo, contexto);
      setPreview(respuesta);
      setResoluciones({});
      setPaso(3);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos analizar la planilla. Probá nuevamente.",
      );
    } finally {
      setProcesando(false);
    }
  }

  function abrirEjemplo() {
    setArchivo(null);
    setContexto({
      institucionOrigen: "Liga Salteña de Fútbol",
      disciplina: "Fútbol",
      grupo: "SUB13",
      fechaDeclarada: "",
      evaluadoPor: "Equipo de evaluación",
    });
    setPreview(DEMO_SUB13);
    setResoluciones({});
    setResultado(null);
    setError(null);
    setPaso(3);
  }

  async function confirmarCarga() {
    if (!preview || preview.demo || pendientes.length > 0) return;
    setProcesando(true);
    setError(null);
    try {
      const respuesta = await importarEvaluacion(preview.previewToken, {
        hallazgos: resoluciones,
      });
      setResultado(respuesta);
      setPaso(4);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos guardar la evaluación. Ningún dato fue cargado.",
      );
    } finally {
      setProcesando(false);
    }
  }

  if (resultado) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary">
          <CheckCircle2 className="size-8 text-primary" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Evaluación cargada</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Guardamos {resultado.medicionesGuardadas} mediciones en {resultado.jornadasCreadas === 1 ? "1 jornada" : `${resultado.jornadasCreadas} jornadas`} y vinculamos a {resultado.deportistasVinculados} deportistas. El archivo quedó registrado como origen.
        </p>
        <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3 text-left">
          <TarjetaResumen valor={resultado.deportistasCreados} etiqueta="deportistas nuevos" />
          <TarjetaResumen valor={resultado.filasIgnoradas} etiqueta="filas no importadas" />
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setArchivo(null);
              setPreview(null);
              setResultado(null);
              setContexto(CONTEXTO_INICIAL);
              setPaso(1);
            }}
            className="h-11 rounded-xl border border-border bg-card px-5 text-sm font-bold"
          >
            Cargar otro archivo
          </button>
          <Link href="/deportistas" className="flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
            Ver deportistas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={perfil === "secretaria" ? "/secretaria/jornadas" : "/medicion"} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden />
          {perfil === "secretaria" ? "Volver a jornadas" : "Volver a medir"}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Evaluaciones</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Importar una jornada</h1>
            <p className="mt-1 text-sm text-muted-foreground">Convertí una planilla en seguimiento, sin perder el origen ni el protocolo.</p>
          </div>
          <div className="hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary sm:flex">
            <FileSpreadsheet className="size-6 text-primary" aria-hidden />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-card p-2">
        {PASOS.map((nombre, indice) => {
          const numero = indice + 1;
          const activo = numero === paso;
          const completo = numero < paso;
          return (
            <div key={nombre} className={cn("flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-2", activo && "bg-secondary")}>
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold", activo || completo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {completo ? <Check className="size-3" aria-hidden /> : numero}
              </span>
              <span className={cn("hidden truncate text-[11px] font-bold sm:block", !activo && "text-muted-foreground")}>{nombre}</span>
            </div>
          );
        })}
      </div>

      {paso === 1 && (
        <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
          <button
            type="button"
            onClick={() => inputArchivo.current?.click()}
            onDragOver={(evento) => evento.preventDefault()}
            onDrop={(evento) => {
              evento.preventDefault();
              elegirArchivo(evento.dataTransfer.files[0] ?? null);
            }}
            className="flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-primary/25 bg-secondary/30 px-5 py-10 text-center transition-colors hover:border-primary/50 hover:bg-secondary/60"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Upload className="size-5" aria-hidden />
            </span>
            <span className="mt-4 text-base font-extrabold">Elegí o arrastrá la planilla</span>
            <span className="mt-1 text-xs text-muted-foreground">Excel o CSV · hasta 20 MB · el archivo no se carga hasta que confirmes</span>
          </button>
          <input
            ref={inputArchivo}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            onChange={(evento) => elegirArchivo(evento.target.files?.[0] ?? null)}
          />

          <div className="my-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            o recorré el caso recibido
            <span className="h-px flex-1 bg-border" />
          </div>
          <button type="button" onClick={abrirEjemplo} className="flex w-full items-center justify-between rounded-2xl border border-border px-4 py-3.5 text-left transition-colors hover:bg-muted/60">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning"><ShieldCheck className="size-4" aria-hidden /></span>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold">Ver ejemplo SUB13 anonimizado</span>
                <span className="block truncate text-xs text-muted-foreground">La estructura real, sin exponer nombres ni valores personales</span>
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </section>
      )}

      {paso === 2 && archivo && (
        <section className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 sm:p-7">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3.5">
            <FileCheck2 className="size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{archivo.name}</p>
              <p className="text-xs text-muted-foreground">{etiquetaBytes(archivo.size)}</p>
            </div>
            <button type="button" onClick={() => { setArchivo(null); setPaso(1); }} className="text-xs font-bold text-primary">Cambiar</button>
          </div>

          <div>
            <h2 className="text-base font-extrabold">Dale contexto a la jornada</h2>
            <p className="mt-1 text-xs text-muted-foreground">Estos datos no siempre vienen claros en Excel y son los que después permiten filtrar y comparar.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-bold">Institución de origen
              <input value={contexto.institucionOrigen} onChange={(e) => cambiarContexto("institucionOrigen", e.target.value)} placeholder="Ej. Liga Salteña de Fútbol" className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-bold">Disciplina
              <select value={contexto.disciplina} onChange={(e) => cambiarContexto("disciplina", e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus:border-primary">
                <option value="">Elegir disciplina</option>
                {DISCIPLINAS.map((disciplina) => <option key={disciplina}>{disciplina}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-bold">Grupo o categoría
              <input value={contexto.grupo} onChange={(e) => cambiarContexto("grupo", e.target.value)} placeholder="Ej. SUB13" className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-bold">Fecha, si está confirmada <span className="font-normal text-muted-foreground">(opcional)</span>
              <input type="date" value={contexto.fechaDeclarada} onChange={(e) => cambiarContexto("fechaDeclarada", e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-bold sm:col-span-2">Quién realizó la evaluación
              <input value={contexto.evaluadoPor} onChange={(e) => cambiarContexto("evaluadoPor", e.target.value)} placeholder="Nombre del profesional o equipo" className="h-11 rounded-xl border border-input bg-background px-3 text-sm font-medium outline-none focus:border-primary" />
              <span className="font-normal text-muted-foreground">Puede ser distinto de la persona que carga la planilla.</span>
            </label>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-secondary/40 p-3.5 text-xs leading-relaxed">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p><strong>El espacio de trabajo se toma de tu sesión.</strong> No se elige desde la planilla y el servidor vuelve a validar tu acceso antes de guardar.</p>
          </div>

          <button type="button" disabled={!contextoCompleto || procesando} onClick={revisarArchivo} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground disabled:opacity-50">
            {procesando ? <><Loader2 className="size-4 animate-spin" aria-hidden />Analizando planilla…</> : <>Revisar antes de cargar<ChevronRight className="size-4" aria-hidden /></>}
          </button>
        </section>
      )}

      {paso === 3 && preview && (
        <div className="flex flex-col gap-4">
          {preview.demo && (
            <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-secondary/50 p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div><p className="text-sm font-extrabold">Vista anonimizada del archivo recibido</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Podés resolver las observaciones y recorrer toda la revisión. Esta muestra no guarda datos.</p></div>
            </div>
          )}

          <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate text-base font-extrabold">{preview.archivo.nombre}</p><p className="mt-0.5 text-xs text-muted-foreground">{contexto.institucionOrigen} · {contexto.disciplina} · {contexto.grupo}</p></div>
              <button type="button" onClick={() => { setPreview(null); setPaso(1); }} className="text-xs font-bold text-primary">Empezar de nuevo</button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TarjetaResumen valor={preview.resumen.deportistas} etiqueta="deportistas" />
              <TarjetaResumen valor={preview.resumen.medicionesValidas} etiqueta="mediciones válidas" />
              <TarjetaResumen valor={preview.resumen.duplicados} etiqueta="duplicados" />
              <TarjetaResumen valor={preview.resumen.filasIgnoradas} etiqueta="filas separadas" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {preview.protocolos.map((protocolo) => <span key={protocolo} className="rounded-full bg-secondary px-3 py-1 text-xs font-extrabold text-secondary-foreground">{protocolo}</span>)}
              {preview.metricas.map((metrica) => <span key={metrica} className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted-foreground">{metrica}</span>)}
            </div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden /><div><h2 className="text-base font-extrabold">Decisiones antes de cargar</h2><p className="mt-0.5 text-xs text-muted-foreground">Nada ambiguo entra en silencio. Los bloqueos requieren una respuesta.</p></div></div>
            <div className="mt-4 flex flex-col gap-3">
              {preview.hallazgos.map((hallazgo) => {
                const Icono = hallazgo.severidad === "bloqueo" ? AlertTriangle : hallazgo.severidad === "advertencia" ? CircleAlert : Info;
                return (
                  <div key={hallazgo.id} className={cn("rounded-2xl border p-4", hallazgo.severidad === "bloqueo" ? "border-destructive/25 bg-destructive/5" : hallazgo.severidad === "advertencia" ? "border-warning/25 bg-warning-soft/40" : "border-border bg-muted/30")}>
                    <div className="flex items-start gap-3"><Icono className={cn("mt-0.5 size-4 shrink-0", hallazgo.severidad === "bloqueo" ? "text-destructive" : hallazgo.severidad === "advertencia" ? "text-warning" : "text-muted-foreground")} aria-hidden /><div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{hallazgo.titulo}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hallazgo.detalle}</p></div></div>
                    {hallazgo.opciones && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {hallazgo.opciones.map((opcion) => (
                          <label key={opcion.valor} className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl border bg-background p-3", resoluciones[hallazgo.id] === opcion.valor ? "border-primary ring-2 ring-primary/10" : "border-border")}>
                            <input type="radio" name={hallazgo.id} value={opcion.valor} checked={resoluciones[hallazgo.id] === opcion.valor} onChange={() => setResoluciones((actual) => ({ ...actual, [hallazgo.id]: opcion.valor }))} className="mt-1 accent-primary" />
                            <span>
                              <span className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold">
                                {opcion.etiqueta}
                                {opcion.recomendada && (
                                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-primary">
                                    Recomendada
                                  </span>
                                )}
                              </span>
                              {opcion.detalle && <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{opcion.detalle}</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-2"><Users className="size-4 text-primary" aria-hidden /><h2 className="text-sm font-extrabold">Deportistas detectados</h2></div><span className="text-xs font-semibold text-muted-foreground">muestra de {preview.deportistas.length}</span></div>
            <div className="divide-y divide-border">
              {preview.deportistas.map((deportista) => <div key={deportista.id} className="flex items-center gap-3 px-5 py-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-extrabold text-primary">{deportista.etiqueta.slice(-2)}</span><p className="min-w-0 flex-1 truncate text-sm font-bold">{deportista.etiqueta}</p><span className="text-xs text-muted-foreground">{deportista.mediciones} mediciones</span><CheckCircle2 className="size-4 shrink-0 text-primary" aria-label="Listo" /></div>)}
            </div>
          </section>

          <div className="sticky bottom-20 z-20 rounded-2xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-4">
            {preview.demo ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">La muestra termina acá.</strong> Para cargar, elegí el archivo real y entrá con una cuenta operativa.</p><button type="button" onClick={() => { setPreview(null); setPaso(1); }} className="h-10 shrink-0 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground">Elegir archivo real</button></div>
            ) : (
              <button type="button" disabled={pendientes.length > 0 || procesando} onClick={confirmarCarga} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground disabled:opacity-50">{procesando ? <><Loader2 className="size-4 animate-spin" aria-hidden />Guardando…</> : pendientes.length > 0 ? `Resolvé ${pendientes.length} bloqueo${pendientes.length === 1 ? "" : "s"}` : <>Confirmar y cargar {preview.resumen.medicionesValidas} mediciones<ChevronRight className="size-4" aria-hidden /></>}</button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /><p>{error}</p>
        </div>
      )}
    </div>
  );
}
