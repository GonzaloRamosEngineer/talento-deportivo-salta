"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { useClub } from "@/lib/use-club";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { Ayuda } from "@/components/ayuda";
import { EstadoVacio } from "@/components/estado-vacio";
import { DIAS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

// Gestión del cronograma semanal y los lugares del club (solo admin;
// RLS: horario_escritura / lugar_escritura). De estos horarios fijos
// se arma sola la agenda de cada semana: el profe solo pasa lista.

const ORDEN_TIPO: Record<string, number> = {
  escuelita: 0,
  inferior: 1,
  reserva: 2,
  primera: 3,
};

interface Cat {
  id: string;
  nombre: string;
  tipo: string | null;
  anio_nacimiento: number | null;
}

interface LugarFila {
  id: string;
  nombre: string;
  direccion: string | null;
}

interface HorarioFila {
  id: string;
  categoria_id: string;
  dia_semana: number;
  hora: string;
  lugar_id: string | null;
}

export default function AgendaClubPage() {
  const sesion = useClub();
  const [categorias, setCategorias] = useState<Cat[]>([]);
  const [lugares, setLugares] = useState<LugarFila[]>([]);
  const [horarios, setHorarios] = useState<HorarioFila[]>([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [formLugar, setFormLugar] = useState<{ nombre: string; direccion: string } | null>(null);
  const [formHorario, setFormHorario] = useState<{
    categoriaId: string;
    dia: string;
    hora: string;
    lugarId: string;
  } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const clubId = sesion.membresia?.clubId ?? null;
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!clubId) return;
    let cancelado = false;
    async function cargar() {
      const supabase = crearClienteBrowser();
      const [rCats, rLugs, rHors] = await Promise.all([
        supabase
          .from("categoria")
          .select("id, nombre, tipo, anio_nacimiento")
          .eq("club_id", clubId!),
        supabase
          .from("lugar")
          .select("id, nombre, direccion")
          .eq("club_id", clubId!)
          .order("nombre"),
        supabase
          .from("horario_entrenamiento")
          .select("id, categoria_id, dia_semana, hora, lugar_id")
          .eq("club_id", clubId!)
          .order("dia_semana")
          .order("hora"),
      ]);
      if (cancelado) return;
      // sin esto, un error dejaba el spinner girando para siempre
      const errorCarga = rCats.error ?? rLugs.error ?? rHors.error;
      if (errorCarga) {
        setError(`No se pudo cargar la agenda del club: ${errorCarga.message}`);
        setCargandoDatos(false);
        return;
      }
      setCategorias((rCats.data as Cat[]) ?? []);
      setLugares((rLugs.data as LugarFila[]) ?? []);
      setHorarios((rHors.data as HorarioFila[]) ?? []);
      setCargandoDatos(false);
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [clubId, version]);

  const catsOrdenadas = useMemo(
    () =>
      [...categorias].sort(
        (a, b) =>
          (ORDEN_TIPO[a.tipo ?? ""] ?? 9) - (ORDEN_TIPO[b.tipo ?? ""] ?? 9) ||
          (b.anio_nacimiento ?? 0) - (a.anio_nacimiento ?? 0) ||
          a.nombre.localeCompare(b.nombre),
      ),
    [categorias],
  );
  const conRutina = catsOrdenadas.filter((c) =>
    horarios.some((h) => h.categoria_id === c.id),
  );

  if (sesion.cargando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!sesion.usuario || sesion.membresia?.rol !== "admin_club") {
    return (
      <AvisoAcceso
        titulo="Solo para el admin del club"
        detalle="Los horarios fijos y los lugares los gestiona el administrador. Los profes ven la agenda armada y pasan lista."
        accionHref={sesion.usuario ? "/panel" : "/login"}
        accionLabel={sesion.usuario ? "Volver al inicio" : "Ingresar"}
      />
    );
  }

  const guardarLugar = async () => {
    if (!formLugar || !clubId) return;
    const nombre = formLugar.nombre.trim();
    if (!nombre) {
      setError("El lugar necesita un nombre.");
      return;
    }
    setGuardando(true);
    setError("");
    const { error: e } = await crearClienteBrowser().from("lugar").insert({
      club_id: clubId,
      nombre,
      direccion: formLugar.direccion.trim() || null,
    });
    setGuardando(false);
    if (e) {
      setError(
        e.code === "23505"
          ? "Ya hay un lugar con ese nombre."
          : `No se pudo guardar: ${e.message}`,
      );
      return;
    }
    setAviso(`Lugar "${nombre}" creado.`);
    setFormLugar(null);
    recargar();
  };

  const borrarLugar = async (l: LugarFila) => {
    setError("");
    const { error: e } = await crearClienteBrowser()
      .from("lugar")
      .delete()
      .eq("id", l.id);
    setConfirmarBorrar(null);
    if (e) {
      setError(`No se pudo eliminar: ${e.message}`);
      return;
    }
    setAviso(`Lugar "${l.nombre}" eliminado. Los horarios que lo usaban quedaron sin lugar.`);
    recargar();
  };

  const guardarHorario = async () => {
    if (!formHorario || !clubId) return;
    if (!formHorario.categoriaId || !formHorario.hora) {
      setError("Elegí categoría, día y hora.");
      return;
    }
    setGuardando(true);
    setError("");
    const { error: e } = await crearClienteBrowser()
      .from("horario_entrenamiento")
      .insert({
        club_id: clubId,
        categoria_id: formHorario.categoriaId,
        dia_semana: Number(formHorario.dia),
        hora: formHorario.hora,
        lugar_id: formHorario.lugarId || null,
      });
    setGuardando(false);
    if (e) {
      setError(`No se pudo guardar: ${e.message}`);
      return;
    }
    setAviso("Horario agregado al cronograma.");
    // se mantiene el form abierto con la misma categoría: cargar la
    // rutina completa de una categoría son 2-3 altas seguidas
    setFormHorario({ ...formHorario, dia: "1", hora: "" });
    recargar();
  };

  const borrarHorario = async (h: HorarioFila) => {
    setError("");
    const { error: e } = await crearClienteBrowser()
      .from("horario_entrenamiento")
      .delete()
      .eq("id", h.id);
    setConfirmarBorrar(null);
    if (e) {
      setError(`No se pudo eliminar: ${e.message}`);
      return;
    }
    setAviso("Horario eliminado del cronograma.");
    recargar();
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/club"
          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" aria-hidden /> Club
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Agenda del club</h1>
          <p className="text-sm text-muted-foreground">
            Horarios fijos por categoría y lugares de entrenamiento. Con esto la
            agenda semanal se arma sola.
          </p>
        </div>
      </div>

      <Ayuda
        bullets={[
          "Los lugares son las canchas y predios del club; cada horario y cada partido de local se asigna a uno.",
          "El cronograma es la rutina fija (ej. 9ª División: martes y jueves 18:00): de acá se generan solas las sesiones de cada semana y el profe solo pasa lista.",
          "Cargar la rutina de una categoría son 2 o 3 altas seguidas; el formulario queda abierto a propósito para eso.",
        ]}
      />

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

      {/* ---------- Lugares ---------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold">Lugares</h2>
          <button
            onClick={() => setFormLugar({ nombre: "", direccion: "" })}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground transition-all hover:opacity-90"
          >
            <Plus className="size-3.5" aria-hidden /> Lugar
          </button>
        </div>

        {formLugar && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="lugar-nombre" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  Nombre
                </label>
                <input
                  id="lugar-nombre"
                  value={formLugar.nombre}
                  onChange={(e) => setFormLugar({ ...formLugar, nombre: e.target.value })}
                  placeholder="Ej. Cancha principal — Sede"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label htmlFor="lugar-direccion" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  Dirección (opcional)
                </label>
                <input
                  id="lugar-direccion"
                  value={formLugar.direccion}
                  onChange={(e) => setFormLugar({ ...formLugar, direccion: e.target.value })}
                  placeholder="Ej. Av. Independencia 910, Salta"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => void guardarLugar()}
                disabled={guardando}
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
                  setFormLugar(null);
                  setError("");
                }}
                className="h-10 rounded-xl px-4 text-sm font-bold text-muted-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {cargandoDatos ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : lugares.length === 0 ? (
          <EstadoVacio
            icono={MapPin}
            titulo="Sin lugares todavía"
            detalle="Cargá la sede y los predios donde entrena el club. Cada horario del cronograma y cada partido de local se asignan a un lugar."
            nota="Se agregan con el botón Lugar, acá arriba."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {lugares.map((l, i) => (
              <div
                key={l.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  i > 0 && "border-t border-border",
                )}
              >
                <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{l.nombre}</p>
                  {l.direccion && (
                    <p className="truncate text-xs text-muted-foreground">{l.direccion}</p>
                  )}
                </div>
                {confirmarBorrar === `lugar-${l.id}` ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void borrarLugar(l)}
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
                    onClick={() => setConfirmarBorrar(`lugar-${l.id}`)}
                    className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Eliminar ${l.nombre}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Cronograma semanal ---------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold">Cronograma semanal</h2>
          {catsOrdenadas.length > 0 && (
            <button
              onClick={() =>
                setFormHorario({
                  categoriaId: catsOrdenadas[0]?.id ?? "",
                  dia: "1",
                  hora: "",
                  lugarId: lugares[0]?.id ?? "",
                })
              }
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground transition-all hover:opacity-90"
            >
              <Plus className="size-3.5" aria-hidden /> Horario
            </button>
          )}
        </div>

        {/* Sin categorías no hay a qué ponerle horario: primero eso */}
        {!cargandoDatos && catsOrdenadas.length === 0 && (
          <EstadoVacio
            icono={CalendarDays}
            titulo="Primero armá las categorías del club"
            detalle="Cada horario fijo pertenece a una categoría. Cuando las tengas creadas, acá cargás su rutina semanal."
            accion={{ href: "/club/categorias", label: "Crear categorías" }}
          />
        )}

        {formHorario && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="hor-categoria" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  Categoría
                </label>
                <select
                  id="hor-categoria"
                  value={formHorario.categoriaId}
                  onChange={(e) =>
                    setFormHorario({ ...formHorario, categoriaId: e.target.value })
                  }
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                >
                  {catsOrdenadas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="hor-dia" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  Día
                </label>
                <select
                  id="hor-dia"
                  value={formHorario.dia}
                  onChange={(e) => setFormHorario({ ...formHorario, dia: e.target.value })}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm capitalize outline-none transition-colors focus:border-primary"
                >
                  {DIAS.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="hor-hora" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  Hora
                </label>
                <input
                  id="hor-hora"
                  type="time"
                  value={formHorario.hora}
                  onChange={(e) => setFormHorario({ ...formHorario, hora: e.target.value })}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
              <div>
                <label htmlFor="hor-lugar" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  Lugar
                </label>
                <select
                  id="hor-lugar"
                  value={formHorario.lugarId}
                  onChange={(e) => setFormHorario({ ...formHorario, lugarId: e.target.value })}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                >
                  <option value="">A definir</option>
                  {lugares.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => void guardarHorario()}
                disabled={guardando}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-60"
              >
                {guardando ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-4" aria-hidden />
                )}
                Agregar
              </button>
              <button
                onClick={() => {
                  setFormHorario(null);
                  setError("");
                }}
                className="h-10 rounded-xl px-4 text-sm font-bold text-muted-foreground"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {cargandoDatos ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : conRutina.length === 0 ? (
          catsOrdenadas.length > 0 && (
            <EstadoVacio
              icono={CalendarDays}
              titulo="El cronograma está vacío"
              detalle="Agregá los días y horarios fijos de cada categoría (ej. 9ª División: martes y jueves 18:00). La agenda de cada semana se genera sola a partir de acá."
              nota="Se agregan con el botón Horario, acá arriba."
            />
          )
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {conRutina.map((c, i) => (
              <div key={c.id} className={cn("px-4 py-3", i > 0 && "border-t border-border")}>
                <p className="text-sm font-extrabold">{c.nombre}</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {horarios
                    .filter((h) => h.categoria_id === c.id)
                    .map((h) => {
                      const lugar = lugares.find((l) => l.id === h.lugar_id);
                      return (
                        <li key={h.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                          <span className="flex-1 capitalize">
                            {DIAS[h.dia_semana - 1]} {h.hora.slice(0, 5)} ·{" "}
                            {lugar?.nombre ?? "lugar a definir"}
                          </span>
                          {confirmarBorrar === `horario-${h.id}` ? (
                            <span className="flex items-center gap-1">
                              <button
                                onClick={() => void borrarHorario(h)}
                                className="h-8 rounded-lg bg-destructive px-2.5 text-xs font-bold text-white"
                              >
                                Eliminar
                              </button>
                              <button
                                onClick={() => setConfirmarBorrar(null)}
                                className="h-8 rounded-lg px-2 text-xs font-bold text-muted-foreground"
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmarBorrar(`horario-${h.id}`)}
                              className="flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Eliminar horario de ${c.nombre}`}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Cada horario genera una sesión &quot;programada&quot; en la agenda de la
        semana. El profe la abre, pasa lista (solo marca las faltas) o la cancela
        si no se entrenó. Los partidos se cargan aparte, desde la agenda.
      </p>
    </div>
  );
}
