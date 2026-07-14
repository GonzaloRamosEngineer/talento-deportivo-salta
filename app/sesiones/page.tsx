"use client";

import Link from "next/link";
import { CalendarDays, Loader2, MapPin, Plus } from "lucide-react";
import { DIAS } from "@/lib/mock-data";
import { useDatos } from "@/lib/use-datos";
import { useAgenda, lunesDe } from "@/lib/use-agenda";
import { EventoCard } from "@/components/evento-card";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { Ayuda } from "@/components/ayuda";
import { EstadoVacio } from "@/components/estado-vacio";
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
  const datos = useDatos();
  const agenda = useAgenda(datos);

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

  if (agenda.cargando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  const hoy = agenda.hoy;
  const eventos = [
    ...agenda.sesiones.map((sesion) => ({
      tipo: "sesion" as const,
      fecha: sesion.fecha,
      sesion,
    })),
    ...agenda.partidos.map((partido) => ({
      tipo: "partido" as const,
      fecha: partido.fecha,
      partido,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Semana de lunes a domingo alrededor de HOY (real o demo)
  const lunes = lunesDe(hoy);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d;
  });

  const resultados = agenda.partidos
    .filter((p) => new Date(p.fecha) < hoy)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 8);

  const categoriasConRutina = datos.categorias.filter((c) =>
    agenda.horarios.some((h) => h.categoriaId === c.id),
  );
  const esAdmin = agenda.real && permisos.gestiona;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            {permisos.categorias
              ? "Entrenamientos y partidos de tus categorías"
              : "Entrenamientos y partidos del club"}
          </p>
        </div>
        {agenda.real && permisos.opera && (
          <Link
            href="/partidos/nuevo"
            className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <Plus className="size-4" aria-hidden /> Partido
          </Link>
        )}
      </div>

      {agenda.error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm font-semibold text-destructive">
          No se pudo cargar la agenda: {agenda.error}
        </p>
      )}

      <Ayuda
        bullets={[
          "La semana se arma sola con el cronograma fijo de cada categoría: cada horario aparece como sesión programada.",
          "Al pasar lista la sesión queda registrada como realizada; solo se anotan las ausencias, el resto cuenta presente.",
          "Los partidos se cargan aparte, con su citación; el resultado se completa después, desde el detalle del partido.",
        ]}
      />

      {/* Sin cronograma todavía: guía al que puede resolverlo */}
      {agenda.real && agenda.horarios.length === 0 && (
        <EstadoVacio
          icono={CalendarDays}
          titulo="Todavía no hay cronograma semanal"
          detalle={
            esAdmin
              ? "Cargá los días y horarios fijos de cada categoría y la agenda se arma sola, semana a semana."
              : "Cuando la administración del club cargue los horarios fijos de tus categorías, acá vas a ver la semana armada."
          }
          accion={
            esAdmin
              ? { href: "/club/agenda", label: "Armar cronograma" }
              : undefined
          }
        />
      )}

      {/* ---------- Esta semana ---------- */}
      {/* Sin cronograma ni eventos, los 7 días en "Sin actividad" no
          suman nada: el estado vacío de arriba ya explica todo. */}
      {(agenda.horarios.length > 0 || eventos.length > 0) && (
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
          const esHoy = mismaFecha(dia, hoy);
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
                    agenda={agenda}
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
      )}

      {/* ---------- Resultados recientes ---------- */}
      {resultados.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-extrabold">Resultados recientes</h2>
          {resultados.map((p) => (
            <EventoCard
              key={p.id}
              evento={{ tipo: "partido", fecha: p.fecha, partido: p }}
              agenda={agenda}
              conFecha
            />
          ))}
          <p className="px-1 text-[11px] leading-snug text-muted-foreground">
            En escuelitas no se registra marcador: son encuentros formativos.
          </p>
        </section>
      )}

      {/* ---------- Cronograma semanal (la rutina) ---------- */}
      {categoriasConRutina.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-extrabold">Cronograma semanal</h2>
            {esAdmin && (
              <Link href="/club/agenda" className="text-sm font-semibold text-primary">
                Editar
              </Link>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card">
            {categoriasConRutina.map((c) => {
              const horarios = agenda.horarios.filter(
                (h) => h.categoriaId === c.id,
              );
              const lugar = agenda.lugares.find(
                (l) => l.id === horarios[0]?.lugarId,
              );
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
                    {lugar?.nombre ?? "Lugar a definir"} ·{" "}
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
      )}
    </div>
  );
}
