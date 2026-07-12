"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  List,
  Search,
  ShieldAlert,
  Table2,
} from "lucide-react";
import {
  ATRIBUTOS,
  CATEGORIAS,
  DEPORTISTAS,
  edad,
  getCategoria,
  nivelActual,
  type Deportista,
} from "@/lib/mock-data";
import { tendenciaGeneral } from "@/lib/tendencia";
import { EstadoBadge } from "@/components/estado-badge";
import { AvatarIniciales } from "@/components/avatar-iniciales";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { usePerfil } from "@/components/perfil-context";
import { cn } from "@/lib/utils";

type Orden = { col: string; dir: 1 | -1 };

function valorDeColumna(d: Deportista, col: string): number | string | null {
  if (col === "nombre") return `${d.apellido} ${d.nombre}`;
  if (col === "edad") return edad(d.fechaNacimiento);
  return nivelActual(d, col);
}

function Deportistas() {
  const router = useRouter();
  const sp = useSearchParams();
  const { permisos } = usePerfil();
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<string | null>(
    CATEGORIAS.some((c) => c.id === sp.get("categoria"))
      ? sp.get("categoria")
      : null,
  );
  const [vista, setVista] = useState<"lista" | "tabla">(
    sp.get("vista") === "tabla" ? "tabla" : "lista",
  );
  const [orden, setOrden] = useState<Orden>({ col: "nombre", dir: 1 });

  // Alcance por perfil: el profesor solo ve sus categorías asignadas
  const categoriasVisibles = useMemo(
    () =>
      permisos.categorias
        ? CATEGORIAS.filter((c) => permisos.categorias!.includes(c.id))
        : CATEGORIAS,
    [permisos.categorias],
  );
  const visibles = useMemo(
    () =>
      permisos.categorias
        ? DEPORTISTAS.filter((d) => permisos.categorias!.includes(d.categoriaId))
        : DEPORTISTAS,
    [permisos.categorias],
  );

  const lista = useMemo(() => {
    const filtrados = visibles.filter((d) => {
      const coincideTexto = `${d.nombre} ${d.apellido}`
        .toLowerCase()
        .includes(busqueda.toLowerCase().trim());
      const coincideCategoria = !categoria || d.categoriaId === categoria;
      return coincideTexto && coincideCategoria;
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
  }, [busqueda, categoria, orden, visibles]);

  // Máximo por columna (única énfasis de la tabla: bold, sin semáforos)
  const maximos = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of ATRIBUTOS) {
      const valores = lista
        .map((d) => nivelActual(d, a.id))
        .filter((v): v is number => v !== null);
      if (valores.length) {
        m[a.id] =
          a.sentido === "menor_mejor" ? Math.min(...valores) : Math.max(...valores);
      }
    }
    return m;
  }, [lista]);

  const ordenarPor = (col: string) =>
    setOrden((o) =>
      o.col === col
        ? { col, dir: (o.dir * -1) as 1 | -1 }
        : { col, dir: col === "nombre" ? 1 : -1 },
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Deportistas</h1>
          <p className="text-sm text-muted-foreground">
            {visibles.length}{" "}
            {permisos.categorias
              ? "en tus categorías asignadas"
              : "en total"}{" "}
            · tocá para ver la ficha y su evolución
          </p>
        </div>
        <div
          className="flex shrink-0 rounded-lg border border-border bg-card p-0.5"
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
            categoria === null
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          Todas
        </button>
        {categoriasVisibles.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoria(categoria === c.id ? null : c.id)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
              categoria === c.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      {/* ================= VISTA LISTA ================= */}
      {vista === "lista" && (
        <ul className="flex flex-col gap-2">
          {lista.map((d) => {
            const t = tendenciaGeneral(d.mediciones, ATRIBUTOS);
            const cat = getCategoria(d.categoriaId);
            return (
              <li key={d.id}>
                <Link
                  href={`/deportistas/${d.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
                >
                  <AvatarIniciales nombre={d.nombre} apellido={d.apellido} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-bold">
                      <span className="truncate">
                        {d.apellido}, {d.nombre}
                      </span>
                      {!d.consentimientoOk && (
                        <ShieldAlert
                          className="size-3.5 shrink-0 text-warning"
                          aria-label="Consentimiento pendiente"
                        />
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {cat?.nombre} · {edad(d.fechaNacimiento)} años
                    </span>
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
            <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No hay deportistas para este filtro.
            </li>
          )}
        </ul>
      )}

      {/* ================= VISTA TABLA ================= */}
      {vista === "tabla" && (
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
                  {ATRIBUTOS.map((a) => (
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
                      {getCategoria(d.categoriaId)?.nombre.replace("Escuelita ", "Esc. ")}
                    </td>
                    <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground">
                      {edad(d.fechaNacimiento)}
                    </td>
                    {ATRIBUTOS.map((a) => {
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
            Último valor registrado de cada habilidad. En negrita, el mejor del
            grupo filtrado (en Velocidad 30m, el menor tiempo). Deslizá para ver
            más columnas.
          </p>
        </div>
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
