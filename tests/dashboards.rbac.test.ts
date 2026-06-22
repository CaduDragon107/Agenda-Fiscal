import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockColaboradorUser } from "./setup";

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
});
