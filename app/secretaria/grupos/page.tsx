"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { GuardiaSecretaria } from "@/components/secretaria/guardia-secretaria";
import { CargandoPelota } from "@/components/cargando-pelota";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { ConfiguradorSecretaria, type ConfiguracionSecretaria, type VistaConfiguracion } from "@/components/secretaria/configurador-secretaria";
import { Ayuda } from "@/components/ayuda";

export default function GruposSecretaria() {
  const [vista, setVista] = useState<VistaConfiguracion>("instituciones");
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
          <p className="hidden text-xs font-extrabold uppercase tracking-[0.16em] text-primary sm:block">Organización operativa</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:mt-1">Instituciones y planteles</h1>
          <p className="mt-1 text-sm text-muted-foreground">Organizá dónde y a quiénes medir.</p>
        </div>

        <Ayuda titulo="¿Cómo se organiza?" bullets={[
          "Cada institución reúne disciplinas; cada disciplina contiene sus grupos o planteles.",
          "Las pestañas cambian la lista: instituciones, planteles, disciplinas o deportistas. El buscador filtra la que estás viendo.",
          "Desde acá podés agregar y organizar los planteles que después vas a seleccionar al medir.",
        ]} />

        {/* Antes eran 4 cajas con números que, sin decirlo, cambiaban la lista.
            Son pestañas: se ven y se anuncian como tales. */}
        <div role="tablist" aria-label="Qué ver" className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-card p-1 sm:grid-cols-4">
          {([
            ["instituciones", configuracion.arbol.length, "Instituciones"],
            ["grupos", totales.grupos, "Planteles"],
            ["disciplinas", totales.disciplinas, "Disciplinas"],
            ["deportistas", totales.deportistas, "Deportistas"],
          ] as const).map(([valor, cantidad, etiqueta]) => {
            const activa = vista === valor;
            return (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => setVista(valor)}
                className={cn("flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 transition-colors", activa ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted")}
              >
                <span className="text-base font-extrabold tabular-nums">{cantidad}</span>
                <span className={cn("text-xs font-bold", !activa && "text-muted-foreground")}>{etiqueta}</span>
              </button>
            );
          })}
        </div>

        {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
        <ConfiguradorSecretaria key={vista} inicial={configuracion} recargar={cargar} vista={vista} />
      </div>
    </GuardiaSecretaria>
  );
}
