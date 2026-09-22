"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Check, CheckCircle2, ClipboardPlus, Loader2, RotateCcw, Settings2 } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { hoyLocalISO } from "@/lib/use-datos";
import { cn } from "@/lib/utils";
import { usePerfil } from "@/components/perfil-context";

interface GrupoCatalogo {
  id: string;
  nombre: string;
  institucion: { id: string; nombre: string } | Array<{ id: string; nombre: string }> | null;
  disciplina: { id: string; nombre: string } | Array<{ id: string; nombre: string }> | null;
}
interface DeportistaCatalogo { id: string; nombre: string; apellido: string | null; categoria_id: string }
interface MetricaCatalogo { requerido: boolean; unidad: string; minimo: number | null; maximo: number | null; atributo: { id: string; codigo: string; nombre: string } | Array<{ id: string; codigo: string; nombre: string }> }
interface ProtocoloCatalogo { id: string; codigo: string; nombre: string; descripcion: string | null; protocolo_atributo: MetricaCatalogo[] }
interface EnlaceCatalogo { disciplina_id: string; orden: number; protocolo: ProtocoloCatalogo | ProtocoloCatalogo[] }
interface CatalogoMedicion { grupos: GrupoCatalogo[]; deportistas: DeportistaCatalogo[]; protocolos: EnlaceCatalogo[]; responsable: string }

const CATALOGO_VACIO: CatalogoMedicion = { responsable: "", grupos: [], deportistas: [], protocolos: [] };

function uno<T>(valor: T | T[] | null): T | null { return Array.isArray(valor) ? (valor[0] ?? null) : valor; }
function numero(valor: string) { const resultado = Number(valor.trim().replace(",", ".")); return Number.isFinite(resultado) ? resultado : null; }

