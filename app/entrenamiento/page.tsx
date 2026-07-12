"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Armchair, CheckCircle2, Info, Lock } from "lucide-react";
import {
  ATRIBUTOS,
  CATEGORIAS,
  getAtributo,
  plantelDe,
} from "@/lib/mock-data";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { usePerfil, puedeCargar } from "@/components/perfil-context";
import { Proximamente } from "@/components/proximamente";
import { cn } from "@/lib/utils";

const DESCANSO = "descanso";
const AREAS = ATRIBUTOS.filter((a) => a.entrenable);

function Entrenamiento() {
  const { perfil, permisos } = usePerfil();
  const sp = useSearchParams();
  // El profesor solo planifica en sus categorías asignadas
  const categoriasDisponibles = permisos.categorias
    ? CATEGORIAS.filter((c) => permisos.categorias!.includes(c.id))
    : CATEGORIAS;
  const [categoriaId, setCategoriaId] = useState<string | null>(
    sp.get("categoria") &&
      categoriasDisponibles.some((c) => c.id === sp.get("categoria")) &&
      plantelDe(sp.get("categoria")!).length > 0
      ? sp.get("categoria")
      : null,
  );
  const [areaActiva, setAreaActiva] = useState<string>(AREAS[0].id);
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [guardada, setGuardada] = useState(false);

  const plantel = useMemo(
    () =>
      categoriaId
        ? plantelDe(categoriaId).sort((a, b) =>
            a.apellido.localeCompare(b.apellido),
          )
        : [],
    [categoriaId],
  );

  const areaDe = (deportistaId: string) =>
    asignaciones[deportistaId] ?? DESCANSO;
  const asignados = plantel.filter((d) => areaDe(d.id) !== DESCANSO).length;
  const conteo = (areaId: string) =>
    plantel.filter((d) => areaDe(d.id) === areaId).length;

  const asignar = (deportistaId: string) => {
    if (!puedeCargar(perfil)) return;
    setAsignaciones((prev) => ({
      ...prev,
      // tocar de nuevo en la misma área lo devuelve a descanso
      [deportistaId]: areaDe(deportistaId) === areaActiva ? DESCANSO : areaActiva,
    }));
  };

  const elegirCategoria = (id: string) => {
    setCategoriaId(id);
    setAsignaciones({});
    setGuardada(false);
  };

  if (!puedeCargar(perfil)) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Lock className="size-10 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-extrabold">Solo lectura</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          El perfil actual no planifica entrenamientos. Cambiá a Profesor/a o
          Admin del club desde el selector de perfil para probar el tablero.
        </p>
      </div>
    );
  }

  if (guardada && categoriaId) {
    const resumen = AREAS.filter((a) => conteo(a.id) > 0);
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="size-14 text-success" aria-hidden />
        <div>
          <h1 className="text-xl font-extrabold">Planificación registrada</h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {CATEGORIAS.find((c) => c.id === categoriaId)?.nombre}:{" "}
            {resumen
              .map((a) => `${conteo(a.id)} en ${a.nombre}`)
              .join(", ")}{" "}
            y {plantel.length - asignados} en descanso.
            <br />
            <span className="font-semibold text-warning">
              Demo: en esta etapa los datos no se guardan.
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setAsignaciones({});
              setGuardada(false);
            }}
            className="h-11 rounded-xl border border-border bg-card px-5 text-sm font-bold"
          >
            Planificar otra
          </button>
          <Link
            href="/sesiones"
            className="flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            Ver sesiones
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Tablero de entrenamiento
        </h1>
        <p className="text-sm text-muted-foreground">
          Elegí un área y tocá jugadores para asignarlos. Todos arrancan en
          descanso.
        </p>
      </div>

      {/* Paso 1: categoría */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Elegir categoría">
        {categoriasDisponibles.map((c) => {
          const n = plantelDe(c.id).length;
          return (
            <button
              key={c.id}
              disabled={n === 0}
              onClick={() => elegirCategoria(c.id)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
                c.id === categoriaId
                  ? "border-primary bg-primary text-primary-foreground"
                  : n === 0
                    ? "border-border bg-muted text-muted-foreground/50"
                    : "border-border bg-card text-muted-foreground",
              )}
            >
              {c.nombre}
              {n > 0 && ` · ${n}`}
            </button>
          );
        })}
      </div>

      {categoriaId && (
        <>
          {/* contador global */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold">
              Áreas de trabajo{" "}
              <span className="font-semibold text-muted-foreground">
                (área activa:{" "}
                {areaActiva === DESCANSO
                  ? "Descanso"
                  : getAtributo(areaActiva)?.nombre}
                )
              </span>
            </p>
            <span className="text-xs font-bold text-primary tabular-nums">
              {asignados}/{plantel.length} asignados
            </span>
          </div>

          <div className="md:grid md:grid-cols-[1fr_260px] md:items-start md:gap-4">
            {/* ---------- Áreas ---------- */}
            {/* Mobile: chips scrolleables. Desktop: grid de cards. */}
            <div>
              <div className="flex gap-2 overflow-x-auto pb-1 md:hidden" role="tablist" aria-label="Elegir área">
                <AreaChip
                  activa={areaActiva === DESCANSO}
                  onClick={() => setAreaActiva(DESCANSO)}
                  nombre="Descanso"
                  count={plantel.length - asignados}
                />
                {AREAS.map((a) => (
                  <AreaChip
                    key={a.id}
                    activa={areaActiva === a.id}
                    onClick={() => setAreaActiva(a.id)}
                    nombre={a.nombre}
                    count={conteo(a.id)}
                  />
                ))}
              </div>

              <div className="hidden gap-2.5 md:grid md:grid-cols-2 lg:grid-cols-3">
                {AREAS.map((a) => {
                  const activa = areaActiva === a.id;
                  const jugadores = plantel.filter((d) => areaDe(d.id) === a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => setAreaActiva(a.id)}
                      className={cn(
                        "min-h-24 rounded-2xl border bg-card p-3 text-left transition-all",
                        activa
                          ? "border-primary ring-2 ring-primary/25"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-sm font-extrabold">{a.nombre}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                            jugadores.length > 0
                              ? "bg-secondary text-secondary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {jugadores.length}
                        </span>
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1">
                        {jugadores.map((d) => (
                          <span
                            key={d.id}
                            className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground"
                          >
                            {d.apellido}
                          </span>
                        ))}
                        {jugadores.length === 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            {activa ? "Tocá jugadores del plantel →" : "Sin asignados"}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
                {/* Descanso como card en desktop */}
                <button
                  onClick={() => setAreaActiva(DESCANSO)}
                  className={cn(
                    "min-h-24 rounded-2xl border bg-muted/50 p-3 text-left transition-all",
                    areaActiva === DESCANSO
                      ? "border-primary ring-2 ring-primary/25"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-extrabold">
                      <Armchair className="size-4" aria-hidden /> Descanso
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground">
                      {plantel.length - asignados}
                    </span>
                  </span>
                  <span className="mt-2 block text-[11px] text-muted-foreground">
                    Los no asignados descansan.
                  </span>
                </button>
              </div>
            </div>

            {/* ---------- Plantel ---------- */}
            <div className="mt-3 md:sticky md:top-8 md:mt-0">
              <h2 className="mb-2 text-sm font-extrabold md:px-1">
                Plantel ({plantel.length})
              </h2>
              <ul className="flex flex-col gap-1.5">
                {plantel.map((d) => {
                  const area = areaDe(d.id);
                  const enActiva = area === areaActiva;
                  const atributo = area !== DESCANSO ? getAtributo(area) : null;
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => asignar(d.id)}
                        className={cn(
                          "flex min-h-12 w-full items-center gap-2.5 rounded-xl border p-2 pl-2.5 text-left transition-colors",
                          enActiva && area !== DESCANSO
                            ? "border-primary/50 bg-secondary/60"
                            : "border-border bg-card hover:border-primary/40",
                        )}
                      >
                        <AvatarIniciales
                          nombre={d.nombre}
                          apellido={d.apellido}
                          className="size-8 text-xs"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">
                          {d.apellido}, {d.nombre}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                            area === DESCANSO
                              ? "bg-muted text-muted-foreground"
                              : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {atributo ? atributo.nombre : "Descanso"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <p>
              La planificación queda asociada a la sesión del día como foco de
              trabajo por jugador. Tocar un jugador ya asignado al área activa
              lo devuelve a descanso.
            </p>
          </div>

          <Proximamente
            titulo="Táctica y formaciones"
            detalle="Armar la formación del partido arrastrando jugadores a la cancha, conectada con este tablero. Es la Ola 3 del roadmap."
            etiqueta="A evaluar"
          />

          <div className="sticky bottom-20 z-20 md:bottom-4">
            <button
              disabled={asignados === 0}
              onClick={() => setGuardada(true)}
              className={cn(
                "h-13 w-full rounded-2xl text-base font-extrabold shadow-lg transition-all",
                asignados > 0
                  ? "bg-primary text-primary-foreground active:scale-[0.99]"
                  : "cursor-not-allowed bg-muted text-muted-foreground shadow-none",
              )}
            >
              {asignados > 0
                ? `Guardar planificación (${asignados})`
                : "Asigná al menos un jugador"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function PaginaEntrenamiento() {
  return (
    <Suspense>
      <Entrenamiento />
    </Suspense>
  );
}

function AreaChip({
  activa,
  onClick,
  nombre,
  count,
}: {
  activa: boolean;
  onClick: () => void;
  nombre: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors",
        activa
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {nombre}
      <span
        className={cn(
          "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
          activa ? "bg-white/20" : "bg-muted",
        )}
      >
        {count}
      </span>
    </button>
  );
}
