import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDonoUser, mockColaboradorUser } from "./setup";

/**
 * tests/usuarios.actions.test.ts
 *
 * Cobre T-d1a-01/T-d1a-02 (RBAC DONO-only + update restrito ao campo nome)
 * de editarNomeUsuarioAction (quick task 260626-d1a).
 *
 * Segue o mesmo padrão de mock de tests/geracao.actions.test.ts: `db`, `auth`
 * e `next/cache` mockados — nenhuma conexão real ao Postgres.
 */

const updateMock = vi.fn();
const authMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    usuario: {
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("editarNomeUsuarioAction", () => {
  beforeEach(() => {
    updateMock.mockReset();
    authMock.mockReset();
  });

  it("rejeita chamador não autenticado sem tocar no banco", async () => {
    const { editarNomeUsuarioAction } = await import(
      "@/app/(app)/usuarios/actions"
    );

    authMock.mockResolvedValue(null);

    const resultado = await editarNomeUsuarioAction("user_1", "Novo Nome");

    expect(resultado.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejeita COLABORADOR com 'não autorizado' sem tocar no banco", async () => {
    const { editarNomeUsuarioAction } = await import(
      "@/app/(app)/usuarios/actions"
    );
    const colaborador = mockColaboradorUser();

    authMock.mockResolvedValue({ user: colaborador });

    const resultado = await editarNomeUsuarioAction("user_1", "Novo Nome");

    expect(resultado).toEqual({ ok: false, error: "não autorizado" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("DONO com nome válido atualiza SOMENTE o campo nome e retorna { ok: true }", async () => {
    const { editarNomeUsuarioAction } = await import(
      "@/app/(app)/usuarios/actions"
    );
    const dono = mockDonoUser();

    authMock.mockResolvedValue({ user: dono });
    updateMock.mockResolvedValue({ id: "user_1", nome: "Novo Nome" });

    const resultado = await editarNomeUsuarioAction("user_1", "Novo Nome");

    expect(resultado).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledTimes(1);
    const chamada = updateMock.mock.calls[0][0];
    expect(chamada.where).toEqual({ id: "user_1" });
    expect(Object.keys(chamada.data)).toEqual(["nome"]);
    expect(chamada.data.nome).toBe("Novo Nome");
  });

  it("rejeita nome vazio/só-espaços sem tocar no banco", async () => {
    const { editarNomeUsuarioAction } = await import(
      "@/app/(app)/usuarios/actions"
    );
    const dono = mockDonoUser();

    authMock.mockResolvedValue({ user: dono });

    const resultado = await editarNomeUsuarioAction("user_1", "   ");

    expect(resultado.ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
