"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Loader2,
  Trophy,
} from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { useDatos, hoyLocalISO } from "@/lib/use-datos";
import { useAgenda } from "@/lib/use-agenda";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { usePerfil } from "@/components/perfil-context";
import { cn } from "@/lib/utils";

// Alta de partido — solo datos grupales. La citación arranca con todo
// el plantel tildado (se destilda al que no viaja); el resultado se
// carga después, desde el detalle. Solo con sesión real.

function FormPartido() {
  const router = useRouter();
  const search = useSearchParams();
  const { permisos } = usePerfil();
  const datos = useDatos();
  const agenda = useAgenda(datos);

  const [categoriaId, setCategoriaId] = useState(search.get("categoria") ?? "");
  const [fecha, setFecha] = useState(hoyLocalISO());
  const [hora, setHora] = useState("15:00");
  const [torneo, setTorneo] = useState("");
  const [rival, setRival] = useState("");
  const [condicion, setCondicion] = useState<"local" | "visitante">("local");
  const [lugarId, setLugarId] = useState("");
  const [lugarTexto, setLugarTexto] = useState("");
  const [fuera, setFuera] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const plantel = useMemo(
    () => datos.deportistas.filter((d) => d.categoriaId === categoriaId),
    [datos.deportistas, categoriaId],
  );
  const citados = plantel.length - fuera.size;

  if (agenda.cargando) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!agenda.real || !permisos.opera) {
    return (
      <AvisoAcceso
        titulo="Cargar partidos requiere una cuenta que opere"
        detalle="Los partidos los cargan los profes y el admin del club, con sesión iniciada. En la demo pública la agenda es de solo lectura."
        accionHref={agenda.real ? "/sesiones" : "/login"}
        accionLabel={agenda.real ? "Ver la agenda" : "Ingresar"}
      />
    );
  }

  const toggleCitado = (id: string) => {
    setFuera((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  async function guardar() {
    if (!datos.clubId) return;
    if (!categoriaId) {
      setError("Elegí la categoría.");
      return;
    }
    if (!rival.trim()) {
      setError("¿Contra quién se juega? Falta el rival.");
      return;
    }
    if (!fecha || !hora) {
      setError("Falta la fecha u hora del partido.");
      return;
    }
    setGuardando(true);
    setError("");
    const supabase = crearClienteBrowser();
    try {
      const { data, error: e } = await supabase
        .from("partido")
        .insert({
          club_id: datos.clubId,
          categoria_id: categoriaId,
          fecha: new Date(`${fecha}T${hora}:00`).toISOString(),
          torneo: torneo.trim() || null,
          rival: rival.trim(),
          condicion,
          lugar_id: condicion === "local" ? lugarId || null : null,
          lugar_texto: condicion === "visitante" ? lugarTexto.trim() || null : null,
        })
        .select("id")
        .single();
      if (e) throw e;
      const citacion = plantel.filter((d) => !fuera.has(d.id));
      if (citacion.length > 0) {
        const { error: eCit } = await supabase.from("partido_citacion").insert(
          citacion.map((d) => ({
            partido_id: data.id as string,
            deportista_id: d.id,
          })),
        );
        if (eCit) throw eCit;
      }
      agenda.recargar();
      router.replace(`/partidos/${data.id as string}`);
    } catch (e) {
      setGuardando(false);
      setError(e instanceof Error ? e.message : "No se pudo guardar el partido");
    }
  }

  const esEscuelita =
    datos.categorias.find((c) => c.id === categoriaId)?.tipo === "escuelita";

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/sesiones"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Agenda
      </Link>

      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Trophy className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Nuevo partido</h1>
          <p className="text-sm text-muted-foreground">
            Datos grupales: rival, cancha y citación. El resultado se carga
            después del partido.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm font-semibold text-destructive">{error}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="p-categoria" className="mb-1.5 block text-xs font-bold text-muted-foreground">
              Categoría
            </label>
            <select
              id="p-categoria"
              value={categoriaId}
              onChange={(e) => {
                setCategoriaId(e.target.value);
                setFuera(new Set());
              }}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
            >
              <option value="">Elegir…</option>
              {datos.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="p-rival" className="mb-1.5 block text-xs font-bold text-muted-foreground">
              Rival
            </label>
            <input
              id="p-rival"
              value={rival}
              onChange={(e) => setRival(e.target.value)}
              placeholder="Ej. Gimnasia y Tiro"
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label htmlFor="p-fecha" className="mb-1.5 block text-xs font-bold text-muted-foreground">
              Fecha
            </label>
            <input
              id="p-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="p-hora" className="mb-1.5 block text-xs font-bold text-muted-foreground">
              Hora
            </label>
            <input
              id="p-hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="p-torneo" className="mb-1.5 block text-xs font-bold text-muted-foreground">
              Torneo (opcional)
            </label>
            <input
              id="p-torneo"
              value={torneo}
              onChange={(e) => setTorneo(e.target.value)}
              placeholder="Ej. Liga Salteña — Infantiles"
              className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-bold text-muted-foreground">
              Condición
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(["local", "visitante"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondicion(c)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-bold capitalize transition-colors",
                    condicion === c
                      ? "border-primary bg-secondary text-secondary-foreground"
                      : "border-input text-muted-foreground hover:border-primary/40",
                  )}
                  aria-pressed={condicion === c}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {condicion === "local" ? (
            <div className="sm:col-span-2">
              <label htmlFor="p-lugar" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Cancha del club
              </label>
              <select
                id="p-lugar"
                value={lugarId}
                onChange={(e) => setLugarId(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
              >
                <option value="">Elegir…</option>
                {agenda.lugares.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <label htmlFor="p-lugar-texto" className="mb-1.5 block text-xs font-bold text-muted-foreground">
                Cancha del rival
              </label>
              <input
                id="p-lugar-texto"
                value={lugarTexto}
                onChange={(e) => setLugarTexto(e.target.value)}
                placeholder="Ej. Predio de Gimnasia, El Huaico"
                className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>
        {esEscuelita && (
          <p className="mt-3 rounded-xl bg-secondary px-3.5 py-2.5 text-xs leading-relaxed text-secondary-foreground">
            Encuentro de escuelita: se registra la participación, sin marcador.
          </p>
        )}
      </div>

      {/* Citación: todos tildados, se destilda al que no va */}
      {categoriaId && (
        <section className="rounded-2xl border border-border bg-card">
          <h2 className="flex items-baseline justify-between border-b border-border px-4 py-3 text-sm font-extrabold">
            Citados ({citados}/{plantel.length})
            <span className="text-[11px] font-semibold text-muted-foreground">
              Destildá al que no va
            </span>
          </h2>
          <ul>
            {plantel.map((d) => {
              const citado = !fuera.has(d.id);
              return (
                <li key={d.id} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    onClick={() => toggleCitado(d.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50",
                      !citado && "opacity-50",
                    )}
                    aria-pressed={citado}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border",
                        citado
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input",
                      )}
                    >
                      {citado && <Check className="size-3.5" aria-hidden />}
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold">
                      {d.apellido}, {d.nombre}
                    </span>
                  </button>
                </li>
              );
            })}
            {plantel.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                No hay deportistas cargados en esta categoría.
              </li>
            )}
          </ul>
        </section>
      )}

      <button
        onClick={() => void guardar()}
        disabled={guardando}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        {guardando ? (
          <Loader2 className="size-4.5 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4.5" aria-hidden />
        )}
        Guardar partido
      </button>
    </div>
  );
}

export default function NuevoPartido() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </div>
      }
    >
      <FormPartido />
    </Suspense>
  );
}
