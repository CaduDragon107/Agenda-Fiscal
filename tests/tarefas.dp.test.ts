import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDpColaboradorUser } from "./setup";

/**
 * tests/tarefas.dp.test.ts
 *
 * Cobre DP-05: tarefa avulsa criada por um COLABORADOR do setor DP respeita
 * o mesmo escopo setor-aware (withVisibilityScope/withTarefaScope) já
 * validado na Phase 5 — sem nenhuma mudança em código de produção.
 *
 * Esta suite NÃO testa código novo: prova, via regressão, que `criarTarefa`
 * (src/app/(app)/tarefas/actions.ts) generaliza corretamente para o setor DP
 * por composição com `withVisibilityScope`, que já retorna
 * `{ responsaveisPorSetor: { some: { setor: "DP", usuarioId } } }` para
 * colaborador DP (src/lib/visibility-scope.ts).
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

describe("DP-05 — criarTarefa (tarefa avulsa, colaborador DP)", () => {
  beforeEach(() => {
    empresaFindFirstMock.mockReset();
    tarefaCreateMock.mockReset();
    authMock.mockReset();
  });

  it("COLABORADOR de DP cria tarefa avulsa atribuída a si mesmo, dentro do seu escopo de setor", async () => {
    const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
    const dpColaborador = mockDpColaboradorUser();

    authMock.mockResolvedValue({ user: dpColaborador });
    // Empresa está dentro do escopo DP do colaborador (findFirst escopado resolve)
    empresaFindFirstMock.mockResolvedValue({ id: "empresa_dp" });
    tarefaCreateMock.mockResolvedValue({ id: "tarefa_dp_1" });

    const formData = new FormData();
    formData.set("titulo", "Folha de pagamento");
    formData.set("descricao", "");
    formData.set("empresaId", "empresa_dp");
    formData.set("responsavelId", dpColaborador.id);
    formData.set("prazo", "2026-12-31");

    const resultado = await criarTarefa(formData);

    expect(resultado).toEqual({ ok: true, id: "tarefa_dp_1" });
    expect(tarefaCreateMock).toHaveBeenCalledTimes(1);

    // Anti-IDOR para create: empresa.findFirst deve ter sido chamado com o
    // escopo de visibilidade setor-aware do colaborador DP (junction table),
    // não a forma legada FISCAL (responsavelId).
    expect(empresaFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "empresa_dp",
          responsaveisPorSetor: {
            some: { setor: "DP", usuarioId: dpColaborador.id },
          },
        }),
      })
    );
  });

  it("COLABORADOR de DP NÃO pode atribuir tarefa avulsa a um colega que não é dele", async () => {
    const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
    const dpColaborador = mockDpColaboradorUser();

    authMock.mockResolvedValue({ user: dpColaborador });
    // Empresa está dentro do escopo DP do colaborador (guard de empresa passa)
    empresaFindFirstMock.mockResolvedValue({ id: "empresa_dp" });

    const formData = new FormData();
    formData.set("titulo", "Folha de pagamento");
    formData.set("descricao", "");
    formData.set("empresaId", "empresa_dp");
    // Tenta atribuir a um colega diferente de si mesmo
    formData.set("responsavelId", "outro_user_dp");
    formData.set("prazo", "2026-12-31");

    const resultado = await criarTarefa(formData);

    expect(resultado).toEqual({ ok: false, error: "não autorizado" });
    expect(tarefaCreateMock).not.toHaveBeenCalled();
  });

  it("COLABORADOR de DP é barrado ao tentar criar tarefa para empresa fora do seu escopo de setor", async () => {
    const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
    const dpColaborador = mockDpColaboradorUser();

    authMock.mockResolvedValue({ user: dpColaborador });
    // Empresa existe mas não está no escopo DP deste colaborador
    empresaFindFirstMock.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("titulo", "Folha de pagamento");
    formData.set("descricao", "");
    formData.set("empresaId", "empresa_fora_do_escopo");
    formData.set("responsavelId", dpColaborador.id);
    formData.set("prazo", "2026-12-31");

    const resultado = await criarTarefa(formData);

    expect(resultado).toEqual({ ok: false, error: "não encontrado" });
    expect(tarefaCreateMock).not.toHaveBeenCalled();

    expect(empresaFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "empresa_fora_do_escopo",
          responsaveisPorSetor: {
            some: { setor: "DP", usuarioId: dpColaborador.id },
          },
        }),
      })
    );
  });
});
