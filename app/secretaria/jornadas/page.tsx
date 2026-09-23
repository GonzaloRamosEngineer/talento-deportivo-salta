"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Archive, CheckCircle2, ChevronRight, Clock, FileSpreadsheet, Inbox, Search, TimerOff } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { PRESIONABLE } from "@/components/secretaria/presionable";
import { GRUPOS_SECRETARIA, type EstadoJornadaSecretaria } from "@/lib/secretaria-demo";
import { useSecretaria } from "@/lib/use-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { Ayuda } from "@/components/ayuda";
import { EstadoVacio } from "@/components/estado-vacio";
import { cn } from "@/lib/utils";

type Filtro = "todas" | "revisar" | "manual" | "lista";

/**
 * Estados de una fila de la bandeja. Además de los de la planilla leída
 * (`EstadoJornadaSecretaria`), la bandeja muestra las que entraron por
 * recepción manual ("manual" mientras esperan, "cerrada" al procesarse,
 * rechazarse o purgarse) y los lotes que ya no se pueden resolver.
 */
type EstadoFila = EstadoJornadaSecretaria | "manual" | "vencida" | "cerrada";

const RECEPCION_ABIERTA = new Set(["PENDIENTE_ARCHIVO", "ERROR_SUBIDA", "RECIBIDA_PARA_REVISION", "EN_REVISION"]);

interface FilaPlanilla {
  id: string;
  institucion: string;
  disciplina: string;
  grupo: string;
  archivo: string;
  estado: EstadoFila;
  href: string;
  /** texto del chip cuando no alcanza con el estado (recepciones, vencidas) */
  etiqueta?: string;
  decisiones?: number;
  /** YYYY-MM-DD para ordenar: la jornada más reciente, o la recepción si todavía no hay jornada */
  fecha?: string;
  /** "Jornada del 27 abr 2026", "8 jornadas · ago – sept 2025" o "Recibida el …" */
  fechaTexto?: string;
}

// Lo que pide acción va siempre primero; dentro de cada estado, la jornada
// más reciente arriba.
const ORDEN: Record<EstadoFila, number> = { revisar: 0, manual: 1, recibida: 2, vencida: 3, lista: 4, cerrada: 5 };

const ESTADO_VISUAL: Record<EstadoFila, { icono: React.ElementType; caja: string; chip: string }> = {
  revisar: { icono: AlertTriangle, caja: "bg-destructive/10 text-destructive", chip: "bg-destructive/10 text-destructive" },
  manual: { icono: Inbox, caja: "bg-warning-soft text-warning", chip: "bg-warning-soft text-warning" },
  recibida: { icono: Clock, caja: "bg-warning-soft text-warning", chip: "bg-warning-soft text-warning" },
  vencida: { icono: TimerOff, caja: "bg-muted text-muted-foreground", chip: "bg-muted text-muted-foreground" },
  lista: { icono: CheckCircle2, caja: "bg-secondary text-primary", chip: "bg-secondary text-primary" },
  cerrada: { icono: Archive, caja: "bg-muted text-muted-foreground", chip: "bg-muted text-muted-foreground" },
};

const MES = new Intl.DateTimeFormat("es-AR", { month: "short" });

function partes(iso: string) {
  // YYYY-MM-DD leído en hora local: el día no se corre por el huso horario.
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { dia: d, mes: MES.format(new Date(a, m - 1, d)).replace(".", ""), anio: a };
}

/** "27 abr 2026" (el formato es-AR mete "de" entre cada parte). */
function fechaCorta(iso: string) {
  const { dia, mes, anio } = partes(iso);
  return `${dia} ${mes} ${anio}`;
}

/** "ago – sept 2025" o "nov 2025 – feb 2026". */
function rangoMeses(desde: string, hasta: string) {
  const a = partes(desde);
  const b = partes(hasta);
  if (a.anio === b.anio) return a.mes === b.mes ? `${a.mes} ${a.anio}` : `${a.mes} – ${b.mes} ${a.anio}`;
  return `${a.mes} ${a.anio} – ${b.mes} ${b.anio}`;
}

