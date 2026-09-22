"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ClipboardPlus, Search, Users } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { cn } from "@/lib/utils";

interface DeportistaSecretaria {
  id: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string | null;
  grupoId: string;
  grupo: string;
  institucion: string;
  disciplina: string;
  mediciones: number;
}

export default function DeportistasSecretaria() {
  const [deportistas, setDeportistas] = useState<DeportistaSecretaria[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [institucion, setInstitucion] = useState("");
  const [disciplina, setDisciplina] = useState("");

  useEffect(() => {
    const controlador = new AbortController();
    fetch("/api/secretaria/deportistas", { signal: controlador.signal })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos cargar los deportistas.");
        return cuerpo as DeportistaSecretaria[];
      })
      .then(setDeportistas)
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === "AbortError") return;
        setError(causa instanceof Error ? causa.message : "No pudimos cargar los deportistas.");
      });
    return () => controlador.abort();
  }, []);

  const instituciones = useMemo(() => [...new Set((deportistas ?? []).map((item) => item.institucion))].sort((a, b) => a.localeCompare(b, "es")), [deportistas]);
  const disciplinas = useMemo(() => [...new Set((deportistas ?? []).filter((item) => !institucion || item.institucion === institucion).map((item) => item.disciplina))].sort((a, b) => a.localeCompare(b, "es")), [deportistas, institucion]);
  const visibles = (deportistas ?? []).filter((item) => {
    const texto = `${item.nombre} ${item.apellido} ${item.grupo} ${item.institucion} ${item.disciplina}`.toLocaleLowerCase("es");
    return (!institucion || item.institucion === institucion)
      && (!disciplina || item.disciplina === disciplina)
      && texto.includes(busqueda.trim().toLocaleLowerCase("es"));
  });

  if (error) return <AvisoAcceso titulo="No pudimos cargar los deportistas" detalle={error} accionHref="/secretaria/deportistas" accionLabel="Reintentar" />;
  if (!deportistas) return <CargandoPelota texto="Cargando deportistas…" />;

  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Seguimiento individual</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">Deportistas</h1><p className="mt-1 text-sm text-muted-foreground">Ficha y evolución de quienes fueron evaluados por la Secretaría.</p></div><Link href="/secretaria/medir" className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-extrabold text-primary-foreground"><ClipboardPlus className="size-4" />Medir</Link></div>

        <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-border bg-card p-4"><Users className="size-4 text-primary" /><p className="mt-2 text-2xl font-extrabold">{deportistas.length}</p><p className="text-xs text-muted-foreground">deportistas evaluados</p></div><div className="rounded-2xl border border-border bg-card p-4"><p className="text-2xl font-extrabold">{deportistas.reduce((total, item) => total + item.mediciones, 0)}</p><p className="mt-6 text-xs text-muted-foreground">mediciones registradas</p></div></div>

        <div className="flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-3"><Search className="size-4 text-muted-foreground" /><input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar deportista, grupo o institución" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>

        <section><p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Institución</p><div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => { setInstitucion(""); setDisciplina(""); }} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold", !institucion ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>Todas</button>{instituciones.map((item) => <button key={item} onClick={() => { setInstitucion(item); setDisciplina(""); }} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold", institucion === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{item}</button>)}</div></section>
        <section><p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Disciplina</p><div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => setDisciplina("")} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold", !disciplina ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>Todas</button>{disciplinas.map((item) => <button key={item} onClick={() => setDisciplina(item)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold", disciplina === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>{item}</button>)}</div></section>

        <section className="overflow-hidden rounded-3xl border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="text-sm font-extrabold">{visibles.length} deportistas</h2></div><div className="divide-y divide-border">{visibles.map((deportista) => <Link key={deportista.id} href={`/secretaria/deportistas/${deportista.id}`} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/35"><AvatarIniciales nombre={deportista.nombre} apellido={deportista.apellido} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{deportista.apellido}, {deportista.nombre}</span><span className="block truncate text-xs text-muted-foreground">{deportista.institucion} · {deportista.disciplina} · {deportista.grupo}</span></span><span className="text-right"><span className="block text-sm font-extrabold text-primary">{deportista.mediciones}</span><span className="text-[10px] text-muted-foreground">mediciones</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}{visibles.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">No encontramos deportistas con esos filtros.</p>}</div></section>
      </div>
    </GuardiaSecretaria>
  );
}
