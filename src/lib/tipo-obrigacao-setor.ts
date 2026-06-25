import type { Prisma, Setor, TipoObrigacao } from "@prisma/client";

/**
 * src/lib/tipo-obrigacao-setor.ts
 *
 * Única fonte de verdade do mapeamento TipoObrigacao -> Setor, derivada dos
 * 4 catálogos de geração já existentes (geracao-tarefas.ts,
 * geracao-tarefas-dp.ts, geracao-tarefas-contabil.ts,
 * geracao-tarefas-contabil-anual.ts) e cross-referenciada contra o enum
 * `TipoObrigacao` em prisma/schema.prisma.
 *
 * Mapeamento DISJUNTO: cada um dos 20 valores do enum aparece em
 * exatamente um setor — garantido pelo teste de completude em
 * tests/tipo-obrigacao-setor.test.ts (quebra na hora se o enum mudar sem
 * atualizar este mapa).
 *
 * NÃO duplicar este mapa em nenhum outro módulo (Pitfall B4) — toda query
 * de Tarefa que precisa de escopo por setor DEVE importar `tarefaSetorWhere`
 * a partir deste arquivo.
 */
export const TIPOS_OBRIGACAO_POR_SETOR: Record<Setor, TipoObrigacao[]> = {
  FISCAL: ["ICMS", "PIS_COFINS", "SPED_FISCAL", "SPED_CONTRIBUICOES", "DAS"],
  DP: ["FOLHA", "ESOCIAL", "FGTS", "INSS"],
  CONTABIL: [
    "EXTRATO_BANCARIO",
    "LANCAMENTO_EXTRATOS",
    "FOLHA_CONTABIL",
    "FISCAL_CONTABIL",
    "BAIXA_IMPOSTOS",
    "PERDCOMP",
    "FORNECEDORES_CLIENTES",
    "BALANCO",
    "ECD",
    "ECF",
    "DEFIS",
  ],
};

/**
 * Retorna um fragmento de `Prisma.TarefaWhereInput` que classifica
 * qualquer linha `Tarefa` pelo setor informado.
 *
 * - Recorrentes (`tipoObrigacao` não-nulo): classificadas pelo
 *   `tipoObrigacao`, via `TIPOS_OBRIGACAO_POR_SETOR[setor]`.
 * - Avulsas (`tipoObrigacao IS NULL`): classificadas pelo `setor` do
 *   colaborador responsável (`responsavel.setor`) — o único sinal
 *   disponível, já que `criarTarefa` não grava setor na criação.
 *
 * O caller deve espalhar o retorno no `where` de uma query Prisma
 * (`...tarefaSetorWhere(setor)`), nunca duplicar esta lógica inline.
 */
export function tarefaSetorWhere(setor: Setor): Prisma.TarefaWhereInput {
  return {
    OR: [
      { tipoObrigacao: { in: TIPOS_OBRIGACAO_POR_SETOR[setor] } },
      { tipoObrigacao: null, responsavel: { setor } },
    ],
  };
}
