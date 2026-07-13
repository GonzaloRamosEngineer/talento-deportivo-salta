"use client";

import { Landmark, Loader2, ShieldCheck } from "lucide-react";
import { EscudoClub } from "@/components/escudo-club";
import { ATRIBUTOS, formatFecha } from "@/lib/mock-data";
import { useObservatorio } from "@/lib/use-observatorio";
import { usePerfil, PERFILES } from "@/components/perfil-context";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { MapaSalta } from "@/components/mapa-salta";
import { EnElRadar, Proximamente } from "@/components/proximamente";

export default function Observatorio() {
  const { perfil, setPerfil, sesionReal } = usePerfil();
  const { cargando, real, error, clubes, ultimaMedicion } = useObservatorio();

  if (perfil !== "super_admin") {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Landmark className="size-10 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-extrabold">Observatorio provincial</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          {sesionReal
            ? "Esta vista pertenece al rol de plataforma. Tu sesión no tiene ese acceso."
            : "Esta vista pertenece al perfil de plataforma. Cambiá de perfil para verla."}
        </p>
        {!sesionReal && (
          <button
            onClick={() => setPerfil("super_admin")}
            className="h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            Ver como {PERFILES.find((p) => p.id === "super_admin")?.label}
          </button>
        )}
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Cargando el observatorio…
      </div>
    );
  }
  if (error) {
    return (
      <AvisoAcceso
        titulo="No pudimos cargar el observatorio"
        detalle={error}
        accionHref="/observatorio"
        accionLabel="Reintentar"
      />
    );
  }

  const totales = clubes.reduce(
    (acc, c) => ({
      deportistas: acc.deportistas + c.deportistas,
      mediciones: acc.mediciones + c.medicionesMes,
    }),
    { deportistas: 0, mediciones: 0 },
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Observatorio provincial
        </h1>
        <p className="text-sm text-muted-foreground">
          Deporte formativo de Salta ·{" "}
          {clubes.length === 1
            ? "1 club adherido"
            : `${clubes.length} clubes adheridos`}
          {real && " · datos reales del piloto"}
        </p>
      </div>

      {/* Totales provinciales */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-2xl font-extrabold">{totales.deportistas}</p>
          <p className="text-xs font-medium text-muted-foreground">
            deportistas con trayectoria
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-2xl font-extrabold">{totales.mediciones}</p>
          <p className="text-xs font-medium text-muted-foreground">
            mediciones · últimos 30 días
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-2xl font-extrabold">{clubes.length}</p>
          <p className="text-xs font-medium text-muted-foreground">
            clubes activos
          </p>
        </div>
      </div>

      <MapaSalta clubes={clubes} />

      {/* La regla de privacidad, visible en la propia UI */}
      <div className="flex items-start gap-2.5 rounded-xl bg-secondary p-3.5 text-sm text-secondary-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <span className="font-bold">Solo datos agregados.</span> Los datos
          individuales de los deportistas —en su mayoría menores— nunca salen
          de su club. El observatorio ve totales por club y categoría, jamás
          fichas personales.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-extrabold">Clubes</h2>
        {clubes.map((c) => (
          // En pantallas angostas las métricas bajan a su propia fila:
          // el nombre del club (hasta 2 líneas) nunca queda aplastado.
          <div
            key={c.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-card p-4"
          >
            <EscudoClub url={c.escudoUrl} nombre={c.nombre} className="size-11" />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 break-words text-sm font-bold leading-snug">
                {c.nombre}
              </span>
              <span className="block text-xs text-muted-foreground">
                {c.localidad} ·{" "}
                {c.categoriasActivas === 1
                  ? "1 categoría activa"
                  : `${c.categoriasActivas} categorías activas`}
                {ultimaMedicion.has(c.id) &&
                  ` · última jornada ${formatFecha(ultimaMedicion.get(c.id)!)}`}
              </span>
            </span>
            <span className="grid w-full grid-cols-3 gap-3 border-t border-border pt-3 text-center sm:w-auto sm:border-t-0 sm:pt-0">
              <span>
                <span className="block text-sm font-extrabold tabular-nums">
                  {c.deportistas}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  deport.
                </span>
              </span>
              <span>
                <span className="block text-sm font-extrabold tabular-nums">
                  {c.medicionesMes}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  medic. 30 días
                </span>
              </span>
              <span>
                <span className="block text-sm font-extrabold tabular-nums">
                  {c.consentimientoPct}%
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  consent.
                </span>
              </span>
            </span>
          </div>
        ))}
        <p className="px-1 text-[11px] leading-snug text-muted-foreground">
          Las tarjetas no se abren a propósito: para ver datos individuales se
          requiere membresía en ese club. La plataforma no tiene esa llave.
        </p>
      </section>

      {/* Catálogo global: lo único que la plataforma sí administra */}
      <section className="rounded-2xl border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-extrabold">
          Catálogo provincial de atributos{" "}
          <span className="font-semibold text-muted-foreground">
            (curado por la plataforma)
          </span>
        </h2>
        <ul>
          {ATRIBUTOS.map((a) => (
            <li
              key={a.id}
              className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-2 text-sm last:border-0"
            >
              <span className="font-semibold">{a.nombre}</span>
              <span className="text-right text-xs text-muted-foreground">
                {a.naturaleza === "objetivo"
                  ? `objetiva · ${a.unidad}`
                  : "subjetiva · 1-10"}
              </span>
            </li>
          ))}
        </ul>
        <p className="px-4 py-2.5 text-[11px] leading-snug text-muted-foreground">
          El mismo catálogo para todos los clubes: por eso “Velocidad 30m”
          significa lo mismo en toda la provincia y los datos son comparables.
        </p>
      </section>

      <EnElRadar>
        <Proximamente
          titulo="Más disciplinas: vóley, básquet, hockey"
          detalle="El modelo ya es multi-disciplina: catálogo de atributos propio por deporte, mismas trayectorias, mismo observatorio."
          etiqueta="Próximamente"
        />
        <Proximamente
          titulo="Percentiles provinciales por edad"
          detalle="Comparar la evolución de cada cohorte contra la referencia provincial — cuando el volumen de datos lo permita y siempre en agregado."
          etiqueta="A evaluar"
        />
        <Proximamente
          titulo="Complemento federativo (Liga / COMET)"
          detalle="Puente con el registro federativo: la Liga ve trayectorias formativas agregadas donde hoy solo ve pases y licencias."
          etiqueta="A evaluar"
        />
      </EnElRadar>

      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        La constancia de carga (mediciones por deportista por mes) es el
        indicador temprano del programa: mide si el hábito prende, antes que
        cualquier otra métrica.
      </p>
    </div>
  );
}
