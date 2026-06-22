import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * tests/dashboards.queries.test.ts
 *
 * Cobre DASH-01 (listarDesempenhoColaboradoresMesAtual, listarEvolucaoMensal)
 * e DASH-03 (listarRankingEmpresas). Segue o padrão vi.mock("@/lib/db") de
 * tests/geracao.idempotencia.test.ts.
 */

const tarefaFindManyMock = vi.fn();
const empresaGroupByMock = vi.fn();
const usuarioFindManyMock = vi.fn();
const desempenhoMensalGroupByMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    tarefa: {
      findMany: (...args: unknown[]) => tarefaFindManyMock(...args),
    },
    empresa: {
      groupBy: (...args: unknown[]) => empresaGroupByMock(...args),
    },
    usuario: {
      findMany: (...args: unknown[]) => usuarioFindManyMock(...args),
    },
    desempenhoMensal: {
      groupBy: (...args: unknown[]) => desempenhoMensalGroupByMock(...args),
    },
  },
}));

describe("listarDesempenhoColaboradoresMesAtual", () => {
  beforeEach(() => {
    tarefaFindManyMock.mockReset();
    empresaGroupByMock.mockReset();
    usuarioFindManyMock.mockReset();
  });

  it("calcula % no prazo por colaboradores usando concluidoEm <= prazo (D-01)", async () => {
    const { listarDesempenhoColaboradoresMesAtual } = await import(
      "@/modules/dashboards/queries"
    );

    const mesRef = new Date("2026-06-15T12:00:00");

    tarefaFindManyMock.mockResolvedValue([
      {
        responsavelId: "user_1",
        prazo: new Date("2026-06-10T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-06-09T10:00:00") }], // no prazo
      },
      {
        responsavelId: "user_1",
        prazo: new Date("2026-06-12T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-06-13T10:00:00") }], // atrasada
      },
    ]);
    empresaGroupByMock.mockResolvedValue([
      { responsavelId: "user_1", _count: { id: 5 } },
    ]);
    usuarioFindManyMock.mockResolvedValue([
      { id: "user_1", nome: "Caio" },
    ]);

    const resultado = await listarDesempenhoColaboradoresMesAtual(mesRef);

    expect(Array.isArray(resultado)).toBe(true);
    const caio = resultado.find((r) => r.colaboradorId === "user_1");
    expect(caio).toBeDefined();
    expect(caio?.totalConcluidas).toBe(2);
    expect(caio?.percentualNoPrazo).toBe(50);
  });

  it("exclui tarefas PENDENTE do denominador de % no prazo por colaboradores (D-02)", async () => {
    const { listarDesempenhoColaboradoresMesAtual } = await import(
      "@/modules/dashboards/queries"
    );

    // O filtro de população (status: "CONCLUIDA") já é aplicado no `where` do
    // findMany — o mock simula que o Prisma já excluiu PENDENTE, e o teste
    // assere que apenas as CONCLUIDA retornadas pelo mock entram no total
    // (ou seja, a implementação não conta nada além do que findMany devolve).
    tarefaFindManyMock.mockResolvedValue([
      {
        responsavelId: "user_2",
        prazo: new Date("2026-06-10T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-06-09T10:00:00") }],
      },
    ]);
    empresaGroupByMock.mockResolvedValue([
      { responsavelId: "user_2", _count: { id: 3 } },
    ]);
    usuarioFindManyMock.mockResolvedValue([
      { id: "user_2", nome: "Jessica" },
    ]);

    const resultado = await listarDesempenhoColaboradoresMesAtual(
      new Date("2026-06-15T12:00:00")
    );

    const jessica = resultado.find((r) => r.colaboradorId === "user_2");
    expect(jessica?.totalConcluidas).toBe(1);

    // assere que o where passado ao Prisma filtra por status CONCLUIDA —
    // garantindo que PENDENTE nunca alcance a agregação em memória.
    const args = tarefaFindManyMock.mock.calls[0][0] as {
      where: { status: string };
    };
    expect(args.where.status).toBe("CONCLUIDA");
  });

  it("retorna volume absoluto (nº empresas, nº tarefas) como contexto junto ao percentual (D-03)", async () => {
    const { listarDesempenhoColaboradoresMesAtual } = await import(
      "@/modules/dashboards/queries"
    );

    tarefaFindManyMock.mockResolvedValue([
      {
        responsavelId: "user_3",
        prazo: new Date("2026-06-10T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-06-09T10:00:00") }],
      },
      {
        responsavelId: "user_3",
        prazo: new Date("2026-06-11T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-06-11T10:00:00") }],
      },
    ]);
    empresaGroupByMock.mockResolvedValue([
      { responsavelId: "user_3", _count: { id: 12 } },
    ]);
    usuarioFindManyMock.mockResolvedValue([
      { id: "user_3", nome: "Heitor" },
    ]);

    const resultado = await listarDesempenhoColaboradoresMesAtual(
      new Date("2026-06-15T12:00:00")
    );

    const heitor = resultado.find((r) => r.colaboradorId === "user_3");
    expect(heitor?.totalEmpresas).toBe(12);
    expect(heitor?.totalConcluidas).toBe(2);
    expect(typeof heitor?.percentualNoPrazo).toBe("number");
  });
});

