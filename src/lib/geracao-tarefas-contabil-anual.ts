/**
 * src/lib/geracao-tarefas-contabil-anual.ts
 *
 * Catálogo puro das 3 obrigações ANUAIS do setor Contábil (ECD, ECF,
 * DEFIS) + funções de decisão/cálculo de prazo. Implementa CONT-02 a
 * CONT-05 do CONTEXT.md/REQUIREMENTS.md da Fase 7 — primeira
 * periodicidade não-mensal do motor de geração.
 *
 * Modelo (D-08/D-09/D-10 do CONTEXT.md, Pattern 2/3 do 07-RESEARCH.md):
 * `obrigacoesAnuaisParaCompetencia` NÃO gera todas as obrigações de uma vez
 * em janeiro — é uma função pura de `(mesAtual, anoAtual)`, derivada da
 * própria `competencia` mensal recebida pelo motor de geração mensal, que
 * decide se ESTE mês é o "mês de criação" (1 mês antes do vencimento) de
 * alguma obrigação anual. Retorna `[]` em 9 dos 12 meses — caminho normal,
 * não um caso de erro/skip especial. A idempotência entre execuções (12x
 * ao ano, sem duplicar) vem inteiramente da constraint
 * `@@unique([empresaId, tipoObrigacao, competencia])` já existente — não
 * introduzir nenhum mecanismo de controle adicional.
 *
 * Formato de competência anual: "YYYY" (D-09), validado por
 * `competenciaAnualSchema` — distinto do formato mensal "YYYY-MM"; a
 * unicidade entre os dois eixos vem do enum TipoObrigacao ser sempre
 * distinto entre obrigações mensais e anuais (T-07-03, threat_model
 * accept).
 *
 * Pitfall 1 (07-RESEARCH.md): `mesCriacao` é o mês em que a tarefa é
 * CRIADA (1 mês antes do vencimento) — NUNCA o mês de vencimento.
 * Pitfall 2: o vencimento cai SEMPRE no ano SEGUINTE ao ano-base da
 * competência (`anoVencimento = anoAtual + 1`), nunca no mesmo ano.
 *
 * Função pura (sem I/O, sem Prisma/auth/cron) — testável exaustivamente
 * sem banco nem mocks.
 */

import { anticiparParaDiaUtil } from "./dia-util";
import { competenciaSchema } from "./competencia";
import type { RegimeTributario } from "@prisma/client";

export type TipoObrigacaoAnual = "DEFIS" | "ECD" | "ECF";

export type ObrigacaoAnualRegra = {
  tipo: TipoObrigacaoAnual;
  mesCriacao: number; // mês (1-12) em que a tarefa é criada (1 mês antes do vencimento)
  mesVencimento: number; // mês (1-12) do vencimento, no ano SEGUINTE ao ano-base
  diaVencimento: number; // dia do mês de vencimento
  regimesElegiveis: RegimeTributario[];
};

export const TITULO_OBRIGACAO_ANUAL: Record<TipoObrigacaoAnual, string> = {
  DEFIS: "DEFIS",
  ECD: "ECD (Escrituração Contábil Digital)",
  ECF: "ECF (Escrituração Contábil Fiscal)",
};

// D-06/D-07: mapeamento regime -> obrigação + vencimento (ano seguinte ao ano-base)
export const CATALOGO_OBRIGACOES_ANUAIS: ObrigacaoAnualRegra[] = [
  {
    tipo: "DEFIS",
    mesCriacao: 2, // fevereiro
    mesVencimento: 3, // 31/marco
    diaVencimento: 31,
    regimesElegiveis: ["SIMPLES_NACIONAL"],
  },
  {
    tipo: "ECD",
    mesCriacao: 4, // abril
    mesVencimento: 5, // 31/maio
    diaVencimento: 31,
    regimesElegiveis: ["LUCRO_REAL", "LUCRO_PRESUMIDO"],
  },
  {
    tipo: "ECF",
    mesCriacao: 6, // junho
    mesVencimento: 7, // 31/julho
    diaVencimento: 31,
    regimesElegiveis: ["LUCRO_REAL", "LUCRO_PRESUMIDO"],
  },
];

/**
 * Dado o mes/ano da execução mensal ATUAL (a competência mensal "YYYY-MM"
 * recebida pelo motor de geração — NUNCA `new Date()`/`Date.now()`, para
 * preservar o mesmo invariante de determinismo já estabelecido pelo resto
 * do motor), retorna as regras anuais que devem ser criadas nesta
 * execução. Retorna `[]` em 9 dos 12 meses — caminho normal, não um caso
 * de erro.
 *
 * @throws {Error} se `competencia` não estiver no formato canônico
 * "YYYY-MM" (T-07-01, mesmo padrão de `gerarTarefasDoMesDp`).
 */
export function obrigacoesAnuaisParaCompetencia(
  competencia: string
): { regra: ObrigacaoAnualRegra; competenciaAnual: string; anoVencimento: number }[] {
  if (!competenciaSchema.safeParse(competencia).success) {
    throw new Error(`competencia inválida: ${competencia}`);
  }

  const [anoAtual, mesAtual] = competencia.split("-").map(Number);

  return CATALOGO_OBRIGACOES_ANUAIS.filter((regra) => regra.mesCriacao === mesAtual).map(
    (regra) => ({
      regra,
      competenciaAnual: String(anoAtual), // D-09: formato "YYYY"
      anoVencimento: anoAtual + 1, // Pitfall 2 — SEMPRE ano seguinte
    })
  );
}

/**
 * Calcula o prazo final de uma obrigação anual: data-base
 * (anoVencimento, mesVencimento, diaVencimento) antecipada para o dia
 * útil anterior caso caia em fim de semana ou feriado nacional (D-07),
 * reusando `anticiparParaDiaUtil` sem modificação — mesma regra D-05/D-06
 * já aplicada ao eixo mensal.
 */
export function calcularPrazoAnual(
  anoVencimento: number,
  mesVencimento: number,
  diaVencimento: number
): Date {
  const dataBase = new Date(anoVencimento, mesVencimento - 1, diaVencimento);
  return anticiparParaDiaUtil(dataBase);
}
