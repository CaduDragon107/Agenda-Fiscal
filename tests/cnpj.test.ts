import { describe, it, expect } from "vitest";
import { validarCNPJ } from "@/lib/cnpj";

/**
 * tests/cnpj.test.ts
 *
 * Cobre EMPR-01: validarCNPJ() deve aceitar CNPJs válidos (módulo 11) e
 * rejeitar CNPJs com dígitos verificadores incorretos, tamanho errado ou
 * todos os dígitos iguais.
 *
 * Implementação real: src/lib/cnpj.ts (Plano 03).
 */

describe("validarCNPJ", () => {
  it("aceita CNPJs válidos conhecidos (módulo 11), formatado e sem máscara", () => {
    expect(validarCNPJ("11.222.333/0001-81")).toBe(true);
    expect(validarCNPJ("11222333000181")).toBe(true);
  });

  it("aceita um segundo CNPJ válido distinto (módulo 11)", () => {
    // Receita Federal - CNPJ válido conhecido
    expect(validarCNPJ("11.444.777/0001-61")).toBe(true);
  });

  it("rejeita CNPJs com dígito verificador incorreto", () => {
    // Último dígito alterado de 81 -> 80 (dígito verificador inválido)
    expect(validarCNPJ("11.222.333/0001-80")).toBe(false);
  });

  it("rejeita CNPJs com todos os dígitos iguais (ex: 00.000.000/0000-00)", () => {
    expect(validarCNPJ("00.000.000/0000-00")).toBe(false);
    expect(validarCNPJ("11.111.111/1111-11")).toBe(false);
  });

  it("rejeita strings com tamanho diferente de 14 dígitos", () => {
    expect(validarCNPJ("123")).toBe(false);
    expect(validarCNPJ("11.222.333/0001-811")).toBe(false);
    expect(validarCNPJ("")).toBe(false);
  });
});
