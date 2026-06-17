"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tarefaSchema } from "@/modules/tarefas/schema";
import { withTarefaScope } from "@/lib/visibility-scope";

/**
 * Resultado padrão das Server Actions de Tarefa.
 *
 * Segue o mesmo padrão de AcaoEmpresaResult em src/app/(app)/actions.ts:
 * retorna { ok: true, id? } ou { ok: false, error } sem lançar exceções,
 * simplificando o tratamento client-side via toast.
 */
export type AcaoTarefaResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

/**
 * Cria uma nova tarefa avulsa.
 *
 * CRÍTICO (T-02-UNAUTH, T-02-INPUT):
 * - Guard de sessão como primeira instrução
 * - tarefaSchema.safeParse valida campos antes de qualquer escrita
 * - Zod + Prisma FK garantem integridade dos dados (empresaId, responsavelId
 *   precisam existir no banco — FK constraint rejeita se inválido)
 */
export async function criarTarefa(
  formData: FormData
): Promise<AcaoTarefaResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Não autenticado" };
  }

  const titulo = formData.get("titulo");
  const descricao = formData.get("descricao");
  const empresaId = formData.get("empresaId");
  const responsavelId = formData.get("responsavelId");
  const prazo = formData.get("prazo");

  const parsed = tarefaSchema.safeParse({
    titulo,
    descricao,
    empresaId,
    responsavelId,
    prazo,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Não foi possível criar a tarefa. Verifique os dados e tente novamente.",
    };
  }

  const dados = parsed.data;

  const tarefa = await db.tarefa.create({
    data: {
      titulo: dados.titulo,
      descricao: dados.descricao,
      empresaId: dados.empresaId,
      responsavelId: dados.responsavelId,
      prazo: dados.prazo,
      status: "PENDENTE",
    },
  });

  revalidatePath("/tarefas");
  return { ok: true, id: tarefa.id };
}

/**
 * Marca uma tarefa como concluída e registra no histórico.
 *
 * CRÍTICO (T-02-IDOR): Anti-IDOR obrigatório — findFirst escopado ANTES de
 * qualquer write. Se a tarefa não existir OU estiver fora do escopo do
 * usuário (colaborador tentando concluir tarefa de outro), retorna
 * "não encontrado" sem alterar nada.
 *
 * Idempotência: se já CONCLUIDA, retorna { ok: true } sem criar histórico
 * duplicado.
 *
 * Atomicidade (RESEARCH.md Open Question 1): db.$transaction garante que se
 * o create do histórico falhar, o status não fica como CONCLUIDA sem
 * registro.
 */
export async function concluirTarefa(id: string): Promise<AcaoTarefaResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Não autenticado" };
  }

  const existente = await db.tarefa.findFirst({
    where: { id, ...withTarefaScope(session.user) },
    select: { id: true, status: true },
  });

  if (!existente) {
    return { ok: false, error: "não encontrado" };
  }

  // Idempotência: não criar histórico duplicado se já concluída
  if (existente.status === "CONCLUIDA") {
    return { ok: true };
  }

  await db.$transaction([
    db.tarefa.update({
      where: { id },
      data: { status: "CONCLUIDA" },
    }),
    db.tarefaHistorico.create({
      data: {
        tarefaId: id,
        concluidoPorId: session.user.id,
        concluidoEm: new Date(),
      },
    }),
  ]);

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${id}`);
  return { ok: true };
}

/**
 * Exclui uma tarefa existente.
 *
 * CRÍTICO (T-02-IDOR): Anti-IDOR obrigatório — mesmo padrão de excluirEmpresa
 * em src/app/(app)/actions.ts: findFirst escopado ANTES do delete; retorna
 * "não encontrado" (nunca 403) se fora do escopo.
 *
 * TarefaHistorico é deletado em cascade (onDelete: Cascade no schema).
 */
export async function excluirTarefa(id: string): Promise<AcaoTarefaResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Não autenticado" };
  }

  const existente = await db.tarefa.findFirst({
    where: { id, ...withTarefaScope(session.user) },
    select: { id: true },
  });

  if (!existente) {
    return { ok: false, error: "não encontrado" };
  }

  await db.tarefa.delete({ where: { id } });

  revalidatePath("/tarefas");
  return { ok: true };
}
