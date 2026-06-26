import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarEmpresas } from "@/modules/empresas/queries";
import { EmpresasDpTable } from "./empresas-dp-table";

/**
 * Listagem de empresas do setor DP (quick task 260626-a8d).
 *
 * Server Component: chama listarEmpresas(session.user), que já aplica
 * withVisibilityScope (colaborador -> só sua carteira, dono -> todas).
 * Mantém a mesma fronteira de segurança usada em /empresas — nenhum
 * .filter() client-side por responsavelId (T-01-IDOR-READ).
 *
 * Diferente de /empresas (deriveEmpresaRows, D-10): aqui só expomos UM
 * responsável (o de DP), nunca os outros setores, então não há necessidade
 * de derivar 3 campos condicionalmente por role/setor — apenas extraímos
 * `responsaveisPorSetor.find(setor === "DP")` diretamente.
 */
export default async function EmpresasDpPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const empresas = await listarEmpresas(session.user);

  const rows = empresas.map((empresa) => ({
    id: empresa.id,
    nome: empresa.nome,
    cnpj: empresa.cnpj,
    responsavelDp:
      empresa.responsaveisPorSetor.find((r) => r.setor === "DP")?.usuario ?? null,
    temEmpregadaDomestica: empresa.temEmpregadaDomestica,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Empresas — DP</h1>
      </div>

      <EmpresasDpTable empresas={rows} />
    </div>
  );
}
