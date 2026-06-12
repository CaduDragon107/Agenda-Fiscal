import type { Prisma } from "@prisma/client";

/**
 * Shape do usuário autenticado relevante para regras de visibilidade.
 *
 * `role` usa os mesmos valores do enum Prisma `Role` (COLABORADOR/DONO,
 * maiúsculas) e do tipo `AppRole` (src/types/next-auth.d.ts), que é o que
 * `src/auth.ts`/`src/auth.config.ts` (Plano 02) efetivamente colocam no
 * token JWT e na sessão (`session.user.role`). Não há normalização de
 * casing aqui — o valor chega da sessão já no formato do enum do banco.
 */
export type SessionUser = {
  id: string;
  role: "COLABORADOR" | "DONO";
};

/**
 * Núcleo do AUTH-02: aplica a regra de visibilidade de empresas conforme o
 * papel do usuário autenticado.
 *
 * - "DONO": visão geral, sem restrição -> retorna `{}` (where vazio).
 * - "COLABORADOR": restrito às empresas das quais é responsável -> retorna
 *   `{ responsavelId: user.id }`.
 *
 * Toda query de `Empresa` (listagem, busca por id, mutações) DEVE espalhar
 * o resultado desta função no `where` do Prisma — nunca consultar
 * `db.empresa` sem aplicar este escopo (ver modules/empresas/queries.ts).
 */
export function withVisibilityScope(
  user: SessionUser
): Prisma.EmpresaWhereInput {
  if (user.role === "DONO") {
    return {};
  }
  return { responsavelId: user.id };
}
