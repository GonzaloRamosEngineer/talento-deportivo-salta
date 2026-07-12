import { TrendingDown } from "lucide-react";

/**
 * La curva héroe de la landing: una serie real de Velocidad 30m que
 * MEJORA — y como el atributo es `menor_mejor`, la línea BAJA. Ese
 * es el gesto de marca: la honestidad del dato hecha imagen ("acá,
 * bajar es una buena noticia"). Se dibuja sola al cargar (CSS puro,
 * respeta reduced-motion). Sigue las reglas del gráfico de DESIGN.md:
 * línea 2px, puntos con anillo, área en degradado suave, grilla
 * hairline sólida, etiqueta directa solo en el último punto.
 */

// Serie: 8 mediciones de Velocidad 30m (segundos), mar 2025 → jul 2026
const PUNTOS: { x: number; y: number; delay: number }[] = [
  { x: 40, y: 54, delay: 0.35 },
  { x: 126, y: 86, delay: 0.65 },
  { x: 211, y: 107, delay: 0.95 },
  { x: 297, y: 112, delay: 1.25 },
  { x: 383, y: 143, delay: 1.55 },
  { x: 469, y: 182, delay: 1.85 },
  { x: 554, y: 213, delay: 2.1 },
  { x: 640, y: 266, delay: 2.4 },
];

const TRAZO =
  "M40,54 C83,54 83,86 126,86 C168,86 168,107 211,107 C254,107 254,112 297,112 " +
  "C340,112 340,143 383,143 C426,143 426,182 469,182 C511,182 511,213 554,213 " +
  "C597,213 597,266 640,266";

const GRILLA = [
  { y: 64, etiqueta: "5,8s" },
  { y: 136, etiqueta: "5,5s" },
  { y: 208, etiqueta: "5,2s" },
  { y: 280, etiqueta: "4,9s" },
];

export function CurvaHero() {
  return (
    <figure className="relative">
      <svg
        viewBox="0 0 800 340"
        role="img"
        aria-label="Curva de evolución de Velocidad 30 metros: de 5,84 a 4,96 segundos en 16 meses. En este atributo, bajar es mejorar."
        className="w-full"
        style={{ "--largo-trazo": 700 } as React.CSSProperties}
      >
        <defs>
          <linearGradient id="area-curva" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grilla horizontal hairline con eje recesivo */}
        {GRILLA.map(({ y, etiqueta }) => (
          <g key={y}>
            <line
              x1="40"
              x2="760"
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x="766"
              y={y + 4}
              fontSize="12"
              fill="var(--muted-foreground)"
              className="font-sans"
            >
              {etiqueta}
            </text>
          </g>
        ))}

        {/* Fechas, solo extremos: el eje no compite con la curva */}
        <text x="40" y="322" fontSize="12" fill="var(--muted-foreground)">
          mar 2025
        </text>
        <text
          x="640"
          y="322"
          fontSize="12"
          fill="var(--muted-foreground)"
          textAnchor="middle"
        >
          jul 2026
        </text>

        {/* Área bajo la curva */}
        <path
          d={`${TRAZO} L640,300 L40,300 Z`}
          fill="url(#area-curva)"
          className="landing-entrada"
          style={{ animationDelay: "1.6s" }}
        />

        {/* La línea de evolución */}
        <path
          d={TRAZO}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="landing-curva-trazo"
        />

        {/* Puntos con anillo de superficie */}
        {PUNTOS.map(({ x, y, delay }, i) => {
          const ultimo = i === PUNTOS.length - 1;
          return (
            <circle
              key={x}
              cx={x}
              cy={y}
              r={ultimo ? 7 : 5}
              fill="var(--primary)"
              stroke="var(--card)"
              strokeWidth="2.5"
              className="landing-curva-punto"
              style={{ animationDelay: `${delay}s` }}
            />
          );
        })}

        {/* Etiqueta directa SOLO en el último punto */}
        <g className="landing-entrada" style={{ animationDelay: "2.55s" }}>
          <rect
            x="586"
            y="222"
            width="108"
            height="30"
            rx="8"
            fill="var(--foreground)"
          />
          <text
            x="640"
            y="242"
            fontSize="15"
            fontWeight="800"
            fill="var(--background)"
            textAnchor="middle"
          >
            4,96 s
          </text>
        </g>
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e3f2e7] px-3 py-1 font-bold text-[#15803d]">
          <TrendingDown className="size-3.5" aria-hidden />
          Mejorando
        </span>
        <span className="text-muted-foreground">
          −0,88&nbsp;s en 16 meses · basado en las últimas 3 mediciones
        </span>
        <span className="font-marker rotate-[-1deg] text-xl font-bold text-primary">
          sí, la línea baja: son segundos. Acá bajar es ganar ↘
        </span>
      </figcaption>
    </figure>
  );
}
