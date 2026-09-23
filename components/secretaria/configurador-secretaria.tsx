"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Building2, ChevronLeft, ChevronRight, Loader2, Plus, Search, Send, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarIniciales } from "@/components/avatar-iniciales";

export interface GrupoArbol {
  id: string;
  nombre: string;
  tipo: string | null;
  activo: boolean;
  deportistas: number;
}
export interface DisciplinaArbol { id: string; nombre: string; grupos: GrupoArbol[] }
export interface InstitucionArbol { id: string; nombre: string; tipo: string | null; localidad: string | null; activo: boolean; disciplinas: DisciplinaArbol[] }
export interface ConfiguracionSecretaria { arbol: InstitucionArbol[]; disciplinas: Array<{ id: string; nombre: string }>; rol: string }
type Accion = "institucion" | "grupo" | "deportista" | "disciplina";
interface Candidato { id: string; nombre: string; apellido: string | null; fechaNacimiento: string | null; grupo: string | null; institucion: string | null; activo: boolean; coincidencia: string }
interface DeportistaLista { id: string; nombre: string; apellido: string | null; grupoId: string; grupo: string; institucion: string; disciplina: string; mediciones: number }

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
        <header className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5"><div><p className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Organizar el espacio</p><h2 className="mt-1 text-lg font-extrabold sm:text-xl">{titulo}</h2></div><button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-muted" aria-label="Cerrar"><X className="size-4" /></button></header>
        <div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:p-5">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

