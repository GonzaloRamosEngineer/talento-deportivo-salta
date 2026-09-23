"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Buscador del Espacio Secretaría. 16 px en mobile (con menos, el iPhone hace
 * zoom al tocarlo), 48 px de alto y botón para borrar. La comparación va por
 * `paraBuscar()` de lib/utils: sin tildes, mayúsculas ni espacios.
 */
export function CampoBusqueda({ valor, onCambio, etiqueta, placeholder, className }: {
  valor: string;
  onCambio: (valor: string) => void;
  etiqueta: string;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={cn("flex h-12 min-w-0 items-center gap-2 rounded-xl border border-input bg-card px-3 text-muted-foreground focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50", className)}>
      <Search className="size-4 shrink-0" aria-hidden />
      <input
        value={valor}
        onChange={(evento) => onCambio(evento.target.value)}
        aria-label={etiqueta}
        placeholder={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
      />
      {valor && (
        <button type="button" onClick={() => onCambio("")} aria-label="Borrar búsqueda" className="-mr-1 grid size-9 shrink-0 place-items-center rounded-lg hover:bg-muted">
          <X className="size-4" aria-hidden />
        </button>
      )}
    </label>
  );
}