export default function MedirSecretaria() {
  const { sesionReal } = usePerfil();
  const [catalogo, setCatalogo] = useState<CatalogoMedicion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [institucionId, setInstitucionId] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [protocoloCodigo, setProtocoloCodigo] = useState("");
  const [metricaCodigo, setMetricaCodigo] = useState("");
  const [fecha, setFecha] = useState(hoyLocalISO());
  const [evaluadoPor, setEvaluadoPor] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ jornadaId: string; deportistas: number; medicionesGuardadas: number } | null>(null);

  const seleccionarGrupo = useCallback((item: GrupoCatalogo, fuente: CatalogoMedicion) => {
    const institucionElegida = uno(item.institucion);
    const disciplinaElegida = uno(item.disciplina);
    if (!institucionElegida || !disciplinaElegida) return;
    const primerProtocolo = fuente.protocolos
      .filter((enlace) => enlace.disciplina_id === disciplinaElegida.id)
      .sort((a, b) => a.orden - b.orden)
      .map((enlace) => uno(enlace.protocolo))
      .find((protocolo): protocolo is ProtocoloCatalogo => Boolean(protocolo));
    const primeraMetrica = primerProtocolo?.protocolo_atributo
      .map((metrica) => ({ ...metrica, atributo: uno(metrica.atributo) }))
      .find((metrica) => metrica.requerido && metrica.atributo)
      ?? primerProtocolo?.protocolo_atributo
        .map((metrica) => ({ ...metrica, atributo: uno(metrica.atributo) }))
        .find((metrica) => metrica.atributo);
    setInstitucionId(institucionElegida.id);
    setDisciplinaId(disciplinaElegida.id);
    setGrupoId(item.id);
    setProtocoloCodigo(primerProtocolo?.codigo ?? "");
    setMetricaCodigo(primeraMetrica?.atributo?.codigo ?? "");
    setValores({});
  }, []);

  useEffect(() => {
    if (!sesionReal) return;
    const controlador = new AbortController();
    fetch("/api/secretaria/medir", { signal: controlador.signal })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos preparar la jornada.");
        return cuerpo as CatalogoMedicion;
      })
      .then((datos) => {
        setCatalogo(datos);
        setEvaluadoPor(datos.responsable);
        const grupoSolicitado = new URLSearchParams(window.location.search).get("grupo");
        const preseleccion = datos.grupos.find((item) => item.id === grupoSolicitado);
        if (preseleccion) seleccionarGrupo(preseleccion, datos);
      })
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === "AbortError") return;
        setError(causa instanceof Error ? causa.message : "No pudimos preparar la jornada.");
      });
    return () => controlador.abort();
  }, [sesionReal, seleccionarGrupo]);

  const catalogoActivo = catalogo ?? CATALOGO_VACIO;

  const instituciones = [...new Map(catalogoActivo.grupos.flatMap((item) => {
    const institucion = uno(item.institucion);
    return institucion ? [[institucion.id, institucion] as const] : [];
  })).values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const disciplinasInstitucion = [...new Map(catalogoActivo.grupos.flatMap((item) => {
    const institucion = uno(item.institucion);
    const disciplina = uno(item.disciplina);
    return institucion?.id === institucionId && disciplina ? [[disciplina.id, disciplina] as const] : [];
  })).values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const gruposDisponibles = catalogoActivo.grupos.filter((item) => uno(item.institucion)?.id === institucionId && uno(item.disciplina)?.id === disciplinaId);

  const enlaces = catalogoActivo.protocolos.filter((enlace) => enlace.disciplina_id === disciplinaId);
  const protocolos = enlaces.map((enlace) => uno(enlace.protocolo)).filter((item): item is ProtocoloCatalogo => Boolean(item));
  const protocolo = protocolos.find((item) => item.codigo === protocoloCodigo) ?? null;
  const metricas = protocolo?.protocolo_atributo.map((item) => ({ ...item, atributo: uno(item.atributo)! })).filter((item) => item.atributo) ?? [];
  const metrica = metricas.find((item) => item.atributo.codigo === metricaCodigo) ?? null;
  const grupo = catalogoActivo.grupos.find((item) => item.id === grupoId) ?? null;
  const plantel = catalogoActivo.deportistas.filter((item) => item.categoria_id === grupoId);
  const cargados = plantel.filter((item) => valores[item.id]?.trim() && numero(valores[item.id]) !== null).length;

  async function guardar() {
    if (!grupo || !protocolo || !metrica || cargados === 0 || !fecha || !evaluadoPor.trim()) return;
    setGuardando(true);
    setError(null);
    const respuesta = await fetch("/api/secretaria/medir", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        contexto: {
          institucionOrigen: uno(grupo.institucion)?.nombre,
          disciplina: uno(grupo.disciplina)?.nombre,
          grupo: grupo.nombre,
          fecha,
          evaluadoPor: evaluadoPor.trim(),
          protocolo: protocolo.codigo,
        },
        mediciones: plantel.flatMap((deportista) => {
          const valor = numero(valores[deportista.id] ?? "");
          return valor === null ? [] : [{ deportistaId: deportista.id, atributoCodigo: metrica.atributo.codigo, intento: 1, valor }];
        }),
      }),
    });
    const cuerpo = await respuesta.json();
    setGuardando(false);
    if (!respuesta.ok) { setError(cuerpo.error ?? "No pudimos guardar la jornada."); return; }
    setResultado(cuerpo);
  }

  function reiniciar() {
    setProtocoloCodigo(""); setMetricaCodigo(""); setValores({}); setResultado(null); setError(null);
  }

  if (sesionReal && !catalogo && !error) return <CargandoPelota texto="Preparando una nueva medición…" />;
  if (sesionReal && !catalogo && error) return <AvisoAcceso titulo="No pudimos preparar la jornada" detalle={error} accionHref="/secretaria/medir" accionLabel="Reintentar" />;

  if (resultado) return <GuardiaSecretaria><div className="flex flex-col items-center gap-4 py-16 text-center"><CheckCircle2 className="size-14 text-success" /><div><h1 className="text-xl font-extrabold">Jornada registrada</h1><p className="mt-1 text-sm text-muted-foreground">{resultado.medicionesGuardadas} mediciones de {resultado.deportistas} deportistas quedaron guardadas.</p></div><div className="flex gap-2"><button onClick={reiniciar} className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-bold"><RotateCcw className="size-4" />Cargar otra métrica</button><Link href="/secretaria/jornadas" className="flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Ver planillas</Link></div></div></GuardiaSecretaria>;

  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-5">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Nueva jornada</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">Medir</h1><p className="mt-1 text-sm text-muted-foreground">Elegí dónde van a medir, la disciplina y el plantel. Después cargá la evaluación de corrido.</p></div>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-sm font-extrabold">1 · ¿Dónde van a medir?</h2><Link href="/secretaria/grupos" className="inline-flex items-center gap-1 text-xs font-extrabold text-primary"><Settings2 className="size-3.5" />Organizar</Link></div>
          <div className="grid gap-2 sm:grid-cols-2">{instituciones.map((institucion) => <button key={institucion.id} onClick={() => { setInstitucionId(institucion.id); setDisciplinaId(""); setGrupoId(""); setProtocoloCodigo(""); setMetricaCodigo(""); setValores({}); }} className={cn("flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors", institucionId === institucion.id ? "border-primary bg-secondary" : "border-border bg-card hover:border-primary/35")}><span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", institucionId === institucion.id ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}><Building2 className="size-4" /></span><span className="text-sm font-extrabold">{institucion.nombre}</span></button>)}</div>
        </section>

        {institucionId && <section><h2 className="mb-2 text-sm font-extrabold">2 · ¿Qué disciplina van a medir?</h2><div className="flex flex-wrap gap-2">{disciplinasInstitucion.map((disciplina) => <button key={disciplina.id} onClick={() => { setDisciplinaId(disciplina.id); setGrupoId(""); setProtocoloCodigo(""); setMetricaCodigo(""); setValores({}); }} className={cn("rounded-full border px-4 py-2 text-sm font-bold", disciplinaId === disciplina.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{disciplina.nombre}</button>)}</div></section>}

        {disciplinaId && <section><h2 className="mb-2 text-sm font-extrabold">3 · ¿Qué grupo o plantel?</h2><div className="grid gap-2 sm:grid-cols-2">{gruposDisponibles.map((item) => { const cantidad = catalogoActivo.deportistas.filter((deportista) => deportista.categoria_id === item.id).length; return <button key={item.id} onClick={() => seleccionarGrupo(item, catalogoActivo)} className={cn("rounded-2xl border p-4 text-left transition-colors", grupoId === item.id ? "border-primary bg-secondary" : "border-border bg-card hover:border-primary/35")}><span className="text-sm font-extrabold">{item.nombre}</span><span className="mt-1 block text-xs text-muted-foreground">{cantidad} deportistas</span></button>; })}</div></section>}

        {grupoId && <section className="space-y-3"><h2 className="text-sm font-extrabold">4 · ¿Qué van a medir?</h2><div className="flex flex-wrap gap-2">{protocolos.map((item) => <button key={item.codigo} onClick={() => { const primera = item.protocolo_atributo.map((x) => ({ ...x, atributo: uno(x.atributo) })).find((x) => x.requerido && x.atributo) ?? item.protocolo_atributo.map((x) => ({ ...x, atributo: uno(x.atributo) })).find((x) => x.atributo); setProtocoloCodigo(item.codigo); setMetricaCodigo(primera?.atributo?.codigo ?? ""); setValores({}); }} className={cn("rounded-full border px-4 py-2 text-sm font-bold", protocoloCodigo === item.codigo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{item.nombre}</button>)}</div>{protocolo && <div className="grid grid-cols-2 gap-2">{metricas.map((item) => <button key={item.atributo.codigo} onClick={() => { setMetricaCodigo(item.atributo.codigo); setValores({}); }} className={cn("flex items-center justify-between rounded-xl border p-3 text-left", metricaCodigo === item.atributo.codigo ? "border-primary bg-secondary" : "border-border bg-card")}><span><span className="block text-sm font-bold">{item.atributo.nombre}</span><span className="text-xs text-muted-foreground">{item.unidad}</span></span>{metricaCodigo === item.atributo.codigo && <Check className="size-4 text-primary" />}</button>)}</div>}</section>}

        {metrica && <section className="flex flex-col gap-3"><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold">Fecha<input type="date" value={fecha} onChange={(evento) => setFecha(evento.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm" /></label><label className="text-xs font-bold">Evaluó<input value={evaluadoPor} onChange={(evento) => setEvaluadoPor(evento.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm" /></label></div><div className="flex items-baseline justify-between"><h2 className="text-sm font-extrabold">5 · Cargar {metrica.atributo.nombre} <span className="text-muted-foreground">({metrica.unidad})</span></h2><span className="text-xs font-extrabold text-primary">{cargados}/{plantel.length}</span></div><div className="space-y-2">{plantel.map((deportista) => <label key={deportista.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"><span className="min-w-0 flex-1 text-sm font-bold">{deportista.apellido?.trim() ? `${deportista.apellido}, ${deportista.nombre}` : deportista.nombre}</span><input inputMode="decimal" placeholder={metrica.unidad} value={valores[deportista.id] ?? ""} onChange={(evento) => setValores((actuales) => ({ ...actuales, [deportista.id]: evento.target.value }))} className="h-10 w-24 rounded-xl border border-input bg-background px-3 text-right text-sm font-bold tabular-nums outline-none focus:border-primary" /></label>)}</div>{error && <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}<button disabled={guardando || cargados === 0 || !fecha || !evaluadoPor.trim()} onClick={guardar} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground disabled:opacity-40">{guardando ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPlus className="size-4" />}{guardando ? "Guardando…" : `Guardar ${cargados} mediciones`}</button></section>}
      </div>
    </GuardiaSecretaria>
  );
}
