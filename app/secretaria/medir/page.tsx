"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, Check, CheckCircle2, ClipboardPlus, Loader2, Plus, RotateCcw, UserPlus } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { hoyLocalISO } from "@/lib/use-datos";
import { cn } from "@/lib/utils";
import { usePerfil } from "@/components/perfil-context";
import { AltaRapidaMedicion, type ModoAltaRapida } from "@/components/secretaria/alta-rapida-medicion";
import { Ayuda } from "@/components/ayuda";
import { BuscadorLugarMedicion } from "@/components/secretaria/buscador-lugar-medicion";
import { PRESIONABLE } from "@/components/secretaria/presionable";

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
interface ArbolDisciplina { id: string; nombre: string; grupos: Array<{ id: string; nombre: string; activo: boolean; deportistas: number }> }
interface ArbolInstitucion { id: string; nombre: string; activo: boolean; disciplinas: ArbolDisciplina[] }
interface CatalogoMedicion { grupos: GrupoCatalogo[]; deportistas: DeportistaCatalogo[]; protocolos: EnlaceCatalogo[]; responsable: string; arbol: ArbolInstitucion[]; disciplinas: Array<{ id: string; nombre: string }>; rol: string }

const CATALOGO_VACIO: CatalogoMedicion = { responsable: "", grupos: [], deportistas: [], protocolos: [], arbol: [], disciplinas: [], rol: "" };

