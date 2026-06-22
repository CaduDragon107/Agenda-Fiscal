import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { db } from "@/lib/db";
import { competenciaAtual } from "@/lib/competencia";

/**
 * src/modules/dashboards/queries.ts
 *
 * Camada de leitura pura dos 3 dashboards comparativos (DASH-01/02/03).
 * Defesa em profundidade: este módulo não checa role internamente — o gate
 * DONO-only é responsabilidade do Server Component que chama estas funções
 * (Plan 04-04), exatamente como gerarTarefasDoMesAction já faz para Fase 3.
 *
 * CRÍTICO (D-05): competências FECHADAS são lidas exclusivamente de
 * db.desempenhoMensal — NUNCA recalculadas via db.tarefa/TarefaHistorico,
 * mesmo que dados históricos sejam editados retroativamente. Apenas o mês
 * corrente (ainda em andamento, sem snapshot) é calculado on-the-fly.
 *
 * CRÍTICO (continuidade live→frozen): o ponto live do mês corrente usa
 * EXATAMENTE o mesmo critério de população do snapshot da Plan 04-02 —
 * filtro por TarefaHistorico.concluidoEm dentro do range do mês (nunca por
 * Tarefa.competencia) — para que não haja um degrau visível no gráfico de
 * evolução mensal quando o mês corrente vira mês fechado.
 */

type DesempenhoColaborador = {
  colaboradorId: string;
  nome: string;
  percentualNoPrazo: number;
  totalConcluidas: number;
  totalEmpresas: number;
};

/**
 * Calcula o desempenho por colaborador do mês corrente (live), nunca
 * persistido (D-05 reserva o congelamento para meses fechados, Plan 04-02).
 *
 * D-01: "no prazo" = TarefaHistorico.concluidoEm <= Tarefa.prazo.
 * D-02: apenas tarefas CONCLUIDA entram no cálculo — PENDENTE fica fora do
 * denominador (mesmo que já vencida).
 * D-03: o volume absoluto (nº de empresas na carteira, nº de tarefas
 * concluídas) acompanha o percentual como contexto, nunca ocultado.
 *
 * RETORNO: SEMPRE um array de objetos planos e serializáveis — NUNCA um Map.
 * Maps não atravessam o boundary Server→Client (Plan 04-04/04-05).
 */
