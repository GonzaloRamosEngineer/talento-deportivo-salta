"use client";

import { ExternalLink, Info, Sprout } from "lucide-react";
import type { Deportista, Medicion } from "@/lib/mock-data";
import { formatFecha } from "@/lib/mock-data";
import {
  crecimiento,
  estimacionMadurez,
  MOORE_CITA,
  MOORE_MARGEN_ANIOS,
  MOORE_PAPER_URL,
  MOORE_PENDIENTE_AVAL,
  umbralPara,
  type ParametrosCrecimiento,
} from "@/lib/crecimiento";
import { cn } from "@/lib/utils";

const fmt = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const MARGEN_MESES = Math.round(MOORE_MARGEN_ANIOS * 12);

// Frase principal del estimado de madurez, en lenguaje de estimación
// (nunca de certeza): antes / cerca / después del pico.
function frasePico(offsetAnios: number): string {
  if (offsetAnios < -0.25)
    return `A ~${fmt(Math.abs(offsetAnios))} años del pico de crecimiento estimado`;
  if (offsetAnios > 0.25)
    return `Pico de crecimiento estimado hace ~${fmt(offsetAnios)} años`;
  return "Cerca del pico de crecimiento estimado";
}

// Módulo D (negocio/10 §5): ritmo de crecimiento OBSERVADO sobre la
// serie de talla + estimación de madurez Moore et al. 2015 (edad +
// talla, por sexo, margen de error SIEMPRE visible). Lenguaje de
// registro/estimación, nunca diagnóstico ni proyección de talla adulta.
export function Estiron({
  deportista,
  serie,
  parametros,
}: {
  deportista: Deportista;
  serie: Medicion[];
  parametros: ParametrosCrecimiento;
}) {
  const umbral = umbralPara(deportista.sexo, parametros);
  const { tramos, actual, enAceleracion } = crecimiento(serie, {
    umbral,
    minDias: parametros.minDiasTramo,
  });
  const madurez = estimacionMadurez(deportista, serie);
  const meses = Math.round(parametros.minDiasTramo / 30);

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
          talla separadas {`al menos ${meses} meses`}.
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

      {madurez && (
        <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Madurez estimada
          </p>
          <p className="mt-1 text-sm font-extrabold">
            {frasePico(madurez.offsetAnios)}{" "}
            <span className="font-semibold text-muted-foreground">
              (± {MARGEN_MESES} meses)
            </span>
          </p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Estimado con la edad y la talla del{" "}
            {formatFecha(madurez.fechaMedicion)}: el pico se ubicaría alrededor
            de los {fmt(madurez.edadPico)} años. Es una estimación estadística
            con margen de error conocido — sirve para contextualizar cargas y
            expectativas, no define nada sobre el futuro deportivo.
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Método publicado:{" "}
            <a
              href={MOORE_PAPER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-semibold underline underline-offset-2"
            >
              {MOORE_CITA}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </p>
          {MOORE_PENDIENTE_AVAL && (
            <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-[11px] font-semibold leading-snug text-warning">
              Presentación pendiente de revisión del preparador físico de la
              Fundación.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] leading-snug text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          Registro observado entre mediciones separadas{" "}
          {`al menos ${meses} meses`}; &ldquo;acelerado&rdquo; ={" "}
          {`más de ${fmt(umbral)} cm/año`}
          {deportista.sexo === "F" ? " (umbral femenino)" : ""}. Cada chico
          crece a su propio ritmo: esto no es un diagnóstico ni una proyección
          de talla adulta.
        </p>
      </div>
    </section>
  );
}
