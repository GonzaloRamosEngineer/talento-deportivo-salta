"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, Info, MapPin, Trophy } from "lucide-react";
import {
  DEPORTISTAS,
  HOY_DEMO,
  getCategoria,
  getPartido,
  lugarDePartido,
} from "@/lib/mock-data";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { usePerfil } from "@/components/perfil-context";

export default function PaginaPartido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { permisos } = usePerfil();
  const partido = getPartido(id);
  if (!partido) notFound();

  if (!permisos.veClub) {
    return (
      <AvisoAcceso
        titulo="La plataforma no ve partidos de clubes"
        detalle="La competencia es operación interna de cada club; la plataforma solo ve agregados."
        accionHref="/observatorio"
        accionLabel="Ir al observatorio"
      />
    );
  }
  if (permisos.categorias && !permisos.categorias.includes(partido.categoriaId)) {
    return (
      <AvisoAcceso
        titulo="Fuera de tus categorías"
        detalle={`Este partido es de ${getCategoria(partido.categoriaId)?.nombre}, fuera de tus categorías asignadas.`}
        accionHref="/sesiones"
        accionLabel="Ver tu agenda"
      />
    );
  }

  const categoria = getCategoria(partido.categoriaId);
  const esEscuelita = categoria?.tipo === "escuelita";
  const fecha = new Date(partido.fecha);
  const jugado = fecha < HOY_DEMO;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/sesiones"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Agenda
      </Link>

      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Trophy className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold tracking-tight">
            {esEscuelita ? "Encuentro" : "Partido"} vs {partido.rival}
          </h1>
          <p className="text-sm text-muted-foreground">
            {categoria?.nombre} · {partido.torneo}
          </p>
        </div>
      </div>

      {/* Resultado (o su ausencia deliberada) */}
      {jugado &&
        (partido.resultado ? (
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Resultado
            </p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums">
              {partido.resultado.favor} – {partido.resultado.contra}
            </p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {partido.resultado.favor > partido.resultado.contra
                ? "Victoria"
                : partido.resultado.favor === partido.resultado.contra
                  ? "Empate"
                  : "Derrota"}{" "}
              · {partido.condicion === "local" ? "de local" : "de visitante"}
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl bg-secondary p-3.5 text-sm text-secondary-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-bold">Sin marcador, a propósito.</span>{" "}
              En escuelitas los encuentros son formativos: se registra la
              participación, no el resultado.
            </p>
          </div>
        ))}

      {/* Datos del partido */}
      <section className="rounded-2xl border border-border bg-card">
        {[
          [
            "Fecha",
            `${(() => {
              const f = fecha.toLocaleDateString("es-AR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              });
              return f.charAt(0).toUpperCase() + f.slice(1);
            })()} · ${fecha.toLocaleTimeString("es-AR", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })} h`,
          ],
          ["Condición", partido.condicion === "local" ? "Local" : "Visitante"],
          ["Lugar", lugarDePartido(partido)],
          ["Torneo", partido.torneo],
        ].map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm last:border-0"
          >
            <span className="text-muted-foreground">{k}</span>
            <span className="flex items-center gap-1.5 text-right font-semibold">
              {k === "Lugar" && <MapPin className="size-3.5 text-muted-foreground" aria-hidden />}
              {v}
            </span>
          </div>
        ))}
      </section>

      {/* Citados */}
      <section className="rounded-2xl border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-extrabold">
          Citados ({partido.citados.length})
        </h2>
        <ul>
          {partido.citados.map((deportistaId) => {
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

      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        Se registran datos grupales del partido (resultado y citación). No se
        cargan estadísticas individuales de menores en esta etapa.
      </p>
    </div>
  );
}
