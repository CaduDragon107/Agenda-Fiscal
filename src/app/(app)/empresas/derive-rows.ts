import type { listarEmpresas } from "@/modules/empresas/queries";
import type { EmpresaRow } from "./empresas-table";

type EmpresaComResponsaveis = Awaited<ReturnType<typeof listarEmpresas>>[number];

type ViewerRole = "COLABORADOR" | "DONO";
type ViewerSetor = "FISCAL" | "DP" | "CONTABIL" | null;

/**
 * Deriva as `EmpresaRow`s exibidas em `<EmpresasTable>` a partir do
 * resultado de `listarEmpresas`, aplicando a fronteira de segurança D-10
 * (Plano 05-04, T-05-15):
 *
 * - Quando `viewerRole === "DONO"`: os 3 setores (Fiscal/DP/Contábil) são
 *   sempre populados — visão geral sem restrição.
 * - Quando `viewerRole !== "DONO"`: APENAS o campo do próprio setor do
 *   viewer é populado. Os campos dos outros 2 setores (nome E id) são
 *   `null` — NUNCA construídos a partir de `responsaveisPorSetor` para um
 *   viewer não-DONO. Isso garante que os dados cross-setor nunca entram no
 *   objeto `EmpresaRow`, e portanto nunca podem aparecer no payload RSC, no
 *   HTML inicial ou no React DevTools — column hiding em
 *   `empresas-table.tsx` é apenas uma segunda barreira defensiva, NÃO o
 *   controle primário.
 *
 * Função pura — sem I/O, sem dependência de sessão/Server Component, o que
 * permite testá-la isoladamente (tests/empresas.derive-rows.test.ts) sem
 * banco nem render.
 */
export function deriveEmpresaRows(
  empresas: EmpresaComResponsaveis[],
  viewerRole: ViewerRole,
  viewerSetor: ViewerSetor
): EmpresaRow[] {
  return empresas.map((empresa) => {
    const porSetor = (setor: "FISCAL" | "DP" | "CONTABIL") =>
      empresa.responsaveisPorSetor.find((r) => r.setor === setor)?.usuario ?? null;

    if (viewerRole === "DONO") {
      const fiscal = porSetor("FISCAL");
      const dp = porSetor("DP");
      const contabil = porSetor("CONTABIL");

      return {
        id: empresa.id,
        nome: empresa.nome,
        cnpj: empresa.cnpj,
        regimeTributario: empresa.regimeTributario,
        responsavelId: empresa.responsavelId,
        temEmpregadaDomestica: empresa.temEmpregadaDomestica,
        responsavelFiscal: fiscal,
        responsavelFiscalId: fiscal?.id ?? null,
        responsavelDp: dp,
        responsavelDpId: dp?.id ?? null,
        responsavelContabil: contabil,
        responsavelContabilId: contabil?.id ?? null,
      };
    }

    // Viewer não-DONO: somente o próprio setor é populado. Os outros 2
    // setores NUNCA são lidos de responsaveisPorSetor aqui — os campos
    // ficam null por construção, não por omissão de renderização.
    const proprioSetor = viewerSetor;
    const responsavelProprioSetor =
      proprioSetor === "FISCAL" || proprioSetor === "DP" || proprioSetor === "CONTABIL"
        ? porSetor(proprioSetor)
        : null;

    return {
      id: empresa.id,
      nome: empresa.nome,
      cnpj: empresa.cnpj,
      regimeTributario: empresa.regimeTributario,
      responsavelId: empresa.responsavelId,
      temEmpregadaDomestica: empresa.temEmpregadaDomestica,
      responsavelFiscal: proprioSetor === "FISCAL" ? responsavelProprioSetor : null,
      responsavelFiscalId: proprioSetor === "FISCAL" ? responsavelProprioSetor?.id ?? null : null,
      responsavelDp: proprioSetor === "DP" ? responsavelProprioSetor : null,
      responsavelDpId: proprioSetor === "DP" ? responsavelProprioSetor?.id ?? null : null,
      responsavelContabil: proprioSetor === "CONTABIL" ? responsavelProprioSetor : null,
      responsavelContabilId:
        proprioSetor === "CONTABIL" ? responsavelProprioSetor?.id ?? null : null,
    };
  });
}
