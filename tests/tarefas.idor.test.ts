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

describe("IDOR — criarTarefa", () => {
  // O mock de `db` acima não inclui empresa.findFirst — necessário para CR-01.
  // Os mocks de empresa são injetados em vi.mock de forma extendida aqui.
  // Como vi.mock é hoisted e o objeto já existe, usamos um módulo auxiliar:
  // adicionamos empresa ao db mock como propriedade de teste.
  const empresaFindFirstMock = vi.fn();
  const tarefaCreateMock = vi.fn();

  beforeEach(() => {
    findFirstMock.mockReset();
    empresaFindFirstMock.mockReset();
    tarefaCreateMock.mockReset();
    authMock.mockReset();
  });

  it("COLABORADOR não pode criar tarefa para empresa de outro colaborador", async () => {
    // O mock de db precisa incluir empresa.findFirst para testar o guard CR-01.
    // Re-mocamos o módulo localmente para esta suite.
    vi.doMock("@/lib/db", () => ({
      db: {
        empresa: {
          findFirst: (...args: unknown[]) => empresaFindFirstMock(...args),
        },
        tarefa: {
          findFirst: (...args: unknown[]) => findFirstMock(...args),
          create: (...args: unknown[]) => tarefaCreateMock(...args),
          update: (...args: unknown[]) => updateMock(...args),
          delete: (...args: unknown[]) => deleteMock(...args),
        },
        tarefaHistorico: {
          create: (...args: unknown[]) => historicoCreateMock(...args),
        },
        $transaction: (...args: unknown[]) => transactionMock(...args),
      },
    }));

    const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
    const colaboradorA = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaboradorA });
    // empresa.findFirst escopado retorna null — empresa existe mas pertence a outro
    empresaFindFirstMock.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("titulo", "Tarefa teste");
    formData.set("empresaId", "empresa_de_b");
    formData.set("responsavelId", colaboradorA.id);
    formData.set("prazo", "2026-12-31");

    const resultado = await criarTarefa(formData);

    expect(resultado.ok).toBe(false);
    // tarefa.create não deve ser chamado — barrado pelo guard de empresa
    expect(tarefaCreateMock).not.toHaveBeenCalled();
    // empresa.findFirst deve ter sido chamado com o scope do colaboradorA
    expect(empresaFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "empresa_de_b",
          responsavelId: colaboradorA.id,
        }),
      })
    );
  });

  it("COLABORADOR não pode atribuir tarefa para outro responsável", async () => {
    vi.doMock("@/lib/db", () => ({
      db: {
        empresa: {
          findFirst: (...args: unknown[]) => empresaFindFirstMock(...args),
        },
        tarefa: {
          findFirst: (...args: unknown[]) => findFirstMock(...args),
          create: (...args: unknown[]) => tarefaCreateMock(...args),
          update: (...args: unknown[]) => updateMock(...args),
          delete: (...args: unknown[]) => deleteMock(...args),
        },
        tarefaHistorico: {
          create: (...args: unknown[]) => historicoCreateMock(...args),
        },
        $transaction: (...args: unknown[]) => transactionMock(...args),
      },
    }));

    const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
    const colaboradorA = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaboradorA });
    // empresa pertence ao colaboradorA (guard passa)
    empresaFindFirstMock.mockResolvedValue({ id: "empresa_de_a" });

    const formData = new FormData();
    formData.set("titulo", "Tarefa teste");
    formData.set("empresaId", "empresa_de_a");
    // Tenta atribuir a um responsável diferente
    formData.set("responsavelId", "outro_user_id");
    formData.set("prazo", "2026-12-31");

    const resultado = await criarTarefa(formData);

    expect(resultado.ok).toBe(false);
    expect(tarefaCreateMock).not.toHaveBeenCalled();
  });
});
