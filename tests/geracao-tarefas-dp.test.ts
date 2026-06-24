import { describe, it, expect } from "vitest";
import { gerarTarefasDoMesDp } from "@/lib/geracao-tarefas-dp";

/**
 * tests/geracao-tarefas-dp.test.ts
 *
 * Cobre DP-01/DP-02/DP-03/DP-04: gerarTarefasDoMesDp(empresas, competencia)
 * deve produzir exatamente as 4 obrigações de Departamento Pessoal
 * (FOLHA, ESOCIAL, FGTS, INSS) para toda empresa CLT, independente de
 * regime tributário (DP não varia por regime, ao contrário do Fiscal).
 *
 * O helper é puro (sem I/O), portanto não precisa de mocks.
 */

describe("gerarTarefasDoMesDp", () => {
  it("produz as 4 obrigacoes de DP para toda empresa CLT, independente de regime", () => {
    const empresas = [{ id: "e1", responsavelId: "u1" }];
    const resultado = gerarTarefasDoMesDp(empresas, "2026-06");
    const tipos = resultado.map((t) => t.tipoObrigacao).sort();
    expect(tipos).toEqual(["ESOCIAL", "FGTS", "FOLHA", "INSS"].sort());
  });

  it("FOLHA vence no 5o dia util do mes seguinte, nunca em fim de semana/feriado", () => {
    const empresas = [{ id: "e1", responsavelId: "u1" }];
    const resultado = gerarTarefasDoMesDp(empresas, "2026-06"); // mes seguinte: julho/2026
    const folha = resultado.find((t) => t.tipoObrigacao === "FOLHA")!;
    expect(folha.prazo.getFullYear()).toBe(2026);
    expect(folha.prazo.getMonth()).toBe(6); // julho, indice 6
    expect(folha.prazo.getDate()).toBe(7);
  });

  it("ESOCIAL vence no dia 7, FGTS e INSS no dia 15, antecipando se cair em fim de semana/feriado", () => {
    const empresas = [{ id: "e1", responsavelId: "u1" }];
    const resultado = gerarTarefasDoMesDp(empresas, "2026-06"); // mes seguinte: julho/2026

    const esocial = resultado.find((t) => t.tipoObrigacao === "ESOCIAL")!;
    const fgts = resultado.find((t) => t.tipoObrigacao === "FGTS")!;
    const inss = resultado.find((t) => t.tipoObrigacao === "INSS")!;

    // dia-base 7 de julho/2026 cai numa terca-feira (dia util comum, sem ajuste)
    expect(esocial.prazo.getMonth()).toBe(6);
    expect(esocial.prazo.getDate()).toBe(7);

    // dia-base 15 de julho/2026 cai numa quarta-feira (dia util comum, sem ajuste)
    expect(fgts.prazo.getMonth()).toBe(6);
    expect(fgts.prazo.getDate()).toBe(15);
    expect(inss.prazo.getMonth()).toBe(6);
    expect(inss.prazo.getDate()).toBe(15);
  });

  it("cada tarefa gerada carrega empresaId, responsavelId, competencia e titulo nao vazio", () => {
    const empresas = [{ id: "e1", responsavelId: "u1" }];

    const resultado = gerarTarefasDoMesDp(empresas, "2026-06");

    expect(resultado).toHaveLength(4);
    for (const tarefa of resultado) {
      expect(tarefa.empresaId).toBe("e1");
      expect(tarefa.responsavelId).toBe("u1");
      expect(tarefa.competencia).toBe("2026-06");
      expect(tarefa.titulo).toBeTruthy();
      expect(tarefa.titulo.length).toBeGreaterThan(0);
    }
  });
});
