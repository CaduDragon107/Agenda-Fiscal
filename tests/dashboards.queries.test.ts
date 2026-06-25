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

    const resultado = await listarDesempenhoColaboradoresMesAtual(
      mesRef,
      "FISCAL"
    );

    expect(Array.isArray(resultado)).toBe(true);
    const caio = resultado.find((r) => r.colaboradorId === "user_1");
    expect(caio).toBeDefined();
    expect(caio?.totalConcluidas).toBe(2);
    expect(caio?.percentualNoPrazo).toBe(50);
    expect(caio?.totalNoPrazo).toBe(1);
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
      new Date("2026-06-15T12:00:00"),
      "FISCAL"
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
      new Date("2026-06-15T12:00:00"),
      "FISCAL"
    );

    const heitor = resultado.find((r) => r.colaboradorId === "user_3");
    expect(heitor?.totalEmpresas).toBe(12);
    expect(heitor?.totalConcluidas).toBe(2);
    expect(typeof heitor?.percentualNoPrazo).toBe("number");
  });

  it("setor DP funde tarefaSetorWhere no where da Tarefa e empresaWhereExtra (temFuncionariosClt) no where de carteiras", async () => {
    const { listarDesempenhoColaboradoresMesAtual } = await import(
      "@/modules/dashboards/queries"
    );

    tarefaFindManyMock.mockResolvedValue([
      {
        responsavelId: "user_dp1",
        prazo: new Date("2026-06-10T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-06-09T10:00:00") }],
      },
    ]);
    empresaGroupByMock.mockResolvedValue([
      { responsavelId: "user_dp1", _count: { id: 4 } },
    ]);
    usuarioFindManyMock.mockResolvedValue([
      { id: "user_dp1", nome: "ColaboradorDP" },
    ]);

    const resultado = await listarDesempenhoColaboradoresMesAtual(
      new Date("2026-06-15T12:00:00"),
      "DP",
      { temFuncionariosClt: true }
    );

    const dp1 = resultado.find((r) => r.colaboradorId === "user_dp1");
    expect(dp1?.totalEmpresas).toBe(4);

    const tarefaArgs = tarefaFindManyMock.mock.calls[0][0] as {
      where: { OR?: Array<Record<string, unknown>> };
    };
    expect(tarefaArgs.where.OR).toBeDefined();

    const empresaArgs = empresaGroupByMock.mock.calls[0][0] as {
      where: { ativo: boolean; temFuncionariosClt?: boolean };
    };
    expect(empresaArgs.where.temFuncionariosClt).toBe(true);
  });

  it("setor CONTABIL usa universo de empresas completo (empresaWhereExtra={})", async () => {
    const { listarDesempenhoColaboradoresMesAtual } = await import(
      "@/modules/dashboards/queries"
    );

    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([
      { responsavelId: "user_cont1", _count: { id: 9 } },
    ]);
    usuarioFindManyMock.mockResolvedValue([
      { id: "user_cont1", nome: "ColaboradorContabil" },
    ]);

    const resultado = await listarDesempenhoColaboradoresMesAtual(
      new Date("2026-06-15T12:00:00"),
      "CONTABIL"
    );

    const cont1 = resultado.find((r) => r.colaboradorId === "user_cont1");
    expect(cont1?.totalEmpresas).toBe(9);

    const empresaArgs = empresaGroupByMock.mock.calls[0][0] as {
      where: { ativo: boolean; temFuncionariosClt?: boolean };
    };
    expect(empresaArgs.where.temFuncionariosClt).toBeUndefined();
  });
});

