"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Target, X } from "lucide-react";
import {
  DEPORTISTAS,
  SESIONES,
  getAtributo,
  getCategoria,
} from "@/lib/mock-data";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { usePerfil, permisosDe } from "@/components/perfil-context";
import { cn } from "@/lib/utils";

export default function PaginaSesion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { perfil } = usePerfil();
  const permisos = permisosDe(perfil);
  const sesion = SESIONES.find((s) => s.id === id);
  if (!sesion) notFound();

  if (!permisos.veClub) {
    return (
      <AvisoAcceso
        titulo="La plataforma no ve sesiones de clubes"
        detalle="Las sesiones son operación interna de cada club; la plataforma solo ve agregados."
        accionHref="/observatorio"
        accionLabel="Ir al observatorio"
      />
    );
  }
  if (permisos.categorias && !permisos.categorias.includes(sesion.categoriaId)) {
    return (
      <AvisoAcceso
        titulo="Fuera de tus categorías"
        detalle={`Esta sesión es de ${getCategoria(sesion.categoriaId)?.nombre}, fuera de tus categorías asignadas.`}
        accionHref="/sesiones"
        accionLabel="Ver tus sesiones"
      />
    );
  }

  const fecha = new Date(sesion.fecha);
  const categoria = getCategoria(sesion.categoriaId);
  const foco = sesion.atributoFocoId ? getAtributo(sesion.atributoFocoId) : null;
  const esFutura = sesion.asistencia.length === 0;
  const convocados = esFutura
    ? DEPORTISTAS.filter((d) => d.categoriaId === sesion.categoriaId).map(
        (d) => ({ deportistaId: d.id, presente: null as boolean | null }),
      )
    : sesion.asistencia;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/sesiones"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Sesiones
      </Link>

      <div>
        <h1 className="text-xl font-extrabold capitalize tracking-tight">
          {fecha.toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}{" "}
          ·{" "}
          {fecha.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}{" "}
          h
        </h1>
        <p className="text-sm text-muted-foreground">
          {categoria?.nombre} · {sesion.entrenador}
        </p>
      </div>

      {foco && (
        <div className="flex items-center gap-2.5 rounded-xl bg-secondary px-3.5 py-3 text-sm font-semibold text-secondary-foreground">
          <Target className="size-4 shrink-0" aria-hidden />
          Foco de la sesión: {foco.nombre}
        </div>
      )}

      <p className="rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed">
        {sesion.descripcion}
      </p>

      <section className="rounded-2xl border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-extrabold">
          {esFutura
            ? `Convocados (${convocados.length})`
            : `Asistencia (${sesion.asistencia.filter((a) => a.presente).length}/${sesion.asistencia.length})`}
        </h2>
        <ul>
          {convocados.map(({ deportistaId, presente }) => {
            const d = DEPORTISTAS.find((x) => x.id === deportistaId);
            if (!d) return null;
            return (
              <li key={deportistaId} className="border-b border-border last:border-0">
                <Link
                  href={`/deportistas/${d.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <AvatarIniciales
                    nombre={d.nombre}
                    apellido={d.apellido}
                    className="size-8 text-xs"
                  />
                  <span className="flex-1 truncate text-sm font-semibold">
                    {d.apellido}, {d.nombre}
                  </span>
                  {presente !== null && (
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                        presente
                          ? "bg-success-soft text-success"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {presente ? (
                        <Check className="size-3" aria-hidden />
                      ) : (
                        <X className="size-3" aria-hidden />
                      )}
                      {presente ? "Presente" : "Ausente"}
                    </span>
                  )}
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
