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
import type { Prisma, Setor, TipoObrigacao } from "@prisma/client";
import { TIPOS_OBRIGACAO_POR_SETOR } from "@/lib/tipo-obrigacao-setor";

/**
 * Indice inverso de TIPOS_OBRIGACAO_POR_SETOR (TipoObrigacao -> Setor),
 * construido em runtime a partir da MESMA fonte de verdade — nunca duplicar
 * o mapeamento (Pitfall B4). Garantidamente total para todo TipoObrigacao
 * nao-nulo (completude verificada em tests/tipo-obrigacao-setor.test.ts).
 */
const SETOR_POR_TIPO_OBRIGACAO = new Map<TipoObrigacao, Setor>(
  Object.entries(TIPOS_OBRIGACAO_POR_SETOR).flatMap(([setor, tipos]) =>
    tipos.map((tipo) => [tipo, setor as Setor] as const)
  )
);

/**
 * Deriva o setor de uma tarefa, espelhando a logica de `tarefaSetorWhere`
 * (T-08-03): recorrentes (tipoObrigacao nao-nulo) sao classificadas pelo
 * tipoObrigacao; avulsas (tipoObrigacao null) sao classificadas pelo setor
 * do colaborador responsavel — aqui obtido do MESMO lookup de Usuario.setor
 * ja usado para o enriquecimento da linha (responsavel.setor do
 * responsavelId desta tarefa e, por definicao, o Usuario.setor desse
 * colaborador), sem precisar de um join extra na query de Tarefa.
 */
function setorDaTarefa(
  tipoObrigacao: TipoObrigacao | null,
  setorPorColaborador: Map<string, Setor | null>,
  responsavelId: string
): Setor | null {
  if (tipoObrigacao) return SETOR_POR_TIPO_OBRIGACAO.get(tipoObrigacao) ?? null;
  return setorPorColaborador.get(responsavelId) ?? null;
}

/** Chave composta (colaborador, setor) para particionar a agregacao por setor (T-08-03). */
function chaveColaboradorSetor(colaboradorId: string, setor: Setor): string {
  return `${colaboradorId}::${setor}`;
}

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
  setor: Setor;
  totalConcluidas: number;
  concluidasNoPrazo: number;
  totalEmpresas: number;
  totalTarefasPeriodo: number;
  totalCriadas: number;
  totalConcluidasNoPeriodo: number;
  totalPendentesSemMotivo: number;
  totalPendentesComMotivo: number;
  totalVencidas: number;
};

