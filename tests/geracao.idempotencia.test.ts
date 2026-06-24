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
// NOVO (Plan 04-02): executarGeracaoMensal agora tambem chama
// calcularSnapshotMensal (tarefa.findMany + empresa.groupBy) e
// desempenhoMensal.createMany dentro da mesma transacao, antes da geracao.
const tarefaFindManyMock = vi.fn();
const empresaGroupByMock = vi.fn();
const desempenhoMensalCreateManyMock = vi.fn();

vi.mock("@/lib/db", () => {
  const tx = {
    empresa: {
      findMany: (...args: unknown[]) => empresaFindManyMock(...args),
      groupBy: (...args: unknown[]) => empresaGroupByMock(...args),
    },
    tarefa: {
      createMany: (...args: unknown[]) => createManyMock(...args),
      findMany: (...args: unknown[]) => tarefaFindManyMock(...args),
    },
    desempenhoMensal: {
      createMany: (...args: unknown[]) => desempenhoMensalCreateManyMock(...args),
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
    tarefaFindManyMock.mockReset();
    empresaGroupByMock.mockReset();
    desempenhoMensalCreateManyMock.mockReset();

    // Snapshot do mes anterior: por padrao, sem tarefas concluidas no range
    // (mantem os testes de geracao de tarefas focados em D-10/D-11/D-12,
    // sem produzir linhas de snapshot incidentais).
    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);
    desempenhoMensalCreateManyMock.mockResolvedValue({ count: 0 });
  });

  it("primeira execução cria tarefas e a segunda execução (mesma competência) não cria nenhuma nova — idempotencia D-10", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    const empresas = [
      { id: "empresa_1", regimeTributario: "LUCRO_REAL", responsavelId: "user_1" }, // 4 obrigações
      { id: "empresa_2", regimeTributario: "SIMPLES_NACIONAL", responsavelId: "user_2" }, // 1 obrigação
    ];
    empresaFindManyMock
      .mockResolvedValueOnce(empresas)
      .mockResolvedValueOnce([]); // loop DP: nenhuma empresa CLT
    createManyMock.mockResolvedValueOnce({ count: 5 });
    const primeira = await executarGeracaoMensal("2026-07");

    expect(primeira.criadas).toBe(5);
    expect(primeira.puladas).toBe(0);

    // 2ª execução: mesma competência, tudo já existe -> skipDuplicates pula tudo
    empresaFindManyMock
      .mockResolvedValueOnce(empresas)
      .mockResolvedValueOnce([]);
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
    empresaFindManyMock
      .mockResolvedValueOnce(empresas)
      .mockResolvedValueOnce([]);
    createManyMock.mockResolvedValue({ count: 3 });

    const resultado = await executarGeracaoMensal("2026-08");

    expect(resultado).toEqual({ criadas: 3, puladas: 2, semResponsavelDp: [] });
  });

  it("lê empresas ativas com select mínimo, chama createMany com skipDuplicates e status PENDENTE, e nunca referencia empresaRegimeHistorico", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    const empresas = [
      { id: "empresa_1", regimeTributario: "SIMPLES_NACIONAL", responsavelId: "user_1" },
    ];
    empresaFindManyMock
      .mockResolvedValueOnce(empresas)
      .mockResolvedValueOnce([]);
    createManyMock.mockResolvedValue({ count: 1 });

    await executarGeracaoMensal("2026-09");

    expect(empresaFindManyMock).toHaveBeenNthCalledWith(1, {
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

  it("empresa CLT sem responsável DP é pulada e listada, sem bloquear geração Fiscal", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    const empresasFiscal = [
      { id: "e1", regimeTributario: "SIMPLES_NACIONAL", responsavelId: "u1" },
    ];
    const empresasClt = [
      { id: "e2", nome: "Empresa CLT sem DP", responsaveisPorSetor: [] },
    ];
    empresaFindManyMock
      .mockResolvedValueOnce(empresasFiscal) // 1a chamada: loop Fiscal
      .mockResolvedValueOnce(empresasClt); // 2a chamada: loop DP

    createManyMock.mockResolvedValue({ count: 1 }); // so a tarefa Fiscal e criada

    const resultado = await executarGeracaoMensal("2026-07");

    expect(resultado.criadas).toBe(1);
    expect(resultado.semResponsavelDp).toEqual([
      { empresaId: "e2", nome: "Empresa CLT sem DP" },
    ]);
  });

  it("empresa CLT com responsável DP gera as 4 tarefas de DP atribuídas ao responsável DP", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    empresaFindManyMock
      .mockResolvedValueOnce([]) // loop Fiscal vazio
      .mockResolvedValueOnce([
        {
          id: "e3",
          nome: "Empresa CLT com DP",
          responsaveisPorSetor: [{ usuarioId: "dp_user" }],
        },
      ]);

    createManyMock.mockResolvedValue({ count: 4 });

    const resultado = await executarGeracaoMensal("2026-07");

    expect(resultado.criadas).toBe(4);
    expect(resultado.semResponsavelDp).toEqual([]);

    const arg = createManyMock.mock.calls[0][0] as {
      data: { responsavelId: string; tipoObrigacao: string }[];
    };
    expect(arg.data).toHaveLength(4);
    expect(arg.data.every((t) => t.responsavelId === "dp_user")).toBe(true);
    expect(arg.data.map((t) => t.tipoObrigacao).sort()).toEqual(
      ["ESOCIAL", "FGTS", "FOLHA", "INSS"].sort()
    );
  });

  it("regressão: empresa com responsável FISCAL e DP simultâneos — tarefa DP usa o usuário DP, nunca o FISCAL", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    empresaFindManyMock
      .mockResolvedValueOnce([]) // loop Fiscal vazio
      .mockResolvedValueOnce([
        {
          id: "e4",
          nome: "Empresa CLT com FISCAL e DP",
          // a query DP filtra por setor:"DP" no select — o mock só devolve a
          // linha DP, simulando o filtro já aplicado pelo Prisma.
          responsaveisPorSetor: [{ usuarioId: "dp_user" }],
        },
      ]);

    createManyMock.mockResolvedValue({ count: 4 });

    await executarGeracaoMensal("2026-07");

    const arg = createManyMock.mock.calls[0][0] as {
      data: { responsavelId: string }[];
    };
    expect(arg.data.every((t) => t.responsavelId === "dp_user")).toBe(true);
    expect(arg.data.some((t) => t.responsavelId === "user_fiscal")).toBe(
      false
    );
  });

  it("idempotência DP: segunda execução na mesma competência não duplica tarefas de DP", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    const empresasClt = [
      {
        id: "e5",
        nome: "Empresa CLT",
        responsaveisPorSetor: [{ usuarioId: "dp_user" }],
      },
    ];

    empresaFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(empresasClt);
    createManyMock.mockResolvedValueOnce({ count: 4 });
    const primeira = await executarGeracaoMensal("2026-07");
    expect(primeira.criadas).toBe(4);
    expect(primeira.puladas).toBe(0);

    empresaFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(empresasClt);
    createManyMock.mockResolvedValueOnce({ count: 0 });
    const segunda = await executarGeracaoMensal("2026-07");
    expect(segunda.criadas).toBe(0);
    expect(segunda.puladas).toBe(4);
  });
});
