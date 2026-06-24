import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDonoUser, mockColaboradorUser } from "./setup";

/**
 * tests/geracao.actions.test.ts
 *
 * Cobre T-3-01/T-3-05 (RBAC + autenticação) e o caminho de sucesso de
 * `gerarTarefasDoMesAction` (D-08, D-11).
 *
 * Segue o mesmo padrão de mock de tests/tarefas.idor.test.ts: `db`, `auth`
 * e `next/cache` mockados — nenhuma conexão real ao Postgres.
 */

const findManyMock = vi.fn();
const createManyMock = vi.fn();
const authMock = vi.fn();
// NOVO (Plan 04-02): executarGeracaoMensal agora tambem chama
// calcularSnapshotMensal (tarefa.findMany + empresa.groupBy) e
// desempenhoMensal.createMany dentro da mesma transacao, antes da geracao.
const tarefaFindManyMock = vi.fn();
const empresaGroupByMock = vi.fn();
const desempenhoMensalCreateManyMock = vi.fn();

vi.mock("@/lib/db", () => {
  const tx = {
    empresa: {
      findMany: (...args: unknown[]) => findManyMock(...args),
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

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("gerarTarefasDoMesAction — RBAC", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    createManyMock.mockReset();
    authMock.mockReset();
    tarefaFindManyMock.mockReset();
    empresaGroupByMock.mockReset();
    desempenhoMensalCreateManyMock.mockReset();

    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);
    desempenhoMensalCreateManyMock.mockResolvedValue({ count: 0 });
  });

  it("RBAC: chamador não autenticado é rejeitado sem tocar no banco", async () => {
    const { gerarTarefasDoMesAction } = await import(
      "@/app/(app)/tarefas/actions"
    );

    authMock.mockResolvedValue(null);

    const resultado = await gerarTarefasDoMesAction();

    expect(resultado.ok).toBe(false);
    expect(createManyMock).not.toHaveBeenCalled();
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("RBAC: COLABORADOR é rejeitado com 'não autorizado' sem tocar no banco", async () => {
    const { gerarTarefasDoMesAction } = await import(
      "@/app/(app)/tarefas/actions"
    );
    const colaborador = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaborador });

    const resultado = await gerarTarefasDoMesAction();

    expect(resultado).toEqual({ ok: false, error: "não autorizado" });
    expect(createManyMock).not.toHaveBeenCalled();
  });
});

describe("gerarTarefasDoMesAction — sucesso DONO", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    createManyMock.mockReset();
    authMock.mockReset();
    tarefaFindManyMock.mockReset();
    empresaGroupByMock.mockReset();
    desempenhoMensalCreateManyMock.mockReset();

    tarefaFindManyMock.mockResolvedValue([]);
    empresaGroupByMock.mockResolvedValue([]);
    desempenhoMensalCreateManyMock.mockResolvedValue({ count: 0 });
  });

  it("DONO autenticado dispara a geração e retorna { ok: true, criadas, puladas }", async () => {
    const { gerarTarefasDoMesAction } = await import(
      "@/app/(app)/tarefas/actions"
    );
    const dono = mockDonoUser();

    authMock.mockResolvedValue({ user: dono });
    // NOTA: esta action usa competenciaAtual() (sem argumento) -- a depender
    // do mes real em que a suite roda, o bloco Contabil ANUAL pode disparar
    // 0 ou 1 obrigacao extra (fevereiro=DEFIS, abril=ECD, junho=ECF),
    // adicionando uma chamada extra de empresa.findMany. mockResolvedValue
    // (sem "Once") cobre qualquer chamada adicional alem das 3 explicitas
    // abaixo, retornando [] (nenhuma empresa elegivel) de forma estavel
    // independente do mes de execucao.
    findManyMock.mockResolvedValue([]);
    findManyMock
      .mockResolvedValueOnce([
        { id: "empresa_1", regimeTributario: "SIMPLES_NACIONAL", responsavelId: "user_colaborador_1" },
      ])
      .mockResolvedValueOnce([]) // loop DP: nenhuma empresa CLT
      .mockResolvedValueOnce([]); // bloco Contabil mensal: nenhuma empresa LUCRO_REAL/PRESUMIDO
    createManyMock.mockResolvedValue({ count: 3 });

    const resultado = await gerarTarefasDoMesAction();

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.criadas).toBe(3);
      expect(typeof resultado.puladas).toBe("number");
      expect(Array.isArray(resultado.semResponsavelDp)).toBe(true);
      expect(Array.isArray(resultado.semResponsavelContabil)).toBe(true);
    }
  });
});
