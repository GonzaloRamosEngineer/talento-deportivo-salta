"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Printer, ShieldCheck } from "lucide-react";
import { LogoTalento } from "@/components/logo";
import { EscudoClub } from "@/components/escudo-club";
import type { Deportista } from "@/lib/mock-data";
import { CLUB, edadLabel, getDeportista } from "@/lib/mock-data";
import { useDatos, type Datos } from "@/lib/use-datos";
import { crearClienteBrowser } from "@/lib/supabase/client";
import { AvisoAcceso } from "@/components/aviso-acceso";
import { usePerfil } from "@/components/perfil-context";

// Formulario de consentimiento informado, pre-completado con los datos
// del deportista/tutor/club, pensado para IMPRIMIR y firmar en papel.
// Es el paso legal del piloto; la firma electrónica queda en el roadmap.
// Mismo patrón que el informe: los controles se ocultan al imprimir
// (print:hidden) y el shell lo esconden las reglas @media print.

// línea con texto fijo + espacio punteado para completar a mano.
// min-w-fit: la línea nunca se comprime por debajo de su contenido —
// en pantallas angostas baja entera al renglón siguiente (flex-wrap
// del padre) en vez de encimarse con lo que tiene al lado.
function Linea({ texto, valor }: { texto: string; valor?: string | null }) {
  return (
    <span className="inline-flex max-w-full min-w-fit flex-1 items-baseline gap-1">
      <span className="shrink-0">{texto}</span>
      <span className="min-w-24 flex-1 border-b border-dotted border-foreground/50 px-1 font-semibold">
        {valor || " "}
      </span>
    </span>
  );
}

export function ConsentimientoCliente({ id }: { id: string }) {
  const datos = useDatos();

  if (datos.cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Preparando el formulario…
      </div>
    );
  }
  const deportista = datos.real
    ? datos.deportistas.find((d) => d.id === id)
    : getDeportista(id);
  if (datos.error || !deportista) {
    return (
      <AvisoAcceso
        titulo="No pudimos armar el formulario"
        detalle={
          datos.error ??
          "Este deportista no existe o está fuera de tus categorías asignadas."
        }
        accionHref="/deportistas"
        accionLabel="Ver tus deportistas"
      />
    );
  }
  return <Consentimiento deportista={deportista} datos={datos} />;
}