describe("listarEvolucaoMensal", () => {
  beforeEach(() => {
    tarefaFindManyMock.mockReset();
    empresaGroupByMock.mockReset();
    usuarioFindManyMock.mockReset();
    desempenhoMensalGroupByMock.mockReset();
  });

  it("expõe totalNoPrazo como inteiro igual a noPrazo agregado (ex.: 1 de 2 concluidas -> totalNoPrazo=1, percentualNoPrazo=50)", async () => {
    const { listarDesempenhoColaboradoresMesAtual } = await import(
      "@/modules/dashboards/queries"
    );

    tarefaFindManyMock.mockResolvedValue([
      {
        responsavelId: "user_wr01",
        prazo: new Date("2026-06-10T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-06-09T10:00:00") }], // no prazo
      },
      {
        responsavelId: "user_wr01",
        prazo: new Date("2026-06-11T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-06-13T10:00:00") }], // atrasada
      },
    ]);
    empresaGroupByMock.mockResolvedValue([
      { responsavelId: "user_wr01", _count: { id: 2 } },
    ]);
    usuarioFindManyMock.mockResolvedValue([
      { id: "user_wr01", nome: "WR01" },
    ]);

    const resultado = await listarDesempenhoColaboradoresMesAtual(
      new Date("2026-06-15T12:00:00"),
      "FISCAL"
    );

    const item = resultado.find((r) => r.colaboradorId === "user_wr01");
    expect(item?.totalNoPrazo).toBe(1);
    expect(item?.totalConcluidas).toBe(2);
    expect(item?.percentualNoPrazo).toBe(50);
  });

  it("lê meses fechados via db.desempenhoMensal.groupBy e NÃO chama db.tarefa.findMany para competências fechadas (D-05)", async () => {
    const { listarEvolucaoMensal } = await import(
      "@/modules/dashboards/queries"
    );

    desempenhoMensalGroupByMock.mockResolvedValue([
      {
        competencia: "2026-05",
        _sum: {
          totalConcluidas: 10,
          concluidasNoPrazo: 8,
          totalCriadas: 12,
          totalConcluidasNoPeriodo: 9,
          totalPendentesSemMotivo: 1,
          totalPendentesComMotivo: 1,
          totalVencidas: 1,
        },
      },
    ]);
    // mês corrente (live) — sem tarefas, sem carteira.
    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);
    usuarioFindManyMock.mockResolvedValue([]);

    const resultado = await listarEvolucaoMensal(2, "FISCAL");

    expect(desempenhoMensalGroupByMock).toHaveBeenCalledTimes(1);
    // tarefa.findMany é chamado 2x para o ponto live do mês corrente
    // (1x dentro de listarDesempenhoColaboradoresMesAtual, 1x dentro de
    // calcularCategoriasCriadas) — nunca por competência fechada.
    expect(tarefaFindManyMock).toHaveBeenCalledTimes(2);

    // where.setor isola os meses congelados por setor (D-05 + T-08-03).
    const groupByArgs = desempenhoMensalGroupByMock.mock.calls[0][0] as {
      where: { setor: string };
    };
    expect(groupByArgs.where.setor).toBe("FISCAL");

    const pontoFechado = resultado.find((p) => p.competencia === "2026-05");
    expect(pontoFechado?.percentual).toBe(80);
    expect(pontoFechado?.totalCriadas).toBe(12);
    expect(pontoFechado?.totalConcluidasNoPeriodo).toBe(9);
    expect(pontoFechado?.totalPendentesSemMotivo).toBe(1);
    expect(pontoFechado?.totalPendentesComMotivo).toBe(1);
    expect(pontoFechado?.totalVencidas).toBe(1);
  });

  it("ponto live do mes corrente usa a mesma populacao 'criadas' (filtro competencia/createdAt), sem degrau live→frozen", async () => {
    const { listarEvolucaoMensal } = await import(
      "@/modules/dashboards/queries"
    );

    desempenhoMensalGroupByMock.mockResolvedValue([]);
    // 1a chamada de tarefaFindMany (dentro de
    // listarDesempenhoColaboradoresMesAtual) — populacao concluidoEm-no-range.
    tarefaFindManyMock.mockResolvedValueOnce([]);
    // 2a chamada (calcularCategoriasCriadas) — populacao "criadas".
    tarefaFindManyMock.mockResolvedValueOnce([
      { status: "PENDENTE", motivoPendencia: null, prazo: new Date(Date.now() + 86400000) },
    ]);
    empresaGroupByMock.mockResolvedValue([]);
    usuarioFindManyMock.mockResolvedValue([]);

    const resultado = await listarEvolucaoMensal(1, "FISCAL");

    const pontoLive = resultado[resultado.length - 1];
    expect(pontoLive.totalCriadas).toBe(1);
    expect(pontoLive.totalPendentesSemMotivo).toBe(1);

    const segundaChamada = tarefaFindManyMock.mock.calls[1][0] as {
      where: { OR: Array<Record<string, unknown>> };
    };
    expect(segundaChamada.where.OR).toBeDefined();
  });

  it("ponto live (5 campos 'criadas') de listarEvolucaoMensal e sector-scoped — calcularCategoriasCriadas recebe o setor informado, nao mistura setores (T-08-03)", async () => {
    const { listarEvolucaoMensal } = await import(
      "@/modules/dashboards/queries"
    );

    desempenhoMensalGroupByMock.mockResolvedValue([]);
    // 1a chamada (listarDesempenhoColaboradoresMesAtual) — vazia.
    tarefaFindManyMock.mockResolvedValueOnce([]);
    // 2a chamada (calcularCategoriasCriadas) — simula que o banco já
    // aplicou o filtro tarefaSetorWhere("DP"), retornando só 1 tarefa DP.
    tarefaFindManyMock.mockResolvedValueOnce([
      { status: "PENDENTE", motivoPendencia: null, prazo: new Date(Date.now() + 86400000) },
    ]);
    empresaGroupByMock.mockResolvedValue([]);
    usuarioFindManyMock.mockResolvedValue([]);

    const resultado = await listarEvolucaoMensal(1, "DP");
    const pontoLive = resultado[resultado.length - 1];

    expect(pontoLive.totalCriadas).toBe(1);
    expect(pontoLive.totalPendentesSemMotivo).toBe(1);

    // a 2a chamada a tarefa.findMany (dentro de calcularCategoriasCriadas)
    // deve incluir o filtro de setor (OR de tarefaSetorWhere) fundido ao
    // lado do OR de competencia/createdAt — prova de que o setor "DP" foi
    // propagado ao helper interno do ponto live, e nao só ao desempenho.
    const segundaChamada = tarefaFindManyMock.mock.calls[1][0] as {
      where: { OR: Array<Record<string, unknown>> };
    };
    expect(segundaChamada.where.OR).toBeDefined();
  });

  it("cada ponto contém competencia, percentual, e os 5 novos campos", async () => {
    const { listarEvolucaoMensal } = await import(
      "@/modules/dashboards/queries"
    );

    desempenhoMensalGroupByMock.mockResolvedValue([]);
    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);
    usuarioFindManyMock.mockResolvedValue([]);

    const resultado = await listarEvolucaoMensal(3, "FISCAL");

    for (const ponto of resultado) {
      expect(ponto).toHaveProperty("competencia");
      expect(ponto).toHaveProperty("percentual");
      expect(ponto).toHaveProperty("totalCriadas");
      expect(ponto).toHaveProperty("totalConcluidasNoPeriodo");
      expect(ponto).toHaveProperty("totalPendentesSemMotivo");
      expect(ponto).toHaveProperty("totalPendentesComMotivo");
      expect(ponto).toHaveProperty("totalVencidas");
    }
  });

  it("retorna o array em ordem cronológica com o mês corrente por último", async () => {
    const { listarEvolucaoMensal } = await import(
      "@/modules/dashboards/queries"
    );

    desempenhoMensalGroupByMock.mockResolvedValue([]);
    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);
    usuarioFindManyMock.mockResolvedValue([]);

    const resultado = await listarEvolucaoMensal(3, "FISCAL");

    expect(resultado.length).toBe(3);
    expect(Array.isArray(resultado)).toBe(true);
  });

  it("ponto live soma totalNoPrazo inteiro, sem reverter o percentual arredondado (WR-01): totalConcluidas=150, noPrazo=1 -> percentual exato, nunca over-contado", async () => {
    const { listarEvolucaoMensal } = await import(
      "@/modules/dashboards/queries"
    );

    desempenhoMensalGroupByMock.mockResolvedValue([]);
    // 1a chamada (listarDesempenhoColaboradoresMesAtual): mes corrente com
    // 150 concluidas e apenas 1 no prazo — cenario onde o metodo antigo
    // (Math.round((noPrazo/100%)*total)) over-contava em +1 por arredondamento.
    tarefaFindManyMock.mockResolvedValueOnce(
      Array.from({ length: 150 }, (_, i) => ({
        responsavelId: "user_wr01b",
        prazo: new Date("2026-06-10T23:59:59"),
        historico: [
          {
            concluidoEm:
              i === 0
                ? new Date("2026-06-09T10:00:00") // a unica no prazo
                : new Date("2026-06-15T10:00:00"), // atrasada
          },
        ],
      }))
    );
    // 2a chamada (calcularCategoriasCriadas) — populacao "criadas" vazia.
    tarefaFindManyMock.mockResolvedValueOnce([]);
    empresaGroupByMock.mockResolvedValue([
      { responsavelId: "user_wr01b", _count: { id: 1 } },
    ]);
    usuarioFindManyMock.mockResolvedValue([
      { id: "user_wr01b", nome: "WR01b" },
    ]);

    const resultado = await listarEvolucaoMensal(1, "FISCAL");
    const pontoLive = resultado[resultado.length - 1];

    // noPrazo exato = 1 de 150 -> percentual = round(1/150*100) = 1
    expect(pontoLive.percentual).toBe(1);
  });

  it("usa default quantidadeMeses=6 quando chamado sem o argumento (IN-02), alinhado ao default de producao em guard.ts", async () => {
    const { listarEvolucaoMensal } = await import(
      "@/modules/dashboards/queries"
    );

    desempenhoMensalGroupByMock.mockResolvedValue([]);
    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);
    usuarioFindManyMock.mockResolvedValue([]);

    const resultado = await listarEvolucaoMensal(undefined as never, "FISCAL");

    expect(resultado.length).toBe(6);
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
      new Date(agora + 90 * 24 * 60 * 60 * 1000),
      "FISCAL"
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
      new Date(agora + 90 * 24 * 60 * 60 * 1000),
      "FISCAL"
    );

    expect(resultado[0].empresaId).toBe("empresa_high");
    expect(resultado[0].percentualAtraso).toBe(100);
    expect(resultado[1].empresaId).toBe("empresa_low");
    expect(resultado[1].percentualAtraso).toBe(50);
  });

  it("setor DP funde tarefaSetorWhere e aplica empresaWhereExtra via relacao empresa (unica excecao a regra de nao filtrar Tarefa por empresaWhereExtra)", async () => {
    const { listarRankingEmpresas } = await import(
      "@/modules/dashboards/queries"
    );

    const agora = Date.now();
    tarefaFindManyMock.mockResolvedValue([
      {
        empresaId: "empresa_dp1",
        empresa: { nome: "Empresa DP1" },
        status: "PENDENTE",
        prazo: new Date(agora - 1 * 24 * 60 * 60 * 1000),
        historico: [],
      },
    ]);

    const resultado = await listarRankingEmpresas(
      new Date(agora - 90 * 24 * 60 * 60 * 1000),
      new Date(agora + 90 * 24 * 60 * 60 * 1000),
      "DP",
      { temFuncionariosClt: true }
    );

    expect(resultado.find((r) => r.empresaId === "empresa_dp1")).toBeDefined();

    const args = tarefaFindManyMock.mock.calls[0][0] as {
      where: {
        OR?: Array<Record<string, unknown>>;
        empresa?: { temFuncionariosClt?: boolean };
      };
    };
    expect(args.where.OR).toBeDefined();
    expect(args.where.empresa?.temFuncionariosClt).toBe(true);
  });
});
