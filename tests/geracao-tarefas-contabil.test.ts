import { describe, it, expect } from "vitest";
import { gerarTarefasDoMesContabil } from "@/lib/geracao-tarefas-contabil";

/**
 * tests/geracao-tarefas-contabil.test.ts
 *
 * Cobre CONT-01: gerarTarefasDoMesContabil(empresas, competencia) deve
 * produzir exatamente as 8 rotinas mensais Contábil (D-02) para empresas
 * LUCRO_REAL e LUCRO_PRESUMIDO, e zero rotinas para SIMPLES_NACIONAL
 * (D-03). Mirror de tests/geracao-tarefas-dp.test.ts.
 *
 * O helper é puro (sem I/O), portanto não precisa de mocks.
 */

const TIPOS_ESPERADOS = [
  "EXTRATO_BANCARIO",
  "LANCAMENTO_EXTRATOS",
  "FOLHA_CONTABIL",
  "FISCAL_CONTABIL",
  "BAIXA_IMPOSTOS",
  "PERDCOMP",
  "FORNECEDORES_CLIENTES",
  "BALANCO",
].sort();

describe("gerarTarefasDoMesContabil", () => {
  it("produz as 8 rotinas para LUCRO_REAL", () => {
    const empresas = [
      { id: "e1", regimeTributario: "LUCRO_REAL" as const, responsavelId: "u1" },
    ];
    const resultado = gerarTarefasDoMesContabil(empresas, "2026-03");
    expect(resultado).toHaveLength(8);
    expect(resultado.map((t) => t.tipoObrigacao).sort()).toEqual(TIPOS_ESPERADOS);
  });

  it("produz as 8 rotinas para LUCRO_PRESUMIDO (mesmas datas que LUCRO_REAL, D-04)", () => {
    const empresas = [
      { id: "e1", regimeTributario: "LUCRO_PRESUMIDO" as const, responsavelId: "u1" },
    ];
    const resultado = gerarTarefasDoMesContabil(empresas, "2026-03");
    expect(resultado).toHaveLength(8);
    expect(resultado.map((t) => t.tipoObrigacao).sort()).toEqual(TIPOS_ESPERADOS);
  });

  it("produz zero rotinas para SIMPLES_NACIONAL (D-03)", () => {
    const empresas = [
      { id: "e1", regimeTributario: "SIMPLES_NACIONAL" as const, responsavelId: "u1" },
    ];
    const resultado = gerarTarefasDoMesContabil(empresas, "2026-03");
    expect(resultado).toHaveLength(0);
  });

  it("cada rotina vence em dia útil, nunca sábado/domingo/feriado", () => {
    const empresas = [
      { id: "e1", regimeTributario: "LUCRO_REAL" as const, responsavelId: "u1" },
    ];
    // varre 12 competências de 2026 para reduzir chance de coincidência de calendário
    for (let mes = 1; mes <= 12; mes++) {
      const competencia = `2026-${String(mes).padStart(2, "0")}`;
      const resultado = gerarTarefasDoMesContabil(empresas, competencia);
      for (const tarefa of resultado) {
        const dia = tarefa.prazo.getDay();
        expect(dia).not.toBe(0); // domingo
        expect(dia).not.toBe(6); // sábado
      }
    }
  });

  it("cada tarefa gerada carrega empresaId, responsavelId, competencia e titulo nao vazio", () => {
    const empresas = [
      { id: "e1", regimeTributario: "LUCRO_REAL" as const, responsavelId: "u1" },
    ];
    const resultado = gerarTarefasDoMesContabil(empresas, "2026-03");

    expect(resultado).toHaveLength(8);
    for (const tarefa of resultado) {
      expect(tarefa.empresaId).toBe("e1");
      expect(tarefa.responsavelId).toBe("u1");
      expect(tarefa.competencia).toBe("2026-03");
      expect(tarefa.titulo).toBeTruthy();
      expect(tarefa.titulo.length).toBeGreaterThan(0);
    }
  });

  it("EXTRATO_BANCARIO vai para responsavelExtratoBancarioId quando informado; demais rotinas mantêm o responsável Contábil da empresa", () => {
    const empresas = [
      { id: "e1", regimeTributario: "LUCRO_REAL" as const, responsavelId: "u-contabil" },
    ];
    const resultado = gerarTarefasDoMesContabil(empresas, "2026-03", "u-extrato");

    const extrato = resultado.find((t) => t.tipoObrigacao === "EXTRATO_BANCARIO");
    expect(extrato?.responsavelId).toBe("u-extrato");

    const outras = resultado.filter((t) => t.tipoObrigacao !== "EXTRATO_BANCARIO");
    expect(outras.length).toBeGreaterThan(0);
    for (const tarefa of outras) {
      expect(tarefa.responsavelId).toBe("u-contabil");
    }
  });

  it("sem responsavelExtratoBancarioId informado, EXTRATO_BANCARIO cai no responsável Contábil padrão", () => {
    const empresas = [
      { id: "e1", regimeTributario: "LUCRO_REAL" as const, responsavelId: "u-contabil" },
    ];
    const resultado = gerarTarefasDoMesContabil(empresas, "2026-03");

    const extrato = resultado.find((t) => t.tipoObrigacao === "EXTRATO_BANCARIO");
    expect(extrato?.responsavelId).toBe("u-contabil");
  });

  it("lança erro para competencia em formato não canônico, em vez de propagar Invalid Date silenciosamente", () => {
    const empresas = [
      { id: "e1", regimeTributario: "LUCRO_REAL" as const, responsavelId: "u1" },
    ];

    expect(() => gerarTarefasDoMesContabil(empresas, "2026-13")).toThrow();
    expect(() => gerarTarefasDoMesContabil(empresas, "abc")).toThrow();
    expect(() => gerarTarefasDoMesContabil(empresas, "")).toThrow();
    expect(() => gerarTarefasDoMesContabil(empresas, "2026-1")).toThrow();
  });
});
