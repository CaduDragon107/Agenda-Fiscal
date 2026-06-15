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

  const [empresa, responsaveis] = await Promise.all([
    buscarEmpresaPorId(session.user, id),
    listarResponsaveis(),
  ]);

  if (!empresa) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Editar empresa: {empresa.nome}</h1>
      <EmpresaForm
        responsaveis={responsaveis}
        empresa={{
          id: empresa.id,
          nome: empresa.nome,
          cnpj: empresa.cnpj,
          regimeTributario: empresa.regimeTributario,
          responsavelId: empresa.responsavelId,
          contatos: empresa.contatos,
          particularidades: empresa.particularidades,
        }}
      />
    </div>
  );
}
