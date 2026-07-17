"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardList,
  Eye,
  Lightbulb,
  ListOrdered,
  MessagesSquare,
  Ruler,
  X,
} from "lucide-react";
import type { Atributo } from "@/lib/mock-data";
import {
  GUIA_PENDIENTE_REVISION,
  guiaDe,
  type DiagramaMedicion,
  type GuiaMedicion,
} from "@/lib/como-medir";
import { cn } from "@/lib/utils";
import { SugerenciaGuia } from "@/components/sugerencia-guia";

// Drawer "¿Cómo medir?" — Módulo B (negocio/10). Refuerza la
// comparabilidad provincial: el protocolo escrito es lo que hace que
// una Velocidad 30m valga lo mismo acá y en cualquier club. Cerrado
// por defecto (misma filosofía que components/ayuda.tsx): el que lo
// necesita lo abre.

const NARANJA_CONO = "#e07b39";

function Cono({ x, y, escala = 1 }: { x: number; y: number; escala?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <path d="M0 0 L4 -11 L8 0 Z" fill={NARANJA_CONO} />
      <rect x="-2" y="-1" width="12" height="2.5" rx="1" fill={NARANJA_CONO} />
      <path d="M1.6 -4.5 h4.8" stroke="white" strokeWidth="1.6" />
    </g>
  );
}

function Jugador({
  x,
  y,
  pose = "parado",
}: {
  x: number;
  y: number;
  pose?: "parado" | "corriendo" | "saltando";
}) {
  const cuerpo =
    pose === "corriendo"
      ? "M0 -22 L1 -12 M1 -12 L-5 -4 M1 -12 L7 -3 M0 -19 L-6 -14 M0 -19 L6 -16"
      : pose === "saltando"
        ? "M0 -22 L0 -12 M0 -12 L-4 -4 M0 -12 L4 -4 M0 -19 L-5 -27 M0 -19 L5 -27"
        : "M0 -22 L0 -12 M0 -12 L-3 -2 M0 -12 L3 -2 M0 -19 L-5 -13 M0 -19 L5 -13";
  return (
    <g
      transform={`translate(${x} ${y})`}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      fill="none"
      className="text-foreground/70"
    >
      <circle cx="0" cy="-26.5" r="3.8" fill="currentColor" stroke="none" />
      <path d={cuerpo} />
    </g>
  );
}

