import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockColaboradorUser, mockDonoUser } from "./setup";

/**
 * tests/tarefas.queries.test.ts
 *
 * Cobre TASK-05: buscarTarefaPorId com escopo de visibilidade (anti-IDOR).
 * Segue o padrão de vi.mock de tests/empresas.idor.test.ts.
 *
 * Verifica que withTarefaScope é aplicado corretamente:
 * - COLABORADOR: where inclui responsavelId (restrição de escopo)
 * - DONO: where sem responsavelId (visão geral)
 */

const findFirstMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    tarefa: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe("buscarTarefaPorId", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it("retorna null para tarefa fora do escopo do COLABORADOR", async () => {
    const { buscarTarefaPorId } = await import("@/modules/tarefas/queries");
    const colaborador = mockColaboradorUser();

    // findFirst escopado retorna null — tarefa existe mas pertence a outro responsável
    findFirstMock.mockResolvedValue(null);

    const resultado = await buscarTarefaPorId(colaborador, "tarefa_de_outro");

    expect(resultado).toBeNull();
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    const arg = findFirstMock.mock.calls[0][0] as { where: Record<string, unknown> };
    // Verifica que o where inclui responsavelId do colaborador (withTarefaScope)
    expect(arg.where).toMatchObject({
      id: "tarefa_de_outro",
      responsavelId: colaborador.id,
    });
  });

  it("DONO consegue buscar qualquer tarefa por id", async () => {
    const { buscarTarefaPorId } = await import("@/modules/tarefas/queries");
    const dono = mockDonoUser();

    const mockTarefa = {
      id: "tarefa_de_qualquer",
      titulo: "SPED Fiscal",
      status: "PENDENTE",
    };
    findFirstMock.mockResolvedValue(mockTarefa);

    const resultado = await buscarTarefaPorId(dono, "tarefa_de_qualquer");

    expect(resultado).toEqual(mockTarefa);
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    const arg = findFirstMock.mock.calls[0][0] as { where: Record<string, unknown> };
    // DONO: where tem id mas NÃO tem responsavelId (withTarefaScope retorna {})
    expect(arg.where).toMatchObject({ id: "tarefa_de_qualquer" });
    expect(arg.where.responsavelId).toBeUndefined();
  });

  it("retorna a tarefa correta para o COLABORADOR responsável", async () => {
    const { buscarTarefaPorId } = await import("@/modules/tarefas/queries");
    const colaborador = mockColaboradorUser();

    const mockTarefa = {
      id: "tarefa_propria",
      titulo: "DAS Simples",
      responsavelId: colaborador.id,
      status: "PENDENTE",
    };
    findFirstMock.mockResolvedValue(mockTarefa);

    const resultado = await buscarTarefaPorId(colaborador, "tarefa_propria");

    expect(resultado).toEqual(mockTarefa);
    // Verifica escopo correto no where
    const arg = findFirstMock.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({
      id: "tarefa_propria",
      responsavelId: colaborador.id,
    });
  });
});
