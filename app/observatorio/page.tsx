"use client";

import { Landmark, ShieldCheck } from "lucide-react";
import { ATRIBUTOS, CLUBES } from "@/lib/mock-data";
import { usePerfil, PERFILES } from "@/components/perfil-context";
import { MapaSalta } from "@/components/mapa-salta";
import { EnElRadar, Proximamente } from "@/components/proximamente";

export default function Observatorio() {
  const { perfil, setPerfil } = usePerfil();

  if (perfil !== "super_admin") {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Landmark className="size-10 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-extrabold">Observatorio provincial</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Esta vista pertenece al perfil de plataforma. Cambiá de perfil para
          verla.
        </p>
        <button
          onClick={() => setPerfil("super_admin")}
          className="h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          Ver como {PERFILES.find((p) => p.id === "super_admin")?.label}
        </button>
      </div>
    );
  }

  const totales = CLUBES.reduce(
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
          Deporte formativo de Salta · {CLUBES.length} clubes adheridos
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
            mediciones este mes
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-2xl font-extrabold">{CLUBES.length}</p>
          <p className="text-xs font-medium text-muted-foreground">
            clubes activos
          </p>
        </div>
      </div>

      <MapaSalta />

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
        {CLUBES.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{c.nombre}</span>
              <span className="block text-xs text-muted-foreground">
                {c.localidad} · {c.categoriasActivas} categorías activas
              </span>
            </span>
            <span className="grid shrink-0 grid-cols-3 gap-3 text-center">
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
                  medic./mes
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
