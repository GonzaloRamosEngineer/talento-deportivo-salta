"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Building2, ChevronLeft, ChevronRight, Gauge, Loader2, Plus, Send, UserPlus, Users, X } from "lucide-react";
import { cn, paraBuscar } from "@/lib/utils";
import { CampoBusqueda } from "@/components/secretaria/campo-busqueda";
import { PRESIONABLE } from "@/components/secretaria/presionable";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import type { SolicitudSecretaria } from "@/lib/secretaria/solicitudes";

export interface GrupoArbol {
  id: string;
  nombre: string;
  tipo: string | null;
  activo: boolean;
  deportistas: number;
}
export interface DisciplinaArbol { id: string; nombre: string; grupos: GrupoArbol[] }
export interface InstitucionArbol { id: string; nombre: string; tipo: string | null; localidad: string | null; activo: boolean; disciplinas: DisciplinaArbol[] }
export interface ConfiguracionSecretaria { arbol: InstitucionArbol[]; disciplinas: Array<{ id: string; nombre: string }>; rol: string; solicitudes?: SolicitudSecretaria[] }
type Accion = "institucion" | "grupo" | "deportista" | "disciplina";
interface Candidato { id: string; nombre: string; apellido: string | null; fechaNacimiento: string | null; grupo: string | null; institucion: string | null; activo: boolean; coincidencia: string }
interface DeportistaLista { id: string; nombre: string; apellido: string | null; grupoId: string; grupo: string; institucion: string; disciplina: string; mediciones: number }

export type VistaConfiguracion = "instituciones" | "grupos" | "disciplinas" | "deportistas";

const TIPO_INSTITUCION: Record<string, string> = { club: "Club", liga: "Liga", asociacion: "Asociación", escuela: "Escuela", grupo: "Grupo", otro: "Otro" };
const POR_PAGINA = 20;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const campo = "mt-1 block h-11 min-w-0 w-full max-w-full box-border rounded-xl border border-input bg-background px-3 text-base outline-none focus:border-primary";

