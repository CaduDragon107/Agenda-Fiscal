import { describe, it, expect } from "vitest";
import { calcularAlertaPrazo } from "@/lib/alert-prazo";

/**
 * tests/alert-prazo.test.ts
 *
 * Cobre ALRT-01: calcularAlertaPrazo(prazo, status) deve retornar os
 * valores corretos de emoji, label e classes CSS para cada cenário.
 *
 * O helper é puro (sem I/O), portanto não precisa de mocks.
 * Datas relativas são calculadas com new Date(Date.now() + N * 86400000).
 */

const MS_PER_DIA = 24 * 60 * 60 * 1000;

function diasAPartirDeHoje(dias: number): Date {
  return new Date(Date.now() + dias * MS_PER_DIA);
}

describe("calcularAlertaPrazo", () => {
  it("retorna emoji 🔴 e label 'Atrasada' quando prazo é ontem e status PENDENTE", () => {
    const prazoOntem = diasAPartirDeHoje(-1);

    const resultado = calcularAlertaPrazo(prazoOntem, "PENDENTE");

    expect(resultado.emoji).toBe("🔴");
    expect(resultado.label).toBe("Atrasada");
  });

  it("retorna emoji 🟡 e label 'Prazo próximo' quando prazo é amanhã e status PENDENTE", () => {
    const prazoAmanha = diasAPartirDeHoje(1);

    const resultado = calcularAlertaPrazo(prazoAmanha, "PENDENTE");

    expect(resultado.emoji).toBe("🟡");
    expect(resultado.label).toBe("Prazo próximo");
  });

  it("retorna emoji 🟡 quando prazo é exatamente now+3 dias e status PENDENTE (limite inclusivo)", () => {
    // now+3d menos 1 segundo para garantir que ainda está dentro do limite
    const prazo3Dias = new Date(Date.now() + 3 * MS_PER_DIA - 1000);

    const resultado = calcularAlertaPrazo(prazo3Dias, "PENDENTE");

    expect(resultado.emoji).toBe("🟡");
  });

  it("retorna emoji '' e label '' quando prazo é em 7 dias e status PENDENTE (normal)", () => {
    const prazo7Dias = diasAPartirDeHoje(7);

    const resultado = calcularAlertaPrazo(prazo7Dias, "PENDENTE");

    expect(resultado.emoji).toBe("");
    expect(resultado.label).toBe("");
  });

  it("retorna sem emoji e textClass contendo 'line-through' quando status CONCLUIDA (independente do prazo)", () => {
    const prazoOntem = diasAPartirDeHoje(-1);

    const resultado = calcularAlertaPrazo(prazoOntem, "CONCLUIDA");

    expect(resultado.emoji).toBe("");
    expect(resultado.textClass).toContain("line-through");
  });
});
