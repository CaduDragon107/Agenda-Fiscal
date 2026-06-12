import { describe, it, expect } from "vitest";
import { mockColaboradorUser, mockOtherColaboradorUser } from "./setup";

/**
 * tests/empresas.idor.test.ts
 *
 * Cobre AUTH-02 (IDOR): Colaborador A não consegue ler/editar/excluir a
 * empresa de Colaborador B chamando a Server Action diretamente com o id da
 * empresa de B (mesmo sem qualquer link/botão na UI apontando para ela).
 *
 * Contrato esperado (PATTERNS.md): toda mutação/query por id deve usar
 * findFirst({ where: { id, ...withVisibilityScope(session.user) } }) e
 * retornar "não encontrado" (nunca 403) quando fora do escopo.
 *
 * Implementação real (modules/empresas/*) chega no Plano 03.
 */

describe("IDOR - isolamento de empresas entre colaboradores", () => {
  it("colaborador A não consegue LER empresa de colaborador B (retorna 'não encontrado')", () => {
    const colaboradorA = mockColaboradorUser();
    const colaboradorB = mockOtherColaboradorUser();
    void colaboradorA;
    void colaboradorB;
    expect.fail("TODO: implementado no Plano 03 (modules/empresas -> findById + withVisibilityScope)");
  });

  it("colaborador A não consegue EDITAR empresa de colaborador B via Server Action direta", () => {
    expect.fail("TODO: implementado no Plano 03 (modules/empresas -> update + withVisibilityScope)");
  });

  it("colaborador A não consegue EXCLUIR empresa de colaborador B via Server Action direta", () => {
    expect.fail("TODO: implementado no Plano 03 (modules/empresas -> delete + withVisibilityScope)");
  });

  it("dono consegue ler/editar empresas de qualquer colaborador (sem restrição)", () => {
    expect.fail("TODO: implementado no Plano 03 (modules/empresas -> withVisibilityScope role dono)");
  });
});
