import { CLUBES } from "@/lib/mock-data";

// Mapa ESQUEMÁTICO de la provincia de Salta (silueta simplificada a
// mano, no cartografía real) con los clubes adheridos como puntos.
// El tamaño del punto acompaña la cantidad de deportistas.
const POSICIONES: Record<string, { x: number; y: number }> = {
  cja: { x: 148, y: 118 },
  smi: { x: 163, y: 126 },
  avl: { x: 136, y: 146 },
};

export function MapaSalta() {
  return (
    <figure className="rounded-2xl border border-border bg-card p-4">
      <figcaption className="mb-1 text-sm font-extrabold">
        Clubes en el programa
      </figcaption>
      <svg
        viewBox="0 0 340 250"
        role="img"
        aria-label={`Mapa esquemático de Salta con ${CLUBES.length} clubes adheridos`}
        className="w-full"
      >
        {/* Silueta simplificada de la provincia */}
        <path
          d="M 62 20 L 148 14 L 208 30 L 312 62 L 318 88 L 222 108
             L 208 152 L 152 178 L 138 224 L 112 206 L 84 232 L 58 198
             L 40 122 L 48 62 Z"
          fill="var(--secondary)"
          stroke="var(--border)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Muesca de Jujuy (provincia vecina, fuera del programa) */}
        <path
          d="M 96 32 L 138 28 L 148 62 L 132 92 L 100 78 L 90 48 Z"
          fill="var(--background)"
          stroke="var(--border)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <text x="114" y="62" fontSize="9" fill="var(--muted-foreground)" textAnchor="middle">
          Jujuy
        </text>

        {/* Clubes */}
        {CLUBES.map((c) => {
          const pos = POSICIONES[c.id];
          if (!pos) return null;
          const r = 5 + Math.min(6, c.deportistas / 12);
          return (
            <g key={c.id}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth="2"
                opacity={c.esEsteClub ? 1 : 0.75}
              >
                <title>{`${c.nombre} · ${c.deportistas} deportistas`}</title>
              </circle>
            </g>
          );
        })}

        {/* Referencias geográficas mínimas */}
        <text x="184" y="116" fontSize="10" fontWeight="700" fill="var(--foreground)">
          Salta Capital
        </text>
        <text x="148" y="152" fontSize="9" fill="var(--muted-foreground)">
          Cerrillos
        </text>
      </svg>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        Mapa esquemático · el tamaño del punto acompaña la cantidad de
        deportistas con trayectoria registrada.
      </p>
    </figure>
  );
}
