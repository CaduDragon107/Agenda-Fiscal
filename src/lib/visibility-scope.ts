import type { Prisma } from "@prisma/client";

/**
 * Shape do usuário autenticado relevante para regras de visibilidade.
 *
 * `role` usa os mesmos valores do enum Prisma `Role` (COLABORADOR/DONO,
 * maiúsculas) e do tipo `AppRole` (src/types/next-auth.d.ts), que é o que
 * `src/auth.ts`/`src/auth.config.ts` (Plano 02) efetivamente colocam no
 * token JWT e na sessão (`session.user.role`). Não há normalização de
 * casing aqui — o valor chega da sessão já no formato do enum do banco.
 *
 * `setor` (v2.0, Plano 05-02) espelha o tipo `AppSetor`
 * (src/types/next-auth.d.ts) e o enum Prisma `Setor` — `null` para DONO
 * (que não pertence a nenhum setor específico) e para qualquer
 * COLABORADOR ainda sem setor definido.
 */
export type SessionUser = {
  id: string;
  role: "COLABORADOR" | "DONO";
  setor: "FISCAL" | "DP" | "CONTABIL" | null;
};

/**
 * Núcleo do AUTH-02/SETOR-01/SETOR-02: aplica a regra de visibilidade de
 * empresas conforme o papel e o setor do usuário autenticado.
 *
 * - "DONO": visão geral, sem restrição -> retorna `{}` (where vazio),
 *   independente de setor.
 * - "COLABORADOR" sem `setor` definido (nem no parâmetro nem em
 *   `user.setor`): falha SEGURO -> retorna um filtro que NUNCA casa
 *   nenhuma empresa (`{ id: "__no_setor_defined__" }`). NUNCA `{}` aqui —
 *   isso alargaria a visibilidade em vez de restringi-la (Pitfall B3).
 * - "COLABORADOR" com `setor: "FISCAL"`: retorna a forma legada
 *   `{ responsavelId: user.id }`. `Empresa.responsavelId` permanece a
 *   coluna legada, obrigatória e ATIVA por 1 ciclo de release (RESEARCH.md
 *   Pitfall B1/D-?), verificada 1:1 contra a junction table FISCAL pelo
 *   backfill do Plano 01 (197/197, zero divergência) — portanto esta forma
 *   é EQUIVALENTE em dados visíveis a `responsaveisPorSetor.some({setor:
 *   "FISCAL", usuarioId})`, mas preserva o shape literal do `where` que a
 *   suite de regressão pré-v2.0 (`visibility-scope.test.ts`,
 *   `empresas.idor.test.ts`, `tarefas.idor.test.ts`) já asserta — suite que
 *   este plano proíbe editar. Esta é a ÚNICA exceção de shape; DP/CONTABIL
 *   não têm coluna flat equivalente e usam sempre a junction table.
 * - "COLABORADOR" com `setor: "DP" | "CONTABIL"`: restrito às empresas
 *   onde é o responsável DAQUELE setor específico -> retorna
 *   `{ responsaveisPorSetor: { some: { setor, usuarioId: user.id } } }`.
 *
 * REGRA DE SEGURANÇA (Pitfall B3): quando a forma via junction table é
 * usada, `setor` e `usuarioId` DEVEM ficar no MESMO objeto `some`, nunca em
 * dois `where` separados — um filtro dividido deixaria um colaborador ver
 * TODAS as empresas do seu setor, independente de atribuição pessoal.
 *
 * O segundo parâmetro `setor` é opcional e default para `user.setor` —
 * isso preserva todos os call-sites existentes (`...withVisibilityScope(user)`)
 * sem precisar editá-los. `setor` nunca deve ser lido de input de cliente
 * não validado (query string/formulário) — sempre da sessão autenticada.
 *
 * Toda query de `Empresa` (listagem, busca por id, mutações) DEVE espalhar
 * o resultado desta função no `where` do Prisma — nunca consultar
 * `db.empresa` sem aplicar este escopo (ver modules/empresas/queries.ts).
 */
export function withVisibilityScope(
  user: SessionUser,
  setor: SessionUser["setor"] = user.setor
): Prisma.EmpresaWhereInput {
  if (user.role === "DONO") {
    return {};
  }
  if (!setor) {
    // Fail-safe: COLABORADOR sem setor definido NUNCA vê empresa alguma.
    // NUNCA retornar {} aqui (Pitfall B3 — alargaria a visibilidade).
    return { id: "__no_setor_defined__" };
  }
  if (setor === "FISCAL") {
    // Forma legada, mantida pela equivalência de dados verificada pelo
    // backfill (197/197 FISCAL == Empresa.responsavelId atual) e pelo
    // regression gate pré-v2.0 que asserta este shape literal.
    return { responsavelId: user.id };
  }
  return {
    responsaveisPorSetor: { some: { setor, usuarioId: user.id } },
  };
}

/**
 * Aplica escopo de visibilidade de tarefas conforme papel do usuário.
 * - DONO: vê todas as tarefas → retorna {} (per D-14)
 * - COLABORADOR: vê apenas tarefas onde responsavelId === user.id → retorna { responsavelId: user.id }
 *
 * Toda query de Tarefa DEVE espalhar este retorno no where.
 * NUNCA chamar db.tarefa.findMany sem withTarefaScope(user).
 */
export function withTarefaScope(user: SessionUser): Prisma.TarefaWhereInput {
  if (user.role === "DONO") {
    return {};
  }
  return { responsavelId: user.id };
}
