import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarResponsaveis } from "@/modules/empresas/queries";
import { EmpresaForm } from "../empresa-form";

/**
 * Tela "Nova empresa" (EMPR-01).
 *
 * v2.0 (Plano 05-04, SETOR-03): busca as 3 listas de responsáveis
 * (Fiscal/DP/Contábil), cada uma filtrada por setor.
 *
 * Quick task 260626-dfc: `podeEditarFiscal`/`podeEditarDp`/`podeEditarContabil`
 * calculados server-side a partir de `session.user.role`/`session.user.setor`
 * — DONO sempre true; CHEFE_SETOR true apenas no select do próprio setor —
 * e passados ao form para controlar o disabled POR CAMPO (D-02 — UX
 * apenas, o enforcement real é em criarEmpresa/editarEmpresa).
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

  const isDono = session.user.role === "DONO";
  const isChefe = session.user.role === "CHEFE_SETOR";
  const setorChefe = session.user.setor;
  const podeEditarFiscal = isDono || (isChefe && setorChefe === "FISCAL");
  const podeEditarDp = isDono || (isChefe && setorChefe === "DP");
  const podeEditarContabil = isDono || (isChefe && setorChefe === "CONTABIL");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Nova empresa</h1>
      <EmpresaForm
        responsaveisFiscal={responsaveisFiscal}
        responsaveisDp={responsaveisDp}
        responsaveisContabil={responsaveisContabil}
        podeEditarFiscal={podeEditarFiscal}
        podeEditarDp={podeEditarDp}
        podeEditarContabil={podeEditarContabil}
      />
    </div>
  );
}
