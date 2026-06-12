import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

/**
 * tests/auth.test.ts
 *
 * Cobre AUTH-01: login com email/senha via Auth.js v5 Credentials Provider.
 * - Login com email/senha corretos retorna { id, name, email, role }.
 * - Login com email inexistente retorna null (sem distinção de "senha errada").
 * - Login com senha errada retorna null.
 * - callbacks jwt/session propagam id e role para token/session.
 *
 * `db` é mockado via vi.mock("@/lib/db") — nenhuma conexão real ao Postgres
 * é feita neste teste.
 */

const findUniqueMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    usuario: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

describe("autenticação (Credentials Provider)", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("login com email/senha corretos retorna sessão com role do usuário", async () => {
    const { authorize } = await import("@/auth");

    const senhaHash = await bcrypt.hash("senha-correta", 10);
    findUniqueMock.mockResolvedValue({
      id: "user_1",
      nome: "Colaborador 1",
      email: "colaborador1@escritorio.com.br",
      role: "COLABORADOR",
      senhaHash,
    });

    const resultado = await authorize({
      email: "colaborador1@escritorio.com.br",
      password: "senha-correta",
    });

    expect(resultado).toEqual({
      id: "user_1",
      name: "Colaborador 1",
      email: "colaborador1@escritorio.com.br",
      role: "COLABORADOR",
    });
  });

  it("login com email inexistente retorna null (erro genérico 'Email ou senha incorretos')", async () => {
    const { authorize } = await import("@/auth");

    findUniqueMock.mockResolvedValue(null);

    const resultado = await authorize({
      email: "nao-existe@escritorio.com.br",
      password: "qualquer-senha",
    });

    expect(resultado).toBeNull();
  });

  it("login com senha incorreta retorna null (mesmo erro genérico do email inexistente)", async () => {
    const { authorize } = await import("@/auth");

    const senhaHash = await bcrypt.hash("senha-correta", 10);
    findUniqueMock.mockResolvedValue({
      id: "user_1",
      nome: "Colaborador 1",
      email: "colaborador1@escritorio.com.br",
      role: "COLABORADOR",
      senhaHash,
    });

    const resultado = await authorize({
      email: "colaborador1@escritorio.com.br",
      password: "senha-errada",
    });

    expect(resultado).toBeNull();
  });

  it("callback jwt copia id e role para o token; callback session copia id e role para session.user", async () => {
    const { authConfig } = await import("@/auth.config");

    const user = {
      id: "user_1",
      name: "Colaborador 1",
      email: "colaborador1@escritorio.com.br",
      role: "COLABORADOR" as const,
    };

    const token = await authConfig.callbacks!.jwt!({
      token: {},
      user,
    } as never);

    expect(token).toMatchObject({ id: "user_1", role: "COLABORADOR" });

    const session = await authConfig.callbacks!.session!({
      session: { user: {}, expires: "" },
      token,
    } as never);

    expect(session.user).toMatchObject({ id: "user_1", role: "COLABORADOR" });
  });
});
