/**
 * tests/setup.ts
 *
 * Helpers compartilhados para testes de autenticação, escopo de visibilidade
 * (withVisibilityScope) e IDOR. Não conecta a um banco real — fornece apenas
 * os shapes de "usuário de sessão" usados pelos testes RED (stubs) desta fase
 * e pelas implementações reais das fases seguintes.
 *
 * NOTA (Plano 03): `role` usa os mesmos valores do enum Prisma `Role`
 * (COLABORADOR/DONO, maiúsculas) e do tipo `AppRole` em
 * `src/types/next-auth.d.ts` — alinhado ao que `auth.ts` (Plano 02)
 * efetivamente coloca no token/sessão JWT. Antes (Plano 01) os mocks usavam
 * "colaborador"/"dono" minúsculos, inconsistente com o contrato real de
 * sessão definido no Plano 02.
 */

export type SessionRole = "COLABORADOR" | "DONO";

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
    role: "DONO",
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
    role: "COLABORADOR",
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
    role: "COLABORADOR",
    ...overrides,
  };
}