function etiquetaEstado(fila: FilaPlanilla) {
  if (fila.etiqueta) return fila.etiqueta;
  if (fila.estado === "revisar") {
    return fila.decisiones ? `${fila.decisiones} ${fila.decisiones === 1 ? "decisión" : "decisiones"}` : "Resolver";
  }
  return fila.estado === "recibida" ? "Pendiente" : "Lista";
}

function textoFecha(fila: FilaPlanilla) {
  return fila.fechaTexto ?? null;
}

export default function JornadasSecretaria() {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const { resumen, cargando, error, real } = useSecretaria();
  const [recepciones, setRecepciones] = useState<Array<{
    id: string; numeroSeguimiento: string; archivo: string; estado: string; etiquetaEstado: string;
    contexto: { institucionOrigen?: string; disciplina?: string; grupo?: string };
    recibidaEn: string | null;
  }>>([]);
  const [errorRecepciones, setErrorRecepciones] = useState<string | null>(null);

  useEffect(() => {
    if (!real) return;
    const controlador = new AbortController();
    fetch("/api/secretaria/recepcion", { signal: controlador.signal, cache: "no-store" })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json() as { recepciones?: typeof recepciones; error?: string };
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos cargar las recepciones manuales.");
        return cuerpo.recepciones ?? [];
      })
      .then(setRecepciones)
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === "AbortError") return;
        setErrorRecepciones(causa instanceof Error ? causa.message : "No pudimos cargar las recepciones manuales.");
      });
    return () => controlador.abort();
  }, [real]);
  if (cargando) return <CargandoPelota texto="Cargando jornadas…" />;
  if (error) return <AvisoAcceso titulo="No pudimos cargar las jornadas" detalle={error} accionHref="/secretaria/jornadas" accionLabel="Reintentar" />;

  // Fechas reales de las jornadas de cada plantel. Solo se atribuyen a la
  // planilla cuando es la ÚNICA de ese plantel: con dos, no hay forma de
  // saber de cuál salió cada jornada.
  const clave = (institucion: string, disciplina: string, grupo: string) => `${institucion}|${disciplina}|${grupo}`;
  const fechasJornadas = new Map<string, string[]>();
  for (const j of resumen?.jornadas ?? []) {
    const k = clave(j.institucion, j.disciplina, j.grupo);
    fechasJornadas.set(k, [...(fechasJornadas.get(k) ?? []), j.fecha]);
  }
  const lotesPorClave = new Map<string, number>();
  for (const lote of resumen?.lotes ?? []) {
    const k = clave(lote.contexto.institucionOrigen, lote.contexto.disciplina, lote.contexto.grupo);
    lotesPorClave.set(k, (lotesPorClave.get(k) ?? 0) + 1);
  }

  const jornadas: FilaPlanilla[] = (real && resumen
    ? resumen.lotes.map((lote): FilaPlanilla => {
        const k = clave(lote.contexto.institucionOrigen, lote.contexto.disciplina, lote.contexto.grupo);
        const importada = lote.estado === "importado";
        const propias = importada && lotesPorClave.get(k) === 1 ? [...new Set(fechasJornadas.get(k) ?? [])].sort() : [];
        let fecha = lote.creado_en;
        let fechaTexto = `Recibida el ${fechaCorta(lote.creado_en)}`;
        if (propias.length > 1) {
          fecha = propias.at(-1)!;
          fechaTexto = `${propias.length} jornadas · ${rangoMeses(propias[0], fecha)}`;
        } else if (propias.length === 1 || lote.contexto.fechaDeclarada) {
          fecha = propias[0] ?? lote.contexto.fechaDeclarada;
          fechaTexto = `Jornada del ${fechaCorta(fecha)}`;
        }
        return {
          id: lote.id,
          institucion: lote.contexto.institucionOrigen,
          disciplina: lote.contexto.disciplina,
          grupo: lote.contexto.grupo,
          archivo: lote.nombre_archivo,
          estado: importada ? "lista" : lote.estado === "vencido" || lote.estado === "fallido" ? "vencida" : lote.bloqueos_pendientes > 0 ? "revisar" : "recibida",
          etiqueta: lote.estado === "vencido" ? "Vencida" : lote.estado === "fallido" ? "Falló al importar" : undefined,
          href: `/secretaria/jornadas/${lote.id}`,
          decisiones: lote.bloqueos_pendientes,
          fecha,
          fechaTexto,
        };
      })
    : GRUPOS_SECRETARIA.map((grupo): FilaPlanilla => ({ ...grupo, href: "/evaluaciones/importar" }))
  ).concat(
    // Las que no se pudieron leer solas: van en la MISMA bandeja, no en una
    // columna aparte. Al arrancar con clubes nuevos este va a ser el camino
    // más común, porque el lector reconoce pocos formatos.
    recepciones.map((recepcion): FilaPlanilla => ({
      id: `recepcion-${recepcion.id}`,
      institucion: recepcion.contexto.institucionOrigen ?? "Institución sin indicar",
      disciplina: recepcion.contexto.disciplina ?? "—",
      grupo: recepcion.contexto.grupo ?? "Sin plantel",
      archivo: `${recepcion.archivo} · N.° ${recepcion.numeroSeguimiento}`,
      estado: RECEPCION_ABIERTA.has(recepcion.estado) ? "manual" : "cerrada",
      etiqueta: recepcion.etiquetaEstado,
      href: `/secretaria/recepcion/${recepcion.id}`,
      fecha: recepcion.recibidaEn ?? undefined,
      fechaTexto: recepcion.recibidaEn ? `Recibida el ${fechaCorta(recepcion.recibidaEn)}` : undefined,
    })),
  ).toSorted((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || (b.fecha ?? "").localeCompare(a.fecha ?? ""));

  const cuenta = {
    todas: jornadas.length,
    revisar: jornadas.filter((item) => item.estado === "revisar").length,
    manual: jornadas.filter((item) => item.estado === "manual").length,
    lista: jornadas.filter((item) => item.estado === "lista").length,
  };
  const termino = busqueda.trim().toLocaleLowerCase("es");
  const porTexto = termino
    ? jornadas.filter((jornada) =>
      [jornada.institucion, jornada.disciplina, jornada.grupo, jornada.archivo]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(termino),
    )
    : jornadas;
  const jornadasVisibles = porTexto.filter((jornada) => filtro === "todas" || jornada.estado === filtro);

  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="hidden text-xs font-extrabold uppercase tracking-[0.16em] text-primary sm:block">Espacio Secretaría</p>
            <h1 className="text-2xl font-extrabold tracking-tight sm:mt-1">Planillas</h1>
            <p className="mt-1 text-sm text-muted-foreground">Los archivos recibidos, lo que falta revisar y las jornadas ya incorporadas.</p>
          </div>
          <Link href="/evaluaciones/importar" className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 sm:min-h-10 ${PRESIONABLE}`}>
            <FileSpreadsheet className="size-4" aria-hidden />
            <span className="hidden min-[400px]:inline">Cargar planilla</span>
            <span className="min-[400px]:hidden">Cargar</span>
          </Link>
        </div>

        <Ayuda titulo="¿Qué encontrás acá?" bullets={[
          "Cada archivo puede quedar pendiente de revisión, en revisión o confirmado como una jornada.",
          "Abrí una planilla pendiente para ver qué falta y resolverlo antes de incorporar los resultados.",
          "Los archivos que no se pueden leer con seguridad quedan resguardados para que Secretaría los revise y cargue.",
        ]} />

        {/* Resumen y filtro son lo mismo: antes había una franja 9/2/7 y,
            debajo, chips con los mismos tres números. */}
        <div role="group" aria-label="Filtrar planillas por estado" className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-card p-1">
          {([
            ["todas", "Todas", "Todas", ""],
            ["revisar", "Por resolver", "Resolver", "text-destructive"],
            ["manual", "Carga manual", "Manual", "text-warning"],
            ["lista", "Importadas", "Importadas", "text-primary"],
          ] as const).map(([valor, etiqueta, corta, tono]) => {
            const activo = filtro === valor;
            return (
              <button
                key={valor}
                type="button"
                aria-pressed={activo}
                onClick={() => setFiltro(valor)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center rounded-xl px-2 transition-colors sm:flex-row sm:gap-2",
                  activo ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted",
                )}
              >
                <span className={cn("text-xl font-extrabold tabular-nums leading-none", !activo && cuenta[valor] > 0 && tono)}>{cuenta[valor]}</span>
                <span className={cn("mt-1 text-[11px] font-bold sm:mt-0 sm:text-xs", !activo && "text-muted-foreground")}>
                  <span className="sm:hidden">{corta}</span>
                  <span className="hidden sm:inline">{etiqueta}</span>
                </span>
              </button>
            );
          })}
        </div>

        <label className="flex h-12 items-center gap-2 rounded-xl border border-input bg-card px-3 text-muted-foreground focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Search className="size-4 shrink-0" aria-hidden />
          <input
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            aria-label="Buscar planillas"
            placeholder="Buscar institución, plantel, disciplina o archivo"
            className="min-w-0 flex-1 bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
          />
        </label>

        {errorRecepciones && (
          <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{`No pudimos cargar las planillas de carga manual: ${errorRecepciones}`}</p>
        )}
        {filtro === "manual" && (
          <p className="flex items-start gap-2 rounded-xl bg-warning-soft/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <Inbox className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span>Planillas que el lector no pudo interpretar solo. El archivo original quedó guardado: abrila para descargarlo, cargar los datos y marcarla como procesada.</span>
          </p>
        )}

        {jornadas.length === 0 ? (
          <EstadoVacio
            icono={FileSpreadsheet}
            titulo="Todavía no hay planillas"
            detalle="Cada planilla que cargues queda acá: primero la revisás y después se incorpora como jornada."
            accion={{ href: "/evaluaciones/importar", label: "Cargar la primera planilla" }}
          />
        ) : (
        <section className="overflow-hidden rounded-3xl border border-border bg-card">
          {/* Escritorio: tabla con columnas, se escanea de un vistazo.
              Mobile: la misma fila apilada, sin truncar el nombre. */}
          <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_8.5rem_1rem] gap-4 border-b border-border bg-muted/40 px-5 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Planilla</span>
            <span>Disciplina</span>
            <span>Fecha</span>
            <span>Estado</span>
            <span />
          </div>
          <ul className="divide-y divide-border">
            {jornadasVisibles.map((jornada) => {
              const visual = ESTADO_VISUAL[jornada.estado];
              const Icono = visual.icono;
              const fecha = textoFecha(jornada);
              return (
                <li key={jornada.id}>
                  <Link
                    href={jornada.href}
                    className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/35 active:bg-muted/60 lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_8.5rem_1rem] lg:items-center lg:gap-4 lg:px-5"
                  >
                    <span className="flex min-w-0 flex-1 items-start gap-3">
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", visual.caja)}>
                        <Icono className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold leading-snug">{jornada.institucion}</span>
                        <span className="block text-xs text-muted-foreground">
                          {jornada.grupo}
                          <span className="lg:hidden">{` · ${jornada.disciplina}`}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/80">
                          {fecha && <span className="lg:hidden">{`${fecha} · `}</span>}
                          {jornada.archivo}
                        </span>
                      </span>
                    </span>
                    <span className="hidden truncate text-sm font-bold lg:block">{jornada.disciplina}</span>
                    <span className="hidden text-sm text-muted-foreground lg:block">
                      {fecha ?? "—"}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 self-center lg:self-auto">
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap", visual.chip)}>{etiquetaEstado(jornada)}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          {jornadasVisibles.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <p className="text-sm font-bold">{filtro === "manual" && !termino ? "No hay planillas esperando carga manual" : "No hay planillas con ese criterio"}</p>
              <button type="button" onClick={() => { setBusqueda(""); setFiltro("todas"); }} className="min-h-11 text-xs font-extrabold text-primary">
                Ver todas
              </button>
            </div>
          )}
        </section>
        )}
      </div>
    </GuardiaSecretaria>
  );
}
