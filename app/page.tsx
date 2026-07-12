import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardPlus,
  Dumbbell,
  Landmark,
  Lock,
  ShieldCheck,
  Volleyball,
} from "lucide-react";
import { CurvaHero } from "@/components/landing/curva-hero";
import { Pelota } from "@/components/landing/pelota";
import { Reveal } from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "Talento Deportivo Salta — el talento no es una foto, es una curva",
  description:
    "La plataforma pública que guarda la evolución física y técnica de cada deportista de club formador. Hecha por gente de club, para gente de club. Fundación Evolución Antoniana × Digital Match Global.",
};

const CATEGORIAS_CINTA = [
  "Escuelita 2019",
  "Escuelita 2018",
  "Escuelita 2017",
  "Escuelita 2016",
  "Escuelita 2015",
  "Escuelita 2014",
  "9ª División",
  "8ª División",
  "7ª División",
  "6ª División",
  "5ª División",
  "4ª División",
  "3ª División",
  "Reserva",
  "Primera",
];

/* Número de paso con el círculo dibujado a mano */
function NumeroGarabato({ n }: { n: string }) {
  return (
    <span className="relative inline-flex size-14 items-center justify-center">
      <svg
        viewBox="0 0 56 56"
        className="absolute inset-0 rotate-[-4deg]"
        fill="none"
        aria-hidden
      >
        <path
          d="M28,5 C43,4 52,13 51,27 C50,43 41,52 27,51 C12,50 4,42 5,27 C6,13 15,6 30,5.5"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-marker text-3xl font-bold text-primary">{n}</span>
    </span>
  );
}

