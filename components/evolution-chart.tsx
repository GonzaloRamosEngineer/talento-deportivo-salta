"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Atributo, Medicion } from "@/lib/mock-data";
import { formatFecha } from "@/lib/mock-data";

const VERDE = "#15803d";
const SUPERFICIE = "#fcfcfa";
const GRILLA = "#e4e7e0";
const EJE = "#d5dbd4";
const TINTA_MUTED = "#8a948c";
const TINTA = "#17211b";

interface Punto {
  label: string;
  fechaLarga: string;
  valor: number;
  entrenador: string;
}

function ChartTooltip({
  active,
  payload,
  unidad,
}: {
  active?: boolean;
  payload?: { payload: Punto }[];
  unidad: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{p.fechaLarga}</p>
      <p className="text-base font-extrabold text-foreground">
        {p.valor.toLocaleString("es-AR")}{" "}
        <span className="text-xs font-semibold text-muted-foreground">
          {unidad}
        </span>
      </p>
      <p className="text-[11px] text-muted-foreground">Midió: {p.entrenador}</p>
    </div>
  );
}

// Etiqueta directa SOLO en el último punto (labeling selectivo)
function makeEndLabel(total: number, unidad: string) {
  return function EndLabel(props: {
    x?: number | string;
    y?: number | string;
    index?: number;
    value?: unknown;
  }) {
    const { x, y, index, value } = props;
    if (index !== total - 1 || x == null || y == null) return <g />;
    return (
      <text
        x={Number(x)}
        y={Number(y) - 14}
        textAnchor="end"
        fill={TINTA}
        fontSize={13}
        fontWeight={800}
      >
        {Number(value).toLocaleString("es-AR")} {unidad}
      </text>
    );
  };
}

export function EvolutionChart({
  serie,
  atributo,
  hitos,
}: {
  serie: Medicion[];
  atributo: Atributo;
  /** eventos de trayectoria (ingreso, cambio de categoría) — líneas verticales */
  hitos?: { fecha: string; evento: string }[];
}) {
  // En series que cruzan años, la etiqueta corta "12 mar" es ambigua:
  // pasa a "mar 24".
  const multiAnio =
    serie.length > 1 &&
    new Date(serie[0].fecha).getFullYear() !==
      new Date(serie[serie.length - 1].fecha).getFullYear();

  // La etiqueta debe ser ÚNICA por punto (el eje es categórico y las
  // categorías duplicadas rompen el posicionamiento y las líneas de hito).
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const data: Punto[] = serie.map((m) => {
    const d = new Date(m.fecha + "T12:00:00");
    return {
      label: multiAnio
        ? `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
        : formatFecha(m.fecha),
      fechaLarga: d.toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      valor: m.valor,
      entrenador: m.entrenador,
    };
  });

  // Cada hito se ancla al primer punto medido desde su fecha.
  const hitosEnRango = (hitos ?? [])
    .map((h) => {
      const idx = serie.findIndex((m) => m.fecha >= h.fecha);
      return idx === -1
        ? null
        : { evento: h.evento, x: data[idx].label, alInicio: idx < serie.length / 2 };
    })
    .filter(Boolean) as { evento: string; x: string; alInicio: boolean }[];

  const valores = serie.map((m) => m.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const pad = Math.max((max - min) * 0.25, (atributo.escalaMax - atributo.escalaMin) * 0.02);

  return (
    <div className="h-64 w-full md:h-72" role="img" aria-label={`Evolución de ${atributo.nombre}`}>
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 360, height: 256 }}
      >
        <AreaChart data={data} margin={{ top: 24, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="evolucion-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={VERDE} stopOpacity={0.16} />
              <stop offset="100%" stopColor={VERDE} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRILLA} strokeWidth={1} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: TINTA_MUTED }}
            tickLine={false}
            axisLine={{ stroke: EJE }}
            minTickGap={28}
            tickMargin={8}
          />
          <YAxis
            width={40}
            domain={[
              (dataMin: number) => Number((dataMin - pad).toFixed(1)),
              (dataMax: number) => Number((dataMax + pad).toFixed(1)),
            ]}
            tick={{ fontSize: 11, fill: TINTA_MUTED }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => v.toLocaleString("es-AR")}
          />
          {hitosEnRango.map((h) => (
            <ReferenceLine
              key={h.evento}
              x={h.x}
              stroke={TINTA_MUTED}
              strokeWidth={1}
              label={{
                value: h.evento,
                position: h.alInicio ? "insideTopLeft" : "insideTopRight",
                fontSize: 10,
                fill: "#5f6d63",
              }}
            />
          ))}
          <Tooltip
            content={<ChartTooltip unidad={atributo.unidad} />}
            cursor={{ stroke: EJE, strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="valor"
            stroke={VERDE}
            strokeWidth={2}
            fill="url(#evolucion-fill)"
            dot={{ r: 4, fill: VERDE, stroke: SUPERFICIE, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: VERDE, stroke: SUPERFICIE, strokeWidth: 2 }}
            label={makeEndLabel(data.length, atributo.unidad)}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
