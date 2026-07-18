"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  CloudRain,
  Dumbbell,
  Loader2,
  MapPin,
  Target,
  X,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import type { Sesion } from "@/lib/mock-data";
import { useDatos } from "@/lib/use-datos";
import {
  useAgenda,
  claveHorario,
  esVirtual,
  fechaLocalISO,
  sesionVirtual,
  type Agenda,
} from "@/lib/use-agenda";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { usePerfil } from "@/components/perfil-context";
import { cn } from "@/lib/utils";

import { CargandoPelota } from "@/components/cargando-pelota";

// Detalle de sesión — dual (mock/real). Con sesión real y permiso de
// operación, acá se PASA LISTA por excepción: todos arrancan
// presentes y solo se marcan las faltas; en la base se guardan
// únicamente las filas de ausencia (presente=false). Una sesión
// virtual (armada desde el cronograma) recién se escribe en
// sesion_entrenamiento al guardar la lista o al cancelarla.

export default function PaginaSesion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // El segmento llega percent-encodeado (los ids virtuales llevan ":")
  const { id: idCrudo } = use(params);
  const id = decodeURIComponent(idCrudo);
  const { permisos } = usePerfil();
  const datos = useDatos();
  const agenda = useAgenda(datos);

  // El hook solo trae las virtuales de la semana actual; una virtual
  // de otra semana (navegación de la agenda) se reconstruye desde su
  // id `v_<horarioId>_<fecha>`. Si ese día ya quedó una sesión
  // registrada para la categoría, se muestra esa (link virtual viejo).
  const sesion = (() => {
    const encontrada = agenda.sesiones.find((s) => s.id === id);
    if (encontrada) return encontrada;
    const m = esVirtual(id) ? id.match(/^v_(.+)_(\d{4}-\d{2}-\d{2})$/) : null;
    if (!m) return null;
    const horario = agenda.horarios.find((h) => claveHorario(h) === m[1]);
    if (!horario) return null;
    const registrada = agenda.sesiones.find(
      (s) =>
        !esVirtual(s.id) &&
        s.categoriaId === horario.categoriaId &&
        fechaLocalISO(new Date(s.fecha)) === m[2],
    );
    return registrada ?? sesionVirtual(horario, m[2]);
  })();

  if (!permisos.veClub) {
    return (
      <AvisoAcceso
        titulo="La plataforma no ve sesiones de clubes"
        detalle="Las sesiones son operación interna de cada club; la plataforma solo ve agregados."
        accionHref="/observatorio"
        accionLabel="Ir al observatorio"
      />
    );
  }

  if (agenda.cargando) {
    return (
      <CargandoPelota />
    );
  }

  if (!sesion) {
    return (
      <AvisoAcceso
        titulo="Sesión no encontrada"
        detalle="Puede que sea de otra semana, de una categoría fuera de tu alcance, o que el enlace esté vencido."
        accionHref="/sesiones"
        accionLabel="Ver la agenda"
      />
    );
  }

  // key: al cambiar la sesión (o su estado tras guardar/recargar) el
  // estado editable se resiembra desde cero — sin setState en effects.
  return (
    <VistaSesion
      key={`${sesion.id}|${sesion.estado}`}
      sesion={sesion}
      agenda={agenda}
    />
  );
}

