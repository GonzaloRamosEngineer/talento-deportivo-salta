"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown, ClipboardPlus, Loader2, Plus, Send, UserPlus, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

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

const campo = "mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary";

export function ConfiguradorSecretaria({ inicial, recargar }: { inicial: ConfiguracionSecretaria; recargar: () => Promise<void> }) {
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

  const grupos = useMemo(() => inicial.arbol.flatMap((institucion) => institucion.disciplinas.flatMap((disciplina) => disciplina.grupos.map((grupo) => ({ ...grupo, institucionId: institucion.id, institucion: institucion.nombre, disciplina: disciplina.nombre })))), [inicial.arbol]);
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
      <div className="flex flex-wrap gap-2">
        {puedeCrearInstitucion && <button onClick={() => abrir("institucion")} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-extrabold text-primary-foreground"><Building2 className="size-4" />Nueva institución</button>}
        {puedeConfigurar && <button onClick={() => abrir("grupo")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-extrabold"><Plus className="size-4" />Nuevo grupo</button>}
        {puedeConfigurar && <button onClick={() => abrir("deportista")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-extrabold"><UserPlus className="size-4" />Agregar deportista</button>}
        {puedeConfigurar && <button onClick={() => abrir("disciplina")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-extrabold"><Send className="size-4" />Solicitar disciplina</button>}
      </div>

      <div className="space-y-3">
        {inicial.arbol.map((institucion) => (
          <details key={institucion.id} open className="group rounded-2xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Building2 className="size-4" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{institucion.nombre}</span><span className="block text-xs text-muted-foreground">{institucion.tipo ?? "institución"}{institucion.localidad ? ` · ${institucion.localidad}` : ""}</span></span>
              <span className="text-xs font-bold text-muted-foreground">{institucion.disciplinas.reduce((total, disciplina) => total + disciplina.grupos.length, 0)} grupos</span><ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border p-4 pt-3">
              {institucion.disciplinas.map((disciplina) => <div key={disciplina.id} className="mb-4 last:mb-0"><p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-primary">{disciplina.nombre}</p><div className="grid gap-2 sm:grid-cols-2">{disciplina.grupos.map((grupo) => <div key={grupo.id} className="rounded-xl border border-border bg-background p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-extrabold">{grupo.nombre}</p><span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><Users className="size-3.5" />{grupo.deportistas}</span></div><div className="mt-3 flex gap-3 border-t border-border pt-2"><Link href={`/secretaria/deportistas?grupo=${grupo.id}`} className="text-[11px] font-extrabold text-primary">Ver plantel</Link>{puedeConfigurar && <button onClick={() => abrir("deportista", { grupoId: grupo.id })} className="text-[11px] font-extrabold text-primary">Agregar deportista</button>}<Link href={`/secretaria/medir?grupo=${grupo.id}`} className="ml-auto inline-flex items-center gap-1 text-[11px] font-extrabold text-primary"><ClipboardPlus className="size-3" />Medir</Link></div></div>)}</div></div>)}
              {puedeConfigurar && <button onClick={() => abrir("grupo", { institucionId: institucion.id })} className="mt-1 inline-flex items-center gap-1.5 text-xs font-extrabold text-primary"><Plus className="size-3.5" />Agregar grupo</button>}
            </div>
          </details>
        ))}
      </div>

      {accion && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-5" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) setAccion(null); }}><div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:max-w-lg sm:rounded-3xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Organizar el espacio</p><h2 className="mt-1 text-xl font-extrabold">{{ institucion: "Nueva institución", grupo: "Nuevo grupo", deportista: "Agregar deportista", disciplina: "Solicitar disciplina" }[accion]}</h2></div><button onClick={() => setAccion(null)} className="grid size-9 place-items-center rounded-full bg-muted"><X className="size-4" /></button></div>
        <div className="mt-5 space-y-4">
          {accion === "institucion" && <><label className="block text-xs font-bold">Nombre<input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej. Club Atlético Central Norte" /></label><label className="block text-xs font-bold">Tipo<select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}><option value="">Sin especificar</option><option value="club">Club</option><option value="liga">Liga</option><option value="asociacion">Asociación</option><option value="escuela">Escuela</option><option value="grupo">Grupo</option><option value="otro">Otro</option></select></label><label className="block text-xs font-bold">Localidad<input value={localidad} onChange={(e) => setLocalidad(e.target.value)} className={campo} /></label><label className="block text-xs font-bold">Notas<textarea value={notas} onChange={(e) => setNotas(e.target.value)} className={cn(campo, "h-20 py-3")} /></label></>}
          {accion === "grupo" && <><label className="block text-xs font-bold">Institución<select value={institucionId} onChange={(e) => setInstitucionId(e.target.value)} className={campo}>{inicial.arbol.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="block text-xs font-bold">Disciplina<select value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)} className={campo}>{inicial.disciplinas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="block text-xs font-bold">Nombre del grupo<input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej. U16, Iniciación o Primera" /></label><p className="text-xs text-muted-foreground">El nombre puede representar una categoría, etapa o plantel libre.</p></>}
          {accion === "deportista" && <><label className="block text-xs font-bold">Grupo<select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className={campo}>{grupos.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.institucion} · {item.disciplina} · {item.nombre}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="block text-xs font-bold">Nombre<input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} /></label><label className="block text-xs font-bold">Apellido<input value={apellido} onChange={(e) => setApellido(e.target.value)} className={campo} /></label></div><label className="block text-xs font-bold">Fecha de nacimiento <span className="font-normal text-muted-foreground">(si se conoce)</span><input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className={campo} /></label></>}
          {accion === "disciplina" && <><div className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">Primero revisamos si ya existe. Si es nueva, la solicitud permite definir correctamente protocolos, métricas y unidades antes de medir.</div><label className="block text-xs font-bold">Nombre<input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej. Hockey sobre césped" /></label><label className="block text-xs font-bold">Descripción<textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={cn(campo, "h-20 py-3")} /></label><label className="block text-xs font-bold">¿Para qué grupo o evaluación la necesitan?<textarea value={notas} onChange={(e) => setNotas(e.target.value)} className={cn(campo, "h-20 py-3")} /></label></>}

          {candidatos.length > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-950"><p className="text-sm font-extrabold">Encontramos una ficha parecida</p><p className="mt-1 text-xs">Elegí si es la misma persona o un homónimo.</p><div className="mt-3 space-y-2">{candidatos.map((candidato) => <div key={candidato.id} className="rounded-xl bg-white/70 p-3"><p className="text-sm font-bold">{candidato.nombre} {candidato.apellido ?? ""}</p><p className="text-xs opacity-75">{candidato.institucion} · {candidato.grupo}{candidato.fechaNacimiento ? ` · ${candidato.fechaNacimiento}` : ""}</p><button disabled={guardando} onClick={() => enviar(`vincular:${candidato.id}`)} className="mt-2 text-xs font-extrabold underline">Es la misma persona: usar esta ficha</button></div>)}</div><button disabled={guardando} onClick={() => enviar("crear_igual")} className="mt-3 text-xs font-extrabold underline">Es otra persona: crear una ficha nueva</button></div>}
          {aviso && <p className="rounded-xl bg-secondary p-3 text-sm font-semibold text-primary">{aviso}</p>}
          {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
          {candidatos.length === 0 && <button disabled={guardando || !nombre.trim() || (accion === "grupo" && (!institucionId || !disciplinaId)) || (accion === "deportista" && !grupoId)} onClick={() => enviar()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-40">{guardando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{guardando ? "Guardando…" : accion === "disciplina" ? "Enviar solicitud" : "Guardar"}</button>}
        </div></div></div>}
    </>
  );
}
