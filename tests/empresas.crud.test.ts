import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockColaboradorUser, mockDonoUser } from "./setup";

/**
 * tests/empresas.crud.test.ts
 *
 * Cobre EMPR-01: CRUD de empresa via Server Actions (src/app/(app)/actions.ts).
 * - criarEmpresa com regimeTributario válido (LUCRO_REAL, LUCRO_PRESUMIDO ou
 *   SIMPLES_NACIONAL) persiste corretamente e grava a primeira entrada de
 *   EmpresaRegimeHistorico.
 * - criarEmpresa com CNPJ inválido (dígito verificador incorreto) é rejeitada
 *   pela validação (empresaSchema) antes de chegar ao banco.
 * - editarEmpresa atualiza dados de empresa existente (nome, contatos,
 *   particularidades).
 * - EMPR-03 (v2.0, Plano 05-03): editar empresa só alterando
 *   temFuncionariosClt (responsáveis inalterados) -> empresa.update recebe
 *   temFuncionariosClt; nenhuma linha junction é duplicada/apagada.
 *
 * `db` e `auth` são mockados via vi.mock — nenhuma conexão real ao Postgres.
 */

const createMock = vi.fn();
const findFirstMock = vi.fn();
const updateMock = vi.fn();
const upsertMock = vi.fn();
const authMock = vi.fn();

