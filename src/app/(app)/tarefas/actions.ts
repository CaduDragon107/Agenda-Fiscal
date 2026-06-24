"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { tarefaSchema } from "@/modules/tarefas/schema";
import { withTarefaScope, withVisibilityScope } from "@/lib/visibility-scope";
import { executarGeracaoMensal } from "@/modules/tarefas/geracao";
import { competenciaAtual, competenciaSchema } from "@/lib/competencia";

/**
 * Resultado da geração manual de tarefas do mês.
 */
export type AcaoGeracaoResult =
  | {
      ok: true;
      criadas: number;
      puladas: number;
      semResponsavelDp: { empresaId: string; nome: string }[];
      semResponsavelContabil: { empresaId: string; nome: string }[];
    }
  | { ok: false; error: string };

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
 * - Verificação de propriedade da empresa (anti-IDOR para create):
 *   COLABORADOR só pode criar tarefas para empresas das quais é responsável.
 * - COLABORADOR só pode se atribuir como responsável (não pode atribuir a outros).
 * - DONO pode criar tarefas para qualquer empresa e atribuir a qualquer usuário.
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

  // Anti-IDOR para create: verificar que a empresa está dentro do escopo de
  // visibilidade do usuário autenticado. COLABORADOR só pode criar tarefas
  // para empresas das quais é responsável (withVisibilityScope retorna
  // { responsavelId: user.id } para COLABORADOR). DONO pode criar para
  // qualquer empresa (withVisibilityScope retorna {}).
  const empresaAutorizada = await db.empresa.findFirst({
    where: { id: dados.empresaId, ...withVisibilityScope(session.user) },
    select: { id: true },
  });
  if (!empresaAutorizada) {
    return { ok: false, error: "não encontrado" };
  }

  // COLABORADOR só pode se atribuir como responsável — não pode atribuir
  // tarefas a outros usuários. DONO pode atribuir livremente.
  if (
    session.user.role === "COLABORADOR" &&
    dados.responsavelId !== session.user.id
  ) {
    return { ok: false, error: "não autorizado" };
  }

  try {
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
  } catch {
    return { ok: false, error: "Erro ao criar tarefa. Tente novamente." };
  }
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

  try {
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
  } catch {
    return { ok: false, error: "Erro ao concluir tarefa. Tente novamente." };
  }

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

  try {
    await db.tarefa.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Erro ao excluir tarefa. Tente novamente." };
  }

  revalidatePath("/tarefas");
  return { ok: true };
}

/**
 * Salva (ou limpa) o motivo de pendência de uma tarefa.
 *
 * CRÍTICO (T-02-IDOR): mesmo padrão de concluirTarefa/excluirTarefa —
 * findFirst escopado via withTarefaScope ANTES de qualquer write; se a
 * tarefa não existir ou estiver fora do escopo do usuário, retorna
 * "não encontrado" (nunca 403).
 *
 * Regra de negócio (alinhada a D-05): o motivo só pode ser editado enquanto
 * a tarefa está PENDENTE — uma vez CONCLUIDA, o motivo se torna somente
 * leitura na UI, e a action recusa a escrita mesmo se chamada diretamente.
 *
 * Normaliza a entrada com trim(); string vazia é gravada como null para
 * manter o campo limpo. Limite defensivo de 1000 caracteres.
 */
export async function salvarMotivoPendencia(
  id: string,
  motivo: string
): Promise<AcaoTarefaResult> {
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

  if (existente.status === "CONCLUIDA") {
    return { ok: false, error: "Tarefa concluída não pode ter o motivo alterado." };
  }

  const valor = motivo.trim();
  if (valor.length > 1000) {
    return { ok: false, error: "Motivo muito longo (máximo 1000 caracteres)." };
  }
  const valorFinal = valor.length === 0 ? null : valor;

  try {
    await db.tarefa.update({
      where: { id },
      data: { motivoPendencia: valorFinal },
    });
  } catch {
    return { ok: false, error: "Erro ao salvar o motivo. Tente novamente." };
  }

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${id}`);
  return { ok: true };
}

/**
 * Dispara manualmente a geração mensal de tarefas (D-08, fallback caso o
 * cron falhe ou seja necessário acionar antes do dia 1).
 *
 * CRÍTICO (T-3-01, V4 Access Control): guard de role é o PRIMEIRO check
 * após `auth()`, ANTES de qualquer acesso ao banco — protege contra um
 * COLABORADOR chamando a action diretamente mesmo com o botão oculto
 * client-side (a UI escondendo o botão é só defesa em profundidade, nunca
 * a única barreira).
 *
 * CRÍTICO (T-3-05): guard de autenticação primeiro, mesmo padrão das
 * demais actions deste arquivo.
 *
 * CRÍTICO (T-3-06, V5 Pitfall 4): se uma competência for informada, é
 * validada com `competenciaSchema` antes de chegar em `executarGeracaoMensal`
 * — evita uma string não canônica (ex.: "2026-1") quebrar a idempotência
 * da constraint única. Sem argumento, usa `competenciaAtual()` (date-fns),
 * sempre canônica.
 *
 * Reusa a mesma `executarGeracaoMensal` chamada pelo cron (Plano 02) — a
 * idempotência via `createMany({ skipDuplicates: true })` garante que
 * disparar manualmente a mesma competência do cron não duplica tarefas.
 */
export async function gerarTarefasDoMesAction(
  competencia?: string
): Promise<AcaoGeracaoResult> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { ok: false, error: "Não autenticado" };
    }

    if (session.user.role !== "DONO") {
      return { ok: false, error: "não autorizado" };
    }

    let competenciaResolvida: string;
    if (competencia !== undefined) {
      const parsed = competenciaSchema.safeParse(competencia);
      if (!parsed.success) {
        return { ok: false, error: "Competência inválida." };
      }
      competenciaResolvida = parsed.data;
    } else {
      competenciaResolvida = competenciaAtual();
    }

    const { criadas, puladas, semResponsavelDp, semResponsavelContabil } =
      await executarGeracaoMensal(competenciaResolvida);
    revalidatePath("/tarefas");
    return { ok: true, criadas, puladas, semResponsavelDp, semResponsavelContabil };
  } catch {
    return { ok: false, error: "Erro ao gerar tarefas. Tente novamente." };
  }
}
