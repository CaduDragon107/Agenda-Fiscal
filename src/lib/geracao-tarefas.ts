/**
 * src/lib/geracao-tarefas.ts
 *
 * Catálogo puro de obrigações fiscais por regime tributário + gerador de
 * tarefas mensais. Implementa D-01 a D-05 e D-09 do CONTEXT.md:
 *   - D-01/D-02: catálogo de obrigações por regime (LUCRO_REAL,
 *     LUCRO_PRESUMIDO, SIMPLES_NACIONAL), cada uma com um dia-base fixo.
 *   - D-03: toda obrigação vence no mês SEGUINTE ao da competência apurada.
 *   - D-04: diaBase=31 deve usar o último dia do mês quando este não tiver
 *     31 dias (ex.: fevereiro) — via date-fns `lastDayOfMonth`, nunca
 *     hardcoded (Pitfall 2: `setDate(date, 31)` rola silenciosamente para
 *     o mês seguinte em meses curtos).
 *   - D-05: o prazo final sempre passa por `anticiparParaDiaUtil` (nunca
 *     posterga em fim de semana/feriado).
 *   - D-09: o responsável da tarefa é sempre o responsável atual da
 *     empresa (`empresa.responsavelId`).
 *
 * Função pura (sem I/O, sem Prisma/auth/cron) — testável exaustivamente
 * sem banco nem mocks.
 */

import { anticiparParaDiaUtil, calcularPrazoBaseDiaFixo } from "./dia-util";
import type { RegimeTributario } from "@prisma/client";

export type TipoObrigacao =
  | "ICMS"
  | "PIS_COFINS"
  | "SPED_FISCAL"
  | "SPED_CONTRIBUICOES"
  | "DAS";

type ObrigacaoRegra = { tipo: TipoObrigacao; diaBase: number };

// D-02: catálogo de obrigações por regime, dia-base ANTES do ajuste de dia útil
export const CATALOGO_OBRIGACOES: Record<RegimeTributario, ObrigacaoRegra[]> = {
  LUCRO_REAL: [
    { tipo: "ICMS", diaBase: 20 },
    { tipo: "PIS_COFINS", diaBase: 25 },
    { tipo: "SPED_FISCAL", diaBase: 19 },
    { tipo: "SPED_CONTRIBUICOES", diaBase: 31 },
  ],
  LUCRO_PRESUMIDO: [
    { tipo: "SPED_FISCAL", diaBase: 19 },
    { tipo: "SPED_CONTRIBUICOES", diaBase: 31 },
  ],
  SIMPLES_NACIONAL: [{ tipo: "DAS", diaBase: 20 }],
};

export const TITULO_OBRIGACAO: Record<TipoObrigacao, string> = {
  ICMS: "ICMS",
  PIS_COFINS: "PIS/COFINS",
  SPED_FISCAL: "SPED Fiscal",
  SPED_CONTRIBUICOES: "SPED Contribuições",
  DAS: "DAS",
};

export type TarefaParaCriar = {
  empresaId: string;
  responsavelId: string;
  titulo: string;
  tipoObrigacao: TipoObrigacao;
  competencia: string;
  prazo: Date;
};

export function gerarTarefasDoMes(
  empresas: { id: string; regimeTributario: RegimeTributario; responsavelId: string }[],
  competencia: string
): TarefaParaCriar[] {
  const [ano, mes] = competencia.split("-").map(Number);
  const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
  });

  return empresas.flatMap((empresa) =>
    CATALOGO_OBRIGACOES[empresa.regimeTributario].map((regra) => {
      const prazoBase = calcularPrazoBaseDiaFixo(competencia, regra.diaBase);
      const prazo = anticiparParaDiaUtil(prazoBase); // D-05

      return {
        empresaId: empresa.id,
        responsavelId: empresa.responsavelId, // D-09
        titulo: `${TITULO_OBRIGACAO[regra.tipo]} — ${nomeMes}/${ano}`,
        tipoObrigacao: regra.tipo,
        competencia,
        prazo,
      };
    })
  );
}
