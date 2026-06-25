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
 *
 * NOVO (Plano 06-02): segundo loop, dentro da MESMA transação, gera as
 * tarefas de Departamento Pessoal (DP) para empresas com
 * `temFuncionariosClt=true`, lendo o responsável via `responsaveisPorSetor`
 * filtrado por `setor: "DP"` (CRÍTICO — nunca omitir esse filtro, ver
 * Pitfall 2 do RESEARCH.md desta fase, sob risco de pegar o responsável
 * FISCAL em vez do DP). Empresas CLT sem responsável de DP são puladas e
 * listadas em `semResponsavelDp` (D-01/D-02/D-03) — nunca `throw`, para não
 * bloquear a geração Fiscal nem a de outras empresas CLT. O loop Fiscal
 * (linhas abaixo) permanece intocado, lendo `Empresa.responsavelId`
 * (coluna legada) — decisão arquitetural explícita do RESEARCH.md de NÃO
 * migrar o Fiscal para a junction table nesta fase.
 *
 * NOVO (Plano 07-02): terceiro e quarto blocos, dentro da MESMA transação,
 * geram as tarefas Contábil mensais (8 rotinas para LUCRO_REAL/
 * LUCRO_PRESUMIDO, D-03 — SIMPLES_NACIONAL excluído) e Contábil anuais
 * (DEFIS/ECD/ECF, condicionais ao mês via `obrigacoesAnuaisParaCompetencia`).
 * Ambos os blocos filtram o responsável via `responsaveisPorSetor` com
 * `setor: "CONTABIL"` (mesmo padrão CRÍTICO do bloco DP — nunca ler
 * `empresa.responsavelId`). O bloco anual filtra empresas elegíveis
 * DINAMICAMENTE por `regra.regimesElegiveis` (Pitfall 3 — DEFIS é o
 * inverso de ECD/ECF, nunca reusar o filtro hardcoded do bloco mensal).
 * Empresas sem responsável Contábil (mensal ou qualquer obrigação anual
 * disparada no mês) são deduplicadas por `empresaId` (Pitfall 4) antes de
 * retornar em `semResponsavelContabil`.
 */

import { db } from "@/lib/db";
import { gerarTarefasDoMes } from "@/lib/geracao-tarefas";
import { gerarTarefasDoMesDp } from "@/lib/geracao-tarefas-dp";
import { gerarTarefasDoMesContabil } from "@/lib/geracao-tarefas-contabil";
import {
  obrigacoesAnuaisParaCompetencia,
  calcularPrazoAnual,
  TITULO_OBRIGACAO_ANUAL,
  type TipoObrigacaoAnual,
} from "@/lib/geracao-tarefas-contabil-anual";
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

