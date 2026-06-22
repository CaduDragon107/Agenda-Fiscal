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
 *
 * NOVO (DASH-02/D-04): como primeiro passo da MESMA transação, congela o
 * snapshot de desempenho do mês imediatamente ANTERIOR à competência
 * recebida (`competenciaAnterior = subMonths(competencia, 1)`), via
 * `calcularSnapshotMensal` + `tx.desempenhoMensal.createMany({
 * skipDuplicates: true })`. O critério de população do snapshot é o mesmo
 * da leitura live (concluidoEm no range do mês, nunca Tarefa.competencia) —
 * garante continuidade live→frozen (D-05) sem degrau no boundary. Snapshot
 * e geração de tarefas sobem ou caem juntos (mesma `tx`, sem transação
 * separada).
 */

import { db } from "@/lib/db";
import { gerarTarefasDoMes } from "@/lib/geracao-tarefas";
import { calcularSnapshotMensal } from "@/modules/dashboards/snapshot";
import { format, subMonths } from "date-fns";

/**
 * Converte uma competência "YYYY-MM" num Date local no dia 1 desse mês.
 *
 * CRÍTICO: `new Date("YYYY-MM-01")` é interpretado como meia-noite UTC
 * (ISO 8601 date-only) — em fusos horários negativos (ex.: Brasil,
 * GMT-03:00), isso renderiza como o último dia do mês ANTERIOR em horário
 * local, deslocando `subMonths` um mês inteiro para trás (mesmo bug em
 * src/modules/dashboards/snapshot.ts). O construtor de 3 argumentos
 * (`new Date(ano, mesIndex, 1)`) é sempre interpretado em horário local,
 * eliminando esse off-by-one.
 */
function competenciaParaDataLocal(competencia: string): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  return new Date(ano, mes - 1, 1);
}

export async function executarGeracaoMensal(
  competencia: string
): Promise<{ criadas: number; puladas: number }> {
  return db.$transaction(async (tx) => {
    // Fecha o snapshot do mes ANTERIOR antes de gerar as tarefas do novo mes
    // (Pitfall 1 — competenciaAnterior, nunca a propria competencia recebida).
    const competenciaAnterior = format(
      subMonths(competenciaParaDataLocal(competencia), 1),
      "yyyy-MM"
    );
    const snapshots = await calcularSnapshotMensal(tx, competenciaAnterior);
    if (snapshots.length > 0) {
      await tx.desempenhoMensal.createMany({
        data: snapshots,
        skipDuplicates: true, // mesma defesa de D-10 (idempotencia via constraint)
      });
    }

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
