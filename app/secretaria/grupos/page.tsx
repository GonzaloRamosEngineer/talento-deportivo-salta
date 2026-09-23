"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Filter, Users } from "lucide-react";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { ConfiguradorSecretaria, type ConfiguracionSecretaria } from "@/components/secretaria/configurador-secretaria";
import { Ayuda } from "@/components/ayuda";

export default function GruposSecretaria() {
  const [vista, setVista] = useState<"instituciones" | "grupos" | "disciplinas" | "deportistas">("instituciones");
  const [configuracion, setConfiguracion] = useState<ConfiguracionSecretaria | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const respuesta = await fetch("/api/secretaria/configuracion", { cache: "no-store" });
    const cuerpo = await respuesta.json();
    if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos cargar las instituciones y planteles.");
    setConfiguracion(cuerpo as ConfiguracionSecretaria);
    setError(null);
  }, []);

  useEffect(() => {
    const controlador = new AbortController();
    fetch("/api/secretaria/configuracion", { cache: "no-store", signal: controlador.signal })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json();
        if (!respuesta.ok) throw new Error(cuerpo.error ?? "No pudimos cargar las instituciones y planteles.");
        return cuerpo as ConfiguracionSecretaria;
      })
      .then(setConfiguracion)
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === "AbortError") return;
        setError(causa instanceof Error ? causa.message : "No pudimos cargar la configuración.");
      });
    return () => controlador.abort();
  }, []);

  const totales = useMemo(() => {
    const disciplinas = new Set<string>();
    let grupos = 0;
    let deportistas = 0;
    for (const institucion of configuracion?.arbol ?? []) for (const disciplina of institucion.disciplinas) {
      disciplinas.add(disciplina.id);
      grupos += disciplina.grupos.length;
      deportistas += disciplina.grupos.reduce((total, grupo) => total + grupo.deportistas, 0);
    }
    return { disciplinas: disciplinas.size, grupos, deportistas };
  }, [configuracion]);

  if (error && !configuracion) return <AvisoAcceso titulo="No pudimos cargar la organización" detalle={error} accionHref="/secretaria/grupos" accionLabel="Reintentar" />;
  if (!configuracion) return <CargandoPelota texto="Cargando instituciones y planteles…" />;

  return (
    <GuardiaSecretaria>
      <div className="flex flex-col gap-4 sm:gap-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Organización operativa</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Instituciones y planteles</h1>
          <p className="mt-1 text-sm text-muted-foreground">Organizá dónde y a quiénes medir.</p>
        </div>

        <Ayuda titulo="¿Cómo se organiza?" bullets={[
          "Cada institución reúne disciplinas; cada disciplina contiene sus grupos o planteles.",
          "Elegí los indicadores para ver solo instituciones, grupos, disciplinas o deportistas.",
          "Desde acá podés agregar y organizar los planteles que después vas a seleccionar al medir.",
        ]} />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {[
            [Building2, configuracion.arbol.length, "instituciones"],
            [Users, totales.grupos, "grupos"],
            [Filter, totales.disciplinas, "disciplinas"],
            [Users, totales.deportistas, "deportistas"],
          ].map(([Icono, valor, etiqueta]) => {
            const Icon = Icono as typeof Users;
            return <button type="button" aria-pressed={vista === etiqueta} onClick={() => setVista(etiqueta as typeof vista)} key={String(etiqueta)} className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors sm:rounded-2xl sm:p-4 ${vista === etiqueta ? "border-primary bg-secondary" : "border-border bg-card"}`}><Icon className="size-4 shrink-0 text-primary" /><p className="shrink-0 text-base font-extrabold sm:text-2xl">{String(valor)}</p><p className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">{String(etiqueta)}</p></button>;
          })}
        </div>

        {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
        <ConfiguradorSecretaria inicial={configuracion} recargar={cargar} vista={vista} />
      </div>
    </GuardiaSecretaria>
  );
}