function uno<T>(valor: T | T[] | null): T | null { return Array.isArray(valor) ? (valor[0] ?? null) : valor; }
function numero(valor: string) { const resultado = Number(valor.trim().replace(",", ".")); return valor.trim() && Number.isFinite(resultado) ? resultado : null; }
function rangoTexto(minimo: number | null, maximo: number | null, unidad: string) {
  if (minimo !== null && maximo !== null) return `${minimo}–${maximo} ${unidad}`;
  if (minimo !== null) return `desde ${minimo} ${unidad}`;
  return `hasta ${maximo} ${unidad}`;
}
async function pedirCatalogo(signal?: AbortSignal) {
  const respuesta = await fetch("/api/secretaria/medir", { signal, cache: "no-store" });
  const cuerpo = await respuesta.json();
  if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos preparar la jornada.");
  return cuerpo as CatalogoMedicion;
}

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
  const [altaRapida, setAltaRapida] = useState<ModoAltaRapida | null>(null);
  const camposValor = useRef<Array<HTMLInputElement | null>>([]);

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
    pedirCatalogo(controlador.signal)
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
  const puedeConfigurar = catalogoActivo.rol === "admin_secretaria" || catalogoActivo.rol === "coordinador_secretaria";

  const instituciones = catalogoActivo.arbol.filter((item) => item.activo).map(({ id, nombre }) => ({ id, nombre }));
  const deportistasPorGrupo = new Map<string, number>();
  for (const deportista of catalogoActivo.deportistas) deportistasPorGrupo.set(deportista.categoria_id, (deportistasPorGrupo.get(deportista.categoria_id) ?? 0) + 1);
  const opcionesInstitucion = catalogoActivo.arbol.filter((item) => item.activo).map((item) => ({
    id: item.id,
    nombre: item.nombre,
    disciplinas: item.disciplinas.length,
    planteles: item.disciplinas.reduce((total, disciplina) => total + disciplina.grupos.filter((g) => g.activo).length, 0),
  }));
  const opcionesPlantel = catalogoActivo.grupos.flatMap((item) => {
    const inst = uno(item.institucion);
    const disc = uno(item.disciplina);
    if (!inst || !disc || !instituciones.some((i) => i.id === inst.id)) return [];
    return [{ id: item.id, nombre: item.nombre, institucionId: inst.id, institucion: inst.nombre, disciplina: disc.nombre, deportistas: deportistasPorGrupo.get(item.id) ?? 0 }];
  });
  const institucionSeleccionada = instituciones.find((item) => item.id === institucionId) ?? null;
  const disciplinasInstitucion = catalogoActivo.arbol.find((item) => item.id === institucionId)?.disciplinas.map(({ id, nombre }) => ({ id, nombre })) ?? [];
  const gruposDisponibles = catalogoActivo.grupos.filter((item) => uno(item.institucion)?.id === institucionId && uno(item.disciplina)?.id === disciplinaId);

  const enlaces = catalogoActivo.protocolos.filter((enlace) => enlace.disciplina_id === disciplinaId);
  const protocolos = enlaces.map((enlace) => uno(enlace.protocolo)).filter((item): item is ProtocoloCatalogo => Boolean(item));
  const protocolo = protocolos.find((item) => item.codigo === protocoloCodigo) ?? null;
  const metricas = protocolo?.protocolo_atributo.map((item) => ({ ...item, atributo: uno(item.atributo)! })).filter((item) => item.atributo) ?? [];
  const metrica = metricas.find((item) => item.atributo.codigo === metricaCodigo) ?? null;
  const grupo = catalogoActivo.grupos.find((item) => item.id === grupoId) ?? null;
  const plantel = catalogoActivo.deportistas.filter((item) => item.categoria_id === grupoId);
  const cargados = plantel.filter((item) => numero(valores[item.id] ?? "") !== null).length;
  const hayValores = Object.values(valores).some((valor) => valor.trim());

  // Cambiar de plantel, protocolo o métrica borra lo tipeado: antes pasaba
  // sin aviso, y en la cancha un toque equivocado se llevaba 15 valores.
  function descartarValores(accion: () => void) {
    if (hayValores && !window.confirm(`Tenés valores cargados sin guardar. Si cambiás, se descartan. ¿Seguir?`)) return;
    accion();
  }
  function estadoValor(texto: string) {
    if (!texto.trim() || !metrica) return null;
    const valor = numero(texto);
    if (valor === null) return { tipo: "invalido" as const, texto: "No es un número" };
    if ((metrica.minimo !== null && valor < metrica.minimo) || (metrica.maximo !== null && valor > metrica.maximo)) {
      return { tipo: "rango" as const, texto: `Fuera de lo esperado (${rangoTexto(metrica.minimo, metrica.maximo, metrica.unidad)})` };
    }
    return null;
  }

  async function despuesDeAlta(resultadoAlta: { tipo: "institucion" | "grupo" | "deportista"; id: string }) {
    const datos = await pedirCatalogo();
    setCatalogo(datos);
    if (resultadoAlta.tipo === "institucion") {
      setInstitucionId(resultadoAlta.id); setDisciplinaId(""); setGrupoId("");
    } else if (resultadoAlta.tipo === "grupo") {
      const nuevoGrupo = datos.grupos.find((item) => item.id === resultadoAlta.id);
      if (nuevoGrupo) seleccionarGrupo(nuevoGrupo, datos);
    }
  }

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
      <div className="flex flex-col gap-4 sm:gap-5">
        <div><p className="hidden text-xs font-extrabold uppercase tracking-[0.16em] text-primary sm:block">Nueva jornada</p><h1 className="text-2xl font-extrabold tracking-tight sm:mt-1">Medir</h1><p className="mt-1 text-sm text-muted-foreground">Elegí dónde van a medir, la disciplina y el plantel. Después cargá la evaluación de corrido.</p></div>

        <Ayuda titulo="¿Cómo cargo una medición?" bullets={[
          "Elegí institución, disciplina y plantel para que los resultados queden asociados al grupo correcto.",
          "Seleccioná el protocolo y la métrica: una misma métrica puede medirse con protocolos distintos.",
          "Ingresá fecha, evaluador y valores. La jornada se guarda cuando confirmás la carga.",
        ]} />

        {grupo ? (
          <section aria-label="1 · Dónde van a medir" className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-secondary p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Building2 className="size-4" /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{uno(grupo.institucion)?.nombre}</span><span className="block truncate text-xs text-muted-foreground">{uno(grupo.disciplina)?.nombre} · {grupo.nombre} · {plantel.length} deportistas</span></span>
            <button onClick={() => descartarValores(() => { setGrupoId(""); setProtocoloCodigo(""); setMetricaCodigo(""); setValores({}); })} className="-mr-1 min-h-11 shrink-0 px-2 text-xs font-extrabold text-primary sm:min-h-8">Cambiar</button>
          </section>
        ) : <>
          <section>
            <div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-sm font-extrabold">1 · ¿Dónde van a medir?</h2>{catalogoActivo.rol === "admin_secretaria" && <button onClick={() => setAltaRapida("institucion")} className="inline-flex min-h-11 items-center gap-1 text-xs font-extrabold text-primary sm:min-h-8"><Plus className="size-3.5" aria-hidden />Sumar institución</button>}</div>
            {institucionSeleccionada ? <div className="flex items-center gap-3 rounded-2xl border border-primary bg-secondary p-3"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Building2 className="size-4" /></span><span className="flex-1 text-sm font-extrabold">{institucionSeleccionada.nombre}</span><button onClick={() => { setInstitucionId(""); setDisciplinaId(""); }} className="-mr-1 min-h-11 px-2 text-xs font-extrabold text-primary sm:min-h-8">Cambiar</button></div> : <BuscadorLugarMedicion
              instituciones={opcionesInstitucion}
              planteles={opcionesPlantel}
              onInstitucion={(id) => { setInstitucionId(id); setDisciplinaId(""); setGrupoId(""); setProtocoloCodigo(""); setMetricaCodigo(""); setValores({}); }}
              onPlantel={(id) => { const elegido = catalogoActivo.grupos.find((item) => item.id === id); if (elegido) seleccionarGrupo(elegido, catalogoActivo); }}
            />}
          </section>

          {institucionId && <section><div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-sm font-extrabold">2 · ¿Qué disciplina?</h2>{puedeConfigurar && <button onClick={() => setAltaRapida("disciplina")} className="inline-flex min-h-11 items-center gap-1 text-xs font-extrabold text-primary sm:min-h-8"><Plus className="size-3.5" aria-hidden />Agregar disciplina</button>}</div>{disciplinasInstitucion.length ? <div className="flex flex-wrap gap-2">{disciplinasInstitucion.map((disciplina) => <button key={disciplina.id} onClick={() => { setDisciplinaId(disciplina.id); setGrupoId(""); setProtocoloCodigo(""); setMetricaCodigo(""); setValores({}); }} className={cn("min-h-11 rounded-full border px-4 text-sm font-bold sm:min-h-9", disciplinaId === disciplina.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{disciplina.nombre}</button>)}</div> : <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">Todavía no hay disciplinas configuradas para esta institución.</p>}</section>}

          {disciplinaId && <section><div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-sm font-extrabold">3 · ¿Qué grupo o plantel?</h2>{puedeConfigurar && <button onClick={() => setAltaRapida("grupo")} className="inline-flex min-h-11 items-center gap-1 text-xs font-extrabold text-primary sm:min-h-8"><Plus className="size-3.5" aria-hidden />Nuevo</button>}</div>{gruposDisponibles.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{gruposDisponibles.map((item) => { const cantidad = catalogoActivo.deportistas.filter((deportista) => deportista.categoria_id === item.id).length; return <button key={item.id} onClick={() => seleccionarGrupo(item, catalogoActivo)} className="rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/35"><span className="text-sm font-extrabold">{item.nombre}</span><span className="mt-0.5 block text-xs text-muted-foreground">{cantidad} deportistas</span></button>; })}</div> : <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">No hay planteles para esta disciplina todavía.</p>}</section>}
        </>}

        {grupoId && <section className="space-y-2"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-sm font-extrabold">2 · ¿Qué van a medir?</h2><p className="hidden text-xs text-muted-foreground lg:block">Elegí un protocolo y una métrica para que cada resultado quede correctamente contextualizado.</p></div></div><div className="flex flex-wrap gap-1.5">{protocolos.map((item) => <button key={item.codigo} onClick={() => descartarValores(() => { const primera = item.protocolo_atributo.map((x) => ({ ...x, atributo: uno(x.atributo) })).find((x) => x.requerido && x.atributo) ?? item.protocolo_atributo.map((x) => ({ ...x, atributo: uno(x.atributo) })).find((x) => x.atributo); setProtocoloCodigo(item.codigo); setMetricaCodigo(primera?.atributo?.codigo ?? ""); setValores({}); })} className={cn("min-h-11 rounded-full border px-3.5 text-xs font-bold sm:min-h-9", protocoloCodigo === item.codigo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{item.nombre}</button>)}</div>{protocolo && <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-3">{metricas.map((item) => <button key={item.atributo.codigo} title={`${item.atributo.nombre} · ${item.unidad}`} onClick={() => { if (item.atributo.codigo !== metricaCodigo) descartarValores(() => { setMetricaCodigo(item.atributo.codigo); setValores({}); }); }} className={cn("flex min-h-11 min-w-0 items-center justify-between gap-1.5 rounded-xl border px-2 py-1.5 text-left", metricaCodigo === item.atributo.codigo ? "border-primary bg-secondary" : "border-border bg-card")}><span className="min-w-0 flex-1 truncate text-xs font-bold leading-tight">{item.atributo.nombre}</span><span className="shrink-0 text-[11px] text-muted-foreground">{item.unidad}</span>{metricaCodigo === item.atributo.codigo && <Check className="size-3.5 shrink-0 text-primary" />}</button>)}</div>}</section>}

        {metrica && <section className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block min-w-0 text-xs font-bold">Fecha<input type="date" value={fecha} onChange={(evento) => setFecha(evento.target.value)} className="mt-1 block h-11 min-w-0 w-full max-w-full rounded-xl border border-input bg-card px-2 text-base sm:px-2.5 sm:text-sm" /></label>
            <label className="block min-w-0 text-xs font-bold">Evaluó<input value={evaluadoPor} onChange={(evento) => setEvaluadoPor(evento.target.value)} className="mt-1 block h-11 min-w-0 w-full max-w-full box-border rounded-xl border border-input bg-card px-2 text-base sm:px-2.5 sm:text-sm" /></label>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><h2 className="truncate text-sm font-extrabold">3 · Cargar {metrica.atributo.nombre} <span className="text-muted-foreground">({metrica.unidad})</span></h2><p className="text-xs text-muted-foreground">{`Completá solo a quienes participaron. Enter pasa al siguiente${metrica.minimo !== null || metrica.maximo !== null ? ` · esperado: ${rangoTexto(metrica.minimo, metrica.maximo, metrica.unidad)}` : ""}.`}</p></div>
            <div className="flex shrink-0 items-center gap-2"><span className="text-xs font-extrabold text-primary">{cargados}/{plantel.length}</span>{puedeConfigurar && <button onClick={() => setAltaRapida("deportista")} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-primary/25 bg-secondary px-2.5 text-xs font-extrabold text-primary sm:min-h-8"><UserPlus className="size-3.5" aria-hidden />Agregar</button>}</div>
          </div>
          <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">{plantel.map((deportista, indice) => {
            const estado = estadoValor(valores[deportista.id] ?? "");
            const avisoId = `aviso-${deportista.id}`;
            return <label key={deportista.id} className={cn("flex min-w-0 flex-col rounded-xl border bg-card p-2", estado?.tipo === "invalido" ? "border-destructive/50" : estado ? "border-warning/60" : "border-border")}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{deportista.apellido?.trim() ? `${deportista.apellido}, ${deportista.nombre}` : deportista.nombre}</span>
                <input
                  ref={(el) => { camposValor.current[indice] = el; }}
                  inputMode="decimal"
                  enterKeyHint={indice === plantel.length - 1 ? "done" : "next"}
                  autoComplete="off"
                  aria-label={`${metrica.atributo.nombre} de ${deportista.nombre}`}
                  aria-invalid={estado?.tipo === "invalido" || undefined}
                  aria-describedby={estado ? avisoId : undefined}
                  placeholder={metrica.unidad}
                  value={valores[deportista.id] ?? ""}
                  onChange={(evento) => setValores((actuales) => ({ ...actuales, [deportista.id]: evento.target.value }))}
                  // Cargar "de corrido": Enter salta al siguiente deportista.
                  onKeyDown={(evento) => { if (evento.key === "Enter") { evento.preventDefault(); const siguiente = camposValor.current[indice + 1]; if (siguiente) siguiente.focus(); else evento.currentTarget.blur(); } }}
                  className="h-11 w-24 shrink-0 rounded-lg border border-input bg-background px-2 text-right text-base font-bold tabular-nums outline-none focus:border-primary"
                />
              </span>
              {estado && <span id={avisoId} className={cn("mt-1 text-right text-[11px] font-semibold", estado.tipo === "invalido" ? "text-destructive" : "text-warning")}>{estado.texto}</span>}
            </label>;
          })}</div>
          {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
          <div className="sticky bottom-20 z-20 rounded-2xl bg-background/95 pt-2 backdrop-blur md:bottom-4"><button disabled={guardando || cargados === 0 || !fecha || !evaluadoPor.trim()} onClick={guardar} className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/15 disabled:shadow-none disabled:opacity-40 ${PRESIONABLE}`}>{guardando ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPlus className="size-4" />}{guardando ? "Guardando…" : `Guardar ${cargados} ${cargados === 1 ? "medición" : "mediciones"}`}</button></div>
        </section>}
      </div>
      {altaRapida && <AltaRapidaMedicion
        modoInicial={altaRapida}
        instituciones={instituciones}
        disciplinas={catalogoActivo.disciplinas}
        grupos={catalogoActivo.grupos.map((item) => ({ id: item.id, nombre: item.nombre, institucion: uno(item.institucion)?.nombre ?? "Sin institución", disciplina: uno(item.disciplina)?.nombre ?? "Sin disciplina" }))}
        disciplinasInstitucion={disciplinasInstitucion.map((item) => item.id)}
        institucionInicial={institucionId || undefined}
        disciplinaInicial={disciplinaId || undefined}
        grupoInicial={grupoId || undefined}
        onClose={() => setAltaRapida(null)}
        onCreado={despuesDeAlta}
        onDisciplinaSeleccionada={(id) => { setDisciplinaId(id); setGrupoId(""); setProtocoloCodigo(""); setMetricaCodigo(""); setValores({}); }}
      />}
    </GuardiaSecretaria>
  );
}
