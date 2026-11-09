
export const instant = false;

import GestionIncidente from "./GestionIncidente";

interface PageProps {
  params: Promise<{
    codigo: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { codigo } = await params;

  return <GestionIncidente codigo={decodeURIComponent(codigo)} />;
}
