"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, FileSpreadsheet, Gauge, ShieldCheck, Users } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";

interface DetalleLote {
  loteId: string;
  archivo: string;
  estado: string;
  contexto: { institucionOrigen?: string; disciplina?: string; grupo?: string; fechaDeclarada?: string; evaluadoPor?: string };
  recibidoEn: string;
  confirmadoEn: string | null;
  filasIgnoradas: number;
  duplicados: number;
  bloqueosPendientes: number;
  deportistas: number;
  mediciones: number;
  protocolos: string[];
  metricas: Array<string | { codigo: string; nombre: string; unidad: string; cantidad: number }>;
  hallazgos: Array<{ id: string; titulo?: string; detalle?: string; severidad?: string }>;
  correcciones: Array<{ campo: string; antes: unknown; despues: unknown; motivo: string; por: string; cuando: string }>;
  jornadas: Array<{ id: string; fecha: string; grupo: string; evaluadoPor: string; mediciones: number }>;
}

function fecha(valor?: string | null) {
  if (!valor) return "Sin fecha confirmada";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(valor));
}

export default function DetallePlanillaSecretaria() {
  const { id } = useParams<{ id: string }>();
  const [detalle, setDetalle] = useState<DetalleLote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controlador = new AbortController();
    fetch(`/api/secretaria/planillas/${id}`, { signal: controlador.signal })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos abrir la planilla.");
        return cuerpo as DetalleLote;
      })
      .then(setDetalle)
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === "AbortError") return;
        setError(causa instanceof Error ? causa.message : "No pudimos abrir la planilla.");
      });
    return () => controlador.abort();
  }, [id]);

  if (error) return <AvisoAcceso titulo="No pudimos abrir la planilla" detalle={error} accionHref="/secretaria/jornadas" accionLabel="Volver a planillas" />;
  if (!detalle) return <CargandoPelota texto="Reconstruyendo la planilla…" />;

  const metricas = detalle.metricas.map((metrica) => typeof metrica === "string"
    ? { codigo: metrica, nombre: metrica.replaceAll("_", " "), unidad: "", cantidad: null }
    : metrica);

  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-5">
        <div>
          <Link href="/secretaria/jornadas" className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary"><ArrowLeft className="size-3.5" />Planillas</Link>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">{detalle.contexto.disciplina ?? "Evaluación"}</p>
          <h1 className="mt-1 break-words text-2xl font-extrabold tracking-tight">{detalle.archivo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{detalle.contexto.institucionOrigen} · {detalle.contexto.grupo}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [Users, detalle.deportistas, "deportistas"],
            [Gauge, detalle.mediciones, "mediciones"],
            [CalendarDays, detalle.jornadas.length, "jornadas"],
            [FileSpreadsheet, detalle.duplicados, "duplicados detectados"],
          ].map(([Icon, valor, etiqueta]) => {
            const Icono = Icon as typeof Users;
            return <div key={String(etiqueta)} className="rounded-2xl border border-border bg-card p-3.5"><Icono className="size-4 text-primary" /><p className="mt-3 text-2xl font-extrabold">{String(valor)}</p><p className="text-[11px] font-semibold text-muted-foreground">{String(etiqueta)}</p></div>;
          })}
        </div>

        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-extrabold">Qué se midió</h2><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-extrabold text-primary">{detalle.estado}</span></div>
          <div className="mt-4 flex flex-wrap gap-2">{detalle.protocolos.length ? detalle.protocolos.map((protocolo) => <span key={protocolo} className="rounded-full bg-primary px-3 py-1 text-xs font-extrabold text-primary-foreground">{protocolo}</span>) : <span className="text-xs text-muted-foreground">Sin protocolo confirmado</span>}</div>
          <div className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {metricas.map((metrica) => <div key={metrica.codigo} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-bold capitalize">{metrica.nombre}</p><p className="text-xs text-muted-foreground">{metrica.unidad || "Unidad por validar"}</p></div>{metrica.cantidad !== null && <span className="text-xs font-extrabold text-primary">{metrica.cantidad}</span>}</div>)}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5">
          <h2 className="text-sm font-extrabold">Jornadas producidas</h2>
          <div className="mt-3 divide-y divide-border">{detalle.jornadas.length ? detalle.jornadas.map((jornada) => <div key={jornada.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-bold">{fecha(jornada.fecha)} · {jornada.grupo}</p><p className="text-xs text-muted-foreground">Evaluó {jornada.evaluadoPor}</p></div><span className="text-xs font-extrabold text-primary">{jornada.mediciones} mediciones</span></div>) : <p className="py-3 text-xs text-muted-foreground">La planilla todavía no fue confirmada.</p>}</div>
        </section>

        {(detalle.hallazgos.length > 0 || detalle.correcciones.length > 0) && <section className="rounded-3xl border border-border bg-card p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h2 className="text-sm font-extrabold">Trazabilidad</h2></div><div className="mt-3 space-y-3">{detalle.hallazgos.map((hallazgo) => <div key={hallazgo.id} className="rounded-2xl bg-muted/50 p-3"><p className="text-xs font-extrabold">{hallazgo.titulo ?? hallazgo.id}</p><p className="mt-1 text-xs text-muted-foreground">{hallazgo.detalle}</p></div>)}{detalle.correcciones.map((correccion, indice) => <div key={`${correccion.campo}-${indice}`} className="flex gap-3 rounded-2xl border border-border p-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-xs font-extrabold">{correccion.campo} corregido por {correccion.por}</p><p className="mt-1 text-xs text-muted-foreground">{correccion.motivo} · {fecha(correccion.cuando)}</p></div></div>)}</div></section>}
      </div>
    </GuardiaSecretaria>
  );
}
