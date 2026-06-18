import { describe, it, expect } from "vitest";
import { gerarTarefasDoMes } from "@/lib/geracao-tarefas";

/**
 * tests/geracao-tarefas.test.ts
 *
 * Cobre TASK-01: gerarTarefasDoMes(empresas, competencia) deve produzir o
 * conjunto correto de obrigações por regime tributário (D-02) e respeitar
 * o último dia do mês quando diaBase=31 cai em um mês mais curto (D-04).
 *
 * O helper é puro (sem I/O), portanto não precisa de mocks.
 */

describe("gerarTarefasDoMes", () => {
  it("produz o catalogo correto de obrigacoes por regime tributario", () => {
    const empresas = [
      { id: "e1", regimeTributario: "LUCRO_REAL" as const, responsavelId: "u1" },
      { id: "e2", regimeTributario: "LUCRO_PRESUMIDO" as const, responsavelId: "u2" },
      { id: "e3", regimeTributario: "SIMPLES_NACIONAL" as const, responsavelId: "u3" },
    ];

    const resultado = gerarTarefasDoMes(empresas, "2026-03");

    const tarefasLucroReal = resultado.filter((t) => t.empresaId === "e1");
    const tarefasLucroPresumido = resultado.filter((t) => t.empresaId === "e2");
    const tarefasSimplesNacional = resultado.filter((t) => t.empresaId === "e3");

    expect(tarefasLucroReal).toHaveLength(4);
    expect(tarefasLucroPresumido).toHaveLength(2);
    expect(tarefasSimplesNacional).toHaveLength(1);

    const tiposLucroReal = tarefasLucroReal.map((t) => t.tipoObrigacao).sort();
    expect(tiposLucroReal).toEqual(
      ["ICMS", "PIS_COFINS", "SPED_CONTRIBUICOES", "SPED_FISCAL"].sort()
    );

    const tiposLucroPresumido = tarefasLucroPresumido
      .map((t) => t.tipoObrigacao)
      .sort();
    expect(tiposLucroPresumido).toEqual(
      ["SPED_CONTRIBUICOES", "SPED_FISCAL"].sort()
    );

    expect(tarefasSimplesNacional[0].tipoObrigacao).toBe("DAS");
  });

  it("resolve diaBase 31 para o ultimo dia do mes de vencimento (fevereiro), nao para marco", () => {
    const empresas = [
      { id: "e1", regimeTributario: "LUCRO_REAL" as const, responsavelId: "u1" },
    ];

    // competência janeiro/2026 -> vencimento no mês seguinte (fevereiro/2026, D-03)
    const resultado = gerarTarefasDoMes(empresas, "2026-01");
    const spedContribuicoes = resultado.find(
      (t) => t.tipoObrigacao === "SPED_CONTRIBUICOES"
    );

    expect(spedContribuicoes).toBeDefined();
    expect(spedContribuicoes!.prazo.getMonth()).toBe(1); // fevereiro (índice 1), NUNCA março
  });

  it("cada tarefa gerada carrega empresaId, responsavelId, competencia e titulo nao vazio", () => {
    const empresas = [
      { id: "e1", regimeTributario: "SIMPLES_NACIONAL" as const, responsavelId: "u1" },
    ];

    const resultado = gerarTarefasDoMes(empresas, "2026-05");

    expect(resultado).toHaveLength(1);
    const tarefa = resultado[0];

    expect(tarefa.empresaId).toBe("e1");
    expect(tarefa.responsavelId).toBe("u1");
    expect(tarefa.competencia).toBe("2026-05");
    expect(tarefa.titulo).toBeTruthy();
    expect(tarefa.titulo.length).toBeGreaterThan(0);
  });
});
