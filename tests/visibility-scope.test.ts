import { describe, it, expect } from "vitest";
import { mockColaboradorUser, mockDonoUser } from "./setup";

/**
 * tests/visibility-scope.test.ts
 *
 * Cobre AUTH-02: withVisibilityScope(user) deve retornar:
 * - {} (sem restrição) quando user.role === "dono"
 * - { responsavelId: user.id } quando user.role === "colaborador"
 *
 * Implementação real (lib/visibility-scope.ts) chega no Plano 02.
 */

describe("withVisibilityScope", () => {
  it("retorna {} (sem restrição) para usuário com role 'dono'", () => {
    const dono = mockDonoUser();
    void dono;
    // Esperado: withVisibilityScope(dono) === {}
    expect.fail("TODO: implementado no Plano 02 (lib/visibility-scope.ts -> withVisibilityScope)");
  });

  it("retorna { responsavelId: user.id } para usuário com role 'colaborador'", () => {
    const colaborador = mockColaboradorUser();
    void colaborador;
    // Esperado: withVisibilityScope(colaborador) === { responsavelId: colaborador.id }
    expect.fail("TODO: implementado no Plano 02 (lib/visibility-scope.ts -> withVisibilityScope)");
  });
});
