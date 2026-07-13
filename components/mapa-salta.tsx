"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import type { ClubResumen } from "@/lib/mock-data";
import {
  SALTA_DEPARTAMENTOS,
  SALTA_VIEWBOX,
} from "@/lib/salta-departamentos";
import { cn } from "@/lib/utils";

// Mapa REAL de Salta: los 23 departamentos con geometría oficial del
// IGN. Tocá/pasá por un departamento para verlo resaltado con sus
// métricas agregadas. Coropletas: un solo tono (verde) que escala con
// la cantidad de deportistas; sin clubes = superficie neutra.
interface StatsDepto {
  clubes: string[];
  deportistas: number;
  medicionesMes: number;
}

const SIN_DATOS = "var(--muted)";

export function MapaSalta({ clubes }: { clubes: ClubResumen[] }) {
  const [seleccionado, setSeleccionado] = useState<string>("Capital");
  const [hovered, setHovered] = useState<string | null>(null);

  const stats = useMemo(() => {
    const porDepto = new Map<string, StatsDepto>();
    for (const c of clubes) {
      if (!c.departamento) continue; // sin ubicación cargada: no se mapea
      const s = porDepto.get(c.departamento) ?? {
        clubes: [],
        deportistas: 0,
        medicionesMes: 0,
      };
      s.clubes.push(c.nombre);
      s.deportistas += c.deportistas;
      s.medicionesMes += c.medicionesMes;
      porDepto.set(c.departamento, s);
    }
    return porDepto;
  }, [clubes]);

  const maxDeportistas = Math.max(
    1,
    ...Array.from(stats.values()).map((s) => s.deportistas),
  );

  // Rampa secuencial de UN tono: más deportistas = verde más profundo
  const rellenoDe = (nombre: string) => {
    const s = stats.get(nombre);
    if (!s) return SIN_DATOS;
    const t = s.deportistas / maxDeportistas; // 0..1
    return t > 0.6 ? "#15803d" : t > 0.25 ? "#4f9d6e" : "#8cc1a3";
  };

  const detalle = stats.get(seleccionado);

  return (
    <figure className="rounded-2xl border border-border bg-card p-4">
      <figcaption className="mb-1 text-sm font-extrabold">
        La provincia, departamento por departamento
      </figcaption>
      <p className="mb-2 text-xs text-muted-foreground">
        Tocá un departamento para ver sus datos del programa.
      </p>

      <svg
        viewBox={SALTA_VIEWBOX}
        role="group"
        aria-label="Mapa de los 23 departamentos de Salta"
        className="w-full"
      >
        {SALTA_DEPARTAMENTOS.map((depto) => {
          const activo = seleccionado === depto.nombre;
          const sobre = hovered === depto.nombre;
          return (
            <path
              key={depto.id}
              d={depto.d}
              role="button"
              tabIndex={0}
              aria-label={`${depto.nombre}${stats.has(depto.nombre) ? "" : " (sin clubes en el programa)"}`}
              aria-pressed={activo}
              fill={rellenoDe(depto.nombre)}
              stroke={activo || sobre ? "#15803d" : "var(--card)"}
              strokeWidth={activo ? 2.5 : sobre ? 2 : 1}
              opacity={sobre && !activo ? 0.85 : 1}
              className="cursor-pointer outline-none transition-[opacity] focus-visible:stroke-[#15803d] focus-visible:stroke-2"
              onMouseEnter={() => setHovered(depto.nombre)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setSeleccionado(depto.nombre)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSeleccionado(depto.nombre);
                }
              }}
            >
              <title>{depto.nombre}</title>
            </path>
          );
        })}
      </svg>

      {/* Leyenda de la rampa */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-8 rounded-[3px] bg-gradient-to-r from-[#8cc1a3] to-[#15803d]" />
          Con clubes (más verde = más deportistas)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-muted" />
          Sin clubes en el programa aún
        </span>
      </div>

      {/* Panel del departamento seleccionado */}
      <div className="mt-3 rounded-xl border border-border bg-background p-3.5">
        <p className="flex items-center gap-1.5 text-sm font-extrabold">
          <MapPin className="size-4 text-primary" aria-hidden />
          {seleccionado}
          {hovered && hovered !== seleccionado && (
            <span className="text-xs font-medium text-muted-foreground">
              (viendo: {hovered})
            </span>
          )}
        </p>
        {detalle ? (
          <>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <div>
                <p className="text-xl font-extrabold tabular-nums">
                  {detalle.clubes.length}
                </p>
                <p className="text-[11px] font-medium text-muted-foreground">
                  {detalle.clubes.length === 1 ? "club" : "clubes"}
                </p>
              </div>
              <div>
                <p className="text-xl font-extrabold tabular-nums">
                  {detalle.deportistas}
                </p>
                <p className="text-[11px] font-medium text-muted-foreground">
                  deportistas
                </p>
              </div>
              <div>
                <p className="text-xl font-extrabold tabular-nums">
                  {detalle.medicionesMes}
                </p>
                <p className="text-[11px] font-medium text-muted-foreground">
                  medic./mes
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {detalle.clubes.join(" · ")}
            </p>
          </>
        ) : (
          <p className={cn("mt-1.5 text-sm text-muted-foreground")}>
            Sin clubes en el programa todavía —{" "}
            <span className="font-semibold text-foreground">
              oportunidad de expansión
            </span>
            . El objetivo provincial es que este mapa se pinte de verde.
          </p>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Límites departamentales: Instituto Geográfico Nacional (IGN).
        Métricas agregadas por departamento; nunca datos individuales.
      </p>
    </figure>
  );
}