function VistaSesion({ sesion, agenda }: { sesion: Sesion; agenda: Agenda }) {
  const router = useRouter();
  const { permisos } = usePerfil();
  const datos = agenda.datos;

  // Pasar lista: solo las FALTAS viven en el estado (por excepción)
  const [ausentes, setAusentes] = useState<Set<string>>(
    () =>
      new Set(
        sesion.asistencia.filter((a) => !a.presente).map((a) => a.deportistaId),
      ),
  );
  const [foco, setFoco] = useState(sesion.atributoFocoId ?? "");
  const [descripcion, setDescripcion] = useState(sesion.descripcion);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [tocado, setTocado] = useState(false);

  const plantel = useMemo(
    () =>
      datos.deportistas.filter((d) => d.categoriaId === sesion.categoriaId),
    [datos.deportistas, sesion.categoriaId],
  );

  const fecha = new Date(sesion.fecha);
  const categoria = datos.categorias.find((c) => c.id === sesion.categoriaId);
  const atributoFoco = sesion.atributoFocoId
    ? datos.atributos.find((a) => a.id === sesion.atributoFocoId)
    : null;
  const lugar = agenda.lugares.find((l) => l.id === sesion.lugarId);
  const esProgramada = sesion.estado === "programada";
  const editable = agenda.real && permisos.opera && sesion.estado !== "cancelada";

  // Lista a mostrar: para programada, el plantel completo; para
  // realizada, la asistencia materializada (mismo plantel hoy).
  const lista =
    sesion.estado === "realizada"
      ? sesion.asistencia.map((a) => a.deportistaId)
      : plantel.map((d) => d.id);
  const presentes = lista.length - ausentes.size;

  const toggle = (deportistaId: string) => {
    setTocado(true);
    setAusentes((prev) => {
      const s = new Set(prev);
      if (s.has(deportistaId)) s.delete(deportistaId);
      else s.add(deportistaId);
      return s;
    });
  };

  async function guardar(estado: "realizada" | "cancelada") {
    if (!sesion || !datos.clubId || !datos.membresiaId) return;
    setGuardando(true);
    setError("");
    const supabase = crearClienteBrowser();
    try {
      let sesionId = sesion.id;
      const valores = {
        estado,
        atributo_foco: foco || null,
        descripcion:
          (estado === "cancelada" ? motivo : descripcion).trim() || null,
      };
      if (esVirtual(sesion.id)) {
        const { data, error: e } = await supabase
          .from("sesion_entrenamiento")
          .insert({
            club_id: datos.clubId,
            categoria_id: sesion.categoriaId,
            responsable_id: datos.membresiaId,
            fecha: new Date(sesion.fecha).toISOString(),
            lugar_id: sesion.lugarId || null,
            ...valores,
          })
          .select("id")
          .single();
        if (e) throw e;
        sesionId = data.id as string;
      } else {
        const { error: e } = await supabase
          .from("sesion_entrenamiento")
          .update(valores)
          .eq("id", sesion.id);
        if (e) throw e;
        // por excepción: se reemplazan las faltas guardadas
        const { error: eDel } = await supabase
          .from("sesion_asistencia")
          .delete()
          .eq("sesion_id", sesion.id);
        if (eDel) throw eDel;
      }
      if (estado === "realizada" && ausentes.size > 0) {
        const { error: eIns } = await supabase.from("sesion_asistencia").insert(
          [...ausentes].map((deportistaId) => ({
            sesion_id: sesionId,
            deportista_id: deportistaId,
            presente: false,
          })),
        );
        if (eIns) throw eIns;
      }
      agenda.recargar();
      if (esVirtual(sesion.id)) {
        router.replace(`/sesiones/${sesionId}`);
      } else {
        setCancelando(false);
        setTocado(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
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

      <div>
        <h1 className="text-xl font-extrabold capitalize tracking-tight">
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
        </h1>
        <p className="text-sm text-muted-foreground">
          {categoria?.nombre} · {sesion.entrenador}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {lugar?.nombre ?? "Lugar a definir"}
          {lugar?.direccion && ` · ${lugar.direccion}`}
        </p>
      </div>

      {sesion.estado === "cancelada" && (
        <div className="flex items-start gap-2.5 rounded-xl bg-warning-soft p-3.5 text-sm text-warning">
          <CloudRain className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="font-semibold">
            Sesión cancelada.{" "}
            <span className="font-normal">{sesion.descripcion}</span>
          </p>
        </div>
      )}

      {atributoFoco && !editable && (
        <div className="flex items-center gap-2.5 rounded-xl bg-secondary px-3.5 py-3 text-sm font-semibold text-secondary-foreground">
          <Target className="size-4 shrink-0" aria-hidden />
          Foco de la sesión: {atributoFoco.nombre}
        </div>
      )}

      {sesion.estado !== "cancelada" && !editable && sesion.descripcion && (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed">
          {sesion.descripcion}
        </p>
      )}

      {esProgramada && permisos.opera && (
        <Link
          href={`/entrenamiento?categoria=${sesion.categoriaId}`}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground transition-transform active:scale-[0.99]"
        >
          <Dumbbell className="size-4.5" aria-hidden />
          Planificar en el tablero
        </Link>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-semibold text-destructive">
            No se pudo guardar: {error}
          </p>
        </div>
      )}

      {/* Foco + nota, editables solo con permiso de operación real */}
      {editable && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="sesion-foco"
                className="mb-1.5 block text-xs font-bold text-muted-foreground"
              >
                Foco de la sesión (opcional)
              </label>
              <select
                id="sesion-foco"
                value={foco}
                onChange={(e) => {
                  setFoco(e.target.value);
                  setTocado(true);
                }}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
              >
                <option value="">General</option>
                {datos.atributos
                  .filter((a) => a.entrenable)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="sesion-nota"
                className="mb-1.5 block text-xs font-bold text-muted-foreground"
              >
                Nota (opcional)
              </label>
              <input
                id="sesion-nota"
                value={descripcion}
                onChange={(e) => {
                  setDescripcion(e.target.value);
                  setTocado(true);
                }}
                placeholder="Ej. Trabajo de pases y definición"
                className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>
      )}

      {/* Lista / asistencia */}
      {sesion.estado !== "cancelada" && (
        <section className="rounded-2xl border border-border bg-card">
          <h2 className="flex items-baseline justify-between border-b border-border px-4 py-3 text-sm font-extrabold">
            {editable
              ? `Pasar lista (${presentes}/${lista.length} presentes)`
              : esProgramada
                ? `Convocados (${lista.length})`
                : `Asistencia (${presentes}/${lista.length})`}
            {editable && (
              <span className="text-[11px] font-semibold text-muted-foreground">
                Tocá solo a los que faltaron
              </span>
            )}
          </h2>
          <ul>
            {lista.map((deportistaId) => {
              const d = datos.deportistas.find((x) => x.id === deportistaId);
              if (!d) return null;
              const presente = !ausentes.has(deportistaId);
              const contenido = (
                <>
                  <AvatarIniciales
                    nombre={d.nombre}
                    apellido={d.apellido}
                    className="size-8 text-xs"
                  />
                  <span className="flex-1 truncate text-left text-sm font-semibold">
                    {d.apellido}, {d.nombre}
                  </span>
                  {(editable || !esProgramada) && (
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                        presente
                          ? "bg-success-soft text-success"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {presente ? (
                        <Check className="size-3" aria-hidden />
                      ) : (
                        <X className="size-3" aria-hidden />
                      )}
                      {presente ? "Presente" : "Ausente"}
                    </span>
                  )}
                  {!editable && (
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                </>
              );
              return (
                <li
                  key={deportistaId}
                  className="border-b border-border last:border-0"
                >
                  {editable ? (
                    <button
                      onClick={() => toggle(deportistaId)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50",
                        !presente && "bg-destructive/[0.03]",
                      )}
                      aria-pressed={!presente}
                      aria-label={`${d.apellido}, ${d.nombre}: marcar ${presente ? "ausente" : "presente"}`}
                    >
                      {contenido}
                    </button>
                  ) : (
                    <Link
                      href={`/deportistas/${d.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      {contenido}
                    </Link>
                  )}
                </li>
              );
            })}
            {lista.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                No hay deportistas cargados en esta categoría todavía.{" "}
                {editable && (
                  <Link
                    href="/deportistas/nuevo"
                    className="font-semibold text-primary"
                  >
                    Dar de alta
                  </Link>
                )}
              </li>
            )}
          </ul>
        </section>
      )}

      {/* Acciones */}
      {editable && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => void guardar("realizada")}
            disabled={
              guardando ||
              lista.length === 0 ||
              (sesion.estado === "realizada" && !tocado)
            }
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {guardando ? (
              <Loader2 className="size-4.5 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4.5" aria-hidden />
            )}
            {sesion.estado === "realizada"
              ? tocado
                ? "Guardar cambios"
                : "Asistencia guardada — tocá un nombre para corregir"
              : `Guardar asistencia (${presentes} presentes)`}
          </button>

          {esProgramada &&
            (cancelando ? (
              <div className="rounded-2xl border border-border bg-card p-4">
                <label
                  htmlFor="sesion-motivo"
                  className="mb-1.5 block text-xs font-bold text-muted-foreground"
                >
                  Motivo de la cancelación
                </label>
                <input
                  id="sesion-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej. Lluvia — cancha inundada"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => void guardar("cancelada")}
                    disabled={guardando}
                    className="h-10 rounded-xl bg-destructive px-4 text-sm font-bold text-white disabled:opacity-60"
                  >
                    Cancelar la sesión
                  </button>
                  <button
                    onClick={() => setCancelando(false)}
                    className="h-10 rounded-xl px-4 text-sm font-bold text-muted-foreground"
                  >
                    Volver
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCancelando(true)}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-bold text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                <CloudRain className="size-4" aria-hidden />
                No se entrena (cancelar sesión)
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
