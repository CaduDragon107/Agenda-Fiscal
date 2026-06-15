import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { listarEmpresas, listarResponsaveis } from "@/modules/empresas/queries";
import { EmpresasTable } from "./empresas-table";

/**
 * Lista de empresas (EMPR-01 / AUTH-02).
 *
 * Server Component: chama listarEmpresas(session.user), que já aplica
 * withVisibilityScope (colaborador -> só sua carteira, dono -> todas).
 * Renderiza EXATAMENTE o que o backend retorna — nenhum .filter() client-side
 * por responsavelId (T-01-IDOR-READ).
 */
export default async function EmpresasPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [empresas, responsaveis] = await Promise.all([
    listarEmpresas(session.user),
    listarResponsaveis(),
  ]);

  const isDono = session.user.role === "DONO";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Empresas</h1>
        <Button asChild>
          <Link href="/empresas/novo">Nova empresa</Link>
        </Button>
      </div>

      <EmpresasTable empresas={empresas} responsaveis={responsaveis} isDono={isDono} />
    </div>
  );
}
