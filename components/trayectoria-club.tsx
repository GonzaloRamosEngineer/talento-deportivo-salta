"use client";

import { useState } from "react";
import {
  CalendarPlus,
  Loader2,
  Milestone,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Deportista, HitoTrayectoria } from "@/lib/mock-data";
import { HOY_DEMO } from "@/lib/mock-data";
import type { Datos } from "@/lib/use-datos";
import {
  escuelitaAPrimera,
  etiquetaHito,
  formatearDuracion,
  tiempoEnElClub,
} from "@/lib/trayectoria";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { usePerfil } from "@/components/perfil-context";
import { EstadoVacio } from "@/components/estado-vacio";
import { cn } from "@/lib/utils";

// Trayectoria institucional en la tab Ficha: timeline de hitos +
// métricas ("en el club", "de escuelita a Primera"). Framing de
// registro: describe eventos, nunca juzga. El alta manual cubre lo
// que no sale solo (ingreso del plantel importado, debut, otros);
// promociones y pases se registran desde Editar.

const PUNTO_UI: Record<HitoTrayectoria["tipo"], string> = {
  ingreso: "bg-primary",
  promocion: "bg-success",
  debut_primera: "bg-warning",
  pase_salida: "bg-muted-foreground",
  otro: "bg-secondary-foreground/50",
};

function hoyLocalISO(real: boolean): string {
  return (real ? new Date() : HOY_DEMO).toLocaleDateString("en-CA");
}

