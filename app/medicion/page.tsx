"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { formatFecha } from "@/lib/mock-data";
import { hoyLocalISO, useDatos } from "@/lib/use-datos";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { Ayuda } from "@/components/ayuda";
import { ComoMedir } from "@/components/como-medir";
import { usePerfil } from "@/components/perfil-context";
import { cn } from "@/lib/utils";

import { CargandoPelota } from "@/components/cargando-pelota";

// "4,2" (teclado decimal AR) y "4.2" valen igual; null = no es número
function parseValor(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!limpio) return null;
  const v = Number(limpio);
  return Number.isFinite(v) && Math.abs(v) < 10000 ? v : null;
}

// Borrador de la jornada en ESTE teléfono: el predio sin señal no
// puede perder los valores ya cargados. Se guarda en localStorage a
// cada tecla y se descarta al guardar en la base o al cambiar el día.
const CLAVE_BORRADOR = "tds-borrador-medicion";

interface Borrador {
  fecha: string;
  atributoId: string | null;
  categoriaId: string | null;
  valores: Record<string, string>;
  hora: string;
}

function leerBorrador(): Borrador | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_BORRADOR);
    if (!crudo) return null;
    const b = JSON.parse(crudo) as Borrador;
    if (b.fecha !== hoyLocalISO() || typeof b.valores !== "object" || !b.valores) {
      // Un borrador de otro día ya no vale: esa jornada quedó atrás
      window.localStorage.removeItem(CLAVE_BORRADOR);
      return null;
    }
    const cargados = Object.values(b.valores).filter((v) => v?.trim()).length;
    return cargados > 0 ? b : null;
  } catch {
    return null;
  }
}