function Diagrama({ tipo }: { tipo: DiagramaMedicion }) {
  const campo = "fill-success-soft";
  const linea = { stroke: "white", strokeWidth: 2.5 } as const;
  const label =
    "fill-muted-foreground text-[9px] font-bold uppercase tracking-wide";

  if (tipo === "velocidad30") {
    return (
      <svg viewBox="0 0 320 110" className="w-full" role="img" aria-label="Pista de 30 metros con conos en la salida y la llegada">
        <rect x="0" y="18" width="320" height="74" rx="10" className={campo} />
        <line x1="46" y1="26" x2="46" y2="84" {...linea} />
        <line x1="274" y1="26" x2="274" y2="84" {...linea} />
        <Cono x={38} y={24} />
        <Cono x={38} y={92} />
        <Cono x={266} y={24} />
        <Cono x={266} y={92} />
        <line
          x1="62"
          y1="55"
          x2="248"
          y2="55"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="5 6"
          className="text-primary"
        />
        <path d="M248 55 l-9 -5 v10 Z" fill="currentColor" className="text-primary" />
        <Jugador x={56} y={82} pose="corriendo" />
        <text x="160" y="46" textAnchor="middle" className="fill-primary text-[11px] font-extrabold">
          30 m
        </text>
        <text x="46" y="10" textAnchor="middle" className={label}>
          Salida
        </text>
        <text x="318" y="10" textAnchor="end" className={label}>
          Llegada · acá el crono
        </text>
      </svg>
    );
  }

  if (tipo === "cooper") {
    return (
      <svg viewBox="0 0 320 120" className="w-full" role="img" aria-label="Circuito con conos para el test de Cooper de 12 minutos">
        <rect x="14" y="14" width="292" height="92" rx="42" className={campo} />
        <rect
          x="34"
          y="32"
          width="252"
          height="56"
          rx="28"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
        />
        <Cono x={155} y={30} escala={0.85} />
        <Cono x={278} y={64} escala={0.85} />
        <Cono x={155} y={104} escala={0.85} />
        <Cono x={28} y={64} escala={0.85} />
        <path
          d="M110 32 h60"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 5"
          className="text-primary"
          fill="none"
        />
        <path d="M172 32 l-8 -4.5 v9 Z" fill="currentColor" className="text-primary" />
        <Jugador x={92} y={44} pose="corriendo" />
        <text x="160" y="60" textAnchor="middle" className="fill-primary text-[13px] font-extrabold">
          12 min
        </text>
        <text x="160" y="74" textAnchor="middle" className={label}>
          conos a distancia conocida
        </text>
      </svg>
    );
  }

  if (tipo === "salto") {
    return (
      <svg viewBox="0 0 320 120" className="w-full" role="img" aria-label="Salto vertical: marca de alcance y marca de salto contra la pared">
        <rect x="0" y="100" width="320" height="10" rx="4" className={campo} />
        <rect x="228" y="4" width="12" height="102" rx="3" className="fill-muted" />
        <line x1="212" y1="66" x2="228" y2="66" stroke="currentColor" strokeWidth="2.5" className="text-muted-foreground" />
        <line x1="212" y1="22" x2="228" y2="22" stroke="currentColor" strokeWidth="2.5" className="text-primary" />
        <path
          d="M204 66 v-44"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 4"
          className="text-primary"
          fill="none"
        />
        <path d="M204 26 l-4.5 8 h9 Z" fill="currentColor" className="text-primary" />
        <text x="196" y="70" textAnchor="end" className={label}>
          alcance parado
        </text>
        <text x="196" y="26" textAnchor="end" className="fill-primary text-[10px] font-extrabold uppercase tracking-wide">
          marca del salto
        </text>
        <text x="196" y="46" textAnchor="end" className="fill-primary text-[11px] font-extrabold">
          diferencia = cm
        </text>
        <Jugador x={252} y={98} pose="saltando" />
        <Jugador x={60} y={98} pose="parado" />
      </svg>
    );
  }

  if (tipo === "talla") {
    return (
      <svg viewBox="0 0 320 120" className="w-full" role="img" aria-label="Medición de talla contra la pared con escuadra">
        <rect x="0" y="106" width="320" height="8" rx="4" className={campo} />
        <rect x="196" y="0" width="12" height="108" rx="3" className="fill-muted" />
        <Jugador x={178} y={104} pose="parado" />
        <rect x="168" y="70" width="28" height="5" rx="2" fill={NARANJA_CONO} />
        <line
          x1="228"
          y1="72"
          x2="228"
          y2="106"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 4"
          className="text-primary"
        />
        <line x1="222" y1="72" x2="234" y2="72" stroke="currentColor" strokeWidth="2.5" className="text-primary" />
        <text x="240" y="92" className="fill-primary text-[11px] font-extrabold">
          cm
        </text>
        <text x="8" y="62" className={label}>
          escuadra o libro rígido
        </text>
        <text x="8" y="94" className={label}>
          descalzo, talones a la pared
        </text>
      </svg>
    );
  }

  // peso
  return (
    <svg viewBox="0 0 320 110" className="w-full" role="img" aria-label="Pesaje en balanza sobre piso firme">
      <rect x="0" y="96" width="320" height="10" rx="4" className={campo} />
      <rect x="140" y="86" width="56" height="10" rx="3" className="fill-muted" />
      <rect x="156" y="76" width="24" height="8" rx="2" fill={NARANJA_CONO} />
      <Jugador x={168} y={86} pose="parado" />
      <text x="216" y="84" className={label}>
        balanza en cero
      </text>
      <text x="216" y="96" className={label}>
        piso firme y parejo
      </text>
      <text x="120" y="90" textAnchor="end" className="fill-primary text-[11px] font-extrabold">
        kg
      </text>
    </svg>
  );
}

function SeccionTitulo({
  icono: Icono,
  children,
}: {
  icono: typeof Ruler;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
      <Icono className="size-3.5 shrink-0" aria-hidden />
      {children}
    </h3>
  );
}

