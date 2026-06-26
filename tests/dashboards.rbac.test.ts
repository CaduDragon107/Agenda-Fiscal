import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockColaboradorUser,
  mockDonoUser,
  mockChefeFiscalUser,
  mockChefeDpUser,
} from "./setup";

/**
 * tests/dashboards.rbac.test.ts
 *
 * Cobre T-4-01: COLABORADOR (e usuário não autenticado) navegando direto
 * para /dashboards é rejeitado ANTES de qualquer query de dashboard ser
 * chamada — o guard server-side é a barreira REAL, não a sidebar.
 *
 * `next/navigation` (notFound/redirect), `@/auth` e
 * `@/modules/dashboards/queries` são mockados. Como notFound()/redirect()
 * lançam exceção no Next.js real, os mocks também lançam aqui para
 * interromper a execução da page no ponto exato do guard — permitindo
 * asserir que nenhuma query foi chamada depois.
 */

const authMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirectMock = vi.fn((..._args: unknown[]) => {
  throw new Error("NEXT_REDIRECT");
});
const listarDesempenhoColaboradoresMesAtualMock = vi.fn();
const listarEvolucaoMensalMock = vi.fn();
const listarRankingEmpresasMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock("@/modules/dashboards/queries", () => ({
  listarDesempenhoColaboradoresMesAtual: (...args: unknown[]) =>
    listarDesempenhoColaboradoresMesAtualMock(...args),
  listarEvolucaoMensal: (...args: unknown[]) => listarEvolucaoMensalMock(...args),
  listarRankingEmpresas: (...args: unknown[]) => listarRankingEmpresasMock(...args),
}));

