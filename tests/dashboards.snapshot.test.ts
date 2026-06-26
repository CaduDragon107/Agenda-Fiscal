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
  empresaResponsavelSetorGroupByMock: vi.fn(),
  usuarioFindManyMock: vi.fn(),
  usuarioFindFirstMock: vi.fn(),
  desempenhoMensalCreateManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    empresa: {
      findMany: (...args: unknown[]) => dbMocks.empresaFindManyMock(...args),
      groupBy: (...args: unknown[]) => dbMocks.empresaGroupByMock(...args),
    },
    empresaResponsavelSetor: {
      groupBy: (...args: unknown[]) => dbMocks.empresaResponsavelSetorGroupByMock(...args),
    },
    tarefa: {
      createMany: (...args: unknown[]) => dbMocks.tarefaCreateManyMock(...args),
      findMany: (...args: unknown[]) => dbMocks.tarefaFindManyMock(...args),
    },
    usuario: {
      findMany: (...args: unknown[]) => dbMocks.usuarioFindManyMock(...args),
      findFirst: (...args: unknown[]) => dbMocks.usuarioFindFirstMock(...args),
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
  const empresaResponsavelSetorGroupByMock = vi.fn();
  const usuarioFindManyMock = vi.fn();
  const desempenhoMensalCreateManyMock = vi.fn();

  // default: todo colaborador mencionado nos testes existentes pertence ao
  // setor FISCAL, a menos que um teste sobrescreva explicitamente — evita
  // quebrar os testes pre-existentes (regressao) que nao mockam usuario.
  usuarioFindManyMock.mockResolvedValue([
    { id: "user_1", setor: "FISCAL" },
    { id: "user_2", setor: "FISCAL" },
    { id: "user_3", setor: "FISCAL" },
  ]);
  // default: sem carteira via junction table — testes que nao exercitam
  // DP/CONTABIL nao precisam mockar isso explicitamente.
  empresaResponsavelSetorGroupByMock.mockResolvedValue([]);

  const tx = {
    tarefa: { findMany: (...args: unknown[]) => tarefaFindManyMock(...args) },
    empresa: { groupBy: (...args: unknown[]) => empresaGroupByMock(...args) },
    empresaResponsavelSetor: {
      groupBy: (...args: unknown[]) => empresaResponsavelSetorGroupByMock(...args),
    },
    usuario: { findMany: (...args: unknown[]) => usuarioFindManyMock(...args) },
    desempenhoMensal: {
      createMany: (...args: unknown[]) => desempenhoMensalCreateManyMock(...args),
    },
  };

  return {
    tx,
    tarefaFindManyMock,
    empresaGroupByMock,
    empresaResponsavelSetorGroupByMock,
    usuarioFindManyMock,
    desempenhoMensalCreateManyMock,
  };
}

describe("calcularSnapshotMensal — agregacao D-01/D-02/D-03", () => {
  it("conta totalConcluidas/concluidasNoPrazo/totalTarefasPeriodo por colaborador, respeitando o prazo (D-01/D-02)", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock } = criarTxMock();

    // 1a chamada (query concluidoEm-no-range), 2a chamada (query "criadas").
    tarefaFindManyMock.mockResolvedValueOnce([
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
    tarefaFindManyMock.mockResolvedValueOnce([]); // populacao "criadas" vazia neste teste
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
      setor: "FISCAL",
      totalConcluidas: 2,
      concluidasNoPrazo: 1,
      totalEmpresas: 30,
      totalTarefasPeriodo: 2,
      totalCriadas: 0,
      totalConcluidasNoPeriodo: 0,
      totalPendentesSemMotivo: 0,
      totalPendentesComMotivo: 0,
      totalVencidas: 0,
    });
    expect(linhaUser2).toEqual({
      competencia: "2026-02",
      colaboradorId: "user_2",
      setor: "FISCAL",
      totalConcluidas: 1,
      concluidasNoPrazo: 1,
      totalEmpresas: 20,
      totalTarefasPeriodo: 1,
      totalCriadas: 0,
      totalConcluidasNoPeriodo: 0,
      totalPendentesSemMotivo: 0,
      totalPendentesComMotivo: 0,
      totalVencidas: 0,
    });
  });

  it("filtra a populacao de Tarefa por status CONCLUIDA com historico no range — PENDENTE nunca aparece no resultado de tarefaFindMany simulado", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock } = criarTxMock();

    // Simula o filtro real do banco: where status=CONCLUIDA já exclui PENDENTE,
    // então o mock simplesmente não retorna nenhuma linha PENDENTE.
    tarefaFindManyMock.mockResolvedValueOnce([]);
    tarefaFindManyMock.mockResolvedValueOnce([]);
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

    tarefaFindManyMock.mockResolvedValueOnce([]);
    tarefaFindManyMock.mockResolvedValueOnce([]);
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

