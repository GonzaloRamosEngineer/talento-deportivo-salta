"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  Archive,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { useClub } from "@/lib/use-club";
import { useDatos } from "@/lib/use-datos";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { cn } from "@/lib/utils";

// Edición y baja del deportista — el resto del ciclo de vida que el
// alta no cubre: corregir un dato, moverlo de categoría al cambiar el
// año, y las dos bajas. RLS: editar/desactivar puede cualquiera que
// opere la categoría (para mover, también la de destino); el borrado
// definitivo es solo del admin (policy deportista_delete_admin).

const inputClase =
  "h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

interface FormEdicion {
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  sexo: string;
  lateralidad: string;
  docInterno: string;
  categoriaId: string;
}

export function EditarDeportistaCliente({ id }: { id: string }) {
  const router = useRouter();
  const sesion = useClub();
  const datos = useDatos();
  const [form, setForm] = useState<FormEdicion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // dos pasos para las bajas: primer tap arma, segundo confirma
  const [confirmando, setConfirmando] = useState<"baja" | "pase" | "borrado" | null>(
    null,
  );
  const [ejecutandoBaja, setEjecutandoBaja] = useState(false);
  const [clubDestino, setClubDestino] = useState("");

  if (datos.cargando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }
  if (!datos.real) {
    return (
      <AvisoAcceso
        titulo="En la demo no se edita"
        detalle="La edición de deportistas guarda cambios reales. Ingresá con tu cuenta de club para usarla."
        accionHref="/login"
        accionLabel="Ingresar"
      />
    );
  }

  if (sesion.membresia?.rol === "comision_directiva") {
    return (
      <AvisoAcceso
        titulo="Tu perfil es de consulta"
        detalle="La edición de deportistas es del profe (en sus categorías) o del admin del club."
        accionHref={`/deportistas/${id}`}
        accionLabel="Volver a la ficha"
      />
    );
  }

  const deportista = datos.deportistas.find((d) => d.id === id);
  if (!deportista) {
    return (
      <AvisoAcceso
        titulo="Ficha no encontrada"
        detalle="Este deportista no existe o está fuera de tus categorías asignadas."
        accionHref="/deportistas"
        accionLabel="Ver tus deportistas"
      />
    );
  }

  const esAdmin = sesion.membresia?.rol === "admin_club";
  const f: FormEdicion = form ?? {
    nombre: deportista.nombre,
    apellido: deportista.apellido,
    fechaNacimiento: deportista.fechaNacimiento,
    sexo: deportista.sexo ?? "",
    lateralidad: deportista.lateralidad ?? "",
    docInterno: deportista.docInterno ?? "",
    categoriaId: deportista.categoriaId,
  };
  const set = (parcial: Partial<FormEdicion>) => setForm({ ...f, ...parcial });

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.nombre.trim() || !f.categoriaId) {
      setError("Como mínimo: nombre y categoría.");
      return;
    }
    setGuardando(true);
    setError("");
    const { error: eUpd } = await crearClienteBrowser()
      .from("deportista")
      .update({
        nombre: f.nombre.trim(),
        apellido: f.apellido.trim() || null,
        fecha_nacimiento: f.fechaNacimiento || null,
        sexo: f.sexo || null,
        lateralidad: f.lateralidad || null,
        doc_interno: f.docInterno.trim() || null,
        categoria_id: f.categoriaId,
      })
      .eq("id", id);
    setGuardando(false);
    if (eUpd) {
      setError(`No se pudo guardar: ${eUpd.message}`);
      return;
    }
    // El movimiento de categoría queda en la trayectoria (hito de
    // promoción con snapshots de nombre). Si el hito falla, la edición
    // ya está guardada: se avisa sin frenar.
    if (cambioDeCategoria) {
      const origen = datos.categorias.find((c) => c.id === deportista.categoriaId);
      const destino = datos.categorias.find((c) => c.id === f.categoriaId);
      const { error: eHito } = await crearClienteBrowser()
        .from("deportista_hito")
        .insert({
          deportista_id: id,
          tipo: "promocion",
          fecha: new Date().toLocaleDateString("en-CA"),
          categoria_origen_id: deportista.categoriaId || null,
          categoria_destino_id: f.categoriaId,
          categoria_origen_nombre: origen?.nombre ?? null,
          categoria_destino_nombre: destino?.nombre ?? "Nueva categoría",
          registrado_por: datos.membresiaId,
        });
      if (eHito && eHito.code !== "23505") {
        setError(
          `El cambio se guardó, pero el hito de trayectoria no (${eHito.message}). Podés cargarlo a mano desde la ficha.`,
        );
        datos.recargar();
        return;
      }
    }
    datos.recargar();
    router.push(`/deportistas/${id}`);
  };

  const darDeBaja = async () => {
    setEjecutandoBaja(true);
    setError("");
    const { error: eBaja } = await crearClienteBrowser()
      .from("deportista")
      .update({ activo: false })
      .eq("id", id);
    setEjecutandoBaja(false);
    if (eBaja) {
      setError(`No se pudo dar de baja: ${eBaja.message}`);
      return;
    }
    datos.recargar();
    router.push("/deportistas");
  };

  // Baja por pase: registra el hito de salida (con el club destino en
  // TEXTO — los datos del menor no viajan a ningún lado) y desactiva.
  // La categoría queda intacta: el profe sigue viendo su trayectoria.
  const bajaPorPase = async () => {
    if (clubDestino.trim().length < 3) {
      setError("Contanos a qué club se fue (mínimo 3 caracteres).");
      return;
    }
    setEjecutandoBaja(true);
    setError("");
    const supabase = crearClienteBrowser();
    const { error: eHito } = await supabase.from("deportista_hito").insert({
      deportista_id: id,
      tipo: "pase_salida",
      fecha: new Date().toLocaleDateString("en-CA"),
      club_destino_nombre: clubDestino.trim(),
      registrado_por: datos.membresiaId,
    });
    if (eHito && eHito.code !== "23505") {
      setEjecutandoBaja(false);
      setError(`No se pudo registrar el pase: ${eHito.message}`);
      return;
    }
    const { error: eBaja } = await supabase
      .from("deportista")
      .update({ activo: false })
      .eq("id", id);
    setEjecutandoBaja(false);
    if (eBaja) {
      setError(
        `El pase quedó registrado pero la baja falló: ${eBaja.message}. Reintentá la baja.`,
      );
      return;
    }
    datos.recargar();
    router.push("/deportistas");
  };

  const borrarDefinitivo = async () => {
    setEjecutandoBaja(true);
    setError("");
    const { error: eDel } = await crearClienteBrowser()
      .from("deportista")
      .delete()
      .eq("id", id);
    setEjecutandoBaja(false);
    if (eDel) {
      setError(`No se pudo borrar: ${eDel.message}`);
      return;
    }
    datos.recargar();
    router.push("/deportistas");
  };

  const cambioDeCategoria = f.categoriaId !== deportista.categoriaId;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/deportistas/${id}`}
          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" aria-hidden /> Ficha
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
          Editar a {deportista.nombre} {deportista.apellido}
        </h1>
        <p className="text-sm text-muted-foreground">
          Corregí datos o movelo de categoría. Las mediciones y su historial no
          se tocan.
        </p>
      </div>

      <form onSubmit={guardar} className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            Datos del deportista
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ed-nombre" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Nombre *
              </label>
              <input
                id="ed-nombre"
                value={f.nombre}
                onChange={(e) => set({ nombre: e.target.value })}
                required
                className={inputClase}
              />
            </div>
            <div>
              <label htmlFor="ed-apellido" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Apellido
              </label>
              <input
                id="ed-apellido"
                value={f.apellido}
                onChange={(e) => set({ apellido: e.target.value })}
                className={inputClase}
              />
            </div>
            <div>
              <label htmlFor="ed-nacimiento" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Fecha de nacimiento
              </label>
              <input
                id="ed-nacimiento"
                type="date"
                value={f.fechaNacimiento}
                onChange={(e) => set({ fechaNacimiento: e.target.value })}
                className={inputClase}
              />
            </div>
            <div>
              <label htmlFor="ed-categoria" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Categoría *
              </label>
              <select
                id="ed-categoria"
                value={f.categoriaId}
                onChange={(e) => set({ categoriaId: e.target.value })}
                required
                className={inputClase}
              >
                {datos.categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {cambioDeCategoria && (
                <p className="mt-1 text-[11px] font-semibold text-warning">
                  Lo estás moviendo de categoría: sus mediciones lo acompañan y
                  quien no opere la nueva categoría deja de verlo.
                </p>
              )}
              {sesion.categoriasAsignadas && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Solo entre tus categorías asignadas.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="ed-doc" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Identificador interno
              </label>
              <input
                id="ed-doc"
                value={f.docInterno}
                onChange={(e) => set({ docInterno: e.target.value })}
                placeholder="Ej. carnet del club — nunca el DNI"
                className={inputClase}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ed-sexo" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  Sexo
                </label>
                <select
                  id="ed-sexo"
                  value={f.sexo}
                  onChange={(e) => set({ sexo: e.target.value })}
                  className={inputClase}
                >
                  <option value="">—</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="X">X</option>
                </select>
              </div>
              <div>
                <label htmlFor="ed-lateralidad" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  Pierna hábil
                </label>
                <select
                  id="ed-lateralidad"
                  value={f.lateralidad}
                  onChange={(e) => set({ lateralidad: e.target.value })}
                  className={inputClase}
                >
                  <option value="">—</option>
                  <option value="diestro">Diestro</option>
                  <option value="zurdo">Zurdo</option>
                  <option value="ambidiestro">Ambidiestro</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <p className="text-sm font-semibold text-destructive">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-60 sm:w-auto sm:px-6"
        >
          {guardando ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden /> Guardando…
            </>
          ) : (
            <>
              <Save className="size-5" aria-hidden /> Guardar cambios
            </>
          )}
        </button>
      </form>

      {/* ---------- Zona de baja ---------- */}
      <div className="rounded-2xl border border-warning/40 bg-warning-soft/50 p-4">
        <p className="text-xs font-extrabold uppercase tracking-widest text-warning">
          Baja
        </p>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Dar de baja (deja el club)</p>
              <p className="text-xs text-muted-foreground">
                Sale de las listas y de la jornada de medición, pero todo su
                historial se conserva por si vuelve.
              </p>
            </div>
            {confirmando === "baja" ? (
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setConfirmando(null)}
                  className="h-10 rounded-xl border border-border bg-card px-3.5 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void darDeBaja()}
                  disabled={ejecutandoBaja}
                  className="flex h-10 items-center gap-1.5 rounded-xl bg-warning px-3.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {ejecutandoBaja && (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  )}
                  Confirmar baja
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmando("baja")}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-warning/50 bg-card px-3.5 text-xs font-bold text-warning"
              >
                <Archive className="size-3.5" aria-hidden /> Dar de baja
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-warning/20 pt-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Baja por pase a otro club</p>
              <p className="text-xs text-muted-foreground">
                Registra la salida en su trayectoria y lo da de baja. Sus datos
                NO se comparten con el otro club: quedan acá, como siempre.
              </p>
            </div>
            {confirmando === "pase" ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto">
                <input
                  value={clubDestino}
                  onChange={(e) => setClubDestino(e.target.value)}
                  maxLength={120}
                  placeholder="Club de destino — como te lo informaron"
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-ring sm:w-72"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmando(null)}
                    className="h-10 rounded-xl border border-border bg-card px-3.5 text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void bajaPorPase()}
                    disabled={ejecutandoBaja}
                    className="flex h-10 items-center gap-1.5 rounded-xl bg-warning px-3.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {ejecutandoBaja && (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    )}
                    Confirmar el pase
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmando("pase")}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-warning/50 bg-card px-3.5 text-xs font-bold text-warning"
              >
                <ArrowRightLeft className="size-3.5" aria-hidden /> Registrar pase
              </button>
            )}
          </div>

          {esAdmin && (
            <div
              className={cn(
                "flex flex-wrap items-center gap-3 border-t border-warning/20 pt-3",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-danger">Borrar definitivamente</p>
                <p className="text-xs text-muted-foreground">
                  Borra al deportista CON todas sus mediciones, consentimientos y
                  asistencia. No hay vuelta atrás. Solo admin.
                </p>
              </div>
              {confirmando === "borrado" ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setConfirmando(null)}
                    className="h-10 rounded-xl border border-border bg-card px-3.5 text-xs font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void borrarDefinitivo()}
                    disabled={ejecutandoBaja}
                    className="flex h-10 items-center gap-1.5 rounded-xl bg-danger px-3.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {ejecutandoBaja && (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    )}
                    Borrar todo su historial
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmando("borrado")}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-danger/40 bg-card px-3.5 text-xs font-bold text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden /> Borrar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
