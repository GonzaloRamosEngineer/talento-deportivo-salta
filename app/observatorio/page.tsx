"use client";

import Link from "next/link";
import { ChevronRight, Landmark, ShieldCheck } from "lucide-react";
import { CLUBES } from "@/lib/mock-data";
import { usePerfil, PERFILES } from "@/components/perfil-context";
import { MapaSalta } from "@/components/mapa-salta";

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
        {CLUBES.map((c) => {
          const contenido = (
            <>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span className="truncate">{c.nombre}</span>
                  {c.esEsteClub && (
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">
                      Tu club
                    </span>
                  )}
                </span>
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
              {c.esEsteClub && (
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
            </>
          );

          return c.esEsteClub ? (
            <Link
              key={c.id}
              href="/"
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              {contenido}
            </Link>
          ) : (
            <div
              key={c.id}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 opacity-80"
            >
              {contenido}
            </div>
          );
        })}
      </section>

      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        La constancia de carga (mediciones por deportista por mes) es el
        indicador temprano del programa: mide si el hábito prende, antes que
        cualquier otra métrica.
      </p>
    </div>
  );
}
