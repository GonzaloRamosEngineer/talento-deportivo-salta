"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { useClub } from "@/lib/use-club";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { EstadoVacio } from "@/components/estado-vacio";
import type { CategoriaDB, TipoCategoria } from "@/lib/tipos-db";
import { cn } from "@/lib/utils";

import { CargandoPelota } from "@/components/cargando-pelota";

// Gestión de categorías del club (paso 3 de docs/OPERACION.md).
// Todo contra la base real: RLS solo deja escribir a admin_club
// (categoria_insert_admin / update / delete).

const TIPOS: { id: TipoCategoria; label: string; conCohorte: boolean }[] = [
  { id: "escuelita", label: "Escuelita", conCohorte: true },
  { id: "inferior", label: "División inferior", conCohorte: true },
  { id: "reserva", label: "Reserva", conCohorte: false },
  { id: "primera", label: "Primera", conCohorte: false },
];

const ORDEN_TIPO: Record<string, number> = {
  escuelita: 0,
  inferior: 1,
  reserva: 2,
  primera: 3,
};

/**
 * Estructura estándar del fútbol formativo argentino, con cohortes
 * calculadas según el año actual: escuelitas (6 a 11 años, un año de
 * nacimiento cada una), 9ª→3ª división, Reserva y Primera.
 */
function estructuraEstandar(anioActual: number): {
  nombre: string;
  tipo: TipoCategoria;
  anio_nacimiento: number | null;
}[] {
  const filas: { nombre: string; tipo: TipoCategoria; anio_nacimiento: number | null }[] = [];
  for (let edad = 7; edad <= 12; edad++) {
    filas.push({
      nombre: `Escuelita ${anioActual - edad}`,
      tipo: "escuelita",
      anio_nacimiento: anioActual - edad,
    });
  }
  const divisiones = ["9ª", "8ª", "7ª", "6ª", "5ª", "4ª", "3ª"];
  divisiones.forEach((div, i) => {
    filas.push({
      nombre: `${div} División`,
      tipo: "inferior",
      anio_nacimiento: anioActual - 13 - i,
    });
  });
  filas.push({ nombre: "Reserva", tipo: "reserva", anio_nacimiento: null });
  filas.push({ nombre: "Primera", tipo: "primera", anio_nacimiento: null });
  return filas;
}

interface FormCategoria {
  id: string | null; // null = alta
  nombre: string;
  tipo: TipoCategoria;
  anio: string; // texto del input; se parsea al guardar
}

