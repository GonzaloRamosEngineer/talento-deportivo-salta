import { InformeCliente } from "@/components/informe-jugador";

export default async function PaginaInforme({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InformeCliente id={id} />;
}
