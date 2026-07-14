"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Layers,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { useClub } from "@/lib/use-club";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { EstadoVacio } from "@/components/estado-vacio";
import type { CategoriaDB } from "@/lib/tipos-db";
import { cn } from "@/lib/utils";

// Alta de deportista (paso 6 de docs/OPERACION.md): datos mínimos +
// tutor + consentimiento en el MISMO formulario. Si el consentimiento
// falta, el alta NO se bloquea (regla del piloto) pero queda marcado
// como pendiente. Sin DNI real: doc_interno. RLS: el profe solo puede
// dar de alta en SUS categorías; el admin en todo el club.

interface FormAlta {
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  sexo: "" | "M" | "F" | "X";
  lateralidad: "" | "diestro" | "zurdo" | "ambidiestro";
  docInterno: string;
  categoriaId: string;
  tutorNombre: string;
  tutorRelacion: string;
  tutorTelefono: string;
  tutorEmail: string;
  consentimiento: boolean;
  consentimientoObs: string;
}

const FORM_VACIO: FormAlta = {
  nombre: "",
  apellido: "",
  fechaNacimiento: "",
  sexo: "",
  lateralidad: "",
  docInterno: "",
  categoriaId: "",
  tutorNombre: "",
  tutorRelacion: "",
  tutorTelefono: "",
  tutorEmail: "",
  consentimiento: false,
  consentimientoObs: "",
};

