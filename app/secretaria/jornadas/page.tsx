"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck2, ChevronRight, FileSpreadsheet, Search } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { EstadoJornada } from "@/components/secretaria/estado-jornada";
import { GRUPOS_SECRETARIA } from "@/lib/secretaria-demo";
import { useSecretaria } from "@/lib/use-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";

export default function JornadasSecretaria() {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "revisar" | "lista">("todas");
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
  const termino = busqueda.trim().toLocaleLowerCase("es");
  const porTexto = termino
    ? jornadas.filter((jornada) =>
      [jornada.institucion, jornada.disciplina, jornada.grupo, jornada.archivo]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(termino),
    )
    : jornadas;
  const jornadasVisibles = porTexto.filter((jornada) => filtro === "todas" || (filtro === "revisar" ? jornada.estado === "revisar" : jornada.estado === "lista"));
  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Espacio Secretaría</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Planillas</h1>
            <p className="mt-1 text-sm text-muted-foreground">Tu repositorio de archivos recibidos, revisiones y jornadas generadas.</p>
          </div>
          <Link href="/evaluaciones/importar" className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-extrabold text-primary-foreground">
            <FileSpreadsheet className="size-4" aria-hidden />
            Importar
          </Link>
        </div>

        <div className="flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-3 text-muted-foreground">
          <Search className="size-4" aria-hidden />
          <input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} aria-label="Buscar planillas" placeholder="Buscar institución, grupo, disciplina o archivo" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground" />
        </div>

        <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border border-border bg-card text-center">
          <div className="px-2 py-3"><p className="text-xl font-extrabold">{jornadas.length}</p><p className="text-[10px] font-semibold text-muted-foreground">recibidas</p></div>
          <div className="px-2 py-3"><p className="text-xl font-extrabold text-destructive">{porDecidir}</p><p className="text-[10px] font-semibold text-muted-foreground">por revisar</p></div>
          <div className="px-2 py-3"><p className="text-xl font-extrabold text-primary">{jornadas.filter((item) => item.estado === "lista").length}</p><p className="text-[10px] font-semibold text-muted-foreground">importadas</p></div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {([['todas', `Todas · ${jornadas.length}`], ['revisar', `Revisar · ${porDecidir}`], ['lista', `Importadas · ${jornadas.filter((item) => item.estado === 'lista').length}`]] as const).map(([valor, etiqueta]) => <button key={valor} onClick={() => setFiltro(valor)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${filtro === valor ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>{etiqueta}</button>)}
        </div>

        <section className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <CalendarCheck2 className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-extrabold">Planillas recibidas</h2>
          </div>
          <div className="divide-y divide-border">
            {jornadasVisibles.map((jornada) => (
              <Link key={jornada.id} href={real ? `/secretaria/jornadas/${jornada.id}` : "/evaluaciones/importar"} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/35">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-[10px] font-extrabold text-primary">{jornada.disciplina.slice(0, 2).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{jornada.institucion} · {jornada.grupo}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{jornada.archivo}</p>
                </div>
                <EstadoJornada estado={jornada.estado} compacto />
                <ChevronRight className="size-4 shrink-0 text-primary" aria-hidden />
              </Link>
            ))}
            {jornadasVisibles.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No encontramos planillas con ese criterio.</p>
            )}
          </div>
        </section>
      </div>
    </GuardiaSecretaria>
  );
}
