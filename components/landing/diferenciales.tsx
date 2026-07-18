import { Reveal } from "@/components/landing/reveal";
import {
  VinetaEstiron,
  VinetaImportar,
  VinetaOffline,
  VinetaWhatsapp,
} from "@/components/landing/vinetas";

/**
 * Los cuatro diferenciales reales del producto, cada uno con su
 * viñeta VIVA (mini demo-reel en loop, ver vinetas.tsx) en vez de un
 * ícono genérico: offline en el predio, el estirón sobre la serie de
 * talla, el plantel pegado desde Excel y el informe al tutor por
 * WhatsApp. Los copys respetan el framing honesto (registro
 * observado, nunca diagnóstico ni atribución causal) — ver CLAUDE.md.
 */

const DIFERENCIALES = [
  {
    eyebrow: "En el predio",
    titulo: "Sin señal, sin drama",
    texto:
      "El predio no tiene señal — eso ya lo sabemos. Por eso la jornada se guarda como borrador en el celular a cada tecla: si se corta, no se pierde ni un dato, y al volver la app te ofrece retomar donde estabas.",
    vineta: <VinetaOffline />,
  },
  {
    eyebrow: "Ciencia sin humo",
    titulo: "El estirón, puesto en el gráfico",
    texto:
      "Sobre la misma serie de talla que ya cargás, el sistema marca cuándo el ritmo de crecimiento se acelera: centímetros por año del propio pibe, con umbral por sexo, y la estimación del pico (Moore et al., 2015) mostrada como lo que es — una estimación, siempre con su margen de ±7 meses. Registro observado, nunca diagnóstico.",
    vineta: <VinetaEstiron />,
  },
  {
    eyebrow: "El día 1",
    titulo: "El plantel entra pegando tu planilla",
    texto:
      "Nadie va a retipear 40 pibes. Copiás las celdas del Excel que ya tenés y las pegás: columnas autodetectadas, categorías resueltas por año de nacimiento, duplicados afuera y vista previa antes de confirmar. Lo único que no se importa jamás es el consentimiento: ese se firma.",
    vineta: <VinetaImportar />,
  },
  {
    eyebrow: "Las familias",
    titulo: "El informe le llega al tutor por WhatsApp",
    texto:
      "El resumen del deportista sale como mensaje directo al chat del tutor: la curva contada en texto, con el mismo lenguaje honesto de adentro. Las familias no necesitan usuario ni contraseña — el club les acerca el dato.",
    vineta: <VinetaWhatsapp />,
  },
];

export function Diferenciales() {
  return (
    <section
      id="diferenciales"
      className="scroll-mt-16 border-y border-border bg-card"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
        <Reveal>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
            Por qué no es una planilla más
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            Los detalles que solo se aprenden en la cancha.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Cuatro decisiones de producto que no salen de un escritorio.
            Salen de medir un martes a la tarde, con una mano ocupada y
            sin señal.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {DIFERENCIALES.map(({ eyebrow, titulo, texto, vineta }, i) => (
            <Reveal key={titulo} demora={(i % 2) * 140}>
              <div className="flex h-full flex-col rounded-2xl border border-border bg-background p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md md:p-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
                  {eyebrow}
                </p>
                <h3 className="mt-2 text-xl font-extrabold">{titulo}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {texto}
                </p>
                <div className="mt-6 flex flex-1 items-end">{vineta}</div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal demora={280}>
          <p className="font-marker mt-10 rotate-[-1deg] text-2xl font-bold text-primary">
            — nada de esto se inventa en una oficina
          </p>
        </Reveal>
      </div>
    </section>
  );
}
