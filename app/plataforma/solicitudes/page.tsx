"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Inbox, Link2, Loader2, ShieldAlert, Shapes, X } from "lucide-react";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { EstadoVacio } from "@/components/estado-vacio";
import { CargandoPelota } from "@/components/cargando-pelota";
import { usePerfil } from "@/components/perfil-context";
import { formatFecha } from "@/lib/mock-data";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  listarSolicitudesDisciplina,
  resolverSolicitudDisciplina,
  type SolicitudDisciplinaPlataforma,
} from "@/app/plataforma/actions";

// Bandeja de curaduría del catálogo: lo que la Secretaría pide (una
// disciplina nueva, o algo que falta medir en una existente). Tres salidas:
// rechazar con motivo, vincular a una disciplina que ya existía con otro
// nombre, o aprobar eligiendo protocolos del catálogo. Acá no se crean
// protocolos ni métricas: eso es edición del catálogo, con el PF.

interface Catalogo {
  disciplinas: Array<{ id: string; nombre: string }>;
  protocolos: Array<{ codigo: string; nombre: string; descripcion: string | null }>;
  /** protocolos ya activos por disciplina, para no ofrecerlos de nuevo */
  habilitados: Map<string, Set<string>>;
}

type Modo = "aprobar" | "vincular" | "rechazar";

const ESTADO: Record<SolicitudDisciplinaPlataforma["estado"], { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "bg-warning-soft text-warning" },
  aprobada: { texto: "Aprobada", clase: "bg-success-soft text-success" },
  rechazada: { texto: "Rechazada", clase: "bg-muted text-muted-foreground" },
};

const campo = "mt-1 block h-11 w-full rounded-xl border border-input bg-background px-3 text-base font-normal outline-none focus:border-primary sm:text-sm";

