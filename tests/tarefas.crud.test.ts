import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockColaboradorUser, mockDonoUser } from "./setup";

/**
 * tests/tarefas.crud.test.ts
 *
 * Cobre TASK-03 (concluirTarefa + excluirTarefa) e TASK-04 (criarTarefa).
 * Segue o padrão de vi.mock de tests/empresas.idor.test.ts:
 * - vi.mock("@/lib/db") para mockar db.tarefa e db.$transaction
 * - vi.mock("@/auth") para simular sessão válida ou null
 */

const createMock = vi.fn();
const findFirstMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const transactionMock = vi.fn();
const historicoCreateMock = vi.fn();
const authMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    tarefa: {
      create: (...args: unknown[]) => createMock(...args),
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

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("titulo", overrides.titulo ?? "Declaração ICMS");
  fd.set("descricao", overrides.descricao ?? "");
  fd.set("empresaId", overrides.empresaId ?? "empresa_abc");
  fd.set("responsavelId", overrides.responsavelId ?? "user_colaborador_1");
  fd.set("prazo", overrides.prazo ?? "2026-07-31");
  return fd;
}

describe("criarTarefa", () => {
  beforeEach(() => {
    createMock.mockReset();
    findFirstMock.mockReset();
    authMock.mockReset();
  });

  it("cria tarefa com todos os campos obrigatórios", async () => {
    const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
    const colaborador = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaborador });
    createMock.mockResolvedValue({ id: "tarefa_nova_1" });

    const resultado = await criarTarefa(buildFormData());

    expect(resultado).toEqual({ ok: true, id: "tarefa_nova_1" });
    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.titulo).toBe("Declaração ICMS");
    expect(arg.data.empresaId).toBe("empresa_abc");
    expect(arg.data.status).toBe("PENDENTE");
    // prazo deve ser Date (transformado pelo schema)
    expect(arg.data.prazo).toBeInstanceOf(Date);
  });

  it("retorna { ok: false } sem título", async () => {
    const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
    const colaborador = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaborador });

    const resultado = await criarTarefa(buildFormData({ titulo: "" }));

    expect(resultado.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("retorna { ok: false } sem empresaId", async () => {
    const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
    const colaborador = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaborador });

    const resultado = await criarTarefa(buildFormData({ empresaId: "" }));

    expect(resultado.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("retorna { ok: false } sem prazo", async () => {
    const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
    const colaborador = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaborador });

    const resultado = await criarTarefa(buildFormData({ prazo: "" }));

    expect(resultado.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("concluirTarefa", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
    historicoCreateMock.mockReset();
    transactionMock.mockReset();
    authMock.mockReset();
  });

  it("muda status para CONCLUIDA e cria TarefaHistorico", async () => {
    const { concluirTarefa } = await import("@/app/(app)/tarefas/actions");
    const colaborador = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaborador });
    findFirstMock.mockResolvedValue({ id: "tarefa_1", status: "PENDENTE" });
    // $transaction recebe array de promises — simulamos a execução e retornamos
    transactionMock.mockImplementation((ops: unknown[]) => Promise.all(ops));
    updateMock.mockResolvedValue({ id: "tarefa_1", status: "CONCLUIDA" });
    historicoCreateMock.mockResolvedValue({ id: "hist_1" });

    const resultado = await concluirTarefa("tarefa_1");

    expect(resultado).toEqual({ ok: true });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    // Verifica que update e create de histórico foram preparados
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(historicoCreateMock).toHaveBeenCalledTimes(1);

    const historicoArg = historicoCreateMock.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(historicoArg.data.tarefaId).toBe("tarefa_1");
    expect(historicoArg.data.concluidoPorId).toBe(colaborador.id);
  });

  it("é idempotente se já CONCLUIDA", async () => {
    const { concluirTarefa } = await import("@/app/(app)/tarefas/actions");
    const colaborador = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaborador });
    // Tarefa já CONCLUIDA — findFirst retorna com status CONCLUIDA
    findFirstMock.mockResolvedValue({ id: "tarefa_1", status: "CONCLUIDA" });

    const resultado = await concluirTarefa("tarefa_1");

    expect(resultado).toEqual({ ok: true });
    // Não deve chamar transaction (nem update, nem create histórico)
    expect(transactionMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(historicoCreateMock).not.toHaveBeenCalled();
  });
});

describe("excluirTarefa", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    deleteMock.mockReset();
    authMock.mockReset();
  });

  it("remove a tarefa do banco", async () => {
    const { excluirTarefa } = await import("@/app/(app)/tarefas/actions");
    const dono = mockDonoUser();

    authMock.mockResolvedValue({ user: dono });
    findFirstMock.mockResolvedValue({ id: "tarefa_1" });
    deleteMock.mockResolvedValue({ id: "tarefa_1" });

    const resultado = await excluirTarefa("tarefa_1");

    expect(resultado).toEqual({ ok: true });
    expect(deleteMock).toHaveBeenCalledTimes(1);
    const arg = deleteMock.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({ id: "tarefa_1" });
  });
});