export async function executarGeracaoMensal(competencia: string): Promise<{
  criadas: number;
  puladas: number;
  semResponsavelDp: { empresaId: string; nome: string }[];
  semResponsavelContabil: { empresaId: string; nome: string }[];
}> {
  // CRÍTICO (fix erro-gerar-tarefas-dono): esta transação encadeia 9-12
  // round-trips sequenciais de banco (snapshot: 4 queries, empresa ativo,
  // empresa CLT/DP, empresa Contábil mensal, 0-3 loops de regras anuais,
  // tarefa.createMany) — volume que cresceu ao longo das fases 06/07/08
  // (DP, Contábil, snapshot) sem revisar o orçamento de tempo da
  // transação. O default do Prisma (5000ms) é insuficiente contra um
  // Postgres Neon (serverless, cold start de 300-500ms + latência de
  // pooler) quando a base tem 100+ empresas, causando timeout (P2028) na
  // geração manual — daí o timeout explícito e generoso abaixo.
  return db.$transaction(
    async (tx) => {
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

    const tarefasFiscal = gerarTarefasDoMes(empresas, competencia);

    // Loop DP (Plano 06-02): empresas com funcionarios CLT, responsavel lido
    // via responsaveisPorSetor filtrado por setor "DP". CRITICO: o filtro
    // setor:"DP" dentro do select e obrigatorio (Pitfall 2) — sem ele,
    // responsaveisPorSetor[0] poderia pegar o responsavel FISCAL.
    const empresasClt = await tx.empresa.findMany({
      where: { ativo: true, temFuncionariosClt: true },
      select: {
        id: true,
        nome: true,
        responsaveisPorSetor: {
          where: { setor: "DP" },
          select: { usuarioId: true },
        },
      },
    });

    const comResponsavelDp = empresasClt.filter(
      (e) => e.responsaveisPorSetor.length > 0
    );
    const semResponsavelDp = empresasClt
      .filter((e) => e.responsaveisPorSetor.length === 0)
      .map((e) => ({ empresaId: e.id, nome: e.nome })); // D-02: pular e listar, nunca throw (D-03)

    const tarefasDp = gerarTarefasDoMesDp(
      comResponsavelDp.map((e) => ({
        id: e.id,
        responsavelId: e.responsaveisPorSetor[0].usuarioId,
      })),
      competencia
    );

    // Bloco Contábil MENSAL (Plano 07-02): empresas LUCRO_REAL/LUCRO_PRESUMIDO
    // (D-03 — SIMPLES_NACIONAL excluído), responsavel lido via
    // responsaveisPorSetor filtrado por setor "CONTABIL" (mesmo filtro
    // CRITICO do bloco DP acima — nunca ler empresa.responsavelId legado
    // para Contabil, T-CONT-01).
    const empresasContabil = await tx.empresa.findMany({
      where: {
        ativo: true,
        regimeTributario: { in: ["LUCRO_REAL", "LUCRO_PRESUMIDO"] },
      },
      select: {
        id: true,
        nome: true,
        regimeTributario: true,
        responsaveisPorSetor: {
          where: { setor: "CONTABIL" },
          select: { usuarioId: true },
        },
      },
    });

    const comResponsavelContabil = empresasContabil.filter(
      (e) => e.responsaveisPorSetor.length > 0
    );
    const semResponsavelContabilMensal = empresasContabil
      .filter((e) => e.responsaveisPorSetor.length === 0)
      .map((e) => ({ empresaId: e.id, nome: e.nome })); // D-11: pular e listar, nunca throw

    const tarefasContabilMensal = gerarTarefasDoMesContabil(
      comResponsavelContabil.map((e) => ({
        id: e.id,
        regimeTributario: e.regimeTributario,
        responsavelId: e.responsaveisPorSetor[0].usuarioId,
      })),
      competencia
    );

    // Bloco Contábil ANUAL (Plano 07-02): primeira periodicidade não-mensal
    // do motor. obrigacoesAnuaisParaCompetencia decide, a partir da própria
    // competência mensal recebida, se este mês dispara alguma obrigação
    // anual (DEFIS/ECD/ECF) — retorna [] em 9 dos 12 meses, caminho normal.
    const regrasAnuais = obrigacoesAnuaisParaCompetencia(competencia);

    let tarefasContabilAnual: {
      empresaId: string;
      responsavelId: string;
      titulo: string;
      tipoObrigacao: TipoObrigacaoAnual;
      competencia: string;
      prazo: Date;
    }[] = [];
    const semResponsavelContabilAnual: { empresaId: string; nome: string }[] = [];

    for (const { regra, competenciaAnual, anoVencimento } of regrasAnuais) {
      // CRÍTICO (Pitfall 3): filtrar dinamicamente por regra.regimesElegiveis
      // — nunca reusar o filtro hardcoded LUCRO_REAL/LUCRO_PRESUMIDO do bloco
      // mensal. DEFIS é o caso inverso (SIMPLES_NACIONAL).
      const empresasElegiveis = await tx.empresa.findMany({
        where: { ativo: true, regimeTributario: { in: regra.regimesElegiveis } },
        select: {
          id: true,
          nome: true,
          responsaveisPorSetor: {
            where: { setor: "CONTABIL" },
            select: { usuarioId: true },
          },
        },
      });

      const comResponsavel = empresasElegiveis.filter(
        (e) => e.responsaveisPorSetor.length > 0
      );
      const semResponsavel = empresasElegiveis
        .filter((e) => e.responsaveisPorSetor.length === 0)
        .map((e) => ({ empresaId: e.id, nome: e.nome }));

      semResponsavelContabilAnual.push(...semResponsavel);

      tarefasContabilAnual = tarefasContabilAnual.concat(
        comResponsavel.map((e) => ({
          empresaId: e.id,
          responsavelId: e.responsaveisPorSetor[0].usuarioId,
          titulo: `${TITULO_OBRIGACAO_ANUAL[regra.tipo]} — ${competenciaAnual}`,
          tipoObrigacao: regra.tipo,
          competencia: competenciaAnual, // "YYYY" — D-09
          prazo: calcularPrazoAnual(anoVencimento, regra.mesVencimento, regra.diaVencimento),
        }))
      );
    }

    // Pitfall 4: deduplicar por empresaId — uma empresa sem responsável
    // Contábil pode aparecer tanto no bloco mensal quanto em um ou mais
    // blocos anuais disparados no mesmo mês; reportar uma única vez.
    const semResponsavelContabilMap = new Map<string, { empresaId: string; nome: string }>();
    for (const item of [...semResponsavelContabilMensal, ...semResponsavelContabilAnual]) {
      semResponsavelContabilMap.set(item.empresaId, item);
    }
    const semResponsavelContabil = Array.from(semResponsavelContabilMap.values());

    const tarefas = [
      ...tarefasFiscal,
      ...tarefasDp,
      ...tarefasContabilMensal,
      ...tarefasContabilAnual,
    ];

    if (tarefas.length === 0) {
      return { criadas: 0, puladas: 0, semResponsavelDp, semResponsavelContabil };
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
      semResponsavelDp,
      semResponsavelContabil,
    };
    },
    // 30s: margem generosa para 9-12 round-trips + cold start do Neon
    // contra ~100-110 empresas. maxWait (tempo de espera por um slot de
    // conexão livre no pool, default 2000ms) também aumentado por
    // segurança, já que o pooler do Neon pode estar sob contenção.
    { timeout: 30000, maxWait: 10000 }
  );
}
