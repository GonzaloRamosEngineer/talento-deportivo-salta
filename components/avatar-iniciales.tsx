import { cn } from "@/lib/utils";

export function AvatarIniciales({
  nombre,
  apellido,
  className,
}: {
  nombre: string | null;
  apellido?: string | null;
  className?: string;
}) {
  // Ojo: `??` protege el RESULTADO del índice, no el indexado. Con
  // apellido = null (81 de 141 fichas: los adaptadores que dejan el
  // nombre completo en `nombre`), `apellido[0]` tira antes de evaluarlo.
  const iniciales = `${nombre?.[0] ?? ""}${apellido?.[0] ?? ""}`.toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-extrabold text-secondary-foreground",
        className,
      )}
    >
      {iniciales}
    </span>
  );
}
