import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockColaboradorUser } from "./setup";

/**
 * tests/import.upload.test.ts
 *
 * Cobre EMPR-02 (V6 - upload) / T-01-UPLOAD: upload de arquivo que não seja
 * .xlsx, ou um .xlsx corrompido/ilegível, deve ser rejeitado por
 * parseUploadAction (src/app/(app)/empresas/importar/actions.ts) com uma
 * mensagem de erro genérica para o usuário, sem expor detalhes internos do
 * parser (stack trace, mensagem do SheetJS, caminho de arquivo) — information
 * disclosure.
 *
 * `auth` é mockado via vi.mock — nenhuma conexão real ao Postgres/SheetJS.
 */

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const ERRO_GENERICO = "Arquivo inválido. Envie um arquivo .xlsx válido.";

function buildFormData(file: File): FormData {
  const fd = new FormData();
  fd.set("arquivo", file);
  return fd;
}

describe("Upload de planilha de importação (parseUploadAction)", () => {
  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue({ user: mockColaboradorUser() });
  });

  it("rejeita upload de arquivo com extensão diferente de .xlsx", async () => {
    const { parseUploadAction } = await import("@/app/(app)/empresas/importar/actions");

    const arquivo = new File(["conteudo qualquer"], "lista.csv", {
      type: "text/csv",
    });

    const resultado = await parseUploadAction(buildFormData(arquivo));

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toBe(ERRO_GENERICO);
    }
  });

  it("rejeita upload de .xlsx corrompido/ilegível com mensagem de erro genérica", async () => {
    const { parseUploadAction } = await import("@/app/(app)/empresas/importar/actions");

    // Bytes arbitrários, não um .xlsx válido (zip/OOXML) -> XLSX.read lança.
    const arquivo = new File(["isto nao e um xlsx valido"], "corrompido.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const resultado = await parseUploadAction(buildFormData(arquivo));

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toBe(ERRO_GENERICO);
    }
  });

  it("mensagem de erro de upload não expõe detalhes internos do parser (stack trace, caminho de arquivo)", async () => {
    const { parseUploadAction } = await import("@/app/(app)/empresas/importar/actions");

    const arquivo = new File(["isto nao e um xlsx valido"], "corrompido.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const resultado = await parseUploadAction(buildFormData(arquivo));

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).not.toMatch(/at \S+:\d+/); // sem stack trace
      expect(resultado.error.toLowerCase()).not.toContain("sheetjs");
      expect(resultado.error.toLowerCase()).not.toContain("xlsx.read");
      expect(resultado.error).not.toMatch(/[\\/].*\.xlsx/i); // sem caminho de arquivo
    }
  });
});
