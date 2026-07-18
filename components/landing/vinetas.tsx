"use client";

import { useEffect, useRef, useState } from "react";
import { Check, TrendingDown } from "lucide-react";

/**
 * Las viñetas VIVAS de los diferenciales: cada una es un mini
 * demo-reel en loop — la jornada se tipea sola, la curva de talla se
 * dibuja y su zona late, el import procesa filas, el informe se
 * escribe/envía/entrega. Reglas: solo se animan cuando están en
 * pantalla (IntersectionObserver), y con prefers-reduced-motion
 * quedan quietas en su estado final completo (que es también lo que
 * renderiza el server).
 */

function useEnVista<T extends HTMLElement>(unaVez = false) {
  const ref = useRef<T>(null);
  const [activa, setActiva] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const nodo = ref.current;
    if (!nodo) return;
    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setActiva(true);
          if (unaVez) observer.disconnect();
        } else if (!unaVez) {
          setActiva(false);
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(nodo);
    return () => observer.disconnect();
  }, [unaVez]);

  return { ref, activa };
}

/* ---------- Offline: la jornada se carga sola, pibe por pibe ---------- */

const JORNADA = [
  { nombre: "Guantay, Santino", valor: "5,32" },
  { nombre: "Fernández, Thiago", valor: "5,08" },
  { nombre: "Aguirre, Mateo", valor: "5,61" },
  { nombre: "Cardozo, Lisandro", valor: "5,47" },
];

export function VinetaOffline() {
  const { ref, activa } = useEnVista<HTMLDivElement>();
  const [i, setI] = useState(0);
  // El server renderiza el valor completo: sin JS (o con reduced
  // motion) la viñeta es la versión estática terminada.
  const [chars, setChars] = useState(JORNADA[0].valor.length);
  const jugador = JORNADA[i];
  const completo = chars >= jugador.valor.length;

  useEffect(() => {
    if (!activa) return;
    const timer = setTimeout(
      () => {
        if (!completo) {
          setChars((c) => c + 1);
        } else {
          setChars(0);
          setI((v) => (v + 1) % JORNADA.length);
        }
      },
      completo ? 1700 : 300,
    );
    return () => clearTimeout(timer);
  }, [activa, completo, chars]);

  return (
    <div
      ref={ref}
      className="w-full rounded-xl border border-border bg-card p-3 text-sm shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold text-muted-foreground">
          {`Velocidad 30m · 9ª División · ${7 + i}/12`}
        </span>
        <span className="whitespace-nowrap rounded-full bg-[#f8ecdd] px-2.5 py-0.5 text-xs font-bold text-[#b45309]">
          Sin conexión
        </span>
      </div>
      <div
        key={jugador.nombre}
        className="landing-entrada mt-2.5 flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5"
      >
        <span className="font-bold">{jugador.nombre}</span>
        <span className="text-xl font-extrabold tabular-nums">
          {jugador.valor.slice(0, chars)}
          {activa && !completo && (
            <span className="landing-caret text-primary" aria-hidden>
              |
            </span>
          )}
        </span>
      </div>
      <p
        className={`mt-2.5 flex items-center gap-1.5 text-xs font-bold text-primary transition-opacity duration-300 ${
          completo ? "opacity-100" : "opacity-30"
        }`}
      >
        <Check className="size-3.5" aria-hidden />
        Borrador guardado en el celu, a cada tecla
      </p>
    </div>
  );
}

/* ---------- Estirón: la curva se dibuja y la zona late ---------- */

const PUNTOS_TALLA: [number, number][] = [
  [14, 108],
  [76, 100],
  [142, 86],
  [214, 48],
  [306, 32],
];

export function VinetaEstiron() {
  // Se dibuja una sola vez (redibujarla en cada scroll marea);
  // el latido de la zona sí queda en loop.
  const { ref, activa } = useEnVista<HTMLDivElement>(true);

  return (
    <div ref={ref} className="w-full">
      <svg
        viewBox="0 0 320 130"
        className="w-full"
        role="img"
        aria-label="Curva de talla con un tramo sombreado marcado como crecimiento acelerado, en registro."
      >
        {[30, 70, 110].map((y) => (
          <line
            key={y}
            x1="12"
            x2="308"
            y1={y}
            y2={y}
            stroke="var(--border)"
            strokeWidth="1"
          />
        ))}
        {/* Zona de aceleración: aparece después del trazo y late */}
        <g
          className={activa ? "landing-aparecer" : undefined}
          style={activa ? { animationDelay: "1.5s" } : undefined}
        >
          <rect
            x="140"
            y="14"
            width="96"
            height="102"
            fill="var(--primary)"
            opacity="0.09"
            className={activa ? "landing-zona-estiron" : undefined}
            style={activa ? { animationDelay: "2.4s" } : undefined}
          />
          <text
            x="188"
            y="26"
            fontSize="10"
            fontWeight="700"
            fill="var(--primary)"
            textAnchor="middle"
          >
            crecimiento acelerado
          </text>
        </g>
        <path
          d="M14,108 C40,106 52,103 76,100 C102,97 118,94 142,86 C166,76 190,58 214,48 C238,40 262,36 306,32"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinecap="round"
          className={activa ? "landing-curva-trazo" : undefined}
          style={
            activa
              ? ({ "--largo-trazo": 340 } as React.CSSProperties)
              : undefined
          }
        />
        {PUNTOS_TALLA.map(([cx, cy], idx) => (
          <circle
            key={cx}
            cx={cx}
            cy={cy}
            r="4.5"
            fill="var(--primary)"
            stroke="var(--card)"
            strokeWidth="2"
            className={activa ? "landing-curva-punto" : undefined}
            style={activa ? { animationDelay: `${0.35 + idx * 0.3}s` } : undefined}
          />
        ))}
        <text x="14" y="125" fontSize="10" fill="var(--muted-foreground)">
          11 años
        </text>
        <text
          x="306"
          y="125"
          fontSize="10"
          fill="var(--muted-foreground)"
          textAnchor="end"
        >
          14 años
        </text>
      </svg>
    </div>
  );
}

