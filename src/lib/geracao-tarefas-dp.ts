/**
 * src/lib/geracao-tarefas-dp.ts
 *
 * Catálogo puro de obrigações de Departamento Pessoal (DP) + gerador de
 * tarefas mensais. Implementa DP-01 (Folha), DP-02 (FGTS), DP-03 (INSS) e
 * DP-04 (eSocial) do CONTEXT.md da Fase 6.
 *
 * Ao contrário do catálogo Fiscal (`geracao-tarefas.ts`), o catálogo de DP
 * é FLAT — não varia por regime tributário (`RegimeTributario`). Toda
 * empresa com funcionários CLT gera o mesmo conjunto de 4 obrigações,
 * independente de Lucro Real/Presumido/Simples Nacional. O gate de
 * "tem funcionários CLT" é aplicado pelo CHAMADOR (`geracao.ts`, Plan
 * 06-02), não dentro deste catálogo.
 *
 * Regras de prazo:
 *   - FOLHA: 5º dia útil do mês seguinte (contagem para frente, via
 *     `calcularQuintoDiaUtil` — já é dia útil por construção, NUNCA passa
 *     por `anticiparParaDiaUtil`).
 *   - ESOCIAL: dia-base 7, FGTS/INSS: dia-base 15 — todos do mês seguinte,
 *     antecipando para o dia útil anterior se caírem em fim de
 *     semana/feriado nacional (mesma regra D-05 do Fiscal).
 *
 * Função pura (sem I/O, sem Prisma/auth/cron) — testável exaustivamente
 * sem banco nem mocks.
 */

import {
  anticiparParaDiaUtil,
  calcularPrazoBaseDiaFixo,
  calcularQuintoDiaUtil,
} from "./dia-util";
import { competenciaSchema } from "./competencia";

export type TipoObrigacaoDp = "FOLHA" | "ESOCIAL" | "FGTS" | "INSS";

type ObrigacaoRegraDp =
  | { tipo: TipoObrigacaoDp; regra: "QUINTO_DIA_UTIL" }
  | { tipo: TipoObrigacaoDp; regra: "DIA_BASE"; diaBase: number };

// Catálogo FLAT — DP não varia por regime tributário (ao contrário do Fiscal)
export const CATALOGO_OBRIGACOES_DP: ObrigacaoRegraDp[] = [
  { tipo: "FOLHA", regra: "QUINTO_DIA_UTIL" },
  { tipo: "ESOCIAL", regra: "DIA_BASE", diaBase: 7 },
  { tipo: "FGTS", regra: "DIA_BASE", diaBase: 15 },
  { tipo: "INSS", regra: "DIA_BASE", diaBase: 15 },
];

export const TITULO_OBRIGACAO_DP: Record<TipoObrigacaoDp, string> = {
  FOLHA: "Folha de Pagamento",
  ESOCIAL: "Fechamento eSocial",
  FGTS: "FGTS",
  INSS: "INSS",
};

export type TarefaParaCriar = {
  empresaId: string;
  responsavelId: string;
  titulo: string;
  tipoObrigacao: TipoObrigacaoDp;
  competencia: string;
  prazo: Date;
};

/**
 * @throws {Error} se `competencia` não estiver no formato canônico "YYYY-MM"
 * (mesma validação de `competenciaSchema` em `lib/competencia.ts`). Esta
 * função pura não tem como saber se o chamador já validou a string — quem
 * a invoca fora do caminho `actions.ts` (que aplica `competenciaSchema`
 * antes de chegar aqui) deve garantir o formato canônico, ou esta validação
 * lança em vez de produzir `Invalid Date` silenciosamente.
 */
export function gerarTarefasDoMesDp(
  empresas: { id: string; responsavelId: string }[],
  competencia: string
): TarefaParaCriar[] {
  if (!competenciaSchema.safeParse(competencia).success) {
    throw new Error(`competencia inválida: ${competencia}`);
  }

  const [ano, mes] = competencia.split("-").map(Number);
  const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
  });

  return empresas.flatMap((empresa) =>
    CATALOGO_OBRIGACOES_DP.map((regra) => {
      const prazo =
        regra.regra === "QUINTO_DIA_UTIL"
          ? calcularQuintoDiaUtil(competencia) // já é dia útil por construção
          : anticiparParaDiaUtil(
              calcularPrazoBaseDiaFixo(competencia, regra.diaBase)
            ); // D-05

      return {
        empresaId: empresa.id,
        responsavelId: empresa.responsavelId,
        titulo: `${TITULO_OBRIGACAO_DP[regra.tipo]} — ${nomeMes}/${ano}`,
        tipoObrigacao: regra.tipo,
        competencia,
        prazo,
      };
    })
  );
}
