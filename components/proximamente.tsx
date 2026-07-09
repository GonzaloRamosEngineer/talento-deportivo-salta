import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Probadita del potencial de la herramienta: features del roadmap,
// mostradas como cards apagadas y honestas — nunca como algo que ya
// existe. "Próximamente" = decidido en el roadmap; "A evaluar" =
// idea a discutir (p. ej. tras el piloto).
export function Proximamente({
  titulo,
  detalle,
  etiqueta,
}: {
  titulo: string;
  detalle: string;
  etiqueta: "Próximamente" | "A evaluar";
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Sparkles className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted-foreground">
          {titulo}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              etiqueta === "Próximamente"
                ? "bg-secondary text-secondary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {etiqueta}
          </span>
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {detalle}
        </p>
      </div>
    </div>
  );
}

export function EnElRadar({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-extrabold">En el radar</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
