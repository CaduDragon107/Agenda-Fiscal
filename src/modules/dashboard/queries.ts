import { db } from "@/lib/db";
import { classificarTarefaDesempenho } from "@/lib/alert-prazo";
import { competenciaAtual, competenciaSchema } from "@/lib/competencia";
import type { SessionUser } from "@/lib/visibility-scope";

/**
 * src/modules/dashboard/queries.ts
 *
 * Camada de agregação dos 3 dashboards comparativos (DASH-01/02/03), todos
 * restritos ao DONO (D-08) — diferente de withTarefaScope/withVisibilityScope
 * (visibilidade parcial), aqui é tudo-ou-nada: COLABORADOR nunca recebe
 * nenhum dado, mesmo o seu próprio, porque estes dashboards são comparativos
 * entre colegas/empresas (nunca expostos a quem está sendo comparado).
 *
 * CRÍTICO: toda função exportada chama assertDono(user) como primeira linha.
 */

export class DashboardAccessDeniedError extends Error {}

function assertDono(user: SessionUser): void {
  if (user.role !== "DONO") {
    throw new DashboardAccessDeniedError("Apenas o dono acessa os dashboards");
  }
}

function competenciaValidaOuAtual(competencia: string): string {
  const resultado = competenciaSchema.safeParse(competencia);
  return resultado.success ? resultado.data : competenciaAtual();
}

type TarefaParaClassificacao = {
  responsavelId?: string;
  empresaId?: string;
  prazo: Date;
  status: "PENDENTE" | "CONCLUIDA";
  historico: { concluidoEm: Date }[];
};

function classificar(tarefa: TarefaParaClassificacao, referencia: Date) {
  const concluidoEm = tarefa.historico[0]?.concluidoEm ?? null;
  return classificarTarefaDesempenho(
    { prazo: tarefa.prazo, status: tarefa.status, concluidoEm },
    referencia
  );
}

const TAREFA_CLASSIFICACAO_SELECT = {
  prazo: true,
  status: true,
  historico: {
    select: { concluidoEm: true },
    orderBy: { concluidoEm: "desc" as const },
    take: 1,
  },
} as const;

export type DesempenhoColaborador = {
  usuarioId: string;
  nome: string;
  totalTarefas: number;
  concluidasNoPrazo: number;
  concluidasAtraso: number;
  atrasoMedioDias: number;
  empresasCarteira: number;
};

/**
 * DASH-01/DASH-02 (D-01/D-02/D-03/D-04): desempenho por colaborador no
 * período selecionado. Mês atual (em andamento) é calculado live a partir de
 * Tarefa; meses fechados leem DesempenhoMensalSnapshot verbatim e NUNCA
 * recalculam (D-04).
 */
export async function getDesempenhoColaboradores(
  user: SessionUser,
  competencia: string
): Promise<DesempenhoColaborador[]> {
  assertDono(user);

  const competenciaValidada = competenciaValidaOuAtual(competencia);
  const atual = competenciaAtual();

  const usuarios = await db.usuario.findMany({
    select: { id: true, nome: true },
  });

  if (competenciaValidada !== atual) {
    // Mês fechado: leitura verbatim do snapshot (D-04) — nunca recomputar.
    const snapshots = await db.desempenhoMensalSnapshot.findMany({
      where: { competencia: competenciaValidada },
      select: {
        usuarioId: true,
        totalTarefas: true,
        concluidasNoPrazo: true,
        concluidasAtraso: true,
        atrasoMedioDias: true,
        empresasCarteira: true,
        usuario: {
          select: { id: true, nome: true },
        },
      },
    });

    return snapshots.map((s) => ({
      usuarioId: s.usuarioId,
      nome: s.usuario.nome,
      totalTarefas: s.totalTarefas,
      concluidasNoPrazo: s.concluidasNoPrazo,
      concluidasAtraso: s.concluidasAtraso,
      atrasoMedioDias: s.atrasoMedioDias,
      empresasCarteira: s.empresasCarteira,
    }));
  }

  // Mês atual: cálculo live a partir de Tarefa (Pitfall 2 — sem _avg em
  // campo derivado; groupBy só para contagem, classificação em memória).
  const referencia = new Date();

  const tarefas = await db.tarefa.findMany({
    where: { competencia: competenciaValidada },
    select: {
      responsavelId: true,
      ...TAREFA_CLASSIFICACAO_SELECT,
    },
  });

  const empresasPorResponsavel = await db.empresa.groupBy({
    by: ["responsavelId"],
    where: { ativo: true },
    _count: { _all: true },
  });

  const empresasMap = new Map(
    empresasPorResponsavel.map((e) => [e.responsavelId, e._count._all])
  );

  type Acumulador = {
    totalTarefas: number;
    concluidasNoPrazo: number;
    concluidasAtraso: number;
    somaDiasAtraso: number;
  };

  const acumuladores = new Map<string, Acumulador>();

  for (const tarefa of tarefas) {
    const responsavelId = tarefa.responsavelId as string;
    const acc =
      acumuladores.get(responsavelId) ??
      ({
        totalTarefas: 0,
        concluidasNoPrazo: 0,
        concluidasAtraso: 0,
        somaDiasAtraso: 0,
      } satisfies Acumulador);

    const { atrasada, diasAtraso } = classificar(tarefa, referencia);

    acc.totalTarefas += 1;
    if (atrasada) {
      acc.concluidasAtraso += 1;
      acc.somaDiasAtraso += diasAtraso;
    } else {
      acc.concluidasNoPrazo += 1;
    }

    acumuladores.set(responsavelId, acc);
  }

  return usuarios.map((usuario) => {
    const acc = acumuladores.get(usuario.id);
    const totalTarefas = acc?.totalTarefas ?? 0;
    const concluidasAtraso = acc?.concluidasAtraso ?? 0;
    const atrasoMedioDias =
      concluidasAtraso > 0 ? acc!.somaDiasAtraso / concluidasAtraso : 0;

    return {
      usuarioId: usuario.id,
      nome: usuario.nome,
      totalTarefas,
      concluidasNoPrazo: acc?.concluidasNoPrazo ?? 0,
      concluidasAtraso,
      atrasoMedioDias,
      empresasCarteira: empresasMap.get(usuario.id) ?? 0,
    };
  });
}

