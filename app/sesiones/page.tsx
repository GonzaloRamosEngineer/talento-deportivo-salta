"use client";

import Link from "next/link";
import { ChevronRight, Target } from "lucide-react";
import { SESIONES, getAtributo, getCategoria } from "@/lib/mock-data";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { usePerfil, permisosDe } from "@/components/perfil-context";

function TarjetaSesion({ id }: { id: string }) {
  const s = SESIONES.find((x) => x.id === id)!;
  const fecha = new Date(s.fecha);
  const presentes = s.asistencia.filter((a) => a.presente).length;
  const esFutura = s.asistencia.length === 0;

  return (
    <Link
      href={`/sesiones/${s.id}`}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <span className="flex size-13 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary leading-none text-secondary-foreground">
        <span className="text-lg font-extrabold">{fecha.getDate()}</span>
        <span className="text-[10px] font-bold uppercase">
          {fecha.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">
          {getCategoria(s.categoriaId)?.nombre} ·{" "}
          {fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })} h
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {s.atributoFocoId && (
            <>
              <Target className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {getAtributo(s.atributoFocoId)?.nombre}
              </span>
              <span aria-hidden>·</span>
            </>
          )}
          <span className="truncate">{s.entrenador}</span>
        </span>
      </span>
      {!esFutura && (
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {presentes}/{s.asistencia.length}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export default function Sesiones() {
  const { perfil } = usePerfil();
  const permisos = permisosDe(perfil);

  if (!permisos.veClub) {
    return (
      <AvisoAcceso
        titulo="La plataforma no ve sesiones de clubes"
        detalle="Las sesiones y su asistencia son operación interna de cada club. El perfil de plataforma solo ve el observatorio con agregados."
        accionHref="/observatorio"
        accionLabel="Ir al observatorio"
      />
    );
  }

  const hoy = new Date("2026-07-06T00:00:00");
  // El profesor ve solo las sesiones de sus categorías asignadas
  const alcance = permisos.categorias
    ? SESIONES.filter((s) => permisos.categorias!.includes(s.categoriaId))
    : SESIONES;
  const ordenadas = [...alcance].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const proximas = ordenadas
    .filter((s) => new Date(s.fecha) >= hoy)
    .reverse();
  const pasadas = ordenadas.filter((s) => new Date(s.fecha) < hoy);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Sesiones</h1>
        <p className="text-sm text-muted-foreground">
          Entrenamientos con su foco de trabajo y asistencia
        </p>
      </div>

      {proximas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-extrabold">Próximas</h2>
          {proximas.map((s) => (
            <TarjetaSesion key={s.id} id={s.id} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-extrabold">Últimas</h2>
        {pasadas.map((s) => (
          <TarjetaSesion key={s.id} id={s.id} />
        ))}
      </section>
    </div>
  );
}
