import { describe, it } from "vitest";

/**
 * tests/tarefas.queries.test.ts
 *
 * Wave 0 stubs — cobre TASK-05: buscarTarefaPorId com escopo de visibilidade.
 * Todos os testes são .todo (sem callback) para evitar imports de módulos que
 * ainda não existem (src/modules/tarefas/queries.ts será criado na Plan 02-02).
 *
 * Ao implementar a Plan 02-02, substituir os .todo pelos testes reais,
 * seguindo o padrão de vi.mock de tests/empresas.queries.test.ts:
 *   - vi.mock("@/lib/db") com findFirst mockado
 *   - Verificar que o where inclui responsavelId para COLABORADOR (withTarefaScope)
 *   - Verificar que DONO recebe where sem responsavelId
 */

describe("buscarTarefaPorId", () => {
  it.todo("retorna null para tarefa fora do escopo do COLABORADOR");
  it.todo("DONO consegue buscar qualquer tarefa por id");
  it.todo("retorna a tarefa correta para o COLABORADOR responsável");
});
