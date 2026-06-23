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
 *
 * NOTA (Plano 05-02, v2.0): `setor` adicionado ao shape `SessionUser`,
 * alinhado ao tipo `AppSetor` (src/types/next-auth.d.ts) e ao que
 * `withVisibilityScope`/`withTarefaScope` (src/lib/visibility-scope.ts)
 * agora exigem. Os mocks de colaborador existentes (mockColaboradorUser/
 * mockOtherColaboradorUser) default para "FISCAL" para preservar o
 * comportamento dos testes de regressão pré-v2.0 sem editá-los.
 */

export type SessionRole = "COLABORADOR" | "DONO";
export type SessionSetor = "FISCAL" | "DP" | "CONTABIL" | null;

export type SessionUser = {
  id: string;
  nome: string;
  email: string;
  role: SessionRole;
  setor: SessionSetor;
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
    setor: null,
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
    setor: "FISCAL",
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
    setor: "FISCAL",
    ...overrides,
  };
}

/**
 * Cria um usuário "colaborador" mockado do setor DP (v2.0).
 */
export function mockDpColaboradorUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "user_dp_1",
    nome: "DP1",
    email: "dp1@escritorio.com.br",
    role: "COLABORADOR",
    setor: "DP",
    ...overrides,
  };
}

/**
 * Cria um usuário "colaborador" mockado do setor Contábil (v2.0).
 */
export function mockContabilColaboradorUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "user_contabil_1",
    nome: "Contabil1",
    email: "contabil1@escritorio.com.br",
    role: "COLABORADOR",
    setor: "CONTABIL",
    ...overrides,
  };
}
