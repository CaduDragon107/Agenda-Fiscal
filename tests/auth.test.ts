import { describe, it, expect } from "vitest";

/**
 * tests/auth.test.ts
 *
 * Cobre AUTH-01: login com email/senha via Auth.js v5 Credentials Provider.
 * - Login com email/senha corretos retorna sessão válida (com role exposto).
 * - Login com credenciais erradas retorna erro genérico
 *   ("Email ou senha incorretos"), sem revelar se o problema foi o email
 *   ou a senha (anti-enumeração de usuários).
 * - Sessão persiste via cookie JWT httpOnly/secure com maxAge configurado.
 *
 * Implementação real (src/auth.ts + Credentials Provider) chega no Plano 02.
 */

describe("autenticação (Credentials Provider)", () => {
  it("login com email/senha corretos retorna sessão com role do usuário", () => {
    expect.fail("TODO: implementado no Plano 02 (src/auth.ts -> Credentials Provider)");
  });

  it("login com email ou senha incorretos retorna erro genérico 'Email ou senha incorretos'", () => {
    expect.fail("TODO: implementado no Plano 02 (src/auth.ts -> Credentials Provider)");
  });

  it("sessão JWT é configurada com maxAge (cookie httpOnly/secure)", () => {
    expect.fail("TODO: implementado no Plano 02 (src/auth.ts -> session maxAge)");
  });
});
