/**
 * tests/setup.ts
 *
 * Helpers compartilhados para testes de autenticação, escopo de visibilidade
 * (withVisibilityScope) e IDOR. Não conecta a um banco real — fornece apenas
 * os shapes de "usuário de sessão" usados pelos testes RED (stubs) desta fase
 * e pelas implementações reais das fases seguintes.
 */

export type SessionRole = "colaborador" | "dono";

export type SessionUser = {
  id: string;
  nome: string;
  email: string;
  role: SessionRole;
};

/**
 * Cria um usuário "dono" mockado (visão geral, sem restrição de escopo).
 */
export function mockDonoUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "user_dono_1",
    nome: "Dono do Escritório",
    email: "dono@escritorio.com.br",
    role: "dono",
    ...overrides,
  };
}

/**
 * Cria um usuário "colaborador" mockado (escopo restrito a responsavelId).
 */
export function mockColaboradorUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "user_colaborador_1",
    nome: "Colaborador 1",
    email: "colaborador1@escritorio.com.br",
    role: "colaborador",
    ...overrides,
  };
}

/**
 * Cria uma segunda persona de colaborador, útil para testes de IDOR
 * (Colaborador A não deve acessar dados de Colaborador B).
 */
export function mockOtherColaboradorUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "user_colaborador_2",
    nome: "Colaborador 2",
    email: "colaborador2@escritorio.com.br",
    role: "colaborador",
    ...overrides,
  };
}
