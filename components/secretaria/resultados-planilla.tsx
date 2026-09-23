"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, TableProperties } from "lucide-react";

export interface ResultadoPlanilla {
  deportistaId: string | null;
  deportistaClave: string | null;
  nombre: string;
  apellido: string | null;
  fecha: string | null;
  protocoloCodigo: string | null;
  protocoloNombre: string | null;
  atributoCodigo: string;
  atributoNombre: string;
  unidad: string | null;
  valor: number;
  intento: number;
}

interface Columna {
  clave: string;
  protocoloCodigo: string | null;
  protocolo: string;
  atributo: string;
  unidad: string | null;
}

interface Fila {
  clave: string;
  deportistaId: string | null;
  nombre: string;
  valores: Map<string, ResultadoPlanilla[]>;
}

function nombreVisible(resultado: ResultadoPlanilla) {
  return resultado.apellido?.trim()
    ? `${resultado.apellido.trim()}, ${resultado.nombre.trim()}`
    : resultado.nombre.trim();
}

function formatearValor(valor: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(valor);
}

export function ResultadosPlanilla({ resultados }: { resultados: ResultadoPlanilla[] }) {
  const protocolos = useMemo(() => {
    const unicos = new Map<string, string>();
    for (const resultado of resultados) {
      if (resultado.protocoloCodigo) {
        unicos.set(resultado.protocoloCodigo, resultado.protocoloNombre ?? resultado.protocoloCodigo);
      }
    }
    return [...unicos.entries()].map(([codigo, nombre]) => ({ codigo, nombre }));
  }, [resultados]);
  const [protocoloActivo, setProtocoloActivo] = useState<string>("todos");

  const { columnas, filas } = useMemo(() => {
    const visibles = protocoloActivo === "todos"
      ? resultados
      : resultados.filter((resultado) => resultado.protocoloCodigo === protocoloActivo || resultado.protocoloCodigo === null);
    const columnasPorClave = new Map<string, Columna>();
    const filasPorClave = new Map<string, Fila>();
    for (const resultado of visibles) {
      const columnaClave = `${resultado.protocoloCodigo ?? "transversal"}::${resultado.atributoCodigo}`;
      if (!columnasPorClave.has(columnaClave)) {
        columnasPorClave.set(columnaClave, {
          clave: columnaClave,
          protocoloCodigo: resultado.protocoloCodigo,
          protocolo: resultado.protocoloNombre ?? "Transversal",
          atributo: resultado.atributoNombre,
          unidad: resultado.unidad,
        });
      }
      const personaClave = resultado.deportistaId
        ?? resultado.deportistaClave
        ?? `${resultado.nombre}::${resultado.apellido ?? ""}`;
      if (!filasPorClave.has(personaClave)) {
        filasPorClave.set(personaClave, {
          clave: personaClave,
          deportistaId: resultado.deportistaId,
          nombre: nombreVisible(resultado),
          valores: new Map(),
        });
      }
      const fila = filasPorClave.get(personaClave)!;
      const valores = fila.valores.get(columnaClave) ?? [];
      valores.push(resultado);
      valores.sort((a, b) => a.intento - b.intento);
      fila.valores.set(columnaClave, valores);
    }
    return {
      columnas: [...columnasPorClave.values()].sort((a, b) => {
        if (a.protocoloCodigo === null) return -1;
        if (b.protocoloCodigo === null) return 1;
        return `${a.protocolo}-${a.atributo}`.localeCompare(`${b.protocolo}-${b.atributo}`, "es");
      }),
      filas: [...filasPorClave.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    };
  }, [protocoloActivo, resultados]);

  if (!resultados.length) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 sm:rounded-3xl sm:p-5">
        <div className="flex items-center gap-2"><TableProperties className="size-4 text-primary" /><h2 className="text-sm font-extrabold">Resultados de la planilla</h2></div>
        <p className="mt-3 text-xs text-muted-foreground">Esta planilla todavía no tiene resultados disponibles para explorar.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card sm:rounded-3xl">
      <div className="p-4 pb-3 sm:p-5 sm:pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><TableProperties className="size-4 text-primary" /><h2 className="text-sm font-extrabold">Resultados de la planilla</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">Cada protocolo e intento se conserva por separado. Tocá un deportista para abrir su evolución.</p>
            <p className="mt-1 text-[11px] font-semibold text-primary sm:hidden">Deslizá la tabla hacia los lados para ver todas las métricas.</p>
          </div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-extrabold text-primary">{`${filas.length} ${filas.length === 1 ? "deportista" : "deportistas"}`}</span>
        </div>
        {protocolos.length > 1 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => setProtocoloActivo("todos")} className={`min-h-11 shrink-0 rounded-full px-3.5 text-xs font-extrabold sm:min-h-8 ${protocoloActivo === "todos" ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}>Todos</button>
            {protocolos.map((protocolo) => <button key={protocolo.codigo} type="button" onClick={() => setProtocoloActivo(protocolo.codigo)} className={`min-h-11 shrink-0 rounded-full px-3.5 text-xs font-extrabold sm:min-h-8 ${protocoloActivo === protocolo.codigo ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}>{protocolo.nombre}</button>)}
          </div>
        )}
      </div>

      <div className="max-h-[70vh] overflow-auto border-t border-border">
        <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur">
            <tr>
              <th className="sticky left-0 z-30 min-w-44 max-w-44 border-b border-r border-border bg-muted px-3 py-3 font-extrabold sm:min-w-52 sm:max-w-52 sm:px-4">Deportista</th>
              {columnas.map((columna) => (
                <th key={columna.clave} className="min-w-28 border-b border-border px-2.5 py-3 align-bottom sm:min-w-36 sm:px-3">
                  <span className="block text-[11px] font-extrabold uppercase tracking-wide text-primary">{columna.protocolo}</span>
                  <span className="mt-0.5 block font-bold">{columna.atributo}</span>
                  <span className="font-medium text-muted-foreground">{columna.unidad ?? "sin unidad"}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.clave} className="group hover:bg-muted/30">
                <td className="sticky left-0 z-10 min-w-44 max-w-44 border-b border-r border-border bg-card px-3 py-3 group-hover:bg-muted sm:min-w-52 sm:max-w-52 sm:px-4">
                  {fila.deportistaId ? (
                    <Link href={`/secretaria/deportistas/${fila.deportistaId}`} className="grid w-full grid-cols-[minmax(0,1fr)_14px] items-center gap-1.5 font-extrabold text-primary hover:underline" title={fila.nombre}>
                      <span className="truncate whitespace-nowrap">{fila.nombre}</span><ArrowUpRight className="size-3.5" />
                    </Link>
                  ) : <span className="block truncate whitespace-nowrap font-extrabold" title={fila.nombre}>{fila.nombre}</span>}
                </td>
                {columnas.map((columna) => {
                  const valores = fila.valores.get(columna.clave) ?? [];
                  return (
                    <td key={columna.clave} className="border-b border-border px-2.5 py-2.5 align-top sm:px-3">
                      {valores.length ? <div className="flex flex-wrap gap-1">{valores.map((valor) => <span key={`${valor.intento}-${valor.valor}`} className="whitespace-nowrap rounded-md bg-secondary px-1.5 py-1 font-bold text-foreground" title={`Intento ${valor.intento}`}>{valores.length > 1 && <span className="mr-1 text-[10px] font-semibold text-muted-foreground">I{valor.intento}</span>}{formatearValor(valor.valor)}</span>)}</div> : <span className="text-muted-foreground/50">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
