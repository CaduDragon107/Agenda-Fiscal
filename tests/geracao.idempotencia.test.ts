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
// NOVO (Plan 08-02): calcularSnapshotMensal agora tambem faz um lookup de
// Usuario.setor (enriquecimento pos-agregacao) — sem esse mock, o `tx` desta
// suite (que nao testa setor) quebraria com "Cannot read properties of
// undefined (reading 'findMany')".
const usuarioFindManyMock = vi.fn();
// NOVO (quick-260626): geracao.ts agora tambem busca, via findFirst, o
// usuario marcado com responsavelExtratoBancario=true (excecao fixa de
// Lancamentos) — sem esse mock, o `tx` desta suite quebraria com
// "tx.usuario.findFirst is not a function".
const usuarioFindFirstMock = vi.fn();
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
    usuario: {
      findMany: (...args: unknown[]) => usuarioFindManyMock(...args),
      findFirst: (...args: unknown[]) => usuarioFindFirstMock(...args),
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
    usuarioFindManyMock.mockReset();
    usuarioFindFirstMock.mockReset();
    desempenhoMensalCreateManyMock.mockReset();

    // Snapshot do mes anterior: por padrao, sem tarefas concluidas no range
    // (mantem os testes de geracao de tarefas focados em D-10/D-11/D-12,
    // sem produzir linhas de snapshot incidentais).
    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);
    usuarioFindManyMock.mockResolvedValue([]);
    usuarioFindFirstMock.mockResolvedValue(null);
    desempenhoMensalCreateManyMock.mockResolvedValue({ count: 0 });
  });

  // NOTA (Plan 07-02): executarGeracaoMensal agora chama empresa.findMany uma
  // 3a vez (bloco Contabil mensal) e, em meses de virada anual (fev/abr/jun),
  // 1+ vezes adicionais (bloco Contabil anual, uma chamada por obrigacao
  // disparada). Os testes legados abaixo (D-10/D-11/D-12, DP) usam
  // competências em meses SEM disparo anual (jul/ago/set) e encadeiam um
  // 3o `mockResolvedValueOnce([])` para o bloco Contabil mensal, mantendo o
  // comportamento Fiscal/DP 100% inalterado.

  it("primeira execução cria tarefas e a segunda execução (mesma competência) não cria nenhuma nova — idempotencia D-10", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    const empresas = [
      { id: "empresa_1", regimeTributario: "LUCRO_REAL", responsavelId: "user_1" }, // 4 obrigações
      { id: "empresa_2", regimeTributario: "SIMPLES_NACIONAL", responsavelId: "user_2" }, // 1 obrigação
    ];
    empresaFindManyMock
      .mockResolvedValueOnce(empresas)
      .mockResolvedValueOnce([]) // loop DP: nenhuma empresa CLT
      .mockResolvedValueOnce([]); // bloco Contabil mensal: nenhuma empresa LUCRO_REAL/PRESUMIDO
    createManyMock.mockResolvedValueOnce({ count: 5 });
    const primeira = await executarGeracaoMensal("2026-07");

    expect(primeira.criadas).toBe(5);
    expect(primeira.puladas).toBe(0);

    // 2ª execução: mesma competência, tudo já existe -> skipDuplicates pula tudo
    empresaFindManyMock
      .mockResolvedValueOnce(empresas)
      .mockResolvedValueOnce([])
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    createManyMock.mockResolvedValue({ count: 3 });

    const resultado = await executarGeracaoMensal("2026-08");

    expect(resultado).toEqual({
      criadas: 3,
      puladas: 2,
      semResponsavelDp: [],
      semResponsavelContabil: [],
    });
  });

  it("lê empresas ativas com select mínimo, chama createMany com skipDuplicates e status PENDENTE, e nunca referencia empresaRegimeHistorico", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    const empresas = [
      { id: "empresa_1", regimeTributario: "SIMPLES_NACIONAL", responsavelId: "user_1" },
    ];
    empresaFindManyMock
      .mockResolvedValueOnce(empresas)
      .mockResolvedValueOnce([])
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
      .mockResolvedValueOnce(empresasClt) // 2a chamada: loop DP
      .mockResolvedValueOnce([]); // 3a chamada: bloco Contabil mensal

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
      ])
      .mockResolvedValueOnce([]); // bloco Contabil mensal vazio

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
      ])
      .mockResolvedValueOnce([]); // bloco Contabil mensal vazio

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

  it("CRÍTICO: a 2ª chamada de empresa.findMany filtra responsaveisPorSetor por setor:'DP' — regressão deste filtro reintroduziria o Pitfall 2 (pegar responsável FISCAL por engano)", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    empresaFindManyMock
      .mockResolvedValueOnce([]) // loop Fiscal vazio
      .mockResolvedValueOnce([]) // loop DP vazio
      .mockResolvedValueOnce([]); // bloco Contabil mensal vazio

    createManyMock.mockResolvedValue({ count: 0 });

    await executarGeracaoMensal("2026-07");

    expect(empresaFindManyMock).toHaveBeenNthCalledWith(2, {
      where: { ativo: true, temFuncionariosClt: true },
      select: {
        id: true,
        nome: true,
        responsaveisPorSetor: {
          where: { setor: "DP" },
          select: { usuarioId: true },
        },
      },
    });
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
      .mockResolvedValueOnce(empresasClt)
      .mockResolvedValueOnce([]);
    createManyMock.mockResolvedValueOnce({ count: 4 });
    const primeira = await executarGeracaoMensal("2026-07");
    expect(primeira.criadas).toBe(4);
    expect(primeira.puladas).toBe(0);

    empresaFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(empresasClt)
      .mockResolvedValueOnce([]);
    createManyMock.mockResolvedValueOnce({ count: 0 });
    const segunda = await executarGeracaoMensal("2026-07");
    expect(segunda.criadas).toBe(0);
    expect(segunda.puladas).toBe(4);
  });

  // ---------------------------------------------------------------------
  // Plan 07-02: bloco Contábil mensal + anual
  // ---------------------------------------------------------------------

  it("Contábil mensal: empresa LUCRO_REAL com responsável CONTABIL gera as 7 rotinas mensais (competência sem disparo anual)", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    empresaFindManyMock
      .mockResolvedValueOnce([]) // loop Fiscal vazio
      .mockResolvedValueOnce([]) // loop DP vazio
      .mockResolvedValueOnce([
        {
          id: "ec1",
          nome: "Empresa Contabil",
          regimeTributario: "LUCRO_REAL",
          responsaveisPorSetor: [{ usuarioId: "contabil_user" }],
        },
      ]); // bloco Contabil mensal — 1 empresa, 7 rotinas (quick-260626: EXTRATO_BANCARIO consolidado em LANCAMENTO_EXTRATOS)

    createManyMock.mockResolvedValue({ count: 7 });

    // "2026-03" — março não dispara nenhuma obrigação anual (DEFIS=fev,
    // ECD=abr, ECF=jun), garantindo que apenas o bloco mensal entra em jogo.
    const resultado = await executarGeracaoMensal("2026-03");

    expect(resultado.criadas).toBe(7);
    expect(resultado.semResponsavelContabil).toEqual([]);

    expect(empresaFindManyMock).toHaveBeenNthCalledWith(3, {
      where: {
        ativo: true,
        regimeTributario: { in: ["LUCRO_REAL", "LUCRO_PRESUMIDO"] },
      },
      select: {
        id: true,
        nome: true,
        regimeTributario: true,
        responsaveisPorSetor: {
          where: { setor: "CONTABIL" },
          select: { usuarioId: true },
        },
      },
    });

    const arg = createManyMock.mock.calls[0][0] as {
      data: { responsavelId: string; tipoObrigacao: string }[];
    };
    expect(arg.data).toHaveLength(7);
    expect(arg.data.every((t) => t.responsavelId === "contabil_user")).toBe(
      true
    );
  });

  it("Contábil mensal: empresa LUCRO_PRESUMIDO sem responsável CONTABIL é pulada e listada uma única vez, sem bloquear Fiscal/DP", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    const empresasFiscal = [
      { id: "ef1", regimeTributario: "SIMPLES_NACIONAL", responsavelId: "u1" },
    ];

    empresaFindManyMock
      .mockResolvedValueOnce(empresasFiscal) // loop Fiscal
      .mockResolvedValueOnce([]) // loop DP vazio
      .mockResolvedValueOnce([
        {
          id: "ec2",
          nome: "Empresa Presumido sem Contabil",
          regimeTributario: "LUCRO_PRESUMIDO",
          responsaveisPorSetor: [],
        },
      ]); // bloco Contabil mensal — 1 empresa sem responsável

    createManyMock.mockResolvedValue({ count: 1 }); // só a tarefa Fiscal

    const resultado = await executarGeracaoMensal("2026-03");

    expect(resultado.criadas).toBe(1);
    expect(resultado.semResponsavelContabil).toEqual([
      { empresaId: "ec2", nome: "Empresa Presumido sem Contabil" },
    ]);
  });

  it("Contábil anual: competência '2026-04' (mês de criação ECD) cria a tarefa anual para empresas elegíveis e exclui SIMPLES_NACIONAL", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    empresaFindManyMock
      .mockResolvedValueOnce([]) // loop Fiscal vazio
      .mockResolvedValueOnce([]) // loop DP vazio
      .mockResolvedValueOnce([]) // bloco Contabil mensal vazio
      .mockResolvedValueOnce([
        // bloco Contabil anual — ECD, regimesElegiveis: LUCRO_REAL/PRESUMIDO
        {
          id: "ec3",
          nome: "Empresa ECD",
          responsaveisPorSetor: [{ usuarioId: "contabil_user" }],
        },
      ]);

    createManyMock.mockResolvedValue({ count: 1 });

    const resultado = await executarGeracaoMensal("2026-04");

    expect(resultado.criadas).toBe(1);

    // 4a chamada (1-indexed) é o bloco anual ECD, filtrando dinamicamente por
    // regra.regimesElegiveis (Pitfall 3) — nunca o filtro hardcoded do mensal.
    expect(empresaFindManyMock).toHaveBeenNthCalledWith(4, {
      where: {
        ativo: true,
        regimeTributario: { in: ["LUCRO_REAL", "LUCRO_PRESUMIDO"] },
      },
      select: {
        id: true,
        nome: true,
        responsaveisPorSetor: {
          where: { setor: "CONTABIL" },
          select: { usuarioId: true },
        },
      },
    });

    const arg = createManyMock.mock.calls[0][0] as {
      data: {
        empresaId: string;
        responsavelId: string;
        tipoObrigacao: string;
        competencia: string;
      }[];
    };
    expect(arg.data).toHaveLength(1);
    expect(arg.data[0]).toMatchObject({
      empresaId: "ec3",
      responsavelId: "contabil_user",
      tipoObrigacao: "ECD",
      competencia: "2026", // formato "YYYY" — D-09
    });

    // SIMPLES_NACIONAL nunca é consultado pelo filtro regimesElegiveis do ECD
    // (Pitfall 3) — o mock acima só retorna a empresa elegível por regime,
    // simulando o filtro já aplicado pelo Prisma no `where`.
  });

  it("Contábil anual: segunda execução da mesma competência anual ('2026-04') não cria nenhuma tarefa nova — idempotência", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    const empresaEcd = [
      {
        id: "ec4",
        nome: "Empresa ECD idempotente",
        responsaveisPorSetor: [{ usuarioId: "contabil_user" }],
      },
    ];

    empresaFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(empresaEcd);
    createManyMock.mockResolvedValueOnce({ count: 1 });
    const primeira = await executarGeracaoMensal("2026-04");
    expect(primeira.criadas).toBe(1);
    expect(primeira.puladas).toBe(0);

    empresaFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(empresaEcd);
    createManyMock.mockResolvedValueOnce({ count: 0 }); // skipDuplicates pula tudo
    const segunda = await executarGeracaoMensal("2026-04");
    expect(segunda.criadas).toBe(0);
    expect(segunda.puladas).toBe(1);
  });

  it("Pitfall 4: empresa sem responsável CONTABIL pulada tanto no bloco mensal quanto no bloco anual (mesmo mês) aparece UMA única vez em semResponsavelContabil (deduplicado)", async () => {
    const { executarGeracaoMensal } = await import("@/modules/tarefas/geracao");

    // mesma empresa retornada pela query mensal (LUCRO_REAL) e pela query
    // anual do ECD (regimesElegiveis inclui LUCRO_REAL) — ambas sem
    // responsavel CONTABIL.
    const empresaSemResponsavel = {
      id: "ec5",
      nome: "Empresa Duplicada sem Contabil",
      regimeTributario: "LUCRO_REAL",
      responsaveisPorSetor: [],
    };

    empresaFindManyMock
      .mockResolvedValueOnce([]) // loop Fiscal vazio
      .mockResolvedValueOnce([]) // loop DP vazio
      .mockResolvedValueOnce([empresaSemResponsavel]) // bloco Contabil mensal
      .mockResolvedValueOnce([
        { ...empresaSemResponsavel, regimeTributario: undefined },
      ]); // bloco Contabil anual (ECD) — mesma empresa, select sem regimeTributario

    createManyMock.mockResolvedValue({ count: 0 });

    const resultado = await executarGeracaoMensal("2026-04");

    expect(resultado.semResponsavelContabil).toEqual([
      { empresaId: "ec5", nome: "Empresa Duplicada sem Contabil" },
    ]);
  });
});
