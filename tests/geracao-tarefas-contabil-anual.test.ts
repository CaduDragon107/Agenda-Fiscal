import { describe, it, expect } from "vitest";
import {
  CATALOGO_OBRIGACOES_ANUAIS,
  obrigacoesAnuaisParaCompetencia,
  calcularPrazoAnual,
} from "@/lib/geracao-tarefas-contabil-anual";

/**
 * tests/geracao-tarefas-contabil-anual.test.ts
 *
 * Cobre CONT-02 a CONT-05: obrigacoesAnuaisParaCompetencia decide, a
 * partir da competência mensal "YYYY-MM" recebida, se alguma obrigação
 * anual (DEFIS/ECD/ECF) deve ser criada nesta execução; calcularPrazoAnual
 * calcula o vencimento (ano seguinte ao ano-base), antecipado para dia
 * útil anterior quando cai em fim de semana/feriado.
 *
 * Padrão de varredura de 12 meses, conforme 07-RESEARCH.md Code Examples.
 */

describe("obrigacoesAnuaisParaCompetencia — exatamente 1 disparo por obrigação por ano", () => {
  it("rodando as 12 competências de 2026, cada obrigação anual dispara exatamente 1 vez", () => {
    const disparos: Record<string, number> = { DEFIS: 0, ECD: 0, ECF: 0 };

    for (let mes = 1; mes <= 12; mes++) {
      const competencia = `2026-${String(mes).padStart(2, "0")}`;
      const regras = obrigacoesAnuaisParaCompetencia(competencia);
      for (const { regra } of regras) {
        disparos[regra.tipo]++;
      }
    }

    expect(disparos).toEqual({ DEFIS: 1, ECD: 1, ECF: 1 });
  });

  it("disparo de DEFIS ocorre em fevereiro, ECD em abril, ECF em junho — nunca em outro mês", () => {
    for (let mes = 1; mes <= 12; mes++) {
      const competencia = `2026-${String(mes).padStart(2, "0")}`;
      const regras = obrigacoesAnuaisParaCompetencia(competencia).map((r) => r.regra.tipo);

      if (mes === 2) expect(regras).toContain("DEFIS");
      else expect(regras).not.toContain("DEFIS");

      if (mes === 4) expect(regras).toContain("ECD");
      else expect(regras).not.toContain("ECD");

      if (mes === 6) expect(regras).toContain("ECF");
      else expect(regras).not.toContain("ECF");
    }
  });

  it('obrigacoesAnuaisParaCompetencia("2026-02") dispara só DEFIS; "2026-01" não dispara nada', () => {
    expect(obrigacoesAnuaisParaCompetencia("2026-02").map((r) => r.regra.tipo)).toEqual(["DEFIS"]);
    expect(obrigacoesAnuaisParaCompetencia("2026-01")).toEqual([]);
  });

  it('para competência "2026-04" (ECD), competenciaAnual é "2026" e anoVencimento é 2027 (Pitfall 2 — sempre ano seguinte)', () => {
    const regras = obrigacoesAnuaisParaCompetencia("2026-04");
    expect(regras).toHaveLength(1);
    expect(regras[0].regra.tipo).toBe("ECD");
    expect(regras[0].competenciaAnual).toBe("2026");
    expect(regras[0].anoVencimento).toBe(2027);
  });

  it("DEFIS é exclusiva de SIMPLES_NACIONAL; ECD/ECF são exclusivas de LUCRO_REAL/LUCRO_PRESUMIDO (Pitfall 3)", () => {
    const defis = CATALOGO_OBRIGACOES_ANUAIS.find((r) => r.tipo === "DEFIS")!;
    const ecd = CATALOGO_OBRIGACOES_ANUAIS.find((r) => r.tipo === "ECD")!;
    const ecf = CATALOGO_OBRIGACOES_ANUAIS.find((r) => r.tipo === "ECF")!;

    expect(defis.regimesElegiveis).toEqual(["SIMPLES_NACIONAL"]);
    expect(ecd.regimesElegiveis.sort()).toEqual(["LUCRO_PRESUMIDO", "LUCRO_REAL"].sort());
    expect(ecf.regimesElegiveis.sort()).toEqual(["LUCRO_PRESUMIDO", "LUCRO_REAL"].sort());
  });

  it("lança erro para competencia em formato não canônico", () => {
    expect(() => obrigacoesAnuaisParaCompetencia("2026-13")).toThrow();
    expect(() => obrigacoesAnuaisParaCompetencia("abc")).toThrow();
    expect(() => obrigacoesAnuaisParaCompetencia("")).toThrow();
    expect(() => obrigacoesAnuaisParaCompetencia("2026")).toThrow();
  });
});

describe("calcularPrazoAnual", () => {
  it("ECF (2027-07-31, sábado) antecipa para sexta-feira 30/07/2027", () => {
    const prazo = calcularPrazoAnual(2027, 7, 31);
    expect(prazo.getFullYear()).toBe(2027);
    expect(prazo.getMonth()).toBe(6); // julho, índice 6
    expect(prazo.getDate()).toBe(30);
    expect(prazo.getDay()).toBe(5); // sexta-feira
  });

  it("DEFIS (2027-03-31, quarta-feira) permanece 31/03/2027, sem ajuste", () => {
    const prazo = calcularPrazoAnual(2027, 3, 31);
    expect(prazo.getFullYear()).toBe(2027);
    expect(prazo.getMonth()).toBe(2); // março, índice 2
    expect(prazo.getDate()).toBe(31);
    expect(prazo.getDay()).toBe(3); // quarta-feira
  });

  it("ECD (2027-05-31, segunda-feira) permanece 31/05/2027, sem ajuste", () => {
    const prazo = calcularPrazoAnual(2027, 5, 31);
    expect(prazo.getFullYear()).toBe(2027);
    expect(prazo.getMonth()).toBe(4); // maio, índice 4
    expect(prazo.getDate()).toBe(31);
    expect(prazo.getDay()).toBe(1); // segunda-feira
  });
});
