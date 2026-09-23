"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Plus, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModoAltaRapida = "institucion" | "grupo" | "deportista" | "disciplina";
interface Item { id: string; nombre: string }
interface GrupoItem extends Item { institucion: string; disciplina: string }
interface Candidato { id: string; nombre: string; apellido: string | null; fechaNacimiento: string | null; grupo: string | null; institucion: string | null }

const campo = "mt-1 block h-11 min-w-0 w-full max-w-full box-border rounded-xl border border-input bg-background px-3 text-base outline-none focus:border-primary";

export function AltaRapidaMedicion({ modoInicial, instituciones, disciplinas, disciplinasInstitucion, grupos, institucionInicial, disciplinaInicial, grupoInicial, onClose, onCreado, onDisciplinaSeleccionada }: {
  modoInicial: ModoAltaRapida;
  instituciones: Item[];
  disciplinas: Item[];
  disciplinasInstitucion: string[];
  grupos: GrupoItem[];
  institucionInicial?: string;
  disciplinaInicial?: string;
  grupoInicial?: string;
  onClose: () => void;
  onCreado: (resultado: { tipo: "institucion" | "grupo" | "deportista"; id: string }) => Promise<void>;
  onDisciplinaSeleccionada: (id: string) => void;
}) {
  const [modo, setModo] = useState(modoInicial);
  const [institucionId, setInstitucionId] = useState(institucionInicial ?? instituciones[0]?.id ?? "");
  const [disciplinaId, setDisciplinaId] = useState(disciplinaInicial ?? disciplinas[0]?.id ?? "");
  const [grupoId, setGrupoId] = useState(grupoInicial ?? grupos[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [tipo, setTipo] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [viewport, setViewport] = useState(() => typeof window === "undefined"
    ? { alto: 0, arriba: 0 }
    : { alto: window.visualViewport?.height ?? window.innerHeight, arriba: window.visualViewport?.offsetTop ?? 0 });
  const [solicitandoDisciplina, setSolicitandoDisciplina] = useState(false);

  useEffect(() => {
    const actualizar = () => {
      const visual = window.visualViewport;
      setViewport({ alto: visual?.height ?? window.innerHeight, arriba: visual?.offsetTop ?? 0 });
    };
    actualizar();
    window.visualViewport?.addEventListener("resize", actualizar);
    window.visualViewport?.addEventListener("scroll", actualizar);
    window.addEventListener("resize", actualizar);
    return () => {
      window.visualViewport?.removeEventListener("resize", actualizar);
      window.visualViewport?.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
    };
  }, []);

  async function enviar(resolucion?: string) {
    setGuardando(true); setError(null); setAviso(null);
    const cuerpos: Record<ModoAltaRapida, Record<string, unknown>> = {
      institucion: { accion: "crear_institucion", nombre, tipo, localidad, notas: null },
      grupo: { accion: "crear_grupo", institucionId, disciplinaId, nombre, tipo: null },
      deportista: { accion: "crear_deportista", grupoId, identidad: { nombre, apellido, fechaNacimiento }, resolucion },
      disciplina: { accion: "solicitar_disciplina", nombre, descripcion, contexto: "Solicitada durante la preparación de una jornada" },
    };
    const respuesta = await fetch("/api/secretaria/configuracion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpos[modo]) });
    const cuerpo = await respuesta.json();
    setGuardando(false);
    if (!respuesta.ok) { setError(cuerpo.error ?? "No pudimos guardar los cambios."); return; }
    if (cuerpo.estado === "DEPORTISTA_POSIBLE_DUPLICADO") { setCandidatos(cuerpo.candidatos ?? []); return; }
    if (cuerpo.estado === "INSTITUCION_POSIBLE_DUPLICADO") { setAviso(`Ya existe ${cuerpo.existente?.nombre}. Cerrá esta ventana y seleccionala.`); return; }
    if (cuerpo.estado === "GRUPO_POSIBLE_DUPLICADO") { setAviso("Ese plantel ya existe. Cerrá esta ventana y seleccionalo."); return; }
    if (cuerpo.estado === "DISCIPLINA_YA_EXISTE") { setAviso("La disciplina ya existe en el catálogo. Elegila para este espacio y luego agregá el plantel."); return; }
    if (cuerpo.estado === "SOLICITUD_YA_PENDIENTE") { setAviso("La disciplina ya está solicitada y pendiente de revisión."); return; }
    if (cuerpo.estado === "SOLICITADA") { setAviso("Solicitud enviada. Cuando se aprueben sus protocolos y métricas aparecerá para medir."); return; }
    try {
      await onCreado({ tipo: modo as "institucion" | "grupo" | "deportista", id: cuerpo.id });
      onClose();
    } catch {
      setError("Se guardó el cambio, pero no pudimos actualizar la pantalla. Cerrá y volvé a abrir la jornada.");
    }
  }

  const titulo = modo === "institucion" ? "Sumar institución" : modo === "grupo" ? "Nuevo grupo o plantel" : modo === "deportista" ? "Agregar deportista" : solicitandoDisciplina ? "Solicitar disciplina" : "Agregar disciplina";
  if (typeof document === "undefined") return null;
  const contenido = (
    <div className="fixed left-0 right-0 z-[100] flex items-end justify-center overflow-hidden bg-black/40 sm:inset-0 sm:items-center sm:p-5" style={{ top: viewport.arriba, height: viewport.alto || "100dvh" }} onMouseDown={(evento) => { if (evento.target === evento.currentTarget) onClose(); }}>
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-card shadow-xl sm:rounded-3xl">
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5"><div><p className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Sin salir de la jornada</p><h2 className="mt-1 text-xl font-extrabold">{titulo}</h2></div><button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-muted"><X className="size-4" /></button></div>
        <div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:p-5">
          <div className="space-y-3">
          {modo === "institucion" && <><label className="block min-w-0 text-xs font-bold">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej. Club, escuela o asociación" /></label><label className="block min-w-0 text-xs font-bold">Tipo<select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}><option value="">Sin especificar</option><option value="club">Club</option><option value="liga">Liga</option><option value="asociacion">Asociación</option><option value="escuela">Escuela</option><option value="grupo">Grupo</option><option value="otro">Otro</option></select></label><label className="block min-w-0 text-xs font-bold">Localidad<input value={localidad} onChange={(e) => setLocalidad(e.target.value)} className={campo} /></label></>}
          {modo === "grupo" && <><label className="block min-w-0 text-xs font-bold">Institución<select value={institucionId} onChange={(e) => setInstitucionId(e.target.value)} className={campo}>{instituciones.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="block min-w-0 text-xs font-bold">Disciplina<select value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)} className={campo}>{disciplinas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><button onClick={() => { setModo("disciplina"); setNombre(""); setAviso(null); }} className="text-xs font-extrabold text-primary underline">¿No está la disciplina? Agregarla</button><label className="block min-w-0 text-xs font-bold">Grupo o plantel<input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} placeholder="Ej. U16, Primera o Iniciación" /></label></>}
          {modo === "deportista" && <><label className="block min-w-0 text-xs font-bold">Plantel<select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} className={campo}>{grupos.map((item) => <option key={item.id} value={item.id}>{item.institucion} · {item.disciplina} · {item.nombre}</option>)}</select></label><div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2"><label className="block min-w-0 text-xs font-bold">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} /></label><label className="block min-w-0 text-xs font-bold">Apellido<input value={apellido} onChange={(e) => setApellido(e.target.value)} className={campo} /></label></div><label className="block min-w-0 text-xs font-bold">Fecha de nacimiento <span className="font-normal text-muted-foreground">(opcional)</span><input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} className={campo} /></label></>}
          {modo === "disciplina" && <>{!solicitandoDisciplina ? <><p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">Elegí una disciplina del catálogo para este espacio. Luego vas a poder crear el grupo o plantel.</p><div className="grid gap-2">{disciplinas.filter((item) => !disciplinasInstitucion.includes(item.id)).map((item) => <button key={item.id} type="button" onClick={() => { onDisciplinaSeleccionada(item.id); onClose(); }} className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-bold hover:border-primary">{item.nombre}</button>)}</div><button type="button" onClick={() => { setSolicitandoDisciplina(true); setAviso(null); }} className="text-left text-xs font-extrabold text-primary underline">¿No aparece? Solicitar una disciplina nueva</button></> : <><p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">La revisaremos para definir protocolos, métricas y unidades antes de habilitarla.</p><label className="block min-w-0 text-xs font-bold">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} className={campo} /></label><label className="block min-w-0 text-xs font-bold">Descripción<textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={cn(campo, "h-20 py-3")} /></label></>}</>}
          {candidatos.length > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-amber-950"><p className="text-sm font-extrabold">Encontramos una ficha parecida</p>{candidatos.map((candidato) => <div key={candidato.id} className="mt-2 rounded-xl bg-white/70 p-3"><p className="text-sm font-bold">{candidato.nombre} {candidato.apellido ?? ""}</p><p className="text-xs opacity-75">{candidato.institucion} · {candidato.grupo}</p><button disabled={guardando} onClick={() => enviar(`vincular:${candidato.id}`)} className="mt-2 text-xs font-extrabold underline">Es la misma persona: usar esta ficha</button></div>)}<button disabled={guardando} onClick={() => enviar("crear_igual")} className="mt-3 text-xs font-extrabold underline">Es otra persona: crear ficha nueva</button></div>}
          {aviso && <p className="rounded-xl bg-secondary p-3 text-sm font-semibold text-primary">{aviso}</p>}
          {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
          {candidatos.length === 0 && !aviso && (modo !== "disciplina" || solicitandoDisciplina) && <button disabled={guardando || !nombre.trim() || (modo === "grupo" && (!institucionId || !disciplinaId)) || (modo === "deportista" && !grupoId)} onClick={() => enviar()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-40">{guardando ? <Loader2 className="size-4 animate-spin" /> : modo === "disciplina" ? <Send className="size-4" /> : <Plus className="size-4" />}{guardando ? "Guardando…" : modo === "disciplina" ? "Enviar solicitud" : "Guardar"}</button>}
          </div>
        </div>
      </div>
    </div>
  );
  return createPortal(contenido, document.body);
}
