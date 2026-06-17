import { describe, it } from "vitest";

/**
 * tests/tarefas.crud.test.ts
 *
 * Wave 0 stubs — cobre TASK-03 (concluirTarefa + excluirTarefa) e TASK-04 (criarTarefa).
 * Todos os testes são .todo (sem callback) para evitar imports de módulos que
 * ainda não existem (Server Actions de tarefas são criadas nas plans seguintes).
 *
 * Ao implementar a Plan 02-02, substituir os .todo pelos testes reais,
 * seguindo o padrão de vi.mock de tests/empresas.idor.test.ts.
 */

describe("criarTarefa", () => {
  it.todo("cria tarefa com todos os campos obrigatórios");
  it.todo("retorna { ok: false } sem título");
  it.todo("retorna { ok: false } sem empresaId");
  it.todo("retorna { ok: false } sem prazo");
});

describe("concluirTarefa", () => {
  it.todo("muda status para CONCLUIDA e cria TarefaHistorico");
  it.todo("é idempotente se já CONCLUIDA");
});

describe("excluirTarefa", () => {
  it.todo("remove a tarefa do banco");
});
