"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Link2,
  Loader2,
  Plus,
  UserMinus,
  X,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { useClub } from "@/lib/use-club";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { Ayuda } from "@/components/ayuda";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import {
  FUNCIONES_SUGERIDAS,
  ROL_LABEL,
  type CategoriaDB,
  type MembresiaDB,
  type RolMembresia,
} from "@/lib/tipos-db";
import { cn } from "@/lib/utils";
import { estadoStaff, invitarMiembro, quitarMiembro, regenerarLink } from "./actions";

// Staff del club (pasos 4-5 de docs/OPERACION.md): el admin invita
// por LINK (lo comparte por WhatsApp), elige rol y asigna categorías.
// El profe solo va a ver/operar las categorías tildadas acá (RLS v6).

const ORDEN_ROL: Record<RolMembresia, number> = {
  admin_club: 0,
  entrenador: 1,
  comision_directiva: 2,
};

interface FormInvitacion {
  nombre: string;
  email: string;
  rol: RolMembresia;
  funcion: string;
  categoriaIds: string[];
}

const FORM_VACIO: FormInvitacion = {
  nombre: "",
  email: "",
  rol: "entrenador",
  funcion: "",
  categoriaIds: [],
};

function CheckboxCategorias({
  categorias,
  seleccionadas,
  onCambiar,
}: {
  categorias: CategoriaDB[];
  seleccionadas: string[];
  onCambiar: (ids: string[]) => void;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {categorias.map((c) => {
        const activa = seleccionadas.includes(c.id);
        return (
          <label
            key={c.id}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
              activa
                ? "border-primary/50 bg-secondary/60"
                : "border-border bg-background hover:border-primary/30",
            )}
          >
            <input
              type="checkbox"
              checked={activa}
              onChange={(e) =>
                onCambiar(
                  e.target.checked
                    ? [...seleccionadas, c.id]
                    : seleccionadas.filter((id) => id !== c.id),
                )
              }
              className="size-4 accent-[var(--primary)]"
            />
            <span className="truncate">{c.nombre}</span>
          </label>
        );
      })}
      {categorias.length === 0 && (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Primero creá las categorías del club en{" "}
          <Link href="/club/categorias" className="font-bold underline underline-offset-2">
            Categorías
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function PanelLink({
  titulo,
  link,
  onCerrar,
}: {
  titulo: string;
  link: string;
  onCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const textoWhatsApp = encodeURIComponent(
    `¡Hola! Te sumamos al staff del club en Talento Deportivo Salta. Entrá por acá para crear tu contraseña: ${link}`,
  );
  return (
    <div className="rounded-2xl border border-primary/30 bg-secondary/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-extrabold">{titulo}</p>
        <button
          onClick={onCerrar}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Compartile este link (vence a las 24 horas — si se pasa, generás otro desde la
        lista). Al abrirlo crea su contraseña y entra directo.
      </p>
      <p className="mt-2 break-all rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px]">
        {link}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1500);
          }}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground transition-all hover:opacity-90"
        >
          {copiado ? (
            <>
              <Check className="size-3.5" aria-hidden /> Copiado
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden /> Copiar link
            </>
          )}
        </button>
        <a
          href={`https://wa.me/?text=${textoWhatsApp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-xs font-bold transition-colors hover:border-primary/50"
        >
          Compartir por WhatsApp
        </a>
      </div>
    </div>
  );
}

export default function StaffPage() {
  const sesion = useClub();
  const [miembros, setMiembros] = useState<MembresiaDB[]>([]);
  const [categorias, setCategorias] = useState<CategoriaDB[]>([]);
  const [asignaciones, setAsignaciones] = useState<Record<string, string[]>>({});
  const [entraron, setEntraron] = useState<Record<string, { entro: boolean }>>({});
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [form, setForm] = useState<FormInvitacion | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [linkGenerado, setLinkGenerado] = useState<{ titulo: string; link: string } | null>(null);
  const [editandoCats, setEditandoCats] = useState<string | null>(null);
  const [catsBorrador, setCatsBorrador] = useState<string[]>([]);
  const [confirmarQuitar, setConfirmarQuitar] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState("");

  const clubId = sesion.membresia?.clubId ?? null;
  // recargar() sube la versión y el effect vuelve a leer de la base
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!clubId) return;
    let cancelado = false;
    async function cargar() {
      const supabase = crearClienteBrowser();
      const [rMembs, rCats, rMc] = await Promise.all([
        supabase
          .from("membresia")
          .select("id, auth_user_id, nombre, email, rol, funcion")
          .eq("club_id", clubId!),
        supabase
          .from("categoria")
          .select("id, nombre, tipo, anio_nacimiento, disciplina_id")
          .eq("club_id", clubId!),
        supabase.from("membresia_categoria").select("membresia_id, categoria_id"),
      ]);
      if (cancelado) return;
      // sin esto, un error dejaba el spinner girando para siempre
      const errorCarga = rMembs.error ?? rCats.error ?? rMc.error;
      if (errorCarga) {
        setError(`No se pudo cargar el staff: ${errorCarga.message}`);
        setCargandoDatos(false);
        return;
      }
      const { data: membs } = rMembs;
      const { data: cats } = rCats;
      const { data: mc } = rMc;
      const porMembresia: Record<string, string[]> = {};
      for (const fila of mc ?? []) {
        (porMembresia[fila.membresia_id] ??= []).push(fila.categoria_id);
      }
      setMiembros((membs as MembresiaDB[]) ?? []);
      setCategorias((cats as CategoriaDB[]) ?? []);
      setAsignaciones(porMembresia);
      setCargandoDatos(false);
      // El estado "ya entró" sale de Auth (server action gateada a admin)
      const estado = await estadoStaff();
      if (!cancelado && estado.ok) setEntraron(estado.data);
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [clubId, version]);

  const ordenados = useMemo(
    () =>
      [...miembros].sort(
        (a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || a.nombre.localeCompare(b.nombre),
      ),
    [miembros],
  );

  const categoriasOrdenadas = useMemo(
    () => [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [categorias],
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
        detalle="Invitar profes y asignar categorías es tarea del administrador del club."
        accionHref={sesion.usuario ? "/panel" : "/login"}
        accionLabel={sesion.usuario ? "Volver al inicio" : "Ingresar"}
      />
    );
  }

  const nombreCategoria = (id: string) => categorias.find((c) => c.id === id)?.nombre ?? "—";

  const invitar = async () => {
    if (!form) return;
    setEnviando(true);
    setError("");
    const res = await invitarMiembro({ ...form, origen: window.location.origin });
    setEnviando(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setLinkGenerado({ titulo: `Link de acceso para ${form.nombre.trim()}`, link: res.data.link });
    setForm(null);
    recargar();
  };

  const nuevoLink = async (m: MembresiaDB) => {
    if (!m.email) return;
    setOcupado(m.id);
    setError("");
    const res = await regenerarLink({ email: m.email, origen: window.location.origin });
    setOcupado(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setLinkGenerado({ titulo: `Nuevo link de acceso para ${m.nombre}`, link: res.data.link });
  };

  const quitar = async (m: MembresiaDB) => {
    setOcupado(m.id);
    setError("");
    const res = await quitarMiembro(m.id);
    setOcupado(null);
    setConfirmarQuitar(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    recargar();
  };

  const guardarCategorias = async (m: MembresiaDB) => {
    setOcupado(m.id);
    setError("");
    const supabase = crearClienteBrowser();
    const actuales = new Set(asignaciones[m.id] ?? []);
    const nuevas = new Set(catsBorrador);
    const agregar = catsBorrador.filter((id) => !actuales.has(id));
    const sacar = [...actuales].filter((id) => !nuevas.has(id));
    let fallo: string | null = null;
    if (agregar.length > 0) {
      const { error: e } = await supabase
        .from("membresia_categoria")
        .insert(agregar.map((categoria_id) => ({ membresia_id: m.id, categoria_id })));
      if (e) fallo = e.message;
    }
    if (!fallo && sacar.length > 0) {
      const { error: e } = await supabase
        .from("membresia_categoria")
        .delete()
        .eq("membresia_id", m.id)
        .in("categoria_id", sacar);
      if (e) fallo = e.message;
    }
    setOcupado(null);
    if (fallo) {
      setError(`No se pudieron guardar las categorías: ${fallo}`);
      return;
    }
    setEditandoCats(null);
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
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Staff</h1>
            <p className="text-sm text-muted-foreground">
              Quiénes trabajan en {sesion.club?.nombre ?? "tu club"} y qué categorías
              tiene cada profe
            </p>
          </div>
          <button
            onClick={() => {
              setLinkGenerado(null);
              setForm(form ? null : { ...FORM_VACIO });
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <Plus className="size-4" aria-hidden /> Invitar
          </button>
        </div>
      </div>

      <Ayuda
        bullets={[
          "No hay mails automáticos: al invitar se genera un LINK de acceso que le compartís por WhatsApp; con ese link la persona crea su clave y entra.",
          "El profe solo ve y carga sus categorías asignadas; la comisión directiva ve todo pero no edita.",
          "Si alguien pierde el acceso, generale un link nuevo desde su fila (el anterior deja de servir).",
        ]}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </div>
      )}

      {linkGenerado && (
        <PanelLink
          titulo={linkGenerado.titulo}
          link={linkGenerado.link}
          onCerrar={() => setLinkGenerado(null)}
        />
      )}

      {/* Formulario de invitación */}
      {form && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            Invitar al staff
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="inv-nombre" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Nombre
              </label>
              <input
                id="inv-nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Marcela Gómez"
                className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label htmlFor="inv-email" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Email
              </label>
              <input
                id="inv-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="profe@club.com"
                className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-1.5 text-xs font-bold text-muted-foreground">Rol</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ROL_LABEL) as RolMembresia[]).map((rol) => (
                <button
                  key={rol}
                  type="button"
                  onClick={() => setForm({ ...form, rol })}
                  className={cn(
                    "h-9 rounded-full border px-3.5 text-xs font-bold transition-colors",
                    form.rol === rol
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {ROL_LABEL[rol]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {form.rol === "entrenador"
                ? "El profe solo ve y carga las categorías que le asignes."
                : form.rol === "comision_directiva"
                  ? "La comisión ve todo el club, solo consulta — no carga ni edita."
                  : "El admin gestiona todo el club: categorías, staff y deportistas."}
            </p>
          </div>

          <div className="mt-3">
            <label
              htmlFor="inv-funcion"
              className="mb-1.5 block text-xs font-bold text-muted-foreground"
            >
              Función <span className="font-normal">(opcional)</span>
            </label>
            <input
              id="inv-funcion"
              list="funciones-sugeridas"
              value={form.funcion}
              onChange={(e) => setForm({ ...form, funcion: e.target.value })}
              placeholder="Ej. Preparador físico, DT, Nutricionista…"
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <datalist id="funciones-sugeridas">
              {FUNCIONES_SUGERIDAS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Qué profesional es dentro del cuerpo técnico. No cambia qué puede ver
              o hacer — eso lo define el rol.
            </p>
          </div>

          {form.rol === "entrenador" && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-bold text-muted-foreground">Sus categorías</p>
              <CheckboxCategorias
                categorias={categoriasOrdenadas}
                seleccionadas={form.categoriaIds}
                onCambiar={(ids) => setForm({ ...form, categoriaIds: ids })}
              />
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={invitar}
              disabled={enviando}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-60"
            >
              {enviando ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Generando link…
                </>
              ) : (
                <>
                  <Link2 className="size-4" aria-hidden /> Generar link de acceso
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

      {/* Lista de staff */}
      {cargandoDatos ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {ordenados.map((m, i) => {
            const cats = asignaciones[m.id] ?? [];
            const estado = m.email ? entraron[m.email.toLowerCase()] : undefined;
            const pendiente = estado ? !estado.entro : false;
            const soyYo = m.id === sesion.membresia?.id;
            return (
              <div key={m.id} className={cn("px-4 py-3.5", i > 0 && "border-t border-border")}>
                <div className="flex items-center gap-3">
                  <AvatarIniciales
                    nombre={m.nombre}
                    apellido={m.nombre.split(" ").slice(1).join(" ")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-extrabold">
                      <span className="truncate">{m.nombre}</span>
                      {m.funcion && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                          {m.funcion}
                        </span>
                      )}
                      {soyYo && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          vos
                        </span>
                      )}
                      {pendiente && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Todavía no entró
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ROL_LABEL[m.rol]}
                      {m.email ? ` · ${m.email}` : ""}
                    </p>
                  </div>
                  {m.email && (
                    <button
                      onClick={() => void nuevoLink(m)}
                      disabled={ocupado === m.id}
                      className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                      title="Nuevo link de acceso (si perdió el link o la contraseña)"
                      aria-label={`Nuevo link de acceso para ${m.nombre}`}
                    >
                      {ocupado === m.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Link2 className="size-4" aria-hidden />
                      )}
                    </button>
                  )}
                  {!soyYo &&
                    (confirmarQuitar === m.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void quitar(m)}
                          className="h-9 rounded-lg bg-destructive px-3 text-xs font-bold text-white"
                        >
                          Quitar
                        </button>
                        <button
                          onClick={() => setConfirmarQuitar(null)}
                          className="h-9 rounded-lg px-2 text-xs font-bold text-muted-foreground"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmarQuitar(m.id)}
                        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Quitar a ${m.nombre} del staff`}
                      >
                        <UserMinus className="size-4" aria-hidden />
                      </button>
                    ))}
                </div>

                {/* Categorías del profe */}
                {m.rol === "entrenador" && (
                  <div className="mt-2 pl-12">
                    {editandoCats === m.id ? (
                      <div className="space-y-2">
                        <CheckboxCategorias
                          categorias={categoriasOrdenadas}
                          seleccionadas={catsBorrador}
                          onCambiar={setCatsBorrador}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void guardarCategorias(m)}
                            disabled={ocupado === m.id}
                            className="flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-60"
                          >
                            <Check className="size-3.5" aria-hidden /> Guardar
                          </button>
                          <button
                            onClick={() => setEditandoCats(null)}
                            className="h-8 rounded-lg px-2 text-xs font-bold text-muted-foreground"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {cats.length === 0 ? (
                          <span className="text-xs font-semibold text-amber-700">
                            Sin categorías asignadas — no ve ningún deportista
                          </span>
                        ) : (
                          cats.map((id) => (
                            <span
                              key={id}
                              className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground"
                            >
                              {nombreCategoria(id)}
                            </span>
                          ))
                        )}
                        <button
                          onClick={() => {
                            setEditandoCats(m.id);
                            setCatsBorrador(cats);
                          }}
                          className="text-[11px] font-bold text-primary underline underline-offset-2"
                        >
                          Editar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        El alcance por categoría lo aplica la base de datos (RLS), no la interfaz: aunque
        el profe navegue por URL directa, solo accede a los deportistas de sus categorías.
      </p>
    </div>
  );
}
