"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  ImageUp,
  KeyRound,
  Landmark,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { EscudoClub } from "@/components/escudo-club";
import { usePerfil } from "@/components/perfil-context";
import { SALTA_DEPARTAMENTOS } from "@/lib/salta-departamentos";
import {
  borrarClub,
  crearClub,
  editarClub,
  linkAdminClub,
  listarClubes,
  quitarEscudo,
  subirEscudo,
  type ClubPlataforma,
} from "@/app/plataforma/actions";

// Gestión de clubes de la PLATAFORMA (Ola 1.5 — antes por script):
// alta de club + su primer admin por link, edición de datos, escudo.
// Las server actions verifican app_metadata.plataforma en el server;
// esta pantalla solo corta la vista por perfil.

const DEPARTAMENTOS = [...SALTA_DEPARTAMENTOS.map((d) => d.nombre)].sort((a, b) =>
  a.localeCompare(b),
);

interface FormClub {
  id: string | null; // null = alta
  nombre: string;
  localidad: string;
  departamento: string;
  adminNombre: string;
  adminEmail: string;
}

const FORM_VACIO: FormClub = {
  id: null,
  nombre: "",
  localidad: "",
  departamento: "",
  adminNombre: "",
  adminEmail: "",
};

function BotonesLink({ link, nombre }: { link: string; nombre: string }) {
  const [copiado, setCopiado] = useState(false);
  const mensaje = `Hola! Te comparto tu acceso de administración a Talento Deportivo (${nombre}). Entrá por acá para crear tu clave: ${link}`;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        onClick={() => {
          void navigator.clipboard.writeText(link);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        }}
        className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground"
      >
        {copiado ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copiado ? "Copiado" : "Copiar link"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
      >
        <Link2 className="size-3.5" aria-hidden />
        Mandar por WhatsApp
      </a>
    </div>
  );
}

