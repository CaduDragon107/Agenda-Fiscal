import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockColaboradorUser } from "./setup";

/**
 * tests/tarefas.idor.test.ts
 *
 * Cobre T-02-IDOR: COLABORADOR não pode concluir nem excluir tarefa de outro
 * colaborador via Server Action direta (IDOR prevention).
 *
 * Contrato (T-02-IDOR): toda mutação de tarefa por id deve usar
 * findFirst({ where: { id, ...withTarefaScope(session.user) } }) e retornar
 * "não encontrado" quando fora do escopo — sem alterar o registro.
 *
 * `db` e `auth` são mockados via vi.mock — nenhuma conexão real ao Postgres.
 */

const findFirstMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const transactionMock = vi.fn();
const historicoCreateMock = vi.fn();
const authMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    tarefa: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
    },
    tarefaHistorico: {
      create: (...args: unknown[]) => historicoCreateMock(...args),
    },
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("IDOR — concluirTarefa", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
    historicoCreateMock.mockReset();
    transactionMock.mockReset();
    authMock.mockReset();
  });

  it("COLABORADOR não pode concluir tarefa de outro colaborador — retorna { ok: false } com 'não encontrado'", async () => {
    const { concluirTarefa } = await import("@/app/(app)/tarefas/actions");
    const colaboradorA = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaboradorA });
    // findFirst escopado retorna null — tarefa existe mas pertence a outro colaborador
    findFirstMock.mockResolvedValue(null);

    const resultado = await concluirTarefa("tarefa_de_b");

    expect(resultado).toEqual({ ok: false, error: "não encontrado" });
    // Nenhuma escrita deve ocorrer
    expect(transactionMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(historicoCreateMock).not.toHaveBeenCalled();

    // Verifica que o where inclui responsavelId do colaboradorA (escopo RBAC)
    const arg = findFirstMock.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({
      id: "tarefa_de_b",
      responsavelId: colaboradorA.id,
    });
  });
});

describe("IDOR — excluirTarefa", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    deleteMock.mockReset();
    authMock.mockReset();
  });

  it("COLABORADOR não pode excluir tarefa de outro colaborador — retorna { ok: false } com 'não encontrado'", async () => {
    const { excluirTarefa } = await import("@/app/(app)/tarefas/actions");
    const colaboradorA = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaboradorA });
    // findFirst escopado retorna null — tarefa fora do escopo de colaboradorA
    findFirstMock.mockResolvedValue(null);

    const resultado = await excluirTarefa("tarefa_de_b");

    expect(resultado).toEqual({ ok: false, error: "não encontrado" });
    // Delete não deve ser chamado
    expect(deleteMock).not.toHaveBeenCalled();

    // Verifica que o where inclui responsavelId do colaboradorA (escopo RBAC)
    const arg = findFirstMock.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({
      id: "tarefa_de_b",
      responsavelId: colaboradorA.id,
    });
  });
});
