"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Inbox,
  Loader2,
  MessageSquareText,
  ShieldAlert,
  X,
} from "lucide-react";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { EstadoVacio } from "@/components/estado-vacio";
import { usePerfil } from "@/components/perfil-context";
import { formatFecha } from "@/lib/mock-data";
import {
  listarSugerencias,
  resolverSugerencia,
  type SugerenciaPlataforma,
} from "@/app/plataforma/actions";
import { cn } from "@/lib/utils";

import { CargandoPelota } from "@/components/cargando-pelota";

// Bandeja de curaduría (sesión C): las sugerencias del staff de los
// clubes sobre las guías del catálogo. Aceptar/rechazar registra la
// decisión y se la muestra al autor; si se acepta, el contenido se
// actualiza aparte en el catálogo central (guías de lib/como-medir.ts).

const TIPO_LABEL = { agregar: "Agregar", modificar: "Modificar", eliminar: "Sacar" };

function CardSugerencia({
  s,
  onResuelta,
}: {
  s: SugerenciaPlataforma;
  onResuelta: () => void;
}) {
  const [respuesta, setRespuesta] = useState("");
  const [resolviendo, setResolviendo] = useState<"aceptada" | "rechazada" | null>(null);
  const [error, setError] = useState("");
  const pendiente = s.estado === "pendiente";

  const resolver = async (estado: "aceptada" | "rechazada") => {
    setResolviendo(estado);
    setError("");
    const r = await resolverSugerencia({ id: s.id, estado, respuesta });
    setResolviendo(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onResuelta();
  };

  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
          {s.guia}
        </span>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          {TIPO_LABEL[s.tipo]}
        </span>
        {!pendiente && (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              s.estado === "aceptada"
                ? "bg-success-soft text-success"
                : "bg-muted text-muted-foreground",
            )}
          >
            {s.estado === "aceptada" ? "Aceptada" : "No incorporada"}
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {formatFecha(s.creadoEn.slice(0, 10))}
        </span>
      </div>
      <p className="text-sm leading-relaxed">{s.texto}</p>
      <p className="text-xs text-muted-foreground">
        {s.autor}
        {s.funcion ? ` · ${s.funcion}` : ""} — {s.club}
      </p>
      {s.respuesta && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-snug text-muted-foreground">
          <span className="font-bold">Respuesta:</span> {s.respuesta}
        </p>
      )}
      {pendiente && (
        <>
          <input
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            maxLength={1000}
            placeholder="Respuesta para quien la mandó (opcional)"
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
          />
          {error && <p className="text-xs font-semibold text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => void resolver("aceptada")}
              disabled={resolviendo !== null}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {resolviendo === "aceptada" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              Aceptar
            </button>
            <button
              onClick={() => void resolver("rechazada")}
              disabled={resolviendo !== null}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              {resolviendo === "rechazada" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <X className="size-4" aria-hidden />
              )}
              No incorporar
            </button>
          </div>
        </>
      )}
    </li>
  );
}

export default function SugerenciasPlataforma() {
  const { perfil, sesionReal } = usePerfil();
  const [sugerencias, setSugerencias] = useState<SugerenciaPlataforma[] | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  const esPlataformaReal = sesionReal && perfil === "super_admin";

  useEffect(() => {
    if (!esPlataformaReal) return;
    let cancelado = false;
    listarSugerencias().then((r) => {
      if (cancelado) return;
      if (r.ok) setSugerencias(r.data);
      else setError(r.error);
    });
    return () => {
      cancelado = true;
    };
  }, [esPlataformaReal, version]);

  if (perfil !== "super_admin") {
    return (
      <AvisoAcceso
        titulo="Solo para la plataforma"
        detalle="La curaduría de las guías del catálogo es de la operación provincial."
        accionHref="/panel"
        accionLabel="Volver al inicio"
      />
    );
  }
  if (!esPlataformaReal) {
    return (
      <AvisoAcceso
        titulo="Requiere la sesión real de plataforma"
        detalle="Acá se resuelven las sugerencias de los clubes sobre las guías. Ingresá con la cuenta de plataforma."
        accionHref="/login"
        accionLabel="Ingresar"
      />
    );
  }

  const pendientes = (sugerencias ?? []).filter((s) => s.estado === "pendiente");
  const resueltas = (sugerencias ?? []).filter((s) => s.estado !== "pendiente");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <MessageSquareText className="size-5 text-primary" aria-hidden />
          Sugerencias de los clubes
        </h1>
        <p className="text-sm text-muted-foreground">
          Propuestas del staff sobre las guías del catálogo.
          {pendientes.length > 0 && ` ${pendientes.length} sin resolver.`}
        </p>
      </div>

      <p className="rounded-xl bg-muted px-3.5 py-2.5 text-[11px] leading-snug text-muted-foreground">
        Aceptar o rechazar registra la decisión y se la muestra a quien la
        mandó. Si aceptás, el contenido de la guía se actualiza aparte, en la
        curaduría central del catálogo — idealmente con el visto del PF.
      </p>

      {!sugerencias && !error && (
        <CargandoPelota texto="Cargando sugerencias…" />
      )}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {sugerencias && sugerencias.length === 0 && (
        <EstadoVacio
          icono={Inbox}
          titulo="Sin sugerencias todavía"
          detalle="Cuando el staff de un club proponga un cambio desde la guía '¿Cómo medir?' de una habilidad, aparece acá para que lo resuelvas."
        />
      )}

      {pendientes.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {pendientes.map((s) => (
            <CardSugerencia key={s.id} s={s} onResuelta={recargar} />
          ))}
        </ul>
      )}

      {resueltas.length > 0 && (
        <>
          <h2 className="mt-2 text-sm font-extrabold text-muted-foreground">
            Resueltas
          </h2>
          <ul className="flex flex-col gap-2.5">
            {resueltas.slice(0, 20).map((s) => (
              <CardSugerencia key={s.id} s={s} onResuelta={recargar} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