export default function ClubesPlataforma() {
  const { perfil, sesionReal } = usePerfil();
  const [clubes, setClubes] = useState<ClubPlataforma[] | null>(null);
  const [form, setForm] = useState<FormClub | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null);
  const [linkNuevo, setLinkNuevo] = useState<{ club: string; link: string } | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const inputEscudo = useRef<HTMLInputElement>(null);
  const clubEscudo = useRef<string | null>(null);

  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const esPlataformaReal = sesionReal && perfil === "super_admin";

  useEffect(() => {
    if (!esPlataformaReal) return;
    let cancelado = false;
    listarClubes().then((r) => {
      if (cancelado) return;
      if (r.ok) setClubes(r.data);
      else setError(r.error);
    });
    return () => {
      cancelado = true;
    };
  }, [esPlataformaReal, version]);

  if (perfil !== "super_admin") {
    return (
      <AvisoAcceso
        titulo="Solo para la plataforma"
        detalle="El alta y la edición de clubes son de la operación provincial. Cada club gestiona lo suyo desde Club."
        accionHref="/panel"
        accionLabel="Volver al inicio"
      />
    );
  }
  if (!esPlataformaReal) {
    return (
      <AvisoAcceso
        titulo="Requiere la sesión real de plataforma"
        detalle="Esta pantalla escribe en la base (alta de clubes, escudos, accesos). En la demo pública es de solo lectura: ingresá con la cuenta de plataforma."
        accionHref="/login"
        accionLabel="Ingresar"
      />
    );
  }

  const guardar = async () => {
    if (!form) return;
    setGuardando(true);
    setError("");
    const r = form.id
      ? await editarClub({
          id: form.id,
          nombre: form.nombre,
          localidad: form.localidad,
          departamento: form.departamento,
        })
      : await crearClub({
          nombre: form.nombre,
          localidad: form.localidad,
          departamento: form.departamento,
          adminNombre: form.adminNombre,
          adminEmail: form.adminEmail,
          origen: location.origin,
        });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    if (!form.id && "link" in (r.data as object)) {
      setLinkNuevo({
        club: form.nombre.trim(),
        link: (r.data as { link: string }).link,
      });
      setAviso(`Club "${form.nombre.trim()}" creado. Pasale el acceso al referente:`);
    } else {
      setAviso("Datos del club actualizados.");
      setLinkNuevo(null);
    }
    setForm(null);
    recargar();
  };

  const elegirEscudo = (clubId: string) => {
    clubEscudo.current = clubId;
    inputEscudo.current?.click();
  };

  const onEscudo = async (archivo: File | null) => {
    const clubId = clubEscudo.current;
    if (!archivo || !clubId) return;
    setSubiendo(clubId);
    setError("");
    const fd = new FormData();
    fd.set("clubId", clubId);
    fd.set("archivo", archivo);
    const r = await subirEscudo(fd);
    setSubiendo(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAviso("Escudo actualizado.");
    recargar();
  };

  const sacarEscudo = async (c: ClubPlataforma) => {
    setSubiendo(c.id);
    const r = await quitarEscudo(c.id);
    setSubiendo(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAviso(`Se quitó el escudo de ${c.nombre}.`);
    recargar();
  };

  const nuevoLink = async (c: ClubPlataforma) => {
    if (!c.admin?.email) return;
    setError("");
    const r = await linkAdminClub({
      clubId: c.id,
      email: c.admin.email,
      origen: location.origin,
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setLinkNuevo({ club: c.nombre, link: r.data.link });
    setAviso(`Nuevo acceso para el admin de ${c.nombre}:`);
  };

  const borrar = async (c: ClubPlataforma) => {
    setConfirmarBorrar(null);
    setError("");
    const r = await borrarClub(c.id);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAviso(`Club "${c.nombre}" eliminado.`);
    recargar();
  };

  return (
    <div className="space-y-6">
      {/* input file único, compartido por todas las tarjetas */}
      <input
        ref={inputEscudo}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          void onEscudo(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Clubes</h1>
          <p className="text-sm text-muted-foreground">
            Alta institucional: club + su referente admin. Cada club gestiona
            después lo suyo.
          </p>
        </div>
        <button
          onClick={() => {
            setForm(FORM_VACIO);
            setLinkNuevo(null);
            setAviso("");
          }}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
        >
          <Plus className="size-4" aria-hidden /> Nuevo club
        </button>
      </div>

      {aviso && (
        <div className="rounded-xl border border-primary/25 bg-secondary/60 p-3">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p className="text-sm font-semibold">{aviso}</p>
            <button
              onClick={() => {
                setAviso("");
                setLinkNuevo(null);
              }}
              className="ml-auto text-muted-foreground hover:text-foreground"
              aria-label="Cerrar aviso"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {linkNuevo && (
            <div className="mt-1 pl-6">
              <p className="break-all rounded-lg bg-background/70 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                {linkNuevo.link}
              </p>
              <BotonesLink link={linkNuevo.link} nombre={linkNuevo.club} />
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </div>
      )}

      {/* Alta / edición */}
      {form && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            {form.id ? "Editar club" : "Nuevo club"}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="club-nombre" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Nombre del club
              </label>
              <input
                id="club-nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Club Atlético Antoniana"
                className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label htmlFor="club-localidad" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Localidad
              </label>
              <input
                id="club-localidad"
                value={form.localidad}
                onChange={(e) => setForm({ ...form, localidad: e.target.value })}
                placeholder="Ej. Salta"
                className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="club-departamento" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Departamento (ubica al club en el mapa del observatorio)
              </label>
              <select
                id="club-departamento"
                value={form.departamento}
                onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
              >
                <option value="">Sin definir</option>
                {DEPARTAMENTOS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            {!form.id && (
              <>
                <div>
                  <label htmlFor="admin-nombre" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                    Referente admin — nombre
                  </label>
                  <input
                    id="admin-nombre"
                    value={form.adminNombre}
                    onChange={(e) => setForm({ ...form, adminNombre: e.target.value })}
                    placeholder="Ej. María García"
                    className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label htmlFor="admin-email" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                    Referente admin — email
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    value={form.adminEmail}
                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                    placeholder="maria@club.ar"
                    className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => void guardar()}
              disabled={guardando}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-60"
            >
              {guardando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              {form.id ? "Guardar" : "Crear club y generar acceso"}
            </button>
            <button
              onClick={() => {
                setForm(null);
                setError("");
              }}
              className="h-10 rounded-xl px-4 text-sm font-bold text-muted-foreground"
            >
              Cancelar
            </button>
          </div>
          {!form.id && (
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Se crea el club y un link de acceso para el referente: se lo pasás
              por WhatsApp, entra, crea su clave y desde ahí arma categorías,
              staff y deportistas. La plataforma no toca nada de eso.
            </p>
          )}
        </div>
      )}

      {/* Lista */}
      {clubes === null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : clubes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay clubes: creá el primero.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {clubes.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3.5">
                <EscudoClub url={c.escudoUrl} nombre={c.nombre} className="size-14" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-base font-extrabold leading-snug">
                    {c.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[c.localidad, c.departamento && `Dpto. ${c.departamento}`]
                      .filter(Boolean)
                      .join(" · ") || "Sin ubicación cargada"}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Users className="size-3.5" aria-hidden />
                    {c.deportistas} deportistas · {c.staff} staff
                  </p>
                </div>
                <button
                  onClick={() => {
                    setForm({
                      id: c.id,
                      nombre: c.nombre,
                      localidad: c.localidad ?? "",
                      departamento: c.departamento ?? "",
                      adminNombre: "",
                      adminEmail: "",
                    });
                    setAviso("");
                    setLinkNuevo(null);
                  }}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Editar ${c.nombre}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <button
                  onClick={() => elegirEscudo(c.id)}
                  disabled={subiendo === c.id}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                >
                  {subiendo === c.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ImageUp className="size-3.5" aria-hidden />
                  )}
                  {c.escudoUrl ? "Cambiar escudo" : "Subir escudo"}
                </button>
                {c.escudoUrl && (
                  <button
                    onClick={() => void sacarEscudo(c)}
                    disabled={subiendo === c.id}
                    className="h-9 rounded-lg px-2.5 text-xs font-bold text-muted-foreground transition-colors hover:text-destructive"
                  >
                    Quitar
                  </button>
                )}
                {c.admin?.email && (
                  <button
                    onClick={() => void nuevoLink(c)}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <KeyRound className="size-3.5" aria-hidden />
                    Nuevo acceso admin
                  </button>
                )}
                {c.deportistas === 0 &&
                  (confirmarBorrar === c.id ? (
                    <span className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => void borrar(c)}
                        className="h-9 rounded-lg bg-destructive px-3 text-xs font-bold text-white"
                      >
                        Eliminar club
                      </button>
                      <button
                        onClick={() => setConfirmarBorrar(null)}
                        className="h-9 rounded-lg px-2 text-xs font-bold text-muted-foreground"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmarBorrar(c.id)}
                      className="ml-auto flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Eliminar ${c.nombre}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  ))}
              </div>

              <p className="mt-2 text-[11px] text-muted-foreground">
                {c.admin ? (
                  <>
                    Admin: <span className="font-semibold">{c.admin.nombre}</span>
                    {c.admin.email && ` (${c.admin.email})`}
                    {!c.admin.entro && (
                      <span className="ml-1.5 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">
                        todavía no entró
                      </span>
                    )}
                  </>
                ) : (
                  "Sin admin asignado"
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl bg-secondary p-3.5 text-xs leading-relaxed text-secondary-foreground">
        <Landmark className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          La plataforma da de alta la institución y nada más: los datos de los
          deportistas son de cada club y esta pantalla no accede a ninguna
          ficha. Los clubes con deportistas cargados no se pueden eliminar
          desde acá.
        </p>
      </div>
    </div>
  );
}
