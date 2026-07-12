"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Revela su contenido al entrar al viewport (una sola vez).
 * El estilo vive en globals.css (.revelable/.revelado) y respeta
 * prefers-reduced-motion. `demora` en ms, para escalonar hermanos.
 */
export function Reveal({
  children,
  demora = 0,
  className,
}: {
  children: React.ReactNode;
  demora?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;
    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          nodo.style.transitionDelay = `${demora}ms`;
          nodo.classList.add("revelado");
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(nodo);
    return () => observer.disconnect();
  }, [demora]);

  return (
    <div ref={ref} className={cn("revelable", className)}>
      {children}
    </div>
  );
}
