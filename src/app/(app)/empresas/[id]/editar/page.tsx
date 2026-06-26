import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { buscarEmpresaPorId, listarResponsaveis } from "@/modules/empresas/queries";
import { EmpresaForm } from "../../empresa-form";

/**
 * Tela "Editar empresa: {nome}" (EMPR-01 / AUTH-02).
 *
 * buscarEmpresaPorId já aplica withVisibilityScope — se a empresa não existir
 * OU estiver fora do escopo do usuário, retorna null e renderizamos 404
 * ("não encontrado"), nunca um erro de permissão (T-01-IDOR-READ).
 *
 * v2.0 (Plano 05-04, SETOR-01/SETOR-03): busca as 3 listas de responsáveis
 * por setor e deriva os 3 responsáveis atuais da empresa a partir da relação
 * `responsaveisPorSetor` (junction table), procurando a entrada por setor.
 */
export default async function EditarEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  const [empresa, responsaveisFiscal, responsaveisDp, responsaveisContabil] = await Promise.all([
    buscarEmpresaPorId(session.user, id),
    listarResponsaveis("FISCAL"),
    listarResponsaveis("DP"),
    listarResponsaveis("CONTABIL"),
  ]);

  if (!empresa) {
    notFound();
  }

  const responsavelFiscal = empresa.responsaveisPorSetor.find((r) => r.setor === "FISCAL");
  const responsavelDp = empresa.responsaveisPorSetor.find((r) => r.setor === "DP");
  const responsavelContabil = empresa.responsaveisPorSetor.find((r) => r.setor === "CONTABIL");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Editar empresa: {empresa.nome}</h1>
      <EmpresaForm
        responsaveisFiscal={responsaveisFiscal}
        responsaveisDp={responsaveisDp}
        responsaveisContabil={responsaveisContabil}
        isDono={session.user.role === "DONO"}
        empresa={{
          id: empresa.id,
          nome: empresa.nome,
          cnpj: empresa.cnpj,
          regimeTributario: empresa.regimeTributario,
          responsavelFiscalId: responsavelFiscal?.usuario.id ?? empresa.responsavelId,
          responsavelDpId: responsavelDp?.usuario.id ?? null,
          responsavelContabilId: responsavelContabil?.usuario.id ?? null,
          temFuncionariosClt: empresa.temFuncionariosClt,
          temEmpregadaDomestica: empresa.temEmpregadaDomestica,
          contatos: empresa.contatos,
          particularidades: empresa.particularidades,
        }}
      />
    </div>
  );
}
