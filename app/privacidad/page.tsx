import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { LogoTalento } from "@/components/logo";

export const metadata: Metadata = {
  title: "Privacidad — Talento Deportivo Salta",
  description:
    "Cómo la plataforma Talento Deportivo Salta trata los datos de deportistas (en su mayoría menores), tutores y cuerpo técnico.",
};

// Página pública de privacidad. Vive fuera del AppShell (ver
// components/app-shell.tsx). Lenguaje llano, sin letra chica: es una
// herramienta de confianza institucional, no un contrato defensivo.
// Marco: Ley 25.326 de Protección de Datos Personales (Argentina).

const ACTUALIZADO = "14 de julio de 2026";

export default function PaginaPrivacidad() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-10">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver
      </Link>

      <div className="mb-8 flex items-center gap-3">
        <LogoTalento className="size-10" />
        <div className="leading-tight">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Política de privacidad
          </h1>
          <p className="text-sm text-muted-foreground">
            Talento Deportivo Salta · actualizada el {ACTUALIZADO}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-secondary/50 p-4 text-sm leading-relaxed">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <p>
          Esta plataforma registra la evolución deportiva de chicas y chicos,
          en su mayoría <strong>menores de edad</strong>. Tratamos esos datos
          con el cuidado que eso exige: mínimos necesarios, con consentimiento
          del tutor/a, accesibles solo para el cuerpo técnico del club y nunca
          vendidos ni cedidos a terceros.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-7 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-extrabold [&_p]:mt-2 [&_p]:text-muted-foreground [&_li]:mt-1 [&_li]:text-muted-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        <section>
          <h2>Quiénes somos</h2>
          <p>
            Talento Deportivo Salta es una plataforma desarrollada e impulsada
            por la <strong>Fundación Evolución Antoniana</strong> para que los
            clubes formadores lleven un registro serio del desarrollo de sus
            deportistas. La Fundación y el club en el que está cargado cada
            deportista son responsables del tratamiento de esos datos.
          </p>
        </section>

        <section>
          <h2>Qué datos tratamos</h2>
          <ul>
            <li>
              <strong>De los deportistas:</strong> nombre, fecha de nacimiento,
              categoría, lateralidad y un documento interno del club (usamos un
              código interno, <em>no</em> el DNI). Además, las mediciones que el
              club registra en el tiempo (físicas con protocolo y apreciaciones
              técnicas) y la asistencia a los entrenamientos.
            </li>
            <li>
              <strong>De los tutores/as:</strong> nombre, vínculo con el
              deportista y un contacto (teléfono o correo), para las
              comunicaciones del club y el consentimiento.
            </li>
            <li>
              <strong>Del cuerpo técnico:</strong> nombre y correo electrónico,
              únicamente para dar acceso a la plataforma.
            </li>
          </ul>
          <p>
            No pedimos ni guardamos datos sensibles (salud, biometría con fines
            de identificación, etc.) más allá de las mediciones deportivas
            descritas, y aplicamos el principio de <strong>minimización</strong>
            : solo lo necesario para la finalidad de abajo.
          </p>
        </section>

        <section>
          <h2>Para qué los usamos</h2>
          <p>
            Con una única finalidad: que el club acompañe la{" "}
            <strong>evolución deportiva</strong> de cada chico a lo largo del
            tiempo y organice su trabajo formativo. Es un{" "}
            <strong>registro longitudinal de lo observado</strong>, no una
            prueba de que un entrenamiento causó una mejora — en chicos, buena
            parte del cambio es crecimiento y maduración.
          </p>
          <p>
            <strong>No</strong> usamos estos datos para valorización económica
            de menores, scouting de mercado, publicidad ni ningún fin comercial.
          </p>
        </section>

        <section>
          <h2>Base legal: el consentimiento del tutor/a</h2>
          <p>
            Cargar a un menor requiere el consentimiento de su madre, padre o
            tutor/a, que se otorga por escrito y queda registrado. Ese
            consentimiento se puede <strong>revocar</strong> en cualquier
            momento; al hacerlo, el club deja de registrar nuevos datos del
            deportista y se procede según los derechos de abajo.
          </p>
        </section>

        <section>
          <h2>Quién puede ver los datos</h2>
          <ul>
            <li>
              Solo el <strong>cuerpo técnico del club</strong> donde está el
              deportista, y cada rol ve lo que le corresponde: un entrenador
              accede únicamente a sus categorías asignadas.
            </li>
            <li>
              La <strong>plataforma</strong> (nivel provincial) ve exclusivamente
              <strong> totales agregados por club</strong> (cuántos deportistas,
              cuántas mediciones, % de consentimientos) — <em>nunca</em> datos
              de un chico en particular.
            </li>
            <li>
              No compartimos, cedemos ni vendemos los datos a terceros. No hay
              publicidad.
            </li>
          </ul>
        </section>

        <section>
          <h2>Tus derechos</h2>
          <p>
            El tutor/a puede pedir en cualquier momento{" "}
            <strong>acceder</strong> a los datos del deportista,{" "}
            <strong>rectificarlos</strong> si hay un error,{" "}
            <strong>actualizarlos</strong> o solicitar su{" "}
            <strong>supresión</strong>. Se ejerce ante el club o escribiendo a la
            Fundación (contacto abajo); respondemos en los plazos de la Ley
            25.326. La autoridad de control en Argentina es la Agencia de Acceso
            a la Información Pública (AAIP).
          </p>
        </section>

        <section>
          <h2>Cómo los cuidamos</h2>
          <ul>
            <li>
              Acceso restringido por reglas a nivel de base de datos (cada
              usuario solo alcanza lo que su rol permite).
            </li>
            <li>Copias de resguardo periódicas para no perder información.</li>
            <li>
              Datos alojados en servidores de nuestro proveedor de
              infraestructura (Supabase); el hosting de la aplicación es Vercel.
            </li>
          </ul>
        </section>

        <section>
          <h2>Conservación</h2>
          <p>
            Conservamos los datos mientras el deportista esté vinculado al club
            y por el tiempo razonable posterior para fines históricos del propio
            club. Ante una baja definitiva o una solicitud de supresión, se
            eliminan del sistema.
          </p>
        </section>

        <section>
          <h2>Contacto</h2>
          <p>
            Por cualquier consulta sobre tus datos o los de tu hijo/a, escribí a
            la Fundación Evolución Antoniana:{" "}
            <a
              href="mailto:contacto@evolucionantoniana.com"
              className="font-semibold text-primary underline underline-offset-2"
            >
              contacto@evolucionantoniana.com
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-10 border-t border-border pt-5 text-xs text-muted-foreground">
        Podemos actualizar esta política; la fecha de arriba indica la última
        revisión. Si el cambio es significativo, lo comunicaremos a través del
        club.
      </p>
    </main>
  );
}
