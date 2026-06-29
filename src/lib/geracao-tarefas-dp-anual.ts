/**
 * src/lib/geracao-tarefas-dp-anual.ts
 *
 * Catálogo puro anual de Departamento Pessoal (DP) — atualmente uma única
 * obrigação: 13º Salário (DECIMO_TERCEIRO, DP-09 do CONTEXT.md/REQUIREMENTS.md
 * da Fase 9). Função pura sem I/O, sem Prisma/auth/cron — testável
 * exaustivamente sem banco nem mocks.
 *
 * Catálogo PARALELO dedicado a DP, deliberadamente NÃO reusando o motor
 * anual existente do setor Contábil (Fase 7, módulo de obrigações ECD/ECF/
 * DEFIS): aquele módulo hardcoda `anoVencimento = anoAtual + 1` (vencimento
 * no ano SEGUINTE ao ano-base — regra real de DEFIS/ECD/ECF). O 13º salário
 * precisa de `anoVencimento = anoAtual` (D-02 do CONTEXT.md desta fase — o
 * 13º vence no MESMO ano-base; ex.: competência "2026-11" produz vencimento
 * em 20/12/2026, não 20/12/2027). Generalizar a função Contábil com um
 * parâmetro booleano extra arriscaria regressão nos testes de ECD/ECF/DEFIS
 * já em produção (Pitfall 1 do 09-RESEARCH.md) — por isso este arquivo
 * duplica a estrutura, com a única divergência sendo o cálculo de
 * `anoVencimento`.
 *
 * Catálogo FLAT — assim como `geracao-tarefas-dp.ts` (obrigações DP
 * mensais), este catálogo NÃO varia por `RegimeTributario`. O gate de
 * elegibilidade real (`temFuncionariosClt`) é aplicado pelo CHAMADOR
 * (`geracao.ts`), não dentro deste catálogo — por isso `ObrigacaoDpAnualRegra`
 * não tem campo de elegibilidade por regime tributário (diferente do tipo de
 * regra equivalente no módulo Contábil).
 *
 * Regras desta obrigação (D-01/D-02/D-03/D-04/D-06 do CONTEXT.md):
 *   - D-01: a tarefa rastreia o vencimento da 2ª parcela/saldo do 13º
 *     (20/dezembro), NUNCA a 1ª parcela de antecipação (30/novembro).
 *   - D-02: anoVencimento = anoAtual (mesmo ano-base da competência).
 *   - D-03: prazo final antecipado para o dia útil anterior via
 *     `anticiparParaDiaUtil`, reusado sem modificação.
 *   - D-04: tarefa criada 1 mês antes do vencimento (mesCriacao = 11,
 *     novembro), mesmo padrão de antecedência do motor anual Contábil.
 *   - D-06: título "13º Salário" sem menção a "2ª parcela" — a tarefa
 *     representa o fechamento da obrigação do ano, não uma parcela
 *     específica.
 */

import { anticiparParaDiaUtil } from "./dia-util";
import { competenciaSchema } from "./competencia";

export type TipoObrigacaoDpAnual = "DECIMO_TERCEIRO";

export type ObrigacaoDpAnualRegra = {
  tipo: TipoObrigacaoDpAnual;
  mesCriacao: number; // mês (1-12) em que a tarefa é criada (1 mês antes do vencimento)
  mesVencimento: number; // mês (1-12) do vencimento, no MESMO ano-base (D-02)
  diaVencimento: number; // dia do mês de vencimento
};

export const TITULO_OBRIGACAO_DP_ANUAL: Record<TipoObrigacaoDpAnual, string> = {
  DECIMO_TERCEIRO: "13º Salário",
};

// D-01/D-04: 13º Salário — criado em novembro, vence 20/dezembro (2ª
// parcela/saldo), do MESMO ano-base.
export const CATALOGO_OBRIGACOES_DP_ANUAIS: ObrigacaoDpAnualRegra[] = [
  {
    tipo: "DECIMO_TERCEIRO",
    mesCriacao: 11, // novembro
    mesVencimento: 12, // 20/dezembro
    diaVencimento: 20,
  },
];

/**
 * Dado o mes/ano da execução mensal ATUAL (a competência mensal "YYYY-MM"
 * recebida pelo motor de geração — NUNCA `new Date()`/`Date.now()`),
 * retorna as regras anuais de DP que devem ser criadas nesta execução.
 * Retorna `[]` em 11 dos 12 meses — caminho normal, não um caso de erro.
 *
 * @throws {Error} se `competencia` não estiver no formato canônico
 * "YYYY-MM" (mesmo contrato de `obrigacoesAnuaisParaCompetencia` do módulo
 * Contábil).
 */
export function obrigacoesDpAnuaisParaCompetencia(
  competencia: string
): { regra: ObrigacaoDpAnualRegra; competenciaAnual: string; anoVencimento: number }[] {
  if (!competenciaSchema.safeParse(competencia).success) {
    throw new Error(`competencia inválida: ${competencia}`);
  }

  const [anoAtual, mesAtual] = competencia.split("-").map(Number);

  return CATALOGO_OBRIGACOES_DP_ANUAIS.filter(
    (regra) => regra.mesCriacao === mesAtual
  ).map((regra) => ({
    regra,
    competenciaAnual: String(anoAtual),
    anoVencimento: anoAtual, // D-02: DIVERGE do padrão Contábil (anoAtual + 1) — 13º vence no MESMO ano-base
  }));
}

/**
 * Calcula o prazo final do 13º salário: data-base (anoVencimento,
 * mesVencimento, diaVencimento) antecipada para o dia útil anterior caso
 * caia em fim de semana ou feriado nacional (D-03), reusando
 * `anticiparParaDiaUtil` sem modificação — corpo idêntico a
 * `calcularPrazoAnual` do módulo Contábil.
 */
export function calcularPrazoDpAnual(
  anoVencimento: number,
  mesVencimento: number,
  diaVencimento: number
): Date {
  const dataBase = new Date(anoVencimento, mesVencimento - 1, diaVencimento);
  return anticiparParaDiaUtil(dataBase);
}
