"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, CircleDashed, FlaskConical } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { DISCIPLINAS_SECRETARIA } from "@/lib/secretaria-demo";
import { useSecretaria } from "@/lib/use-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { Ayuda } from "@/components/ayuda";
import { CampoBusqueda } from "@/components/secretaria/campo-busqueda";
import { cn, paraBuscar } from "@/lib/utils";
import { crearClienteBrowser } from "@/lib/supabase/client";

const MES = new Intl.DateTimeFormat("es-AR", { month: "short" });
function fechaCorta(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MES.format(new Date(a, m - 1, d)).replace(".", "")} ${a}`;
}

/** Qué se puede medir en una disciplina: sus protocolos y lo que registra cada uno. */
interface ProtocoloCatalogo {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  metricas: Array<{ codigo: string; nombre: string; unidad: string; minimo: number | null; maximo: number | null }>;
}

type FilaCatalogo = {
  disciplina_id: string;
  orden: number;
  protocolo: { codigo: string; nombre: string; descripcion: string | null; protocolo_atributo: Array<{ unidad: string; minimo: number | null; maximo: number | null; atributo: { codigo: string; nombre: string } | null }> } | null;
};

function rango(minimo: number | null, maximo: number | null, unidad: string) {
  if (minimo === null && maximo === null) return null;
  if (minimo !== null && maximo !== null) return `${minimo}–${maximo} ${unidad}`;
  return minimo !== null ? `desde ${minimo} ${unidad}` : `hasta ${maximo} ${unidad}`;
}

interface DisciplinaReal {
  disciplinaId: string;
  disciplina: string;
  instituciones: string[];
  grupos: number;
  deportistas: number;
  jornadas: number;
  ultimaFecha: string | null;
  protocolosUsados: string[];
  metricasUsadas: Array<{ codigo: string; nombre: string; unidad: string; cantidad: number }>;
  protocolosSinDatos: string[];
  metricasSinDatos: string[];
}

export default function DisciplinasSecretaria() {
  const { resumen, cargando, error, real } = useSecretaria();
  const [cobertura, setCobertura] = useState<DisciplinaReal[] | null>(null);
  const [errorCobertura, setErrorCobertura] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [catalogo, setCatalogo] = useState<Map<string, ProtocoloCatalogo[]> | null>(null);

  // El catálogo (qué se puede medir) es global y lo lee cualquier sesión: se
  // consulta directo. Si falla, la pantalla sigue sin esa sección.
  useEffect(() => {
    if (!real) return;
    let vigente = true;
    crearClienteBrowser()
      .from("disciplina_protocolo")
      .select("disciplina_id, orden, protocolo:protocolo_id(codigo, nombre, descripcion, protocolo_atributo(unidad, minimo, maximo, atributo:atributo_id(codigo, nombre)))")
      .eq("activo", true)
      .then(({ data, error }) => {
        if (!vigente || error || !data) return;
        const mapa = new Map<string, ProtocoloCatalogo[]>();
        for (const fila of data as unknown as FilaCatalogo[]) {
          if (!fila.protocolo) continue;
          const lista = mapa.get(fila.disciplina_id) ?? [];
          lista.push({
            codigo: fila.protocolo.codigo,
            nombre: fila.protocolo.nombre,
            descripcion: fila.protocolo.descripcion,
            orden: fila.orden,
            metricas: fila.protocolo.protocolo_atributo.flatMap((m) => m.atributo ? [{ codigo: m.atributo.codigo, nombre: m.atributo.nombre, unidad: m.unidad, minimo: m.minimo, maximo: m.maximo }] : []),
          });
          mapa.set(fila.disciplina_id, lista.sort((a, b) => a.orden - b.orden));
        }
        setCatalogo(mapa);
      });
    return () => { vigente = false; };
  }, [real]);
  useEffect(() => {
    if (!real) return;
    const controlador = new AbortController();
    fetch("/api/secretaria/disciplinas", { signal: controlador.signal })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos cargar la cobertura.");
        return cuerpo as DisciplinaReal[];
      })
      .then(setCobertura)
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === "AbortError") return;
        setErrorCobertura(causa instanceof Error ? causa.message : "No pudimos cargar la cobertura.");
      });
    return () => controlador.abort();
  }, [real]);
  if (cargando) return <CargandoPelota texto="Cargando disciplinas…" />;
  if (error) return <AvisoAcceso titulo="No pudimos cargar las disciplinas" detalle={error} accionHref="/secretaria/disciplinas" accionLabel="Reintentar" />;
  if (errorCobertura) return <AvisoAcceso titulo="No pudimos cargar la cobertura" detalle={errorCobertura} accionHref="/secretaria/disciplinas" accionLabel="Reintentar" />;
  const disciplinas = real && resumen
    ? resumen.disciplinas.map((disciplina) => ({
        nombre: disciplina.nombre,
        grupos: disciplina.grupos,
        estado: disciplina.grupos > 0
          ? "Batería activa"
          : disciplina.lotes > 0
            ? "Planilla recibida"
            : "Catálogo listo",
      }))
    : DISCIPLINAS_SECRETARIA;
  const disciplinasConRegistros = cobertura?.filter((item) => item.jornadas > 0).length ?? 0;
  const disciplinasPorIniciar = cobertura ? Math.max(0, cobertura.length - disciplinasConRegistros) : 0;
  const termino = paraBuscar(busqueda);
  // Primero las que tienen datos (más deportistas arriba), después las que
  // todavía no se midieron.
  const visibles = (cobertura ?? [])
    .filter((item) => !termino || paraBuscar(`${item.disciplina} ${item.instituciones.join(" ")}`).includes(termino))
    .toSorted((a, b) => Number(b.jornadas > 0) - Number(a.jornadas > 0) || b.deportistas - a.deportistas || a.disciplina.localeCompare(b.disciplina, "es"));
  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-4 sm:gap-5">
        <div>
          <p className="hidden text-xs font-extrabold uppercase tracking-[0.16em] text-primary sm:block">Catálogo habilitado</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:mt-1">Disciplinas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {real && cobertura
              ? `${cobertura.length} en el catálogo · ${disciplinasConRegistros} con jornadas · ${disciplinasPorIniciar} sin jornadas todavía`
              : "La Secretaría habilita baterías validadas; las métricas no se inventan desde una planilla."}
          </p>
        </div>

        <Ayuda titulo="¿Qué muestra esta sección?" bullets={[
          "Qué se mide en cada disciplina, en qué instituciones y cuántas jornadas hay registradas.",
          "Un protocolo es cómo se hace la prueba (CMJ, SJ…); una métrica es el resultado (altura de salto). La misma métrica puede medirse con protocolos distintos.",
          "Qué se puede medir en cada disciplina es un catálogo común para toda la provincia: así los datos de distintos clubes se pueden comparar. No se edita desde acá; si falta un protocolo o una disciplina, pedilo desde Planteles con \"Solicitar disciplina\".",
        ]} />

        {real ? (
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border px-3 py-3 sm:px-5">
              <div className="flex items-start gap-2">
                <FlaskConical className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <p className="text-xs text-muted-foreground"><strong className="font-extrabold text-foreground">Cobertura:</strong> de los protocolos que se pueden medir en cada disciplina, cuántos ya tienen mediciones. Abrí una disciplina para ver el detalle.</p>
              </div>
              {(cobertura?.length ?? 0) > 6 && <CampoBusqueda valor={busqueda} onCambio={setBusqueda} etiqueta="Buscar disciplinas" placeholder="Buscar disciplina o institución" />}
            </div>
            {!cobertura ? <div className="p-4"><CargandoPelota texto="Calculando cobertura…" /></div> : visibles.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{`No encontramos "${busqueda.trim()}".`}</p> : <div className="divide-y divide-border xl:grid xl:grid-cols-2 xl:gap-3 xl:divide-y-0 xl:p-3">{visibles.map((item) => {
              const tieneDatos = item.jornadas > 0;
              const totalProtocolos = item.protocolosUsados.length + item.protocolosSinDatos.length;
              const planteles = disciplinas.find((disciplina) => disciplina.nombre === item.disciplina)?.grupos ?? 0;
              return <details key={item.disciplinaId} className="group xl:overflow-hidden xl:rounded-2xl xl:border xl:border-border xl:bg-card">
                <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3 py-3 hover:bg-muted/30 sm:px-5">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", tieneDatos ? "bg-secondary text-primary" : "bg-warning-soft text-warning")}>
                    {tieneDatos ? <CheckCircle2 className="size-4" aria-hidden /> : <CircleDashed className="size-4" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">{item.disciplina}</span>
                    <span className="block text-xs text-muted-foreground">
                      {tieneDatos
                        ? `${item.deportistas} ${item.deportistas === 1 ? "deportista" : "deportistas"} · ${item.jornadas} ${item.jornadas === 1 ? "jornada" : "jornadas"}${item.ultimaFecha ? ` · última ${fechaCorta(item.ultimaFecha)}` : ""}`
                        : "Sin jornadas todavía"}
                    </span>
                    {totalProtocolos > 0 && (
                      <span className="mt-1.5 flex items-center gap-2" aria-label={`${item.protocolosUsados.length} de ${totalProtocolos} protocolos con mediciones`}>
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${(item.protocolosUsados.length / totalProtocolos) * 100}%` }} /></span>
                        <span className="text-[11px] font-bold text-muted-foreground">{`${item.protocolosUsados.length} de ${totalProtocolos} protocolos`}</span>
                      </span>
                    )}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-(--ease-out) group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                </summary>
                <div className="space-y-3 border-t border-border bg-muted/20 px-3 py-3 sm:px-5">
                  {(() => {
                    const protocolos = catalogo?.get(item.disciplinaId) ?? [];
                    const cantidad = new Map(item.metricasUsadas.map((m) => [m.codigo, m.cantidad]));
                    if (protocolos.length === 0) {
                      // Sin el catálogo (no cargó), lo mínimo: qué protocolos tienen datos.
                      return <p className="text-xs"><span className="font-bold">Con mediciones: </span>{item.protocolosUsados.join(" · ") || "ninguno todavía"}</p>;
                    }
                    return <div>
                      <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">{`Qué se puede medir en ${item.disciplina}`}</h3>
                      <ul className="mt-2 space-y-2">
                        {protocolos.map((protocolo) => {
                          const medido = item.protocolosUsados.includes(protocolo.codigo);
                          return <li key={protocolo.codigo} className={cn("rounded-xl border bg-card p-3", medido ? "border-primary/25" : "border-dashed border-border")}>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-extrabold">{protocolo.nombre}</p>
                                {protocolo.descripcion && <p className="text-xs text-muted-foreground">{protocolo.descripcion}</p>}
                              </div>
                              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", medido ? "bg-secondary text-primary" : "bg-muted text-muted-foreground")}>{medido ? "Con mediciones" : "Sin mediciones todavía"}</span>
                            </div>
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {protocolo.metricas.map((metrica) => {
                                const r = rango(metrica.minimo, metrica.maximo, metrica.unidad);
                                return <li key={metrica.codigo} className="rounded-lg bg-muted/60 px-2 py-1 text-xs">
                                  <span className="font-bold">{metrica.nombre}</span>
                                  <span className="text-muted-foreground">{` · ${metrica.unidad}${r ? ` · esperado ${r}` : ""}`}</span>
                                </li>;
                              })}
                            </ul>
                          </li>;
                        })}
                      </ul>
                      {item.metricasUsadas.length > 0 && <>
                        <h3 className="mt-4 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Registros por métrica</h3>
                        <div className="mt-2 grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2 lg:grid-cols-3">{item.metricasUsadas.map((metrica) => <div key={metrica.codigo} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"><span className="min-w-0"><span className="block text-xs font-bold">{metrica.nombre}</span><span className="text-[11px] text-muted-foreground">{metrica.unidad}</span></span><span className="shrink-0 text-xs font-extrabold tabular-nums text-primary">{(cantidad.get(metrica.codigo) ?? metrica.cantidad).toLocaleString("es-AR")}</span></div>)}</div>
                      </>}
                    </div>;
                  })()}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{`${planteles} ${planteles === 1 ? "plantel" : "planteles"}`}</span>
                    <span>{item.instituciones.length ? item.instituciones.join(", ") : "Ninguna institución todavía"}</span>
                    {item.jornadas > 0 && <Link href="/secretaria/reportes" className="-my-2 inline-flex min-h-11 items-center font-extrabold text-primary sm:min-h-8">Ver reportes</Link>}
                  </div>
                </div>
              </details>;
            })}</div>}
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border px-3 py-3"><h2 className="text-sm font-extrabold">Catálogo de disciplinas</h2></div><div className="divide-y divide-border">{disciplinas.map((item) => <div key={item.nombre} className="flex min-h-14 items-center gap-3 px-3 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><CircleDashed className="size-4" aria-hidden /></span><span className="min-w-0 flex-1 text-sm font-bold">{item.nombre}</span></div>)}</div></section>
        )}
      </div>
    </GuardiaSecretaria>
  );
}
