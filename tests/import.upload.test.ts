import { describe, it, expect } from "vitest";

/**
 * tests/import.upload.test.ts
 *
 * Cobre EMPR-02 (V6 - upload): upload de arquivo que não seja .xlsx, ou um
 * .xlsx corrompido/ilegível, deve ser rejeitado com uma mensagem de erro
 * genérica para o usuário, sem expor detalhes internos do parser/stack trace
 * (information disclosure).
 *
 * Implementação real (rota/Server Action de upload) chega no Plano 04.
 */

describe("Upload de planilha de importação", () => {
  it("rejeita upload de arquivo com extensão diferente de .xlsx", () => {
    expect.fail("TODO: implementado no Plano 04 (modules/empresas/import -> validação de extensão)");
  });

  it("rejeita upload de .xlsx corrompido/ilegível com mensagem de erro genérica", () => {
    expect.fail("TODO: implementado no Plano 04 (modules/empresas/import -> tratamento de erro do parser)");
  });

  it("mensagem de erro de upload não expõe detalhes internos do parser (stack trace, caminho de arquivo)", () => {
    expect.fail("TODO: implementado no Plano 04 (modules/empresas/import -> sanitização de erro)");
  });
});
