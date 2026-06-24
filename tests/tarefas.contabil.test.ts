import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockContabilColaboradorUser } from "./setup";

/**
 * tests/tarefas.contabil.test.ts
 *
 * Cobre CONT-06: tarefa avulsa criada por um COLABORADOR do setor CONTABIL
 * respeita o mesmo escopo setor-aware (withVisibilityScope/withTarefaScope)
 * já validado na Phase 5 — sem nenhuma mudança em código de produção.
 *
 * Esta suite NÃO testa código novo: prova, via regressão, que `criarTarefa`
 * (src/app/(app)/tarefas/actions.ts) generaliza corretamente para o setor
 * CONTABIL por composição com `withVisibilityScope`, que já retorna
 * `{ responsaveisPorSetor: { some: { setor: "CONTABIL", usuarioId } } }`
 * para colaborador Contábil (src/lib/visibility-scope.ts).
 *
 * `db` e `auth` são mockados via vi.mock — nenhuma conexão real ao Postgres.
 */

const empresaFindFirstMock = vi.fn();
const tarefaCreateMock = vi.fn();
const authMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    empresa: {
      findFirst: (...args: unknown[]) => empresaFindFirstMock(...args),
    },
    tarefa: {
      create: (...args: unknown[]) => tarefaCreateMock(...args),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("CONT-06 — criarTarefa (tarefa avulsa, colaborador Contábil)", () => {
  beforeEach(() => {
    empresaFindFirstMock.mockReset();
    tarefaCreateMock.mockReset();
    authMock.mockReset();
  });

  it("COLABORADOR de Contábil cria tarefa avulsa atribuída a si mesmo, dentro do seu escopo de setor", async () => {
    const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
    const contabilColaborador = mockContabilColaboradorUser();

    authMock.mockResolvedValue({ user: contabilColaborador });
    // Empresa está dentro do escopo CONTABIL do colaborador (findFirst escopado resolve)
    empresaFindFirstMock.mockResolvedValue({ id: "empresa_contabil" });
    tarefaCreateMock.mockResolvedValue({ id: "tarefa_contabil_1" });

    const formData = new FormData();
    formData.set("titulo", "Balancete mensal");
    formData.set("descricao", "");
    formData.set("empresaId", "empresa_contabil");
    formData.set("responsavelId", contabilColaborador.id);
    formData.set("prazo", "2026-12-31");

    const resultado = await criarTarefa(formData);

    expect(resultado).toEqual({ ok: true, id: "tarefa_contabil_1" });
    expect(tarefaCreateMock).toHaveBeenCalledTimes(1);

    // Anti-IDOR para create: empresa.findFirst deve ter sido chamado com o
    // escopo de visibilidade setor-aware do colaborador Contábil (junction
    // table), não a forma legada FISCAL (responsavelId).
    expect(empresaFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "empresa_contabil",
          responsaveisPorSetor: {
            some: { setor: "CONTABIL", usuarioId: contabilColaborador.id },
          },
        }),
      })
    );
  });

  it("COLABORADOR de Contábil NÃO pode atribuir tarefa avulsa a um colega que não é dele", async () => {
    const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
    const contabilColaborador = mockContabilColaboradorUser();

    authMock.mockResolvedValue({ user: contabilColaborador });
    // Empresa está dentro do escopo CONTABIL do colaborador (guard de empresa passa)
    empresaFindFirstMock.mockResolvedValue({ id: "empresa_contabil" });

    const formData = new FormData();
    formData.set("titulo", "Balancete mensal");
    formData.set("descricao", "");
    formData.set("empresaId", "empresa_contabil");
    // Tenta atribuir a um colega diferente de si mesmo
    formData.set("responsavelId", "outro_user_contabil");
    formData.set("prazo", "2026-12-31");

    const resultado = await criarTarefa(formData);

    expect(resultado).toEqual({ ok: false, error: "não autorizado" });
    expect(tarefaCreateMock).not.toHaveBeenCalled();
  });

  it("COLABORADOR de Contábil é barrado ao tentar criar tarefa para empresa fora do seu escopo de setor", async () => {
    const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
    const contabilColaborador = mockContabilColaboradorUser();

    authMock.mockResolvedValue({ user: contabilColaborador });
    // Empresa existe mas não está no escopo CONTABIL deste colaborador
    empresaFindFirstMock.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("titulo", "Balancete mensal");
    formData.set("descricao", "");
    formData.set("empresaId", "empresa_fora_do_escopo");
    formData.set("responsavelId", contabilColaborador.id);
    formData.set("prazo", "2026-12-31");

    const resultado = await criarTarefa(formData);

    expect(resultado).toEqual({ ok: false, error: "não encontrado" });
    expect(tarefaCreateMock).not.toHaveBeenCalled();

    expect(empresaFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "empresa_fora_do_escopo",
          responsaveisPorSetor: {
            some: { setor: "CONTABIL", usuarioId: contabilColaborador.id },
          },
        }),
      })
    );
  });
});
