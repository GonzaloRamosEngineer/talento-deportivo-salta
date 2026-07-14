"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { crearClienteBrowser } from "@/lib/supabase/client";
import type { Deportista } from "@/lib/mock-data";
import { edadLabel, nivelActual } from "@/lib/mock-data";
import { tendencia, type Estado } from "@/lib/tendencia";
import type { Datos } from "@/lib/use-datos";
import { cn } from "@/lib/utils";

// El informe del deportista, resumido como TEXTO de WhatsApp: es lo
// que el profe le manda a la familia después de la jornada (el link a
// la app no le sirve al tutor: no tiene login por diseño). Si el tutor
// tiene teléfono cargado, el chat se abre directo con él. Mantiene el
// framing honesto del informe impreso: registro observado, nunca
// atribución causal, y el recordatorio de que son datos de un menor.

const ESTADO_TEXTO: Record<Estado, string | null> = {
  creciendo: "creciendo",
  amesetado: "amesetado",
  en_baja: "en baja",
  registro: "en registro",
  sin_datos: null,
};

// wa.me exige el número con código de país y sin signos. Heurística
// argentina: si no trae el 54, se asume celular local (549 + área+número).
function telefonoWa(telefono: string): string | null {
  let digitos = telefono.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (digitos.startsWith("549")) return digitos;
  if (digitos.startsWith("54")) return `549${digitos.slice(2)}`;
  if (digitos.length < 8) return null;
  return `549${digitos}`;
}

function armarTexto(deportista: Deportista, datos: Datos): string {
  const categoria = datos.categorias.find((c) => c.id === deportista.categoriaId);
  const medidos = datos.atributos.filter((a) => deportista.mediciones[a.id]?.length);
  const fisicas = medidos.filter((a) => a.ambito === "fisico");
  const tecnicas = medidos.filter((a) => a.ambito === "tecnico");

  const lineas: string[] = [
    `*${deportista.nombre} ${deportista.apellido}* — informe de evolución`,
    [datos.clubNombre, categoria?.nombre, edadLabel(deportista.fechaNacimiento)]
      .filter(Boolean)
      .join(" · "),
  ];

  if (fisicas.length) {
    lineas.push("", "📈 *Físico* (última medición; tendencia de las últimas 3):");
    for (const a of fisicas) {
      const serie = deportista.mediciones[a.id];
      const ultima = serie[serie.length - 1];
      const estado = ESTADO_TEXTO[tendencia(serie, a).estado];
      lineas.push(
        `• ${a.nombre}: ${ultima.valor.toLocaleString("es-AR")} ${a.unidad}${estado ? ` — ${estado}` : ""}`,
      );
    }
  }

  if (tecnicas.length) {
    lineas.push("", "⚽ *Técnica* (1-10, criterio del cuerpo técnico):");
    lineas.push(
      tecnicas
        .map(
          (a) =>
            `${a.nombre} ${nivelActual(deportista, a.id)!.toLocaleString("es-AR", { maximumFractionDigits: 1 })}`,
        )
        .join(" · "),
    );
  }

  lineas.push(
    "",
    "Registro de la evolución observada por el club — en chicos en crecimiento, buena parte del cambio es maduración. Contiene datos de un menor: no reenviar.",
    `${new Date().toLocaleDateString("es-AR")} · Talento Deportivo Salta`,
  );
  return lineas.join("\n");
}

export function CompartirInforme({
  deportista,
  datos,
  variante = "boton",
}: {
  deportista: Deportista;
  datos: Datos;
  variante?: "boton" | "icono";
}) {
  const [telefonoTutor, setTelefonoTutor] = useState<string | null>(null);

  // El teléfono del tutor no viene en useDatos (solo hace falta acá):
  // consulta puntual vía RLS, únicamente con sesión real.
  useEffect(() => {
    if (!datos.real) return;
    let cancelado = false;
    crearClienteBrowser()
      .from("tutor")
      .select("telefono")
      .eq("deportista_id", deportista.id)
      .not("telefono", "is", null)
      .limit(1)
      .then(({ data }) => {
        if (!cancelado) setTelefonoTutor(data?.[0]?.telefono ?? null);
      });
    return () => {
      cancelado = true;
    };
  }, [datos.real, deportista.id]);

  const hayMediciones = datos.atributos.some(
    (a) => deportista.mediciones[a.id]?.length,
  );
  if (!hayMediciones) return null;

  const wa = telefonoTutor ? telefonoWa(telefonoTutor) : null;
  const texto = encodeURIComponent(armarTexto(deportista, datos));
  const href = wa
    ? `https://wa.me/${wa}?text=${texto}`
    : `https://wa.me/?text=${texto}`;
  const titulo = wa
    ? "Enviar el informe por WhatsApp al tutor"
    : "Compartir el informe por WhatsApp";

  if (variante === "icono") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={titulo}
        title={titulo}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <MessageCircle className="size-4.5" aria-hidden />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-extrabold transition-colors hover:border-primary/50",
      )}
    >
      <MessageCircle className="size-4" aria-hidden />
      {wa ? "WhatsApp al tutor" : "WhatsApp"}
    </a>
  );
}