export type EvolucaoMensalEntry = {
  competencia: string;
  percentualNoPrazo: number;
};

/**
 * DASH-02 (D-04/D-05): últimos 12 meses fechados a partir do snapshot, mais
 * o mês atual em andamento calculado on-the-fly.
 */
export async function getEvolucaoMensal(
  user: SessionUser
): Promise<EvolucaoMensalEntry[]> {
  assertDono(user);

  const atual = competenciaAtual();

  const snapshots = await db.desempenhoMensalSnapshot.findMany({
    orderBy: { competencia: "asc" },
    select: {
      competencia: true,
      totalTarefas: true,
      concluidasNoPrazo: true,
    },
  });

  const porCompetencia = new Map<
    string,
    { totalTarefas: number; concluidasNoPrazo: number }
  >();

  for (const s of snapshots) {
    const acc =
      porCompetencia.get(s.competencia) ?? { totalTarefas: 0, concluidasNoPrazo: 0 };
    acc.totalTarefas += s.totalTarefas;
    acc.concluidasNoPrazo += s.concluidasNoPrazo;
    porCompetencia.set(s.competencia, acc);
  }

  const competenciasFechadas = Array.from(porCompetencia.keys())
    .sort()
    .slice(-12);

  const evolucao: EvolucaoMensalEntry[] = competenciasFechadas.map((c) => {
    const acc = porCompetencia.get(c)!;
    return {
      competencia: c,
      percentualNoPrazo:
        acc.totalTarefas > 0 ? (acc.concluidasNoPrazo / acc.totalTarefas) * 100 : 0,
    };
  });

  // Mês atual (em andamento, sem snapshot) calculado on-the-fly.
  const referencia = new Date();
  const tarefasAtuais = await db.tarefa.findMany({
    where: { competencia: atual },
    select: TAREFA_CLASSIFICACAO_SELECT,
  });

  let totalAtual = 0;
  let noPrazoAtual = 0;
  for (const tarefa of tarefasAtuais) {
    const { atrasada } = classificar(tarefa, referencia);
    totalAtual += 1;
    if (!atrasada) noPrazoAtual += 1;
  }

  evolucao.push({
    competencia: atual,
    percentualNoPrazo: totalAtual > 0 ? (noPrazoAtual / totalAtual) * 100 : 0,
  });

  return evolucao;
}

export type RankingEmpresaProblema = {
  empresaId: string;
  nome: string;
  total: number;
  atrasadas: number;
  taxaAtraso: number;
};

/**
 * DASH-03 (D-06/D-07): ranking de empresas problemáticas, sempre on-the-fly
 * (mesmo para meses passados — sem snapshot por empresa, decisão de
 * discricionariedade do CONTEXT.md). Ordenado por TAXA de atraso, filtro de
 * volume mínimo (>= 3 tarefas), Top 10.
 */
export async function getRankingEmpresasProblema(
  user: SessionUser,
  competencia: string
): Promise<RankingEmpresaProblema[]> {
  assertDono(user);

  const competenciaValidada = competenciaValidaOuAtual(competencia);
  const referencia = new Date();

  const porEmpresa = await db.tarefa.groupBy({
    by: ["empresaId"],
    where: { competencia: competenciaValidada },
    _count: { _all: true },
  });

  const empresaIdsElegiveis = porEmpresa
    .filter((e) => e._count._all >= 3)
    .map((e) => e.empresaId);

  if (empresaIdsElegiveis.length === 0) {
    return [];
  }

  const tarefas = await db.tarefa.findMany({
    where: {
      competencia: competenciaValidada,
      empresaId: { in: empresaIdsElegiveis },
    },
    select: {
      empresaId: true,
      ...TAREFA_CLASSIFICACAO_SELECT,
    },
  });

  const empresas = await db.empresa.findMany({
    where: { id: { in: empresaIdsElegiveis } },
    select: { id: true, nome: true },
  });
  const nomesPorEmpresa = new Map(empresas.map((e) => [e.id, e.nome]));

  type Acumulador = { total: number; atrasadas: number };
  const acumuladores = new Map<string, Acumulador>();

  for (const tarefa of tarefas) {
    const empresaId = tarefa.empresaId as string;
    const acc = acumuladores.get(empresaId) ?? { total: 0, atrasadas: 0 };
    const { atrasada } = classificar(tarefa, referencia);
    acc.total += 1;
    if (atrasada) acc.atrasadas += 1;
    acumuladores.set(empresaId, acc);
  }

  const ranking: RankingEmpresaProblema[] = empresaIdsElegiveis.map((empresaId) => {
    const acc = acumuladores.get(empresaId) ?? { total: 0, atrasadas: 0 };
    return {
      empresaId,
      nome: nomesPorEmpresa.get(empresaId) ?? "",
      total: acc.total,
      atrasadas: acc.atrasadas,
      taxaAtraso: acc.total > 0 ? acc.atrasadas / acc.total : 0,
    };
  });

  return ranking.sort((a, b) => b.taxaAtraso - a.taxaAtraso).slice(0, 10);
}
