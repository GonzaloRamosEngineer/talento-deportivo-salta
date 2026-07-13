"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Info,
  Loader2,
  MapPin,
  Trophy,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { useDatos } from "@/lib/use-datos";
import { useAgenda } from "@/lib/use-agenda";
import { lugarDePartido } from "@/components/evento-card";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { usePerfil } from "@/components/perfil-context";

// Detalle de partido — dual (mock/real). SOLO datos grupales:
// resultado del equipo y citados; nada individual de menores. En
// escuelitas no se carga marcador (encuadre formativo).

export default function PaginaPartido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { permisos } = usePerfil();
  const datos = useDatos();
  const agenda = useAgenda(datos);

  const partido = agenda.partidos.find((p) => p.id === id) ?? null;

  const [favor, setFavor] = useState("");
  const [contra, setContra] = useState("");
  const [cargandoResultado, setCargandoResultado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

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

  if (agenda.cargando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!partido) {
    return (
      <AvisoAcceso
        titulo="Partido no encontrado"
        detalle="Puede que sea de una categoría fuera de tu alcance o que el enlace esté vencido."
        accionHref="/sesiones"
        accionLabel="Ver la agenda"
      />
    );
  }

  const categoria = datos.categorias.find((c) => c.id === partido.categoriaId);
  const esEscuelita = categoria?.tipo === "escuelita";
  const fecha = new Date(partido.fecha);
  const jugado = fecha < agenda.hoy;
  const puedeCargarResultado =
    agenda.real && permisos.opera && jugado && !esEscuelita;

  async function guardarResultado() {
    if (!partido) return;
    const f = Number(favor);
    const c = Number(contra);
    if (!Number.isInteger(f) || !Number.isInteger(c) || f < 0 || c < 0) {
      setError("El marcador tiene que ser un número entero, 0 o más.");
      return;
    }
    setGuardando(true);
    setError("");
    const { error: e } = await crearClienteBrowser()
      .from("partido")
      .update({ goles_favor: f, goles_contra: c })
      .eq("id", partido.id);
    setGuardando(false);
    if (e) {
      setError(`No se pudo guardar: ${e.message}`);
      return;
    }
    setCargandoResultado(false);
    agenda.recargar();
  }

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

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </div>
      )}

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
            {puedeCargarResultado && !cargandoResultado && (
              <button
                onClick={() => {
                  setFavor(String(partido.resultado!.favor));
                  setContra(String(partido.resultado!.contra));
                  setCargandoResultado(true);
                }}
                className="mt-2 text-xs font-bold text-primary"
              >
                Corregir marcador
              </button>
            )}
          </div>
        ) : esEscuelita ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-secondary p-3.5 text-sm text-secondary-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-bold">Sin marcador, a propósito.</span>{" "}
              En escuelitas los encuentros son formativos: se registra la
              participación, no el resultado.
            </p>
          </div>
        ) : puedeCargarResultado && !cargandoResultado ? (
          <button
            onClick={() => setCargandoResultado(true)}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground transition-transform active:scale-[0.99]"
          >
            <Trophy className="size-4.5" aria-hidden />
            Cargar resultado
          </button>
        ) : null)}

      {/* Form de marcador */}
      {puedeCargarResultado && cargandoResultado && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            Marcador final
          </p>
          <div className="mt-3 flex items-end gap-3">
            <div className="flex-1">
              <label
                htmlFor="goles-favor"
                className="mb-1.5 block text-xs font-bold text-muted-foreground"
              >
                {datos.clubNombre}
              </label>
              <input
                id="goles-favor"
                type="number"
                inputMode="numeric"
                min={0}
                value={favor}
                onChange={(e) => setFavor(e.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-background px-3.5 text-center text-lg font-extrabold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <span className="pb-3 text-lg font-extrabold text-muted-foreground">
              –
            </span>
            <div className="flex-1">
              <label
                htmlFor="goles-contra"
                className="mb-1.5 block text-xs font-bold text-muted-foreground"
              >
                {partido.rival}
              </label>
              <input
                id="goles-contra"
                type="number"
                inputMode="numeric"
                min={0}
                value={contra}
                onChange={(e) => setContra(e.target.value)}
                className="h-12 w-full rounded-xl border border-input bg-background px-3.5 text-center text-lg font-extrabold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => void guardarResultado()}
              disabled={guardando || favor === "" || contra === ""}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-60"
            >
              {guardando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              Guardar
            </button>
            <button
              onClick={() => {
                setCargandoResultado(false);
                setError("");
              }}
              className="h-10 rounded-xl px-4 text-sm font-bold text-muted-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

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
          ["Lugar", lugarDePartido(partido, agenda)],
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
            const d = datos.deportistas.find((x) => x.id === deportistaId);
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
          {partido.citados.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Sin citados registrados.
            </li>
          )}
        </ul>
      </section>

      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        Se registran datos grupales del partido (resultado y citación). No se
        cargan estadísticas individuales de menores en esta etapa.
      </p>
    </div>
  );
}
