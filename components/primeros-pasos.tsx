"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import type { Datos } from "@/lib/use-datos";
import type { Agenda } from "@/lib/use-agenda";
import type { ClubResumen } from "@/lib/mock-data";

// Card de onboarding del panel: los primeros pasos de cada rol,
// calculados del estado REAL de la base (nada se marca a mano) y
// tildados solos a medida que el club avanza. Cuando todos los pasos
// están hechos, la card desaparece — sin tours ni overlays.

interface Paso {
  key: string;
  titulo: string;
  detalle: string;
  /** a dónde ir a hacerlo; sin href = depende de otra persona */
  href?: string;
  hecho: boolean;
}

function PasosCard({ pasos }: { pasos: Paso[] }) {
  const hechos = pasos.filter((p) => p.hecho).length;
  if (pasos.length === 0 || hechos === pasos.length) return null;
  const siguiente = pasos.find((p) => !p.hecho)?.key;

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/30 bg-card">
      <div className="flex items-baseline justify-between px-4 pt-3.5 pb-2.5">
        <h2 className="text-base font-extrabold">Primeros pasos</h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {hechos} de {pasos.length}
        </span>
      </div>
      <div className="mx-4 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${Math.max(4, (hechos / pasos.length) * 100)}%` }}
        />
      </div>
      <ol className="mt-1.5 flex flex-col">
        {pasos.map((p) => {
          const contenido = (
            <>
              {p.hecho ? (
                <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
              ) : (
                <Circle
                  className="size-5 shrink-0 text-muted-foreground/40"
                  aria-hidden
                />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold ${
                    p.hecho ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  <span>{p.titulo}</span>
                  {p.key === siguiente && p.href && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      Siguiente
                    </span>
                  )}
                </span>
                {!p.hecho && (
                  <span className="block text-xs text-muted-foreground">
                    {p.detalle}
                  </span>
                )}
              </span>
              {!p.hecho && p.href && (
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
            </>
          );
          return (
            <li key={p.key}>
              {!p.hecho && p.href ? (
                <Link
                  href={p.href}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                >
                  {contenido}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-4 py-2.5">{contenido}</div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="px-4 pt-0.5 pb-3 text-[11px] leading-snug text-muted-foreground">
        Esta guía se tilda sola con lo que ya cargaste y desaparece al completarse.
      </p>
    </section>
  );
}

/** Primeros pasos de admin y profe, calculados de useDatos + useAgenda. */
export function PrimerosPasos({
  datos,
  agenda,
  gestiona,
  opera,
}: {
  datos: Datos;
  agenda: Agenda;
  gestiona: boolean;
  opera: boolean;
}) {
  // Solo con sesión real: la demo pública ya viene con el club andando.
  if (!datos.real || datos.cargando || agenda.cargando || datos.error) return null;
  if (!opera && !gestiona) return null; // comisión: consulta pura, sin pasos

  const hayMedicion = datos.deportistas.some(
    (d) => Object.values(d.mediciones).flat().length > 0,
  );

  if (gestiona) {
    const pasos: Paso[] = [
      {
        key: "categorias",
        titulo: "Armá las categorías del club",
        detalle:
          "Divisiones y escuelitas por año de nacimiento; hay una estructura estándar lista para generar.",
        href: "/club/categorias",
        hecho: datos.categorias.length > 0,
      },
      {
        key: "staff",
        titulo: "Invitá a tu cuerpo técnico",
        detalle:
          "Cada profe entra con un link y ve solo sus categorías asignadas.",
        href: "/club/staff",
        hecho: agenda.staff >= 2,
      },
      {
        key: "agenda",
        titulo: "Cargá lugares y cronograma",
        detalle:
          "Con los días y horarios fijos de cada categoría, la agenda semanal se arma sola.",
        href: "/club/agenda",
        hecho: agenda.horarios.length > 0,
      },
      {
        key: "deportista",
        titulo: "Sumá el primer deportista",
        detalle: "Ficha, tutor y consentimiento en un solo paso.",
        href: "/deportistas/nuevo",
        hecho: datos.deportistas.length > 0,
      },
      {
        key: "medicion",
        titulo: "Hacé la primera jornada de medición",
        detalle: "Un atributo para toda una categoría, de corrido.",
        href: "/medicion",
        hecho: hayMedicion,
      },
    ];
    return <PasosCard pasos={pasos} />;
  }

  // Profe sin categorías asignadas: no puede hacer nada todavía.
  if (datos.categorias.length === 0) {
    return (
      <PasosCard
        pasos={[
          {
            key: "asignacion",
            titulo: "Falta que te asignen categorías",
            detalle:
              "El admin del club te asigna categorías desde Staff; cuando lo haga, acá vas a ver tu plantel y tus pasos.",
            hecho: false,
          },
        ]}
      />
    );
  }

  const hayCurva = datos.deportistas.some((d) =>
    Object.values(d.mediciones).some((serie) => serie.length >= 2),
  );
  const pasoListaHecho = agenda.sesiones.some((s) => s.estado === "realizada");

  const pasos: Paso[] = [
    {
      key: "deportista",
      titulo: "Sumá tu primer deportista",
      detalle: "Ficha, tutor y consentimiento en un solo paso.",
      href: "/deportistas/nuevo",
      hecho: datos.deportistas.length > 0,
    },
    {
      key: "medicion",
      titulo: "Hacé tu primera jornada de medición",
      detalle: "Un atributo para toda la categoría, de corrido.",
      href: "/medicion",
      hecho: hayMedicion,
    },
    {
      key: "curva",
      titulo: "Volvé a medir otro día",
      detalle: "Con la segunda medición aparece la curva de evolución.",
      href: "/medicion",
      hecho: hayCurva,
    },
    {
      key: "lista",
      titulo: "Pasá lista en un entrenamiento",
      detalle: "Desde la agenda de la semana, en dos toques.",
      href: "/sesiones",
      hecho: pasoListaHecho,
    },
  ];
  return <PasosCard pasos={pasos} />;
}

/** Primeros pasos del operador de plataforma, calculados del observatorio. */
export function PrimerosPasosPlataforma({
  clubes,
  real,
}: {
  clubes: ClubResumen[];
  real: boolean;
}) {
  if (!real) return null;
  const pasos: Paso[] = [
    {
      key: "club",
      titulo: "Creá el primer club",
      detalle: "Alta del club y link de acceso para su admin, todo por pantalla.",
      href: "/plataforma/clubes",
      hecho: clubes.length > 0,
    },
    {
      key: "categorias",
      titulo: "El club armó sus categorías",
      detalle:
        "Lo hace el admin del club al entrar; si no arranca, avisale por WhatsApp.",
      hecho: clubes.some((c) => c.categoriasActivas > 0),
    },
    {
      key: "deportistas",
      titulo: "El club cargó deportistas",
      detalle: "Se ve reflejado acá apenas el club suma su primer plantel.",
      hecho: clubes.some((c) => c.deportistas > 0),
    },
    {
      key: "mediciones",
      titulo: "El club empezó a medir",
      detalle: "Con la primera jornada de medición, el observatorio cobra vida.",
      href: "/observatorio",
      hecho: clubes.some((c) => c.medicionesMes > 0),
    },
  ];
  return <PasosCard pasos={pasos} />;
}
