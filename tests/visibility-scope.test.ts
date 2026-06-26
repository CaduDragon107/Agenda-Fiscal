import { describe, it, expect } from "vitest";
import {
  mockColaboradorUser,
  mockDonoUser,
  mockChefeFiscalUser,
  mockChefeDpUser,
  mockChefeContabilUser,
} from "./setup";
import { withVisibilityScope, withTarefaScope } from "@/lib/visibility-scope";
import { tarefaSetorWhere } from "@/lib/tipo-obrigacao-setor";

/**
 * tests/visibility-scope.test.ts
 *
 * Cobre AUTH-02: withVisibilityScope(user) deve retornar:
 * - {} (sem restrição) quando user.role === "DONO"
 * - { responsavelId: user.id } quando user.role === "COLABORADOR"
 *
 * Também cobre withTarefaScope (D-14):
 * - DONO: retorna {} (vê todas as tarefas)
 * - COLABORADOR: retorna { responsavelId: user.id } (vê apenas suas tarefas)
 *
 * Implementação real: src/lib/visibility-scope.ts (Plano 03 / Fase 2 Plan 01).
 */

describe("withVisibilityScope", () => {
  it("retorna {} (sem restrição) para usuário com role 'DONO'", () => {
    const dono = mockDonoUser();

    expect(withVisibilityScope(dono)).toEqual({});
  });

  it("retorna { responsavelId: user.id } para usuário com role 'COLABORADOR'", () => {
    const colaborador = mockColaboradorUser();

    expect(withVisibilityScope(colaborador)).toEqual({
      responsavelId: colaborador.id,
    });
  });

  it("retorna { responsaveisPorSetor: { some: { setor: 'FISCAL' } } } para CHEFE_SETOR do Fiscal (sem usuarioId — todas as empresas do setor)", () => {
    const chefeFiscal = mockChefeFiscalUser();

    expect(withVisibilityScope(chefeFiscal)).toEqual({
      responsaveisPorSetor: { some: { setor: "FISCAL" } },
    });
  });

  it("retorna { responsaveisPorSetor: { some: { setor: 'DP' } } } para CHEFE_SETOR do DP", () => {
    const chefeDp = mockChefeDpUser();

    expect(withVisibilityScope(chefeDp)).toEqual({
      responsaveisPorSetor: { some: { setor: "DP" } },
    });
  });

  it("retorna { id: '__no_setor_defined__' } (fail-safe) para CHEFE_SETOR sem setor definido", () => {
    const chefeSemSetor = mockChefeFiscalUser({ setor: null });

    expect(withVisibilityScope(chefeSemSetor)).toEqual({
      id: "__no_setor_defined__",
    });
  });
});

describe("withTarefaScope", () => {
  it("retorna {} (sem restrição) para usuário com role 'DONO'", () => {
    const dono = mockDonoUser();

    expect(withTarefaScope(dono)).toEqual({});
  });

  it("retorna { responsavelId: user.id } para usuário com role 'COLABORADOR'", () => {
    const colaborador = mockColaboradorUser();

    expect(withTarefaScope(colaborador)).toEqual({
      responsavelId: colaborador.id,
    });
  });

  it("retorna tarefaSetorWhere('CONTABIL') para CHEFE_SETOR do Contábil", () => {
    const chefeContabil = mockChefeContabilUser();

    expect(withTarefaScope(chefeContabil)).toEqual(tarefaSetorWhere("CONTABIL"));
  });

  it("retorna fallback { responsavelId: user.id } para CHEFE_SETOR sem setor definido", () => {
    const chefeSemSetor = mockChefeFiscalUser({ setor: null });

    expect(withTarefaScope(chefeSemSetor)).toEqual({
      responsavelId: chefeSemSetor.id,
    });
  });
});