function Consentimiento({
  deportista,
  datos,
}: {
  deportista: Deportista;
  datos: Datos;
}) {
  const { permisos } = usePerfil();
  const [tutor, setTutor] = useState<{
    nombre: string;
    relacion: string | null;
  } | null>(null);

  // El tutor no viene en useDatos; consulta puntual con sesión real.
  useEffect(() => {
    if (!datos.real) return;
    let cancelado = false;
    crearClienteBrowser()
      .from("tutor")
      .select("nombre, relacion")
      .eq("deportista_id", deportista.id)
      .limit(1)
      .then(({ data }) => {
        if (!cancelado && data?.[0]) setTutor(data[0]);
      });
    return () => {
      cancelado = true;
    };
  }, [datos.real, deportista.id]);

  if (!permisos.veClub) {
    return (
      <AvisoAcceso
        titulo="La plataforma no accede a fichas"
        detalle="Los formularios individuales son del club. La plataforma solo ve agregados."
        accionHref="/observatorio"
        accionLabel="Ir al observatorio"
      />
    );
  }

  const categoria = datos.categorias.find((c) => c.id === deportista.categoriaId);
  const docInterno = datos.real
    ? deportista.docInterno
    : `AT-${deportista.id.slice(1).padStart(4, "0")}`;
  const localidad = datos.real ? "" : CLUB.localidad;

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
        <button
          onClick={() => window.print()}
          className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground"
        >
          <Printer className="size-4" aria-hidden />
          Imprimir
        </button>
      </div>

      {/* ---------- La hoja ---------- */}
      <div className="rounded-2xl border border-border bg-card p-6 text-sm leading-relaxed print:rounded-none print:border-0 print:p-0">
        {/* Membrete */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <LogoTalento className="size-10" />
            <span className="leading-tight">
              <span className="block text-sm font-extrabold">
                Consentimiento informado del tutor/a
              </span>
              <span className="block text-xs text-muted-foreground">
                {datos.clubNombre}
                {localidad && ` · ${localidad}`}
              </span>
            </span>
          </div>
          {datos.clubEscudoUrl && (
            <EscudoClub
              url={datos.clubEscudoUrl}
              nombre={datos.clubNombre}
              className="size-10"
            />
          )}
        </div>

        {/* Datos del deportista */}
        <section className="py-4">
          <h2 className="mb-2 text-sm font-extrabold">Datos del deportista</h2>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Linea
                texto="Nombre y apellido:"
                valor={`${deportista.nombre} ${deportista.apellido}`}
              />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Linea texto="Categoría:" valor={categoria?.nombre ?? "—"} />
              <Linea
                texto="Nacimiento:"
                valor={
                  deportista.fechaNacimiento
                    ? `${deportista.fechaNacimiento} (${edadLabel(deportista.fechaNacimiento)})`
                    : undefined
                }
              />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Linea texto="Documento interno del club:" valor={docInterno} />
            </div>
          </div>
        </section>

        {/* Declaración */}
        <section className="border-t border-border py-4">
          <h2 className="mb-2 text-sm font-extrabold">Autorización</h2>
          <div className="flex flex-col gap-2 text-muted-foreground">
            <p className="flex flex-wrap gap-x-2 gap-y-2 text-foreground">
              <Linea texto="Yo," valor={tutor?.nombre} />
              <Linea texto="DNI" />
            </p>
            <p className="flex flex-wrap gap-x-2 gap-y-2 text-foreground">
              <Linea texto="en mi carácter de" valor={tutor?.relacion} />
              <span className="min-w-0">
                del deportista arriba indicado, autorizo a
              </span>
            </p>
            <p>
              <strong className="text-foreground">{datos.clubNombre}</strong> y a
              la Fundación Evolución Antoniana a registrar y tratar, en la
              plataforma Talento Deportivo Salta, los siguientes datos de mi
              hijo/a o representado/a:
            </p>
            <ul className="ml-1 list-disc pl-5">
              <li>
                datos identificatorios (nombre, fecha de nacimiento, categoría,
                documento interno del club — no el DNI);
              </li>
              <li>
                mediciones deportivas a lo largo del tiempo (físicas con
                protocolo y apreciaciones técnicas) y asistencia a los
                entrenamientos.
              </li>
            </ul>
            <p className="mt-1">
              <strong className="text-foreground">Con la finalidad</strong> de
              acompañar su evolución deportiva y organizar el trabajo formativo
              del club. Entiendo que es un registro de lo observado —{" "}
              <strong className="text-foreground">no</strong> una prueba de
              rendimiento futuro ni una valorización — y que{" "}
              <strong className="text-foreground">no</strong> se usará con fines
              comerciales, publicitarios ni de venta a terceros.
            </p>
            <p>
              Los datos son accesibles solo para el cuerpo técnico del club.
              Puedo{" "}
              <strong className="text-foreground">
                acceder, rectificar, actualizar o suprimir
              </strong>{" "}
              los datos, y <strong className="text-foreground">revocar</strong>{" "}
              este consentimiento en cualquier momento, comunicándolo al club. El
              detalle está en la política de privacidad
              (talentodeportivosalta.vercel.app/privacidad).
            </p>
          </div>
        </section>

        {/* Firmas */}
        <section className="border-t border-border pt-6">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <div className="h-12 border-b border-foreground/60" />
              <span className="text-xs text-muted-foreground">
                Firma del tutor/a
              </span>
              <span className="mt-2 text-xs text-muted-foreground">
                Aclaración: {tutor?.nombre ?? "…………………………………"}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                Lugar y fecha: …………………………………
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-12 border-b border-foreground/60" />
              <span className="text-xs text-muted-foreground">
                Firma y sello del club
              </span>
            </div>
          </div>
        </section>

        {/* Pie */}
        <div className="mt-6 flex items-start gap-2 border-t border-border pt-3 text-[11px] leading-snug text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p>
            Documento de consentimiento amparado por la Ley 25.326 de
            Protección de Datos Personales. Una vez firmado, se archiva en el
            club y su firma se registra en la ficha del deportista
            {!datos.real && " · prototipo con datos de ejemplo"}.
          </p>
        </div>
      </div>
    </div>
  );
}
