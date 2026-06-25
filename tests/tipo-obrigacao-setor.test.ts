import { describe, it, expect } from "vitest";
import { TipoObrigacao } from "@prisma/client";
import {
  TIPOS_OBRIGACAO_POR_SETOR,
  tarefaSetorWhere,
} from "@/lib/tipo-obrigacao-setor";

/**
 * tests/tipo-obrigacao-setor.test.ts
 *
 * Função pura, sem I/O — sem mocks. Cobre:
 * (a) shape do `where` retornado por `tarefaSetorWhere` para o setor DP;
 * (b) completude do mapa `TIPOS_OBRIGACAO_POR_SETOR` contra o enum real
 *     `TipoObrigacao` — quebra imediatamente se um valor for
 *     adicionado/removido/duplicado sem atualizar o mapa (T-08-02).
 */
describe("tarefaSetorWhere", () => {
  it("classifica recorrentes por tipoObrigacao e avulsas por responsavel.setor para DP", () => {
    const where = tarefaSetorWhere("DP");

    expect(where.OR).toBeDefined();
    expect(where.OR).toHaveLength(2);

    const [recorrentesClause, avulsasClause] = where.OR as [
      { tipoObrigacao: { in: string[] } },
      { tipoObrigacao: null; responsavel: { setor: string } },
    ];

    expect(recorrentesClause.tipoObrigacao.in).toEqual(
      expect.arrayContaining(["FOLHA", "ESOCIAL", "FGTS", "INSS"])
    );
    expect(recorrentesClause.tipoObrigacao.in).toHaveLength(4);

    expect(avulsasClause).toEqual({
      tipoObrigacao: null,
      responsavel: { setor: "DP" },
    });
  });

  it("classifica recorrentes por tipoObrigacao e avulsas por responsavel.setor para FISCAL", () => {
    const where = tarefaSetorWhere("FISCAL");
    const [recorrentesClause, avulsasClause] = where.OR as [
      { tipoObrigacao: { in: string[] } },
      { tipoObrigacao: null; responsavel: { setor: string } },
    ];

    expect(recorrentesClause.tipoObrigacao.in).toEqual(
      expect.arrayContaining(["ICMS", "PIS_COFINS", "SPED_FISCAL", "SPED_CONTRIBUICOES", "DAS"])
    );
    expect(avulsasClause).toEqual({
      tipoObrigacao: null,
      responsavel: { setor: "FISCAL" },
    });
  });

  it("classifica recorrentes por tipoObrigacao e avulsas por responsavel.setor para CONTABIL", () => {
    const where = tarefaSetorWhere("CONTABIL");
    const [recorrentesClause, avulsasClause] = where.OR as [
      { tipoObrigacao: { in: string[] } },
      { tipoObrigacao: null; responsavel: { setor: string } },
    ];

    expect(recorrentesClause.tipoObrigacao.in).toHaveLength(11);
    expect(avulsasClause).toEqual({
      tipoObrigacao: null,
      responsavel: { setor: "CONTABIL" },
    });
  });

  it("todo valor do enum TipoObrigacao aparece em exatamente um setor (completude, sem sobreposicao, sem omissao)", () => {
    const todosValoresDoEnum = Object.values(TipoObrigacao);

    const ocorrenciasPorValor = new Map<string, number>();
    for (const setor of Object.keys(TIPOS_OBRIGACAO_POR_SETOR) as Array<
      keyof typeof TIPOS_OBRIGACAO_POR_SETOR
    >) {
      for (const tipo of TIPOS_OBRIGACAO_POR_SETOR[setor]) {
        ocorrenciasPorValor.set(tipo, (ocorrenciasPorValor.get(tipo) ?? 0) + 1);
      }
    }

    // Sem omissao: todo valor do enum aparece pelo menos 1x no mapa.
    for (const valor of todosValoresDoEnum) {
      expect(ocorrenciasPorValor.get(valor)).toBe(1);
    }

    // Sem sobreposicao/duplicacao: nenhum valor mapeado aparece em mais de
    // um setor, e nenhum valor extra (nao pertencente ao enum) foi incluido.
    expect(ocorrenciasPorValor.size).toBe(todosValoresDoEnum.length);

    // Soma exata dos 3 arrays == 20 (5 FISCAL + 4 DP + 11 CONTABIL).
    const somaTotal = Object.values(TIPOS_OBRIGACAO_POR_SETOR).reduce(
      (acc, lista) => acc + lista.length,
      0
    );
    expect(somaTotal).toBe(20);
    expect(somaTotal).toBe(todosValoresDoEnum.length);
  });
});
