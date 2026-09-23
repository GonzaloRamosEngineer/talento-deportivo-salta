"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardPlus, Search, Users } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { Ayuda } from "@/components/ayuda";

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
  const porPagina = 10;

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

  const instituciones = useMemo(() => [...new Set((deportistas ?? []).map((item) => item.institucion))].sort((a, b) => a.localeCompare(b, "es")), [deportistas]);
  const disciplinas = useMemo(() => [...new Set((deportistas ?? []).filter((item) => !institucion || item.institucion === institucion).map((item) => item.disciplina))].sort((a, b) => a.localeCompare(b, "es")), [deportistas, institucion]);
  const grupos = useMemo(() => [...new Map((deportistas ?? []).map((item) => [item.grupoId, { id: item.grupoId, nombre: item.grupo, institucion: item.institucion, disciplina: item.disciplina }])).values()].sort((a, b) => `${a.institucion}-${a.disciplina}-${a.nombre}`.localeCompare(`${b.institucion}-${b.disciplina}-${b.nombre}`, "es")), [deportistas]);
  const visibles = (deportistas ?? []).filter((item) => {
    const texto = `${item.nombre} ${item.apellido ?? ""} ${item.grupo} ${item.institucion} ${item.disciplina}`.toLocaleLowerCase("es");
    return (!institucion || item.institucion === institucion)
      && (!disciplina || item.disciplina === disciplina)
      && (!grupoId || item.grupoId === grupoId)
      && texto.includes(busqueda.trim().toLocaleLowerCase("es"));
  });
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
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Seguimiento individual</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">Deportistas</h1><p className="mt-1 text-sm text-muted-foreground">Buscá una ficha o filtrá por plantel.</p></div><Link href="/secretaria/medir" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-extrabold text-primary-foreground"><ClipboardPlus className="size-4" /><span className="hidden min-[380px]:inline">Medir</span></Link></div>

        <Ayuda titulo="¿Qué puedo consultar?" bullets={[
          "Buscá por nombre o apellido, o combiná los filtros de institución, disciplina y plantel.",
          "Abrí una ficha para revisar las mediciones disponibles y la evolución individual.",
          "La cantidad de registros no reemplaza la comparación: revisá también fecha, métrica y protocolo.",
        ]} />

        <div className="grid grid-cols-2 gap-2 sm:gap-3"><div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 sm:rounded-2xl sm:p-4"><Users className="size-4 shrink-0 text-primary" /><p className="text-lg font-extrabold sm:text-2xl">{deportistas.length}</p><p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">deportistas</p></div><div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 sm:rounded-2xl sm:p-4"><p className="text-lg font-extrabold sm:text-2xl">{deportistas.reduce((total, item) => total + item.mediciones, 0)}</p><p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">mediciones</p></div></div>

        <section className="space-y-2 rounded-2xl border border-border bg-card p-3 sm:p-4 lg:flex lg:items-center lg:gap-3 lg:space-y-0">
          <label className="flex h-10 min-w-56 items-center gap-2 rounded-xl border border-input bg-background px-3 lg:max-w-sm lg:flex-1"><Search className="size-4 shrink-0 text-muted-foreground" /><input value={busqueda} onChange={(evento) => { setBusqueda(evento.target.value); setPagina(1); }} placeholder="Buscar por nombre o apellido" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-0 lg:flex-1"><select aria-label="Filtrar por institución" value={institucion} onChange={(evento) => cambiarInstitucion(evento.target.value)} className="h-10 min-w-0 rounded-xl border border-input bg-background px-2 text-xs font-semibold lg:flex-1"><option value="">Todas las instituciones</option>{instituciones.map((item) => <option key={item} value={item}>{item}</option>)}</select><select aria-label="Filtrar por disciplina" value={disciplina} onChange={(evento) => cambiarDisciplina(evento.target.value)} className="h-10 min-w-0 rounded-xl border border-input bg-background px-2 text-xs font-semibold lg:flex-1"><option value="">Todas las disciplinas</option>{disciplinas.map((item) => <option key={item} value={item}>{item}</option>)}</select><select aria-label="Filtrar por plantel" value={grupoId} onChange={(evento) => cambiarGrupo(evento.target.value)} className="col-span-2 h-10 min-w-0 rounded-xl border border-input bg-background px-2 text-xs font-semibold sm:col-span-2 lg:flex-[1.4]"><option value="">Todos los planteles</option>{grupos.filter((grupo) => (!institucion || grupo.institucion === institucion) && (!disciplina || grupo.disciplina === disciplina)).map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.institucion} · {grupo.disciplina} · {grupo.nombre}</option>)}</select></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-5"><div><h2 className="text-sm font-extrabold">Plantel</h2><p className="hidden text-[11px] text-muted-foreground lg:block">Abrí una ficha para consultar las mediciones y su evolución.</p></div><p className="text-xs text-muted-foreground">{visibles.length === 0 ? "0 resultados" : `${inicio + 1}–${Math.min(inicio + porPagina, visibles.length)} de ${visibles.length}`}</p></div><div className="divide-y divide-border">{paginaVisible.map((deportista) => <Link key={deportista.id} href={`/secretaria/deportistas/${deportista.id}`} className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/35 sm:px-5 sm:py-4 lg:py-2.5"><AvatarIniciales nombre={deportista.nombre} apellido={deportista.apellido} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{nombreVisible(deportista)}</span><span className="block truncate text-xs text-muted-foreground">{deportista.institucion} · {deportista.disciplina} · {deportista.grupo}</span></span><span className="text-right"><span className="block text-sm font-extrabold text-primary">{deportista.mediciones}</span><span className="text-[10px] text-muted-foreground">mediciones</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}{paginaVisible.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">No encontramos deportistas con esos filtros.</p>}</div><div className="flex items-center justify-between border-t border-border px-3 py-2"><button type="button" disabled={paginaActual <= 1} onClick={() => setPagina((actual) => Math.max(1, actual - 1))} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary disabled:opacity-40"><ChevronLeft className="size-4" />Anterior</button><span className="text-xs font-semibold text-muted-foreground">Página {paginaActual} de {totalPaginas}</span><button type="button" disabled={paginaActual >= totalPaginas} onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary disabled:opacity-40">Siguiente<ChevronRight className="size-4" /></button></div></section>
      </div>
    </GuardiaSecretaria>
  );
}