export function TrayectoriaClub({
  deportista,
  datos,
}: {
  deportista: Deportista;
  datos: Datos;
}) {
  const { permisos } = usePerfil();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<"ingreso" | "debut_primera" | "otro">("otro");
  const [fecha, setFecha] = useState(() => hoyLocalISO(datos.real));
  const [detalle, setDetalle] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);

  const hitos = [...(deportista.hitos ?? [])].sort((a, b) =>
    a.fecha.localeCompare(b.fecha),
  );
  const hoy = hoyLocalISO(datos.real);
  const enClub = tiempoEnElClub(hitos, hoy);
  const aPrimera = escuelitaAPrimera(hitos);
  const tieneIngreso = hitos.some((h) => h.tipo === "ingreso");
  const tieneDebut = hitos.some((h) => h.tipo === "debut_primera");
  const puedeCargar = datos.real && permisos.opera;

  const tiposDisponibles = [
    ...(!tieneIngreso ? [{ clave: "ingreso" as const, label: "Ingreso al club" }] : []),
    ...(!tieneDebut
      ? [{ clave: "debut_primera" as const, label: "Debut en Primera" }]
      : []),
    { clave: "otro" as const, label: "Otro hito" },
  ];

  const guardar = async () => {
    if (tipo === "otro" && detalle.trim().length < 3) {
      setError("Contá qué pasó (mínimo 3 caracteres).");
      return;
    }
    setGuardando(true);
    setError("");
    const { error: e } = await crearClienteBrowser().from("deportista_hito").insert({
      deportista_id: deportista.id,
      tipo,
      fecha,
      detalle: detalle.trim() || null,
      registrado_por: datos.membresiaId,
    });
    setGuardando(false);
    if (e) {
      setError(
        e.code === "23505"
          ? "Ya hay un hito de ese tipo registrado (ese día o de por vida, como el ingreso)."
          : `No se pudo guardar (${e.message}).`,
      );
      return;
    }
    setAbierto(false);
    setDetalle("");
    setTipo("otro");
    datos.recargar();
  };

  const borrar = async (id: string) => {
    const { error: e } = await crearClienteBrowser()
      .from("deportista_hito")
      .delete()
      .eq("id", id);
    setConfirmarBorrar(null);
    if (e) {
      setError(`No se pudo borrar (${e.message}).`);
      return;
    }
    datos.recargar();
  };

  return (
    <section className="mt-3 rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold">
          <Milestone className="size-4 text-primary" aria-hidden />
          Trayectoria en el club
        </h2>
        {puedeCargar && !abierto && (
          <button
            onClick={() => {
              setAbierto(true);
              setTipo(tiposDisponibles[0].clave);
              setFecha(hoyLocalISO(datos.real));
            }}
            className="flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Plus className="size-3.5" aria-hidden />
            Agregar hito
          </button>
        )}
      </div>

      {(enClub || aPrimera !== null) && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {enClub && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
              {enClub.cerrado
                ? `Estuvo ${formatearDuracion(enClub.meses)} en el club`
                : `En el club: ${formatearDuracion(enClub.meses)}`}
            </span>
          )}
          {aPrimera !== null && (
            <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success">
              {`De escuelita a Primera: ${formatearDuracion(aPrimera)}`}
            </span>
          )}
        </div>
      )}

      {abierto && (
        <div className="mx-4 mt-3 flex flex-col gap-2.5 rounded-xl border border-border bg-background p-3.5">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de hito">
            {tiposDisponibles.map((t) => (
              <button
                key={t.clave}
                role="radio"
                aria-checked={tipo === t.clave}
                onClick={() => setTipo(t.clave)}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-semibold transition-colors",
                  tipo === t.clave
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="hito-fecha" className="text-xs font-bold text-muted-foreground">
              Fecha
            </label>
            <input
              id="hito-fecha"
              type="date"
              value={fecha}
              max={hoy}
              onChange={(e) => setFecha(e.target.value)}
              className="h-10 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-ring"
            />
          </div>
          <input
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            maxLength={300}
            placeholder={
              tipo === "otro"
                ? "Qué pasó (ej. capitán del equipo, seleccionado provincial)"
                : "Observación (opcional)"
            }
            className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-ring"
          />
          {tipo === "ingreso" && (
            <p className="text-[11px] leading-snug text-muted-foreground">
              La fecha en que entró al club (puede ser de años atrás — sirve
              para el plantel que ya estaba antes de la app).
            </p>
          )}
          {error && <p className="text-xs font-semibold text-danger">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={() => void guardar()}
              disabled={guardando}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
            >
              {guardando ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <CalendarPlus className="size-3.5" aria-hidden />
              )}
              Guardar hito
            </button>
            <button
              onClick={() => {
                setAbierto(false);
                setError("");
              }}
              className="flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-muted-foreground"
            >
              <X className="size-3.5" aria-hidden />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {hitos.length === 0 ? (
        <div className="p-4">
          <EstadoVacio
            icono={Milestone}
            titulo="Todavía sin hitos registrados"
            detalle={`Acá va la historia institucional de ${deportista.nombre}: cuándo ingresó al club, sus pasos de categoría y su debut. Con el ingreso cargado, aparece cuánto lleva en el club.`}
            nota={
              puedeCargar
                ? undefined
                : "Los hitos los carga el admin del club o un profe de la categoría."
            }
          />
        </div>
      ) : (
        <ol className="px-4 py-3">
          {hitos.map((h, i) => (
            <li key={h.id} className="relative flex gap-3 pb-4 last:pb-1">
              {i < hitos.length - 1 && (
                <span
                  className="absolute left-[5px] top-4 h-full w-px bg-border"
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-card",
                  PUNTO_UI[h.tipo],
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-snug">{etiquetaHito(h)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {/* la trayectoria abarca años: la fecha SIEMPRE con año */}
                  {new Date(h.fecha + "T12:00:00").toLocaleDateString("es-AR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {h.tipo !== "otro" && h.detalle ? ` · ${h.detalle}` : ""}
                </p>
              </div>
              {puedeCargar &&
                (confirmarBorrar === h.id ? (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => void borrar(h.id)}
                      className="h-7 rounded-lg bg-danger px-2 text-[11px] font-bold text-white"
                    >
                      Borrar
                    </button>
                    <button
                      onClick={() => setConfirmarBorrar(null)}
                      className="h-7 rounded-lg px-1.5 text-[11px] font-bold text-muted-foreground"
                    >
                      No
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmarBorrar(h.id)}
                    aria-label={`Borrar hito: ${etiquetaHito(h)}`}
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:text-danger"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                ))}
            </li>
          ))}
        </ol>
      )}

      <p className="border-t border-border px-4 py-2.5 text-[11px] leading-snug text-muted-foreground">
        Las promociones se registran solas al mover de categoría desde Editar;
        el pase a otro club, desde la baja. Los datos nunca viajan con el pase.
      </p>
    </section>
  );
}