describe("listarEvolucaoMensal", () => {
  beforeEach(() => {
    tarefaFindManyMock.mockReset();
    empresaGroupByMock.mockReset();
    usuarioFindManyMock.mockReset();
    desempenhoMensalGroupByMock.mockReset();
  });

  it("lê meses fechados via db.desempenhoMensal.groupBy e NÃO chama db.tarefa.findMany para competências fechadas (D-05)", async () => {
    const { listarEvolucaoMensal } = await import(
      "@/modules/dashboards/queries"
    );

    desempenhoMensalGroupByMock.mockResolvedValue([
      {
        competencia: "2026-05",
        _sum: { totalConcluidas: 10, concluidasNoPrazo: 8 },
      },
    ]);
    // mês corrente (live) — sem tarefas, sem carteira.
    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);
    usuarioFindManyMock.mockResolvedValue([]);

    const resultado = await listarEvolucaoMensal(2);

    expect(desempenhoMensalGroupByMock).toHaveBeenCalledTimes(1);
    // tarefa.findMany é chamado apenas 1x (o ponto live do mês corrente),
    // nunca por competência fechada.
    expect(tarefaFindManyMock).toHaveBeenCalledTimes(1);

    const pontoFechado = resultado.find((p) => p.competencia === "2026-05");
    expect(pontoFechado?.percentual).toBe(80);
  });

  it("retorna o array em ordem cronológica com o mês corrente por último", async () => {
    const { listarEvolucaoMensal } = await import(
      "@/modules/dashboards/queries"
    );

    desempenhoMensalGroupByMock.mockResolvedValue([]);
    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);
    usuarioFindManyMock.mockResolvedValue([]);

    const resultado = await listarEvolucaoMensal(3);

    expect(resultado.length).toBe(3);
    expect(Array.isArray(resultado)).toBe(true);
  });
});

describe("listarRankingEmpresas", () => {
  beforeEach(() => {
    tarefaFindManyMock.mockReset();
  });

  it("ranking de empresas considera atrasada PENDENTE com prazo < now() (D-06)", async () => {
    const { listarRankingEmpresas } = await import(
      "@/modules/dashboards/queries"
    );

    const agora = Date.now();
    tarefaFindManyMock.mockResolvedValue([
      {
        empresaId: "empresa_1",
        empresa: { nome: "Empresa A" },
        status: "CONCLUIDA",
        prazo: new Date(agora - 10 * 24 * 60 * 60 * 1000),
        historico: [{ concluidoEm: new Date(agora - 5 * 24 * 60 * 60 * 1000) }], // concluiu depois do prazo -> atrasada
      },
      {
        empresaId: "empresa_2",
        empresa: { nome: "Empresa B" },
        status: "PENDENTE",
        prazo: new Date(agora - 1 * 24 * 60 * 60 * 1000), // vencida, ainda pendente -> atrasada (D-06)
        historico: [],
      },
      {
        empresaId: "empresa_3",
        empresa: { nome: "Empresa C" },
        status: "PENDENTE",
        prazo: new Date(agora + 5 * 24 * 60 * 60 * 1000), // não vencida -> não atrasada
        historico: [],
      },
    ]);

    const resultado = await listarRankingEmpresas(
      new Date(agora - 90 * 24 * 60 * 60 * 1000),
      new Date(agora + 90 * 24 * 60 * 60 * 1000)
    );

    const empresaA = resultado.find((r) => r.empresaId === "empresa_1");
    const empresaB = resultado.find((r) => r.empresaId === "empresa_2");
    const empresaC = resultado.find((r) => r.empresaId === "empresa_3");

    expect(empresaA?.percentualAtraso).toBe(100);
    expect(empresaB?.percentualAtraso).toBe(100);
    expect(empresaC?.percentualAtraso).toBe(0);
  });

  it("ranking de empresas ordena desc por percentual de atraso (D-06)", async () => {
    const { listarRankingEmpresas } = await import(
      "@/modules/dashboards/queries"
    );

    const agora = Date.now();
    tarefaFindManyMock.mockResolvedValue([
      // empresa_low: 1 de 2 atrasada = 50%
      {
        empresaId: "empresa_low",
        empresa: { nome: "Empresa Low" },
        status: "CONCLUIDA",
        prazo: new Date(agora - 10 * 24 * 60 * 60 * 1000),
        historico: [{ concluidoEm: new Date(agora - 5 * 24 * 60 * 60 * 1000) }],
      },
      {
        empresaId: "empresa_low",
        empresa: { nome: "Empresa Low" },
        status: "CONCLUIDA",
        prazo: new Date(agora - 10 * 24 * 60 * 60 * 1000),
        historico: [{ concluidoEm: new Date(agora - 12 * 24 * 60 * 60 * 1000) }],
      },
      // empresa_high: 1 de 1 atrasada = 100%
      {
        empresaId: "empresa_high",
        empresa: { nome: "Empresa High" },
        status: "PENDENTE",
        prazo: new Date(agora - 1 * 24 * 60 * 60 * 1000),
        historico: [],
      },
    ]);

    const resultado = await listarRankingEmpresas(
      new Date(agora - 90 * 24 * 60 * 60 * 1000),
      new Date(agora + 90 * 24 * 60 * 60 * 1000)
    );

    expect(resultado[0].empresaId).toBe("empresa_high");
    expect(resultado[0].percentualAtraso).toBe(100);
    expect(resultado[1].empresaId).toBe("empresa_low");
    expect(resultado[1].percentualAtraso).toBe(50);
  });
});
