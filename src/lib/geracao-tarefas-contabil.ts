/**
 * src/lib/geracao-tarefas-contabil.ts
 *
 * Catálogo puro de obrigações mensais do setor Contábil + gerador de
 * tarefas mensais. Implementa CONT-01 do CONTEXT.md/REQUIREMENTS.md da
 * Fase 7: 8 rotinas distintas, vencimento no mês seguinte ao da
 * competência apurada, dia-base fixo + ajuste de dia útil (D-02/D-05).
 *
 * Ao contrário do catálogo de DP (`geracao-tarefas-dp.ts`, flat — não varia
 * por regime), o catálogo mensal Contábil VARIA por regime tributário,
 * exatamente como o catálogo Fiscal (`geracao-tarefas.ts`): LUCRO_REAL e
 * LUCRO_PRESUMIDO recebem as 8 rotinas (D-04: mesmas datas para os dois
 * regimes, distinção de "Grupo A/B/C" fora de escopo nesta fase);
 * SIMPLES_NACIONAL recebe um array vazio (D-03: zero rotinas Contábil
 * mensais para esse regime).
 *
 * Função pura (sem I/O, sem Prisma/auth/cron) — testável exaustivamente
 * sem banco nem mocks.
 */

import { anticiparParaDiaUtil, calcularPrazoBaseDiaFixo } from "./dia-util";
import { competenciaSchema } from "./competencia";
import type { RegimeTributario } from "@prisma/client";

export type TipoObrigacaoContabil =
  | "EXTRATO_BANCARIO"
  | "LANCAMENTO_EXTRATOS"
  | "FOLHA_CONTABIL"
  | "FISCAL_CONTABIL"
  | "BAIXA_IMPOSTOS"
  | "PERDCOMP"
  | "FORNECEDORES_CLIENTES"
  | "BALANCO";

type ObrigacaoRegraContabil = { tipo: TipoObrigacaoContabil; diaBase: number };

// D-02: dias-base das 8 rotinas mensais Contábil, ANTES do ajuste de dia útil.
// Compartilhado entre LUCRO_REAL e LUCRO_PRESUMIDO (D-04: mesmas datas para
// ambos os regimes — distinção de Grupo A/B/C fora de escopo nesta fase).
const ROTINAS_CONTABIL_MENSAL: ObrigacaoRegraContabil[] = [
  { tipo: "EXTRATO_BANCARIO", diaBase: 1 },
  { tipo: "LANCAMENTO_EXTRATOS", diaBase: 10 },
  { tipo: "FOLHA_CONTABIL", diaBase: 14 },
  { tipo: "FISCAL_CONTABIL", diaBase: 17 },
  { tipo: "BAIXA_IMPOSTOS", diaBase: 22 },
  { tipo: "PERDCOMP", diaBase: 22 },
  { tipo: "FORNECEDORES_CLIENTES", diaBase: 25 },
  { tipo: "BALANCO", diaBase: 28 },
];

// D-03: SIMPLES_NACIONAL recebe array vazio — nenhuma das 8 rotinas se aplica
export const CATALOGO_OBRIGACOES_CONTABIL: Record<RegimeTributario, ObrigacaoRegraContabil[]> = {
  LUCRO_REAL: ROTINAS_CONTABIL_MENSAL,
  LUCRO_PRESUMIDO: ROTINAS_CONTABIL_MENSAL,
  SIMPLES_NACIONAL: [],
};

export const TITULO_OBRIGACAO_CONTABIL: Record<TipoObrigacaoContabil, string> = {
  EXTRATO_BANCARIO: "Extrato Bancário",
  LANCAMENTO_EXTRATOS: "Lançamento de Extratos",
  FOLHA_CONTABIL: "Folha (Contábil)",
  FISCAL_CONTABIL: "Fiscal (Contábil)",
  BAIXA_IMPOSTOS: "Baixa de Impostos",
  PERDCOMP: "PERDCOMP",
  FORNECEDORES_CLIENTES: "Fornecedores e Clientes",
  BALANCO: "Balanço",
};

export type TarefaParaCriarContabil = {
  empresaId: string;
  responsavelId: string;
  titulo: string;
  tipoObrigacao: TipoObrigacaoContabil;
  competencia: string;
  prazo: Date;
};

/**
 * @throws {Error} se `competencia` não estiver no formato canônico "YYYY-MM"
 * (mesma validação de `competenciaSchema` em `lib/competencia.ts` — padrão
 * adotado de `gerarTarefasDoMesDp`, T-07-01 do threat_model desta plan).
 */
export function gerarTarefasDoMesContabil(
  empresas: { id: string; regimeTributario: RegimeTributario; responsavelId: string }[],
  competencia: string
): TarefaParaCriarContabil[] {
  if (!competenciaSchema.safeParse(competencia).success) {
    throw new Error(`competencia inválida: ${competencia}`);
  }

  const [ano, mes] = competencia.split("-").map(Number);
  const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
  });

  return empresas.flatMap((empresa) =>
    CATALOGO_OBRIGACOES_CONTABIL[empresa.regimeTributario].map((regra) => {
      const prazoBase = calcularPrazoBaseDiaFixo(competencia, regra.diaBase);
      const prazo = anticiparParaDiaUtil(prazoBase); // D-05

      return {
        empresaId: empresa.id,
        responsavelId: empresa.responsavelId,
        titulo: `${TITULO_OBRIGACAO_CONTABIL[regra.tipo]} — ${nomeMes}/${ano}`,
        tipoObrigacao: regra.tipo,
        competencia,
        prazo,
      };
    })
  );
}
