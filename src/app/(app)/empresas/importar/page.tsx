import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarResponsaveis } from "@/modules/empresas/queries";
import { ImportWizard } from "./_components/ImportWizard";

/**
 * Wizard de importação de empresas via planilha (EMPR-02).
 *
 * Server Component: apenas guarda de sessão + lista de responsáveis
 * (necessária no Step 2 para o Select "Responsável"). Todo o estado do
 * staging (linhas parseadas, edições, inclusão/exclusão) vive em estado
 * React no ImportWizard — nada é persistido antes da confirmação explícita
 * no Step 3 (Anti-Pattern: "persistir as is").
 */
export default async function ImportarEmpresasPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const responsaveis = await listarResponsaveis();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Importar empresas</h1>
        <p className="text-sm text-muted-foreground">
          Envie a planilha de cadastro de empresas, revise os dados e confirme
          a importação.
        </p>
      </div>

      <ImportWizard responsaveis={responsaveis} />
    </div>
  );
}
