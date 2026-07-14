import { CircleHelp } from "lucide-react";

// Ayuda contextual mínima para pantallas densas: un desplegable
// discreto, cerrado por defecto, con MÁXIMO 3 bullets (se recorta acá
// mismo para que la regla no dependa de disciplina en cada pantalla).
// Sin tours ni overlays: la pantalla se explica sola cuando hace falta.

export function Ayuda({
  titulo = "¿Cómo funciona esta pantalla?",
  bullets,
}: {
  titulo?: string;
  bullets: string[];
}) {
  return (
    <details className="group rounded-xl border border-border bg-card/50">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <CircleHelp className="size-4 shrink-0" aria-hidden />
        {titulo}
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70 group-open:hidden">
          Ver
        </span>
      </summary>
      <ul className="flex flex-col gap-1.5 px-3.5 pt-0.5 pb-3 text-xs leading-relaxed text-muted-foreground">
        {bullets.slice(0, 3).map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
