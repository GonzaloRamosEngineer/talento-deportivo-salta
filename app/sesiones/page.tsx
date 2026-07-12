"use client";

import { CalendarDays, MapPin } from "lucide-react";
import {
  CATEGORIAS,
  DIAS,
  HOY_DEMO,
  PARTIDOS,
  cronogramaDe,
  eventosDe,
  getLugar,
} from "@/lib/mock-data";
import { EventoCard } from "@/components/evento-card";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { usePerfil } from "@/components/perfil-context";
import { cn } from "@/lib/utils";

function mismaFecha(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function Agenda() {
  const { permisos } = usePerfil();

  if (!permisos.veClub) {
    return (
      <AvisoAcceso
        titulo="La plataforma no ve agendas de clubes"
        detalle="Entrenamientos y partidos son operación interna de cada club. El perfil de plataforma solo ve el observatorio con agregados."
        accionHref="/observatorio"
        accionLabel="Ir al observatorio"
      />
    );
  }

  const eventos = eventosDe(permisos.categorias);

  // Semana demo: de lunes a domingo alrededor de HOY_DEMO
  const lunes = new Date(HOY_DEMO);
  lunes.setDate(HOY_DEMO.getDate() - ((HOY_DEMO.getDay() + 6) % 7));
  lunes.setHours(0, 0, 0, 0);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d;
  });

  const resultados = PARTIDOS.filter(
    (p) =>
      new Date(p.fecha) < HOY_DEMO &&
      (!permisos.categorias || permisos.categorias.includes(p.categoriaId)),
  ).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const cronograma = cronogramaDe(permisos.categorias);
  const categoriasConRutina = CATEGORIAS.filter((c) =>
    cronograma.some((h) => h.categoriaId === c.id),
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          {permisos.categorias
            ? "Entrenamientos y partidos de tus categorías"
            : "Entrenamientos y partidos del club"}
        </p>
      </div>

      {/* ---------- Esta semana ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-extrabold">
          Esta semana{" "}
          <span className="text-sm font-semibold text-muted-foreground">
            ({dias[0].getDate()} al {dias[6].getDate()} de{" "}
            {dias[6].toLocaleDateString("es-AR", { month: "long" })})
          </span>
        </h2>
        {dias.map((dia) => {
          const delDia = eventos.filter((e) =>
            mismaFecha(new Date(e.fecha), dia),
          );
          const esHoy = mismaFecha(dia, HOY_DEMO);
          return (
            <div key={dia.toISOString()} className="flex flex-col gap-1.5">
              <p
                className={cn(
                  "flex items-center gap-2 text-xs font-bold uppercase tracking-wide",
                  esHoy ? "text-primary" : "text-muted-foreground",
                )}
              >
                {dia.toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "numeric",
                })}
                {esHoy && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                    Hoy
                  </span>
                )}
              </p>
              {delDia.length > 0 ? (
                delDia.map((e) => (
                  <EventoCard
                    key={e.tipo === "sesion" ? e.sesion.id : e.partido.id}
                    evento={e}
                  />
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-border px-3.5 py-2 text-xs text-muted-foreground">
                  Sin actividad
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* ---------- Resultados recientes ---------- */}
      {resultados.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-extrabold">Resultados recientes</h2>
          {resultados.map((p) => (
            <EventoCard
              key={p.id}
              evento={{ tipo: "partido", fecha: p.fecha, partido: p }}
              conFecha
            />
          ))}
          <p className="px-1 text-[11px] leading-snug text-muted-foreground">
            En escuelitas no se registra marcador: son encuentros formativos.
          </p>
        </section>
      )}

      {/* ---------- Cronograma semanal (la rutina) ---------- */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-extrabold">Cronograma semanal</h2>
        <div className="rounded-2xl border border-border bg-card">
          {categoriasConRutina.map((c) => {
            const horarios = cronograma.filter((h) => h.categoriaId === c.id);
            return (
              <div
                key={c.id}
                className="border-b border-border px-4 py-3 last:border-0"
              >
                <p className="text-sm font-bold">{c.nombre}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3 shrink-0" aria-hidden />
                  {horarios
                    .map(
                      (h) =>
                        `${DIAS[h.diaSemana - 1].slice(0, 3)} ${h.hora}`,
                    )
                    .join(" · ")}
                  <span aria-hidden>—</span>
                  <MapPin className="size-3 shrink-0" aria-hidden />
                  {getLugar(horarios[0]?.lugarId)?.nombre} ·{" "}
                  {horarios[0]?.entrenador}
                </p>
              </div>
            );
          })}
        </div>
        <p className="px-1 text-[11px] leading-snug text-muted-foreground">
          La rutina fija de cada categoría. Las sesiones del día salen de
          acá; los cambios de horario o lugar los gestiona la administración
          del club.
        </p>
      </section>
    </div>
  );
}
