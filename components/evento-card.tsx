import Link from "next/link";
import { ChevronRight, Dumbbell, MapPin, Trophy } from "lucide-react";
import type { Evento, Partido } from "@/lib/mock-data";
import type { Agenda } from "@/lib/use-agenda";
import { cn } from "@/lib/utils";

function hora(fecha: string) {
  return new Date(fecha).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function BloqueFecha({ fecha }: { fecha: string }) {
  const d = new Date(fecha);
  return (
    <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary leading-none text-secondary-foreground">
      <span className="text-lg font-extrabold">{d.getDate()}</span>
      <span className="text-[10px] font-bold uppercase">
        {d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")}
      </span>
    </span>
  );
}

export function lugarDePartido(p: Partido, agenda: Agenda): string {
  return p.condicion === "local"
    ? (agenda.lugares.find((l) => l.id === p.lugarId)?.nombre ?? "Sede")
    : (p.lugarTexto ?? "Cancha del rival");
}

// Card compartida de agenda: entrenamiento o partido. El partido se
// distingue (icono Trophy en primario); en escuelitas no hay marcador.
// Los nombres (categoría, lugar, foco) se resuelven contra `agenda`,
// que puede venir del mock o de la base — misma card para ambos.
export function EventoCard({
  evento,
  agenda,
  conFecha = false,
}: {
  evento: Evento;
  agenda: Agenda;
  conFecha?: boolean;
}) {
  const categoria = agenda.datos.categorias.find(
    (c) =>
      c.id ===
      (evento.tipo === "sesion"
        ? evento.sesion.categoriaId
        : evento.partido.categoriaId),
  );

  if (evento.tipo === "sesion") {
    const s = evento.sesion;
    const presentes = s.asistencia.filter((a) => a.presente).length;
    const foco = s.atributoFocoId
      ? agenda.datos.atributos.find((a) => a.id === s.atributoFocoId)
      : null;
    const lugar = agenda.lugares.find((l) => l.id === s.lugarId);
    return (
      <Link
        href={`/sesiones/${s.id}`}
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40",
          s.estado === "cancelada" && "opacity-70",
        )}
      >
        {conFecha ? (
          <BloqueFecha fecha={s.fecha} />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <Dumbbell className="size-4.5" aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">
            {categoria?.nombre} · {hora(s.fecha)} h
            {foco && ` · ${foco.nombre}`}
          </span>
          <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {lugar?.nombre ?? "Lugar a definir"} · {s.entrenador}
          </span>
        </span>
        {s.estado === "cancelada" && (
          <span className="shrink-0 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
            Cancelada
          </span>
        )}
        {s.estado === "realizada" && s.asistencia.length > 0 && (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {presentes}/{s.asistencia.length}
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    );
  }

  const p = evento.partido;
  const jugado = new Date(p.fecha) < agenda.hoy;
  const esEscuelita = categoria?.tipo === "escuelita";
  return (
    <Link
      href={`/partidos/${p.id}`}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
    >
      {conFecha ? (
        <BloqueFecha fecha={p.fecha} />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Trophy className="size-4.5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">
          {esEscuelita ? "Encuentro" : "Partido"} vs {p.rival} ·{" "}
          {hora(p.fecha)} h
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {categoria?.nombre} · {p.torneo} ·{" "}
          {p.condicion === "local" ? "Local" : "Visitante"}
        </span>
      </span>
      {jugado &&
        (p.resultado ? (
          <span className="shrink-0 text-base font-extrabold tabular-nums">
            {p.resultado.favor}–{p.resultado.contra}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            Sin marcador
          </span>
        ))}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
