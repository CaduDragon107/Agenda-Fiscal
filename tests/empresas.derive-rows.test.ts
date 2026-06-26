import { describe, it, expect } from "vitest";
import { deriveEmpresaRows } from "@/app/(app)/empresas/derive-rows";

/**
 * tests/empresas.derive-rows.test.ts
 *
 * Regressão de segurança D-10 (Plano 05-04, T-05-15): deriveEmpresaRows é a
 * fronteira que decide o que entra no EmpresaRow passado a <EmpresasTable> —
 * e portanto no payload RSC/HTML inicial. Para um viewer não-DONO, os
 * responsáveis dos OUTROS setores nunca podem aparecer em nenhum campo da
 * row, nem nome nem id.
 *
 * Função pura — sem db, sem render. Os fixtures abaixo espelham o shape real
 * de `EMPRESA_SELECT.responsaveisPorSetor` (src/modules/empresas/queries.ts):
 * `{ setor, usuario: { id, nome } }`.
 */

const FISCAL_NOME = "FISCAL_NOME";
const DP_NOME = "DP_NOME";
const CONTABIL_NOME = "CONTABIL_NOME";
const FISCAL_ID = "user_fiscal_1";
const DP_ID = "user_dp_1";
const CONTABIL_ID = "user_contabil_1";

function montarFixtures() {
  return [
    {
      id: "empresa_1",
      nome: "Empresa Multi-Setor LTDA",
      cnpj: "11.222.333/0001-81",
      regimeTributario: "LUCRO_REAL" as const,
      responsavelId: FISCAL_ID,
      temFuncionariosClt: true,
      temEmpregadaDomestica: false,
      contatos: null,
      particularidades: null,
      ativo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      responsavel: { id: FISCAL_ID, nome: FISCAL_NOME },
      responsaveisPorSetor: [
        { setor: "FISCAL" as const, usuario: { id: FISCAL_ID, nome: FISCAL_NOME } },
        { setor: "DP" as const, usuario: { id: DP_ID, nome: DP_NOME } },
        { setor: "CONTABIL" as const, usuario: { id: CONTABIL_ID, nome: CONTABIL_NOME } },
      ],
    },
  ];
}

describe("deriveEmpresaRows", () => {
  it("Test 1 (DP colaborador): popula apenas responsavelDp/-Id; Fiscal e Contábil ficam null", () => {
    const rows = deriveEmpresaRows(montarFixtures(), "COLABORADOR", "DP");

    expect(rows).toHaveLength(1);
    const [row] = rows;

    expect(row.responsavelDp).toEqual({ id: DP_ID, nome: DP_NOME });
    expect(row.responsavelDpId).toBe(DP_ID);

    expect(row.responsavelFiscal).toBeNull();
    expect(row.responsavelFiscalId).toBeNull();
    expect(row.responsavelContabil).toBeNull();
    expect(row.responsavelContabilId).toBeNull();
  });

  it("Test 2 (Contábil colaborador): popula apenas responsavelContabil/-Id; Fiscal e DP ficam null", () => {
    const rows = deriveEmpresaRows(montarFixtures(), "COLABORADOR", "CONTABIL");

    expect(rows).toHaveLength(1);
    const [row] = rows;

    expect(row.responsavelContabil).toEqual({ id: CONTABIL_ID, nome: CONTABIL_NOME });
    expect(row.responsavelContabilId).toBe(CONTABIL_ID);

    expect(row.responsavelFiscal).toBeNull();
    expect(row.responsavelFiscalId).toBeNull();
    expect(row.responsavelDp).toBeNull();
    expect(row.responsavelDpId).toBeNull();
  });

  it("Test 3 (DONO): os 3 setores são populados, nenhum strip", () => {
    const rows = deriveEmpresaRows(montarFixtures(), "DONO", null);

    expect(rows).toHaveLength(1);
    const [row] = rows;

    expect(row.responsavelFiscal).toEqual({ id: FISCAL_ID, nome: FISCAL_NOME });
    expect(row.responsavelFiscalId).toBe(FISCAL_ID);
    expect(row.responsavelDp).toEqual({ id: DP_ID, nome: DP_NOME });
    expect(row.responsavelDpId).toBe(DP_ID);
    expect(row.responsavelContabil).toEqual({ id: CONTABIL_ID, nome: CONTABIL_NOME });
    expect(row.responsavelContabilId).toBe(CONTABIL_ID);
  });

  it("Test 4 (varredura anti-vazamento): JSON.stringify da saída não-DONO não contém nomes/ids cross-setor", () => {
    // NOTA: `responsavelId` (a coluna legada, EQUIVALENTE ao
    // responsavelFiscalId por lockstep — Plano 05-03) sempre estará
    // presente na row, DONO ou não — é um campo legado intencional, não faz
    // parte da varredura de nomes (FISCAL_NOME/CONTABIL_NOME) nem é
    // exclusivo das novas colunas por setor desta plan. A varredura abaixo
    // foca nos NOMES (sempre exclusivos/reconhecíveis) e nos IDs dos
    // setores que não são o do viewer, via os campos `responsavelXxxId`
    // (ids "novos", D-10) — não via a coluna legada `responsavelId`.
    const rowsDp = deriveEmpresaRows(montarFixtures(), "COLABORADOR", "DP");
    const serializadoDp = JSON.stringify(rowsDp);

    expect(serializadoDp).not.toContain(FISCAL_NOME);
    expect(serializadoDp).not.toContain(CONTABIL_NOME);
    expect(serializadoDp).not.toContain(CONTABIL_ID);
    // responsavelFiscalId especificamente nunca aparece (distinto da coluna
    // legada responsavelId, que é equivalente por lockstep mas não é o
    // campo sob teste aqui).
    const [rowDp] = rowsDp;
    expect(rowDp.responsavelFiscalId).toBeNull();
    expect(rowDp.responsavelContabilId).toBeNull();
    // O próprio setor do viewer deve estar presente (sanity check — garante
    // que o teste não está passando por estar vazio/quebrado).
    expect(serializadoDp).toContain(DP_NOME);
    expect(serializadoDp).toContain(DP_ID);

    const rowsContabil = deriveEmpresaRows(montarFixtures(), "COLABORADOR", "CONTABIL");
    const serializadoContabil = JSON.stringify(rowsContabil);

    expect(serializadoContabil).not.toContain(FISCAL_NOME);
    expect(serializadoContabil).not.toContain(DP_NOME);
    expect(serializadoContabil).not.toContain(DP_ID);
    const [rowContabil] = rowsContabil;
    expect(rowContabil.responsavelFiscalId).toBeNull();
    expect(rowContabil.responsavelDpId).toBeNull();
    expect(serializadoContabil).toContain(CONTABIL_NOME);
    expect(serializadoContabil).toContain(CONTABIL_ID);
  });
});
