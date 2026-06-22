import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * tests/dashboards.snapshot.test.ts
 *
 * Cobre DASH-02 (Plan 04-02): calcularSnapshotMensal (calculo puro contra um
 * `tx` mockado) + executarGeracaoMensal estendido (escrita do snapshot do
 * mes anterior na mesma transacao). Segue a convencao vi.mock("@/lib/db")
 * de tests/geracao.idempotencia.test.ts.
 */

// Hoisted ao topo do modulo (vi.mock e sempre hoisted pelo vitest; vi.hoisted
// torna essas referencias seguras de usar dentro da factory do vi.mock).
const dbMocks = vi.hoisted(() => ({
  empresaFindManyMock: vi.fn(),
  tarefaCreateManyMock: vi.fn(),
  tarefaFindManyMock: vi.fn(),
  empresaGroupByMock: vi.fn(),
  desempenhoMensalCreateManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    empresa: {
      findMany: (...args: unknown[]) => dbMocks.empresaFindManyMock(...args),
      groupBy: (...args: unknown[]) => dbMocks.empresaGroupByMock(...args),
    },
    tarefa: {
      createMany: (...args: unknown[]) => dbMocks.tarefaCreateManyMock(...args),
      findMany: (...args: unknown[]) => dbMocks.tarefaFindManyMock(...args),
    },
    desempenhoMensal: {
      createMany: (...args: unknown[]) => dbMocks.desempenhoMensalCreateManyMock(...args),
    },
  };
  return {
    db: {
      ...tx,
      $transaction: (fn: (tx: unknown) => unknown) => fn(tx),
    },
  };
});

function criarTxMock() {
  const tarefaFindManyMock = vi.fn();
  const empresaGroupByMock = vi.fn();
  const desempenhoMensalCreateManyMock = vi.fn();

  const tx = {
    tarefa: { findMany: (...args: unknown[]) => tarefaFindManyMock(...args) },
    empresa: { groupBy: (...args: unknown[]) => empresaGroupByMock(...args) },
    desempenhoMensal: {
      createMany: (...args: unknown[]) => desempenhoMensalCreateManyMock(...args),
    },
  };

  return { tx, tarefaFindManyMock, empresaGroupByMock, desempenhoMensalCreateManyMock };
}

describe("calcularSnapshotMensal — agregacao D-01/D-02/D-03", () => {
  it("conta totalConcluidas/concluidasNoPrazo/totalTarefasPeriodo por colaborador, respeitando o prazo (D-01/D-02)", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock } = criarTxMock();

    tarefaFindManyMock.mockResolvedValue([
      {
        responsavelId: "user_1",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }], // no prazo
      },
      {
        responsavelId: "user_1",
        prazo: new Date("2026-02-10T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-12T10:00:00") }], // atrasada
      },
      {
        responsavelId: "user_2",
        prazo: new Date("2026-02-25T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-20T10:00:00") }], // no prazo
      },
    ]);
    empresaGroupByMock.mockResolvedValue([
      { responsavelId: "user_1", _count: { id: 30 } },
      { responsavelId: "user_2", _count: { id: 20 } },
    ]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");

    const linhaUser1 = resultado.find((r) => r.colaboradorId === "user_1");
    const linhaUser2 = resultado.find((r) => r.colaboradorId === "user_2");

    expect(linhaUser1).toEqual({
      competencia: "2026-02",
      colaboradorId: "user_1",
      totalConcluidas: 2,
      concluidasNoPrazo: 1,
      totalEmpresas: 30,
      totalTarefasPeriodo: 2,
    });
    expect(linhaUser2).toEqual({
      competencia: "2026-02",
      colaboradorId: "user_2",
      totalConcluidas: 1,
      concluidasNoPrazo: 1,
      totalEmpresas: 20,
      totalTarefasPeriodo: 1,
    });
  });

  it("filtra a populacao de Tarefa por status CONCLUIDA com historico no range — PENDENTE nunca aparece no resultado de tarefaFindMany simulado", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock } = criarTxMock();

    // Simula o filtro real do banco: where status=CONCLUIDA já exclui PENDENTE,
    // então o mock simplesmente não retorna nenhuma linha PENDENTE.
    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");

    expect(tarefaFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "CONCLUIDA" }),
      })
    );
    expect(resultado).toEqual([]);
  });

  it("usa Tarefa.responsavelId (nao Empresa.responsavelId) e select explicito sem 'responsavel: true'/'colaborador: true' (T-04-LEAK)", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock } = criarTxMock();

    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);

    await calcularSnapshotMensal(tx as never, "2026-02");

    const arg = tarefaFindManyMock.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect(arg.select).toHaveProperty("responsavelId", true);
    expect(arg.select).not.toHaveProperty("responsavel");
    expect(arg.select).not.toHaveProperty("colaborador");
  });
});

describe("calcularSnapshotMensal — paridade com query live (avulsa)", () => {
  it(
    "população do snapshot filtra por concluidoEm-no-período e inclui tarefas avulsas (competencia=null), sem descontinuidade live->frozen (avulsa)"
  , async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock } = criarTxMock();

    // Tarefa avulsa: nao tem `competencia` no mock pois a query nunca filtra
    // por esse campo — representa uma tarefa criada manualmente (Fase 2)
    // cujo concluidoEm cai dentro do range do mes-alvo.
    tarefaFindManyMock.mockResolvedValue([
      {
        responsavelId: "user_3",
        prazo: new Date("2026-02-18T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-17T09:00:00") }],
      },
    ]);
    empresaGroupByMock.mockResolvedValue([{ responsavelId: "user_3", _count: { id: 5 } }]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");

    const linhaUser3 = resultado.find((r) => r.colaboradorId === "user_3");
    expect(linhaUser3?.totalConcluidas).toBe(1);
    expect(linhaUser3?.concluidasNoPrazo).toBe(1);

    // CRITICO: a query nunca deve incluir `competencia` no where —
    // garantindo que tarefas avulsas (competencia=null) nao sejam excluidas.
    const arg = tarefaFindManyMock.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(arg.where).not.toHaveProperty("competencia");
  });
});

