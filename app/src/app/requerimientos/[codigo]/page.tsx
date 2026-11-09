
export const instant = false;

import GestionRequerimiento from "./GestionRequerimiento";

interface PageProps {
  params: Promise<{
    codigo: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { codigo } = await params;

  return <GestionRequerimiento codigo={decodeURIComponent(codigo)} />;
}