const inputClase =
  "h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function NuevoDeportistaPage() {
  const sesion = useClub();
  // null = todavía cargando (distinto de "el club no tiene categorías")
  const [categorias, setCategorias] = useState<CategoriaDB[] | null>(null);
  const [form, setForm] = useState<FormAlta>({ ...FORM_VACIO });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [cargados, setCargados] = useState<
    { nombre: string; categoria: string; consentimiento: boolean }[]
  >([]);

  const clubId = sesion.membresia?.clubId ?? null;
  const puedeOperar =
    sesion.membresia?.rol === "admin_club" || sesion.membresia?.rol === "entrenador";

  useEffect(() => {
    if (!clubId) return;
    crearClienteBrowser()
      .from("categoria")
      .select("id, nombre, tipo, anio_nacimiento, disciplina_id")
      .eq("club_id", clubId)
      .then(({ data }) => setCategorias((data as CategoriaDB[]) ?? []));
  }, [clubId]);

  // El profe solo puede dar de alta en sus categorías asignadas
  const opciones = useMemo(() => {
    const visibles = sesion.categoriasAsignadas
      ? (categorias ?? []).filter((c) => sesion.categoriasAsignadas!.includes(c.id))
      : (categorias ?? []);
    return [...visibles].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [categorias, sesion.categoriasAsignadas]);

  // Sugerencia de categoría por cohorte al elegir fecha de nacimiento.
  // slice y no new Date(): 'YYYY-01-01' parseado como UTC caería en
  // el año anterior con el huso de Argentina (UTC-3).
  const alCambiarNacimiento = (fecha: string) => {
    setForm((f) => {
      const anio = Number(fecha.slice(0, 4));
      const cohorte =
        !f.categoriaId && fecha ? opciones.find((c) => c.anio_nacimiento === anio) : null;
      return { ...f, fechaNacimiento: fecha, categoriaId: cohorte?.id ?? f.categoriaId };
    });
  };

  if (sesion.cargando || (puedeOperar && categorias === null)) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!sesion.usuario || !puedeOperar) {
    return (
      <AvisoAcceso
        titulo="Solo para el staff que opera"
        detalle="Dar de alta deportistas es tarea del profe (en sus categorías) o del admin del club."
        accionHref={sesion.usuario ? "/deportistas" : "/login"}
        accionLabel={sesion.usuario ? "Volver a deportistas" : "Ingresar"}
      />
    );
  }

  // Sin categorías el alta no tiene dónde caer: en vez de un select
  // vacío, explicar el paso previo según quién pueda resolverlo.
  if (opciones.length === 0) {
    const esAdmin = sesion.membresia?.rol === "admin_club";
    return (
      <div className="space-y-6">
        <div>
          <Link
            href="/deportistas"
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" aria-hidden /> Deportistas
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
            Nuevo deportista
          </h1>
        </div>
        {esAdmin ? (
          <EstadoVacio
            icono={Layers}
            titulo="Primero armá las categorías del club"
            detalle="Cada deportista se carga dentro de una categoría (su cohorte de nacimiento). Hay una estructura estándar lista para generar en un toque."
            accion={{ href: "/club/categorias", label: "Crear categorías" }}
          />
        ) : (
          <EstadoVacio
            icono={Layers}
            titulo="Todavía no tenés categorías asignadas"
            detalle="El admin del club te asigna tus categorías desde la pantalla de Staff. Cuando lo haga, desde acá vas a dar de alta a tu plantel."
            nota="Si ya debería estar, avisale al admin del club."
          />
        )}
      </div>
    );
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubId) return;
    const nombre = form.nombre.trim();
    if (!nombre || !form.categoriaId) {
      setError("Como mínimo: nombre y categoría.");
      return;
    }
    if (form.consentimiento && !form.tutorNombre.trim()) {
      setError("Para registrar el consentimiento hace falta el nombre del tutor.");
      return;
    }
    setGuardando(true);
    setError("");
    const supabase = crearClienteBrowser();

    // El deportista ya quedó en la base: sumarlo a "Cargados recién" y
    // limpiar el form aunque falle un paso posterior, para que un
    // reintento no lo duplique.
    const registrarCargado = (consentimientoOk: boolean) => {
      const categoria =
        (categorias ?? []).find((c) => c.id === form.categoriaId)?.nombre ?? "";
      setCargados((prev) => [
        {
          nombre: `${nombre} ${form.apellido.trim()}`.trim(),
          categoria,
          consentimiento: consentimientoOk,
        },
        ...prev,
      ]);
      // Queda lista para cargar al siguiente de la misma categoría
      setForm({ ...FORM_VACIO, categoriaId: form.categoriaId });
    };

    const { data: dep, error: eDep } = await supabase
      .from("deportista")
      .insert({
        club_id: clubId,
        categoria_id: form.categoriaId,
        nombre,
        apellido: form.apellido.trim() || null,
        fecha_nacimiento: form.fechaNacimiento || null,
        sexo: form.sexo || null,
        lateralidad: form.lateralidad || null,
        doc_interno: form.docInterno.trim() || null,
      })
      .select("id")
      .single();
    if (eDep || !dep) {
      setGuardando(false);
      setError(`No se pudo guardar el deportista: ${eDep?.message ?? "error desconocido"}`);
      return;
    }

    let tutorId: string | null = null;
    if (form.tutorNombre.trim()) {
      const { data: tut, error: eTut } = await supabase
        .from("tutor")
        .insert({
          deportista_id: dep.id,
          nombre: form.tutorNombre.trim(),
          relacion: form.tutorRelacion.trim() || null,
          telefono: form.tutorTelefono.trim() || null,
          email: form.tutorEmail.trim() || null,
        })
        .select("id")
        .single();
      if (eTut) {
        setGuardando(false);
        setError(
          `El deportista quedó guardado, pero falló el tutor: ${eTut.message}. Cargá el tutor desde su ficha (no vuelvas a dar el alta).`,
        );
        registrarCargado(false);
        return;
      }
      tutorId = tut?.id ?? null;
    }

    if (form.consentimiento) {
      const { error: eCons } = await supabase.from("consentimiento").insert({
        deportista_id: dep.id,
        tutor_id: tutorId,
        otorgado: true,
        observacion: form.consentimientoObs.trim() || null,
      });
      if (eCons) {
        setGuardando(false);
        setError(
          `El deportista quedó guardado, pero falló el consentimiento: ${eCons.message}. Registralo desde su ficha (no vuelvas a dar el alta).`,
        );
        registrarCargado(false);
        return;
      }
    }

    registrarCargado(form.consentimiento);
    setGuardando(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/deportistas"
          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" aria-hidden /> Deportistas
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Nuevo deportista</h1>
        <p className="text-sm text-muted-foreground">
          Lo mínimo para arrancar: nombre, categoría y el consentimiento del tutor en el
          mismo paso
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          ¿El plantel ya está en una planilla?{" "}
          <Link href="/deportistas/importar" className="font-bold text-primary">
            Importalo de una vez
          </Link>
          .
        </p>
      </div>

      {cargados.length > 0 && (
        <div className="rounded-2xl border border-primary/25 bg-secondary/40 p-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            Cargados recién
          </p>
          <ul className="mt-2 space-y-1">
            {cargados.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-sm font-semibold">
                <Check className="size-4 text-primary" aria-hidden />
                <span>
                  {c.nombre} · {c.categoria}
                </span>
                {!c.consentimiento && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    consentimiento pendiente
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={guardar} className="space-y-5">
        {/* ---------- Deportista ---------- */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            Deportista
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="dep-nombre" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Nombre *
              </label>
              <input
                id="dep-nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                className={inputClase}
              />
            </div>
            <div>
              <label htmlFor="dep-apellido" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Apellido
              </label>
              <input
                id="dep-apellido"
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                className={inputClase}
              />
            </div>
            <div>
              <label htmlFor="dep-nacimiento" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Fecha de nacimiento
              </label>
              <input
                id="dep-nacimiento"
                type="date"
                value={form.fechaNacimiento}
                onChange={(e) => alCambiarNacimiento(e.target.value)}
                className={inputClase}
              />
            </div>
            <div>
              <label htmlFor="dep-categoria" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Categoría *
              </label>
              <select
                id="dep-categoria"
                value={form.categoriaId}
                onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                required
                className={inputClase}
              >
                <option value="">Elegir…</option>
                {opciones.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {sesion.categoriasAsignadas && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Solo tus categorías asignadas.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="dep-doc" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Identificador interno
              </label>
              <input
                id="dep-doc"
                value={form.docInterno}
                onChange={(e) => setForm({ ...form, docInterno: e.target.value })}
                placeholder="Ej. carnet del club — nunca el DNI"
                className={inputClase}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="dep-sexo" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  Sexo
                </label>
                <select
                  id="dep-sexo"
                  value={form.sexo}
                  onChange={(e) => setForm({ ...form, sexo: e.target.value as FormAlta["sexo"] })}
                  className={inputClase}
                >
                  <option value="">—</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="X">X</option>
                </select>
              </div>
              <div>
                <label htmlFor="dep-lateralidad" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                  Pierna hábil
                </label>
                <select
                  id="dep-lateralidad"
                  value={form.lateralidad}
                  onChange={(e) =>
                    setForm({ ...form, lateralidad: e.target.value as FormAlta["lateralidad"] })
                  }
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

        {/* ---------- Tutor ---------- */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            Tutor / familia
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="tut-nombre" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Nombre del tutor
              </label>
              <input
                id="tut-nombre"
                value={form.tutorNombre}
                onChange={(e) => setForm({ ...form, tutorNombre: e.target.value })}
                className={inputClase}
              />
            </div>
            <div>
              <label htmlFor="tut-relacion" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Relación
              </label>
              <input
                id="tut-relacion"
                value={form.tutorRelacion}
                onChange={(e) => setForm({ ...form, tutorRelacion: e.target.value })}
                placeholder="Madre, padre, tutor legal…"
                className={inputClase}
              />
            </div>
            <div>
              <label htmlFor="tut-telefono" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Teléfono
              </label>
              <input
                id="tut-telefono"
                type="tel"
                value={form.tutorTelefono}
                onChange={(e) => setForm({ ...form, tutorTelefono: e.target.value })}
                className={inputClase}
              />
            </div>
            <div>
              <label htmlFor="tut-email" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Email
              </label>
              <input
                id="tut-email"
                type="email"
                value={form.tutorEmail}
                onChange={(e) => setForm({ ...form, tutorEmail: e.target.value })}
                className={inputClase}
              />
            </div>
          </div>
        </div>

        {/* ---------- Consentimiento ---------- */}
        <div
          className={cn(
            "rounded-2xl border p-4 shadow-sm transition-colors",
            form.consentimiento
              ? "border-primary/40 bg-secondary/40"
              : "border-amber-300/60 bg-amber-50/60",
          )}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={form.consentimiento}
              onChange={(e) => setForm({ ...form, consentimiento: e.target.checked })}
              className="mt-1 size-4 accent-[var(--primary)]"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-extrabold">
                {form.consentimiento ? (
                  <ShieldCheck className="size-4 text-primary" aria-hidden />
                ) : (
                  <ShieldAlert className="size-4 text-amber-600" aria-hidden />
                )}
                El tutor firmó el consentimiento
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {form.consentimiento
                  ? "Queda registrado con fecha de hoy, a nombre del tutor de arriba."
                  : "Se puede cargar igual, pero el consentimiento queda visible como PENDIENTE hasta que lo registres."}
              </span>
            </span>
          </label>
          {form.consentimiento && (
            <input
              value={form.consentimientoObs}
              onChange={(e) => setForm({ ...form, consentimientoObs: e.target.value })}
              placeholder="Referencia del papel firmado (ej. carpeta 2026, folio 12)"
              className={cn(inputClase, "mt-3")}
            />
          )}
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
              <UserPlus className="size-5" aria-hidden /> Dar de alta
            </>
          )}
        </button>
      </form>
    </div>
  );
}
