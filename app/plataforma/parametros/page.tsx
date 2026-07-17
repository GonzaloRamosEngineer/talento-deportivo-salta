"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Ruler,
  ShieldAlert,
  Sprout,
} from "lucide-react";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { usePerfil } from "@/components/perfil-context";
import { PARAMETROS_CRECIMIENTO_DEFAULT } from "@/lib/crecimiento";
import {
  guardarParametros,
  leerParametros,
  type ParametrosPlataforma,
} from "@/app/plataforma/actions";

import { CargandoPelota } from "@/components/cargando-pelota";

// Parámetros GLOBALES del Módulo D (el estirón), curados centralmente
// como el catálogo de atributos: los setea la plataforma, los leen
// todos los clubes. La escritura real pasa por la server action
// (service role + gate app_metadata.plataforma); esta pantalla solo
// corta la vista por perfil.

// Los inputs se editan como texto (coma decimal AR) y se parsean al guardar.
interface FormParametros {
  umbralM: string;
  umbralF: string;
  minDias: string;
}

function aNumero(s: string): number {
  return Number(s.replace(",", "."));
}

export default function ParametrosPlataforma() {
  const { perfil, sesionReal } = usePerfil();
  const [datos, setDatos] = useState<ParametrosPlataforma | null>(null);
  const [form, setForm] = useState<FormParametros | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [version, setVersion] = useState(0);
  const esPlataformaReal = sesionReal && perfil === "super_admin";

  useEffect(() => {
    if (!esPlataformaReal) return;
    let cancelado = false;
    leerParametros().then((r) => {
      if (cancelado) return;
      if (r.ok) {
        setDatos(r.data);
        setForm({
          umbralM: r.data.umbralM.toLocaleString("es-AR"),
          umbralF: r.data.umbralF.toLocaleString("es-AR"),
          minDias: String(r.data.minDias),
        });
      } else setError(r.error);
    });
    return () => {
      cancelado = true;
    };
  }, [esPlataformaReal, version]);

  if (perfil !== "super_admin") {
    return (
      <AvisoAcceso
        titulo="Solo para la plataforma"
        detalle="Los parámetros de crecimiento son de la operación provincial: aplican a todos los clubes por igual."
        accionHref="/panel"
        accionLabel="Volver al inicio"
      />
    );
  }
  if (!esPlataformaReal) {
    return (
      <AvisoAcceso
        titulo="Requiere la sesión real de plataforma"
        detalle="Esta pantalla escribe parámetros globales. En la demo pública es de solo lectura: ingresá con la cuenta de plataforma."
        accionHref="/login"
        accionLabel="Ingresar"
      />
    );
  }

  const guardar = async () => {
    if (!form) return;
    setGuardando(true);
    setError("");
    setAviso("");
    const r = await guardarParametros({
      umbralM: aNumero(form.umbralM),
      umbralF: aNumero(form.umbralF),
      minDias: Number(form.minDias),
    });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAviso("Parámetros actualizados para toda la plataforma.");
    setVersion((v) => v + 1);
  };

  const campos: {
    clave: keyof FormParametros;
    label: string;
    unidad: string;
    ayuda: string;
    defecto: string;
  }[] = [
    {
      clave: "umbralM",
      label: "Umbral de aceleración · varones",
      unidad: "cm/año",
      ayuda:
        "Ritmo de crecimiento en talla a partir del cual un deportista aparece 'en crecimiento acelerado'. El pico puberal masculino suele rondar 8-10 cm/año.",
      defecto: PARAMETROS_CRECIMIENTO_DEFAULT.umbralM.toLocaleString("es-AR"),
    },
    {
      clave: "umbralF",
      label: "Umbral de aceleración · mujeres",
      unidad: "cm/año",
      ayuda:
        "El pico puberal femenino es más temprano y algo menor (suele rondar 7-8 cm/año), por eso el umbral separado.",
      defecto: PARAMETROS_CRECIMIENTO_DEFAULT.umbralF.toLocaleString("es-AR"),
    },
    {
      clave: "minDias",
      label: "Separación mínima entre mediciones de un tramo",
      unidad: "días",
      ayuda:
        "El ritmo se calcula entre mediciones separadas al menos esta cantidad de días. Con tramos más cortos, el error normal del tallímetro (±0,5 cm) anualizado inventa ritmos absurdos.",
      defecto: String(PARAMETROS_CRECIMIENTO_DEFAULT.minDiasTramo),
    },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <Sprout className="size-5 text-success" aria-hidden />
          Parámetros de crecimiento
        </h1>
        <p className="text-sm text-muted-foreground">
          Definen cómo el módulo &ldquo;El estirón&rdquo; interpreta las series
          de talla en todos los clubes.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl bg-warning-soft p-3.5 text-sm text-warning">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="font-semibold">
          Cambio con impacto global.{" "}
          <span className="font-normal">
            Estos valores rigen para TODOS los clubes de la plataforma: mover un
            umbral cambia qué deportistas aparecen marcados &ldquo;en
            crecimiento acelerado&rdquo; en fichas, curvas e informes de toda la
            provincia. Ajustalos solo con criterio profesional documentado.
          </span>
        </p>
      </div>

      {!datos && !error && (
        <CargandoPelota texto="Cargando parámetros…" />
      )}

      {form && datos && (
        <section className="rounded-2xl border border-border bg-card">
          {campos.map((c) => (
            <div key={c.clave} className="border-b border-border p-4 last:border-0">
              <label
                htmlFor={c.clave}
                className="flex items-center gap-1.5 text-sm font-bold"
              >
                <Ruler className="size-3.5 text-muted-foreground" aria-hidden />
                {c.label}
              </label>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {c.ayuda}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id={c.clave}
                  inputMode="decimal"
                  value={form[c.clave]}
                  onChange={(e) =>
                    setForm({ ...form, [c.clave]: e.target.value })
                  }
                  className="h-11 w-28 rounded-xl border border-border bg-background px-3 text-base font-extrabold tabular-nums outline-none focus:border-primary"
                />
                <span className="text-sm font-semibold text-muted-foreground">
                  {c.unidad}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  base: {c.defecto}
                </span>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 p-4">
            <button
              onClick={() => void guardar()}
              disabled={guardando}
              className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
            >
              {guardando ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              Guardar para toda la plataforma
            </button>
            {datos.actualizadoEn && (
              <p className="text-[11px] text-muted-foreground">
                Última actualización:{" "}
                {new Date(datos.actualizadoEn).toLocaleDateString("es-AR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {datos.actualizadoPor ? ` · ${datos.actualizadoPor}` : ""}
              </p>
            )}
          </div>
        </section>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}
      {aviso && (
        <div className="flex items-start gap-2.5 rounded-xl bg-success-soft p-3 text-xs font-semibold text-success">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{aviso}</p>
        </div>
      )}

      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        Los valores base salen de referencias generales de crecimiento y están
        pendientes de revisión del preparador físico de la Fundación. El módulo
        siempre presenta el ritmo como registro observado — nunca como
        diagnóstico.
      </p>
    </div>
  );
}
