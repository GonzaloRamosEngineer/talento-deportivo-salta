"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Clock,
  Loader2,
  MessageSquarePlus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { useClub } from "@/lib/use-club";
import { formatFecha } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

// Sugerencias del staff sobre una guía del catálogo (sesión C de
// negocio/10). El contenido sigue siendo curaduría central: acá el
// profe PROPONE (agregar/modificar/eliminar) y ve el estado de sus
// pedidos; la plataforma resuelve en su bandeja. Solo con sesión real
// y membresía — el visitante demo no ve esta sección.

const TIPOS = [
  { clave: "agregar", label: "Agregar algo" },
  { clave: "modificar", label: "Modificar" },
  { clave: "eliminar", label: "Sacar algo" },
] as const;

type Tipo = (typeof TIPOS)[number]["clave"];

interface Propia {
  id: string;
  tipo: Tipo;
  texto: string;
  estado: "pendiente" | "aceptada" | "rechazada";
  respuesta: string | null;
  creado_en: string;
}

const ESTADO_UI: Record<Propia["estado"], { label: string; clases: string }> = {
  pendiente: { label: "Pendiente", clases: "bg-muted text-muted-foreground" },
  aceptada: { label: "Aceptada", clases: "bg-success-soft text-success" },
  rechazada: { label: "No incorporada", clases: "bg-muted text-muted-foreground" },
};

export function SugerenciaGuia({ guia }: { guia: string }) {
  const { cargando, membresia } = useClub();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("modificar");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [propias, setPropias] = useState<Propia[]>([]);

  // patrón del repo: loader DENTRO del effect + contador para recargar
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!membresia) return;
    let cancelado = false;
    async function cargar() {
      const { data, error: e } = await crearClienteBrowser()
        .from("sugerencia")
        .select("id, tipo, texto, estado, respuesta, creado_en")
        .eq("guia", guia)
        .order("creado_en", { ascending: false });
      if (!cancelado && !e && data) setPropias(data as Propia[]);
    }
    void cargar();
    return () => {
      cancelado = true;
    };
  }, [membresia, guia, version]);

  // Sin sesión real con membresía (demo pública, plataforma) no hay circuito.
  if (cargando || !membresia) return null;

  const enviar = async () => {
    const limpio = texto.trim();
    if (limpio.length < 10) {
      setError("Contanos un poco más (mínimo 10 caracteres).");
      return;
    }
    setEnviando(true);
    setError("");
    const { error: e } = await crearClienteBrowser().from("sugerencia").insert({
      club_id: membresia.clubId,
      membresia_id: membresia.id,
      guia,
      tipo,
      texto: limpio,
    });
    setEnviando(false);
    if (e) {
      setError(`No se pudo enviar (${e.message}).`);
      return;
    }
    setTexto("");
    setAbierto(false);
    recargar();
  };

  const retirar = async (id: string) => {
    await crearClienteBrowser().from("sugerencia").delete().eq("id", id);
    recargar();
  };

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          <MessageSquarePlus className="size-3.5 shrink-0" aria-hidden />
          ¿Esta guía se puede mejorar?
        </h3>
        {!abierto && (
          <button
            onClick={() => setAbierto(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <MessageSquarePlus className="size-3.5" aria-hidden />
            Sugerir un cambio
          </button>
        )}
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Tu experiencia suma: las sugerencias van a la curaduría central de la
        plataforma, que mantiene un único estándar para toda la provincia.
      </p>

      {abierto && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5">
          <div className="flex gap-1.5" role="radiogroup" aria-label="Tipo de sugerencia">
            {TIPOS.map((t) => (
              <button
                key={t.clave}
                role="radio"
                aria-checked={tipo === t.clave}
                onClick={() => setTipo(t.clave)}
                className={cn(
                  "h-8 rounded-full border px-3 text-xs font-semibold transition-colors",
                  tipo === t.clave
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={`Qué ${tipo === "agregar" ? "agregarías a" : tipo === "eliminar" ? "sacarías de" : "cambiarías en"} la guía de ${guia} y por qué`}
            className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm outline-none transition-colors focus:border-ring"
          />
          {error && (
            <p className="text-xs font-semibold text-danger">{error}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => void enviar()}
              disabled={enviando}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
            >
              {enviando ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Send className="size-3.5" aria-hidden />
              )}
              Enviar a la plataforma
            </button>
            <button
              onClick={() => {
                setAbierto(false);
                setError("");
              }}
              className="flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-muted-foreground"
            >
              <X className="size-3.5" aria-hidden />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {propias.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {propias.map((s) => (
            <li
              key={s.id}
              className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                    ESTADO_UI[s.estado].clases,
                  )}
                >
                  {s.estado === "pendiente" ? (
                    <Clock className="size-3" aria-hidden />
                  ) : s.estado === "aceptada" ? (
                    <Check className="size-3" aria-hidden />
                  ) : (
                    <X className="size-3" aria-hidden />
                  )}
                  {ESTADO_UI[s.estado].label}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {TIPOS.find((t) => t.clave === s.tipo)?.label} ·{" "}
                  {formatFecha(s.creado_en.slice(0, 10))}
                </span>
                {s.estado === "pendiente" && (
                  <button
                    onClick={() => void retirar(s.id)}
                    aria-label="Retirar sugerencia"
                    title="Retirar sugerencia"
                    className="ml-auto flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-danger"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )}
              </div>
              <p className="text-xs leading-snug text-muted-foreground">
                {s.texto}
              </p>
              {s.respuesta && (
                <p className="rounded-lg bg-muted px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
                  <span className="font-bold">Respuesta de la plataforma:</span>{" "}
                  {s.respuesta}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