function JornadaDeMedicion() {
  const sp = useSearchParams();
  const { permisos } = usePerfil();
  const datos = useDatos();
  // Los params se validan contra los datos ya cargados (con sesión
  // real llegan async): un id ajeno simplemente no selecciona nada.
  const [atributoId, setAtributoId] = useState<string | null>(sp.get("atributo"));
  const [categoriaId, setCategoriaId] = useState<string | null>(sp.get("categoria"));
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardada, setGuardada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [borradorRecuperado, setBorradorRecuperado] = useState<Borrador | null>(null);
  const [sinConexion, setSinConexion] = useState(false);

  const hoy = hoyLocalISO();

  // Restaurar el borrador del día una sola vez, después de montar (en
  // microtask: la hidratación no puede depender de localStorage). Los
  // params de la URL tienen prioridad sobre lo recordado.
  useEffect(() => {
    let cancelado = false;
    void Promise.resolve().then(() => {
      if (cancelado) return;
      const b = leerBorrador();
      if (!b) return;
      setValores((v) => (Object.values(v).some((x) => x?.trim()) ? v : b.valores));
      setAtributoId((a) => a ?? b.atributoId);
      setCategoriaId((c) => c ?? b.categoriaId);
      setBorradorRecuperado(b);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  // Persistir a cada tecla; al guardar en la base se limpia (ver guardar())
  useEffect(() => {
    if (guardada) return;
    const cargados = Object.values(valores).filter((v) => v?.trim()).length;
    if (cargados === 0) return;
    window.localStorage.setItem(
      CLAVE_BORRADOR,
      JSON.stringify({
        fecha: hoyLocalISO(),
        atributoId,
        categoriaId,
        valores,
        hora: new Date().toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      } satisfies Borrador),
    );
  }, [valores, atributoId, categoriaId, guardada]);

  // Aviso de "predio sin señal": los eventos online/offline del browser
  useEffect(() => {
    const actualizar = () => setSinConexion(!window.navigator.onLine);
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    void Promise.resolve().then(actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);
  const atributo = datos.atributos.find((a) => a.id === atributoId) ?? null;
  const categoria = datos.categorias.find((c) => c.id === categoriaId) ?? null;
  const plantel = useMemo(
    () =>
      categoria
        ? datos.deportistas
            .filter((d) => d.categoriaId === categoria.id)
            .sort((a, b) => a.apellido.localeCompare(b.apellido))
        : [],
    [categoria, datos.deportistas],
  );
  const cargados = plantel.filter((d) => valores[d.id]?.trim()).length;
  const invalidos = plantel.filter(
    (d) => valores[d.id]?.trim() && parseValor(valores[d.id]) === null,
  ).length;
  const listo = atributo && categoria && cargados > 0 && invalidos === 0;

  const plantelDe = (catId: string) =>
    datos.deportistas.filter((d) => d.categoriaId === catId).length;
  const sinDeportistas =
    datos.real && datos.categorias.every((c) => plantelDe(c.id) === 0);

  async function guardar() {
    if (!listo) return;
    if (!datos.real) {
      // Demo pública sin sesión: no se persiste nada
      window.localStorage.removeItem(CLAVE_BORRADOR);
      setGuardada(true);
      return;
    }
    if (!datos.membresiaId) return;
    setGuardando(true);
    setErrorGuardar(null);
    const filas = plantel
      .filter((d) => valores[d.id]?.trim())
      .map((d) => ({
        deportista_id: d.id,
        atributo_id: atributo!.id,
        valor: parseValor(valores[d.id])!,
        fecha: hoy,
        registrado_por: datos.membresiaId,
        club_id: datos.clubId,
      }));
    // El unique (deportista, atributo, fecha) hace el "una por día":
    // recargar la misma jornada corrige, no duplica.
    const { error } = await crearClienteBrowser()
      .from("medicion")
      .upsert(filas, { onConflict: "deportista_id,atributo_id,fecha" });
    setGuardando(false);
    if (error) {
      setErrorGuardar(
        `No se pudo guardar la jornada (${error.message}). Los valores quedaron como borrador en este teléfono: aunque cierres la app no se pierden. Probá de nuevo cuando haya señal.`,
      );
      return;
    }
    window.localStorage.removeItem(CLAVE_BORRADOR);
    setBorradorRecuperado(null);
    datos.recargar();
    setGuardada(true);
  }

  if (!permisos.opera) {
    return (
      <AvisoAcceso
        titulo="Tu perfil no carga mediciones"
        detalle="La carga de datos es de profesores y administración del club. Comisión directiva consulta; la plataforma solo ve agregados."
        accionHref="/deportistas"
        accionLabel="Ver deportistas"
      />
    );
  }

  if (datos.cargando) {
    return (
      <CargandoPelota texto="Cargando tus categorías…" />
    );
  }
  if (datos.error) {
    return (
      <AvisoAcceso
        titulo="No pudimos cargar los datos"
        detalle={datos.error}
        accionHref="/medicion"
        accionLabel="Reintentar"
      />
    );
  }

  if (guardada) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="size-14 text-success" aria-hidden />
        <div>
          <h1 className="text-xl font-extrabold">Jornada registrada</h1>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {cargados} mediciones de {atributo?.nombre} en {categoria?.nombre}
            {datos.real ? (
              <>
                {" "}
                quedaron guardadas con fecha de hoy. Ya se ven en la curva de
                evolución de cada deportista.
              </>
            ) : (
              <>
                .<br />
                <span className="font-semibold text-warning">
                  Demo: en esta etapa los datos no se guardan.
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setValores({});
              setGuardada(false);
            }}
            className="h-11 rounded-xl border border-border bg-card px-5 text-sm font-bold"
          >
            Cargar otra
          </button>
          <Link
            href="/deportistas"
            className="flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            Ver deportistas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Jornada de medición
        </h1>
        <p className="text-sm text-muted-foreground">
          Elegí qué medir y cargá a toda la categoría de corrido
        </p>
      </div>

      <Ayuda
        bullets={[
          "Se carga UN atributo para toda la categoría, de corrido: ideal para la jornada en la cancha con el celular.",
          "Si el mismo día se vuelve a cargar un valor para un deportista, se corrige (no se duplica): una medición por día.",
          "Cada valor suma un punto a la curva de evolución del deportista; se puede dejar a alguien sin cargar sin problema.",
        ]}
      />

      {sinConexion && (
        <div className="flex items-start gap-2.5 rounded-xl bg-warning-soft p-3.5 text-sm text-warning">
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 font-semibold">
            Sin señal.{" "}
            <span className="font-normal">
              Seguí cargando tranquilo: cada valor queda como borrador en este
              teléfono. Cuando vuelva la conexión, tocá Guardar.
            </span>
          </p>
        </div>
      )}

      {borradorRecuperado && !guardada && (
        <div className="flex flex-wrap items-start gap-2.5 rounded-xl border border-primary/25 bg-secondary/50 p-3.5 text-sm">
          <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="min-w-0 flex-1 font-semibold">
            Recuperamos la jornada que quedó a medias
            {borradorRecuperado.hora && ` (${borradorRecuperado.hora})`}.{" "}
            <span className="font-normal text-muted-foreground">
              Estaba guardada como borrador en este teléfono: revisá y guardá.
            </span>
          </p>
          <button
            onClick={() => {
              window.localStorage.removeItem(CLAVE_BORRADOR);
              setValores({});
              setBorradorRecuperado(null);
            }}
            className="h-9 shrink-0 rounded-lg border border-border bg-card px-3 text-xs font-bold text-muted-foreground"
          >
            Descartar
          </button>
        </div>
      )}

      {sinDeportistas && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-warning-soft p-3.5 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 font-semibold">
            Todavía no hay deportistas cargados en tus categorías.
          </p>
          <Link
            href="/deportistas/nuevo"
            className="h-9 shrink-0 rounded-lg bg-warning px-3 text-xs font-bold leading-9 text-white"
          >
            Dar de alta
          </Link>
        </div>
      )}

      {/* Paso 1: atributo */}
      <section>
        <h2 className="mb-2 text-sm font-extrabold">
          1 · ¿Qué van a medir hoy?
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {datos.atributos.map((a) => (
            <button
              key={a.id}
              onClick={() => setAtributoId(a.id)}
              className={cn(
                "flex min-h-12 items-center justify-between rounded-xl border px-3.5 py-2 text-left text-sm font-semibold transition-colors",
                a.id === atributoId
                  ? "border-primary bg-secondary text-secondary-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              <span>
                {a.nombre}
                <span className="block text-[11px] font-medium text-muted-foreground">
                  {a.unidad}
                  {a.naturaleza === "subjetivo" && " · a criterio"}
                </span>
              </span>
              {a.id === atributoId && (
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
              )}
            </button>
          ))}
        </div>
        {atributo && (
          <div className="mt-2.5">
            <ComoMedir atributo={atributo} />
          </div>
        )}
      </section>

      {/* Paso 2: categoría */}
      <section>
        <h2 className="mb-2 text-sm font-extrabold">2 · ¿Qué categoría?</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {datos.categorias.map((c) => {
            const n = plantelDe(c.id);
            return (
              <button
                key={c.id}
                disabled={n === 0}
                onClick={() => setCategoriaId(c.id)}
                className={cn(
                  "h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition-colors",
                  c.id === categoriaId
                    ? "border-primary bg-primary text-primary-foreground"
                    : n === 0
                      ? "border-border bg-muted text-muted-foreground/50"
                      : "border-border bg-card text-muted-foreground",
                )}
              >
                {c.nombre}
                {n > 0 && ` · ${n}`}
              </button>
            );
          })}
        </div>
      </section>

      {/* Paso 3: la lista de carga rápida */}
      {atributo && categoria && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-extrabold">
              3 · Cargar {atributo.nombre}{" "}
              <span className="font-semibold text-muted-foreground">
                ({atributo.unidad})
              </span>
            </h2>
            <span className="text-xs font-bold text-primary tabular-nums">
              {cargados}/{plantel.length}
            </span>
          </div>

          {/* progreso */}
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: plantel.length
                  ? `${(cargados / plantel.length) * 100}%`
                  : "0%",
              }}
            />
          </div>

          <ul className="flex flex-col gap-2">
            {plantel.map((d) => {
              const valor = valores[d.id] ?? "";
              const invalido = valor.trim() !== "" && parseValor(valor) === null;
              const serie = d.mediciones[atributo.id] ?? [];
              const deHoy = serie.find((m) => m.fecha === hoy);
              const previa = [...serie].reverse().find((m) => m.fecha !== hoy);
              return (
                <li
                  key={d.id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                    invalido
                      ? "border-danger/50 bg-danger-soft/40"
                      : valor.trim()
                        ? "border-primary/40 bg-secondary/50"
                        : "border-border bg-card",
                  )}
                >
                  <AvatarIniciales nombre={d.nombre} apellido={d.apellido} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {d.apellido}, {d.nombre}
                    </span>
                    {invalido ? (
                      <span className="block text-[11px] font-semibold text-danger">
                        Ese valor no es un número
                      </span>
                    ) : deHoy ? (
                      <span className="block text-[11px] font-semibold text-primary">
                        hoy ya cargado: {deHoy.valor.toLocaleString("es-AR")}{" "}
                        {atributo.unidad} — si escribís, lo reemplaza
                      </span>
                    ) : previa ? (
                      <span className="block text-[11px] text-muted-foreground">
                        últ. {previa.valor.toLocaleString("es-AR")}{" "}
                        {atributo.unidad} · {formatFecha(previa.fecha)}
                      </span>
                    ) : null}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) =>
                      setValores((v) => ({ ...v, [d.id]: e.target.value }))
                    }
                    placeholder={atributo.unidad}
                    aria-label={`${atributo.nombre} de ${d.nombre} ${d.apellido}`}
                    className={cn(
                      "h-12 w-24 rounded-xl border bg-background text-center text-lg font-extrabold tabular-nums outline-none transition-colors placeholder:text-sm placeholder:font-medium placeholder:text-muted-foreground focus:ring-2",
                      invalido
                        ? "border-danger focus:border-danger focus:ring-danger/20"
                        : "border-input focus:border-ring focus:ring-ring/20",
                    )}
                  />
                </li>
              );
            })}
          </ul>

          <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <p>
              Se registra una medición por deportista por día. Si ya había una
              de hoy, se reemplaza.
            </p>
          </div>

          {errorGuardar && (
            <div className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>{errorGuardar}</p>
            </div>
          )}
        </section>
      )}

      {/* Guardar (sticky sobre la barra de navegación) */}
      {atributo && categoria && (
        <div className="sticky bottom-20 z-20 md:bottom-4">
          <button
            disabled={!listo || guardando}
            onClick={() => void guardar()}
            className={cn(
              "flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold shadow-lg transition-all",
              listo && !guardando
                ? "bg-primary text-primary-foreground active:scale-[0.99]"
                : "cursor-not-allowed bg-muted text-muted-foreground shadow-none",
            )}
          >
            {guardando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {guardando
              ? "Guardando…"
              : invalidos > 0
                ? "Revisá los valores marcados"
                : listo
                  ? `Guardar jornada (${cargados})`
                  : "Cargá al menos una medición"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PaginaMedicion() {
  return (
    <Suspense>
      <JornadaDeMedicion />
    </Suspense>
  );
}
