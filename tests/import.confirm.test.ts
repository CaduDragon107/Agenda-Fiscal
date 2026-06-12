import { describe, it, expect } from "vitest";

/**
 * tests/import.confirm.test.ts
 *
 * Cobre EMPR-02: a etapa de confirmação da importação NÃO deve persistir
 * linhas com regimeTributario ausente/ambíguo sem confirmação explícita do
 * usuário na revisão (Step 2 do wizard, UI-SPEC).
 *
 * As 7 linhas "sem regime" (RESEARCH.md Pattern 3.5) devem ficar pendentes
 * de atribuição manual antes da persistência final.
 *
 * Implementação real (modules/empresas/import + Server Action de confirmação)
 * chega no Plano 04.
 */

describe("Confirmação de importação - regime tributário ausente", () => {
  it("não persiste empresas com regimeTributario ausente sem confirmação explícita", () => {
    expect.fail("TODO: implementado no Plano 04 (modules/empresas/import -> confirmarImportacao)");
  });

  it("permite ao usuário atribuir regimeTributario manualmente às 7 linhas sem regime antes de confirmar", () => {
    expect.fail("TODO: implementado no Plano 04 (modules/empresas/import -> revisão manual de regime)");
  });

  it("após confirmação com todos os regimes preenchidos, persiste as 198 empresas", () => {
    expect.fail("TODO: implementado no Plano 04 (modules/empresas/import -> confirmarImportacao, total=198)");
  });
});
