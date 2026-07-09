"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, CheckCircle2, Info } from "lucide-react";
import {
  ATRIBUTOS,
  CATEGORIAS,
  DEPORTISTAS,
  getAtributo,
  plantelDe,
} from "@/lib/mock-data";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { cn } from "@/lib/utils";

function JornadaDeMedicion() {
  const sp = useSearchParams();
  const [atributoId, setAtributoId] = useState<string | null>(
    sp.get("atributo") && getAtributo(sp.get("atributo")!)
      ? sp.get("atributo")
      : null,
  );
  const [categoriaId, setCategoriaId] = useState<string | null>(
    CATEGORIAS.some((c) => c.id === sp.get("categoria"))
      ? sp.get("categoria")
      : null,
  );
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardada, setGuardada] = useState(false);

  const atributo = atributoId ? getAtributo(atributoId) : null;
  const plantel = useMemo(
    () =>
      categoriaId
        ? DEPORTISTAS.filter((d) => d.categoriaId === categoriaId).sort(
            (a, b) => a.apellido.localeCompare(b.apellido),
          )
        : [],
    [categoriaId],
  );
  const cargados = plantel.filter((d) => valores[d.id]?.trim()).length;
  const listo = atributo && categoriaId && cargados > 0;

  if (guardada) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="size-14 text-success" aria-hidden />
        <div>
          <h1 className="text-xl font-extrabold">Jornada registrada</h1>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {cargados} mediciones de {atributo?.nombre} en{" "}
            {CATEGORIAS.find((c) => c.id === categoriaId)?.nombre}.
            <br />
            <span className="font-semibold text-warning">
              Demo: en esta etapa los datos no se guardan.
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setValores({});
              setGuardada(false);
            }}
            className="h-11 rounded-xl border border-border bg-card px-5 text-sm font-bold"
          >
            Cargar otra
          </button>
          <Link
            href="/deportistas"
            className="flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            Ver deportistas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Jornada de medición
        </h1>
        <p className="text-sm text-muted-foreground">
          Elegí qué medir y cargá a toda la categoría de corrido
        </p>
      </div>

      {/* Paso 1: atributo */}
      <section>
        <h2 className="mb-2 text-sm font-extrabold">
          1 · ¿Qué van a medir hoy?
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {ATRIBUTOS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAtributoId(a.id)}
              className={cn(
                "flex min-h-12 items-center justify-between rounded-xl border px-3.5 py-2 text-left text-sm font-semibold transition-colors",
                a.id === atributoId
                  ? "border-primary bg-secondary text-secondary-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              <span>
                {a.nombre}
                <span className="block text-[11px] font-medium text-muted-foreground">
                  {a.unidad}
                  {a.naturaleza === "subjetivo" && " · a criterio"}
                </span>
              </span>
              {a.id === atributoId && (
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Paso 2: categoría */}
      <section>
        <h2 className="mb-2 text-sm font-extrabold">2 · ¿Qué categoría?</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIAS.map((c) => {
            const n = plantelDe(c.id).length;
            return (
              <button
                key={c.id}
                disabled={n === 0}
                onClick={() => setCategoriaId(c.id)}
                className={cn(
                  "h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition-colors",
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
      </section>

      {/* Paso 3: la lista de carga rápida */}
      {atributo && categoriaId && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-extrabold">
              3 · Cargar {atributo.nombre}{" "}
              <span className="font-semibold text-muted-foreground">
                ({atributo.unidad})
              </span>
            </h2>
            <span className="text-xs font-bold text-primary tabular-nums">
              {cargados}/{plantel.length}
            </span>
          </div>

          {/* progreso */}
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: plantel.length
                  ? `${(cargados / plantel.length) * 100}%`
                  : "0%",
              }}
            />
          </div>

          <ul className="flex flex-col gap-2">
            {plantel.map((d) => {
              const valor = valores[d.id] ?? "";
              return (
                <li
                  key={d.id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                    valor.trim()
                      ? "border-primary/40 bg-secondary/50"
                      : "border-border bg-card",
                  )}
                >
                  <AvatarIniciales nombre={d.nombre} apellido={d.apellido} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {d.apellido}, {d.nombre}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) =>
                      setValores((v) => ({ ...v, [d.id]: e.target.value }))
                    }
                    placeholder={atributo.unidad}
                    aria-label={`${atributo.nombre} de ${d.nombre} ${d.apellido}`}
                    className="h-12 w-24 rounded-xl border border-input bg-background text-center text-lg font-extrabold tabular-nums outline-none transition-colors placeholder:text-sm placeholder:font-medium placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </li>
              );
            })}
          </ul>

          <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <p>
              Se registra una medición por deportista por día. Si ya había una
              de hoy, se reemplaza.
            </p>
          </div>
        </section>
      )}

      {/* Guardar (sticky sobre la barra de navegación) */}
      {atributo && categoriaId && (
        <div className="sticky bottom-20 z-20 md:bottom-4">
          <button
            disabled={!listo}
            onClick={() => setGuardada(true)}
            className={cn(
              "h-13 w-full rounded-2xl text-base font-extrabold shadow-lg transition-all",
              listo
                ? "bg-primary text-primary-foreground active:scale-[0.99]"
                : "cursor-not-allowed bg-muted text-muted-foreground shadow-none",
            )}
          >
            {listo
              ? `Guardar jornada (${cargados})`
              : "Cargá al menos una medición"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PaginaMedicion() {
  return (
    <Suspense>
      <JornadaDeMedicion />
    </Suspense>
  );
}
