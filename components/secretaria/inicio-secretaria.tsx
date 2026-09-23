"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Gauge,
  Users,
} from "lucide-react";
import { EstadoJornada } from "@/components/secretaria/estado-jornada";
import { SelectorContextoSecretaria } from "@/components/secretaria/selector-contexto-secretaria";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { CargandoPelota } from "@/components/cargando-pelota";
import { useSecretaria } from "@/lib/use-secretaria";
import { usePerfil } from "@/components/perfil-context";
import { Ayuda } from "@/components/ayuda";
import { EscaleraDatos } from "@/components/secretaria/escalera-datos";
import { PRESIONABLE } from "@/components/secretaria/presionable";


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

  const importados = resumen?.indicadores.lotesImportados ?? 0;
  const totalLotes = resumen?.indicadores.lotes ?? 0;
  const progreso = totalLotes > 0 ? Math.round((importados / totalLotes) * 100) : 0;
  const instituciones = new Set(resumen?.lotes.map((lote) => lote.contexto.institucionOrigen)).size;
  const porRevisar = resumen?.indicadores.lotesPendientes ?? 0;
  const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString("es-AR")} ${n === 1 ? uno : varios}`;
  // Número y etiqueta se leen juntos ("9 planillas"): van en la misma línea.
  // El detalle es siempre un dato, nunca una invitación, y lo que
  // pide acción (planillas por revisar) se destaca en ámbar.
  const indicadores = resumen
    ? [
        {
          valor: resumen.indicadores.lotes,
          etiqueta: resumen.indicadores.lotes === 1 ? "planilla" : "planillas",
          href: "/secretaria/jornadas",
          detalle: plural(importados, "incorporada", "incorporadas"),
          alerta: porRevisar > 0 ? `${porRevisar} por revisar` : null,
        },
        {
          valor: resumen.indicadores.disciplinas,
          etiqueta: resumen.indicadores.disciplinas === 1 ? "disciplina" : "disciplinas",
          href: "/secretaria/disciplinas",
          detalle: `de ${plural(instituciones, "institución", "instituciones")}`,
          alerta: null,
        },
        {
          valor: resumen.indicadores.deportistas,
          etiqueta: resumen.indicadores.deportistas === 1 ? "deportista" : "deportistas",
          href: "/secretaria/deportistas",
          detalle: `en ${plural(resumen.indicadores.grupos, "plantel", "planteles")}`,
          alerta: null,
        },
        {
          valor: resumen.indicadores.mediciones,
          etiqueta: resumen.indicadores.mediciones === 1 ? "medición" : "mediciones",
          href: "/secretaria/reportes",
          detalle: `en ${plural(resumen.indicadores.jornadas, "jornada", "jornadas")}`,
          alerta: null,
        },
      ]
    : [];
  const lotesConBloqueo = resumen?.lotes.filter((lote) => lote.bloqueos_pendientes > 0) ?? [];
  const loteConBloqueo = lotesConBloqueo[0];
  const otrasBloqueadas = lotesConBloqueo.length - 1;
  const decisiones = loteConBloqueo?.bloqueos_pendientes ?? 0;

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

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">
        {indicadores.map(({ valor, etiqueta, href, detalle, alerta }) => (
          <Link key={href} href={href} className="group relative min-w-0 bg-card px-3 py-3.5 transition-colors hover:bg-muted sm:px-5 sm:py-4">
            <p className="flex items-baseline gap-x-1.5 whitespace-nowrap">
              <span className="text-[22px] font-extrabold tabular-nums tracking-tight sm:text-3xl">{valor.toLocaleString("es-AR")}</span>
              <span className="text-[13px] font-bold text-muted-foreground sm:text-sm">{etiqueta}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {detalle}
              {alerta && (
                <>
                  <span className="hidden sm:inline">{" · "}</span>
                  <span className="block font-bold text-warning sm:inline">{alerta}</span>
                </>
              )}
            </p>
            <ChevronRight className="absolute right-3 top-1/2 hidden size-4 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block" aria-hidden />
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)] xl:items-start">
      <div className="flex flex-col gap-4">
      {/* Dos pesos: lo que se hace seguido (medir, cargar) va como botón
          ancho con su explicación siempre visible; lo que se consulta
          (organizar, deportistas) queda como botón liviano. Flecha hacia
          adelante: son pantallas de la app, no enlaces externos. */}
      <div>
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Acciones rápidas</h2>
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
          {[
            { href: "/secretaria/medir", titulo: "Nueva medición", detalle: "Cargá al plantel de corrido", icon: Gauge },
            { href: "/evaluaciones/importar", titulo: "Cargar planilla", detalle: "Subila y revisala antes de incorporarla", icon: FileSpreadsheet },
          ].map(({ href, titulo, detalle, icon: Icon }) => (
            <Link key={href} href={href} className={`flex items-center gap-3 rounded-2xl bg-primary p-3.5 text-primary-foreground shadow-sm hover:bg-primary/90 sm:p-4 ${PRESIONABLE}`}>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/15"><Icon className="size-5" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-extrabold leading-tight">{titulo}</span>
                <span className="mt-0.5 block text-xs text-primary-foreground/80">{detalle}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 opacity-70" aria-hidden />
            </Link>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-3">
          {[
            { href: "/secretaria/grupos", titulo: "Organizar", detalle: "Instituciones y planteles", icon: Building2 },
            { href: "/secretaria/deportistas", titulo: "Deportistas", detalle: "Ficha y evolución", icon: Users },
          ].map(({ href, titulo, detalle, icon: Icon }) => (
            <Link key={href} href={href} className={`flex min-h-12 items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 hover:bg-muted/40 sm:px-3.5 ${PRESIONABLE}`}>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary"><Icon className="size-4" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold leading-tight">{titulo}</span>
                <span className="block text-[11px] leading-tight text-muted-foreground">{detalle}</span>
              </span>
              <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
            </Link>
          ))}
        </div>
      </div>
      {/* En mobile, lo que hay que decidir va antes que las acciones: si
          no, queda debajo del pliegue. En escritorio entra igual. */}
      <section className={`rounded-3xl border bg-card p-5 ${loteConBloqueo ? "order-first border-destructive/20 sm:order-none" : "border-primary/20"}`}>
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
              <div className="mt-2"><EstadoJornada estado="revisar" /></div>
            </div>
            <Link href={`/secretaria/jornadas/${loteConBloqueo.id}`} className={`inline-flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground sm:min-h-9 sm:w-auto sm:text-xs ${PRESIONABLE}`}>Revisar planilla<ArrowRight className="size-3.5" aria-hidden /></Link>
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

      {resumen && <EscaleraDatos resumen={resumen} />}
      </div>
    </div>
  );
}