export function ConfiguradorSecretaria({ inicial, recargar, vista }: { inicial: ConfiguracionSecretaria; recargar: () => Promise<void>; vista: "instituciones" | "grupos" | "disciplinas" | "deportistas" }) {
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
  const deportistasFiltrados = useMemo(() => (deportistas ?? []).filter((item) => `${item.nombre} ${item.apellido ?? ""} ${item.institucion} ${item.disciplina} ${item.grupo}`.toLocaleLowerCase("es").includes(busqueda.trim().toLocaleLowerCase("es"))), [deportistas, busqueda]);
  const totalPaginas = Math.max(1, Math.ceil(deportistasFiltrados.length / 10));
  const deportistasPagina = deportistasFiltrados.slice((pagina - 1) * 10, pagina * 10);
  const puedeCrearInstitucion = inicial.rol === "admin_secretaria";
  const puedeConfigurar = inicial.rol === "admin_secretaria" || inicial.rol === "coordinador_secretaria";

  function abrir(nuevaAccion: Accion, contexto?: { institucionId?: string; grupoId?: string }) {
    setAccion(nuevaAccion);
    setInstitucionId(contexto?.institucionId ?? (nuevaAccion === "grupo" ? inicial.arbol[0]?.id ?? "" : ""));
    setGrupoId(contexto?.grupoId ?? (nuevaAccion === "deportista" ? grupos[0]?.id ?? "" : ""));
    setDisciplinaId(nuevaAccion === "grupo" ? inicial.disciplinas[0]?.id ?? "" : "");
    setNombre(""); setApellido(""); setFechaNacimiento(""); setTipo(""); setLocalidad(""); setNotas(""); setDescripcion(""); setError(null); setAviso(null); setCandidatos([]);
  }

  async function enviar(resolucion?: string) {
    if (!accion) return;
    setGuardando(true); setError(null); setAviso(null);
    const cuerpos: Record<Accion, Record<string, unknown>> = {
      institucion: { accion: "crear_institucion", nombre, tipo, localidad, notas },
      grupo: { accion: "crear_grupo", institucionId, disciplinaId, nombre, tipo },
      deportista: { accion: "crear_deportista", grupoId, identidad: { nombre, apellido, fechaNacimiento }, resolucion },
      disciplina: { accion: "solicitar_disciplina", nombre, descripcion, contexto: notas },
    };
    const respuesta = await fetch("/api/secretaria/configuracion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpos[accion]) });
    const cuerpo = await respuesta.json();
    setGuardando(false);
    if (!respuesta.ok) { setError(cuerpo.error ?? "No pudimos guardar los cambios."); return; }
    if (cuerpo.estado === "DEPORTISTA_POSIBLE_DUPLICADO") { setCandidatos(cuerpo.candidatos ?? []); return; }
    if (cuerpo.estado === "INSTITUCION_POSIBLE_DUPLICADO") { setAviso(`Ya existe ${cuerpo.existente?.nombre}. No se creó otra institución.`); return; }
    if (cuerpo.estado === "GRUPO_POSIBLE_DUPLICADO") { setAviso("Ese grupo ya existe para la institución y disciplina seleccionadas."); return; }
    if (cuerpo.estado === "DISCIPLINA_YA_EXISTE") { setAviso("La disciplina ya existe en el catálogo. Podés seleccionarla al crear el grupo."); return; }
    if (cuerpo.estado === "SOLICITUD_YA_PENDIENTE") { setAviso("Esta disciplina ya fue solicitada y está pendiente de revisión."); return; }
    await recargar();
    setAccion(null);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {puedeCrearInstitucion && <button onClick={() => abrir("institucion")} className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-2.5 text-[11px] font-extrabold text-primary-foreground sm:justify-start sm:gap-2 sm:px-4 sm:text-xs"><Building2 className="size-4 shrink-0" />Nueva institución</button>}
        {puedeConfigurar && <button onClick={() => abrir("grupo")} className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-2.5 text-[11px] font-extrabold sm:justify-start sm:gap-2 sm:px-4 sm:text-xs"><Plus className="size-4 shrink-0" />Nuevo grupo</button>}
        {puedeConfigurar && <button onClick={() => abrir("deportista")} className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-2.5 text-[11px] font-extrabold sm:justify-start sm:gap-2 sm:px-4 sm:text-xs"><UserPlus className="size-4 shrink-0" />Agregar deportista</button>}
        {puedeConfigurar && <button onClick={() => abrir("disciplina")} className="inline-flex h-10 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-border bg-card px-2.5 text-[11px] font-extrabold sm:justify-start sm:gap-2 sm:px-4 sm:text-xs"><Send className="size-4 shrink-0" />Solicitar disciplina</button>}
      </div>

      {vista === "instituciones" && <section className="overflow-hidden rounded-2xl border border-border bg-card">{institucionDetalle ? <><div className="border-b border-border px-4 py-3"><button type="button" onClick={() => setInstitucionAbierta(null)} className="mb-2 text-xs font-extrabold text-primary">← Todas las instituciones</button><h2 className="text-base font-extrabold">{institucionDetalle.nombre}</h2><p className="text-xs text-muted-foreground">{institucionDetalle.disciplinas.length} disciplinas · {institucionDetalle.disciplinas.reduce((total, item) => total + item.grupos.length, 0)} grupos</p></div><div className="divide-y divide-border xl:grid xl:grid-cols-2 xl:gap-3 xl:divide-y-0 xl:p-3">{institucionDetalle.disciplinas.map((disciplina) => <div key={disciplina.id} className="p-3 xl:rounded-xl xl:border xl:border-border xl:bg-background"><p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-primary">{disciplina.nombre}</p>{disciplina.grupos.map((grupo) => <div key={grupo.id} className="mb-2 flex items-center gap-3 rounded-xl border border-border bg-background p-3 last:mb-0"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{grupo.nombre}</span><span className="text-xs text-muted-foreground">{grupo.deportistas} deportistas</span></span><Link href={`/secretaria/deportistas?grupo=${grupo.id}`} className="shrink-0 text-xs font-extrabold text-primary">Ver plantel</Link><Link href={`/secretaria/medir?grupo=${grupo.id}`} className="shrink-0 text-xs font-extrabold text-primary">Medir</Link></div>)}</div>)}</div></> : <><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-extrabold">Instituciones <span className="font-medium text-muted-foreground">· {inicial.arbol.length}</span></h2><p className="mt-0.5 text-xs text-muted-foreground">Cada institución reúne sus disciplinas y planteles; abrila para explorar esa estructura.</p></div><div className="divide-y divide-border xl:grid xl:grid-cols-2 xl:gap-3 xl:divide-y-0 xl:p-3">{inicial.arbol.map((institucion) => <button type="button" key={institucion.id} onClick={() => setInstitucionAbierta(institucion.id)} className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 xl:rounded-xl xl:border xl:border-border xl:bg-background xl:px-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Building2 className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{institucion.nombre}</span><span className="block truncate text-xs text-muted-foreground">{institucion.tipo ?? "Institución"}{institucion.localidad ? ` · ${institucion.localidad}` : ""}</span></span><span className="shrink-0 text-right text-xs font-bold text-muted-foreground">{institucion.disciplinas.length} disciplinas<br />{institucion.disciplinas.reduce((total, item) => total + item.grupos.length, 0)} grupos</span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></button>)}</div></>}</section>}

      {vista === "grupos" && <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-extrabold">Grupos y planteles <span className="font-medium text-muted-foreground">· {grupos.length}</span></h2><p className="mt-0.5 text-xs text-muted-foreground">Abrí un plantel para ver sus deportistas.</p></div><div className="divide-y divide-border">{grupos.map((grupo) => <Link key={grupo.id} href={`/secretaria/deportistas?grupo=${grupo.id}`} className="flex min-w-0 items-center gap-3 px-4 py-3 hover:bg-muted/30"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{grupo.nombre}</span><span className="block truncate text-xs text-muted-foreground">{grupo.institucion} · {grupo.disciplina}</span></span><span className="shrink-0 text-xs font-bold text-muted-foreground">{grupo.deportistas} deportistas</span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}</div></section>}

      {vista === "disciplinas" && <section className="overflow-hidden rounded-2xl border border-border bg-card">{disciplinaDetalle ? <><div className="border-b border-border px-4 py-3"><button type="button" onClick={() => setDisciplinaAbierta(null)} className="mb-2 text-xs font-extrabold text-primary">← Todas las disciplinas</button><h2 className="text-base font-extrabold">{disciplinaDetalle.nombre}</h2><p className="text-xs text-muted-foreground">{disciplinaDetalle.instituciones} · {disciplinaDetalle.grupos} grupos</p></div><div className="divide-y divide-border">{gruposDeDisciplina.map((grupo) => <Link key={grupo.id} href={`/secretaria/deportistas?grupo=${grupo.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{grupo.institucion} · {grupo.nombre}</span><span className="text-xs text-muted-foreground">{grupo.deportistas} deportistas</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}</div></> : <><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-extrabold">Disciplinas <span className="font-medium text-muted-foreground">· {disciplinas.length}</span></h2><p className="mt-0.5 text-xs text-muted-foreground">Tocá una disciplina para explorar sus instituciones y grupos.</p></div><div className="divide-y divide-border">{disciplinas.map((disciplina) => <button type="button" key={disciplina.id} onClick={() => setDisciplinaAbierta(disciplina.id)} className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{disciplina.nombre}</span><span className="block truncate text-xs text-muted-foreground">{disciplina.instituciones}</span></span><span className="shrink-0 text-xs text-muted-foreground">{disciplina.grupos} grupos</span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></button>)}</div></>}</section>}

      {vista === "deportistas" && <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="space-y-3 border-b border-border p-3"><label className="flex h-10 items-center gap-2 rounded-xl border border-input bg-background px-3"><Search className="size-4 shrink-0 text-muted-foreground" /><input value={busqueda} onChange={(evento) => { setBusqueda(evento.target.value); setPagina(1); }} placeholder="Buscar nombre o apellido" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><p className="text-xs text-muted-foreground">{deportistasFiltrados.length} deportistas · 10 por página</p></div>{!deportistas ? <p className="p-6 text-center text-sm text-muted-foreground">Cargando deportistas…</p> : <><div className="divide-y divide-border">{deportistasPagina.map((deportista) => <Link key={deportista.id} href={`/secretaria/deportistas/${deportista.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-muted/30"><AvatarIniciales nombre={deportista.nombre} apellido={deportista.apellido} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{deportista.apellido?.trim() ? `${deportista.apellido}, ${deportista.nombre}` : deportista.nombre}</span><span className="block truncate text-xs text-muted-foreground">{deportista.institucion} · {deportista.disciplina} · {deportista.grupo}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}{deportistasPagina.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No encontramos deportistas.</p>}</div><div className="flex items-center justify-between border-t border-border px-3 py-2"><button type="button" disabled={pagina <= 1} onClick={() => setPagina((actual) => actual - 1)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary disabled:opacity-40"><ChevronLeft className="size-4" />Anterior</button><span className="text-xs font-semibold text-muted-foreground">{pagina} / {totalPaginas}</span><button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((actual) => actual + 1)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary disabled:opacity-40">Siguiente<ChevronRight className="size-4" /></button></div></>}</section>}

      {accion && <ModalMovil titulo={{ institucion: "Sumar institución", grupo: "Nuevo grupo o plantel", deportista: "Agregar deportista", disciplina: "Solicitar disciplina" }[accion]} onClose={() => setAccion(null)}>
        <div className="space-y-3">
          {accion === "institucion" && <><label className="block min-w-0 text-xs font-bold">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej. Club Atlético Central Norte" /></label><label className="block min-w-0 text-xs font-bold">Tipo<select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}><option value="">Sin especificar</option><option value="club">Club</option><option value="liga">Liga</option><option value="asociacion">Asociación</option><option value="escuela">Escuela</option><option value="grupo">Grupo</option><option value="otro">Otro</option></select></label><label className="block min-w-0 text-xs font-bold">Localidad<input value={localidad} onChange={(e) => setLocalidad(e.target.value)} className={campo} /></label><label className="block min-w-0 text-xs font-bold">Notas <span className="font-normal text-muted-foreground">(opcional)</span><textarea value={notas} onChange={(e) => setNotas(e.target.value)} className={cn(campo, "h-16 py-2.5")} /></label></>}
          {accion === "grupo" && <><label className="block min-w-0 text-xs font-bold">Institución<select value={institucionId} onChange={(e) => setInstitucionId(e.target.value)} className={campo}>{inicial.arbol.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="block min-w-0 text-xs font-bold">Disciplina<select value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)} className={campo}>{inicial.disciplinas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="block min-w-0 text-xs font-bold">Nombre del grupo<input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej. U16, Iniciación o Primera" /></label><p className="text-[11px] text-muted-foreground">El nombre puede ser una categoría, etapa o plantel.</p></>}
          {accion === "deportista" && <><label className="block min-w-0 text-xs font-bold">Grupo<select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className={campo}>{grupos.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.institucion} · {item.disciplina} · {item.nombre}</option>)}</select></label><div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2"><label className="block min-w-0 text-xs font-bold">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} /></label><label className="block min-w-0 text-xs font-bold">Apellido<input value={apellido} onChange={(e) => setApellido(e.target.value)} className={campo} /></label></div><label className="block min-w-0 text-xs font-bold">Fecha de nacimiento <span className="font-normal text-muted-foreground">(opcional)</span><input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className={campo} /></label></>}
          {accion === "disciplina" && <><p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">La solicitud permite revisar protocolos, métricas y unidades antes de habilitar la disciplina.</p><label className="block min-w-0 text-xs font-bold">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej. Hockey sobre césped" /></label><label className="block min-w-0 text-xs font-bold">Descripción <span className="font-normal text-muted-foreground">(opcional)</span><textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={cn(campo, "h-16 py-2.5")} /></label><label className="block min-w-0 text-xs font-bold">¿Para qué grupo o evaluación la necesitan? <span className="font-normal text-muted-foreground">(opcional)</span><textarea value={notas} onChange={(e) => setNotas(e.target.value)} className={cn(campo, "h-16 py-2.5")} /></label></>}

          {candidatos.length > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-950"><p className="text-sm font-extrabold">Encontramos una ficha parecida</p><p className="mt-1 text-xs">Elegí si es la misma persona o un homónimo.</p><div className="mt-3 space-y-2">{candidatos.map((candidato) => <div key={candidato.id} className="rounded-xl bg-white/70 p-3"><p className="text-sm font-bold">{candidato.nombre} {candidato.apellido ?? ""}</p><p className="text-xs opacity-75">{candidato.institucion} · {candidato.grupo}{candidato.fechaNacimiento ? ` · ${candidato.fechaNacimiento}` : ""}</p><button disabled={guardando} onClick={() => enviar(`vincular:${candidato.id}`)} className="mt-2 text-xs font-extrabold underline">Es la misma persona: usar esta ficha</button></div>)}</div><button disabled={guardando} onClick={() => enviar("crear_igual")} className="mt-3 text-xs font-extrabold underline">Es otra persona: crear una ficha nueva</button></div>}
          {aviso && <p className="rounded-xl bg-secondary p-3 text-sm font-semibold text-primary">{aviso}</p>}
          {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
          {candidatos.length === 0 && <button disabled={guardando || !nombre.trim() || (accion === "grupo" && (!institucionId || !disciplinaId)) || (accion === "deportista" && !grupoId)} onClick={() => enviar()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-40">{guardando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{guardando ? "Guardando…" : accion === "disciplina" ? "Enviar solicitud" : "Guardar"}</button>}
        </div>
      </ModalMovil>}
    </>
  );
}
