import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockColaboradorUser } from "./setup";
import type { LinhaImportada } from "@/lib/excel/parse-empresas";

/**
 * tests/import.confirm.test.ts
 *
 * Cobre EMPR-02 / T-01-IMPORT-INPUT: confirmarImportacao
 * (src/app/(app)/empresas/importar/actions.ts) NÃO deve persistir linhas
 * incluídas com regimeTributario ou responsavelId ausentes — revisão humana
 * obrigatória (Step 2 do wizard, UI-SPEC) antes da persistência final.
 *
 * `db`, `auth` e `next/cache` são mockados via vi.mock — nenhuma conexão real
 * ao Postgres. Dados sintéticos (não dependem da planilha real de 197 linhas
 * do Plano 05 Task 1).
 */

const createMock = vi.fn();
const authMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    empresa: {
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

type LinhaRevisada = LinhaImportada & {
  responsavelId?: string;
  incluida: boolean;
};

function linhaValida(overrides: Partial<LinhaRevisada> = {}): LinhaRevisada {
  return {
    nome: "Empresa Válida LTDA",
    cnpj: "11.222.333/0001-81",
    regimeTributario: "LUCRO_REAL",
    responsavelId: "user_colaborador_1",
    incluida: true,
    ...overrides,
  };
}

describe("Confirmação de importação - regime tributário ausente", () => {
  beforeEach(() => {
    createMock.mockReset();
    authMock.mockReset();
    revalidatePathMock.mockReset();
    authMock.mockResolvedValue({ user: mockColaboradorUser() });
    createMock.mockResolvedValue({ id: "empresa_nova" });
  });

  it("não persiste empresas com regimeTributario ausente sem confirmação explícita", async () => {
    const { confirmarImportacao } = await import("@/app/(app)/empresas/importar/actions");

    const linhas: LinhaRevisada[] = [
      linhaValida({ cnpj: "11.222.333/0001-81" }),
      // linha "sem regime" (ex: "Sup. X") incluída mas sem regime atribuído
      {
        nome: "Sup. X",
        cnpj: "11.444.777/0001-61",
        regimeTributario: undefined,
        responsavelId: "user_colaborador_1",
        incluida: true,
      },
    ];

    const resultado = await confirmarImportacao(linhas);

    expect(resultado.ok).toBe(true);
    // apenas a linha com regime preenchido é persistida
    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.cnpj).toBe("11.222.333/0001-81");
    if (resultado.ok) {
      expect(resultado.persistidas).toBe(1);
    }
  });

  it("permite ao usuário atribuir regimeTributario manualmente às linhas sem regime antes de confirmar", async () => {
    const { confirmarImportacao } = await import("@/app/(app)/empresas/importar/actions");

    const linhas: LinhaRevisada[] = [
      // linha originalmente "sem regime" (ex: "Sup. X"), revisada pelo
      // usuário no Step 2 com regimeTributario atribuído manualmente
      {
        nome: "Sup. X",
        cnpj: "11.444.777/0001-61",
        regimeTributario: "SIMPLES_NACIONAL",
        responsavelId: "user_colaborador_1",
        incluida: true,
      },
    ];

    const resultado = await confirmarImportacao(linhas);

    expect(resultado.ok).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.regimeTributario).toBe("SIMPLES_NACIONAL");
    expect(arg.data.cnpj).toBe("11.444.777/0001-61");
    // grava a primeira entrada de EmpresaRegimeHistorico (consistente com Plano 04)
    expect(arg.data.regimeHistorico).toMatchObject({
      create: { regimeTributario: "SIMPLES_NACIONAL" },
    });
    if (resultado.ok) {
      expect(resultado.persistidas).toBe(1);
    }
  });

  it("após confirmação com todos os regimes e responsáveis preenchidos, persiste todas as linhas incluídas", async () => {
    const { confirmarImportacao } = await import("@/app/(app)/empresas/importar/actions");

    const linhas: LinhaRevisada[] = [
      linhaValida({ cnpj: "11.222.333/0001-81", regimeTributario: "LUCRO_REAL" }),
      linhaValida({
        nome: "Empresa Simples LTDA",
        cnpj: "11.444.777/0001-61",
        regimeTributario: "SIMPLES_NACIONAL",
      }),
      linhaValida({
        nome: "Empresa Presumido LTDA",
        cnpj: "11.444.777/0001-61".slice(0, -2) + "61", // placeholder, overwritten below
        regimeTributario: "LUCRO_PRESUMIDO",
      }),
    ];
    // ajustar CNPJs para serem distintos e válidos (módulo 11)
    linhas[2].cnpj = "11.222.333/0001-81";

    const resultado = await confirmarImportacao(linhas);

    expect(resultado.ok).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(3);
    if (resultado.ok) {
      expect(resultado.persistidas).toBe(3);
    }
    expect(revalidatePathMock).toHaveBeenCalledWith("/empresas");
  });

  it("não persiste linha incluída sem responsavelId", async () => {
    const { confirmarImportacao } = await import("@/app/(app)/empresas/importar/actions");

    const linhas: LinhaRevisada[] = [
      linhaValida({ cnpj: "11.222.333/0001-81" }),
      {
        nome: "Empresa Sem Responsável LTDA",
        cnpj: "11.444.777/0001-61",
        regimeTributario: "LUCRO_REAL",
        responsavelId: undefined,
        incluida: true,
      },
    ];

    const resultado = await confirmarImportacao(linhas);

    expect(resultado.ok).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(1);
    if (resultado.ok) {
      expect(resultado.persistidas).toBe(1);
    }
  });

  it("ignora linhas não incluídas (incluida=false)", async () => {
    const { confirmarImportacao } = await import("@/app/(app)/empresas/importar/actions");

    const linhas: LinhaRevisada[] = [
      linhaValida({ cnpj: "11.222.333/0001-81", incluida: true }),
      linhaValida({
        nome: "Empresa Excluída LTDA",
        cnpj: "11.444.777/0001-61",
        incluida: false,
      }),
    ];

    const resultado = await confirmarImportacao(linhas);

    expect(resultado.ok).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(1);
    if (resultado.ok) {
      expect(resultado.persistidas).toBe(1);
    }
  });
});
