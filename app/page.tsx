"use client";

import Link from "next/link";
import {
  ChevronRight,
  ClipboardPlus,
  Dumbbell,
  ShieldAlert,
  CalendarDays,
} from "lucide-react";
import { usePerfil, puedeCargar } from "@/components/perfil-context";
import {
  ATRIBUTOS,
  CATEGORIAS,
  DEPORTISTAS,
  SESIONES,
  formatFecha,
  getAtributo,
  getCategoria,
} from "@/lib/mock-data";
import { tendencia } from "@/lib/tendencia";
import { EstadoBadge } from "@/components/estado-badge";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { Sparkline } from "@/components/sparkline";

// Selección curada para el prototipo: una evolución positiva, una en
// baja y una amesetada, para mostrar los tres estados en el home.
const DESTACADOS: { deportistaId: string; atributoId: string }[] = [
  { deportistaId: "d01", atributoId: "velocidad30" },
  { deportistaId: "d05", atributoId: "salto" },
  { deportistaId: "d03", atributoId: "velocidad30" },
];

export default function Inicio() {
  const { perfil } = usePerfil();
  const hoy = new Date();
  const proximas = SESIONES.filter((s) => new Date(s.fecha) >= hoy).sort(
    (a, b) => a.fecha.localeCompare(b.fecha),
  );
  const proxima = proximas[0];
  const sinConsentimiento = DEPORTISTAS.filter((d) => !d.consentimientoOk);
  const medicionesJunio = DEPORTISTAS.reduce(
    (acc, d) =>
      acc +
      Object.values(d.mediciones)
        .flat()
        .filter((m) => m.fecha.startsWith("2026-06")).length,
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Hola, Marcela 👋</h1>
        <p className="text-sm text-muted-foreground">
          {hoy.toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      {/* CTA principal: la carga es el corazón del producto */}
      {puedeCargar(perfil) && (
        <>
          <Link
            href="/medicion"
            className="flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm transition-transform active:scale-[0.99]"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <ClipboardPlus className="size-6" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-base font-extrabold">
                Nueva jornada de medición
              </span>
              <span className="block text-sm text-primary-foreground/80">
                Cargá un atributo para toda una categoría, de corrido
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 opacity-80" aria-hidden />
          </Link>
          <Link
            href="/entrenamiento"
            className="-mt-2 flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Dumbbell className="size-4.5" aria-hidden />
            </span>
            <span className="flex-1 text-sm font-bold">
              Tablero de entrenamiento
              <span className="block text-xs font-medium text-muted-foreground">
                Asigná áreas de trabajo a tu plantel
              </span>
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Link>
        </>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-2xl font-extrabold">{DEPORTISTAS.length}</p>
          <p className="text-xs font-medium text-muted-foreground">
            deportistas activos
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <p className="text-2xl font-extrabold">{medicionesJunio}</p>
          <p className="text-xs font-medium text-muted-foreground">
            mediciones en junio
          </p>
        </div>
        <Link
          href="/deportistas"
          className="rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-warning/40"
        >
          <p className="flex items-center gap-1 text-2xl font-extrabold">
            {sinConsentimiento.length}
            {sinConsentimiento.length > 0 && (
              <ShieldAlert className="size-4 text-warning" aria-hidden />
            )}
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            consentimientos pendientes
          </p>
        </Link>
      </div>

      {/* Próxima sesión */}
      {proxima && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-extrabold">Próxima sesión</h2>
            <Link
              href="/sesiones"
              className="text-sm font-semibold text-primary"
            >
              Ver todas
            </Link>
          </div>
          <Link
            href={`/sesiones/${proxima.id}`}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">
                {getCategoria(proxima.categoriaId)?.nombre} ·{" "}
                {formatFecha(proxima.fecha)} ·{" "}
                {new Date(proxima.fecha).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}{" "}
                h
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {proxima.atributoFocoId
                  ? `Foco: ${getAtributo(proxima.atributoFocoId)?.nombre}`
                  : "Sin foco definido"}{" "}
                · {proxima.entrenador}
              </span>
            </span>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </Link>
        </section>
      )}

      {/* Evoluciones destacadas — el diferencial, visible desde el home */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-extrabold">Evoluciones para mirar</h2>
          <Link href="/deportistas" className="text-sm font-semibold text-primary">
            Ver todos
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {DESTACADOS.map(({ deportistaId, atributoId }) => {
            const d = DEPORTISTAS.find((x) => x.id === deportistaId)!;
            const a = ATRIBUTOS.find((x) => x.id === atributoId)!;
            const serie = d.mediciones[atributoId] ?? [];
            const t = tendencia(serie, a);
            return (
              <Link
                key={deportistaId + atributoId}
                href={`/deportistas/${d.id}?atributo=${a.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
              >
                <AvatarIniciales nombre={d.nombre} apellido={d.apellido} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {d.nombre} {d.apellido}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {a.nombre} · {CATEGORIAS.find((c) => c.id === d.categoriaId)?.nombre}
                  </span>
                </span>
                <Sparkline valores={serie.map((m) => m.valor)} />
                <EstadoBadge estado={t.estado} />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
