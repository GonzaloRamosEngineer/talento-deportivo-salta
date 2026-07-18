"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  ChevronRight,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  List,
  Plus,
  Search,
  ShieldAlert,
  Sprout,
  Table2,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import {
  edad,
  edadLabel,
  nivelActual,
  HOY_DEMO,
  type Deportista,
} from "@/lib/mock-data";
import { useDatos } from "@/lib/use-datos";
import { tendencia, tendenciaGeneral } from "@/lib/tendencia";
import { crecimiento, umbralPara } from "@/lib/crecimiento";
import { useParametrosCrecimiento } from "@/lib/use-parametros";
import { Ayuda } from "@/components/ayuda";
import { EstadoBadge } from "@/components/estado-badge";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { EstadoVacio } from "@/components/estado-vacio";
import { usePerfil } from "@/components/perfil-context";
import { cn } from "@/lib/utils";

import { CargandoPelota } from "@/components/cargando-pelota";

type Orden = { col: string; dir: 1 | -1 };

function valorDeColumna(d: Deportista, col: string): number | string | null {
  if (col === "nombre") return `${d.apellido} ${d.nombre}`;
  if (col === "edad") return edad(d.fechaNacimiento);
  return nivelActual(d, col);
}

// Filtros de plantel (sesión B de negocio/10). Framing honesto:
// "mejorando" compara a cada deportista contra SUS PROPIAS últimas 3
// mediciones (tendencia "creciendo" en 3+ habilidades), nunca contra
// la media del grupo — rankear contra la media en edades formativas
// premia al que maduró antes. "En estirón" y "sin medir" son registro
// observado / ausencia de registro, no juicios.
const DIAS_SIN_MEDIR = 21; // mismo umbral que las alertas del panel
const MIN_HABILIDADES_MEJORANDO = 3;

type FiltroClave = "estiron" | "mejorando" | "sin-medir" | "consentimiento";

const FILTROS: { clave: FiltroClave; label: string; icono: React.ElementType }[] = [
  { clave: "estiron", label: "En estirón", icono: Sprout },
  { clave: "mejorando", label: `Mejorando en ${MIN_HABILIDADES_MEJORANDO}+`, icono: TrendingUp },
  { clave: "sin-medir", label: "Sin medir 3+ semanas", icono: CalendarClock },
  { clave: "consentimiento", label: "Consentimiento pendiente", icono: ShieldAlert },
];

const CLAVES_FILTRO = new Set(FILTROS.map((f) => f.clave));

