/**
 * src/modules/dashboards/snapshot.ts
 *
 * Agregação pura-ish (lê via `tx`, nunca escreve) que calcula o snapshot de
 * desempenho mensal por colaborador para uma competência-alvo, a ser
 * persistido em `DesempenhoMensal` por `executarGeracaoMensal` (D-04).
 *
 * CRÍTICO (T-04-SKEW / Blocker 1 do plan-checker): a população de tarefas é
 * filtrada por `TarefaHistorico.concluidoEm` dentro do range
 * [startOfMonth, endOfMonth] da competência-alvo — NUNCA por
 * `Tarefa.competencia`. Filtrar por `Tarefa.competencia` excluiria
 * sistematicamente as tarefas avulsas (competencia = null), divergindo da
 * query live `listarDesempenhoColaboradoresMesAtual` (Plan 04-03) e
 * produzindo um degrau visível no gráfico de evolução exatamente no
 * boundary live→frozen. A competência-alvo recebida serve APENAS como
 * rótulo da linha gravada e como base para derivar o range de datas.
 *
 * Usa `Tarefa.responsavelId` (fixado na criação da tarefa), nunca
 * `Empresa.responsavelId` — evita drift por reatribuição de empresa após o
 * fato (Pitfall 3 do RESEARCH.md).
 *
 * Esta função NUNCA chama `withTarefaScope`/`withVisibilityScope` — o cron
 * não tem usuário autenticado (mesmo padrão D-09/D-12 de geracao.ts).
 *
 * `select` é sempre explícito em qualquer relação de Usuario — NUNCA
 * `responsavel: true`/`colaborador: true`, que vazariam `senhaHash`.
 */

import { endOfMonth, startOfMonth } from "date-fns";
import type { Prisma } from "@prisma/client";

/**
 * Converte uma competência "YYYY-MM" num Date local no dia 1 desse mês.
 *
 * CRÍTICO: `new Date("YYYY-MM-01")` é interpretado pelo motor JS como
 * meia-noite UTC (formato ISO 8601 date-only) — em fusos horários negativos
 * (ex.: GMT-03:00, Brasil), isso renderiza como o ÚLTIMO DIA DO MÊS ANTERIOR
 * em horário local, deslocando `startOfMonth`/`endOfMonth` (date-fns, que
 * operam em horário local) um mês inteiro para trás. Construir o Date via
 * `new Date(ano, mesIndex, 1)` (construtor de 3 argumentos, sempre local)
 * evita esse off-by-one independente do fuso horário da máquina.
 */
function competenciaParaDataLocal(competencia: string): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  return new Date(ano, mes - 1, 1);
}

export type LinhaSnapshotMensal = {
  competencia: string;
  colaboradorId: string;
  totalConcluidas: number;
  concluidasNoPrazo: number;
  totalEmpresas: number;
  totalTarefasPeriodo: number;
};

export async function calcularSnapshotMensal(
  tx: Prisma.TransactionClient,
  competencia: string
): Promise<LinhaSnapshotMensal[]> {
  const inicio = startOfMonth(competenciaParaDataLocal(competencia));
  const fim = endOfMonth(inicio);

  // 1 query: todas as tarefas cujo concluidoEm cai no range do mes-alvo,
  // independente de Tarefa.competencia (inclui avulsas, competencia=null).
  const tarefasNoPeriodo = await tx.tarefa.findMany({
    where: {
      status: "CONCLUIDA",
      historico: { some: { concluidoEm: { gte: inicio, lte: fim } } },
    },
    select: {
      responsavelId: true,
      prazo: true,
      historico: {
        select: { concluidoEm: true },
        where: { concluidoEm: { gte: inicio, lte: fim } },
        orderBy: { concluidoEm: "desc" },
        take: 1,
      },
    },
  });

  // Agregacao em memoria por colaborador (Tarefa.responsavelId, nunca
  // Empresa.responsavelId — Pitfall 3).
  const porColaborador = new Map<
    string,
    { totalConcluidas: number; concluidasNoPrazo: number; totalTarefasPeriodo: number }
  >();

  for (const t of tarefasNoPeriodo) {
    const concluidoEm = t.historico[0]?.concluidoEm;
    if (!concluidoEm) continue; // defensivo: CONCLUIDA sempre tem historico no range filtrado

    const atual =
      porColaborador.get(t.responsavelId) ??
      { totalConcluidas: 0, concluidasNoPrazo: 0, totalTarefasPeriodo: 0 };

    atual.totalConcluidas += 1;
    atual.totalTarefasPeriodo += 1; // mesma populacao filtrada por concluidoEm (D-03)
    if (concluidoEm <= t.prazo) {
      atual.concluidasNoPrazo += 1; // D-01/D-02
    }

    porColaborador.set(t.responsavelId, atual);
  }

  // Contexto D-03: tamanho de carteira (numero de empresas ativas) por
  // colaborador, mesma convencao de Pattern 2 do RESEARCH.md.
  const carteiras = await tx.empresa.groupBy({
    by: ["responsavelId"],
    where: { ativo: true },
    _count: { id: true },
  });
  const totalEmpresasPorColaborador = new Map<string, number>(
    carteiras.map((c) => [c.responsavelId, c._count.id])
  );

  return Array.from(porColaborador.entries()).map(([colaboradorId, dados]) => ({
    competencia,
    colaboradorId,
    totalConcluidas: dados.totalConcluidas,
    concluidasNoPrazo: dados.concluidasNoPrazo,
    totalEmpresas: totalEmpresasPorColaborador.get(colaboradorId) ?? 0,
    totalTarefasPeriodo: dados.totalTarefasPeriodo,
  }));
}
