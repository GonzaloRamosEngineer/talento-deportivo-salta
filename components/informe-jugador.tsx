"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { LogoTalento } from "@/components/logo";
import { EscudoClub } from "@/components/escudo-club";
import type { Deportista } from "@/lib/mock-data";
import {
  CLUB,
  edadLabel,
  formatFecha,
  getDeportista,
  nivelActual,
} from "@/lib/mock-data";
import { useDatos, type Datos } from "@/lib/use-datos";
import { tendencia } from "@/lib/tendencia";
import { EstadoBadge } from "@/components/estado-badge";
import { EvolutionChart } from "@/components/evolution-chart";
import { NivelBar } from "@/components/nivel-bar";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { CompartirInforme } from "@/components/compartir-informe";
import { usePerfil } from "@/components/perfil-context";

// Igual que FichaCliente: resuelve la fuente (mock demo o Supabase).
export function InformeCliente({ id }: { id: string }) {
  const datos = useDatos();

  if (datos.cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Preparando el informe…
      </div>
    );
  }
  const deportista = datos.real
    ? datos.deportistas.find((d) => d.id === id)
    : getDeportista(id);
  if (datos.error || !deportista) {
    return (
      <AvisoAcceso
        titulo="No pudimos armar este informe"
        detalle={
          datos.error ??
          "Este deportista no existe o está fuera de tus categorías asignadas."
        }
        accionHref="/deportistas"
        accionLabel="Ver tus deportistas"
      />
    );
  }
  return <InformeJugador deportista={deportista} datos={datos} />;
}

