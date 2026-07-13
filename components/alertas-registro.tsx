"use client";

import Link from "next/link";
import { CalendarClock, ChevronRight, ClipboardX, UserRoundX } from "lucide-react";
import type { Datos } from "@/lib/use-datos";
import { formatFecha } from "@/lib/mock-data";

// Alertas de constancia de registro (riesgo #1 del producto: que el
// club deje de medir). Todo se calcula de lo que ya trae useDatos —
// nada nuevo sale de la base. Framing honesto: señalan AUSENCIA de
// registro, nunca juzgan el rendimiento.

const DIAS_ALERTA = 21; // 3 semanas sin medir una categoría

interface Alerta {
  key: string;
  icon: React.ElementType;
  titulo: string;
  detalle: string;
  href: string;
}

export function AlertasRegistro({
  datos,
  hoy,
  opera,
}: {
  datos: Datos;
  /** ancla temporal (HOY_DEMO en la demo, hoy real con sesión) */
  hoy: Date;
  /** el perfil puede cargar → los CTA van a /medicion */
  opera: boolean;
}) {
  if (datos.deportistas.length === 0) return null;

  const alertas: Alerta[] = [];

  for (const c of datos.categorias) {
    const plantel = datos.deportistas.filter((d) => d.categoriaId === c.id);
    if (plantel.length === 0) continue;

    let ultima = "";
    for (const d of plantel) {
      for (const serie of Object.values(d.mediciones)) {
        const f = serie[serie.length - 1]?.fecha ?? "";
        if (f > ultima) ultima = f;
      }
    }

    const destino = opera
      ? `/medicion?categoria=${c.id}`
      : `/deportistas?categoria=${c.id}`;

    if (!ultima) {
      alertas.push({
        key: `sin-datos-${c.id}`,
        icon: ClipboardX,
        titulo: `${c.nombre} todavía no tiene mediciones`,
        detalle: `${plantel.length} en el plantel, sin registro para la curva de evolución`,
        href: destino,
      });
      continue;
    }

    const dias = Math.floor(
      (hoy.getTime() - new Date(ultima + "T12:00:00").getTime()) / 86400000,
    );
    if (dias >= DIAS_ALERTA) {
      alertas.push({
        key: `sin-medir-${c.id}`,
        icon: CalendarClock,
        titulo: `${c.nombre} no mide hace ${Math.floor(dias / 7)} semanas`,
        detalle: `Última jornada: ${formatFecha(ultima)}. Sin registro, la curva queda con huecos.`,
        href: destino,
      });
    }
  }

  // Chicos que nunca tuvieron su primera medición (en categorías que
  // sí vienen midiendo — si la categoría entera no mide, ya hay alerta)
  const conAlertaDeCategoria = new Set(
    alertas.map((a) => a.key.replace(/^(sin-datos-|sin-medir-)/, "")),
  );
  const sinPrimera = datos.deportistas.filter(
    (d) =>
      !conAlertaDeCategoria.has(d.categoriaId) &&
      Object.values(d.mediciones).flat().length === 0,
  );
  if (sinPrimera.length > 0) {
    const nombres = sinPrimera
      .slice(0, 3)
      .map((d) => `${d.nombre} ${d.apellido}`.trim())
      .join(", ");
    alertas.push({
      key: "sin-primera",
      icon: UserRoundX,
      titulo:
        sinPrimera.length === 1
          ? "1 deportista sin su primera medición"
          : `${sinPrimera.length} deportistas sin su primera medición`,
      detalle: `${nombres}${sinPrimera.length > 3 ? "…" : ""} — todavía sin punto de partida`,
      href: "/deportistas",
    });
  }

  if (alertas.length === 0) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-base font-extrabold">Para estar encima</h2>
      <div className="flex flex-col gap-2">
        {alertas.map(({ key, icon: Icon, titulo, detalle, href }) => (
          <Link
            key={key}
            href={href}
            className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-3.5 transition-colors hover:border-warning/60"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
              <Icon className="size-4.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-foreground">{titulo}</span>
              <span className="block text-xs text-muted-foreground">{detalle}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>
      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        Señalan falta de registro, no rendimiento: sin mediciones periódicas la
        evolución no se puede seguir.
      </p>
    </section>
  );
}
