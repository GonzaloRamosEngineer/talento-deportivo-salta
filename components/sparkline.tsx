// Sparkline en SVG puro: liviano para listas largas en celulares
// de gama baja (sin montar Recharts por fila).
export function Sparkline({
  valores,
  width = 72,
  height = 26,
}: {
  valores: number[];
  width?: number;
  height?: number;
}) {
  if (valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const span = max - min || 1;
  const px = 3;
  const puntos = valores.map((v, i) => {
    const x = px + (i / (valores.length - 1)) * (width - px * 2);
    const y = height - px - ((v - min) / span) * (height - px * 2);
    return [x, y] as const;
  });
  const path = puntos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ux, uy] = puntos[puntos.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="shrink-0"
    >
      <polyline
        points={path}
        fill="none"
        stroke="#15803d"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <circle cx={ux} cy={uy} r={2.5} fill="#15803d" stroke="#fcfcfa" strokeWidth={1.5} />
    </svg>
  );
}
