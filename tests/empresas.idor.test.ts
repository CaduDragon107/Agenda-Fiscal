import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockColaboradorUser, mockOtherColaboradorUser, mockDonoUser } from "./setup";

/**
 * tests/empresas.idor.test.ts
 *
 * Cobre AUTH-02 (IDOR): Colaborador A não consegue ler/editar/excluir a
 * empresa de Colaborador B chamando a Server Action diretamente com o id da
 * empresa de B (mesmo sem qualquer link/botão na UI apontando para ela).
 *
 * Contrato (PATTERNS.md / T-01-IDOR-MUT): toda mutação por id deve usar
 * findFirst({ where: { id, ...withVisibilityScope(session.user) } }) e
 * retornar "não encontrado" (nunca 403/erro de permissão) quando fora do
 * escopo — e NÃO alterar o registro.
 *
 * `db` e `auth` são mockados via vi.mock — nenhuma conexão real ao Postgres.
 */

const findFirstMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();
const authMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    empresa: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function buildFormData(): FormData {
  const fd = new FormData();
  fd.set("nome", "Empresa de B Editada");
  fd.set("cnpj", "11.222.333/0001-81");
  fd.set("regimeTributario", "LUCRO_PRESUMIDO");
  fd.set("responsavelId", "user_colaborador_2");
  fd.set("contatos", "");
  fd.set("particularidades", "");
  return fd;
}

describe("IDOR - isolamento de empresas entre colaboradores", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
    authMock.mockReset();
  });

  it("colaborador A não consegue LER empresa de colaborador B (retorna 'não encontrado')", async () => {
    const { buscarEmpresaPorId } = await import("@/modules/empresas/queries");
    const colaboradorA = mockColaboradorUser();

    // findFirst escopado retorna null pois a empresa pertence a B
    findFirstMock.mockResolvedValue(null);

    const resultado = await buscarEmpresaPorId(colaboradorA, "empresa_de_b");

    expect(resultado).toBeNull();
    expect(findFirstMock).toHaveBeenCalledTimes(1);
    const arg = findFirstMock.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({
      id: "empresa_de_b",
      responsavelId: colaboradorA.id,
    });
  });

  it("colaborador A não consegue EDITAR empresa de colaborador B via Server Action direta", async () => {
    const { editarEmpresa } = await import("@/app/(app)/actions");
    const colaboradorA = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaboradorA });
    // findFirst escopado (id + responsavelId === colaboradorA.id) não encontra
    // a empresa de B -> retorna null
    findFirstMock.mockResolvedValue(null);

    const resultado = await editarEmpresa("empresa_de_b", buildFormData());

    expect(resultado).toEqual({ ok: false, error: "não encontrado" });
    expect(updateMock).not.toHaveBeenCalled();

    const arg = findFirstMock.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({
      id: "empresa_de_b",
      responsavelId: colaboradorA.id,
    });
  });

  it("colaborador A não consegue EXCLUIR empresa de colaborador B via Server Action direta", async () => {
    const { excluirEmpresa } = await import("@/app/(app)/actions");
    const colaboradorA = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaboradorA });
    findFirstMock.mockResolvedValue(null);

    const resultado = await excluirEmpresa("empresa_de_b");

    expect(resultado).toEqual({ ok: false, error: "não encontrado" });
    expect(deleteMock).not.toHaveBeenCalled();

    const arg = findFirstMock.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({
      id: "empresa_de_b",
      responsavelId: colaboradorA.id,
    });
  });

  it("dono consegue ler/editar empresas de qualquer colaborador (sem restrição)", async () => {
    const { editarEmpresa } = await import("@/app/(app)/actions");
    const dono = mockDonoUser();
    const colaboradorB = mockOtherColaboradorUser();

    authMock.mockResolvedValue({ user: dono });
    // findFirst escopado para dono (where = { id } sem responsavelId) encontra
    // a empresa de B normalmente
    findFirstMock.mockResolvedValue({ id: "empresa_de_b" });
    updateMock.mockResolvedValue({ id: "empresa_de_b" });

    const fd = buildFormData();
    fd.set("responsavelId", colaboradorB.id);

    const resultado = await editarEmpresa("empresa_de_b", fd);

    expect(resultado).toEqual({ ok: true, id: "empresa_de_b" });
    expect(updateMock).toHaveBeenCalledTimes(1);

    const arg = findFirstMock.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toMatchObject({ id: "empresa_de_b" });
    expect(arg.where.responsavelId).toBeUndefined();
  });
});
