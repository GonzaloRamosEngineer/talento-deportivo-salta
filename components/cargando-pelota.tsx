"use client";

import { PelotaDoodle } from "@/components/pelota-doodle";

/**
 * Estado de carga con identidad: la pelota doodle pica hasta el arco
 * y... ¡gol! Reemplaza al spinner genérico en las cargas de página.
 * Decorativo (aria-hidden) con texto accesible para lectores de
 * pantalla. Con prefers-reduced-motion la pelota queda quieta.
 */
export function CargandoPelota({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 py-20"
      role="status"
      aria-live="polite"
    >
      <div className="relative h-[96px] w-[200px] select-none" aria-hidden>
        {/* línea de cal */}
        <div className="absolute inset-x-0 bottom-[14px] border-t-2 border-dashed border-primary/25" />

        {/* el arco */}
        <svg
          className="absolute bottom-[16px] right-0"
          width="44"
          height="56"
          viewBox="0 0 44 56"
          fill="none"
        >
          {[10, 19, 28, 37].map((x) => (
            <line
              key={`v${x}`}
              x1={x}
              y1={5}
              x2={x}
              y2={56}
              stroke="var(--border)"
              strokeWidth="1"
            />
          ))}
          {[14, 26, 38, 50].map((y) => (
            <line
              key={`h${y}`}
              x1={3}
              y1={y}
              x2={44}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
            />
          ))}
          <path
            d="M2,56 L2,3 L44,3"
            stroke="var(--foreground)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>

        {/* ¡gol! */}
        <p className="tds-carga-gol font-marker absolute right-0 top-0 rotate-[-6deg] text-xl font-bold text-primary">
          ¡gol!
        </p>

        {/* la pelota: corre, pica dos veces y entra al arco */}
        <div className="tds-carga-x absolute bottom-[16px] left-2">
          <div className="tds-carga-y">
            <PelotaDoodle size={26} fondo className="tds-carga-rot block text-foreground" />
          </div>
        </div>
      </div>
      <p className="text-sm font-semibold text-muted-foreground">{texto}</p>

      <style>{`
        .tds-carga-x {
          animation: tds-carga-x 2.4s linear infinite;
        }
        .tds-carga-y {
          animation: tds-carga-y 2.4s infinite;
        }
        .tds-carga-rot {
          animation: tds-carga-rot 2.4s linear infinite;
        }
        .tds-carga-gol {
          opacity: 0;
          animation: tds-carga-gol 2.4s infinite;
        }
        @keyframes tds-carga-x {
          0% { transform: translateX(0); opacity: 0; }
          8% { transform: translateX(0); opacity: 1; }
          62% { transform: translateX(160px); }
          90% { transform: translateX(160px); opacity: 1; }
          96%, 100% { transform: translateX(160px); opacity: 0; }
        }
        @keyframes tds-carga-y {
          0%, 8% { transform: translateY(0); animation-timing-function: ease-out; }
          22% { transform: translateY(-34px); animation-timing-function: ease-in; }
          36% { transform: translateY(0); animation-timing-function: ease-out; }
          46% { transform: translateY(-18px); animation-timing-function: ease-in; }
          56% { transform: translateY(0); animation-timing-function: ease-out; }
          60% { transform: translateY(-6px); animation-timing-function: ease-in; }
          64%, 100% { transform: translateY(0); }
        }
        @keyframes tds-carga-rot {
          0% { transform: rotate(0deg); }
          62%, 100% { transform: rotate(720deg); }
        }
        @keyframes tds-carga-gol {
          0%, 62% { opacity: 0; transform: scale(0.5) rotate(-6deg); }
          68% { opacity: 1; transform: scale(1) rotate(-6deg); }
          86% { opacity: 1; }
          94%, 100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tds-carga-x, .tds-carga-y, .tds-carga-rot, .tds-carga-gol {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
