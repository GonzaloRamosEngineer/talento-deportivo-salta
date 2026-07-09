import { notFound } from "next/navigation";
import { getDeportista } from "@/lib/mock-data";
import { InformeJugador } from "@/components/informe-jugador";

export default async function PaginaInforme({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deportista = getDeportista(id);
  if (!deportista) notFound();

  return <InformeJugador deportista={deportista} />;
}
