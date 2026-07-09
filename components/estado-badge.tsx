import { TrendingUp, TrendingDown, MoveRight, NotebookPen, CircleDashed } from "lucide-react";
import type { Estado } from "@/lib/tendencia";
import { cn } from "@/lib/utils";

// Estado SIEMPRE con icono + texto, nunca color solo (accesibilidad CVD).
const CONFIG: Record<
  Estado,
  { label: string; icon: React.ElementType; className: string }
> = {
  creciendo: {
    label: "Creciendo",
    icon: TrendingUp,
    className: "bg-success-soft text-success",
  },
  amesetado: {
    label: "Amesetado",
    icon: MoveRight,
    className: "bg-warning-soft text-warning",
  },
  en_baja: {
    label: "En baja",
    icon: TrendingDown,
    className: "bg-danger-soft text-danger",
  },
  registro: {
    label: "En registro",
    icon: NotebookPen,
    className: "bg-muted text-muted-foreground",
  },
  sin_datos: {
    label: "Faltan mediciones",
    icon: CircleDashed,
    className: "bg-muted text-muted-foreground",
  },
};

export function EstadoBadge({
  estado,
  className,
}: {
  estado: Estado;
  className?: string;
}) {
  const { label, icon: Icon, className: colors } = CONFIG[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        colors,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
