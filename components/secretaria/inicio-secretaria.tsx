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
} from "lucide-react";
import { EstadoJornada } from "@/components/secretaria/estado-jornada";
import { SelectorContextoSecretaria } from "@/components/secretaria/selector-contexto-secretaria";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { CargandoPelota } from "@/components/cargando-pelota";
import { useSecretaria } from "@/lib/use-secretaria";
import { usePerfil } from "@/components/perfil-context";

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
  const loteConBloqueo = resumen?.lotes.find((lote) => lote.bloqueos_pendientes > 0);
  const importados = resumen?.indicadores.lotesImportados ?? 1;
  const totalLotes = resumen?.indicadores.lotes ?? 9;
  const progreso = totalLotes > 0 ? Math.round((importados / totalLotes) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <SelectorContextoSecretaria activo="evaluaciones" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">
            Espacio Secretaría
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
            Evaluaciones de la provincia
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jornadas, grupos y seguimiento producidos por la Secretaría.
          </p>
        </div>
        <span className="rounded-full border border-primary/20 bg-secondary px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">Datos del espacio</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {indicadores.map(({ valor, etiqueta, icon: Icon }) => (
          <div key={etiqueta} className="rounded-2xl border border-border bg-card p-3.5">
            <Icon className="size-4 text-primary" aria-hidden />
            <p className="mt-3 text-2xl font-extrabold">{valor}</p>
            <p className="mt-0.5 text-[11px] font-semibold leading-tight text-muted-foreground">
              {etiqueta}
            </p>
          </div>
        ))}
      </div>

      <Link href="/secretaria/medir" className="group flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm transition-transform active:scale-[0.99]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><Gauge className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">Nueva jornada de medición</span><span className="mt-0.5 block text-xs text-primary-foreground/75">Elegí un grupo y cargá sus mediciones de corrido</span></span>
        <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
      </Link>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/evaluaciones/importar"
          className="group flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm transition-transform active:scale-[0.99]"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <FileSpreadsheet className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold">Importar una jornada</span>
            <span className="mt-0.5 block text-xs text-primary-foreground/75">
              Excel o CSV, con revisión previa
            </span>
          </span>
          <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </Link>
        <Link
          href="/secretaria/grupos"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-muted/40"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Building2 className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold">Organizar los grupos</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Institución, disciplina y categoría
            </span>
          </span>
          <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      </div>

      <section className={`rounded-3xl border bg-card p-5 ${loteConBloqueo ? "border-destructive/20" : "border-primary/20"}`}>
        <div className="flex items-start gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${loteConBloqueo ? "bg-destructive/10 text-destructive" : "bg-secondary text-primary"}`}>
            {loteConBloqueo ? <AlertTriangle className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">{loteConBloqueo ? "Una jornada necesita una decisión" : "No hay decisiones pendientes"}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {loteConBloqueo
                ? `${loteConBloqueo.contexto.institucionOrigen} · ${loteConBloqueo.contexto.grupo} tiene ${loteConBloqueo.bloqueos_pendientes} decisión pendiente antes de confirmar.`
                : "Las jornadas confirmadas y las previsualizaciones actuales no tienen bloqueos de calidad abiertos."}
            </p>
          </div>
        </div>
        {loteConBloqueo && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-muted/45 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{`${loteConBloqueo.contexto.institucionOrigen} · ${loteConBloqueo.contexto.grupo}`}</p>
              <p className="text-xs text-muted-foreground">{loteConBloqueo.nombre_archivo}</p>
            </div>
            <EstadoJornada estado="revisar" />
            <Link href="/evaluaciones/importar" className="text-xs font-extrabold text-primary">Revisar</Link>
          </div>
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
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progreso}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-bold text-muted-foreground">
          <span>{importados} importada{importados === 1 ? "" : "s"}</span>
          <span>{totalLotes} recibida{totalLotes === 1 ? "" : "s"}</span>
        </div>
      </section>
    </div>
  );
}
