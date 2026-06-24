import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarResponsaveis } from "@/modules/empresas/queries";
import { EmpresaForm } from "../empresa-form";

/**
 * Tela "Nova empresa" (EMPR-01).
 *
 * v2.0 (Plano 05-04, SETOR-03): busca as 3 listas de responsáveis
 * (Fiscal/DP/Contábil), cada uma filtrada por setor, e passa `isDono` para
 * controlar o disabled dos 3 seletores no form (D-02 — UX apenas).
 */
export default async function NovaEmpresaPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [responsaveisFiscal, responsaveisDp, responsaveisContabil] = await Promise.all([
    listarResponsaveis("FISCAL"),
    listarResponsaveis("DP"),
    listarResponsaveis("CONTABIL"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Nova empresa</h1>
      <EmpresaForm
        responsaveisFiscal={responsaveisFiscal}
        responsaveisDp={responsaveisDp}
        responsaveisContabil={responsaveisContabil}
        isDono={session.user.role === "DONO"}
      />
    </div>
  );
}
