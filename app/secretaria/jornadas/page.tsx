"use client";

import Link from "next/link";
import { CalendarCheck2, ChevronRight, FileSpreadsheet, Search } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { EstadoJornada } from "@/components/secretaria/estado-jornada";
import { GRUPOS_SECRETARIA } from "@/lib/secretaria-demo";
import { useSecretaria } from "@/lib/use-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";

export default function JornadasSecretaria() {
  const { resumen, cargando, error, real } = useSecretaria();
  if (cargando) return <CargandoPelota texto="Cargando jornadas…" />;
  if (error) return <AvisoAcceso titulo="No pudimos cargar las jornadas" detalle={error} accionHref="/secretaria/jornadas" accionLabel="Reintentar" />;
  const jornadas = real && resumen
    ? resumen.lotes.map((lote) => ({
        id: lote.id,
        institucion: lote.contexto.institucionOrigen,
        disciplina: lote.contexto.disciplina,
        grupo: lote.contexto.grupo,
        archivo: lote.nombre_archivo,
        estado: lote.estado === "importado" ? "lista" as const : lote.bloqueos_pendientes > 0 ? "revisar" as const : "recibida" as const,
      }))
    : GRUPOS_SECRETARIA;
  const porDecidir = jornadas.filter((item) => item.estado === "revisar").length;
  const pendientes = jornadas.filter((item) => item.estado === "recibida").length;
  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Espacio Secretaría</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Jornadas</h1>
            <p className="mt-1 text-sm text-muted-foreground">Cada planilla se convierte en una jornada trazable.</p>
          </div>
          <Link href="/evaluaciones/importar" className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-extrabold text-primary-foreground">
            <FileSpreadsheet className="size-4" aria-hidden />
            Importar
          </Link>
        </div>

        <div className="flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-3 text-muted-foreground">
          <Search className="size-4" aria-hidden />
          <input aria-label="Buscar jornadas" placeholder="Buscar institución, grupo o disciplina" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border bg-card p-3.5"><p className="text-2xl font-extrabold">{jornadas.length}</p><p className="text-[11px] font-semibold text-muted-foreground">recibidas</p></div>
          <div className="rounded-2xl border border-border bg-card p-3.5"><p className="text-2xl font-extrabold text-destructive">{porDecidir}</p><p className="text-[11px] font-semibold text-muted-foreground">por decidir</p></div>
          <div className="rounded-2xl border border-border bg-card p-3.5"><p className="text-2xl font-extrabold text-warning">{pendientes}</p><p className="text-[11px] font-semibold text-muted-foreground">listas para confirmar</p></div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <CalendarCheck2 className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-extrabold">Planillas recibidas</h2>
          </div>
          <div className="divide-y divide-border">
            {jornadas.map((jornada) => (
              <div key={jornada.id} className="flex items-center gap-3 px-5 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-xs font-extrabold text-primary">{jornada.disciplina.slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{jornada.institucion} · {jornada.grupo}</p>
                  <p className="truncate text-xs text-muted-foreground">{jornada.disciplina} · {jornada.archivo}</p>
                  <div className="mt-2"><EstadoJornada estado={jornada.estado} /></div>
                </div>
                {jornada.estado !== "lista" ? <Link href="/evaluaciones/importar" aria-label={`Revisar ${jornada.grupo}`} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-secondary"><ChevronRight className="size-4" aria-hidden /></Link> : <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />}
              </div>
            ))}
          </div>
        </section>
      </div>
    </GuardiaSecretaria>
  );
}
