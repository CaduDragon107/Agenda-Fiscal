/**
 * src/modules/tarefas/geracao.ts
 *
 * Orquestração do motor de geração mensal: lê empresas ATIVAS direto de
 * `Empresa` (D-12 — regime ATUAL, nunca via `empresaRegimeHistorico`),
 * delega o cálculo puro a `gerarTarefasDoMes` (Plano 01), e persiste via
 * `createMany({ skipDuplicates: true })` apoiado no índice
 * `@@unique([empresaId, tipoObrigacao, competencia])` (D-13) — a
 * idempotência mora na constraint do banco, não em pré-checagem de
 * aplicação (D-10, evita TOCTOU entre cron e gatilho manual). Retorna
 * `{ criadas, puladas }` (D-11) comparando o total gerado ao total
 * efetivamente inserido.
 *
 * CRÍTICO: esta função NUNCA chama `withTarefaScope`/`withVisibilityScope`
 * — o cron não tem usuário autenticado; lê todas as empresas ativas sem
 * escopo de visibilidade (D-09 já garante o `responsavelId` correto por
 * tarefa via `gerarTarefasDoMes`).
 */

import { db } from "@/lib/db";
import { gerarTarefasDoMes } from "@/lib/geracao-tarefas";

export async function executarGeracaoMensal(
  competencia: string
): Promise<{ criadas: number; puladas: number }> {
  return db.$transaction(async (tx) => {
    const empresas = await tx.empresa.findMany({
      where: { ativo: true },
      select: { id: true, regimeTributario: true, responsavelId: true },
    });

    const tarefas = gerarTarefasDoMes(empresas, competencia);

    if (tarefas.length === 0) {
      return { criadas: 0, puladas: 0 };
    }

    const resultado = await tx.tarefa.createMany({
      data: tarefas.map((t) => ({
        ...t,
        status: "PENDENTE" as const,
      })),
      skipDuplicates: true, // apoia-se em @@unique([empresaId, tipoObrigacao, competencia])
    });

    return {
      criadas: resultado.count,
      puladas: tarefas.length - resultado.count,
    };
  });
}
