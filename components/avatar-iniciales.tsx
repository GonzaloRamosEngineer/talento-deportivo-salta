import { cn } from "@/lib/utils";

export function AvatarIniciales({
  nombre,
  apellido,
  className,
}: {
  nombre: string;
  apellido: string;
  className?: string;
}) {
  const iniciales = `${nombre[0] ?? ""}${apellido[0] ?? ""}`.toUpperCase();
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
