"use client";

import { useRouter } from "next/navigation";
import { BarChart3, ClipboardCheck, Landmark } from "lucide-react";
import { usePerfil } from "@/components/perfil-context";
import { cn } from "@/lib/utils";

export function SelectorContextoSecretaria({
  activo,
}: {
  activo: "observatorio" | "evaluaciones";
}) {
  const router = useRouter();
  const { setPerfil, sesionReal, contextosDisponibles } = usePerfil();

  function cambiar(destino: "observatorio" | "evaluaciones") {
    if (destino === activo) return;
    if (sesionReal) {
      const disponible = destino === "observatorio"
        ? contextosDisponibles.observatorio
        : contextosDisponibles.secretaria;
      if (!disponible) return;
      window.localStorage.setItem("tds-contexto-activo", destino === "evaluaciones" ? "secretaria" : "observatorio");
    }
    if (destino === "observatorio") {
      setPerfil("super_admin");
      router.push("/observatorio");
    } else {
      setPerfil("secretaria");
      router.push("/panel");
    }
  }

  return (
    <section className="rounded-2xl border border-primary/20 bg-secondary/35 p-2">
      <div className="flex items-center gap-2 px-1.5 pb-1.5">
        <Landmark className="size-4 text-primary" aria-hidden />
        <p className="text-xs font-extrabold">Secretaría de Deportes</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-background/70 p-1">
        <button
          type="button"
          onClick={() => cambiar("observatorio")}
          disabled={sesionReal && !contextosDisponibles.observatorio}
          className={cn(
            "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-extrabold transition-colors",
            activo === "observatorio"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <BarChart3 className="size-3.5" aria-hidden />
          Observatorio
        </button>
        <button
          type="button"
          onClick={() => cambiar("evaluaciones")}
          disabled={sesionReal && !contextosDisponibles.secretaria}
          className={cn(
            "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-extrabold transition-colors",
            activo === "evaluaciones"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <ClipboardCheck className="size-3.5" aria-hidden />
          Evaluaciones
        </button>
      </div>
    </section>
  );
}