export default function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ---------- Nav ---------- */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Volleyball className="size-4.5" aria-hidden />
            </span>
            <span className="text-sm font-extrabold tracking-tight">
              Talento Deportivo <span className="text-primary">Salta</span>
            </span>
          </div>
          <nav className="flex items-center gap-2 md:gap-5">
            <a
              href="#como-funciona"
              className="hidden text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground md:block"
            >
              Cómo funciona
            </a>
            <a
              href="#privacidad"
              className="hidden text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground md:block"
            >
              Privacidad
            </a>
            <Link
              href="/panel"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              Ver la demo
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="mx-auto max-w-6xl px-4 pt-14 md:px-8 md:pt-24">
          <div className="max-w-3xl">
            <p
              className="landing-entrada text-xs font-extrabold uppercase tracking-[0.18em] text-primary"
              style={{ animationDelay: "0.05s" }}
            >
              Provincia de Salta · Deporte formativo
            </p>
            <h1
              className="landing-entrada mt-4 text-4xl font-extrabold leading-[1.04] tracking-tight md:text-6xl"
              style={{ animationDelay: "0.15s" }}
            >
              El talento no es una foto.
              <br />
              <span className="relative inline-block text-primary">
                Es una curva.
                <svg
                  className="absolute -bottom-3 left-0 w-full"
                  viewBox="0 0 300 14"
                  fill="none"
                  aria-hidden
                  preserveAspectRatio="none"
                >
                  <path
                    d="M4,9 C60,3 110,12 165,7 C210,3 255,10 296,6"
                    stroke="var(--primary)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    className="landing-curva-trazo"
                    style={{ "--largo-trazo": 300 } as React.CSSProperties}
                  />
                </svg>
              </span>
            </h1>
            <p
              className="landing-entrada mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
              style={{ animationDelay: "0.3s" }}
            >
              Un pibe de 11 años corre los 30 metros un martes a la tarde en
              el predio. Ese dato hoy no se anota, o muere en un papel. Acá se
              guarda, se suma al de la vez anterior, y de a poco aparece lo
              que ninguna foto muestra: <strong className="font-bold text-foreground">su
              historia</strong>.
            </p>
            <div
              className="landing-entrada mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "0.45s" }}
            >
              <Link
                href="/panel"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                Entrá a la demo
                <ArrowRight className="size-4.5" aria-hidden />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-base font-bold transition-colors hover:bg-muted"
              >
                Cómo funciona
              </a>
              <span className="font-marker basis-full rotate-[-1deg] text-lg text-muted-foreground md:basis-auto">
                (es una demo, tocá todo tranquilo)
              </span>
            </div>
          </div>

          {/* La curva es el héroe */}
          <div
            className="landing-entrada relative mt-12 rounded-2xl border border-border bg-card p-5 shadow-sm md:mt-16 md:p-8"
            style={{ animationDelay: "0.55s" }}
          >
            <p className="font-marker absolute -top-4 right-6 rotate-[2deg] text-xl text-primary md:text-2xl">
              16 meses de laburo, una sola imagen ↓
            </p>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-extrabold md:text-base">
                Velocidad 30m —{" "}
                <span className="text-muted-foreground">
                  un deportista de 9ª División
                </span>
              </h2>
            </div>
            <CurvaHero />
          </div>

          {/* La canchita: la pelota se patea */}
          <Pelota />
        </section>

        {/* ---------- Cinta de categorías ---------- */}
        <section
          aria-label="Categorías que cubre la plataforma"
          className="border-y border-border bg-card py-4"
        >
          <div className="overflow-hidden">
            <div className="landing-cinta flex w-max gap-3">
              {[0, 1].map((copia) => (
                <div
                  key={copia}
                  className="flex gap-3 pr-3"
                  aria-hidden={copia === 1}
                >
                  {CATEGORIAS_CINTA.map((c) => (
                    <span
                      key={`${copia}-${c}`}
                      className="whitespace-nowrap rounded-full border border-border px-4 py-1.5 text-sm font-bold text-muted-foreground"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- El problema: la planilla ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
            <Reveal>
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                ¿Sabés dónde está guardada la historia deportiva de un chico
                de 12 años?
              </h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                En la cabeza del profe. Con suerte, en una planilla que armó
                alguien que ya no está en el club. Cuando el profe se va — y
                los profes se van — se lleva años de trabajo formativo que no
                vuelven más.
              </p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Y sin registro no hay pregunta que se pueda responder en
                serio: ¿mejoró o solo creció? ¿se amesetó o lo estamos
                mirando mal? ¿en qué invierte la provincia cuando invierte en
                deporte de base?
              </p>
              <p className="mt-6 text-lg font-extrabold">
                Lo que no se registra, se pierde.{" "}
                <span className="font-marker text-2xl font-bold text-primary">
                  Así de simple.
                </span>
              </p>
            </Reveal>

            {/* La planilla vieja, tachada */}
            <Reveal demora={150}>
              <div className="relative mx-auto max-w-md">
                <div className="rotate-[-1.5deg] overflow-hidden rounded-lg border border-border bg-white shadow-md">
                  <div className="flex items-center gap-2 border-b border-border bg-[#edf0ec] px-3 py-2">
                    <span className="size-2.5 rounded-full bg-[#d9e0d8]" />
                    <span className="size-2.5 rounded-full bg-[#d9e0d8]" />
                    <p className="ml-1 truncate text-xs font-semibold text-muted-foreground">
                      planilla_inferiores_FINAL(2).xls
                    </p>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="px-3 py-2 font-semibold">Jugador</th>
                        <th className="px-2 py-2 font-semibold">Veloc.</th>
                        <th className="px-2 py-2 font-semibold">2023</th>
                        <th className="px-2 py-2 font-semibold">2024</th>
                      </tr>
                    </thead>
                    <tbody className="text-foreground/80">
                      {[
                        ["Fernández T.", "5,9", "—", "¿5,4?"],
                        ["Aguirre M.", "6,1", "—", "—"],
                        ["Guantay S.", "s/d", "—", "5,8"],
                        ["Cardozo L.", "5,7", "—", "—"],
                        ["(ilegible)", "—", "—", "—"],
                      ].map(([n, a, b, c]) => (
                        <tr key={n} className="border-b border-border/60">
                          <td className="px-3 py-2">{n}</td>
                          <td className="px-2 py-2">{a}</td>
                          <td className="px-2 py-2">{b}</td>
                          <td className="px-2 py-2">{c}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* El tachón */}
                <svg
                  className="pointer-events-none absolute inset-0"
                  viewBox="0 0 400 260"
                  fill="none"
                  aria-hidden
                  preserveAspectRatio="none"
                >
                  <path
                    d="M30,40 C120,90 280,160 375,225 M370,45 C280,100 120,170 25,220"
                    stroke="var(--destructive)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.75"
                  />
                </svg>
                <p className="font-marker absolute -bottom-9 right-0 rotate-[-2deg] text-xl font-bold text-destructive">
                  ¿y las mediciones de 2023? nadie sabe.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- Cómo funciona ---------- */}
        <section
          id="como-funciona"
          className="scroll-mt-16 border-y border-border bg-card"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
            <Reveal>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                La funcionalidad estrella
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                Medir tiene que ser más rápido que anotar en papel.
                <span className="text-muted-foreground">
                  {" "}
                  Si no, no pasa.
                </span>
              </h2>
              <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
                Lo dijimos desde el día uno: si cargar datos es un trámite, el
                profe deja de cargar y se acabó el proyecto. Por eso la
                pantalla más trabajada de toda la plataforma es la de carga.
                Celular, una mano, cronómetro en la otra.
              </p>
            </Reveal>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                {
                  n: "1",
                  titulo: "Elegís qué medir",
                  texto:
                    "Velocidad 30m, salto, talla, control de balón. Cada atributo tiene su protocolo escrito: se mide igual acá y en cualquier club.",
                },
                {
                  n: "2",
                  titulo: "Elegís la categoría",
                  texto:
                    "La Escuelita 2016, la 9ª, la Reserva. Te aparece el plantel completo, listo para recorrer de corrido.",
                },
                {
                  n: "3",
                  titulo: "Cargás de corrido",
                  texto:
                    "Números grandes, teclado decimal, guardás al final. La curva de cada pibe se actualiza sola.",
                },
              ].map((item, i) => (
                <Reveal key={item.n} demora={i * 140}>
                  <div className="flex h-full flex-col rounded-2xl border border-border bg-background p-6">
                    <NumeroGarabato n={item.n} />
                    <h3 className="mt-4 text-lg font-extrabold">
                      {item.titulo}
                    </h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">
                      {item.texto}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal demora={300}>
              <p className="font-marker mt-8 rotate-[-1deg] text-2xl font-bold text-primary">
                12 pibes medidos en menos de 2 minutos. Probado. ✓
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------- Qué hace (bento) ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              Lo que el club formador necesita.
              <span className="text-muted-foreground"> Nada más.</span>
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {/* La curva, protagonista: doble de ancho */}
            <Reveal className="md:col-span-2">
              <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md md:p-8">
                <div className="max-w-md">
                  <h3 className="text-xl font-extrabold">
                    La curva de evolución
                  </h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    Cada atributo es una serie en el tiempo. El estado —
                    creciendo, amesetado, en baja — se muestra con su
                    explicación al lado: «basado en tus últimas 3
                    mediciones». Sin algoritmos misteriosos, sin humo.
                  </p>
                </div>
                <svg
                  viewBox="0 0 320 80"
                  className="mt-6 w-full max-w-sm self-end opacity-90"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M8,62 C50,58 70,44 110,42 C150,40 165,48 200,38 C240,26 270,20 312,12"
                    stroke="var(--primary)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {[
                    [8, 62],
                    [110, 42],
                    [200, 38],
                    [312, 12],
                  ].map(([cx, cy]) => (
                    <circle
                      key={cx}
                      cx={cx}
                      cy={cy}
                      r="5"
                      fill="var(--primary)"
                      stroke="var(--card)"
                      strokeWidth="2"
                    />
                  ))}
                </svg>
              </div>
            </Reveal>
            {[
              {
                icon: ClipboardPlus,
                titulo: "Jornada de medición",
                texto:
                  "La carga rápida de toda una categoría, pensada para el borde de la cancha.",
              },
              {
                icon: CalendarDays,
                titulo: "Agenda y partidos",
                texto:
                  "El cronograma semanal, las sesiones y los partidos. En escuelitas no hay marcador: son encuentros formativos.",
              },
              {
                icon: Dumbbell,
                titulo: "Tablero de entrenamiento",
                texto:
                  "El foco de cada sesión y los jugadores por área, con un tap. Sirve igual en el celu y en el proyector.",
              },
              {
                icon: Landmark,
                titulo: "Observatorio provincial",
                texto:
                  "Cuando muchos clubes miden igual, la provincia por fin ve el mapa. Siempre agregado, nunca fichas.",
              },
            ].map(({ icon: Icon, titulo, texto }, i) => (
              <Reveal key={titulo} demora={(i % 3) * 120}>
                <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-extrabold">{titulo}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {texto}
                  </p>
                </div>
              </Reveal>
            ))}
            {/* Cierre a lo ancho: el tema pesado merece la fila entera */}
            <Reveal className="md:col-span-3">
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md sm:flex-row sm:items-center md:p-8">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <ShieldCheck className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg font-extrabold">
                    Consentimiento primero
                  </h3>
                  <p className="mt-1 max-w-3xl leading-relaxed text-muted-foreground">
                    Tutores y permisos son parte del alta de cada deportista,
                    no un anexo que alguien completa después. Lo pendiente
                    queda a la vista hasta que se resuelve.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------- Privacidad: el único bloque oscuro, a propósito ---------- */}
        <section id="privacidad" className="scroll-mt-16 bg-foreground">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
            <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:gap-16">
              <Reveal>
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Lock className="size-5" aria-hidden />
                </span>
                <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-background md:text-4xl">
                  Los datos de los pibes nunca salen del club.
                </h2>
                <p className="mt-4 max-w-xl leading-relaxed text-background/70">
                  Acá hay datos de menores, y eso nos obliga. No es una
                  promesa de marketing: el control de acceso vive en la base
                  de datos, fila por fila, desde el primer día. Ni siquiera
                  nosotros, los que operamos la plataforma, podemos ver una
                  ficha individual.
                </p>
                <p className="font-marker mt-6 rotate-[-1deg] text-2xl text-background/80">
                  — esto está escrito en el código, no en un folleto
                </p>
              </Reveal>
              <div className="flex flex-col gap-4">
                {[
                  "El profe ve solo sus categorías asignadas.",
                  "La comisión directiva consulta, no toca.",
                  "La provincia ve totales y promedios. Jamás un nombre.",
                  "El consentimiento del tutor es parte del alta, no un anexo.",
                  "Ningún chico tiene precio: acá no existe la valorización monetaria de menores.",
                  "Registramos tendencias. No prometemos que el entrenamiento «hizo» al jugador: los pibes también crecen solos.",
                ].map((linea, i) => (
                  <Reveal key={linea} demora={i * 90}>
                    <p className="border-l-2 border-primary pl-4 font-semibold leading-snug text-background/90">
                      {linea}
                    </p>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Para quién ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <Reveal>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              ¿Vos desde dónde lo mirás?
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                rol: "¿Sos profe?",
                texto:
                  "Cargás en 2 minutos y te llevás la curva de cada pibe tuyo. Tu laburo deja de perderse.",
              },
              {
                rol: "¿Manejás el club?",
                texto:
                  "Categorías, staff y consentimientos en un solo lugar. Y la historia queda en el club, no en un celular ajeno.",
              },
              {
                rol: "¿Estás en la comisión?",
                texto:
                  "Ves todo, sin poder romper nada. Decidís mirando curvas, no anécdotas de asado.",
              },
              {
                rol: "¿Sos de la provincia?",
                texto:
                  "El observatorio agregado del deporte de base. Dónde invertir, con datos y sin nombres.",
              },
            ].map(({ rol, texto }, i) => (
              <Reveal key={rol} demora={i * 110}>
                <div className="h-full rounded-2xl border border-border bg-card p-6">
                  <p className="font-marker text-2xl font-bold text-primary">
                    {rol}
                  </p>
                  <p className="mt-3 font-semibold leading-snug">{texto}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- CTA final ---------- */}
        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 text-center md:px-8 md:py-24">
            <Reveal>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                Infraestructura pública del deporte
              </p>
              <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
                El estándar salteño de datos del deporte formativo.
              </h2>
              <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
                Gratis para los clubes, sostenido por adopción institucional.
                Arranca en un club piloto de Salta, como tiene que ser:
                probándolo en la cancha antes de contarlo en un escritorio.
              </p>
              <div className="mt-8 flex justify-center">
                <Link
                  href="/panel"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.98]"
                >
                  Entrá a la demo
                  <ArrowRight className="size-4.5" aria-hidden />
                </Link>
              </div>
              <p className="font-marker mx-auto mt-8 max-w-md rotate-[-1deg] text-2xl text-muted-foreground">
                hecho por gente de club, para gente de club
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Volleyball className="size-3.5" aria-hidden />
            </span>
            <span className="font-bold text-foreground">
              Talento Deportivo Salta
            </span>
          </div>
          <p className="text-center">
            Una iniciativa de <strong>Fundación Evolución Antoniana</strong>{" "}
            · desarrollo <strong>Digital Match Global</strong>
          </p>
          <p>Hecho en Salta · {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