vi.mock("@/lib/db", () => {
  const tx = {
    empresa: {
      create: (...args: unknown[]) => createMock(...args),
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      delete: vi.fn(),
    },
    empresaResponsavelSetor: {
      upsert: (...args: unknown[]) => upsertMock(...args),
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

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const dados: Record<string, string> = {
    nome: "Empresa Teste LTDA",
    cnpj: "11.222.333/0001-81",
    regimeTributario: "LUCRO_REAL",
    responsavelFiscalId: "user_colaborador_1",
    contatos: "",
    particularidades: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(dados)) {
    fd.set(key, value);
  }
  return fd;
}

describe("CRUD de Empresa", () => {
  beforeEach(() => {
    createMock.mockReset();
    findFirstMock.mockReset();
    updateMock.mockReset();
    upsertMock.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue({ user: mockColaboradorUser() });
  });

  it("cria empresa com regimeTributario válido (LUCRO_REAL)", async () => {
    const { criarEmpresa } = await import("@/app/(app)/actions");
    createMock.mockResolvedValue({ id: "empresa_1" });

    const resultado = await criarEmpresa(buildFormData({ regimeTributario: "LUCRO_REAL" }));

    expect(resultado).toEqual({ ok: true, id: "empresa_1" });
    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.regimeTributario).toBe("LUCRO_REAL");
    // grava a primeira entrada de EmpresaRegimeHistorico (regime atual, dataInicio = agora)
    expect(arg.data.regimeHistorico).toMatchObject({
      create: { regimeTributario: "LUCRO_REAL" },
    });
    const historico = arg.data.regimeHistorico as { create: { dataInicio: Date } };
    expect(historico.create.dataInicio).toBeInstanceOf(Date);
  });

  it("cria empresa com regimeTributario válido (LUCRO_PRESUMIDO)", async () => {
    const { criarEmpresa } = await import("@/app/(app)/actions");
    createMock.mockResolvedValue({ id: "empresa_2" });

    const resultado = await criarEmpresa(
      buildFormData({ cnpj: "11.444.777/0001-61", regimeTributario: "LUCRO_PRESUMIDO" })
    );

    expect(resultado).toEqual({ ok: true, id: "empresa_2" });
    const arg = createMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.regimeTributario).toBe("LUCRO_PRESUMIDO");
  });

  it("cria empresa com regimeTributario válido (SIMPLES_NACIONAL)", async () => {
    const { criarEmpresa } = await import("@/app/(app)/actions");
    createMock.mockResolvedValue({ id: "empresa_3" });

    const resultado = await criarEmpresa(
      buildFormData({ cnpj: "11.444.777/0001-61", regimeTributario: "SIMPLES_NACIONAL" })
    );

    expect(resultado).toEqual({ ok: true, id: "empresa_3" });
    const arg = createMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.regimeTributario).toBe("SIMPLES_NACIONAL");
  });

  it("rejeita criação de empresa com CNPJ inválido (dígito verificador incorreto)", async () => {
    const { criarEmpresa } = await import("@/app/(app)/actions");

    const resultado = await criarEmpresa(
      buildFormData({ cnpj: "11.222.333/0001-80" }) // dígito verificador alterado
    );

    expect(resultado.ok).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("atualiza dados de empresa existente (nome, contatos, particularidades)", async () => {
    const { editarEmpresa } = await import("@/app/(app)/actions");
    const colaborador = mockColaboradorUser();
    authMock.mockResolvedValue({ user: colaborador });

    findFirstMock.mockResolvedValue({
      id: "empresa_1",
      responsavelId: colaborador.id,
      responsaveisPorSetor: [{ setor: "FISCAL", usuarioId: colaborador.id }],
    });
    updateMock.mockResolvedValue({ id: "empresa_1" });

    const fd = buildFormData({
      nome: "Empresa Atualizada LTDA",
      contatos: "contato@empresa.com",
      particularidades: "Entrega de DAS até dia 20",
      responsavelFiscalId: colaborador.id,
    });

    const resultado = await editarEmpresa("empresa_1", fd);

    expect(resultado).toEqual({ ok: true, id: "empresa_1" });
    expect(updateMock).toHaveBeenCalledTimes(1);
    const arg = updateMock.mock.calls[0][0] as { where: { id: string }; data: Record<string, unknown> };
    expect(arg.where).toEqual({ id: "empresa_1" });
    expect(arg.data.nome).toBe("Empresa Atualizada LTDA");
    expect(arg.data.contatos).toBe("contato@empresa.com");
    expect(arg.data.particularidades).toBe("Entrega de DAS até dia 20");
  });

  it("EMPR-03: temFuncionariosClt default é false na criação quando ausente do formulário", async () => {
    const { criarEmpresa } = await import("@/app/(app)/actions");
    createMock.mockResolvedValue({ id: "empresa_clt_1" });

    // buildFormData não inclui temFuncionariosClt -> dadosFormulario lê
    // formData.get("temFuncionariosClt") === "true", que é false quando ausente
    const resultado = await criarEmpresa(buildFormData());

    expect(resultado).toEqual({ ok: true, id: "empresa_clt_1" });
    const arg = createMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.temFuncionariosClt).toBe(false);
  });

  it("EMPR-03: editar empresa só alterando temFuncionariosClt (responsáveis inalterados) -> empresa.update recebe temFuncionariosClt; nenhuma linha junction duplicada/apagada", async () => {
    const { editarEmpresa } = await import("@/app/(app)/actions");
    const colaborador = mockColaboradorUser();
    authMock.mockResolvedValue({ user: colaborador });

    findFirstMock.mockResolvedValue({
      id: "empresa_1",
      responsavelId: colaborador.id,
      responsaveisPorSetor: [{ setor: "FISCAL", usuarioId: colaborador.id }],
    });
    updateMock.mockResolvedValue({ id: "empresa_1" });

    const fd = buildFormData({
      responsavelFiscalId: colaborador.id,
      temFuncionariosClt: "true",
    });

    const resultado = await editarEmpresa("empresa_1", fd);

    expect(resultado).toEqual({ ok: true, id: "empresa_1" });
    const updateArg = updateMock.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateArg.data.temFuncionariosClt).toBe(true);

    // o responsável Fiscal inalterado gera exatamente 1 upsert (FISCAL),
    // nenhum upsert duplicado e nenhum DP/Contábil criado do nada
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upsertArg = upsertMock.mock.calls[0][0] as { create: { setor: string; usuarioId: string } };
    expect(upsertArg.create.setor).toBe("FISCAL");
    expect(upsertArg.create.usuarioId).toBe(colaborador.id);
  });
});
