import { describe, it, expect } from "vitest";

/**
 * tests/empresas.crud.test.ts
 *
 * Cobre EMPR-01: CRUD de empresa.
 * - Criar/editar empresa com regimeTributario válido (LUCRO_REAL,
 *   LUCRO_PRESUMIDO ou SIMPLES_NACIONAL) persiste corretamente.
 * - CNPJ com dígito verificador inválido é rejeitado na validação (antes de
 *   chegar ao banco).
 *
 * Implementação real (modules/empresas/*) chega no Plano 03.
 */

describe("CRUD de Empresa", () => {
  it("cria empresa com regimeTributario válido (LUCRO_REAL)", () => {
    expect.fail("TODO: implementado no Plano 03 (modules/empresas -> create)");
  });

  it("cria empresa com regimeTributario válido (LUCRO_PRESUMIDO)", () => {
    expect.fail("TODO: implementado no Plano 03 (modules/empresas -> create)");
  });

  it("cria empresa com regimeTributario válido (SIMPLES_NACIONAL)", () => {
    expect.fail("TODO: implementado no Plano 03 (modules/empresas -> create)");
  });

  it("rejeita criação de empresa com CNPJ inválido (dígito verificador incorreto)", () => {
    expect.fail("TODO: implementado no Plano 03 (modules/empresas -> create + validarCNPJ)");
  });

  it("atualiza dados de empresa existente (nome, contatos, particularidades)", () => {
    expect.fail("TODO: implementado no Plano 03 (modules/empresas -> update)");
  });
});
