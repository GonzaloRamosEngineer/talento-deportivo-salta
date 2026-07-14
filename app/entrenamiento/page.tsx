"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Armchair,
  CalendarDays,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  MapPin,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import type { Sesion } from "@/lib/mock-data";
import { useDatos } from "@/lib/use-datos";
import {
  useAgenda,
  esVirtual,
  fechaLocalISO,
  lunesDe,
  type Agenda,
} from "@/lib/use-agenda";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { ComoMedir } from "@/components/como-medir";
import { EstadoVacio } from "@/components/estado-vacio";
import { Proximamente } from "@/components/proximamente";
import { usePerfil } from "@/components/perfil-context";
import { cn } from "@/lib/utils";

// Tablero de entrenamiento — dual (mock/real), integrado con la agenda.
// La planificación por jugador (a qué estación/área va cada uno) CUELGA
// de la sesión del día de la categoría (sesion_entrenamiento): no crea
// un mundo aparte con fecha propia. Una sesión virtual (del cronograma)
// se materializa al guardar, igual que al pasar lista. En la base cada
// asignación es una fila de sesion_asignacion; descanso = sin fila.

const DESCANSO = "descanso";

function Entrenamiento() {
  const { permisos } = usePerfil();
  const datos = useDatos();
  const agenda = useAgenda(datos);
  const sp = useSearchParams();

  // categoría elegida (deep-link ?categoria=, si está en alcance y con plantel)
  const paramCat = sp.get("categoria");
  const catInicial =
    paramCat &&
    datos.categorias.some((c) => c.id === paramCat) &&
    datos.deportistas.some((d) => d.categoriaId === paramCat)
      ? paramCat
      : null;
  const [categoriaId, setCategoriaId] = useState<string | null>(catInicial);
  const [sesionSel, setSesionSel] = useState<string | null>(null);
  // resultado del guardado (lo setea el tablero al confirmar) → pantalla de éxito
  const [resultado, setResultado] = useState<{
    sesionId: string;
    categoriaNombre: string;
    resumen: string;
  } | null>(null);

  const plantelDe = (id: string) =>
    datos.deportistas.filter((d) => d.categoriaId === id).length;

  // sesiones de la categoría entre HOY y el fin de esta semana (la
  // ventana donde el tablero tiene sentido: la práctica de estos días).
  const upcoming = useMemo(() => {
    if (!categoriaId) return [];
    const hoyISO = fechaLocalISO(agenda.hoy);
    const fin = new Date(lunesDe(agenda.hoy));
    fin.setDate(fin.getDate() + 6);
    const finISO = fechaLocalISO(fin);
    return agenda.sesiones
      .filter((s) => s.categoriaId === categoriaId && s.estado !== "cancelada")
      .filter((s) => {
        const iso = fechaLocalISO(new Date(s.fecha));
        return iso >= hoyISO && iso <= finISO;
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [categoriaId, agenda.sesiones, agenda.hoy]);

  const sesion = useMemo(
    () => upcoming.find((s) => s.id === sesionSel) ?? upcoming[0] ?? null,
    [upcoming, sesionSel],
  );

  const elegirCategoria = (id: string) => {
    setCategoriaId(id === categoriaId ? null : id);
    setSesionSel(null);
    setResultado(null);
  };

  if (!permisos.opera) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Lock className="size-10 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-extrabold">Solo lectura</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Tu perfil no planifica entrenamientos. El tablero es para el cuerpo
          técnico (profe o admin del club).
        </p>
      </div>
    );
  }

  if (agenda.cargando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2
          className="size-6 animate-spin text-muted-foreground"
          aria-hidden
        />
      </div>
    );
  }

  if (resultado) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="size-14 text-success" aria-hidden />
        <div>
          <h1 className="text-xl font-extrabold">Planificación guardada</h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {resultado.categoriaNombre}: {resultado.resumen}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setResultado(null)}
            className="h-11 rounded-xl border border-border bg-card px-5 text-sm font-bold"
          >
            Seguir editando
          </button>
          <Link
            href={`/sesiones/${resultado.sesionId}`}
            className="flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            Ver la sesión
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
          Planificá la práctica: elegí un área y tocá jugadores para asignarlos.
          Queda pegada a la sesión del día.
        </p>
      </div>

      {/* Paso 1: categoría */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Elegir categoría"
      >
        {datos.categorias.map((c) => {
          const n = plantelDe(c.id);
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

      {categoriaId && upcoming.length === 0 && (
        <EstadoVacio
          icono={CalendarDays}
          titulo="No hay entrenamiento de esta categoría esta semana"
          detalle="El tablero planifica la práctica del día. Programá el cronograma o creá la sesión desde la agenda y volvé a entrar."
          accion={{ href: "/sesiones", label: "Ir a la agenda" }}
        />
      )}

      {categoriaId && sesion && (
        <>
          {/* Paso 2: si hay más de una práctica esta semana, elegir cuál */}
          {upcoming.length > 1 && (
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              role="tablist"
              aria-label="Elegir sesión"
            >
              {upcoming.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSesionSel(s.id)}
                  className={cn(
                    "h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                    s.id === sesion.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {etiquetaSesion(s, agenda.hoy)}
                </button>
              ))}
            </div>
          )}

          <VistaTablero
            key={sesion.id}
            sesion={sesion}
            agenda={agenda}
            categoriaNombre={
              datos.categorias.find((c) => c.id === categoriaId)?.nombre ?? ""
            }
            onGuardado={setResultado}
          />
        </>
      )}
    </div>
  );
}

/** "Hoy · 18:00" o "jue · 18:00" */
function etiquetaSesion(s: Sesion, hoy: Date): string {
  const f = new Date(s.fecha);
  const hora = f.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const esHoy = fechaLocalISO(f) === fechaLocalISO(hoy);
  const dia = esHoy
    ? "Hoy"
    : f.toLocaleDateString("es-AR", { weekday: "short" });
  return `${dia} · ${hora}`;
}

function VistaTablero({
  sesion,
  agenda,
  categoriaNombre,
  onGuardado,
}: {
  sesion: Sesion;
  agenda: Agenda;
  categoriaNombre: string;
  onGuardado: (r: {
    sesionId: string;
    categoriaNombre: string;
    resumen: string;
  }) => void;
}) {
  const datos = agenda.datos;
  const AREAS = useMemo(
    () => datos.atributos.filter((a) => a.entrenable),
    [datos.atributos],
  );
  const plantel = useMemo(
    () =>
      datos.deportistas
        .filter((d) => d.categoriaId === sesion.categoriaId)
        .sort((a, b) => a.apellido.localeCompare(b.apellido)),
    [datos.deportistas, sesion.categoriaId],
  );

  // estado inicial desde lo ya guardado en la sesión (por excepción:
  // solo viven las asignaciones ≠ descanso). key={sesion.id} lo resiembra.
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>(
    () => {
      const validas = new Set(AREAS.map((a) => a.id));
      const inicial: Record<string, string> = {};
      for (const a of sesion.asignaciones ?? []) {
        if (validas.has(a.atributoId)) inicial[a.deportistaId] = a.atributoId;
      }
      return inicial;
    },
  );
  const [areaActiva, setAreaActiva] = useState<string>(
    AREAS[0]?.id ?? DESCANSO,
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const getAtributo = (id: string) => datos.atributos.find((a) => a.id === id);
  const areaDe = (deportistaId: string) =>
    asignaciones[deportistaId] ?? DESCANSO;
  const asignados = plantel.filter((d) => areaDe(d.id) !== DESCANSO).length;
  const conteo = (areaId: string) =>
    plantel.filter((d) => areaDe(d.id) === areaId).length;

  const asignar = (deportistaId: string) => {
    setAsignaciones((prev) => ({
      ...prev,
      // tocar de nuevo en la misma área lo devuelve a descanso
      [deportistaId]:
        areaDe(deportistaId) === areaActiva ? DESCANSO : areaActiva,
    }));
  };

  const resumenTexto = () => {
    const partes = AREAS.filter((a) => conteo(a.id) > 0).map(
      (a) => `${conteo(a.id)} en ${a.nombre}`,
    );
    return `${partes.join(", ")}${partes.length ? " y " : ""}${
      plantel.length - asignados
    } en descanso.`;
  };

  async function guardar() {
    // Demo pública (sin sesión real): no persiste, solo confirma.
    if (!agenda.real) {
      onGuardado({
        sesionId: sesion.id,
        categoriaNombre,
        resumen: resumenTexto(),
      });
      return;
    }
    if (!datos.clubId || !datos.membresiaId) return;
    setGuardando(true);
    setError("");
    const supabase = crearClienteBrowser();
    try {
      let sesionId = sesion.id;
      // materializar la sesión virtual (como al pasar lista): la
      // planificación es previa a la práctica → queda 'programada'.
      if (esVirtual(sesion.id)) {
        const { data, error: e } = await supabase
          .from("sesion_entrenamiento")
          .insert({
            club_id: datos.clubId,
            categoria_id: sesion.categoriaId,
            responsable_id: datos.membresiaId,
            fecha: new Date(sesion.fecha).toISOString(),
            lugar_id: sesion.lugarId || null,
            estado: "programada",
          })
          .select("id")
          .single();
        if (e) throw e;
        sesionId = data.id as string;
      }
      // reconciliar por reemplazo (mismo patrón que la asistencia):
      // se borran las filas previas y se reinsertan las actuales.
      const { error: eDel } = await supabase
        .from("sesion_asignacion")
        .delete()
        .eq("sesion_id", sesionId);
      if (eDel) throw eDel;
      const filas = plantel
        .filter((d) => areaDe(d.id) !== DESCANSO)
        .map((d) => ({
          sesion_id: sesionId,
          deportista_id: d.id,
          atributo_id: areaDe(d.id),
        }));
      if (filas.length > 0) {
        const { error: eIns } = await supabase
          .from("sesion_asignacion")
          .insert(filas);
        if (eIns) throw eIns;
      }
      agenda.recargar();
      onGuardado({ sesionId, categoriaNombre, resumen: resumenTexto() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  const fecha = new Date(sesion.fecha);
  const lugar = agenda.lugares.find((l) => l.id === sesion.lugarId);

  return (
    <>
      {/* Sesión a la que cuelga la planificación */}
      <div className="rounded-2xl border border-border bg-secondary/40 px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-sm font-extrabold capitalize">
          <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
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
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {lugar?.nombre ?? "Lugar a definir"}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm font-semibold text-destructive">
          No se pudo guardar: {error}
        </div>
      )}

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

      {/* Ideas de trabajo del área activa (mismo drawer del Módulo B) */}
      {areaActiva !== DESCANSO && getAtributo(areaActiva) && (
        <div>
          <ComoMedir atributo={getAtributo(areaActiva)!} variante="ideas" />
        </div>
      )}

      <div className="md:grid md:grid-cols-[1fr_260px] md:items-start md:gap-4">
        {/* ---------- Áreas ---------- */}
        <div>
          <div
            className="flex gap-2 overflow-x-auto pb-1 md:hidden"
            role="tablist"
            aria-label="Elegir área"
          >
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
            {plantel.length === 0 && (
              <li className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No hay deportistas en esta categoría todavía.
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] leading-snug text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          La planificación queda asociada a esta sesión como foco de trabajo por
          jugador. Tocar un jugador ya asignado al área activa lo devuelve a
          descanso.
        </p>
      </div>

      <Proximamente
        titulo="Táctica y formaciones"
        detalle="Armar la formación del partido arrastrando jugadores a la cancha, conectada con este tablero. Es la Ola 3 del roadmap."
        etiqueta="A evaluar"
      />

      <div className="sticky bottom-20 z-20 md:bottom-4">
        <button
          disabled={guardando || plantel.length === 0}
          onClick={() => void guardar()}
          className={cn(
            "flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold shadow-lg transition-all",
            plantel.length > 0
              ? "bg-primary text-primary-foreground active:scale-[0.99]"
              : "cursor-not-allowed bg-muted text-muted-foreground shadow-none",
          )}
        >
          {guardando && (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          )}
          {asignados > 0
            ? `Guardar planificación (${asignados})`
            : "Guardar (todos en descanso)"}
        </button>
      </div>
    </>
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