describe("calcularSnapshotMensal — carteira escopada por setor (IN-01)", () => {
  it("colaborador DP tem totalEmpresas derivado via empresaResponsavelSetor.groupBy filtrado por setor DP+temFuncionariosClt — nunca via empresa.groupBy por responsavelId legado", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const {
      tx,
      tarefaFindManyMock,
      empresaGroupByMock,
      empresaResponsavelSetorGroupByMock,
      usuarioFindManyMock,
    } = criarTxMock();

    tarefaFindManyMock.mockResolvedValueOnce([
      {
        responsavelId: "user_dp",
        tipoObrigacao: "FOLHA",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      },
    ]);
    tarefaFindManyMock.mockResolvedValueOnce([]);
    usuarioFindManyMock.mockResolvedValue([{ id: "user_dp", setor: "DP" }]);

    // carteira FISCAL legada (12 empresas) — NUNCA deve ser usada para DP.
    empresaGroupByMock.mockResolvedValue([
      { responsavelId: "user_dp", _count: { id: 12 } },
    ]);
    // carteira real DP (junction table, filtrada por temFuncionariosClt) — 4.
    empresaResponsavelSetorGroupByMock.mockResolvedValue([
      { usuarioId: "user_dp", _count: { id: 4 } },
    ]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");

    const linhaDp = resultado.find((r) => r.colaboradorId === "user_dp" && r.setor === "DP");
    expect(linhaDp?.totalEmpresas).toBe(4);
    expect(linhaDp?.totalEmpresas).not.toBe(12);

    expect(empresaGroupByMock).not.toHaveBeenCalled();
    expect(empresaResponsavelSetorGroupByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          setor: "DP",
          empresa: expect.objectContaining({ ativo: true, temFuncionariosClt: true }),
        }),
      })
    );
  });

  it("colaborador FISCAL continua usando empresa.groupBy por responsavelId (forma legada) e NUNCA chama empresaResponsavelSetor.groupBy", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const {
      tx,
      tarefaFindManyMock,
      empresaGroupByMock,
      empresaResponsavelSetorGroupByMock,
      usuarioFindManyMock,
    } = criarTxMock();

    tarefaFindManyMock.mockResolvedValueOnce([
      {
        responsavelId: "user_fiscal",
        tipoObrigacao: "ICMS",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-16T10:00:00") }],
      },
    ]);
    tarefaFindManyMock.mockResolvedValueOnce([]);
    usuarioFindManyMock.mockResolvedValue([{ id: "user_fiscal", setor: "FISCAL" }]);
    empresaGroupByMock.mockResolvedValue([
      { responsavelId: "user_fiscal", _count: { id: 30 } },
    ]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");

    const linhaFiscal = resultado.find(
      (r) => r.colaboradorId === "user_fiscal" && r.setor === "FISCAL"
    );
    expect(linhaFiscal?.totalEmpresas).toBe(30);

    expect(empresaResponsavelSetorGroupByMock).not.toHaveBeenCalled();
    expect(empresaGroupByMock).toHaveBeenCalledWith(
      expect.objectContaining({ by: ["responsavelId"] })
    );
  });

  it("colaboradores de setores distintos (DP e FISCAL) disparam no maximo 1 groupBy por setor distinto presente, nunca por colaborador", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const {
      tx,
      tarefaFindManyMock,
      empresaGroupByMock,
      empresaResponsavelSetorGroupByMock,
      usuarioFindManyMock,
    } = criarTxMock();

    tarefaFindManyMock.mockResolvedValueOnce([
      {
        responsavelId: "user_dp",
        tipoObrigacao: "FOLHA",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      },
      {
        responsavelId: "user_fiscal",
        tipoObrigacao: "ICMS",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-16T10:00:00") }],
      },
    ]);
    tarefaFindManyMock.mockResolvedValueOnce([]);
    usuarioFindManyMock.mockResolvedValue([
      { id: "user_dp", setor: "DP" },
      { id: "user_fiscal", setor: "FISCAL" },
    ]);
    empresaGroupByMock.mockResolvedValue([]);
    empresaResponsavelSetorGroupByMock.mockResolvedValue([]);

    await calcularSnapshotMensal(tx as never, "2026-02");

    // 2 setores distintos presentes (DP, FISCAL) -> no maximo 1 chamada de
    // groupBy POR FONTE por setor distinto (nunca 1 por colaborador, o que
    // seria N+1): FISCAL usa empresa.groupBy, DP usa
    // empresaResponsavelSetor.groupBy — 1 chamada cada.
    expect(empresaGroupByMock).toHaveBeenCalledTimes(1);
    expect(empresaResponsavelSetorGroupByMock).toHaveBeenCalledTimes(1);
  });
});

