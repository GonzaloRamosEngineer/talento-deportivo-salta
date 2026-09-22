"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, ClipboardPlus, Loader2, RotateCcw } from "lucide-react";
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
interface DeportistaCatalogo { id: string; nombre: string; apellido: string; categoria_id: string }
interface MetricaCatalogo { requerido: boolean; unidad: string; minimo: number | null; maximo: number | null; atributo: { id: string; codigo: string; nombre: string } | Array<{ id: string; codigo: string; nombre: string }> }
interface ProtocoloCatalogo { id: string; codigo: string; nombre: string; descripcion: string | null; protocolo_atributo: MetricaCatalogo[] }
interface EnlaceCatalogo { disciplina_id: string; orden: number; protocolo: ProtocoloCatalogo | ProtocoloCatalogo[] }
interface CatalogoMedicion { grupos: GrupoCatalogo[]; deportistas: DeportistaCatalogo[]; protocolos: EnlaceCatalogo[]; responsable: string }

const DEMO_CATALOGO: CatalogoMedicion = {
  responsable: "Equipo de Evaluación",
  grupos: [{ id: "demo-sub13", nombre: "SUB13", institucion: { id: "demo-liga", nombre: "Liga Salteña de Fútbol" }, disciplina: { id: "demo-futbol", nombre: "Fútbol" } }],
  deportistas: [
    { id: "demo-1", nombre: "Martina", apellido: "Arias", categoria_id: "demo-sub13" },
    { id: "demo-2", nombre: "Lautaro", apellido: "Burgos", categoria_id: "demo-sub13" },
    { id: "demo-3", nombre: "Sofía", apellido: "Méndez", categoria_id: "demo-sub13" },
  ],
  protocolos: [{ disciplina_id: "demo-futbol", orden: 1, protocolo: { id: "demo-cmj", codigo: "CMJ", nombre: "CMJ", descripcion: "Salto con contramovimiento", protocolo_atributo: [
    { requerido: true, unidad: "cm", minimo: 0, maximo: 100, atributo: { id: "demo-altura", codigo: "altura_salto", nombre: "Altura de salto" } },
    { requerido: false, unidad: "W/kg", minimo: 0, maximo: 200, atributo: { id: "demo-potencia", codigo: "potencia_relativa", nombre: "Potencia relativa" } },
  ] } }],
};

function uno<T>(valor: T | T[] | null): T | null { return Array.isArray(valor) ? (valor[0] ?? null) : valor; }
function numero(valor: string) { const resultado = Number(valor.trim().replace(",", ".")); return Number.isFinite(resultado) ? resultado : null; }

