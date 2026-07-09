// Barra segmentada 1-10 para habilidades técnicas (apreciación del
// entrenador). Diez segmentos, sin dots de juego: tokens del sistema.
export function NivelBar({ nivel }: { nivel: number }) {
  const lleno = Math.round(Math.min(10, Math.max(0, nivel)));
  return (
    <span
      className="flex w-24 items-center gap-0.5 sm:w-28"
      role="img"
      aria-label={`${nivel.toLocaleString("es-AR")} de 10`}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={`h-3.5 flex-1 rounded-[2px] ${
            i < lleno ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </span>
  );
}
