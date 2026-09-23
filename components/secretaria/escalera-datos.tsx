import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { ResumenSecretaria } from "@/lib/use-secretaria";
import { cn } from "@/lib/utils";

/**
 * "Lo que tus datos ya permiten": la columna que le muestra a la Secretaría
 * el poder de tener las planillas centralizadas, con SUS números.
 *
 * No es un texto institucional: cada escalón se enciende con el estado real
 * del espacio y el siguiente dice qué falta para llegar. El mensaje es de
 * crecimiento —cada jornada que se suma hace más valiosa a la anterior—.
 *
 * Framing del producto (CLAUDE.md): registro y tendencia observada. Nada de
 * causalidad ni de rankings de deportistas.
 */

type Estado = "hecho" | "en-curso" | "proximo";

interface Escalon {
  titulo: string;
  detalle: string;
  estado: Estado;
  accion?: { href: string; label: string };
}

const MES = new Intl.DateTimeFormat("es-AR", { month: "short", year: "numeric" });

function mesAnio(fecha: string) {
  // Las fechas vienen como YYYY-MM-DD: se leen en hora local para que el
  // día 1 no caiga en el mes anterior por el huso horario.
  const [a, m, d] = fecha.split("-").map(Number);
  return MES.format(new Date(a, m - 1, d)).replace(".", "");
}

function escalones(resumen: ResumenSecretaria): Escalon[] {
  const { indicadores, lotes, jornadas } = resumen;
  const instituciones = new Set(lotes.map((lote) => lote.contexto.institucionOrigen)).size;

  const fechas = jornadas.map((j) => j.fecha).sort();
  const periodo =
    fechas.length > 1 && fechas[0] !== fechas.at(-1)
      ? ` · de ${mesAnio(fechas[0])} a ${mesAnio(fechas.at(-1)!)}`
      : "";

  // Un plantel "se puede seguir" cuando tiene jornadas en 2+ fechas
  // distintas de la misma disciplina: recién ahí hay una curva.
  const fechasPorPlantel = new Map<string, Set<string>>();
  for (const j of jornadas) {
    const clave = `${j.institucion}|${j.disciplina}|${j.grupo}`;
    if (!fechasPorPlantel.has(clave)) fechasPorPlantel.set(clave, new Set());
    fechasPorPlantel.get(clave)!.add(j.fecha);
  }
  const planteles = fechasPorPlantel.size;
  const conCurva = [...fechasPorPlantel.values()].filter((f) => f.size >= 2).length;
  const sinCurva = planteles - conCurva;

  const centralizado = indicadores.lotes > 0;
  const ordenado = indicadores.mediciones > 0;

  return [
    {
      titulo: "Centralizar",
      estado: centralizado ? "hecho" : "en-curso",
      detalle: centralizado
        ? `${indicadores.lotes} ${indicadores.lotes === 1 ? "planilla" : "planillas"} de ${instituciones} ${instituciones === 1 ? "institución" : "instituciones"}, en un solo lugar.`
        : "Cargá la primera planilla: deja de vivir en un archivo suelto.",
      accion: centralizado ? undefined : { href: "/evaluaciones/importar", label: "Cargar planilla" },
    },
    {
      titulo: "Ordenar",
      estado: ordenado ? "hecho" : centralizado ? "en-curso" : "proximo",
      detalle: ordenado
        ? `${indicadores.mediciones.toLocaleString("es-AR")} mediciones con fecha, protocolo y plantel${periodo}.`
        : "Al confirmar una planilla, cada medición queda con su fecha, protocolo y plantel.",
    },
    {
      titulo: "Seguir la evolución",
      estado: !ordenado ? "proximo" : sinCurva === 0 && conCurva > 0 ? "hecho" : "en-curso",
      detalle:
        conCurva === 0
          ? "Con una segunda jornada del mismo plantel empieza a verse la curva de cada deportista."
          : `${conCurva} de ${planteles} ${planteles === 1 ? "plantel" : "planteles"} ${conCurva === 1 ? "ya tiene" : "ya tienen"} 2 o más jornadas: su evolución se puede leer.${
              sinCurva > 0
                ? ` A ${sinCurva} ${sinCurva === 1 ? "le falta" : "les falta"} una segunda jornada.`
                : ""
            }`,
      accion: ordenado && sinCurva > 0 ? { href: "/secretaria/medir", label: "Medir otra vez" } : undefined,
    },
    {
      titulo: "Comparar y decidir",
      estado: "proximo",
      detalle:
        "Con el mismo protocolo en el tiempo, los reportes comparan disciplinas e instituciones sobre una base común.",
      accion: { href: "/secretaria/reportes", label: "Ver reportes" },
    },
  ];
}

export function EscaleraDatos({ resumen }: { resumen: ResumenSecretaria }) {
  const pasos = escalones(resumen);
  const alcanzados = pasos.filter((p) => p.estado === "hecho").length;
  const siguiente = pasos.findIndex((p) => p.estado === "proximo");

  return (
    <section className="rounded-3xl border border-primary/15 bg-gradient-to-br from-secondary/75 via-card to-card p-5 xl:p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">
          Lo que tus datos ya permiten
        </p>
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
          {`${alcanzados} de ${pasos.length}`}
        </span>
      </div>
      <h2 className="mt-1 text-lg font-extrabold tracking-tight">
        {alcanzados >= 2 ? "Tus planillas ya son una base de seguimiento" : "Tus planillas pueden ser una base de seguimiento"}
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Cada jornada que se suma hace más valiosa a la anterior: el mismo protocolo, sostenido en el tiempo, convierte mediciones sueltas en evolución.
      </p>

      <ol className="mt-5 flex flex-col">
        {pasos.map((paso, i) => {
          const ultimo = i === pasos.length - 1;
          return (
            <li key={paso.titulo} className="relative flex gap-3 pb-5 last:pb-0">
              {!ultimo && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[13px] top-7 bottom-0 w-0.5 rounded-full",
                    paso.estado === "hecho" ? "bg-primary/40" : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-extrabold",
                  paso.estado === "hecho" && "border-primary bg-primary text-primary-foreground",
                  paso.estado === "en-curso" && "border-primary bg-card text-primary",
                  paso.estado === "proximo" && "border-border bg-card text-muted-foreground",
                )}
              >
                {paso.estado === "hecho" ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-extrabold">
                  <span className={paso.estado === "proximo" ? "text-muted-foreground" : undefined}>{paso.titulo}</span>
                  {paso.estado === "en-curso" && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-primary">En curso</span>
                  )}
                  {i === siguiente && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Lo que viene</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{paso.detalle}</p>
                {paso.accion && (
                  <Link
                    href={paso.accion.href}
                    className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs font-extrabold text-primary transition-transform duration-150 ease-(--ease-out) active:scale-[0.97] motion-reduce:active:scale-100 sm:min-h-8"
                  >
                    {paso.accion.label}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
