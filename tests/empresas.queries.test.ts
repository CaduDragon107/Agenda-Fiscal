import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockColaboradorUser, mockDonoUser } from "./setup";

/**
 * tests/empresas.queries.test.ts
 *
 * Cobre EMPR-01 (schema) e AUTH-02 (escopo aplicado nas queries):
 * - empresaSchema valida payload correto e rejeita CNPJ inválido /
 *   responsavelId vazio.
 * - listarEmpresas e buscarEmpresaPorId SEMPRE espalham
 *   withVisibilityScope(user) no `where` do Prisma — nunca consultam
 *   db.empresa sem escopo.
 *
 * `db` é mockado via vi.mock("@/lib/db") — nenhuma conexão real ao Postgres.
 */

const findManyMock = vi.fn();
const findFirstMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    empresa: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
  },
}));

describe("empresaSchema", () => {
  it("aceita payload válido (regime LUCRO_PRESUMIDO, CNPJ válido, responsavelId presente)", async () => {
    const { empresaSchema } = await import("@/modules/empresas/schema");

    const resultado = empresaSchema.safeParse({
      nome: "Empresa Teste LTDA",
      cnpj: "11.222.333/0001-81",
      regimeTributario: "LUCRO_PRESUMIDO",
      responsavelId: "user_colaborador_1",
    });

    expect(resultado.success).toBe(true);
  });

  it("rejeita CNPJ com dígito verificador inválido (mensagem 'CNPJ inválido')", async () => {
    const { empresaSchema } = await import("@/modules/empresas/schema");

    const resultado = empresaSchema.safeParse({
      nome: "Empresa Teste LTDA",
      cnpj: "11.222.333/0001-80",
      regimeTributario: "LUCRO_PRESUMIDO",
      responsavelId: "user_colaborador_1",
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const cnpjIssue = resultado.error.issues.find((i) =>
        i.path.includes("cnpj")
      );
      expect(cnpjIssue?.message).toBe("CNPJ inválido");
    }
  });

  it("rejeita responsavelId vazio", async () => {
    const { empresaSchema } = await import("@/modules/empresas/schema");

    const resultado = empresaSchema.safeParse({
      nome: "Empresa Teste LTDA",
      cnpj: "11.222.333/0001-81",
      regimeTributario: "LUCRO_PRESUMIDO",
      responsavelId: "",
    });

    expect(resultado.success).toBe(false);
  });
});

describe("queries de empresa - escopo de visibilidade", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    findFirstMock.mockReset();
  });

  it("listarEmpresas(dono) chama db.empresa.findMany com where = {} (sem restrição)", async () => {
    const { listarEmpresas } = await import("@/modules/empresas/queries");
    findManyMock.mockResolvedValue([]);

    await listarEmpresas(mockDonoUser());

    expect(findManyMock).toHaveBeenCalledTimes(1);
    const arg = findManyMock.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({});
    expect(arg.where.responsavelId).toBeUndefined();
  });

  it("listarEmpresas(colaborador) chama db.empresa.findMany com where contendo responsavelId", async () => {
    const { listarEmpresas } = await import("@/modules/empresas/queries");
    const colaborador = mockColaboradorUser();
    findManyMock.mockResolvedValue([]);

    await listarEmpresas(colaborador);

    expect(findManyMock).toHaveBeenCalledTimes(1);
    const arg = findManyMock.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({ responsavelId: colaborador.id });
  });

  it("buscarEmpresaPorId(user, id) chama db.empresa.findFirst com { id, ...withVisibilityScope(user) }", async () => {
    const { buscarEmpresaPorId } = await import("@/modules/empresas/queries");
    const colaborador = mockColaboradorUser();
    findFirstMock.mockResolvedValue(null);

    await buscarEmpresaPorId(colaborador, "empresa_123");

    expect(findFirstMock).toHaveBeenCalledTimes(1);
    const arg = findFirstMock.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({
      id: "empresa_123",
      responsavelId: colaborador.id,
    });
  });
});