describe("executarGeracaoMensal — congelamento do mes anterior (snapshot)", () => {
  const {
    empresaFindManyMock,
    tarefaCreateManyMock,
    tarefaFindManyMock,
    empresaGroupByMock,
    desempenhoMensalCreateManyMock,
  } = dbMocks;

  beforeEach(() => {
    empresaFindManyMock.mockReset();
    tarefaCreateManyMock.mockReset();
    tarefaFindManyMock.mockReset();
    empresaGroupByMock.mockReset();
    desempenhoMensalCreateManyMock.mockReset();

    empresaFindManyMock.mockResolvedValue([]);
    tarefaCreateManyMock.mockResolvedValue({ count: 0 });
    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);
    desempenhoMensalCreateManyMock.mockResolvedValue({ count: 0 });
  });

  it(
    "snapshot fecha o mes ANTERIOR à competência passada para executarGeracaoMensal, não o mes atual (boundary)"
  , async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    tarefaFindManyMock.mockResolvedValue([
      {
        responsavelId: "user_1",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      },
    ]);
    empresaGroupByMock.mockResolvedValue([{ responsavelId: "user_1", _count: { id: 10 } }]);

    await executarGeracaoMensal("2026-03");

    // tarefa.findMany deve ter sido chamado com o range de Fevereiro/2026
    // (mes anterior a Marco/2026), nunca Marco nem Abril.
    const arg = tarefaFindManyMock.mock.calls[0][0] as {
      where: { historico: { some: { concluidoEm: { gte: Date; lte: Date } } } };
    };
    const { gte, lte } = arg.where.historico.some.concluidoEm;
    expect(gte.getUTCMonth()).toBe(1); // Fevereiro (0-indexed)
    expect(lte.getUTCMonth()).toBe(1);

    expect(desempenhoMensalCreateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ competencia: "2026-02", colaboradorId: "user_1" }),
        ]),
        skipDuplicates: true,
      })
    );
  });

  it(
    "escrita do snapshot é idempotente via createMany skipDuplicates contra @@unique([competencia, colaboradorId]) (idempot)"
  , async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    tarefaFindManyMock.mockResolvedValue([
      {
        responsavelId: "user_1",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      },
    ]);
    empresaGroupByMock.mockResolvedValue([{ responsavelId: "user_1", _count: { id: 10 } }]);

    // 1a execucao: snapshot e gravado
    desempenhoMensalCreateManyMock.mockResolvedValueOnce({ count: 1 });
    await executarGeracaoMensal("2026-03");

    // 2a execucao com a MESMA competencia: skipDuplicates pula a linha já
    // existente — apenas verificamos que a chamada usa skipDuplicates true
    // e que nenhuma chamada adicional de calculo altera o resultado já persistido.
    desempenhoMensalCreateManyMock.mockResolvedValueOnce({ count: 0 });
    await executarGeracaoMensal("2026-03");

    expect(desempenhoMensalCreateManyMock).toHaveBeenCalledTimes(2);
    for (const call of desempenhoMensalCreateManyMock.mock.calls) {
      expect((call[0] as { skipDuplicates: boolean }).skipDuplicates).toBe(true);
    }
  });

  it(
    "competência fechada não recalcula o snapshot já persistido mesmo se Tarefa/TarefaHistorico do mês mudarem (frozen, D-05)"
  , async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    // 1a execucao: snapshot calculado e persistido com 1 tarefa concluida
    tarefaFindManyMock.mockResolvedValueOnce([
      {
        responsavelId: "user_1",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      },
    ]);
    empresaGroupByMock.mockResolvedValueOnce([{ responsavelId: "user_1", _count: { id: 10 } }]);
    desempenhoMensalCreateManyMock.mockResolvedValueOnce({ count: 1 });
    await executarGeracaoMensal("2026-03");

    const primeiraChamada = desempenhoMensalCreateManyMock.mock.calls[0][0] as {
      data: Array<{ totalConcluidas: number }>;
    };
    expect(primeiraChamada.data[0].totalConcluidas).toBe(1);

    // Dados "mudam retroativamente": agora ha 5 tarefas concluidas no mesmo mes.
    tarefaFindManyMock.mockResolvedValueOnce(
      Array.from({ length: 5 }, () => ({
        responsavelId: "user_1",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      }))
    );
    empresaGroupByMock.mockResolvedValueOnce([{ responsavelId: "user_1", _count: { id: 10 } }]);
    // skipDuplicates faz o banco real preservar a 1a escrita — aqui simulamos
    // o efeito (count: 0, nenhuma linha nova) mesmo com payload recalculado maior.
    desempenhoMensalCreateManyMock.mockResolvedValueOnce({ count: 0 });
    await executarGeracaoMensal("2026-03");

    // A funcao SEMPRE recalcula em memoria antes de chamar createMany (isso é
    // esperado — o calculo é puro), mas a garantia de "frozen" mora na
    // constraint do banco (skipDuplicates), nao em pre-checagem de aplicacao
    // (D-10). Validamos que a segunda chamada tambem usa skipDuplicates true,
    // preservando a primeira escrita real no banco.
    const segundaChamada = desempenhoMensalCreateManyMock.mock.calls[1][0] as {
      skipDuplicates: boolean;
    };
    expect(segundaChamada.skipDuplicates).toBe(true);
  });
});
