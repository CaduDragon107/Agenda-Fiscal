import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * tests/geracao.idempotencia.test.ts
 *
 * Cobre TASK-01 (D-10 idempotência, D-11 resumo criadas/puladas, D-12 leitura
 * de regime atual sem histórico). Segue o padrão de vi.mock("@/lib/db") de
 * tests/tarefas.crud.test.ts.
 */

const empresaFindManyMock = vi.fn();
const createManyMock = vi.fn();

vi.mock("@/lib/db", () => {
  const tx = {
    empresa: {
      findMany: (...args: unknown[]) => empresaFindManyMock(...args),
    },
    tarefa: {
      createMany: (...args: unknown[]) => createManyMock(...args),
    },
  };
  return {
    db: {
      ...tx,
      $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
    },
  };
});

describe("executarGeracaoMensal — idempotencia", () => {
  beforeEach(() => {
    empresaFindManyMock.mockReset();
    createManyMock.mockReset();
  });

  it("primeira execução cria tarefas e a segunda execução (mesma competência) não cria nenhuma nova — idempotencia D-10", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    const empresas = [
      { id: "empresa_1", regimeTributario: "LUCRO_REAL", responsavelId: "user_1" }, // 4 obrigações
      { id: "empresa_2", regimeTributario: "SIMPLES_NACIONAL", responsavelId: "user_2" }, // 1 obrigação
    ];
    empresaFindManyMock.mockResolvedValue(empresas);

    // 1ª execução: tudo é novo
    createManyMock.mockResolvedValueOnce({ count: 5 });
    const primeira = await executarGeracaoMensal("2026-07");

    expect(primeira.criadas).toBe(5);
    expect(primeira.puladas).toBe(0);

    // 2ª execução: mesma competência, tudo já existe -> skipDuplicates pula tudo
    createManyMock.mockResolvedValueOnce({ count: 0 });
    const segunda = await executarGeracaoMensal("2026-07");

    expect(segunda.criadas).toBe(0);
    expect(segunda.puladas).toBe(5);
  });

  it("retorna resumo correto quando parte das tarefas já existe — resumo D-11", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    // 5 obrigações geradas (1 empresa LUCRO_REAL=4 + 1 empresa SIMPLES_NACIONAL=1)
    const empresas = [
      { id: "empresa_1", regimeTributario: "LUCRO_REAL", responsavelId: "user_1" },
      { id: "empresa_2", regimeTributario: "SIMPLES_NACIONAL", responsavelId: "user_2" },
    ];
    empresaFindManyMock.mockResolvedValue(empresas);
    createManyMock.mockResolvedValue({ count: 3 });

    const resultado = await executarGeracaoMensal("2026-08");

    expect(resultado).toEqual({ criadas: 3, puladas: 2 });
  });

  it("lê empresas ativas com select mínimo, chama createMany com skipDuplicates e status PENDENTE, e nunca referencia empresaRegimeHistorico", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    const empresas = [
      { id: "empresa_1", regimeTributario: "SIMPLES_NACIONAL", responsavelId: "user_1" },
    ];
    empresaFindManyMock.mockResolvedValue(empresas);
    createManyMock.mockResolvedValue({ count: 1 });

    await executarGeracaoMensal("2026-09");

    expect(empresaFindManyMock).toHaveBeenCalledWith({
      where: { ativo: true },
      select: { id: true, regimeTributario: true, responsavelId: true },
    });

    expect(createManyMock).toHaveBeenCalledTimes(1);
    const arg = createManyMock.mock.calls[0][0] as {
      data: Record<string, unknown>[];
      skipDuplicates: boolean;
    };
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data.every((row) => row.status === "PENDENTE")).toBe(true);

    // mocked db has no empresaRegimeHistorico property — accessing it would throw
    // TypeError, proving the implementation never references it (D-12).
  });
});