/* ---------- Importar: el reel de pegar la planilla ---------- */

const FILAS_IMPORT = [
  "Columnas detectadas: nombre · nacimiento · tutor",
  "Categorías resueltas por año: 2014 → Escuelita 2014",
  "2 duplicados con el plantel actual, excluidos",
];
const TOTAL_FASES = FILAS_IMPORT.length + 1; // + la fila ámbar

export function VinetaImportar() {
  const { ref, activa } = useEnVista<HTMLDivElement>();
  // SSR / reduced motion: todo visible (estado final).
  const [fase, setFase] = useState(TOTAL_FASES);

  useEffect(() => {
    if (!activa) return;
    const espera = fase === TOTAL_FASES ? 3000 : fase === 0 ? 950 : 550;
    const timer = setTimeout(
      () => setFase((f) => (f === TOTAL_FASES ? 0 : f + 1)),
      espera,
    );
    return () => clearTimeout(timer);
  }, [activa, fase]);

  const pegando = activa && fase === 0;

  return (
    <div
      ref={ref}
      className="w-full rounded-xl border border-border bg-card p-3 shadow-sm"
    >
      <p className="text-xs font-bold text-muted-foreground">
        {pegando ? (
          <>
            pegando 36 filas desde Excel
            <span className="landing-caret" aria-hidden>
              …
            </span>
          </>
        ) : (
          "plantel_2026 — 36 filas pegadas desde Excel"
        )}
      </p>
      <ul className="mt-2.5 flex flex-col gap-1.5 text-xs font-semibold">
        {FILAS_IMPORT.map((linea, idx) => (
          <li
            key={linea}
            className={`flex items-start gap-1.5 transition-all duration-500 ${
              fase > idx
                ? "translate-y-0 opacity-100"
                : "translate-y-1 opacity-0"
            }`}
          >
            <Check
              className="mt-0.5 size-3.5 shrink-0 text-primary"
              aria-hidden
            />
            {linea}
          </li>
        ))}
        <li
          className={`flex items-start gap-1.5 text-[#b45309] transition-all duration-500 ${
            fase === TOTAL_FASES
              ? "translate-y-0 opacity-100"
              : "translate-y-1 opacity-0"
          }`}
        >
          <span
            className="mt-1 size-2 shrink-0 rounded-full bg-[#b45309]"
            aria-hidden
          />
          36 consentimientos pendientes — se firman en el club
        </li>
      </ul>
    </div>
  );
}

/* ---------- WhatsApp: escribiendo → enviado → entregado ---------- */

export function VinetaWhatsapp() {
  const { ref, activa } = useEnVista<HTMLDivElement>();
  // Fases: 0 escribiendo, 1 enviado (✓), 2 entregado (✓✓).
  // SSR / reduced motion: entregado.
  const [fase, setFase] = useState(2);

  useEffect(() => {
    if (!activa) return;
    const dur = fase === 0 ? 1500 : fase === 1 ? 900 : 4200;
    const timer = setTimeout(() => setFase((f) => (f + 1) % 3), dur);
    return () => clearTimeout(timer);
  }, [activa, fase]);

  return (
    <div ref={ref} className="flex min-h-[176px] w-full items-end">
      {activa && fase === 0 ? (
        <div className="rounded-2xl rounded-tl-sm bg-secondary px-4 py-3.5 shadow-sm">
          <span className="flex items-center gap-1" aria-label="escribiendo…">
            {[0, 1, 2].map((p) => (
              <span
                key={p}
                className="landing-puntito size-1.5 rounded-full bg-muted-foreground"
                style={{ animationDelay: `${p * 0.18}s` }}
                aria-hidden
              />
            ))}
          </span>
        </div>
      ) : (
        <div className="landing-entrada w-full max-w-xs rounded-2xl rounded-tl-sm bg-secondary p-3.5 text-sm leading-relaxed text-secondary-foreground shadow-sm">
          <p className="font-extrabold">Informe — Santino G. (9ª División)</p>
          <p className="mt-1 flex items-center gap-1.5">
            Velocidad 30m: 5,32 s
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e3f2e7] px-2 py-0.5 text-xs font-bold text-[#15803d]">
              <TrendingDown className="size-3" aria-hidden />
              Mejorando
            </span>
          </p>
          <p>Asistencia del mes: 9 de 10</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Tendencia basada en sus últimas 3 mediciones.
          </p>
          <p className="mt-1 text-right text-[10px] font-semibold text-muted-foreground">
            18:07{" "}
            <span
              className={`transition-colors duration-300 ${
                fase === 2 ? "text-primary" : ""
              }`}
            >
              {fase === 2 ? "✓✓" : "✓"}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
