import { db } from "@/lib/db";
import { withVisibilityScope, type SessionUser } from "@/lib/visibility-scope";

/**
 * Campos retornados para listagem/detalhe de empresa.
 *
 * `select` explícito — NUNCA inclui a relação `responsavel` com
 * `senhaHash` (esse campo só é lido em src/auth.ts, ver CRITICAL ali).
 * Caso o nome do responsável seja necessário na UI, expor apenas
 * `responsavel: { select: { id: true, nome: true } }`.
 */
const EMPRESA_SELECT = {
  id: true,
  nome: true,
  cnpj: true,
  regimeTributario: true,
  responsavelId: true,
  contatos: true,
  particularidades: true,
  ativo: true,
  createdAt: true,
  updatedAt: true,
  responsavel: {
    select: {
      id: true,
      nome: true,
    },
  },
} as const;

/**
 * Lista empresas visíveis para o usuário autenticado.
 *
 * CRITICAL (AUTH-02 / T-01-IDOR-SCOPE): SEMPRE espalha
 * withVisibilityScope(user) no `where` — dono recebe `{}` (todas as
 * empresas), colaborador recebe `{ responsavelId: user.id }`. Nunca chamar
 * `db.empresa.findMany` sem este escopo.
 */
export async function listarEmpresas(user: SessionUser) {
  return db.empresa.findMany({
    where: {
      ...withVisibilityScope(user),
    },
    orderBy: { nome: "asc" },
    select: EMPRESA_SELECT,
  });
}

/**
 * Busca uma empresa por id, restrita ao escopo de visibilidade do usuário.
 *
 * CRITICAL (AUTH-02 / T-01-IDOR-SCOPE): combina `id` com
 * withVisibilityScope(user) no `where` via `findFirst`. Se a empresa existir
 * mas estiver fora do escopo do colaborador, retorna `null` — o chamador
 * deve tratar isso como "não encontrado" (nunca "403 proibido"), evitando
 * confirmar a existência de empresas de outros colaboradores (IDOR).
 */
export async function buscarEmpresaPorId(user: SessionUser, id: string) {
  return db.empresa.findFirst({
    where: {
      id,
      ...withVisibilityScope(user),
    },
    select: EMPRESA_SELECT,
  });
}

/**
 * Lista os usuários elegíveis como "Responsável" de uma empresa (select do
 * formulário de criação/edição). Não tem escopo de visibilidade — qualquer
 * usuário autenticado pode atribuir qualquer colaborador/dono como
 * responsável de uma empresa dentro do seu próprio escopo de edição.
 *
 * `select` explícito — nunca inclui `senhaHash`.
 */
export async function listarResponsaveis() {
  return db.usuario.findMany({
    select: {
      id: true,
      nome: true,
    },
    orderBy: { nome: "asc" },
  });
}
