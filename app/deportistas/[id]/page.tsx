import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FichaCliente } from "@/components/ficha-deportista";

export default async function PaginaDeportista({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ atributo?: string }>;
}) {
  const { id } = await params;
  const { atributo } = await searchParams;

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/deportistas"
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Deportistas
      </Link>
      <FichaCliente id={id} atributoInicial={atributo} />
    </div>
  );
}