export async function listarDesempenhoColaboradoresMesAtual(
  mes: Date
): Promise<DesempenhoColaborador[]> {
  const inicio = startOfMonth(mes);
  const fim = endOfMonth(mes);

  // 1 query: todas as CONCLUIDA cujo concluidoEm cai no range do mês — mesmo
  // critério de população do snapshot da Plan 04-02 (não filtra por
  // Tarefa.competencia, incluindo avulsas).
  const concluidas = await db.tarefa.findMany({
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

  // agregação em memória (estrutura de trabalho) — NUNCA o valor de retorno.
  const porColaborador = new Map<
    string,
    { totalConcluidas: number; noPrazo: number }
  >();
  for (const t of concluidas) {
    const concluidoEm = t.historico[0]?.concluidoEm;
    if (!concluidoEm) continue; // defensivo: CONCLUIDA sempre tem histórico
    const atual =
      porColaborador.get(t.responsavelId) ?? { totalConcluidas: 0, noPrazo: 0 };
    atual.totalConcluidas += 1;
    if (concluidoEm <= t.prazo) atual.noPrazo += 1; // D-01
    porColaborador.set(t.responsavelId, atual);
  }

  // contexto D-03: tamanho de carteira (nº de empresas ativas) por colaborador
  const carteiras = await db.empresa.groupBy({
    by: ["responsavelId"],
    where: { ativo: true },
    _count: { id: true },
  });
  const carteiraPorColaborador = new Map(
    carteiras.map((c) => [c.responsavelId, c._count.id])
  );

  // nomes dos colaboradores presentes (concluídas OU com carteira) — select
  // explícito, nunca relação crua (T-04-LEAK2).
  const colaboradorIds = new Set<string>([
    ...porColaborador.keys(),
    ...carteiraPorColaborador.keys(),
  ]);
  const colaboradores = await db.usuario.findMany({
    where: { id: { in: [...colaboradorIds] } },
    select: { id: true, nome: true },
  });

  // CONVERSÃO para array de objetos planos — NUNCA retornar o Map de trabalho.
  return colaboradores.map((c) => {
    const dados = porColaborador.get(c.id) ?? { totalConcluidas: 0, noPrazo: 0 };
    return {
      colaboradorId: c.id,
      nome: c.nome,
      percentualNoPrazo: dados.totalConcluidas
        ? Math.round((dados.noPrazo / dados.totalConcluidas) * 100)
        : 0,
      totalConcluidas: dados.totalConcluidas,
      totalEmpresas: carteiraPorColaborador.get(c.id) ?? 0,
    };
  });
}

type PontoEvolucao = {
  competencia: string;
  percentual: number;
  totalCriadas: number;
  totalConcluidasNoPeriodo: number;
  totalPendentesSemMotivo: number;
  totalPendentesComMotivo: number;
  totalVencidas: number;
};

type CategoriasCriadas = {
  totalCriadas: number;
  totalConcluidasNoPeriodo: number;
  totalPendentesSemMotivo: number;
  totalPendentesComMotivo: number;
  totalVencidas: number;
};

/**
 * Calcula as 5 categorias da populacao PARALELA "criadas" (quick task
 * 260622-lty, DASH-02) para um mes de referencia, agregadas para a equipe
 * inteira (sem quebra por colaborador — usado apenas para o ponto LIVE do
 * gráfico de evolucao mensal).
 *
 * CRITICO: replica EXATAMENTE a mesma definicao de populacao usada em
 * `calcularSnapshotMensal` (src/modules/dashboards/snapshot.ts) — recorrentes
 * filtradas por `Tarefa.competencia` igual ao mes-alvo; avulsas
 * (`competencia=null`) filtradas por `createdAt` no range
 * [startOfMonth, endOfMonth] do mes-alvo. Isso garante continuidade
 * live→frozen sem degrau visivel no gráfico quando o mes corrente vira mes
 * fechado (mesmo padrao de `listarDesempenhoColaboradoresMesAtual` acima).
 */
async function calcularCategoriasCriadas(
  mes: Date,
  competencia: string
): Promise<CategoriasCriadas> {
  const inicio = startOfMonth(mes);
  const fim = endOfMonth(mes);
  const agora = new Date();

  const tarefas = await db.tarefa.findMany({
    where: {
      OR: [
        { competencia },
        { competencia: null, createdAt: { gte: inicio, lte: fim } },
      ],
    },
    select: {
      status: true,
      motivoPendencia: true,
      prazo: true,
    },
  });

  const totais: CategoriasCriadas = {
    totalCriadas: 0,
    totalConcluidasNoPeriodo: 0,
    totalPendentesSemMotivo: 0,
    totalPendentesComMotivo: 0,
    totalVencidas: 0,
  };

  for (const t of tarefas) {
    totais.totalCriadas += 1;
    if (t.status === "CONCLUIDA") {
      totais.totalConcluidasNoPeriodo += 1;
    } else if (t.status === "PENDENTE") {
      if (t.motivoPendencia == null) {
        totais.totalPendentesSemMotivo += 1;
      } else {
        totais.totalPendentesComMotivo += 1;
      }
      if (t.prazo < agora) {
        totais.totalVencidas += 1; // lente de urgencia, nao particao exclusiva
      }
    }
  }

  return totais;
}

/**
 * Evolução mensal de desempenho (DASH-02): mistura competências FECHADAS,
 * lidas exclusivamente de db.desempenhoMensal (D-05, nunca recalculadas via
 * Tarefa/TarefaHistorico), com 1 ponto LIVE do mês corrente (mesmo critério
 * concluidoEm-no-range do snapshot da Plan 04-02, para continuidade
 * live→frozen sem degrau visível no gráfico).
 *
 * Default quantidadeMeses=3 (últimos 3 meses, incluindo o corrente) — Open
 * Question 2 do RESEARCH.md, resolvida como "últimos 3 meses".
 */
export async function listarEvolucaoMensal(
  quantidadeMeses = 3
): Promise<PontoEvolucao[]> {
  const mesAtual = competenciaAtual();
  const competenciasFechadas = Array.from(
    { length: Math.max(quantidadeMeses - 1, 0) },
    (_, i) => format(subMonths(new Date(), i + 1), "yyyy-MM")
  ).reverse();

  // competências fechadas: UMA query agregada em db.desempenhoMensal — NUNCA
  // db.tarefa para essas competências (D-05). _sum inclui os 5 campos novos
  // da populacao "criadas" (quick task 260622-lty, DASH-02).
  const snapshots =
    competenciasFechadas.length > 0
      ? await db.desempenhoMensal.groupBy({
          by: ["competencia"],
          where: { competencia: { in: competenciasFechadas } },
          _sum: {
            totalConcluidas: true,
            concluidasNoPrazo: true,
            totalCriadas: true,
            totalConcluidasNoPeriodo: true,
            totalPendentesSemMotivo: true,
            totalPendentesComMotivo: true,
            totalVencidas: true,
          },
        })
      : [];

  const pontosFechados: PontoEvolucao[] = competenciasFechadas.map((c) => {
    const s = snapshots.find((s) => s.competencia === c);
    const total = s?._sum.totalConcluidas ?? 0;
    const noPrazo = s?._sum.concluidasNoPrazo ?? 0;
    return {
      competencia: c,
      percentual: total ? Math.round((noPrazo / total) * 100) : 0,
      // default 0 quando snapshot ausente (meses congelados antigos, antes
      // da migracao dos 5 campos novos).
      totalCriadas: s?._sum.totalCriadas ?? 0,
      totalConcluidasNoPeriodo: s?._sum.totalConcluidasNoPeriodo ?? 0,
      totalPendentesSemMotivo: s?._sum.totalPendentesSemMotivo ?? 0,
      totalPendentesComMotivo: s?._sum.totalPendentesComMotivo ?? 0,
      totalVencidas: s?._sum.totalVencidas ?? 0,
    };
  });

  // 1 ponto live: mês corrente, NUNCA persistido (D-05), mesmo critério de
  // população do snapshot (concluidoEm-no-range) para `percentual`, e mesma
  // populacao "criadas" (calcularCategoriasCriadas) para os 5 novos campos —
  // garantindo continuidade live→frozen sem degrau no boundary.
  const colaboradores = await listarDesempenhoColaboradoresMesAtual(new Date());
  const totalAtual = colaboradores.reduce(
    (acc, c) => ({
      total: acc.total + c.totalConcluidas,
      noPrazo:
        acc.noPrazo +
        Math.round((c.percentualNoPrazo / 100) * c.totalConcluidas),
    }),
    { total: 0, noPrazo: 0 }
  );
  const categoriasCriadasAtual = await calcularCategoriasCriadas(
    new Date(),
    mesAtual
  );
  const pontoAtual: PontoEvolucao = {
    competencia: mesAtual,
    percentual: totalAtual.total
      ? Math.round((totalAtual.noPrazo / totalAtual.total) * 100)
      : 0,
    ...categoriasCriadasAtual,
  };

  return [...pontosFechados, pontoAtual];
}

type RankingEmpresa = {
  empresaId: string;
  nome: string;
  percentualAtraso: number;
  totalTarefas: number;
};

/**
 * Ranking de empresas por % de atraso (DASH-03), SEMPRE live (sem snapshot
 * em v1 — RESEARCH.md Open Question 1 / A1: D-06's regra PENDENTE-inclusiva
 * é incompatível com semântica de "mês fechado").
 *
 * D-06 (regra DISTINTA de D-02 — propositalmente não compartilhada): uma
 * tarefa é "atrasada" quando:
 *   - CONCLUIDA com concluidoEm > prazo, OU
 *   - PENDENTE com prazo < now() (Claude's Discretion: vencida a partir do
 *     momento em que o prazo passa, sem confirmação adicional necessária)
 *
 * Período padrão (documentado aqui, não hardcoded): o consumidor (Plan
 * 04-04) deve passar como default os "últimos 3 meses" — Open Question 2 do
 * RESEARCH.md. Esta função permanece parametrizada (periodoInicio/Fim
 * explícitos) para manter a troca de período barata sem mudança de schema.
 */
export async function listarRankingEmpresas(
  periodoInicio: Date,
  periodoFim: Date
): Promise<RankingEmpresa[]> {
  const tarefas = await db.tarefa.findMany({
    where: {
      prazo: { gte: periodoInicio, lte: periodoFim },
    },
    select: {
      empresaId: true,
      empresa: { select: { nome: true } },
      status: true,
      prazo: true,
      historico: {
        select: { concluidoEm: true },
        orderBy: { concluidoEm: "desc" },
        take: 1,
      },
    },
  });

  const agora = new Date();
  const porEmpresa = new Map<
    string,
    { nome: string; total: number; atrasadas: number }
  >();

  for (const t of tarefas) {
    const atual =
      porEmpresa.get(t.empresaId) ?? {
        nome: t.empresa.nome,
        total: 0,
        atrasadas: 0,
      };
    atual.total += 1;

    const concluidoEm = t.historico[0]?.concluidoEm;
    // D-06 — regra deliberadamente distinta de D-01/D-02 (colaborador):
    // PENDENTE com prazo vencido também conta como atrasada aqui.
    const atrasada =
      (t.status === "CONCLUIDA" &&
        concluidoEm !== undefined &&
        concluidoEm > t.prazo) ||
      (t.status === "PENDENTE" && t.prazo < agora);

    if (atrasada) atual.atrasadas += 1;
    porEmpresa.set(t.empresaId, atual);
  }

  return [...porEmpresa.entries()]
    .map(([empresaId, v]) => ({
      empresaId,
      nome: v.nome,
      percentualAtraso: v.total ? Math.round((v.atrasadas / v.total) * 100) : 0,
      totalTarefas: v.total,
    }))
    .sort((a, b) => b.percentualAtraso - a.percentualAtraso);
}