describe("calcularSnapshotMensal — setor derivado de Usuario.setor (T-08-03, Plan 08-02)", () => {
  it("cada LinhaSnapshotMensal carrega o setor correto do colaborador (DP/CONTABIL/FISCAL distintos)", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock, usuarioFindManyMock } = criarTxMock();

    tarefaFindManyMock.mockResolvedValueOnce([
      {
        responsavelId: "user_dp",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      },
      {
        responsavelId: "user_cont",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      },
      {
        responsavelId: "user_fiscal",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      },
    ]);
    tarefaFindManyMock.mockResolvedValueOnce([]);
    empresaGroupByMock.mockResolvedValue([]);
    usuarioFindManyMock.mockResolvedValue([
      { id: "user_dp", setor: "DP" },
      { id: "user_cont", setor: "CONTABIL" },
      { id: "user_fiscal", setor: "FISCAL" },
    ]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");

    expect(resultado.find((r) => r.colaboradorId === "user_dp")?.setor).toBe("DP");
    expect(resultado.find((r) => r.colaboradorId === "user_cont")?.setor).toBe("CONTABIL");
    expect(resultado.find((r) => r.colaboradorId === "user_fiscal")?.setor).toBe("FISCAL");
  });

  it("colaborador com Usuario.setor null nao quebra — linha e omitida do resultado (defensivo, nunca lanca)", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock, usuarioFindManyMock } = criarTxMock();

    tarefaFindManyMock.mockResolvedValueOnce([
      {
        responsavelId: "user_sem_setor",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      },
    ]);
    tarefaFindManyMock.mockResolvedValueOnce([]);
    empresaGroupByMock.mockResolvedValue([]);
    usuarioFindManyMock.mockResolvedValue([{ id: "user_sem_setor", setor: null }]);

    const linhas = await calcularSnapshotMensal(tx as never, "2026-02");
    expect(linhas.find((r) => r.colaboradorId === "user_sem_setor")).toBeUndefined();
  });

  it("colaborador com tarefas recorrentes de MAIS DE UM setor (via tipoObrigacao) produz 1 linha POR setor, sem contaminacao cross-setor (CR-01, code review Phase 08)", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock, usuarioFindManyMock } = criarTxMock();

    // user_dp tem Usuario.setor = "DP" mas concluiu 1 tarefa FOLHA (DP) e 1
    // tarefa ICMS (FISCAL) no mesmo periodo — cenario real: colaborador de
    // DP cobrindo uma tarefa Fiscal avulsa/recorrente atribuida a ele.
    tarefaFindManyMock.mockResolvedValueOnce([
      {
        responsavelId: "user_dp",
        tipoObrigacao: "FOLHA",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      },
      {
        responsavelId: "user_dp",
        tipoObrigacao: "ICMS",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-16T10:00:00") }],
      },
    ]);
    tarefaFindManyMock.mockResolvedValueOnce([]);
    empresaGroupByMock.mockResolvedValue([{ responsavelId: "user_dp", _count: { id: 12 } }]);
    usuarioFindManyMock.mockResolvedValue([{ id: "user_dp", setor: "DP" }]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");

    const linhaDp = resultado.find((r) => r.colaboradorId === "user_dp" && r.setor === "DP");
    const linhaFiscal = resultado.find(
      (r) => r.colaboradorId === "user_dp" && r.setor === "FISCAL"
    );

    expect(resultado).toHaveLength(2);
    expect(linhaDp).toBeDefined();
    expect(linhaDp?.totalConcluidas).toBe(1);
    expect(linhaFiscal).toBeDefined();
    expect(linhaFiscal?.totalConcluidas).toBe(1);
    // CRITICO: nenhuma linha deve somar as 2 tarefas — isso seria a
    // contaminacao cross-setor que o fix de CR-01 elimina.
    expect(linhaDp?.totalConcluidas).not.toBe(2);
  });

  it("tarefa avulsa (tipoObrigacao null) e classificada pelo Usuario.setor do colaborador, mesmo que difira de outra tarefa recorrente do mesmo colaborador classificada por tipoObrigacao", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock, usuarioFindManyMock } = criarTxMock();

    tarefaFindManyMock.mockResolvedValueOnce([
      {
        // avulsa: tipoObrigacao null -> classificada por Usuario.setor (CONTABIL)
        responsavelId: "user_cont",
        tipoObrigacao: null,
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      },
      {
        // recorrente ECD -> classificada por tipoObrigacao (CONTABIL tambem,
        // mesma linha esperada)
        responsavelId: "user_cont",
        tipoObrigacao: "ECD",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-18T10:00:00") }],
      },
    ]);
    tarefaFindManyMock.mockResolvedValueOnce([]);
    empresaGroupByMock.mockResolvedValue([{ responsavelId: "user_cont", _count: { id: 8 } }]);
    usuarioFindManyMock.mockResolvedValue([{ id: "user_cont", setor: "CONTABIL" }]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");

    expect(resultado).toHaveLength(1);
    expect(resultado[0].setor).toBe("CONTABIL");
    expect(resultado[0].totalConcluidas).toBe(2);
  });

  it("lookup de Usuario usa select explicito {id, setor} — nunca 'colaborador: true'/'responsavel: true' (T-08-04)", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock, usuarioFindManyMock } = criarTxMock();

    tarefaFindManyMock.mockResolvedValueOnce([]);
    tarefaFindManyMock.mockResolvedValueOnce([]);
    empresaGroupByMock.mockResolvedValue([]);
    usuarioFindManyMock.mockResolvedValue([]);

    await calcularSnapshotMensal(tx as never, "2026-02");

    const arg = usuarioFindManyMock.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect(arg.select).toEqual({ id: true, setor: true });
  });
});

