"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  FileStack,
  Gauge,
  Shapes,
  Users,
  ArrowRight,
} from "lucide-react";
import { EstadoJornada } from "@/components/secretaria/estado-jornada";
import { SelectorContextoSecretaria } from "@/components/secretaria/selector-contexto-secretaria";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { CargandoPelota } from "@/components/cargando-pelota";
import { useSecretaria } from "@/lib/use-secretaria";
import { usePerfil } from "@/components/perfil-context";
import { Ayuda } from "@/components/ayuda";

// Respuesta al presionar: en la cancha, con el dedo, es la única señal de
// que el toque se registró. Con reduced-motion queda solo el color.
const PRESIONABLE =
  "transition-[transform,background-color,border-color] duration-150 ease-(--ease-out) active:scale-[0.97] motion-reduce:active:scale-100";

export function InicioSecretaria() {
  const { sesionReal, cargandoSesion } = usePerfil();
  const { resumen, cargando, error } = useSecretaria();

  if (cargandoSesion) return <CargandoPelota texto="Validando el acceso…" />;
  if (!sesionReal) {
    return <AvisoAcceso titulo="Ingresá al Espacio Secretaría" detalle="Este espacio trabaja con las planillas y mediciones reales de la Secretaría." accionHref="/login" accionLabel="Ingresar" />;
  }
  if (cargando) return <CargandoPelota texto="Cargando el Espacio Secretaría…" />;
  if (error) {
    return <AvisoAcceso titulo="No pudimos cargar el Espacio Secretaría" detalle={error} accionHref="/panel" accionLabel="Reintentar" />;
  }

  const indicadores = resumen
    ? [
        { valor: String(resumen.indicadores.lotes), etiqueta: "planillas recibidas", icon: FileStack },
        { valor: String(resumen.indicadores.disciplinas), etiqueta: "disciplinas", icon: Shapes },
        { valor: String(resumen.indicadores.deportistas), etiqueta: "deportistas evaluados", icon: Users },
        { valor: String(resumen.indicadores.mediciones), etiqueta: "mediciones", icon: Gauge },
      ]
    : [];
  const lotesConBloqueo = resumen?.lotes.filter((lote) => lote.bloqueos_pendientes > 0) ?? [];
  const loteConBloqueo = lotesConBloqueo[0];
  const otrasBloqueadas = lotesConBloqueo.length - 1;
  const decisiones = loteConBloqueo?.bloqueos_pendientes ?? 0;
  const importados = resumen?.indicadores.lotesImportados ?? 0;
  const totalLotes = resumen?.indicadores.lotes ?? 0;
  const progreso = totalLotes > 0 ? Math.round((importados / totalLotes) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <SelectorContextoSecretaria activo="evaluaciones" />
      {/* En mobile el header y el selector ya dicen "Secretaría": el
          antetítulo repetido solo empujaba los datos debajo del pliegue. */}
      <div>
        <p className="hidden text-xs font-extrabold uppercase tracking-[0.16em] text-primary sm:block">
          Espacio Secretaría
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:mt-1">
          Evaluaciones de la provincia
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jornadas, grupos y seguimiento producidos por la Secretaría.
        </p>
      </div>

      <Ayuda titulo="¿Cómo usar el panel?" bullets={[
        "El panel resume las planillas, disciplinas, deportistas y mediciones registradas por Secretaría.",
        "Empezá por resolver los avisos pendientes; después podés explorar grupos, cobertura y reportes.",
        "Los datos confirmados forman una base común para seguir la evolución y orientar decisiones deportivas.",
      ]} />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
        {indicadores.map(({ valor, etiqueta, icon: Icon }) => {
          const destino = etiqueta === "planillas recibidas" ? "/secretaria/jornadas" : etiqueta === "disciplinas" ? "/secretaria/disciplinas" : etiqueta === "deportistas evaluados" ? "/secretaria/deportistas" : "/secretaria/reportes";
          const detalle = etiqueta === "planillas recibidas" ? `${importados} incorporadas · ${resumen?.indicadores.lotesPendientes ?? 0} por revisar` : etiqueta === "disciplinas" ? "Explorar cobertura" : etiqueta === "deportistas evaluados" ? `${resumen?.indicadores.grupos ?? 0} planteles` : `${resumen?.indicadores.jornadas ?? 0} jornadas registradas`;
          return <Link href={destino} key={etiqueta} className="group min-w-0 bg-card px-3 py-3 text-center transition-colors hover:bg-muted sm:p-4 sm:text-left">
            <Icon className="mx-auto hidden size-4 text-primary sm:block sm:mx-0" aria-hidden />
            <p className="text-xl font-extrabold tabular-nums sm:mt-2 sm:text-2xl">{Number(valor).toLocaleString("es-AR")}</p>
            <p className="mt-0.5 truncate text-[11px] font-bold leading-tight text-muted-foreground">
              {etiqueta === "planillas recibidas" ? "planillas" : etiqueta === "deportistas evaluados" ? "deportistas" : etiqueta}
            </p>
            <p className="mt-1 hidden truncate text-[11px] text-muted-foreground lg:block">{detalle}</p>
          </Link>;
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)] xl:items-start">
      <div className="flex flex-col gap-4">
      <div>
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Link href="/secretaria/medir" className={`group flex min-h-24 flex-col gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm ${PRESIONABLE}`}>
          <span className="flex items-start justify-between"><span className="flex size-9 items-center justify-center rounded-xl bg-white/15"><Gauge className="size-4" aria-hidden /></span><ArrowUpRight className="size-3.5" /></span>
          <span><span className="block text-sm font-extrabold">Nueva medición</span><span className="mt-0.5 hidden text-xs text-primary-foreground/75 sm:line-clamp-2">Cargá al plantel de corrido</span></span>
        </Link>
        <Link
          href="/evaluaciones/importar"
          className={`group flex min-h-24 flex-col gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm ${PRESIONABLE}`}
        >
          <span className="flex items-start justify-between"><span className="flex size-9 items-center justify-center rounded-xl bg-white/15"><FileSpreadsheet className="size-4" aria-hidden /></span><ArrowUpRight className="size-3.5" /></span>
          <span><span className="block text-sm font-extrabold">Cargar planilla</span><span className="mt-0.5 hidden text-xs text-primary-foreground/75 sm:line-clamp-2">Vista previa o revisión por Secretaría</span></span>
        </Link>
        <Link
          href="/secretaria/grupos"
          className={`group flex min-h-24 flex-col gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-muted/40 ${PRESIONABLE}`}
        >
          <span className="flex items-start justify-between"><span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary"><Building2 className="size-4" aria-hidden /></span><ArrowUpRight className="size-3.5 text-muted-foreground" /></span>
          <span><span className="block text-sm font-extrabold">Organizar</span><span className="mt-0.5 hidden text-xs text-muted-foreground sm:line-clamp-2">Instituciones y planteles</span></span>
        </Link>
        <Link href="/secretaria/deportistas" className={`group flex min-h-24 flex-col gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-muted/40 ${PRESIONABLE}`}>
          <span className="flex items-start justify-between"><span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary"><Users className="size-4" aria-hidden /></span><ArrowUpRight className="size-3.5 text-muted-foreground" /></span>
          <span><span className="block text-sm font-extrabold">Deportistas</span><span className="mt-0.5 hidden text-xs text-muted-foreground sm:line-clamp-2">Ficha y evolución</span></span>
        </Link>
        </div>
      </div>
      <section className={`rounded-3xl border bg-card p-5 ${loteConBloqueo ? "border-destructive/20" : "border-primary/20"}`}>
        <div className="flex items-start gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${loteConBloqueo ? "bg-destructive/10 text-destructive" : "bg-secondary text-primary"}`}>
            {loteConBloqueo ? <AlertTriangle className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">
              {!loteConBloqueo
                ? "No hay decisiones pendientes"
                : lotesConBloqueo.length === 1
                  ? "Una jornada necesita una decisión"
                  : `${lotesConBloqueo.length} jornadas necesitan una decisión`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {loteConBloqueo
                ? `${loteConBloqueo.contexto.institucionOrigen} · ${loteConBloqueo.contexto.grupo} tiene ${decisiones} ${decisiones === 1 ? "decisión pendiente" : "decisiones pendientes"} antes de confirmar.`
                : "Las jornadas confirmadas y las previsualizaciones actuales no tienen bloqueos de calidad abiertos."}
            </p>
          </div>
        </div>
        {loteConBloqueo && (
          // Apilado en mobile: en una sola fila el nombre de la jornada —lo
          // que hay que decidir— quedaba truncado a "MMA S…".
          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-muted/45 p-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">{`${loteConBloqueo.contexto.institucionOrigen} · ${loteConBloqueo.contexto.grupo}`}</p>
              <p className="break-words text-xs text-muted-foreground">{loteConBloqueo.nombre_archivo}</p>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <EstadoJornada estado="revisar" />
              <Link href={`/secretaria/jornadas/${loteConBloqueo.id}`} className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground sm:min-h-9 sm:text-xs ${PRESIONABLE}`}>Revisar planilla<ArrowRight className="size-3.5" aria-hidden /></Link>
            </div>
          </div>
        )}
        {otrasBloqueadas > 0 && (
          <Link href="/secretaria/jornadas" className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-extrabold text-primary sm:min-h-0">
            {`Ver ${otrasBloqueadas === 1 ? "la otra jornada" : `las otras ${otrasBloqueadas} jornadas`}`}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-primary">
            <Gauge className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-extrabold">Calidad antes que cantidad</h2>
            <p className="text-xs text-muted-foreground">{`${resumen?.indicadores.lotesPendientes ?? 0} planillas están previsualizadas y requieren revisión.`}</p>
          </div>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Planillas importadas sobre recibidas"
          aria-valuemin={0}
          aria-valuemax={totalLotes}
          aria-valuenow={importados}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${progreso}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[11px] font-bold text-muted-foreground">
          <span>{importados} importada{importados === 1 ? "" : "s"}</span>
          <span>{totalLotes} recibida{totalLotes === 1 ? "" : "s"}</span>
        </div>
      </section>
      </div>

      <section className="rounded-3xl border border-primary/15 bg-gradient-to-br from-secondary/75 via-card to-card p-5 xl:p-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary">De los registros al seguimiento</p>
        <h2 className="mt-1 text-lg font-extrabold tracking-tight">Una base común para entender la evolución</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Cada planilla ordenada vincula deportistas, planteles, fechas, métricas y protocolos. Así, las mediciones dejan de quedar aisladas y pueden leerse con contexto.</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
          <Link href="/secretaria/jornadas" className={`group flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 p-3 hover:border-primary/35 hover:bg-card ${PRESIONABLE}`}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><FileStack className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-extrabold">Conservar el origen</span><span className="block text-[11px] text-muted-foreground">Revisar cada archivo antes de incorporarlo</span></span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link>
          <Link href="/secretaria/disciplinas" className={`group flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 p-3 hover:border-primary/35 hover:bg-card ${PRESIONABLE}`}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Shapes className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-extrabold">Ver qué se está midiendo</span><span className="block text-[11px] text-muted-foreground">Explorar métricas, protocolos y cobertura</span></span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link>
          <Link href="/secretaria/reportes" className={`group flex items-center gap-3 rounded-2xl border border-border/80 bg-card/80 p-3 hover:border-primary/35 hover:bg-card ${PRESIONABLE}`}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Gauge className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-extrabold">Preparar reportes comparables</span><span className="block text-[11px] text-muted-foreground">Se habilitan al validar jornadas y protocolos</span></span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></Link>
        </div>
      </section>
      </div>
    </div>
  );
}
