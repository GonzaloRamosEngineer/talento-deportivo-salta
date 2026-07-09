import Link from "next/link";
import { ShieldCheck } from "lucide-react";

// Pantalla de "no tenés acceso a esto" — el espejo en la UI de lo que
// en producción aplica el RLS. Se usa cuando un perfil navega por URL
// directa a algo fuera de su alcance.
export function AvisoAcceso({
  titulo,
  detalle,
  accionHref,
  accionLabel,
}: {
  titulo: string;
  detalle: string;
  accionHref?: string;
  accionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <ShieldCheck className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-extrabold">{titulo}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{detalle}</p>
      {accionHref && accionLabel && (
        <Link
          href={accionHref}
          className="flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground"
        >
          {accionLabel}
        </Link>
      )}
      <p className="max-w-sm text-[11px] text-muted-foreground">
        En producción este límite lo aplica la base de datos (RLS), no la
        interfaz. Podés cambiar de perfil desde el selector para probar.
      </p>
    </div>
  );
}