describe("calcularSnapshotMensal — populacao 'criadas' (quick task 260622-lty, DASH-02)", () => {
  it("tarefa recorrente com competencia igual ao mes-alvo entra na populacao 'criadas', independente de createdAt", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock } = criarTxMock();

    tarefaFindManyMock.mockResolvedValueOnce([]); // concluidoEm-no-range vazia
    tarefaFindManyMock.mockResolvedValueOnce([
      {
        responsavelId: "user_1",
        status: "PENDENTE",
        motivoPendencia: null,
        prazo: new Date("2026-02-28T23:59:59"),
      },
    ]);
    empresaGroupByMock.mockResolvedValue([]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");

    const linhaUser1 = resultado.find((r) => r.colaboradorId === "user_1");
    expect(linhaUser1?.totalCriadas).toBe(1);

    const segundaChamada = tarefaFindManyMock.mock.calls[1][0] as {
      where: { OR: Array<Record<string, unknown>> };
    };
    expect(segundaChamada.where.OR).toEqual(
      expect.arrayContaining([{ competencia: "2026-02" }])
    );
  });

  it("tarefa avulsa (competencia=null) com createdAt no range do mes-alvo entra na populacao; fora do range nao entra", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock } = criarTxMock();

    tarefaFindManyMock.mockResolvedValueOnce([]);
    // O mock simula o filtro real do Prisma: apenas a avulsa DENTRO do range
    // e retornada (a logica de filtro por createdAt e responsabilidade do
    // banco real — aqui validamos que a funcao usa o resultado corretamente).
    tarefaFindManyMock.mockResolvedValueOnce([
      {
        responsavelId: "user_2",
        status: "PENDENTE",
        motivoPendencia: null,
        prazo: new Date("2026-02-20T23:59:59"),
      },
    ]);
    empresaGroupByMock.mockResolvedValue([]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");

    const linhaUser2 = resultado.find((r) => r.colaboradorId === "user_2");
    expect(linhaUser2?.totalCriadas).toBe(1);

    const segundaChamada = tarefaFindManyMock.mock.calls[1][0] as {
      where: { OR: Array<{ competencia?: null; createdAt?: { gte: Date; lte: Date } }> };
    };
    const clausulaAvulsa = segundaChamada.where.OR.find((c) => c.competencia === null);
    expect(clausulaAvulsa).toBeDefined();
    expect(clausulaAvulsa?.createdAt?.gte.getMonth()).toBe(1); // Fevereiro (0-indexed)
    expect(clausulaAvulsa?.createdAt?.lte.getMonth()).toBe(1);
  });

  it("totalCriadas = total da populacao; totalConcluidasNoPeriodo = subset status CONCLUIDA", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock } = criarTxMock();

    tarefaFindManyMock.mockResolvedValueOnce([]);
    tarefaFindManyMock.mockResolvedValueOnce([
      { responsavelId: "user_1", status: "CONCLUIDA", motivoPendencia: null, prazo: new Date("2026-02-10T23:59:59") },
      { responsavelId: "user_1", status: "CONCLUIDA", motivoPendencia: null, prazo: new Date("2026-02-15T23:59:59") },
      { responsavelId: "user_1", status: "PENDENTE", motivoPendencia: null, prazo: new Date("2026-02-25T23:59:59") },
    ]);
    empresaGroupByMock.mockResolvedValue([]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");
    const linha = resultado.find((r) => r.colaboradorId === "user_1");

    expect(linha?.totalCriadas).toBe(3);
    expect(linha?.totalConcluidasNoPeriodo).toBe(2);
  });

  it("totalPendentesSemMotivo / totalPendentesComMotivo particionam corretamente as PENDENTE", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock } = criarTxMock();

    tarefaFindManyMock.mockResolvedValueOnce([]);
    tarefaFindManyMock.mockResolvedValueOnce([
      { responsavelId: "user_1", status: "PENDENTE", motivoPendencia: null, prazo: new Date("2026-02-25T23:59:59") },
      { responsavelId: "user_1", status: "PENDENTE", motivoPendencia: "Cliente sem documentos", prazo: new Date("2026-02-25T23:59:59") },
    ]);
    empresaGroupByMock.mockResolvedValue([]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");
    const linha = resultado.find((r) => r.colaboradorId === "user_1");

    expect(linha?.totalPendentesSemMotivo).toBe(1);
    expect(linha?.totalPendentesComMotivo).toBe(1);
  });

  it("totalVencidas = PENDENTE com prazo < agora — pode sobrepor com pendentes sem/com motivo (lente de urgencia, nao particao exclusiva)", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock } = criarTxMock();

    const passado = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const futuro = new Date(Date.now() + 24 * 60 * 60 * 1000);

    tarefaFindManyMock.mockResolvedValueOnce([]);
    tarefaFindManyMock.mockResolvedValueOnce([
      { responsavelId: "user_1", status: "PENDENTE", motivoPendencia: null, prazo: passado }, // vencida + sem motivo
      { responsavelId: "user_1", status: "PENDENTE", motivoPendencia: "x", prazo: passado }, // vencida + com motivo
      { responsavelId: "user_1", status: "PENDENTE", motivoPendencia: null, prazo: futuro }, // nao vencida
    ]);
    empresaGroupByMock.mockResolvedValue([]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");
    const linha = resultado.find((r) => r.colaboradorId === "user_1");

    expect(linha?.totalVencidas).toBe(2);
    expect(linha?.totalPendentesSemMotivo).toBe(2);
    expect(linha?.totalPendentesComMotivo).toBe(1);
  });

  it("campos existentes (totalConcluidas, concluidasNoPrazo, totalEmpresas, totalTarefasPeriodo) permanecem com os mesmos valores de antes, mesmo com populacao 'criadas' presente", async () => {
    const { calcularSnapshotMensal } = await import("@/modules/dashboards/snapshot");
    const { tx, tarefaFindManyMock, empresaGroupByMock } = criarTxMock();

    tarefaFindManyMock.mockResolvedValueOnce([
      {
        responsavelId: "user_1",
        prazo: new Date("2026-02-20T23:59:59"),
        historico: [{ concluidoEm: new Date("2026-02-15T10:00:00") }],
      },
    ]);
    tarefaFindManyMock.mockResolvedValueOnce([
      { responsavelId: "user_1", status: "PENDENTE", motivoPendencia: null, prazo: new Date("2026-02-25T23:59:59") },
    ]);
    empresaGroupByMock.mockResolvedValue([{ responsavelId: "user_1", _count: { id: 7 } }]);

    const resultado = await calcularSnapshotMensal(tx as never, "2026-02");
    const linha = resultado.find((r) => r.colaboradorId === "user_1");

    expect(linha?.totalConcluidas).toBe(1);
    expect(linha?.concluidasNoPrazo).toBe(1);
    expect(linha?.totalEmpresas).toBe(7);
    expect(linha?.totalTarefasPeriodo).toBe(1);
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
    // cujo concluidoEm cai dentro do range do mes-alvo. user_3 ja esta no
    // default usuarioFindManyMock de criarTxMock() (setor FISCAL).
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
    usuarioFindManyMock,
    usuarioFindFirstMock,
    desempenhoMensalCreateManyMock,
  } = dbMocks;

  beforeEach(() => {
    empresaFindManyMock.mockReset();
    tarefaCreateManyMock.mockReset();
    tarefaFindManyMock.mockReset();
    empresaGroupByMock.mockReset();
    usuarioFindManyMock.mockReset();
    usuarioFindFirstMock.mockReset();
    desempenhoMensalCreateManyMock.mockReset();

    empresaFindManyMock.mockResolvedValue([]);
    tarefaCreateManyMock.mockResolvedValue({ count: 0 });
    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);
    // default: user_1 (usado nos 3 testes deste describe) pertence ao setor
    // FISCAL — evita que a linha do snapshot seja descartada por setor null.
    usuarioFindManyMock.mockResolvedValue([{ id: "user_1", setor: "FISCAL" }]);
    usuarioFindFirstMock.mockResolvedValue(null);
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
    // startOfMonth/endOfMonth (date-fns) operam em horario local — usar
    // getMonth() local, nao getUTCMonth(), para evitar falso-negativo
    // dependente do fuso horario da maquina que roda o teste.
    expect(gte.getMonth()).toBe(1); // Fevereiro (0-indexed)
    expect(lte.getMonth()).toBe(1);

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
