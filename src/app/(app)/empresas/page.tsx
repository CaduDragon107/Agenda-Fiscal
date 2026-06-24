import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { listarEmpresas, listarResponsaveis } from "@/modules/empresas/queries";
import { deriveEmpresaRows } from "./derive-rows";
import { EmpresasTable } from "./empresas-table";

/**
 * Lista de empresas (EMPR-01 / AUTH-02).
 *
 * Server Component: chama listarEmpresas(session.user), que já aplica
 * withVisibilityScope (colaborador -> só sua carteira, dono -> todas).
 * Renderiza EXATAMENTE o que o backend retorna — nenhum .filter() client-side
 * por responsavelId (T-01-IDOR-READ).
 *
 * v2.0 (Plano 05-04, D-10 — fronteira de segurança CRÍTICA): o resultado de
 * listarEmpresas passa por deriveEmpresaRows(empresas, role, setor) ANTES de
 * chegar em <EmpresasTable>. Para um viewer não-DONO, essa derivação já
 * omite (null) os responsáveis dos outros setores no servidor — os dados
 * cross-setor nunca entram no EmpresaRow nem no payload RSC/HTML.
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
  const rows = deriveEmpresaRows(empresas, session.user.role, session.user.setor);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Empresas</h1>
        <Button asChild>
          <Link href="/empresas/novo">Nova empresa</Link>
        </Button>
      </div>

      <EmpresasTable
        empresas={rows}
        responsaveis={responsaveis}
        isDono={isDono}
        setor={session.user.setor}
      />
    </div>
  );
}
