import { db } from "@/lib/db";
import { withTarefaScope, type SessionUser } from "@/lib/visibility-scope";

/**
 * Campos retornados para listagem/detalhe de tarefa.
 *
 * CRÍTICO: `select` explícito — NUNCA inclui `senhaHash` em nenhum nível.
 * Relações de usuário sempre usam `select: { id: true, nome: true }`,
 * jamais `responsavel: true` (que traria todos os campos incluindo a senha).
 */
const TAREFA_SELECT = {
  id: true,
  titulo: true,
  descricao: true,
  prazo: true,
  status: true,
  createdAt: true,
  empresaId: true,
  responsavelId: true,
  empresa: {
    select: {
      id: true,
      nome: true,
      cnpj: true,
      regimeTributario: true,
      particularidades: true,
      responsavel: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
  },
  responsavel: {
    select: {
      id: true,
      nome: true,
    },
  },
  historico: {
    select: {
      id: true,
      concluidoEm: true,
      concluidoPor: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
    orderBy: { concluidoEm: "desc" as const },
    take: 5,
  },
} as const;

/**
 * Lista tarefas visíveis para o usuário autenticado.
 *
 * CRITICAL (AUTH-02 / T-02-IDOR): SEMPRE espalha withTarefaScope(user) no
 * `where` — dono recebe `{}` (todas as tarefas), colaborador recebe
 * `{ responsavelId: user.id }`. Nunca chamar `db.tarefa.findMany` sem este
 * escopo.
 */
export async function listarTarefas(user: SessionUser) {
  return db.tarefa.findMany({
    where: {
      ...withTarefaScope(user),
    },
    orderBy: { prazo: "asc" },
    select: TAREFA_SELECT,
  });
}

/**
 * Busca uma tarefa por id, restrita ao escopo de visibilidade do usuário.
 *
 * CRITICAL (AUTH-02 / T-02-IDOR): combina `id` com withTarefaScope(user) no
 * `where` via `findFirst`. Se a tarefa existir mas estiver fora do escopo do
 * colaborador, retorna `null` — o chamador deve tratar como "não encontrado"
 * (nunca "403 proibido"), evitando confirmar a existência de tarefas de
 * outros colaboradores (IDOR).
 *
 * NUNCA usar `findUnique` aqui — `findUnique` não aceita filtros compostos
 * de escopo junto com o id sem workarounds, e não implementa o anti-IDOR.
 */
export async function buscarTarefaPorId(user: SessionUser, id: string) {
  return db.tarefa.findFirst({
    where: {
      id,
      ...withTarefaScope(user),
    },
    select: TAREFA_SELECT,
  });
}

/**
 * Conta tarefas em alerta para o usuário: status PENDENTE com prazo nos
 * próximos 3 dias (inclui atrasadas, que também são <= agora+3d).
 *
 * Usada pelo badge de alertas no header/sidebar (per D-09).
 */
export async function contarAlertasTarefas(user: SessionUser): Promise<number> {
  return db.tarefa.count({
    where: {
      ...withTarefaScope(user),
      status: "PENDENTE",
      prazo: {
        lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    },
  });
}