export default function MedirSecretaria() {
  const { sesionReal } = usePerfil();
  const [catalogo, setCatalogo] = useState<CatalogoMedicion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [institucion, setInstitucion] = useState("");
  const [disciplinaId, setDisciplinaId] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [protocoloCodigo, setProtocoloCodigo] = useState("");
  const [metricaCodigo, setMetricaCodigo] = useState("");
  const [fecha, setFecha] = useState(hoyLocalISO());
  const [evaluadoPor, setEvaluadoPor] = useState("Equipo de Evaluación");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ jornadaId: string; deportistas: number; medicionesGuardadas: number } | null>(null);

  useEffect(() => {
    if (!sesionReal) return;
    const controlador = new AbortController();
    fetch("/api/secretaria/medir", { signal: controlador.signal })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos preparar la jornada.");
        return cuerpo as CatalogoMedicion;
      })
      .then((datos) => { setCatalogo(datos); setEvaluadoPor(datos.responsable); })
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === "AbortError") return;
        setError(causa instanceof Error ? causa.message : "No pudimos preparar la jornada.");
      });
    return () => controlador.abort();
  }, [sesionReal]);

  const catalogoActivo = sesionReal ? (catalogo ?? DEMO_CATALOGO) : DEMO_CATALOGO;

  const instituciones = useMemo(() => [...new Set(catalogoActivo.grupos.map((grupo) => uno(grupo.institucion)?.nombre).filter((nombre): nombre is string => Boolean(nombre)))].sort((a, b) => a.localeCompare(b, "es")), [catalogoActivo]);
  const gruposInstitucion = catalogoActivo.grupos.filter((grupo) => uno(grupo.institucion)?.nombre === institucion);
  const disciplinas = [...new Map(gruposInstitucion.map((grupo) => { const disciplina = uno(grupo.disciplina); return disciplina ? [disciplina.id, disciplina] : null; }).filter((item): item is [string, { id: string; nombre: string }] => Boolean(item))).values()];
  const grupos = gruposInstitucion.filter((grupo) => uno(grupo.disciplina)?.id === disciplinaId);
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
    if (!sesionReal) {
      setResultado({ jornadaId: "demo", deportistas: cargados, medicionesGuardadas: cargados });
      return;
    }
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
        <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Nueva jornada</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">Medir</h1><p className="mt-1 text-sm text-muted-foreground">Elegí dónde, qué protocolo y cargá al grupo de corrido.</p>{!sesionReal && <span className="mt-2 inline-flex rounded-full border border-primary/20 bg-secondary px-2.5 py-1 text-[10px] font-extrabold uppercase text-primary">Demo · no guarda datos</span>}</div>

        <section><h2 className="mb-2 text-sm font-extrabold">1 · ¿Dónde van a medir?</h2><div className="flex flex-wrap gap-2">{instituciones.map((nombre) => <button key={nombre} onClick={() => { setInstitucion(nombre); setDisciplinaId(""); setGrupoId(""); setProtocoloCodigo(""); setMetricaCodigo(""); setValores({}); }} className={cn("rounded-full border px-4 py-2 text-sm font-bold", institucion === nombre ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{nombre}</button>)}</div></section>

        {institucion && <section><h2 className="mb-2 text-sm font-extrabold">2 · ¿Qué disciplina?</h2><div className="flex flex-wrap gap-2">{disciplinas.map((disciplina) => <button key={disciplina.id} onClick={() => { setDisciplinaId(disciplina.id); setGrupoId(""); setProtocoloCodigo(""); setMetricaCodigo(""); setValores({}); }} className={cn("rounded-full border px-4 py-2 text-sm font-bold", disciplinaId === disciplina.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{disciplina.nombre}</button>)}</div></section>}

        {disciplinaId && <section><h2 className="mb-2 text-sm font-extrabold">3 · ¿Qué grupo?</h2><div className="flex flex-wrap gap-2">{grupos.map((item) => <button key={item.id} onClick={() => { setGrupoId(item.id); setValores({}); }} className={cn("rounded-full border px-4 py-2 text-sm font-bold", grupoId === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{item.nombre} · {catalogoActivo.deportistas.filter((deportista) => deportista.categoria_id === item.id).length}</button>)}</div></section>}

        {grupoId && <section><h2 className="mb-2 text-sm font-extrabold">4 · ¿Qué protocolo?</h2><div className="grid gap-2 sm:grid-cols-2">{protocolos.map((item) => <button key={item.codigo} onClick={() => { setProtocoloCodigo(item.codigo); setMetricaCodigo(""); setValores({}); }} className={cn("rounded-2xl border p-4 text-left", protocoloCodigo === item.codigo ? "border-primary bg-secondary" : "border-border bg-card")}><span className="text-sm font-extrabold">{item.nombre}</span>{item.descripcion && <span className="mt-1 block text-xs text-muted-foreground">{item.descripcion}</span>}</button>)}</div></section>}

        {protocolo && <section><h2 className="mb-2 text-sm font-extrabold">5 · ¿Qué van a registrar?</h2><div className="grid grid-cols-2 gap-2">{metricas.map((item) => <button key={item.atributo.codigo} onClick={() => { setMetricaCodigo(item.atributo.codigo); setValores({}); }} className={cn("flex items-center justify-between rounded-xl border p-3 text-left", metricaCodigo === item.atributo.codigo ? "border-primary bg-secondary" : "border-border bg-card")}><span><span className="block text-sm font-bold">{item.atributo.nombre}</span><span className="text-xs text-muted-foreground">{item.unidad}</span></span>{metricaCodigo === item.atributo.codigo && <Check className="size-4 text-primary" />}</button>)}</div></section>}

        {metrica && <section className="flex flex-col gap-3"><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold">Fecha<input type="date" value={fecha} onChange={(evento) => setFecha(evento.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm" /></label><label className="text-xs font-bold">Evaluó<input value={evaluadoPor} onChange={(evento) => setEvaluadoPor(evento.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm" /></label></div><div className="flex items-baseline justify-between"><h2 className="text-sm font-extrabold">6 · Cargar {metrica.atributo.nombre} <span className="text-muted-foreground">({metrica.unidad})</span></h2><span className="text-xs font-extrabold text-primary">{cargados}/{plantel.length}</span></div><div className="space-y-2">{plantel.map((deportista) => <label key={deportista.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"><span className="min-w-0 flex-1 text-sm font-bold">{deportista.apellido}, {deportista.nombre}</span><input inputMode="decimal" placeholder={metrica.unidad} value={valores[deportista.id] ?? ""} onChange={(evento) => setValores((actuales) => ({ ...actuales, [deportista.id]: evento.target.value }))} className="h-10 w-24 rounded-xl border border-input bg-background px-3 text-right text-sm font-bold tabular-nums outline-none focus:border-primary" /></label>)}</div>{error && <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}<button disabled={guardando || cargados === 0 || !fecha || !evaluadoPor.trim()} onClick={guardar} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground disabled:opacity-40">{guardando ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPlus className="size-4" />}{guardando ? "Guardando…" : `Guardar ${cargados} mediciones`}</button></section>}
      </div>
    </GuardiaSecretaria>
  );
}