function DrawerComoMedir({
  atributo,
  guia,
  onCerrar,
}: {
  atributo: Atributo;
  guia: GuiaMedicion;
  onCerrar: () => void;
}) {
  const subjetivo = atributo.naturaleza === "subjetivo";

  useEffect(() => {
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onTecla);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onTecla);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cómo ${subjetivo ? "puntuar" : "medir"} ${atributo.nombre}`}
        className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-border bg-background shadow-2xl md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:w-[560px] md:max-h-[85dvh] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:border"
      >
        <div className="sticky top-0 flex items-start gap-3 border-b border-border bg-background/95 px-5 pt-4 pb-3 backdrop-blur">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold tracking-tight">
              ¿Cómo se {subjetivo ? "puntúa" : "mide"} {atributo.nombre}?
            </h2>
            <p className="text-xs font-semibold text-muted-foreground">
              {subjetivo
                ? "Apreciación 1-10 a criterio del entrenador"
                : `Medición con protocolo · se registra en ${atributo.unidad}`}
            </p>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-4 pb-8">
          {GUIA_PENDIENTE_REVISION && (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-[11px] font-semibold leading-snug text-warning">
              Contenido base del catálogo — pendiente de revisión del
              preparador físico de la Fundación.
            </p>
          )}

          {!subjetivo && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Medir siempre igual es lo que hace comparable la curva: el mismo
              protocolo acá, en la próxima jornada y en cualquier club.
            </p>
          )}

          {guia.diagrama && (
            <div className="rounded-2xl border border-border bg-card p-3">
              <Diagrama tipo={guia.diagrama} />
            </div>
          )}

          {guia.materiales && (
            <section className="flex flex-col gap-2">
              <SeccionTitulo icono={ClipboardList}>
                Qué llevar a la cancha
              </SeccionTitulo>
              <ul className="flex flex-wrap gap-1.5">
                {guia.materiales.map((m) => (
                  <li
                    key={m}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"
                  >
                    {m}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <SeccionTitulo icono={ListOrdered}>
              {subjetivo ? "Cómo puntuar" : "Paso a paso"}
            </SeccionTitulo>
            <ol className="flex flex-col gap-2">
              {guia.pasos.map((p, i) => (
                <li key={p} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-extrabold text-secondary-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0">{p}</span>
                </li>
              ))}
            </ol>
          </section>

          {guia.queMirar && (
            <section className="flex flex-col gap-2">
              <SeccionTitulo icono={Eye}>En qué fijarse</SeccionTitulo>
              <ul className="flex flex-col gap-1.5">
                {guia.queMirar.map((q) => (
                  <li key={q} className="flex gap-2 text-sm leading-relaxed">
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60"
                      aria-hidden
                    />
                    <span className="min-w-0">{q}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {guia.consejo && (
            <div className="flex items-start gap-2.5 rounded-xl bg-secondary/60 p-3.5 text-sm leading-relaxed">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p className="min-w-0 flex-1">{guia.consejo}</p>
            </div>
          )}

          {guia.notaRegistro && (
            <div className="rounded-xl border border-border bg-card p-3.5 text-sm leading-relaxed text-muted-foreground">
              {guia.notaRegistro}
            </div>
          )}

          {guia.ideas && (
            <section className="flex flex-col gap-2">
              <SeccionTitulo icono={MessagesSquare}>
                Ideas de trabajo
              </SeccionTitulo>
              <p className="text-[11px] font-semibold leading-snug text-muted-foreground">
                Ideas para conversar con el cuerpo técnico — no es una
                prescripción ni una receta por edad. Qué trabajar y cuánto lo
                decide el profesional que conoce al grupo.
              </p>
              <ul className="flex flex-col gap-1.5">
                {guia.ideas.map((idea) => (
                  <li key={idea} className="flex gap-2 text-sm leading-relaxed">
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60"
                      aria-hidden
                    />
                    <span className="min-w-0">{idea}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <SugerenciaGuia guia={atributo.nombre} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ComoMedirInterno({
  atributo,
  guia,
  variante,
  className,
}: {
  atributo: Atributo;
  guia: GuiaMedicion;
  variante: "medir" | "ideas";
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const subjetivo = atributo.naturaleza === "subjetivo";
  const Icono =
    variante === "ideas" ? MessagesSquare : subjetivo ? Eye : Ruler;
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
      >
        <Icono className="size-3.5 shrink-0 text-primary" aria-hidden />
        {variante === "ideas"
          ? `Ideas de trabajo: ${atributo.nombre}`
          : `¿Cómo se ${subjetivo ? "puntúa" : "mide"}?`}
      </button>
      {abierto && (
        <DrawerComoMedir
          atributo={atributo}
          guia={guia}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}

export function ComoMedir({
  atributo,
  variante = "medir",
  className,
}: {
  atributo: Atributo;
  /** "ideas": trigger pensado para el tablero (mismo drawer) */
  variante?: "medir" | "ideas";
  className?: string;
}) {
  // La clave del contenido es el NOMBRE: puente estable mock↔DB
  const guia = guiaDe(atributo.nombre);
  if (!guia) return null;
  return (
    <ComoMedirInterno
      atributo={atributo}
      guia={guia}
      variante={variante}
      className={className}
    />
  );
}