describe("Dashboards — guard DONO-only", () => {
  beforeEach(() => {
    authMock.mockReset();
    notFoundMock.mockClear();
    redirectMock.mockClear();
    listarDesempenhoColaboradoresMesAtualMock.mockReset();
    listarEvolucaoMensalMock.mockReset();
    listarRankingEmpresasMock.mockReset();
  });

  it("usuário não autenticado é rejeitado antes de qualquer query de dashboard", async () => {
    authMock.mockResolvedValue(null);
    const { carregarDadosDashboards } = await import(
      "@/app/(app)/dashboards/guard"
    );

    await expect(carregarDadosDashboards()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(listarDesempenhoColaboradoresMesAtualMock).not.toHaveBeenCalled();
    expect(listarEvolucaoMensalMock).not.toHaveBeenCalled();
    expect(listarRankingEmpresasMock).not.toHaveBeenCalled();
  });

  it("usuário com role COLABORADOR é rejeitado antes de qualquer query de dashboard — apenas DONO acessa", async () => {
    authMock.mockResolvedValue({ user: mockColaboradorUser() });
    const { carregarDadosDashboards } = await import(
      "@/app/(app)/dashboards/guard"
    );

    await expect(carregarDadosDashboards()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
    expect(listarDesempenhoColaboradoresMesAtualMock).not.toHaveBeenCalled();
    expect(listarEvolucaoMensalMock).not.toHaveBeenCalled();
    expect(listarRankingEmpresasMock).not.toHaveBeenCalled();
  });

  it("CHEFE_SETOR de Fiscal acessa e recebe escopo de apenas 1 setor (FISCAL)", async () => {
    authMock.mockResolvedValue({ user: mockChefeFiscalUser() });
    listarDesempenhoColaboradoresMesAtualMock.mockResolvedValue([]);
    listarEvolucaoMensalMock.mockResolvedValue([]);
    listarRankingEmpresasMock.mockResolvedValue([]);
    const { carregarDadosDashboards } = await import(
      "@/app/(app)/dashboards/guard"
    );

    const resultado = await carregarDadosDashboards();

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(listarDesempenhoColaboradoresMesAtualMock).toHaveBeenCalledTimes(1);
    expect(listarEvolucaoMensalMock).toHaveBeenCalledTimes(1);
    expect(listarRankingEmpresasMock).toHaveBeenCalledTimes(1);
    expect(listarDesempenhoColaboradoresMesAtualMock).toHaveBeenCalledWith(
      expect.anything(),
      "FISCAL",
      expect.anything()
    );
    expect(listarEvolucaoMensalMock).toHaveBeenCalledWith(
      expect.anything(),
      "FISCAL",
      expect.anything()
    );
    expect(listarRankingEmpresasMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "FISCAL",
      expect.anything()
    );
    expect(Object.keys(resultado)).toEqual(["FISCAL"]);
    expect(resultado).not.toHaveProperty("DP");
    expect(resultado).not.toHaveProperty("CONTABIL");
  });

  it("CHEFE_SETOR de DP acessa e recebe escopo de apenas 1 setor (DP), isolado de FISCAL/CONTABIL", async () => {
    authMock.mockResolvedValue({ user: mockChefeDpUser() });
    listarDesempenhoColaboradoresMesAtualMock.mockResolvedValue([]);
    listarEvolucaoMensalMock.mockResolvedValue([]);
    listarRankingEmpresasMock.mockResolvedValue([]);
    const { carregarDadosDashboards } = await import(
      "@/app/(app)/dashboards/guard"
    );

    const resultado = await carregarDadosDashboards();

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(listarDesempenhoColaboradoresMesAtualMock).toHaveBeenCalledTimes(1);
    expect(listarEvolucaoMensalMock).toHaveBeenCalledTimes(1);
    expect(listarRankingEmpresasMock).toHaveBeenCalledTimes(1);
    expect(listarDesempenhoColaboradoresMesAtualMock).toHaveBeenCalledWith(
      expect.anything(),
      "DP",
      { temFuncionariosClt: true }
    );
    expect(listarEvolucaoMensalMock).toHaveBeenCalledWith(
      expect.anything(),
      "DP",
      { temFuncionariosClt: true }
    );
    expect(listarRankingEmpresasMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "DP",
      { temFuncionariosClt: true }
    );
    expect(Object.keys(resultado)).toEqual(["DP"]);
    expect(resultado).not.toHaveProperty("FISCAL");
    expect(resultado).not.toHaveProperty("CONTABIL");
  });

  it("DONO continua recebendo os 3 setores (regressão) — 9 chamadas no total", async () => {
    authMock.mockResolvedValue({ user: mockDonoUser() });
    listarDesempenhoColaboradoresMesAtualMock.mockResolvedValue([]);
    listarEvolucaoMensalMock.mockResolvedValue([]);
    listarRankingEmpresasMock.mockResolvedValue([]);
    const { carregarDadosDashboards } = await import(
      "@/app/(app)/dashboards/guard"
    );

    const resultado = await carregarDadosDashboards();

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(listarDesempenhoColaboradoresMesAtualMock).toHaveBeenCalledTimes(3);
    expect(listarEvolucaoMensalMock).toHaveBeenCalledTimes(3);
    expect(listarRankingEmpresasMock).toHaveBeenCalledTimes(3);
    expect(Object.keys(resultado).sort()).toEqual(["CONTABIL", "DP", "FISCAL"]);
  });

  it("CHEFE_SETOR com setor null falha seguro: Record vazio, nenhuma query disparada", async () => {
    authMock.mockResolvedValue({ user: mockChefeFiscalUser({ setor: null }) });
    const { carregarDadosDashboards } = await import(
      "@/app/(app)/dashboards/guard"
    );

    const resultado = await carregarDadosDashboards();

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(listarDesempenhoColaboradoresMesAtualMock).not.toHaveBeenCalled();
    expect(listarEvolucaoMensalMock).not.toHaveBeenCalled();
    expect(listarRankingEmpresasMock).not.toHaveBeenCalled();
    expect(resultado).toEqual({});
  });
});
