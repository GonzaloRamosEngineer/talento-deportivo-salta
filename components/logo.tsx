import { cn } from "@/lib/utils";

/**
 * Marca de Talento Deportivo Salta: la curva de evolución sobre la
 * baldosa verde césped. Tres puntos de medición (la tendencia "últimas
 * 3 mediciones") y el último con anillo, igual que en el gráfico héroe.
 * Fuente única del dibujo: mantener en sincronía con app/icon.svg,
 * public/logo.svg y scripts/generar-iconos.mjs.
 */
export function LogoTalento({
  className,
  variante = "baldosa",
}: {
  className?: string;
  /** "baldosa": marca completa. "curva": solo la curva en blanco, para
   *  apoyar sobre un fondo de color propio (ej. la baldosa del login). */
  variante?: "baldosa" | "curva";
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      aria-hidden
      focusable="false"
    >
      {variante === "baldosa" && (
        <rect width="64" height="64" rx="18" fill="#15803D" />
      )}
      {/* Línea por los 3 puntos y nodos con "anillo de superficie"
          (el mismo tratamiento que la spec del gráfico en DESIGN.md),
          con el último punto más grande: la medición más reciente. */}
      <path
        d="M13.5 45.5 29 36.5 50 18"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="13.5" cy="45.5" r="5" fill="#fff" stroke="#15803D" strokeWidth="2.6" />
      <circle cx="29" cy="36.5" r="5" fill="#fff" stroke="#15803D" strokeWidth="2.6" />
      <circle cx="50" cy="18" r="6.8" fill="#fff" stroke="#15803D" strokeWidth="2.6" />
    </svg>
  );
}
