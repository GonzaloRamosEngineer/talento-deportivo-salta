import { cn } from "@/lib/utils";
import type { EstadoJornadaSecretaria } from "@/lib/secretaria-demo";

const TEXTO: Record<EstadoJornadaSecretaria, string> = {
  revisar: "Necesita decisión",
  recibida: "Pendiente de mapear",
  lista: "Lista",
};

export function EstadoJornada({ estado }: { estado: EstadoJornadaSecretaria }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold",
        estado === "revisar" && "bg-destructive/10 text-destructive",
        estado === "recibida" && "bg-warning-soft text-warning",
        estado === "lista" && "bg-secondary text-primary",
      )}
    >
      {TEXTO[estado]}
    </span>
  );
}