function ModalMovil({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  const [viewport, setViewport] = useState(() => typeof window === "undefined"
    ? { alto: 0, arriba: 0 }
    : { alto: window.visualViewport?.height ?? window.innerHeight, arriba: window.visualViewport?.offsetTop ?? 0 });

  useEffect(() => {
    const actualizar = () => {
      const visual = window.visualViewport;
      setViewport({ alto: visual?.height ?? window.innerHeight, arriba: visual?.offsetTop ?? 0 });
    };
    window.visualViewport?.addEventListener("resize", actualizar);
    window.visualViewport?.addEventListener("scroll", actualizar);
    window.addEventListener("resize", actualizar);
    return () => {
      window.visualViewport?.removeEventListener("resize", actualizar);
      window.visualViewport?.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
    };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed left-0 right-0 z-[100] flex items-end justify-center overflow-hidden bg-black/40 sm:inset-0 sm:items-center sm:p-5" style={{ top: viewport.arriba, height: viewport.alto || "100dvh" }} onMouseDown={(evento) => { if (evento.target === evento.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={titulo} className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-card shadow-xl sm:rounded-3xl">
        <header className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5"><div><p className="text-[11px] font-extrabold uppercase tracking-wider text-primary">Organizar el espacio</p><h2 className="mt-1 text-lg font-extrabold sm:text-xl">{titulo}</h2></div><button type="button" onClick={onClose} className="-mr-1 -mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-muted" aria-label="Cerrar"><X className="size-4" /></button></header>
        <div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:p-5">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

export function ConfiguradorSecretaria({ inicial, recargar, vista }: { inicial: ConfiguracionSecretaria; recargar: () => Promise<void>; vista: VistaConfiguracion }) {
  const [accion, setAccion] = useState<Accion | null>(null);
  const [institucionId, setInstitucionId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [tipo, setTipo] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [notas, setNotas] = useState("");
  const [descripcion, setDescripcion] = useState("");
  // Pedido al catálogo: una disciplina nueva, o algo que falta medir en una
  // que ya existe (antes solo existía la primera y la segunda se rechazaba).
  const [tipoSolicitud, setTipoSolicitud] = useState<"nueva" | "falta">("nueva");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [deportistas, setDeportistas] = useState<DeportistaLista[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [institucionAbierta, setInstitucionAbierta] = useState<string | null>(null);
  const [disciplinaAbierta, setDisciplinaAbierta] = useState<string | null>(null);

  useEffect(() => {
    if (vista !== "deportistas" || deportistas) return;
    const controlador = new AbortController();
    fetch("/api/secretaria/deportistas", { signal: controlador.signal })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos cargar los deportistas.");
        return cuerpo as DeportistaLista[];
      })
      .then(setDeportistas)
      .catch(() => { if (!controlador.signal.aborted) setDeportistas([]); });
    return () => controlador.abort();
  }, [vista, deportistas]);

  const grupos = useMemo(() => inicial.arbol.flatMap((institucion) => institucion.disciplinas.flatMap((disciplina) => disciplina.grupos.map((grupo) => ({ ...grupo, institucionId: institucion.id, institucion: institucion.nombre, disciplina: disciplina.nombre })))), [inicial.arbol]);
  const disciplinas = useMemo(() => {
    const agregadas = new Map<string, { id: string; nombre: string; instituciones: Set<string>; grupos: number }>();
    for (const institucion of inicial.arbol) for (const disciplina of institucion.disciplinas) {
      const actual = agregadas.get(disciplina.id) ?? { id: disciplina.id, nombre: disciplina.nombre, instituciones: new Set<string>(), grupos: 0 };
      actual.instituciones.add(institucion.nombre);
      actual.grupos += disciplina.grupos.length;
      agregadas.set(disciplina.id, actual);
    }
    return [...agregadas.values()].map((item) => ({ ...item, instituciones: [...item.instituciones].join(", ") }));
  }, [inicial.arbol]);
  const institucionDetalle = inicial.arbol.find((item) => item.id === institucionAbierta);
  const disciplinaDetalle = disciplinas.find((item) => item.id === disciplinaAbierta);
  const gruposDeDisciplina = disciplinaAbierta
    ? inicial.arbol.flatMap((institucion) => institucion.disciplinas.filter((item) => item.id === disciplinaAbierta).flatMap((item) => item.grupos.map((grupo) => ({ ...grupo, institucion: institucion.nombre, disciplina: item.nombre }))))
    : [];
  const termino = paraBuscar(busqueda);
  const coincide = (...partes: Array<string | null | undefined>) => !termino || paraBuscar(partes.filter(Boolean).join(" ")).includes(termino);
  const deportistasFiltrados = (deportistas ?? []).filter((item) => coincide(item.nombre, item.apellido, item.institucion, item.disciplina, item.grupo));
  const totalPaginas = Math.max(1, Math.ceil(deportistasFiltrados.length / POR_PAGINA));
  const deportistasPagina = deportistasFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const institucionesVisibles = inicial.arbol.filter((i) => coincide(i.nombre, i.localidad, i.tipo ? TIPO_INSTITUCION[i.tipo] ?? i.tipo : null));
  const gruposVisibles = grupos.filter((g) => coincide(g.nombre, g.institucion, g.disciplina));
  const disciplinasVisibles = disciplinas.filter((d) => coincide(d.nombre, d.instituciones));
  const puedeCrearInstitucion = inicial.rol === "admin_secretaria";
  const puedeConfigurar = inicial.rol === "admin_secretaria" || inicial.rol === "coordinador_secretaria";

  function abrir(nuevaAccion: Accion, contexto?: { institucionId?: string; grupoId?: string }) {
    setAccion(nuevaAccion);
    setInstitucionId(contexto?.institucionId ?? (nuevaAccion === "grupo" ? inicial.arbol[0]?.id ?? "" : ""));
    setGrupoId(contexto?.grupoId ?? (nuevaAccion === "deportista" ? grupos[0]?.id ?? "" : ""));
    setDisciplinaId(nuevaAccion === "grupo" ? inicial.disciplinas[0]?.id ?? "" : "");
    setNombre(""); setApellido(""); setFechaNacimiento(""); setTipo(""); setLocalidad(""); setNotas(""); setDescripcion(""); setError(null); setAviso(null); setCandidatos([]); setTipoSolicitud("nueva");
  }

  async function enviar(resolucion?: string) {
    if (!accion) return;
    setGuardando(true); setError(null); setAviso(null);
    const cuerpos: Record<Accion, Record<string, unknown>> = {
      institucion: { accion: "crear_institucion", nombre, tipo, localidad, notas },
      grupo: { accion: "crear_grupo", institucionId, disciplinaId, nombre, tipo },
      deportista: { accion: "crear_deportista", grupoId, identidad: { nombre, apellido, fechaNacimiento }, resolucion },
      disciplina: tipoSolicitud === "falta"
        ? { accion: "solicitar_protocolo", disciplinaId, texto: nombre, contexto: notas }
        : { accion: "solicitar_disciplina", nombre, descripcion, contexto: notas },
    };
    const respuesta = await fetch("/api/secretaria/configuracion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpos[accion]) });
    const cuerpo = await respuesta.json();
    setGuardando(false);
    if (!respuesta.ok) { setError(cuerpo.error ?? "No pudimos guardar los cambios."); return; }
    if (cuerpo.estado === "DEPORTISTA_POSIBLE_DUPLICADO") { setCandidatos(cuerpo.candidatos ?? []); return; }
    if (cuerpo.estado === "INSTITUCION_POSIBLE_DUPLICADO") { setAviso(`Ya existe ${cuerpo.existente?.nombre}. No se creó otra institución.`); return; }
    if (cuerpo.estado === "GRUPO_POSIBLE_DUPLICADO") { setAviso("Ese grupo ya existe para la institución y disciplina seleccionadas."); return; }
    if (cuerpo.estado === "DISCIPLINA_YA_EXISTE") { setAviso("Esa disciplina ya existe en el catálogo: podés elegirla al crear un plantel. Si falta algo para medir en ella, elegí «Algo que falta en una disciplina»."); return; }
    if (cuerpo.estado === "SOLICITUD_YA_PENDIENTE") { setAviso("Ya hay un pedido igual esperando respuesta."); return; }
    await recargar();
    setAccion(null);
  }

  // Una sola acción, la de la pestaña: antes eran 4 botones en 2 filas
  // antes de llegar al primer dato.
  const accionPrincipal: { accion: Accion; etiqueta: string; corta: string; icono: typeof Plus; contexto?: { institucionId?: string } } | null =
    vista === "instituciones"
      ? institucionDetalle
        ? puedeConfigurar ? { accion: "grupo", etiqueta: "Nuevo plantel", corta: "Plantel", icono: Plus, contexto: { institucionId: institucionDetalle.id } } : null
        : puedeCrearInstitucion ? { accion: "institucion", etiqueta: "Nueva institución", corta: "Nueva", icono: Building2 } : null
      : vista === "grupos" ? (puedeConfigurar ? { accion: "grupo", etiqueta: "Nuevo plantel", corta: "Nuevo", icono: Plus } : null)
      : vista === "disciplinas" ? (puedeConfigurar ? { accion: "disciplina", etiqueta: "Solicitar disciplina", corta: "Solicitar", icono: Send } : null)
      : puedeConfigurar ? { accion: "deportista", etiqueta: "Agregar deportista", corta: "Agregar", icono: UserPlus } : null;
  const placeholder = { instituciones: "Buscar institución o localidad", grupos: "Buscar plantel, institución o disciplina", disciplinas: "Buscar disciplina", deportistas: "Buscar nombre, apellido o plantel" }[vista];
  const verDetalle = vista === "instituciones" && institucionDetalle || vista === "disciplinas" && disciplinaDetalle;
  const sinResultados = (texto: string) => <p className="p-8 text-center text-sm text-muted-foreground">{termino ? `No encontramos "${busqueda.trim()}".` : texto}</p>;
  const volver = (texto: string, onClick: () => void) => <button type="button" onClick={onClick} className="-ml-1 mb-1 inline-flex min-h-11 items-center gap-1 px-1 text-xs font-extrabold text-primary sm:min-h-8"><ChevronLeft className="size-4" aria-hidden />{texto}</button>;
  const accionFila = `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-extrabold text-primary hover:bg-muted/50 sm:min-h-9 ${PRESIONABLE}`;

  return (
    <>
      <div className="flex gap-2">
        {!verDetalle && <CampoBusqueda className="flex-1" valor={busqueda} onCambio={(valor) => { setBusqueda(valor); setPagina(1); }} etiqueta={placeholder} placeholder={placeholder} />}
        {accionPrincipal && (
          <button onClick={() => abrir(accionPrincipal.accion, accionPrincipal.contexto)} className={cn(`inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 ${PRESIONABLE}`, verDetalle && "ml-auto")}>
            <accionPrincipal.icono className="size-4 shrink-0" aria-hidden />
            <span className="sm:hidden">{accionPrincipal.corta}</span>
            <span className="hidden sm:inline">{accionPrincipal.etiqueta}</span>
          </button>
        )}
      </div>

      {vista === "instituciones" && <section className="overflow-hidden rounded-2xl border border-border bg-card">{institucionDetalle ? <>
        <div className="border-b border-border px-4 py-3">
          {volver("Todas las instituciones", () => setInstitucionAbierta(null))}
          <h2 className="text-base font-extrabold">{institucionDetalle.nombre}</h2>
          <p className="text-xs text-muted-foreground">{[institucionDetalle.tipo ? TIPO_INSTITUCION[institucionDetalle.tipo] ?? institucionDetalle.tipo : null, institucionDetalle.localidad, plural(institucionDetalle.disciplinas.length, "disciplina", "disciplinas"), plural(institucionDetalle.disciplinas.reduce((total, item) => total + item.grupos.length, 0), "plantel", "planteles")].filter(Boolean).join(" · ")}</p>
        </div>
        {institucionDetalle.disciplinas.length === 0 ? sinResultados("Todavía no tiene disciplinas ni planteles. Sumá un plantel para empezar a medir acá.") : <div className="divide-y divide-border xl:grid xl:grid-cols-2 xl:gap-3 xl:divide-y-0 xl:p-3">{institucionDetalle.disciplinas.map((disciplina) => <div key={disciplina.id} className="p-3 xl:rounded-xl xl:border xl:border-border xl:bg-background">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-primary">{disciplina.nombre}</p>
          {disciplina.grupos.map((grupo) => <div key={grupo.id} className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-background p-3 last:mb-0">
            <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{grupo.nombre}</span><span className="text-xs text-muted-foreground">{plural(grupo.deportistas, "deportista", "deportistas")}</span></span>
            <span className="flex gap-2">
              <Link href={`/secretaria/deportistas?grupo=${grupo.id}`} className={accionFila}><Users className="size-3.5" aria-hidden />Plantel</Link>
              <Link href={`/secretaria/medir?grupo=${grupo.id}`} className={accionFila}><Gauge className="size-3.5" aria-hidden />Medir</Link>
            </span>
          </div>)}
        </div>)}</div>}
      </> : <>
        <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-extrabold">{`Instituciones · ${termino ? `${institucionesVisibles.length} de ${inicial.arbol.length}` : inicial.arbol.length}`}</h2><p className="mt-0.5 text-xs text-muted-foreground">Abrí una institución para ver sus disciplinas y planteles.</p></div>
        {institucionesVisibles.length === 0 ? sinResultados("Todavía no hay instituciones.") : <div className="divide-y divide-border xl:grid xl:grid-cols-2 xl:gap-3 xl:divide-y-0 xl:p-3">{institucionesVisibles.map((institucion) => {
          const planteles = institucion.disciplinas.reduce((total, item) => total + item.grupos.length, 0);
          return <button type="button" key={institucion.id} onClick={() => setInstitucionAbierta(institucion.id)} className="flex min-h-16 w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 active:bg-muted/50 xl:rounded-xl xl:border xl:border-border xl:bg-background xl:px-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Building2 className="size-4" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold leading-snug">{institucion.nombre}</span>
              <span className="block text-xs text-muted-foreground">{[institucion.tipo ? TIPO_INSTITUCION[institucion.tipo] ?? institucion.tipo : null, institucion.localidad, planteles === 0 ? "Sin planteles todavía" : `${plural(institucion.disciplinas.length, "disciplina", "disciplinas")} · ${plural(planteles, "plantel", "planteles")}`].filter(Boolean).join(" · ")}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>;
        })}</div>}
      </>}</section>}

      {vista === "grupos" && <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-extrabold">{`Planteles · ${termino ? `${gruposVisibles.length} de ${grupos.length}` : grupos.length}`}</h2><p className="mt-0.5 text-xs text-muted-foreground">Abrí un plantel para ver sus deportistas, o empezá a medirlo.</p></div>
        {gruposVisibles.length === 0 ? sinResultados("Todavía no hay planteles.") : <div className="divide-y divide-border">{gruposVisibles.map((grupo) => <div key={grupo.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Link href={`/secretaria/deportistas?grupo=${grupo.id}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-3">
            <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{grupo.nombre}</span><span className="block text-xs text-muted-foreground">{`${grupo.institucion} · ${grupo.disciplina} · ${plural(grupo.deportistas, "deportista", "deportistas")}`}</span></span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground sm:hidden" aria-hidden />
          </Link>
          <Link href={`/secretaria/medir?grupo=${grupo.id}`} className={cn(accionFila, "hidden sm:inline-flex")}><Gauge className="size-3.5" aria-hidden />Medir</Link>
        </div>)}</div>}
      </section>}

      {vista === "disciplinas" && <section className="overflow-hidden rounded-2xl border border-border bg-card">{disciplinaDetalle ? <>
        <div className="border-b border-border px-4 py-3">{volver("Todas las disciplinas", () => setDisciplinaAbierta(null))}<h2 className="text-base font-extrabold">{disciplinaDetalle.nombre}</h2><p className="text-xs text-muted-foreground">{`${disciplinaDetalle.instituciones} · ${plural(disciplinaDetalle.grupos, "plantel", "planteles")}`}</p></div>
        <div className="divide-y divide-border">{gruposDeDisciplina.map((grupo) => <Link key={grupo.id} href={`/secretaria/deportistas?grupo=${grupo.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted/30"><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{`${grupo.institucion} · ${grupo.nombre}`}</span><span className="text-xs text-muted-foreground">{plural(grupo.deportistas, "deportista", "deportistas")}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /></Link>)}</div>
      </> : <>
        <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-extrabold">{`Disciplinas · ${termino ? `${disciplinasVisibles.length} de ${disciplinas.length}` : disciplinas.length}`}</h2><p className="mt-0.5 text-xs text-muted-foreground">Abrí una disciplina para ver en qué instituciones y planteles se mide.</p></div>
        {disciplinasVisibles.length === 0 ? sinResultados("Todavía no hay disciplinas con planteles.") : <div className="divide-y divide-border">{disciplinasVisibles.map((disciplina) => <button type="button" key={disciplina.id} onClick={() => setDisciplinaAbierta(disciplina.id)} className="flex min-h-14 w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 active:bg-muted/50"><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{disciplina.nombre}</span><span className="block text-xs text-muted-foreground">{`${disciplina.instituciones} · ${plural(disciplina.grupos, "plantel", "planteles")}`}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /></button>)}</div>}
      </>}</section>}

      {vista === "disciplinas" && !disciplinaDetalle && (inicial.solicitudes?.length ?? 0) > 0 && <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-extrabold">Tus solicitudes al catálogo</h2><p className="mt-0.5 text-xs text-muted-foreground">Las revisa la plataforma. Acá ves en qué quedó cada una.</p></div>
        <ul className="divide-y divide-border">{(inicial.solicitudes ?? []).map((solicitud) => {
          const estado = { pendiente: ["Esperando respuesta", "bg-warning-soft text-warning"], aprobada: ["Aprobada", "bg-secondary text-primary"], rechazada: ["No se incorporó", "bg-muted text-muted-foreground"] }[solicitud.estado];
          return <li key={solicitud.id} className="px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-extrabold">{solicitud.nombre}</p>
                <p className="text-xs text-muted-foreground">{solicitud.tipo === "protocolo" ? `Para ${solicitud.disciplinaObjetivo ?? "una disciplina"}` : "Disciplina nueva"}{` · pedida el ${new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(solicitud.creadoEn))}`}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", estado[1])}>{estado[0]}</span>
            </div>
            {solicitud.resolucion && <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">{solicitud.resolucion}</p>}
          </li>;
        })}</ul>
      </section>}

      {vista === "deportistas" && <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-extrabold">{`Deportistas · ${deportistas ? (termino ? `${deportistasFiltrados.length} de ${deportistas.length}` : deportistas.length) : "…"}`}</h2></div>
        {!deportistas ? <p className="p-6 text-center text-sm text-muted-foreground">Cargando deportistas…</p> : <>
          <div className="divide-y divide-border">{deportistasPagina.map((deportista) => <Link key={deportista.id} href={`/secretaria/deportistas/${deportista.id}`} className="flex min-h-14 items-center gap-3 px-3 py-3 hover:bg-muted/30"><AvatarIniciales nombre={deportista.nombre} apellido={deportista.apellido} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{deportista.apellido?.trim() ? `${deportista.apellido}, ${deportista.nombre}` : deportista.nombre}</span><span className="block truncate text-xs text-muted-foreground">{`${deportista.institucion} · ${deportista.disciplina} · ${deportista.grupo}`}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /></Link>)}{deportistasPagina.length === 0 && sinResultados("Todavía no hay deportistas.")}</div>
          {totalPaginas > 1 && <div className="flex items-center justify-between border-t border-border px-2 py-1"><button type="button" disabled={pagina <= 1} onClick={() => setPagina((actual) => actual - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-bold text-primary disabled:opacity-40"><ChevronLeft className="size-4" aria-hidden />Anterior</button><span className="text-xs font-semibold text-muted-foreground">{`${pagina} de ${totalPaginas}`}</span><button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((actual) => actual + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-bold text-primary disabled:opacity-40">Siguiente<ChevronRight className="size-4" aria-hidden /></button></div>}
        </>}
      </section>}

      {accion && <ModalMovil titulo={{ institucion: "Sumar institución", grupo: "Nuevo plantel", deportista: "Agregar deportista", disciplina: "Pedir al catálogo" }[accion]} onClose={() => setAccion(null)}>
        <div className="space-y-3">
          {accion === "institucion" && <><label className="block min-w-0 text-xs font-bold">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej. Club Atlético Central Norte" /></label><label className="block min-w-0 text-xs font-bold">Tipo<select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}><option value="">Sin especificar</option><option value="club">Club</option><option value="liga">Liga</option><option value="asociacion">Asociación</option><option value="escuela">Escuela</option><option value="grupo">Grupo</option><option value="otro">Otro</option></select></label><label className="block min-w-0 text-xs font-bold">Localidad<input value={localidad} onChange={(e) => setLocalidad(e.target.value)} className={campo} /></label><label className="block min-w-0 text-xs font-bold">Notas <span className="font-normal text-muted-foreground">(opcional)</span><textarea value={notas} onChange={(e) => setNotas(e.target.value)} className={cn(campo, "h-16 py-2.5")} /></label></>}
          {accion === "grupo" && <><label className="block min-w-0 text-xs font-bold">Institución<select value={institucionId} onChange={(e) => setInstitucionId(e.target.value)} className={campo}>{inicial.arbol.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="block min-w-0 text-xs font-bold">Disciplina<select value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)} className={campo}>{inicial.disciplinas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="block min-w-0 text-xs font-bold">Nombre del plantel<input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej. U16, Iniciación o Primera" /></label><p className="text-xs text-muted-foreground">Puede ser una categoría, una etapa o el nombre del plantel.</p></>}
          {accion === "deportista" && <><label className="block min-w-0 text-xs font-bold">Plantel<select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className={campo}>{grupos.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.institucion} · {item.disciplina} · {item.nombre}</option>)}</select></label><div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2"><label className="block min-w-0 text-xs font-bold">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} /></label><label className="block min-w-0 text-xs font-bold">Apellido<input value={apellido} onChange={(e) => setApellido(e.target.value)} className={campo} /></label></div><label className="block min-w-0 text-xs font-bold">Fecha de nacimiento <span className="font-normal text-muted-foreground">(opcional)</span><input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className={campo} /></label></>}
          {accion === "disciplina" && <>
            <div role="radiogroup" aria-label="Qué querés pedir" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {([["nueva", "Una disciplina nueva"], ["falta", "Algo que falta en una disciplina"]] as const).map(([valor, etiqueta]) => (
                <button key={valor} type="button" role="radio" aria-checked={tipoSolicitud === valor} onClick={() => { setTipoSolicitud(valor); setAviso(null); setError(null); }} className={cn("min-h-11 rounded-lg px-2 text-xs font-bold leading-tight", tipoSolicitud === valor ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{etiqueta}</button>
              ))}
            </div>
            <p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">{tipoSolicitud === "nueva" ? "La plataforma revisa el pedido y elige qué protocolos se van a poder medir, para que los datos sean comparables en toda la provincia." : "Contá qué prueba o medición necesitan y la plataforma la suma al catálogo de esa disciplina, si existe un protocolo para eso."}</p>
            {tipoSolicitud === "falta" ? <>
              <label className="block min-w-0 text-xs font-bold">Disciplina<select value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)} className={campo}><option value="">Elegí una disciplina…</option>{inicial.disciplinas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
              <label className="block min-w-0 text-xs font-bold">¿Qué falta medir?<input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} className={campo} placeholder="Ej. Drop Jump, o un test de velocidad de 20 m" /></label>
            </> : <>
              <label className="block min-w-0 text-xs font-bold">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} className={campo} placeholder="Ej. Hockey sobre césped" /></label>
              <label className="block min-w-0 text-xs font-bold">Descripción <span className="font-normal text-muted-foreground">(opcional)</span><textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={cn(campo, "h-16 py-2.5")} /></label>
            </>}<label className="block min-w-0 text-xs font-bold">¿Para qué grupo o evaluación la necesitan? <span className="font-normal text-muted-foreground">(opcional)</span><textarea value={notas} onChange={(e) => setNotas(e.target.value)} className={cn(campo, "h-16 py-2.5")} /></label></>}

          {candidatos.length > 0 && <div className="rounded-2xl border border-warning/40 bg-warning-soft p-3"><p className="text-sm font-extrabold text-warning">Encontramos una ficha parecida</p><p className="mt-1 text-xs text-muted-foreground">Elegí si es la misma persona o un homónimo.</p><div className="mt-3 space-y-2">{candidatos.map((candidato) => <div key={candidato.id} className="rounded-xl bg-card p-3"><p className="text-sm font-bold">{candidato.nombre} {candidato.apellido ?? ""}</p><p className="text-xs text-muted-foreground">{candidato.institucion} · {candidato.grupo}{candidato.fechaNacimiento ? ` · ${candidato.fechaNacimiento}` : ""}</p><button disabled={guardando} onClick={() => enviar(`vincular:${candidato.id}`)} className="mt-1 min-h-11 text-xs font-extrabold text-primary underline">Es la misma persona: usar esta ficha</button></div>)}</div><button disabled={guardando} onClick={() => enviar("crear_igual")} className="mt-2 min-h-11 text-xs font-extrabold underline">Es otra persona: crear una ficha nueva</button></div>}
          {aviso && <p className="rounded-xl bg-secondary p-3 text-sm font-semibold text-primary">{aviso}</p>}
          {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
          {candidatos.length === 0 && <button disabled={guardando || !nombre.trim() || (accion === "grupo" && (!institucionId || !disciplinaId)) || (accion === "deportista" && !grupoId) || (accion === "disciplina" && tipoSolicitud === "falta" && !disciplinaId)} onClick={() => enviar()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-40">{guardando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{guardando ? "Guardando…" : accion === "disciplina" ? "Enviar solicitud" : "Guardar"}</button>}
        </div>
      </ModalMovil>}
    </>
  );
}