export default function CategoriasPage() {
  const sesion = useClub();
  const [categorias, setCategorias] = useState<CategoriaDB[]>([]);
  const [conteos, setConteos] = useState<Record<string, number>>({});
  const [disciplinaId, setDisciplinaId] = useState<string | null>(null);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [form, setForm] = useState<FormCategoria | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const clubId = sesion.membresia?.clubId ?? null;
  // recargar() sube la versión y el effect vuelve a leer de la base
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!clubId) return;
    let cancelado = false;
    async function cargar() {
      const supabase = crearClienteBrowser();
      const [rCats, rDeps, rDisc] = await Promise.all([
        supabase
          .from("categoria")
          .select("id, nombre, tipo, anio_nacimiento, disciplina_id")
          .eq("club_id", clubId!),
        supabase.from("deportista").select("categoria_id").eq("club_id", clubId!),
        supabase.from("disciplina").select("id").eq("nombre", "Fútbol").maybeSingle(),
      ]);
      if (cancelado) return;
      // sin esto, un error dejaba el spinner girando para siempre
      const errorCarga = rCats.error ?? rDeps.error ?? rDisc.error;
      if (errorCarga) {
        setError(`No se pudieron cargar las categorías: ${errorCarga.message}`);
        setCargandoDatos(false);
        return;
      }
      const { data: cats } = rCats;
      const { data: deps } = rDeps;
      const { data: disc } = rDisc;
      const porCategoria: Record<string, number> = {};
      for (const d of deps ?? []) {
        if (d.categoria_id) {
          porCategoria[d.categoria_id] = (porCategoria[d.categoria_id] ?? 0) + 1;
        }
      }
      setCategorias((cats as CategoriaDB[]) ?? []);
      setConteos(porCategoria);
      setDisciplinaId(disc?.id ?? null);
      setCargandoDatos(false);
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [clubId, version]);

  const ordenadas = useMemo(
    () =>
      [...categorias].sort((a, b) => {
        const t = (ORDEN_TIPO[a.tipo ?? ""] ?? 9) - (ORDEN_TIPO[b.tipo ?? ""] ?? 9);
        if (t !== 0) return t;
        // Dentro del tipo, de más chicos a más grandes (cohorte desc)
        return (b.anio_nacimiento ?? 0) - (a.anio_nacimiento ?? 0);
      }),
    [categorias],
  );

  const faltantes = useMemo(() => {
    const plantilla = estructuraEstandar(new Date().getFullYear());
    return plantilla.filter((p) => {
      if (p.tipo === "reserva" || p.tipo === "primera") {
        return !categorias.some((c) => c.tipo === p.tipo);
      }
      return !categorias.some(
        (c) => c.tipo === p.tipo && c.anio_nacimiento === p.anio_nacimiento,
      );
    });
  }, [categorias]);

  if (sesion.cargando) {
    return (
      <CargandoPelota />
    );
  }

  if (!sesion.usuario || sesion.membresia?.rol !== "admin_club") {
    return (
      <AvisoAcceso
        titulo="Solo para el admin del club"
        detalle="La estructura de categorías la gestiona el administrador del club. Si sos profe, tus categorías te las asigna tu admin."
        accionHref={sesion.usuario ? "/panel" : "/login"}
        accionLabel={sesion.usuario ? "Volver al inicio" : "Ingresar"}
      />
    );
  }

  const guardar = async () => {
    if (!form || !clubId || !disciplinaId) return;
    const nombre = form.nombre.trim();
    if (!nombre) {
      setError("La categoría necesita un nombre.");
      return;
    }
    const tipoDef = TIPOS.find((t) => t.id === form.tipo)!;
    const anio = tipoDef.conCohorte && form.anio ? Number(form.anio) : null;
    if (tipoDef.conCohorte && anio !== null && (anio < 1990 || anio > new Date().getFullYear())) {
      setError("Ese año de nacimiento no parece válido.");
      return;
    }
    setGuardando(true);
    setError("");
    const supabase = crearClienteBrowser();
    const valores = { nombre, tipo: form.tipo, anio_nacimiento: anio };
    const { error: e } = form.id
      ? await supabase.from("categoria").update(valores).eq("id", form.id)
      : await supabase
          .from("categoria")
          .insert({ ...valores, club_id: clubId, disciplina_id: disciplinaId });
    setGuardando(false);
    if (e) {
      setError(
        e.code === "23505"
          ? "Ya existe una categoría con ese nombre en el club."
          : `No se pudo guardar: ${e.message}`,
      );
      return;
    }
    setAviso(form.id ? "Categoría actualizada." : `Categoría "${nombre}" creada.`);
    setForm(null);
    recargar();
  };

  const borrar = async (cat: CategoriaDB) => {
    setError("");
    const supabase = crearClienteBrowser();
    const { error: e } = await supabase.from("categoria").delete().eq("id", cat.id);
    setConfirmarBorrar(null);
    if (e) {
      setError(`No se pudo eliminar: ${e.message}`);
      return;
    }
    setAviso(`Categoría "${cat.nombre}" eliminada.`);
    recargar();
  };

  const generarEstandar = async () => {
    if (!clubId || !disciplinaId || faltantes.length === 0) return;
    setGenerando(true);
    setError("");
    const supabase = crearClienteBrowser();
    const { error: e } = await supabase.from("categoria").insert(
      faltantes.map((f) => ({ ...f, club_id: clubId, disciplina_id: disciplinaId })),
    );
    setGenerando(false);
    if (e) {
      setError(`No se pudo generar la estructura: ${e.message}`);
      return;
    }
    setAviso(`Se crearon ${faltantes.length} categorías de la estructura estándar.`);
    recargar();
  };

  const abrirAlta = () =>
    setForm({ id: null, nombre: "", tipo: "escuelita", anio: "" });
  const abrirEdicion = (c: CategoriaDB) =>
    setForm({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo ?? "escuelita",
      anio: c.anio_nacimiento ? String(c.anio_nacimiento) : "",
    });

  const tipoForm = form ? TIPOS.find((t) => t.id === form.tipo)! : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/club"
          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" aria-hidden /> Club
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Categorías</h1>
            <p className="text-sm text-muted-foreground">
              La estructura real de {sesion.club?.nombre ?? "tu club"} — cohortes por año
              de nacimiento
            </p>
          </div>
          <button
            onClick={abrirAlta}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <Plus className="size-4" aria-hidden /> Nueva categoría
          </button>
        </div>
      </div>

      {aviso && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/25 bg-secondary/60 p-3">
          <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="text-sm font-semibold">{aviso}</p>
          <button
            onClick={() => setAviso("")}
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Cerrar aviso"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </div>
      )}

      {/* Generador de estructura estándar */}
      {!cargandoDatos && faltantes.length > 0 && (
        <div className="rounded-2xl border border-primary/25 bg-secondary/40 p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">Estructura estándar de fútbol formativo</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Con un toque se crean las {faltantes.length} categorías que faltan para el{" "}
                {new Date().getFullYear()}:{" "}
                {faltantes.map((f) => f.nombre).join(", ")}. Después podés renombrarlas o
                eliminar las que tu club no use.
              </p>
              <button
                onClick={generarEstandar}
                disabled={generando}
                className="mt-3 flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-60"
              >
                {generando ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden /> Creando…
                  </>
                ) : (
                  <>Generar {faltantes.length} categorías</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulario alta/edición */}
      {form && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            {form.id ? "Editar categoría" : "Nueva categoría"}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <label htmlFor="cat-nombre" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Nombre
              </label>
              <input
                id="cat-nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Escuelita 2020"
                className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label htmlFor="cat-tipo" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Tipo
              </label>
              <select
                id="cat-tipo"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoCategoria })}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary sm:w-44"
              >
                {TIPOS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={cn(!tipoForm?.conCohorte && "opacity-40")}>
              <label htmlFor="cat-anio" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Año de nacimiento
              </label>
              <input
                id="cat-anio"
                type="number"
                inputMode="numeric"
                value={form.anio}
                onChange={(e) => setForm({ ...form, anio: e.target.value })}
                disabled={!tipoForm?.conCohorte}
                placeholder="2020"
                className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-32"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={guardar}
              disabled={guardando}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-60"
            >
              {guardando ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Guardando…
                </>
              ) : (
                <>
                  <Check className="size-4" aria-hidden /> Guardar
                </>
              )}
            </button>
            <button
              onClick={() => {
                setForm(null);
                setError("");
              }}
              className="h-10 rounded-xl px-4 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {cargandoDatos ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : ordenadas.length === 0 ? (
        <EstadoVacio
          icono={Layers}
          titulo="Todavía no hay categorías"
          detalle="Las categorías ordenan todo lo demás: deportistas, mediciones y agenda viven adentro de una. Generá la estructura estándar de arriba o creá la primera a mano."
          nota="Después se pueden renombrar, sumar o borrar (mientras estén vacías)."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {ordenadas.map((c, i) => {
            const cuenta = conteos[c.id] ?? 0;
            const tipo = TIPOS.find((t) => t.id === c.tipo);
            return (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  i > 0 && "border-t border-border",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{c.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {tipo?.label ?? "—"}
                    {c.anio_nacimiento ? ` · nacidos ${c.anio_nacimiento}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold",
                    cuenta > 0
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {cuenta === 1 ? "1 deportista" : `${cuenta} deportistas`}
                </span>
                <button
                  onClick={() => {
                    setAviso("");
                    abrirEdicion(c);
                  }}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Editar ${c.nombre}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                {cuenta === 0 &&
                  (confirmarBorrar === c.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => void borrar(c)}
                        className="h-9 rounded-lg bg-destructive px-3 text-xs font-bold text-white"
                      >
                        Eliminar
                      </button>
                      <button
                        onClick={() => setConfirmarBorrar(null)}
                        className="h-9 rounded-lg px-2 text-xs font-bold text-muted-foreground"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmarBorrar(c.id)}
                      className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Eliminar ${c.nombre}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Las categorías con deportistas no se pueden eliminar desde acá: primero hay que
        reasignar a los chicos. El profe solo ve las categorías que le asignás en{" "}
        <Link href="/club/staff" className="font-bold underline underline-offset-2">
          Staff
        </Link>
        .
      </p>
    </div>
  );
}