export async function calcularSnapshotMensal(
  tx: Prisma.TransactionClient,
  competencia: string
): Promise<LinhaSnapshotMensal[]> {
  const inicio = startOfMonth(competenciaParaDataLocal(competencia));
  const fim = endOfMonth(inicio);

  // 1 query: todas as tarefas cujo concluidoEm cai no range do mes-alvo,
  // independente de Tarefa.competencia (inclui avulsas, competencia=null).
  // tipoObrigacao selecionado para classificacao por setor (T-08-03) —
  // SEM essa classificacao, tarefas de outros setores do mesmo colaborador
  // contaminariam a linha congelada (CR-01, code review Phase 08).
  const tarefasNoPeriodo = await tx.tarefa.findMany({
    where: {
      status: "CONCLUIDA",
      historico: { some: { concluidoEm: { gte: inicio, lte: fim } } },
    },
    select: {
      responsavelId: true,
      tipoObrigacao: true,
      prazo: true,
      historico: {
        select: { concluidoEm: true },
        where: { concluidoEm: { gte: inicio, lte: fim } },
        orderBy: { concluidoEm: "desc" },
        take: 1,
      },
    },
  });

  // ---------------------------------------------------------------------
  // POPULACAO PARALELA "criadas" (quick task 260622-lty, DASH-02):
  //
  // CRITICO — esta populacao e DISTINTA da populacao concluidoEm-no-range
  // acima (D-01/D-02/D-03). Ela responde "quantas tarefas foram CRIADAS
  // para este mes-alvo", nao "quantas foram concluidas dentro do range de
  // datas deste mes". Sao perguntas diferentes e usam filtros diferentes:
  //
  //   - Tarefas RECORRENTES: filtradas por `Tarefa.competencia` igual ao
  //     mes-alvo (competencia e atribuida na geracao mensal — sempre
  //     reflete o mes para o qual a tarefa foi gerada, independente de
  //     createdAt real).
  //   - Tarefas AVULSAS (`competencia = null`): nao tem competencia
  //     atribuida, entao usamos `createdAt` dentro do range
  //     [startOfMonth, endOfMonth] do mes-alvo como proxy de "criada
  //     neste mes".
  //
  // Isso é DELIBERADAMENTE diferente do filtro concluidoEm-no-range usado
  // acima — aqui queremos volume/composicao do trabalho GERADO no mes, nao
  // do trabalho CONCLUIDO no mes (que pode incluir tarefas de meses
  // anteriores concluidas atrasadas, ou excluir tarefas deste mes ainda
  // pendentes).
  //
  // totalVencidas usa um unico `agora` capturado aqui — congelado no
  // snapshot persistido (mesmo padrao defensivo de D-05: o snapshot de um
  // mes fechado nunca deve mudar silenciosamente s
  // e recalculado depois, mesmo que o relogio real avance).
  const agora = new Date();

  const tarefasCriadas = await tx.tarefa.findMany({
    where: {
      OR: [
        { competencia },
        { competencia: null, createdAt: { gte: inicio, lte: fim } },
      ],
    },
    select: {
      responsavelId: true,
      tipoObrigacao: true,
      status: true,
      motivoPendencia: true,
      prazo: true,
    },
  });

  // Enriquecimento ANTES da agregacao (nao depois, como antes do fix de
  // CR-01): precisamos de Usuario.setor de cada colaborador para classificar
  // tarefas avulsas (tipoObrigacao null) por setor — ver setorDaTarefa().
  // select explicito — NUNCA `colaborador: true`/`responsavel: true`, que
  // vazaria senhaHash (T-08-04).
  const colaboradorIdsBrutos = new Set<string>([
    ...tarefasNoPeriodo.map((t) => t.responsavelId),
    ...tarefasCriadas.map((t) => t.responsavelId),
  ]);
  const colaboradores = await tx.usuario.findMany({
    where: { id: { in: [...colaboradorIdsBrutos] } },
    select: { id: true, setor: true },
  });
  const setorPorColaborador = new Map<string, Setor | null>(
    colaboradores.map((c) => [c.id, c.setor])
  );

  // Agregacao em memoria por (colaborador, setor) — Tarefa.responsavelId
  // (nunca Empresa.responsavelId, Pitfall 3), particionada por setor real da
  // tarefa (T-08-03/CR-01: sem isso, tarefas de outros setores do mesmo
  // colaborador contaminariam a linha congelada).
  const porColaboradorSetor = new Map<
    string,
    { totalConcluidas: number; concluidasNoPrazo: number; totalTarefasPeriodo: number }
  >();

  for (const t of tarefasNoPeriodo) {
    const concluidoEm = t.historico[0]?.concluidoEm;
    if (!concluidoEm) continue; // defensivo: CONCLUIDA sempre tem historico no range filtrado

    const setor = setorDaTarefa(t.tipoObrigacao, setorPorColaborador, t.responsavelId);
    if (!setor) continue; // defensivo: sem setor classificavel, sem como gravar (NOT NULL)
    const chave = chaveColaboradorSetor(t.responsavelId, setor);

    const atual =
      porColaboradorSetor.get(chave) ??
      { totalConcluidas: 0, concluidasNoPrazo: 0, totalTarefasPeriodo: 0 };

    atual.totalConcluidas += 1;
    atual.totalTarefasPeriodo += 1; // mesma populacao filtrada por concluidoEm (D-03)
    if (concluidoEm <= t.prazo) {
      atual.concluidasNoPrazo += 1; // D-01/D-02
    }

    porColaboradorSetor.set(chave, atual);
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

  const categoriasPorColaboradorSetor = new Map<
    string,
    {
      totalCriadas: number;
      totalConcluidasNoPeriodo: number;
      totalPendentesSemMotivo: number;
      totalPendentesComMotivo: number;
      totalVencidas: number;
    }
  >();

  for (const t of tarefasCriadas) {
    const setor = setorDaTarefa(t.tipoObrigacao, setorPorColaborador, t.responsavelId);
    if (!setor) continue; // defensivo: sem setor classificavel, sem como gravar (NOT NULL)
    const chave = chaveColaboradorSetor(t.responsavelId, setor);

    const atual =
      categoriasPorColaboradorSetor.get(chave) ?? {
        totalCriadas: 0,
        totalConcluidasNoPeriodo: 0,
        totalPendentesSemMotivo: 0,
        totalPendentesComMotivo: 0,
        totalVencidas: 0,
      };

    atual.totalCriadas += 1;

    if (t.status === "CONCLUIDA") {
      atual.totalConcluidasNoPeriodo += 1;
    } else if (t.status === "PENDENTE") {
      if (t.motivoPendencia == null) {
        atual.totalPendentesSemMotivo += 1;
      } else {
        atual.totalPendentesComMotivo += 1;
      }
      // "vencida" e uma lente de urgencia sobreposta — nao e particao
      // exclusiva com pendentes-sem/com-motivo (pode contar nos dois).
      if (t.prazo < agora) {
        atual.totalVencidas += 1;
      }
    }

    categoriasPorColaboradorSetor.set(chave, atual);
  }

  // Uniao das chaves (colaborador, setor) presentes em QUALQUER das duas
  // populacoes (concluidoEm-no-range OU criadas-no-mes) — defaultando
  // ausentes a 0 em cada lado, para nunca perder uma linha que so aparece
  // numa das duas consultas.
  const chaves = new Set<string>([
    ...porColaboradorSetor.keys(),
    ...categoriasPorColaboradorSetor.keys(),
  ]);

  const linhas: LinhaSnapshotMensal[] = [];

  for (const chave of chaves) {
    const separador = chave.lastIndexOf("::");
    const colaboradorId = chave.slice(0, separador);
    const setor = chave.slice(separador + 2) as Setor;

    const concluido = porColaboradorSetor.get(chave) ?? {
      totalConcluidas: 0,
      concluidasNoPrazo: 0,
      totalTarefasPeriodo: 0,
    };
    const criado = categoriasPorColaboradorSetor.get(chave) ?? {
      totalCriadas: 0,
      totalConcluidasNoPeriodo: 0,
      totalPendentesSemMotivo: 0,
      totalPendentesComMotivo: 0,
      totalVencidas: 0,
    };

    linhas.push({
      competencia,
      colaboradorId,
      setor,
      totalConcluidas: concluido.totalConcluidas,
      concluidasNoPrazo: concluido.concluidasNoPrazo,
      totalEmpresas: totalEmpresasPorColaborador.get(colaboradorId) ?? 0,
      totalTarefasPeriodo: concluido.totalTarefasPeriodo,
      totalCriadas: criado.totalCriadas,
      totalConcluidasNoPeriodo: criado.totalConcluidasNoPeriodo,
      totalPendentesSemMotivo: criado.totalPendentesSemMotivo,
      totalPendentesComMotivo: criado.totalPendentesComMotivo,
      totalVencidas: criado.totalVencidas,
    });
  }

  return linhas;
}
