import { ConsentimientoCliente } from "@/components/consentimiento-imprimible";

export default async function PaginaConsentimiento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConsentimientoCliente id={id} />;
}