function CardSolicitud({ s, catalogo, onResuelta }: {
  s: SolicitudDisciplinaPlataforma;
  catalogo: Catalogo | null;
  onResuelta: () => void;
}) {
  const pendiente = s.estado === "pendiente";
  const esProtocolo = s.tipo === "protocolo";
  const [modo, setModo] = useState<Modo | null>(null);
  const [nombre, setNombre] = useState(s.nombre);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [disciplinaId, setDisciplinaId] = useState("");
  const [resolucion, setResolucion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const yaHabilitados = s.disciplinaObjetivo ? catalogo?.habilitados.get(s.disciplinaObjetivo.id) ?? new Set<string>() : new Set<string>();
  const protocolosOfrecidos = (catalogo?.protocolos ?? []).filter((p) => !yaHabilitados.has(p.codigo));

  const puedeEnviar = modo === "rechazar"
    ? resolucion.trim().length >= 3
    : modo === "vincular"
      ? Boolean(disciplinaId)
      : modo === "aprobar"
        ? elegidos.length > 0 && (esProtocolo || nombre.trim().length >= 2)
        : false;

  async function enviar() {
    if (!modo || !puedeEnviar) return;
    setEnviando(true); setError("");
    const r = await resolverSolicitudDisciplina(
      modo === "rechazar"
        ? { id: s.id, accion: "rechazar", resolucion: resolucion.trim() }
        : modo === "vincular"
          ? { id: s.id, accion: "vincular", disciplinaId, resolucion: resolucion.trim() || undefined }
          : { id: s.id, accion: "aprobar", nombre: esProtocolo ? undefined : nombre.trim(), protocolos: elegidos, resolucion: resolucion.trim() || undefined },
    );
    setEnviando(false);
    if (!r.ok) { setError(r.error); return; }
    onResuelta();
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
          {esProtocolo ? `Algo que falta en ${s.disciplinaObjetivo?.nombre ?? "una disciplina"}` : "Disciplina nueva"}
        </span>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", ESTADO[s.estado].clase)}>{ESTADO[s.estado].texto}</span>
        <span className="ml-auto text-xs text-muted-foreground">{formatFecha(s.creadoEn.slice(0, 10))}</span>
      </div>

      <div>
        <p className="text-base font-extrabold leading-snug">{s.nombre}</p>
        {s.descripcion && <p className="mt-1 text-sm text-muted-foreground">{s.descripcion}</p>}
        {s.contexto && <p className="mt-1 text-sm"><span className="font-bold">Para qué: </span>{s.contexto}</p>}
        <p className="mt-2 text-xs text-muted-foreground">{`${s.autor}${s.funcion ? ` (${s.funcion})` : ""} · ${s.club}`}</p>
      </div>

      {!pendiente && (
        <div className="rounded-xl bg-muted/50 p-3 text-xs">
          {s.disciplina && <p><span className="font-bold">Disciplina: </span>{s.disciplina.nombre}</p>}
          {s.protocolosHabilitados.length > 0 && <p><span className="font-bold">Protocolos habilitados: </span>{s.protocolosHabilitados.join(" · ")}</p>}
          {s.resolucion && <p className="mt-1 text-muted-foreground">{s.resolucion}</p>}
          {s.resueltoEn && <p className="mt-1 text-muted-foreground">{`Resuelta el ${formatFecha(s.resueltoEn.slice(0, 10))}`}</p>}
        </div>
      )}

      {pendiente && (
        <>
          <div role="group" aria-label="Cómo resolver" className="flex flex-wrap gap-2">
            {([
              ["aprobar", esProtocolo ? "Sumar protocolos" : "Aprobar", Check],
              ...(esProtocolo ? [] : [["vincular", "Ya existe", Link2] as const]),
              ["rechazar", "Rechazar", X],
            ] as const).map(([valor, etiqueta, Icono]) => (
              <button key={valor} type="button" aria-pressed={modo === valor} onClick={() => { setModo(valor); setError(""); }}
                className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-bold sm:min-h-9", modo === valor ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
                <Icono className="size-4" aria-hidden />{etiqueta}
              </button>
            ))}
          </div>

          {modo === "aprobar" && (
            <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
              {!esProtocolo && (
                <label className="block text-xs font-bold">Nombre en el catálogo
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} className={campo} />
                  <span className="mt-1 block font-normal text-muted-foreground">Revisá tildes y cómo se escribe: es el nombre que van a ver todos los clubes.</span>
                </label>
              )}
              <fieldset>
                <legend className="text-xs font-bold">{esProtocolo ? `Protocolos a sumar a ${s.disciplinaObjetivo?.nombre ?? "la disciplina"}` : "Protocolos que se van a poder medir"}</legend>
                {!catalogo ? <p className="mt-2 text-xs text-muted-foreground">Cargando el catálogo…</p> : protocolosOfrecidos.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Esa disciplina ya tiene todos los protocolos del catálogo. Si lo que piden no existe, hay que sumarlo al catálogo primero (con el preparador físico).</p>
                ) : (
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {protocolosOfrecidos.map((p) => (
                      <li key={p.codigo}>
                        <label className={cn("flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-sm", elegidos.includes(p.codigo) ? "border-primary bg-secondary/40" : "border-border hover:bg-muted/40")}>
                          <input type="checkbox" checked={elegidos.includes(p.codigo)} onChange={(e) => setElegidos((actual) => e.target.checked ? [...actual, p.codigo] : actual.filter((c) => c !== p.codigo))} className="mt-0.5 size-4 accent-primary" />
                          <span><span className="block font-bold">{p.nombre}</span>{p.descripcion && <span className="block text-xs text-muted-foreground">{p.descripcion}</span>}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
            </div>
          )}

          {modo === "vincular" && (
            <label className="block rounded-xl border border-border p-3 text-xs font-bold">¿Con qué disciplina del catálogo es la misma?
              <select value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)} className={campo}>
                <option value="">Elegí una disciplina…</option>
                {(catalogo?.disciplinas ?? []).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
              <span className="mt-1 block font-normal text-muted-foreground">{"Si no escribís otra respuesta, quien pidió ve: “Ya existe en el catálogo como «…»”."}</span>
            </label>
          )}

          {modo && (
            <label className="block text-xs font-bold">
              {modo === "rechazar" ? "Motivo (lo ve quien pidió)" : "Respuesta para quien pidió (opcional)"}
              <textarea value={resolucion} onChange={(e) => setResolucion(e.target.value)} maxLength={1000} placeholder={modo === "rechazar" ? "Ej.: ese test no tiene un protocolo validado todavía; lo vemos con el PF." : ""} className={cn(campo, "h-20 resize-y py-2.5")} />
            </label>
          )}

          {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{error}</p>}

          {modo && (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModo(null)} className="min-h-11 rounded-xl px-4 text-sm font-bold text-muted-foreground">Cancelar</button>
              <button type="button" onClick={() => void enviar()} disabled={!puedeEnviar || enviando} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground disabled:opacity-45">
                {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {modo === "rechazar" ? "Rechazar solicitud" : modo === "vincular" ? "Vincular" : esProtocolo ? (elegidos.length === 0 ? "Sumar protocolos" : `Sumar ${elegidos.length} ${elegidos.length === 1 ? "protocolo" : "protocolos"}`) : "Aprobar y crear la disciplina"}
              </button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

export default function SolicitudesPlataforma() {
  const { perfil, sesionReal } = usePerfil();
  const [solicitudes, setSolicitudes] = useState<SolicitudDisciplinaPlataforma[] | null>(null);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const esPlataformaReal = sesionReal && perfil === "super_admin";

  useEffect(() => {
    if (!esPlataformaReal) return;
    let cancelado = false;
    listarSolicitudesDisciplina().then((r) => {
      if (cancelado) return;
      if (r.ok) setSolicitudes(r.data);
      else setError(r.error);
    });
    return () => { cancelado = true; };
  }, [esPlataformaReal, version]);

  // El catálogo es de lectura para cualquier sesión: disciplinas, protocolos
  // activos y cuáles tiene ya cada disciplina.
  useEffect(() => {
    if (!esPlataformaReal) return;
    let cancelado = false;
    const supabase = crearClienteBrowser();
    Promise.all([
      supabase.from("disciplina").select("id, nombre").order("nombre"),
      supabase.from("protocolo").select("codigo, nombre, descripcion").eq("activo", true).order("codigo"),
      supabase.from("disciplina_protocolo").select("disciplina_id, protocolo:protocolo_id(codigo)").eq("activo", true),
    ]).then(([d, p, dp]) => {
      if (cancelado || d.error || p.error || dp.error) return;
      const habilitados = new Map<string, Set<string>>();
      for (const fila of (dp.data ?? []) as unknown as Array<{ disciplina_id: string; protocolo: { codigo: string } | null }>) {
        if (!fila.protocolo) continue;
        const actual = habilitados.get(fila.disciplina_id) ?? new Set<string>();
        actual.add(fila.protocolo.codigo);
        habilitados.set(fila.disciplina_id, actual);
      }
      setCatalogo({ disciplinas: d.data ?? [], protocolos: p.data ?? [], habilitados });
    });
    return () => { cancelado = true; };
  }, [esPlataformaReal, version]);

  if (perfil !== "super_admin") {
    return <AvisoAcceso titulo="Solo para la plataforma" detalle="La curaduría del catálogo de disciplinas es de la operación provincial." accionHref="/panel" accionLabel="Volver al inicio" />;
  }
  if (!esPlataformaReal) {
    return <AvisoAcceso titulo="Requiere la sesión real de plataforma" detalle="Acá se resuelven los pedidos de la Secretaría: disciplinas nuevas o protocolos que faltan. Ingresá con la cuenta de plataforma." accionHref="/login" accionLabel="Ingresar" />;
  }

  const pendientes = (solicitudes ?? []).filter((s) => s.estado === "pendiente");
  const resueltas = (solicitudes ?? []).filter((s) => s.estado !== "pendiente");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <Shapes className="size-5 text-primary" aria-hidden />
          Solicitudes de disciplina
        </h1>
        <p className="text-sm text-muted-foreground">
          {`Lo que pide la Secretaría para el catálogo.${pendientes.length > 0 ? ` ${pendientes.length} sin resolver.` : ""}`}
        </p>
      </div>

      <p className="rounded-xl bg-muted px-3.5 py-2.5 text-xs leading-snug text-muted-foreground">
        El catálogo es común a toda la provincia: lo que apruebes queda disponible para medir en todos los espacios. Acá solo se eligen protocolos que ya existen; sumar un protocolo o una métrica nueva es edición del catálogo y va con el preparador físico.
      </p>

      {!solicitudes && !error && <CargandoPelota texto="Cargando solicitudes…" />}
      {error && <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /><p>{error}</p></div>}

      {solicitudes && solicitudes.length === 0 && (
        <EstadoVacio icono={Inbox} titulo="Sin solicitudes todavía" detalle="Cuando la Secretaría pida una disciplina nueva o algo que falta medir en una existente (desde Planteles → Disciplinas), aparece acá para que lo resuelvas." />
      )}

      {pendientes.length > 0 && <ul className="flex flex-col gap-2.5">{pendientes.map((s) => <CardSolicitud key={s.id} s={s} catalogo={catalogo} onResuelta={recargar} />)}</ul>}

      {resueltas.length > 0 && (
        <>
          <h2 className="mt-2 text-sm font-extrabold text-muted-foreground">Resueltas</h2>
          <ul className="flex flex-col gap-2.5">{resueltas.slice(0, 20).map((s) => <CardSolicitud key={s.id} s={s} catalogo={catalogo} onResuelta={recargar} />)}</ul>
        </>
      )}
    </div>
  );
}
