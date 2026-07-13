import { EditarDeportistaCliente } from "./editar-cliente";

export default async function PaginaEditarDeportista({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditarDeportistaCliente id={id} />;
}
