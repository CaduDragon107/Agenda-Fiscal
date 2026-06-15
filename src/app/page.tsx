import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Ponto de entrada da rota raiz '/'. Não renderiza nenhum conteúdo: apenas
 * decide o destino com base na sessão (AUTH-01), seguindo o mesmo padrão de
 * src/app/(app)/layout.tsx.
 */
export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/empresas");
  }

  redirect("/login");
}
