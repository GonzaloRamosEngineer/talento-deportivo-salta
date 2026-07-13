"use client";

import { useState } from "react";
import Image from "next/image";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Escudo del club: la imagen si existe (bucket público `escudos`),
 * y si no —o si falla la carga— un placeholder sobrio con el ícono
 * de escudo. Mismo tamaño en ambos casos para no mover el layout.
 * `unoptimized`: la imagen ya vive en el CDN de Supabase Storage.
 */
export function EscudoClub({
  url,
  nombre,
  className,
}: {
  url?: string | null;
  nombre: string;
  className?: string;
}) {
  const [fallo, setFallo] = useState(false);

  if (!url || fallo) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-secondary-foreground",
          className ?? "size-10",
        )}
        aria-label={`Escudo de ${nombre} (pendiente)`}
      >
        <Shield className="size-[55%]" aria-hidden />
      </span>
    );
  }

  return (
    <Image
      src={url}
      alt={`Escudo de ${nombre}`}
      width={96}
      height={96}
      unoptimized
      onError={() => setFallo(true)}
      className={cn(
        "shrink-0 rounded-xl border border-border bg-white object-contain p-0.5",
        className ?? "size-10",
      )}
    />
  );
}
