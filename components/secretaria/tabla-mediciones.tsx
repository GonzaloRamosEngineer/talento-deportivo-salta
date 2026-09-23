"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { Atributo } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export interface SerieTabla {
  clave: string;
  nombre: string;
  protocolo: string;
  unidad: string;
  sentido: Atributo["sentido"];
  filas: Array<{ fecha: string; valor: number; intento: number }>;
}

/** Cuántas fechas entran en la comparación: la última y hasta 3 anteriores. */
const COLUMNAS = 4;

const NUMERO = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const MES = new Intl.DateTimeFormat("es-AR", { month: "short" });
function fechaCorta(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { dia: `${d} ${MES.format(new Date(a, m - 1, d)).replace(".", "")}`, anio: String(a) };
}

/** El último intento de cada fecha: los intentos no se promedian. */
function ultimoIntento(filas: SerieTabla["filas"], fecha: string) {
  return filas.filter((f) => f.fecha === fecha).sort((a, b) => b.intento - a.intento)[0] ?? null;
}

/**
 * Todas las métricas de un deportista en una tabla: una fila por métrica y
 * protocolo, una columna por fecha (la más reciente primero). Cada jornada
 * nueva suma una columna, así la comparación es inmediata.
 *
 * El cambio (última vs. anterior) se colorea SEGÚN el sentido de la métrica:
 * en `menor_mejor` bajar es favorable; sin sentido (peso, talla) se registra
 * sin juzgar. Es evolución observada, nunca causa.
 */
export function TablaMediciones({ series, onElegir }: { series: SerieTabla[]; onElegir: (clave: string) => void }) {
  const todasLasFechas = [...new Set(series.flatMap((s) => s.filas.map((f) => f.fecha)))].sort().reverse();
  const fechas = todasLasFechas.slice(0, COLUMNAS);
  const comparar = fechas.length > 1;

  // Filas agrupadas por protocolo: 17 métricas se leen como 4 bloques cortos.
  // "General" (medidas transversales como el peso) va al final.
  const protocolos = [...new Set(series.map((s) => s.protocolo))].sort((a, b) =>
    a === "General" ? 1 : b === "General" ? -1 : a.localeCompare(b, "es"));

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-44 border-b border-border bg-card px-4 py-2 text-left text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground sm:min-w-60 sm:px-5">Métrica</th>
              {fechas.map((fecha, i) => {
                const { dia, anio } = fechaCorta(fecha);
                return (
                  <th key={fecha} scope="col" className={cn("border-b border-border px-3 py-2 text-right align-bottom", i === 0 ? "text-foreground" : "text-muted-foreground")}>
                    {i === 0 && comparar && <span className="block text-[11px] font-extrabold uppercase tracking-wide text-primary">Última</span>}
                    <span className="block whitespace-nowrap text-xs font-extrabold">{dia}</span>
                    <span className="block text-[11px] font-medium">{anio}</span>
                  </th>
                );
              })}
              {comparar && <th scope="col" className="border-b border-border px-4 py-2 text-right text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground sm:px-5">Cambio</th>}
            </tr>
          </thead>
          {protocolos.map((protocolo) => (
            <tbody key={protocolo}>
              <tr>
                <th colSpan={fechas.length + (comparar ? 2 : 1)} scope="colgroup" className="bg-muted/50 px-4 py-1.5 text-left text-[11px] font-extrabold uppercase tracking-wide text-primary sm:px-5">
                  <span className="sticky left-4 sm:left-5">{protocolo}</span>
                </th>
              </tr>
              {series.filter((s) => s.protocolo === protocolo).map((serie) => {
                const ultima = ultimoIntento(serie.filas, fechas[0]);
                const anterior = comparar ? ultimoIntento(serie.filas, fechas[1]) : null;
                const delta = ultima && anterior ? ultima.valor - anterior.valor : null;
                const favorable = delta === null || delta === 0 || serie.sentido === null
                  ? null
                  : (serie.sentido === "menor_mejor" ? delta < 0 : delta > 0);
                return (
                  <tr key={serie.clave} className="group">
                    <th scope="row" className="sticky left-0 z-10 border-b border-border bg-card px-4 py-2 text-left font-normal group-hover:bg-muted sm:px-5">
                      <button type="button" onClick={() => onElegir(serie.clave)} className="min-h-11 text-left text-sm font-bold hover:text-primary hover:underline sm:min-h-9" title="Ver la serie completa">
                        {serie.nombre}
                      </button>
                    </th>
                    {fechas.map((fecha, i) => {
                      const valores = serie.filas.filter((f) => f.fecha === fecha).sort((a, b) => a.intento - b.intento);
                      return (
                        <td key={fecha} className={cn("min-w-24 border-b border-border px-3 py-2 text-right tabular-nums group-hover:bg-muted/40", i === 0 ? "font-extrabold" : "text-muted-foreground")}>
                          {valores.length === 0 ? <span className="text-muted-foreground/60">—</span> : (
                            <span className="whitespace-nowrap">
                              {valores.map((v, j) => (
                                <span key={v.intento}>
                                  {j > 0 && <span className="text-muted-foreground"> · </span>}
                                  {valores.length > 1 && <span className="mr-0.5 text-[11px] font-semibold text-muted-foreground">{`I${v.intento}`}</span>}
                                  {NUMERO.format(v.valor)}
                                </span>
                              ))}
                              <span className="ml-1 text-[11px] font-medium text-muted-foreground">{serie.unidad}</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {comparar && (
                      <td className="border-b border-border px-4 py-2 text-right tabular-nums group-hover:bg-muted/40 sm:px-5">
                        {delta === null ? <span className="text-muted-foreground/60">—</span> : (
                          <span className={cn("inline-flex items-center justify-end gap-1 whitespace-nowrap text-xs font-extrabold",
                            favorable === true && "text-success",
                            favorable === false && "text-danger",
                            favorable === null && "text-muted-foreground")}>
                            {delta > 0 ? <ArrowUp className="size-3.5" aria-hidden /> : delta < 0 ? <ArrowDown className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
                            {`${delta > 0 ? "+" : ""}${NUMERO.format(delta)} ${serie.unidad}`}
                            <span className="sr-only">{favorable === true ? " (favorable)" : favorable === false ? " (desfavorable)" : ""}</span>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {comparar ? (
          <>
            <p>El cambio compara la última fecha con la anterior (el último intento de cada una). <span className="font-bold text-success">Verde</span> es favorable y <span className="font-bold text-danger">rojo</span> desfavorable según la métrica; sin color, se registra sin juzgar (por ejemplo, el peso).</p>
            {todasLasFechas.length > COLUMNAS && <p>{`Mostrando las ${COLUMNAS} fechas más recientes de ${todasLasFechas.length}. Tocá una métrica para ver su serie completa.`}</p>}
          </>
        ) : (
          <p>Por ahora hay una sola fecha. Cuando se lo vuelva a medir, se suma una columna y se ve el cambio de cada métrica.</p>
        )}
      </div>
    </div>
  );
}
