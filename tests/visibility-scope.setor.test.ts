import { describe, it, expect } from "vitest";
import { withVisibilityScope } from "@/lib/visibility-scope";

/**
 * tests/visibility-scope.setor.test.ts
 *
 * Cobre SETOR-01/SETOR-02 (v2.0): withVisibilityScope precisa se tornar
 * setor-aware sem regressão no comportamento existente do Fiscal/DONO
 * (ver tests/visibility-scope.test.ts, regression gate inalterado).
 *
 * Esta é a Wave 0 (scaffold RED) desta funcionalidade — `withVisibilityScope`
 * ainda tem a assinatura antiga nesta wave (Plan 01). Os asserts abaixo
 * descrevem o comportamento ESPERADO após a extensão setor-aware e ficam
 * RED até o Plan 02 implementar (Pitfall B3 do RESEARCH.md):
 *
 * - COLABORADOR de um setor vê empresa SOMENTE via
 *   `responsaveisPorSetor.some({ setor, usuarioId })` (filtro combinado,
 *   nunca dois where separados — combinar setor+usuarioId no MESMO `some`
 *   é o que impede um colaborador de ver todas as empresas do setor
 *   independente de atribuição pessoal).
 * - DONO continua recebendo `{}` independente de setor (visão geral
 *   inalterada).
 * - COLABORADOR sem setor definido falha SEGURO (resultado NUNCA pode
 *   ser `{}` — isso alargaria a visibilidade em vez de restringi-la).
 *
 * Implementação real: src/lib/visibility-scope.ts (Plan 02 desta fase).
 */

describe("withVisibilityScope — setor-aware (v2.0)", () => {
  it("COLABORADOR de DP vê empresa SOMENTE via responsaveisPorSetor.some({setor:'DP', usuarioId})", () => {
    const dpUser = { id: "user_dp_1", role: "COLABORADOR" as const, setor: "DP" as const };

    expect(withVisibilityScope(dpUser)).toEqual({
      responsaveisPorSetor: { some: { setor: "DP", usuarioId: "user_dp_1" } },
    });
  });

  it("DONO continua recebendo {} independente de setor", () => {
    const dono = { id: "user_dono_1", role: "DONO" as const, setor: null };

    expect(withVisibilityScope(dono)).toEqual({});
  });

  it("COLABORADOR sem setor definido falha SEGURO (nenhuma empresa visível, NUNCA {})", () => {
    const colaboradorSemSetor = { id: "user_x", role: "COLABORADOR" as const, setor: null };

    const resultado = withVisibilityScope(colaboradorSemSetor);

    expect(resultado).not.toEqual({});
  });
});