// Informe de evolución de UNA página, pensado para imprimirse y
// quedar en la mesa de una reunión. El botón imprimir desaparece en
// papel (print:hidden); el shell de navegación se oculta vía las
// reglas @media print de globals.css.
export function InformeJugador({
  deportista,
  datos,
}: {
  deportista: Deportista;
  datos: Datos;
}) {
  const { permisos } = usePerfil();
  const categoria = datos.categorias.find((c) => c.id === deportista.categoriaId);

  // Mismo alcance que la ficha (espejo del RLS)
  if (!permisos.veClub) {
    return (
      <AvisoAcceso
        titulo="La plataforma no accede a fichas"
        detalle="Los informes individuales son del club. La plataforma solo ve agregados."
        accionHref="/observatorio"
        accionLabel="Ir al observatorio"
      />
    );
  }
  if (
    !datos.real &&
    permisos.categorias &&
    !permisos.categorias.includes(deportista.categoriaId)
  ) {
    return (
      <AvisoAcceso
        titulo="Fuera de tus categorías"
        detalle="Este informe es de una categoría fuera de tus asignadas."
        accionHref="/deportistas"
        accionLabel="Ver tus deportistas"
      />
    );
  }
  const medidos = datos.atributos.filter((a) => deportista.mediciones[a.id]?.length);
  const fisicas = medidos.filter((a) => a.ambito === "fisico");
  const tecnicas = medidos.filter((a) => a.ambito === "tecnico");

  // Atributo destacado del gráfico: la física con más historia
  const destacado = [...fisicas].sort(
    (a, b) =>
      deportista.mediciones[b.id].length - deportista.mediciones[a.id].length,
  )[0];
  const serieDestacada = destacado ? deportista.mediciones[destacado.id] : [];
  const tDestacada = destacado ? tendencia(serieDestacada, destacado) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Controles (no se imprimen) */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/deportistas/${deportista.id}`}
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a la ficha
        </Link>
        <div className="flex items-center gap-2">
          <CompartirInforme deportista={deportista} datos={datos} />
          <button
            onClick={() => window.print()}
            className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground"
          >
            <Printer className="size-4" aria-hidden />
            Imprimir
          </button>
        </div>
      </div>

      {/* ---------- La hoja ---------- */}
      <div className="rounded-2xl border border-border bg-card p-5 print:rounded-none print:border-0 print:p-0">
        {/* Membrete */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <LogoTalento className="size-10" />
            <span className="leading-tight">
              <span className="block text-sm font-extrabold">
                Informe de evolución deportiva
              </span>
              <span className="block text-xs text-muted-foreground">
                {datos.clubNombre}
                {!datos.real && ` · ${CLUB.localidad}`}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-right text-xs text-muted-foreground">
              Generado el{" "}
              {new Date().toLocaleDateString("es-AR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            {datos.clubEscudoUrl && (
              <EscudoClub
                url={datos.clubEscudoUrl}
                nombre={datos.clubNombre}
                className="size-10"
              />
            )}
          </div>
        </div>

        {/* Datos del jugador */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 py-4">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {deportista.nombre} {deportista.apellido}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[
              categoria?.nombre ?? "Sin categoría",
              edadLabel(deportista.fechaNacimiento),
              deportista.lateralidad,
              datos.real
                ? deportista.docInterno && `doc. interno ${deportista.docInterno}`
                : `doc. interno AT-${deportista.id.slice(1).padStart(4, "0")}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {/* Trayectoria destacada */}
        {destacado && tDestacada && serieDestacada.length > 1 && (
          <section className="mb-4 rounded-xl border border-border p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold">
                Trayectoria: {destacado.nombre}{" "}
                <span className="font-semibold text-muted-foreground">
                  ({destacado.unidad}) ·{" "}
                  {formatFecha(serieDestacada[0].fecha)}{" "}
                  {new Date(serieDestacada[0].fecha).getFullYear()} →{" "}
                  {formatFecha(serieDestacada[serieDestacada.length - 1].fecha)}{" "}
                  {new Date(
                    serieDestacada[serieDestacada.length - 1].fecha,
                  ).getFullYear()}
                </span>
              </h2>
              <EstadoBadge estado={tDestacada.estado} />
            </div>
            <EvolutionChart
              serie={serieDestacada}
              atributo={destacado}
              hitos={deportista.historial}
            />
          </section>
        )}

        {/* Dos columnas: físicas y técnicas */}
        <div className="grid gap-4 sm:grid-cols-2">
          {fisicas.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-extrabold">
                Mediciones físicas{" "}
                <span className="font-semibold text-muted-foreground">
                  (con protocolo)
                </span>
              </h2>
              <table className="w-full text-sm">
                <tbody>
                  {fisicas.map((a) => {
                    const serie = deportista.mediciones[a.id];
                    const ultima = serie[serie.length - 1];
                    const t = tendencia(serie, a);
                    return (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="py-1.5 pr-2 font-semibold">{a.nombre}</td>
                        <td className="py-1.5 pr-2 text-right font-extrabold tabular-nums">
                          {ultima.valor.toLocaleString("es-AR")}{" "}
                          <span className="text-xs font-medium text-muted-foreground">
                            {a.unidad}
                          </span>
                        </td>
                        <td className="py-1.5 text-right">
                          <EstadoBadge estado={t.estado} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {tecnicas.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-extrabold">
                Apreciación técnica{" "}
                <span className="font-semibold text-muted-foreground">
                  (1-10, criterio del cuerpo técnico)
                </span>
              </h2>
              <table className="w-full text-sm">
                <tbody>
                  {tecnicas.map((a) => {
                    const valor = nivelActual(deportista, a.id)!;
                    return (
                      <tr key={a.id} className="border-b border-border last:border-0">
                        <td className="py-1.5 pr-2 font-semibold">{a.nombre}</td>
                        <td className="py-1.5">
                          <NivelBar nivel={valor} />
                        </td>
                        <td className="py-1.5 pl-2 text-right font-extrabold tabular-nums">
                          {valor.toLocaleString("es-AR", {
                            maximumFractionDigits: 1,
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
        </div>

        {/* Hitos */}
        {deportista.historial && deportista.historial.length > 0 && (
          <section className="mt-4">
            <h2 className="mb-1 text-sm font-extrabold">Trayectoria en el club</h2>
            <ul className="text-sm text-muted-foreground">
              {deportista.historial.map((h) => (
                <li key={h.fecha}>
                  {new Date(h.fecha + "T12:00:00").toLocaleDateString("es-AR", {
                    month: "long",
                    year: "numeric",
                  })}
                  : <span className="font-semibold text-foreground">{h.evento}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Pie */}
        <div className="mt-5 flex items-start gap-2 border-t border-border pt-3 text-[11px] leading-snug text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p>
            Registro longitudinal de evolución observada — no implica
            atribución causal del entrenamiento. Documento de uso interno del
            club; contiene datos de un menor amparados por consentimiento de
            su tutor/a. Plataforma Talento Deportivo Salta
            {!datos.real && " · prototipo con datos de ejemplo"}.
          </p>
        </div>
      </div>
    </div>
  );
}
