"use client";

import { useEffect, useRef, useState } from "react";

import { PelotaDoodle } from "@/components/pelota-doodle";

/**
 * La pelota de la landing. Se patea con el mouse (o con el dedo):
 * física propia —gravedad, pique, rodada, efecto— dentro de una
 * franja de cancha con arco a la derecha. Si la embocás, golazo.
 * Decorativa y aria-hidden: no bloquea nada, no scrollea nada
 * (touch-action: pan-y). Con prefers-reduced-motion queda quieta.
 */

const R = 24; // radio de la pelota en px
const PISO = 22; // alto de la franja de pasto bajo la línea de cal
const ARCO_ANCHO = 78;
const ARCO_ALTO = 96;

export function Pelota() {
  const contRef = useRef<HTMLDivElement>(null);
  const bolaRef = useRef<HTMLDivElement>(null);
  const [golazos, setGolazos] = useState(0);
  const [grito, setGrito] = useState(false);
  const [pateada, setPateada] = useState(false);

  useEffect(() => {
    const cont = contRef.current;
    const bola = bolaRef.current;
    if (!cont || !bola) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let W = cont.offsetWidth;
    let H = cont.offsetHeight;
    const ro = new ResizeObserver(() => {
      W = cont.offsetWidth;
      H = cont.offsetHeight;
    });
    ro.observe(cont);

    // Estado físico (px, px/s)
    let x = Math.min(W * 0.22, 260);
    let y = H - PISO - R;
    let vx = 0;
    let vy = 0;
    let rot = 0;
    let enGol = false;
    let ultimoPique = 0;

    // Velocidad del puntero (para que el pase fuerte pegue fuerte)
    let px = -999;
    let py = -999;
    let pt = 0;
    let pvx = 0;
    let pvy = 0;
    let ultimaPatada = 0;

    let visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(cont);

    const patear = (dirX: number, dirY: number, fuerza: number) => {
      const ahora = performance.now();
      if (ahora - ultimaPatada < 130) return;
      ultimaPatada = ahora;
      vx = dirX * fuerza;
      vy = Math.min(dirY * fuerza * 0.6 - fuerza * 0.38, -260);
      setPateada(true);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = cont.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const ahora = performance.now();
      if (pt > 0) {
        const dt = Math.max((ahora - pt) / 1000, 0.008);
        pvx = (mx - px) / dt;
        pvy = (my - py) / dt;
      }
      px = mx;
      py = my;
      pt = ahora;

      const dx = x - mx;
      const dy = y - my;
      const dist = Math.hypot(dx, dy);
      const esTap = e.type === "pointerdown";
      if (dist < R + (esTap ? 26 : 12) && !enGol) {
        const rapidez = Math.hypot(pvx, pvy);
        const fuerza = esTap
          ? 760
          : Math.min(360 + rapidez * 0.55, 1500);
        const d = Math.max(dist, 1);
        patear(dx / d, dy / d, fuerza);
      }
    };

    cont.addEventListener("pointermove", onPointer);
    cont.addEventListener("pointerdown", onPointer);

    let raf = 0;
    let tPrev = performance.now();

    const paso = (t: number) => {
      raf = requestAnimationFrame(paso);
      const dt = Math.min((t - tPrev) / 1000, 0.032);
      tPrev = t;
      if (!visible || dt <= 0) return;

      const piso = H - PISO - R;
      const enElPiso = y >= piso - 0.5;

      // Gravedad + rozamiento
      vy += 2400 * dt;
      if (enElPiso) vx *= Math.exp(-1.7 * dt);
      else vx *= Math.exp(-0.12 * dt);

      x += vx * dt;
      y += vy * dt;
      rot += vx * dt * 0.55;

      // Pique contra el piso
      if (y > piso) {
        y = piso;
        if (Math.abs(vy) > 70) {
          vy = -vy * 0.56;
          ultimoPique = t;
        } else {
          vy = 0;
        }
      }
      // Paredes (la izquierda y el travesaño del mundo)
      if (x < R) {
        x = R;
        vx = Math.abs(vx) * 0.72;
      }
      if (y < R) {
        y = R;
        vy = Math.abs(vy) * 0.6;
      }

      // ¿Gol? La boca del arco está pegada al borde derecho.
      const lineaDeGol = W - ARCO_ANCHO + R * 0.4;
      const bajoElTravesano = y > H - PISO - ARCO_ALTO + R;
      if (!enGol && x > lineaDeGol && bajoElTravesano) {
        enGol = true;
        vx *= 0.12;
        setGolazos((g) => g + 1);
        setGrito(true);
        setTimeout(() => setGrito(false), 1600);
        setTimeout(() => {
          x = Math.min(W * 0.22, 260);
          y = H - PISO - R;
          vx = 0;
          vy = 0;
          enGol = false;
        }, 950);
      }
      // Tope del fondo del arco
      if (x > W - R * 0.9) {
        x = W - R * 0.9;
        vx = -Math.abs(vx) * 0.3;
      }

      const squash =
        t - ultimoPique < 90 ? "scale(1.06,0.94)" : "scale(1,1)";
      bola.style.transform = `translate(${x - R}px, ${y - R}px) rotate(${rot}rad) ${squash}`;
    };
    raf = requestAnimationFrame(paso);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      cont.removeEventListener("pointermove", onPointer);
      cont.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <div
      ref={contRef}
      aria-hidden
      className="relative h-44 w-full select-none overflow-hidden"
      style={{ touchAction: "pan-y" }}
    >
      {/* Línea de cal + pasto */}
      <div
        className="absolute inset-x-0 bottom-0 bg-[#e9f1ea]"
        style={{ height: PISO }}
      />
      <div
        className="absolute inset-x-0 border-t-2 border-dashed border-primary/25"
        style={{ bottom: PISO }}
      />

      {/* El arco (derecha) */}
      <svg
        className="absolute right-0"
        style={{ bottom: PISO, width: ARCO_ANCHO, height: ARCO_ALTO }}
        viewBox={`0 0 ${ARCO_ANCHO} ${ARCO_ALTO}`}
        fill="none"
      >
        {/* red */}
        {[14, 28, 42, 56, 70].map((xx) => (
          <line
            key={`v${xx}`}
            x1={xx}
            y1={6}
            x2={xx}
            y2={ARCO_ALTO}
            stroke="var(--border)"
            strokeWidth="1"
          />
        ))}
        {[24, 44, 64, 84].map((yy) => (
          <line
            key={`h${yy}`}
            x1={4}
            y1={yy}
            x2={ARCO_ANCHO}
            y2={yy}
            stroke="var(--border)"
            strokeWidth="1"
          />
        ))}
        {/* poste y travesaño */}
        <path
          d={`M2,${ARCO_ALTO} L2,4 L${ARCO_ANCHO},4`}
          stroke="var(--foreground)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>

      {/* ¡Golazo! */}
      {grito && (
        <p className="font-marker absolute right-16 top-2 rotate-[-6deg] text-4xl font-bold text-primary">
          ¡¡GOLAZO!!
        </p>
      )}
      {golazos > 0 && !grito && (
        <p className="font-marker absolute right-4 top-2 rotate-[-3deg] text-lg text-muted-foreground">
          {golazos === 1 ? "1 gol" : `${golazos} goles`} ⚽
        </p>
      )}

      {/* Pista para que la descubran */}
      {!pateada && (
        <p className="font-marker absolute bottom-1 left-2 rotate-[-2deg] text-lg text-muted-foreground">
          psst… la pelota se patea ⟶
        </p>
      )}

      {/* La pelota */}
      <div ref={bolaRef} className="absolute left-0 top-0 will-change-transform">
        <PelotaDoodle size={R * 2} fondo className="block text-foreground" />
      </div>
    </div>
  );
}
