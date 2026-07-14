import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Estado vacío que ENSEÑA: cada pantalla sin datos explica qué va acá
// y ofrece el botón que lo resuelve (si el rol puede hacerlo). Borde
// punteado = "lugar reservado", mismo lenguaje en toda la app.

export function EstadoVacio({
  icono: Icono,
  titulo,
  detalle,
  accion,
  nota,
}: {
  icono: React.ElementType;
  titulo: string;
  detalle: string;
  /** botón que resuelve el vacío; omitir si el rol no puede operar */
  accion?: { href: string; label: string };
  /** aclaración chica bajo el botón (ej. a quién pedirle el alta) */
  nota?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
        <Icono className="size-6" aria-hidden />
      </span>
      <div className="max-w-sm">
        <p className="text-sm font-bold">{titulo}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detalle}</p>
      </div>
      {accion && (
        <Link
          href={accion.href}
          className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-transform active:scale-[0.98]"
        >
          {accion.label}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
      {nota && (
        <p className="max-w-sm text-[11px] leading-snug text-muted-foreground">
          {nota}
        </p>
      )}
    </div>
  );
}
