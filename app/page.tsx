import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardPlus,
  Dumbbell,
  Landmark,
  LineChart,
  Lock,
  ShieldCheck,
  Volleyball,
} from "lucide-react";
import { CurvaHero } from "@/components/landing/curva-hero";
import { Reveal } from "@/components/landing/reveal";

export const metadata: Metadata = {
  title: "Talento Deportivo Salta — el talento no es una foto, es una curva",
  description:
    "La plataforma pública que registra la evolución física y técnica de cada deportista de club formador. Medición a medición, año a año. Una iniciativa de Fundación Evolución Antoniana y Digital Match Global.",
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

const FEATURES = [
  {
    icon: LineChart,
    titulo: "La curva de evolución",
    texto:
      "Cada atributo es una serie temporal: talla, velocidad, salto, técnica. El estado —creciendo, amesetado, en baja— se muestra explícito y explicado, nunca como algoritmo opaco.",
  },
  {
    icon: ClipboardPlus,
    titulo: "Jornada de medición",
    texto:
      "El flujo estrella: atributo → categoría → carga de corrido. Doce chicos en menos de dos minutos, desde el celular, en el borde de la cancha.",
  },
  {
    icon: CalendarDays,
    titulo: "Agenda del club",
    texto:
      "Cronograma semanal por categoría, sesiones con estado y lugar, y los partidos del fin de semana. En escuelitas no hay marcador: son encuentros formativos.",
  },
  {
    icon: Dumbbell,
    titulo: "Tablero de entrenamiento",
    texto:
      "Planificá el foco de cada sesión y asigná jugadores por área con un tap. Funciona igual en el celular del profe y en el proyector de la reunión.",
  },
  {
    icon: Landmark,
    titulo: "Observatorio provincial",
    texto:
      "Cuando varios clubes miden con el mismo estándar, la provincia ve el mapa completo del deporte de base — siempre con datos agregados, nunca fichas.",
  },
  {
    icon: ShieldCheck,
    titulo: "Consentimiento primero",
    texto:
      "Tutores y consentimientos son parte del alta, no un anexo. Lo pendiente queda visible hasta resolverse, y los datos se minimizan por diseño.",
  },
];

const ROLES = [
  {
    rol: "Profe",
    texto: "Carga y ve SOLO sus categorías. Su memoria deja de irse con él.",
  },
  {
    rol: "Club",
    texto: "Administra categorías, staff y consentimientos. Ve todo su club.",
  },
  {
    rol: "Comisión",
    texto: "Supervisa en solo-lectura. Decide con la curva, no con la anécdota.",
  },
  {
    rol: "Provincia",
    texto: "Ve agregados del observatorio. Nunca un dato individual de un menor.",
  },
];

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
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Ver la demo
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-14 md:px-8 md:pb-20 md:pt-24">
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
              <span className="text-primary">Es una curva.</span>
            </h1>
            <p
              className="landing-entrada mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
              style={{ animationDelay: "0.3s" }}
            >
              La plataforma pública que registra la evolución física y técnica
              de cada deportista de club formador — medición a medición, año a
              año. Para que ningún pibe dependa de la memoria del profe que se
              fue.
            </p>
            <div
              className="landing-entrada mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "0.45s" }}
            >
              <Link
                href="/panel"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
              >
                Explorar la demo
                <ArrowRight className="size-4.5" aria-hidden />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-base font-bold transition-colors hover:bg-muted"
              >
                Cómo funciona
              </a>
              <span className="basis-full text-xs text-muted-foreground md:basis-auto">
                Demo pública · datos de ejemplo
              </span>
            </div>
          </div>

          {/* La curva es el héroe */}
          <div
            className="landing-entrada mt-12 rounded-2xl border border-border bg-card p-5 shadow-sm md:mt-16 md:p-8"
            style={{ animationDelay: "0.55s" }}
          >
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-extrabold md:text-base">
                Velocidad 30m —{" "}
                <span className="text-muted-foreground">
                  un deportista, 16 meses de registro
                </span>
              </h2>
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-secondary-foreground">
                Serie real de demo
              </span>
            </div>
            <CurvaHero />
          </div>
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

        {/* ---------- El problema ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <div className="grid gap-10 md:grid-cols-2 md:gap-16">
            <Reveal>
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                El estado del arte en el club formador es una planilla vieja.
                <span className="text-muted-foreground"> Cuando existe.</span>
              </h2>
            </Reveal>
            <div className="flex flex-col gap-6">
              {[
                {
                  titulo: "La evolución no se ve",
                  texto:
                    "Sin serie temporal nadie sabe si el chico mejoró, se amesetó o simplemente creció. La foto de hoy no cuenta la historia.",
                },
                {
                  titulo: "La memoria se va con el profe",
                  texto:
                    "Años de trabajo formativo viven en la cabeza de una persona. Cambia el profe, y el club arranca de cero.",
                },
                {
                  titulo: "La provincia decide a ciegas",
                  texto:
                    "Sin datos comparables entre clubes, invertir en deporte de base es apostar. Con un estándar común, es planificar.",
                },
              ].map((item, i) => (
                <Reveal key={item.titulo} demora={i * 120}>
                  <div className="border-l-2 border-primary pl-5">
                    <h3 className="text-lg font-extrabold">{item.titulo}</h3>
                    <p className="mt-1 leading-relaxed text-muted-foreground">
                      {item.texto}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Cómo funciona: la jornada de medición ---------- */}
        <section
          id="como-funciona"
          className="border-y border-border bg-card scroll-mt-16"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
            <Reveal>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                La funcionalidad estrella
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
                Doce chicos medidos en menos de dos minutos.{" "}
                <span className="text-muted-foreground">Con una mano.</span>
              </h2>
              <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
                Si medir es un trámite, el club deja de medir — y sin
                mediciones no hay curva. Por eso la carga se diseñó primero,
                para el celular del profe en el borde de la cancha.
              </p>
            </Reveal>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                {
                  paso: "01",
                  titulo: "Elegí el atributo",
                  texto:
                    "Velocidad 30m, salto, talla, control de balón… Un catálogo estandarizado, con protocolo escrito para que la medición sea comparable.",
                },
                {
                  paso: "02",
                  titulo: "Elegí la categoría",
                  texto:
                    "La Escuelita 2016, la 9ª, la Reserva. Aparece la lista completa del plantel, lista para recorrer de corrido.",
                },
                {
                  paso: "03",
                  titulo: "Cargá de corrido",
                  texto:
                    "Inputs numéricos grandes, teclado decimal, progreso visible y guardado al final. La curva de cada chico se actualiza sola.",
                },
              ].map((item, i) => (
                <Reveal key={item.paso} demora={i * 140}>
                  <div className="flex h-full flex-col rounded-2xl border border-border bg-background p-6">
                    <span className="text-4xl font-extrabold tracking-tight text-primary/25">
                      {item.paso}
                    </span>
                    <h3 className="mt-3 text-lg font-extrabold">
                      {item.titulo}
                    </h3>
                    <p className="mt-2 leading-relaxed text-muted-foreground">
                      {item.texto}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <Reveal>
            <h2 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              Todo lo que el club formador necesita.
              <span className="text-muted-foreground">
                {" "}
                Nada de lo que no.
              </span>
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, titulo, texto }, i) => (
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
                  Los datos individuales de los menores nunca salen del club.
                </h2>
                <p className="mt-4 max-w-xl leading-relaxed text-background/70">
                  No es una promesa de marketing: es la arquitectura. El
                  control de acceso vive en la base de datos, fila por fila,
                  desde el primer día — no en la buena voluntad de una
                  pantalla.
                </p>
              </Reveal>
              <div className="flex flex-col gap-4">
                {[
                  "El profe accede solo a sus categorías asignadas.",
                  "La comisión directiva consulta, no edita.",
                  "La provincia ve agregados. Nunca una ficha.",
                  "Consentimiento de tutores como requisito estructural.",
                  "Ningún chico tiene precio: acá no existe la valorización monetaria de menores.",
                  "Registramos tendencias observadas. No vendemos promesas causales.",
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

        {/* ---------- Roles ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <Reveal>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              Una plataforma, cuatro miradas.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map(({ rol, texto }, i) => (
              <Reveal key={rol} demora={i * 110}>
                <div className="h-full rounded-2xl border border-border bg-card p-6">
                  <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">
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
                El estándar provincial de datos del deporte formativo.
              </h2>
              <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
                Gratuito para los clubes, sostenido por adopción
                institucional. Empieza en Salta, con un club piloto y una
                convicción: lo que no se registra, se pierde.
              </p>
              <div className="mt-8 flex justify-center">
                <Link
                  href="/panel"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                >
                  Explorar la demo
                  <ArrowRight className="size-4.5" aria-hidden />
                </Link>
              </div>
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
