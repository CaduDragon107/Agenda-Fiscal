import { describe, it, expect } from "vitest";
import { mockColaboradorUser, mockDonoUser } from "./setup";
import { withVisibilityScope } from "@/lib/visibility-scope";

/**
 * tests/visibility-scope.test.ts
 *
 * Cobre AUTH-02: withVisibilityScope(user) deve retornar:
 * - {} (sem restrição) quando user.role === "DONO"
 * - { responsavelId: user.id } quando user.role === "COLABORADOR"
 *
 * Implementação real: src/lib/visibility-scope.ts (Plano 03).
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
});