function Deportistas() {
  const router = useRouter();
  const sp = useSearchParams();
  const { permisos } = usePerfil();
  const datos = useDatos();
  const [busqueda, setBusqueda] = useState("");
  // Se valida contra los datos cargados recién al filtrar (con sesión
  // real las categorías llegan async y el param puede ser un UUID)
  const [categoria, setCategoria] = useState<string | null>(sp.get("categoria"));
  const [vista, setVista] = useState<"lista" | "tabla">(
    sp.get("vista") === "tabla" ? "tabla" : "lista",
  );
  const [orden, setOrden] = useState<Orden>({ col: "nombre", dir: 1 });
  // Filtros combinables (Y lógico), deep-linkeables: ?filtro=sin-medir
  // o ?filtro=estiron,consentimiento
  const [filtros, setFiltros] = useState<FiltroClave[]>(() =>
    (sp.get("filtro") ?? "")
      .split(",")
      .filter((f): f is FiltroClave => CLAVES_FILTRO.has(f as FiltroClave)),
  );
  const parametros = useParametrosCrecimiento();

  // El alcance ya viene acotado del hook: RLS + categorías asignadas
  // con sesión real; permisos del selector demo sin sesión.
  const categoriasVisibles = datos.categorias;
  const visibles = datos.deportistas;
  const categoriaActiva = categoriasVisibles.some((c) => c.id === categoria)
    ? categoria
    : null;
  const catPorId = useMemo(
    () => new Map(categoriasVisibles.map((c) => [c.id, c])),
    [categoriasVisibles],
  );

  // Marcas por deportista para los filtros — todo se computa de lo que
  // ya trae useDatos, nada nuevo sale de la base. La fecha de corte de
  // "sin medir" es estable por día (string) para no invalidar el memo.
  const atributoTalla = datos.atributos.find((a) => a.nombre === "Talla");
  const limiteSinMedir = new Date(
    (datos.real ? new Date() : HOY_DEMO).getTime() -
      DIAS_SIN_MEDIR * 86_400_000,
  ).toLocaleDateString("en-CA"); // YYYY-MM-DD local
  const marcas = useMemo(() => {
    const m = new Map<string, Record<FiltroClave, boolean>>();
    for (const d of visibles) {
      const talla = atributoTalla ? d.mediciones[atributoTalla.id] : undefined;
      const estiron = crecimiento(talla, {
        umbral: umbralPara(d.sexo, parametros),
        minDias: parametros.minDiasTramo,
      }).enAceleracion;
      let creciendo = 0;
      let ultima = "";
      for (const a of datos.atributos) {
        const serie = d.mediciones[a.id];
        if (!serie?.length) continue;
        if (tendencia(serie, a).estado === "creciendo") creciendo++;
        const f = serie[serie.length - 1].fecha;
        if (f > ultima) ultima = f;
      }
      m.set(d.id, {
        estiron,
        mejorando: creciendo >= MIN_HABILIDADES_MEJORANDO,
        "sin-medir": !ultima || ultima < limiteSinMedir,
        consentimiento: !d.consentimientoOk,
      });
    }
    return m;
  }, [visibles, datos.atributos, atributoTalla, parametros, limiteSinMedir]);

  // Base: búsqueda + categoría (sobre esto se cuentan los chips)
  const base = useMemo(
    () =>
      visibles.filter((d) => {
        const coincideTexto = `${d.nombre} ${d.apellido}`
          .toLowerCase()
          .includes(busqueda.toLowerCase().trim());
        const coincideCategoria =
          !categoriaActiva || d.categoriaId === categoriaActiva;
        return coincideTexto && coincideCategoria;
      }),
    [busqueda, categoriaActiva, visibles],
  );

  const conteos = useMemo(() => {
    const c = { estiron: 0, mejorando: 0, "sin-medir": 0, consentimiento: 0 };
    for (const d of base) {
      const m = marcas.get(d.id);
      if (!m) continue;
      for (const f of FILTROS) if (m[f.clave]) c[f.clave]++;
    }
    return c;
  }, [base, marcas]);

  const lista = useMemo(() => {
    const filtrados = base.filter((d) => {
      const m = marcas.get(d.id);
      return filtros.every((f) => m?.[f]);
    });
    return filtrados.sort((a, b) => {
      const va = valorDeColumna(a, orden.col);
      const vb = valorDeColumna(b, orden.col);
      if (va === null && vb === null) return 0;
      if (va === null) return 1; // sin datos siempre al final
      if (vb === null) return -1;
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb)) * orden.dir;
      }
      return (va - vb) * orden.dir;
    });
  }, [base, filtros, marcas, orden]);

  // Máximo por columna (única énfasis de la tabla: bold, sin semáforos)
  const maximos = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of datos.atributos) {
      const valores = lista
        .map((d) => nivelActual(d, a.id))
        .filter((v): v is number => v !== null);
      if (valores.length) {
        m[a.id] =
          a.sentido === "menor_mejor" ? Math.min(...valores) : Math.max(...valores);
      }
    }
    return m;
  }, [lista, datos.atributos]);

  const ordenarPor = (col: string) =>
    setOrden((o) =>
      o.col === col
        ? { col, dir: (o.dir * -1) as 1 | -1 }
        : { col, dir: col === "nombre" ? 1 : -1 },
    );

  // Estado vacío compartido por las dos vistas: enseña qué va acá y,
  // si el rol puede operar, ofrece el alta directamente.
  const plantelVacio = (
    <EstadoVacio
      icono={UsersRound}
      titulo="Todavía no hay deportistas cargados"
      detalle="Acá va a vivir el plantel: cada deportista con su ficha, su consentimiento y su curva de evolución medición a medición."
      accion={
        permisos.opera
          ? { href: "/deportistas/nuevo", label: "Dar de alta el primero" }
          : undefined
      }
      nota={
        permisos.opera
          ? undefined
          : "El alta la hace el admin del club o un profe desde su cuenta."
      }
    />
  );

  if (!permisos.veClub) {
    return (
      <AvisoAcceso
        titulo="La plataforma no accede a fichas"
        detalle="Los datos individuales de los deportistas —en su mayoría menores— nunca salen de su club. El perfil de plataforma solo ve el observatorio con datos agregados."
        accionHref="/observatorio"
        accionLabel="Ir al observatorio"
      />
    );
  }

  if (datos.cargando) {
    return (
      <CargandoPelota texto="Cargando deportistas…" />
    );
  }
  if (datos.error) {
    return (
      <AvisoAcceso
        titulo="No pudimos cargar los datos"
        detalle={datos.error}
        accionHref="/deportistas"
        accionLabel="Reintentar"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* En mobile el título va a ancho completo y la botonera en su
          propia fila; compartir renglón dejaba todo encimado. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Deportistas</h1>
          <p className="text-sm text-muted-foreground">
            {visibles.length}{" "}
            {permisos.categorias ? "en tus categorías asignadas" : "en total"}
            {visibles.length > 0 && " · tocá para ver la ficha y su evolución"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {permisos.opera && (
            <>
              {datos.real && (
                <Link
                  href="/deportistas/importar"
                  aria-label="Importar plantel desde una planilla"
                  title="Importar plantel desde una planilla"
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <FileSpreadsheet className="size-4" aria-hidden />
                  Importar
                </Link>
              )}
              <Link
                href="/deportistas/nuevo"
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
              >
                <Plus className="size-4" aria-hidden /> Nuevo
              </Link>
            </>
          )}
          <div
            className="ml-auto flex shrink-0 rounded-lg border border-border bg-card p-0.5 sm:ml-0"
            role="tablist"
            aria-label="Cambiar vista"
          >
          <button
            onClick={() => setVista("lista")}
            aria-label="Vista lista"
            className={cn(
              "flex size-9 items-center justify-center rounded-md transition-colors",
              vista === "lista"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground",
            )}
          >
            <List className="size-4.5" aria-hidden />
          </button>
            <button
              onClick={() => setVista("tabla")}
              aria-label="Vista tabla"
              className={cn(
                "flex size-9 items-center justify-center rounded-md transition-colors",
                vista === "tabla"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Table2 className="size-4.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search
          className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o apellido"
          className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por categoría">
        <button
          onClick={() => setCategoria(null)}
          className={cn(
            "h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
            categoriaActiva === null
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          Todas
        </button>
        {categoriasVisibles.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoria(categoriaActiva === c.id ? null : c.id)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
              categoriaActiva === c.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {/* Filtros de seguimiento (combinables entre sí) */}
      {visibles.length > 0 && (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Filtros de seguimiento"
        >
          {FILTROS.map((f) => {
            const activo = filtros.includes(f.clave);
            const Icono = f.icono;
            return (
              <button
                key={f.clave}
                onClick={() =>
                  setFiltros((prev) =>
                    activo
                      ? prev.filter((x) => x !== f.clave)
                      : [...prev, f.clave],
                  )
                }
                aria-pressed={activo}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                  activo
                    ? "border-secondary bg-secondary text-secondary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                <Icono className="size-3.5" aria-hidden />
                {f.label}
                <span
                  className={cn(
                    "tabular-nums text-xs font-bold",
                    activo ? "opacity-80" : "text-muted-foreground/70",
                  )}
                >
                  {conteos[f.clave]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {filtros.length > 0 && (
        <p className="-mt-2 px-1 text-[11px] leading-snug text-muted-foreground">
          {filtros.includes("estiron") &&
            "En estirón: ritmo de talla sobre el umbral de crecimiento acelerado (registro observado). "}
          {filtros.includes("mejorando") &&
            `Mejorando: tendencia en alza en ${MIN_HABILIDADES_MEJORANDO} o más habilidades, cada uno contra sus propias últimas 3 mediciones — nunca contra el resto del grupo. `}
          {filtros.includes("sin-medir") &&
            "Sin medir: ninguna medición registrada en las últimas 3 semanas (o nunca). "}
          {filtros.includes("consentimiento") &&
            "Consentimiento pendiente: falta registrar la firma del tutor. "}
          Los filtros se combinan entre sí.
        </p>
      )}

      {/* ================= VISTA LISTA ================= */}
      {vista === "lista" && (
        <ul className="flex flex-col gap-2">
          {lista.map((d) => {
            const t = tendenciaGeneral(d.mediciones, datos.atributos);
            const cat = catPorId.get(d.categoriaId);
            return (
              <li key={d.id}>
                <Link
                  href={`/deportistas/${d.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
                >
                  <AvatarIniciales nombre={d.nombre} apellido={d.apellido} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {d.apellido}, {d.nombre}
                    </span>
                    {/* El pendiente va como texto legible en la línea
                        secundaria, no como ícono suelto pegado al
                        nombre (no se entendía qué era). */}
                    <span className="block text-xs text-muted-foreground">
                      {cat?.nombre ?? "Sin categoría"} · {edadLabel(d.fechaNacimiento)}
                    </span>
                    {!d.consentimientoOk && (
                      <span className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-warning">
                        <ShieldAlert className="size-3 shrink-0" aria-hidden />
                        Falta consentimiento
                      </span>
                    )}
                  </span>
                  <EstadoBadge estado={t.estado} />
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
          {lista.length === 0 && (
            <li>
              {visibles.length === 0 ? (
                plantelVacio
              ) : (
                <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No hay deportistas para este filtro.
                </p>
              )}
            </li>
          )}
        </ul>
      )}

      {/* ================= VISTA TABLA ================= */}
      {vista === "tabla" && visibles.length === 0 && plantelVacio}
      {vista === "tabla" && lista.length === 0 && visibles.length > 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay deportistas para este filtro.
        </p>
      )}
      {vista === "tabla" && lista.length > 0 && (
        <>
          <Ayuda
            titulo="¿Cómo se usa la tabla?"
            bullets={[
              "Tocá el encabezado de una columna (Vel, Res…) para ordenar el plantel por esa habilidad; tocá de nuevo y se invierte el orden.",
              "Deslizá la tabla hacia el costado para recorrer todas las habilidades — el nombre queda siempre fijo a la izquierda.",
              "En negrita, el mejor valor del grupo filtrado. Ojo: en atributos de tiempo (Velocidad 30m) el mejor es el MENOR.",
            ]}
          />
          <div className="rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left">
                    <BotonOrden
                      label="Jugador/a"
                      activo={orden.col === "nombre"}
                      dir={orden.dir}
                      onClick={() => ordenarPor("nombre")}
                    />
                  </th>
                  <th className="px-2 py-2.5 text-left font-bold text-muted-foreground">
                    Cat.
                  </th>
                  <th className="px-2 py-2.5">
                    <BotonOrden
                      label="Edad"
                      activo={orden.col === "edad"}
                      dir={orden.dir}
                      onClick={() => ordenarPor("edad")}
                      centrado
                    />
                  </th>
                  {datos.atributos.map((a) => (
                    <th key={a.id} className="px-1.5 py-2.5" title={`${a.nombre} (${a.unidad})`}>
                      <BotonOrden
                        label={a.abrev}
                        activo={orden.col === a.id}
                        dir={orden.dir}
                        onClick={() => ordenarPor(a.id)}
                        centrado
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => router.push(`/deportistas/${d.id}`)}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="sticky left-0 z-10 max-w-40 bg-card px-3 py-2.5">
                      <span className="flex items-center gap-1.5 font-bold">
                        <span className="truncate">
                          {d.apellido}, {d.nombre[0]}.
                        </span>
                        {!d.consentimientoOk && (
                          <ShieldAlert
                            className="size-3 shrink-0 text-warning"
                            aria-label="Consentimiento pendiente"
                          />
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs text-muted-foreground">
                      {catPorId.get(d.categoriaId)?.nombre.replace("Escuelita ", "Esc. ") ?? "—"}
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">
                      {edad(d.fechaNacimiento) ?? "–"}
                    </td>
                    {datos.atributos.map((a) => {
                      const v = nivelActual(d, a.id);
                      const esMax = v !== null && maximos[a.id] === v;
                      return (
                        <td
                          key={a.id}
                          className={cn(
                            "px-1.5 py-2.5 text-center tabular-nums",
                            v === null && "text-muted-foreground/50",
                            esMax && "font-extrabold",
                          )}
                        >
                          {v === null ? "–" : v.toLocaleString("es-AR")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            Último valor registrado de cada habilidad · deslizá para ver más
            columnas.
          </p>
          </div>
        </>
      )}
    </div>
  );
}

export default function PaginaDeportistas() {
  return (
    <Suspense>
      <Deportistas />
    </Suspense>
  );
}

function BotonOrden({
  label,
  activo,
  dir,
  onClick,
  centrado,
}: {
  label: string;
  activo: boolean;
  dir: 1 | -1;
  onClick: () => void;
  centrado?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-0.5 text-xs font-bold transition-colors",
        centrado && "mx-auto",
        activo ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={`Ordenar por ${label}`}
    >
      {label}
      {activo ? (
        dir === 1 ? (
          <ArrowUp className="size-3" aria-hidden />
        ) : (
          <ArrowDown className="size-3" aria-hidden />
        )
      ) : (
        <ChevronsUpDown className="size-3 opacity-50" aria-hidden />
      )}
    </button>
  );
}
