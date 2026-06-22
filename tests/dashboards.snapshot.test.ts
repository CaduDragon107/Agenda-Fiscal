import { describe, it } from "vitest";

/**
 * tests/dashboards.snapshot.test.ts
 *
 * Scaffold Wave 0 (04-01) — cobre DASH-02 freeze/idempotency/boundary/avulsa.
 * Casos virão a ser preenchidos red->green na Wave 1 (plan 04-02).
 * it.todo sem callback evita importar módulos ainda inexistentes
 * (convenção registrada em STATE.md, Fase 02-01).
 */

describe("calcularSnapshotMensal — freeze de meses fechados", () => {
  it.todo(
    "competência fechada lê exclusivamente db.desempenhoMensal — db.tarefa.findMany NÃO é chamado (frozen, D-05)"
  );
});

describe("calcularSnapshotMensal — idempotência da escrita", () => {
  it.todo(
    "escrita do snapshot é idempotente via createMany skipDuplicates contra @@unique([competencia, colaboradorId]) (idempot)"
  );
});

describe("calcularSnapshotMensal — boundary do mês fechado", () => {
  it.todo(
    "snapshot fecha o mês ANTERIOR à competência passada para executarGeracaoMensal, não o mês atual (boundary)"
  );
});

describe("calcularSnapshotMensal — paridade com query live", () => {
  it.todo(
    "população do snapshot filtra por concluidoEm-no-período e inclui tarefas avulsas (competencia=null), sem descontinuidade live->frozen (avulsa)"
  );
});
