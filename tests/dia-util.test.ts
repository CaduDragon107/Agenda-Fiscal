import { describe, it, expect } from "vitest";
import Holidays from "date-holidays";
import { isSaturday, isSunday } from "date-fns";
import { anticiparParaDiaUtil, calcularQuintoDiaUtil } from "@/lib/dia-util";

/**
 * tests/dia-util.test.ts
 *
 * Cobre TASK-02: anticiparParaDiaUtil(date) deve antecipar (nunca postergar)
 * datas que caem em fim de semana ou feriado nacional para o dia útil
 * anterior (D-05/D-06).
 *
 * O helper é puro (sem I/O), portanto não precisa de mocks.
 * Datas comparadas por getFullYear()/getMonth()/getDate() (ignora hora).
 */

function mesmaData(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

describe("anticiparParaDiaUtil", () => {
  it("antecipa para a sexta-feira anterior quando a data cai em fim de semana (sábado)", () => {
    const sabado = new Date(2026, 0, 17); // sábado 17/01/2026
    const resultado = anticiparParaDiaUtil(sabado);
    const sextaEsperada = new Date(2026, 0, 16);

    expect(mesmaData(resultado, sextaEsperada)).toBe(true);
  });

  it("antecipa para a sexta-feira anterior quando a data cai em fim de semana (domingo)", () => {
    const domingo = new Date(2026, 0, 18); // domingo 18/01/2026
    const resultado = anticiparParaDiaUtil(domingo);
    const sextaEsperada = new Date(2026, 0, 16);

    expect(mesmaData(resultado, sextaEsperada)).toBe(true);
  });

  it("antecipa para o dia útil anterior quando a data cai em feriado nacional (Independência 07/09/2026)", () => {
    const independencia = new Date(2026, 8, 7); // segunda-feira 07/09/2026
    const resultado = anticiparParaDiaUtil(independencia);
    const sextaAnterior = new Date(2026, 8, 4); // sexta-feira 04/09/2026

    expect(mesmaData(resultado, sextaAnterior)).toBe(true);
  });

  it("antecipa corretamente quando a data cai em feriado nacional (Sexta-feira Santa 03/04/2026)", () => {
    const sextaSanta = new Date(2026, 3, 3); // sexta-feira 03/04/2026
    const resultado = anticiparParaDiaUtil(sextaSanta);

    // Sexta-feira Santa é feriado nacional móvel — deve antecipar para a quinta-feira anterior (02/04/2026)
    const quintaAnterior = new Date(2026, 3, 2);
    expect(mesmaData(resultado, quintaAnterior)).toBe(true);
  });

  it("a chamada direta da biblioteca confirma que 07/09/2026 é detectado como feriado (isHoliday !== false)", () => {
    const hd = new Holidays("BR");
    const resultado = hd.isHoliday(new Date(2026, 8, 7));

    expect(resultado).not.toBe(false);
  });

  it("retorna a mesma data quando já é um dia útil comum (terça-feira)", () => {
    const diaUtilComum = new Date(2026, 0, 20); // terça-feira 20/01/2026, sem feriado conhecido
    const resultado = anticiparParaDiaUtil(diaUtilComum);

    expect(mesmaData(resultado, diaUtilComum)).toBe(true);
  });
});

describe("calcularQuintoDiaUtil", () => {
  it("retorna terca-feira 07/07/2026 para competencia junho/2026 (mes seguinte sem feriado nos 5 primeiros dias uteis)", () => {
    const resultado = calcularQuintoDiaUtil("2026-06");
    expect(mesmaData(resultado, new Date(2026, 6, 7))).toBe(true);
  });

  it("retorna sexta-feira 08/01/2027 para competencia dezembro/2026, empurrado pelo feriado de Ano Novo", () => {
    const resultado = calcularQuintoDiaUtil("2026-12");
    expect(mesmaData(resultado, new Date(2027, 0, 8))).toBe(true);
  });

  it("o resultado nunca cai em sabado, domingo ou feriado nacional, varrendo competencias de pelo menos 2 anos", () => {
    const hd = new Holidays("BR");
    const competencias: string[] = [];
    for (const ano of [2026, 2027]) {
      for (let mes = 1; mes <= 12; mes++) {
        competencias.push(`${ano}-${String(mes).padStart(2, "0")}`);
      }
    }

    for (const competencia of competencias) {
      const resultado = calcularQuintoDiaUtil(competencia);
      expect(isSaturday(resultado)).toBe(false);
      expect(isSunday(resultado)).toBe(false);
      expect(hd.isHoliday(resultado)).toBe(false);
    }
  });
});
