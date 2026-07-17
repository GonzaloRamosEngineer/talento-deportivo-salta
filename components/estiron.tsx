"use client";

import { Info, Sprout } from "lucide-react";
import type { Medicion } from "@/lib/mock-data";
import { formatFecha } from "@/lib/mock-data";
import {
  crecimiento,
  UMBRAL_ACELERACION_CM_ANIO,
} from "@/lib/crecimiento";
import { cn } from "@/lib/utils";

const fmt = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

// Módulo D aterrizado (negocio/10 §5): ritmo de crecimiento OBSERVADO
// sobre la serie de talla. Lenguaje de registro, nunca de diagnóstico,
// madurez ni proyección de talla adulta.
export function Estiron({ serie }: { serie: Medicion[] }) {
  const { tramos, actual, enAceleracion } = crecimiento(serie);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-base font-extrabold">
            <Sprout className="size-4.5 text-success" aria-hidden />
            El estirón
          </h3>
          <p className="text-xs text-muted-foreground">
            Ritmo de crecimiento observado en la talla
          </p>
        </div>
        {enAceleracion && (
          <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
            Crecimiento acelerado (registro observado)
          </span>
        )}
      </div>

      {!actual ? (
        <p className="py-4 text-sm text-muted-foreground">
          El ritmo de crecimiento aparece acá cuando hay dos mediciones de
          talla separadas al menos 3 meses.
        </p>
      ) : (
        <>
          <p className="mt-2 text-2xl font-extrabold tabular-nums">
            {fmt(actual.cmPorAnio)}{" "}
            <span className="text-sm font-semibold text-muted-foreground">
              cm/año
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Entre {formatFecha(actual.desdeFecha)} y{" "}
            {formatFecha(actual.hastaFecha)} ({fmt(actual.deltaCm)} cm en{" "}
            {actual.dias} días).
          </p>

          {tramos.length > 1 && (
            <ul className="mt-3 border-t border-border pt-1">
              {[...tramos].reverse().slice(0, 6).map((t) => (
                <li
                  key={t.hastaFecha}
                  className="flex items-baseline justify-between gap-3 border-b border-border py-2 text-sm last:border-0"
                >
                  <span className="text-muted-foreground">
                    {formatFecha(t.desdeFecha)} → {formatFecha(t.hastaFecha)}
                  </span>
                  <span
                    className={cn(
                      "font-bold tabular-nums",
                      t.acelerado && "text-warning",
                    )}
                  >
                    {fmt(t.cmPorAnio)}{" "}
                    <span className="text-xs font-medium text-muted-foreground">
                      cm/año
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {enAceleracion && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-warning-soft p-3.5 text-sm text-warning">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="font-semibold">
                Etapa de crecimiento acelerado.{" "}
                <span className="font-normal">
                  En estas etapas suele aconsejarse moderar cargas e impactos.
                  Es información general, no una indicación: hablalo con el
                  profesional del club.
                </span>
              </p>
            </div>
          )}
        </>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] leading-snug text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          Registro observado entre mediciones separadas al menos 3 meses;
          &ldquo;acelerado&rdquo; = más de {UMBRAL_ACELERACION_CM_ANIO} cm/año.
          Cada chico crece a su propio ritmo: esto no es un diagnóstico ni una
          proyección de talla adulta.
        </p>
      </div>
    </section>
  );
}
