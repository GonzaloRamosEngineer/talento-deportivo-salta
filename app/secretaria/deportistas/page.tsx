"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardPlus, X } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { Ayuda } from "@/components/ayuda";
import { CampoBusqueda } from "@/components/secretaria/campo-busqueda";
import { PRESIONABLE } from "@/components/secretaria/presionable";
import { paraBuscar } from "@/lib/utils";

interface DeportistaSecretaria {
  id: string;
  nombre: string;
  apellido: string | null;
  fechaNacimiento: string | null;
  grupoId: string;
  grupo: string;
  institucion: string;
  disciplina: string;
  mediciones: number;
}

function nombreVisible(deportista: Pick<DeportistaSecretaria, "nombre" | "apellido">) {
  return deportista.apellido?.trim()
    ? `${deportista.apellido}, ${deportista.nombre}`
    : deportista.nombre;
}

export default function DeportistasSecretaria() {
  const [deportistas, setDeportistas] = useState<DeportistaSecretaria[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [institucion, setInstitucion] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 20;

  useEffect(() => {
    const controlador = new AbortController();
    fetch("/api/secretaria/deportistas", { signal: controlador.signal })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos cargar los deportistas.");
        return cuerpo as DeportistaSecretaria[];
      })
      .then((datos) => {
        setDeportistas(datos);
        setGrupoId(new URLSearchParams(window.location.search).get("grupo") ?? "");
      })
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === "AbortError") return;
        setError(causa instanceof Error ? causa.message : "No pudimos cargar los deportistas.");
      });
    return () => controlador.abort();
  }, []);

  const instituciones = [...new Set((deportistas ?? []).map((item) => item.institucion))].sort((a, b) => a.localeCompare(b, "es"));
  const disciplinas = [...new Set((deportistas ?? []).filter((item) => !institucion || item.institucion === institucion).map((item) => item.disciplina))].sort((a, b) => a.localeCompare(b, "es"));
  const grupos = [...new Map((deportistas ?? []).map((item) => [item.grupoId, { id: item.grupoId, nombre: item.grupo, institucion: item.institucion, disciplina: item.disciplina }])).values()].sort((a, b) => `${a.institucion}-${a.disciplina}-${a.nombre}`.localeCompare(`${b.institucion}-${b.disciplina}-${b.nombre}`, "es"));
  const grupoElegido = grupos.find((grupo) => grupo.id === grupoId) ?? null;
  const termino = paraBuscar(busqueda);
  const visibles = (deportistas ?? []).filter((item) =>
    (!institucion || item.institucion === institucion)
    && (!disciplina || item.disciplina === disciplina)
    && (!grupoId || item.grupoId === grupoId)
    && (!termino || paraBuscar(`${item.nombre} ${item.apellido ?? ""} ${item.grupo} ${item.institucion} ${item.disciplina}`).includes(termino)));
  const hayFiltros = Boolean(institucion || disciplina || grupoId || termino);
  const limpiar = () => { setBusqueda(""); setInstitucion(""); setDisciplina(""); setGrupoId(""); setPagina(1); };
  const filtro = "h-11 min-w-0 rounded-xl border border-input bg-background px-2 text-base font-semibold sm:text-sm";
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = visibles.length === 0 ? 0 : (paginaActual - 1) * porPagina;
  const paginaVisible = visibles.slice(inicio, inicio + porPagina);
  const cambiarInstitucion = (valor: string) => { setInstitucion(valor); setDisciplina(""); setGrupoId(""); setPagina(1); };
  const cambiarDisciplina = (valor: string) => { setDisciplina(valor); setGrupoId(""); setPagina(1); };
  const cambiarGrupo = (valor: string) => { setGrupoId(valor); setPagina(1); };

  if (error) return <AvisoAcceso titulo="No pudimos cargar los deportistas" detalle={error} accionHref="/secretaria/deportistas" accionLabel="Reintentar" />;
  if (!deportistas) return <CargandoPelota texto="Cargando deportistas…" />;

  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-4 sm:gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="hidden text-xs font-extrabold uppercase tracking-[0.16em] text-primary sm:block">Seguimiento individual</p>
            <h1 className="text-2xl font-extrabold tracking-tight sm:mt-1">Deportistas</h1>
            <p className="mt-1 text-sm text-muted-foreground">{`${deportistas.length} fichas · ${deportistas.reduce((total, item) => total + item.mediciones, 0).toLocaleString("es-AR")} mediciones`}</p>
          </div>
          <Link href={grupoElegido ? `/secretaria/medir?grupo=${grupoElegido.id}` : "/secretaria/medir"} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-sm hover:bg-primary/90 ${PRESIONABLE}`}><ClipboardPlus className="size-4" aria-hidden />{grupoElegido ? "Medir plantel" : "Medir"}</Link>
        </div>

        <Ayuda titulo="¿Qué puedo consultar?" bullets={[
          "Buscá por nombre o apellido, o combiná los filtros de institución, disciplina y plantel.",
          "Abrí una ficha para ver los registros de cada métrica y, cuando hay más de una fecha, su curva.",
          "La cantidad de registros no reemplaza la comparación: revisá también fecha, métrica y protocolo.",
        ]} />

        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:p-4">
          <CampoBusqueda valor={busqueda} onCambio={(valor) => { setBusqueda(valor); setPagina(1); }} etiqueta="Buscar deportistas" placeholder="Buscar nombre, apellido o plantel" />
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_1fr_1.4fr]">
            <select aria-label="Filtrar por institución" value={institucion} onChange={(evento) => cambiarInstitucion(evento.target.value)} className={filtro}><option value="">Todas las instituciones</option>{instituciones.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select aria-label="Filtrar por disciplina" value={disciplina} onChange={(evento) => cambiarDisciplina(evento.target.value)} className={filtro}><option value="">Todas las disciplinas</option>{disciplinas.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select aria-label="Filtrar por plantel" value={grupoId} onChange={(evento) => cambiarGrupo(evento.target.value)} className={`${filtro} col-span-2 lg:col-span-1`}><option value="">Todos los planteles</option>{grupos.filter((grupo) => (!institucion || grupo.institucion === institucion) && (!disciplina || grupo.disciplina === disciplina)).map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.institucion} · {grupo.disciplina} · {grupo.nombre}</option>)}</select>
          </div>
          {grupoElegido && (
            // Llegando desde "Planteles" el filtro venía puesto pero escondido
            // en el desplegable: se ve y se saca con un toque.
            <button type="button" onClick={() => cambiarGrupo("")} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-secondary px-3 text-xs font-bold text-primary sm:min-h-8">
              {`Plantel: ${grupoElegido.nombre} · ${grupoElegido.institucion}`}<X className="size-3.5" aria-label="Quitar filtro" />
            </button>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-5">
            <h2 className="text-sm font-extrabold">{hayFiltros ? `${visibles.length} de ${deportistas.length}` : "Todas las fichas"}</h2>
            <p className="text-xs text-muted-foreground">{visibles.length === 0 ? "Sin resultados" : `${inicio + 1}–${Math.min(inicio + porPagina, visibles.length)} de ${visibles.length}`}</p>
          </div>
          <div className="divide-y divide-border">
            {paginaVisible.map((deportista) => <Link key={deportista.id} href={`/secretaria/deportistas/${deportista.id}`} className="flex min-h-16 items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/35 active:bg-muted/60 sm:px-5 lg:py-2.5">
              <AvatarIniciales nombre={deportista.nombre} apellido={deportista.apellido} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">{nombreVisible(deportista)}</span>
                <span className="block text-xs text-muted-foreground">{`${deportista.grupo} · ${deportista.institucion} · ${deportista.disciplina}`}</span>
              </span>
              <span className="shrink-0 text-right"><span className="block text-sm font-extrabold tabular-nums text-primary">{deportista.mediciones}</span><span className="text-[11px] text-muted-foreground">{deportista.mediciones === 1 ? "registro" : "registros"}</span></span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>)}
            {paginaVisible.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                <p className="text-sm font-bold">No encontramos deportistas con esos filtros</p>
                {hayFiltros && <button type="button" onClick={limpiar} className="min-h-11 text-xs font-extrabold text-primary">Limpiar filtros</button>}
              </div>
            )}
          </div>
          {totalPaginas > 1 && <div className="flex items-center justify-between border-t border-border px-2 py-1"><button type="button" disabled={paginaActual <= 1} onClick={() => setPagina((actual) => Math.max(1, actual - 1))} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-bold text-primary disabled:opacity-40"><ChevronLeft className="size-4" aria-hidden />Anterior</button><span className="text-xs font-semibold text-muted-foreground">{`Página ${paginaActual} de ${totalPaginas}`}</span><button type="button" disabled={paginaActual >= totalPaginas} onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-bold text-primary disabled:opacity-40">Siguiente<ChevronRight className="size-4" aria-hidden /></button></div>}
        </section>
      </div>
    </GuardiaSecretaria>
  );
}
