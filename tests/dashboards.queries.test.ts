import { describe, it } from "vitest";

/**
 * tests/dashboards.queries.test.ts
 *
 * Scaffold Wave 0 (04-01) — cobre DASH-01/DASH-03 calculation rules.
 * Casos virão a ser preenchidos red->green nas Waves 2/3 (plans 04-03).
 * it.todo sem callback evita importar módulos ainda inexistentes
 * (convenção registrada em STATE.md, Fase 02-01).
 */

describe("listarDesempenhoColaboradoresMesAtual", () => {
  it.todo(
    "calcula % no prazo por colaboradores usando concluidoEm <= prazo (D-01)"
  );
  it.todo(
    "exclui tarefas PENDENTE do denominador de % no prazo por colaboradores (D-02)"
  );
  it.todo(
    "retorna volume absoluto (nº empresas, nº tarefas) como contexto junto ao percentual (D-03)"
  );
});

describe("listarRankingEmpresas", () => {
  it.todo(
    "ranking de empresas considera atrasada PENDENTE com prazo < now() (D-06)"
  );
  it.todo(
    "ranking de empresas ordena desc por percentual de atraso (D-06)"
  );
});
