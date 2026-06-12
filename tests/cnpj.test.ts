import { describe, it, expect } from "vitest";

/**
 * tests/cnpj.test.ts
 *
 * Cobre EMPR-01: validarCNPJ() deve aceitar CNPJs válidos (módulo 11) e
 * rejeitar CNPJs com dígitos verificadores incorretos.
 *
 * Implementação real (lib/cnpj.ts) chega no Plano 03. Este stub documenta
 * o contrato esperado e os CNPJs de referência que o teste real usará.
 */

describe("validarCNPJ", () => {
  it("aceita CNPJs válidos conhecidos (módulo 11)", () => {
    // CNPJs de referência a usar no Plano 03:
    // - "11.222.333/0001-81" (válido, formatado)
    // - "11222333000181" (válido, sem máscara)
    expect.fail("TODO: implementado no Plano 03 (lib/cnpj.ts -> validarCNPJ)");
  });

  it("rejeita CNPJs com dígito verificador incorreto", () => {
    // Exemplo: "11.222.333/0001-80" (dígito verificador alterado, deve falhar)
    expect.fail("TODO: implementado no Plano 03 (lib/cnpj.ts -> validarCNPJ)");
  });

  it("rejeita CNPJs com todos os dígitos iguais (ex: 00.000.000/0000-00)", () => {
    expect.fail("TODO: implementado no Plano 03 (lib/cnpj.ts -> validarCNPJ)");
  });

  it("rejeita strings com tamanho diferente de 14 dígitos", () => {
    expect.fail("TODO: implementado no Plano 03 (lib/cnpj.ts -> validarCNPJ)");
  });
});
