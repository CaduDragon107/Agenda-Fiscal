import { describe, it, expect } from "vitest";
import {
  CATALOGO_OBRIGACOES_DP_ANUAIS,
  obrigacoesDpAnuaisParaCompetencia,
  calcularPrazoDpAnual,
} from "@/lib/geracao-tarefas-dp-anual";

/**
 * tests/geracao-tarefas-dp-anual.test.ts
 *
 * Cobre DP-09: obrigacoesDpAnuaisParaCompetencia decide, a partir da
 * competência mensal "YYYY-MM" recebida, se o 13º salário
 * (DECIMO_TERCEIRO) deve ser criado nesta execução; calcularPrazoDpAnual
 * calcula o vencimento (MESMO ano-base da competência — D-02, diverge do
 * padrão Contábil anual onde anoVencimento = anoAtual + 1), antecipado
 * para dia útil anterior quando cai em fim de semana/feriado.
 *
 * Padrão de varredura de 12 meses, conforme 09-RESEARCH.md Code Examples.
 */

describe("obrigacoesDpAnuaisParaCompetencia — exatamente 1 disparo por ano", () => {
  it("rodando as 12 competências de 2026, DECIMO_TERCEIRO dispara exatamente 1 vez no total", () => {
    const disparos: Record<string, number> = { DECIMO_TERCEIRO: 0 };

    for (let mes = 1; mes <= 12; mes++) {
      const competencia = `2026-${String(mes).padStart(2, "0")}`;
      const regras = obrigacoesDpAnuaisParaCompetencia(competencia);
      for (const { regra } of regras) {
        disparos[regra.tipo]++;
      }
    }

    expect(disparos).toEqual({ DECIMO_TERCEIRO: 1 });
  });

  it("disparo de DECIMO_TERCEIRO ocorre em novembro — nunca em outro mês", () => {
    for (let mes = 1; mes <= 12; mes++) {
      const competencia = `2026-${String(mes).padStart(2, "0")}`;
      const regras = obrigacoesDpAnuaisParaCompetencia(competencia).map(
        (r) => r.regra.tipo
      );

      if (mes === 11) expect(regras).toContain("DECIMO_TERCEIRO");
      else expect(regras).not.toContain("DECIMO_TERCEIRO");
    }
  });

  it('para competência "2026-11", competenciaAnual é "2026" e anoVencimento é 2026 (D-02 — MESMO ano, diverge do padrão Contábil)', () => {
    const regras = obrigacoesDpAnuaisParaCompetencia("2026-11");
    expect(regras).toHaveLength(1);
    expect(regras[0].regra.tipo).toBe("DECIMO_TERCEIRO");
    expect(regras[0].competenciaAnual).toBe("2026");
    expect(regras[0].anoVencimento).toBe(2026); // NOT 2027
  });

  it('meses sem disparo ("2026-01".."2026-10" e "2026-12") retornam []', () => {
    const mesesSemDisparo = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
    for (const mes of mesesSemDisparo) {
      const competencia = `2026-${String(mes).padStart(2, "0")}`;
      expect(obrigacoesDpAnuaisParaCompetencia(competencia)).toEqual([]);
    }
  });

  it("catálogo tem mesVencimento=12 e diaVencimento=20 para DECIMO_TERCEIRO (D-01 — 2ª parcela/saldo, não a 1ª parcela 30/nov)", () => {
    const regra = CATALOGO_OBRIGACOES_DP_ANUAIS.find(
      (r) => r.tipo === "DECIMO_TERCEIRO"
    )!;
    expect(regra.mesCriacao).toBe(11);
    expect(regra.mesVencimento).toBe(12);
    expect(regra.diaVencimento).toBe(20);
  });

  it("lança erro para competencia em formato não canônico", () => {
    expect(() => obrigacoesDpAnuaisParaCompetencia("2026-13")).toThrow();
    expect(() => obrigacoesDpAnuaisParaCompetencia("abc")).toThrow();
    expect(() => obrigacoesDpAnuaisParaCompetencia("")).toThrow();
    expect(() => obrigacoesDpAnuaisParaCompetencia("2026")).toThrow();
  });
});

describe("calcularPrazoDpAnual", () => {
  it("20/dez/2026 (domingo) antecipa para sexta-feira 18/12/2026 (D-03)", () => {
    const prazo = calcularPrazoDpAnual(2026, 12, 20);
    expect(prazo.getFullYear()).toBe(2026);
    expect(prazo.getMonth()).toBe(11); // dezembro, índice 11
    expect(prazo.getDate()).toBe(18);
    expect(prazo.getDay()).toBe(5); // sexta-feira
  });

  it("20/dez/2027 (segunda-feira, dia útil) permanece 20/12/2027, sem ajuste", () => {
    const prazo = calcularPrazoDpAnual(2027, 12, 20);
    expect(prazo.getFullYear()).toBe(2027);
    expect(prazo.getMonth()).toBe(11); // dezembro, índice 11
    expect(prazo.getDate()).toBe(20);
    expect(prazo.getDay()).toBe(1); // segunda-feira
  });
});
