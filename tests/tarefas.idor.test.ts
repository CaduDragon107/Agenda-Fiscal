import { describe, it } from "vitest";

/**
 * tests/tarefas.idor.test.ts
 *
 * Wave 0 stubs — cobre T-02-IDOR: COLABORADOR não pode concluir nem excluir
 * tarefa de outro colaborador via Server Action direta (IDOR prevention).
 * Todos os testes são .todo (sem callback) para evitar imports de módulos que
 * ainda não existem.
 *
 * Ao implementar a Plan 02-02, substituir os .todo pelos testes reais,
 * seguindo o padrão de vi.mock de tests/empresas.idor.test.ts:
 *   - vi.mock("@/lib/db") com findFirst retornando null (escopo COLABORADOR não encontra)
 *   - vi.mock("@/auth") com authMock retornando { user: colaboradorA }
 *   - Verificar que a action retorna { ok: false, error: "não encontrado" }
 *   - Verificar que updateMock / deleteMock NÃO foram chamados
 */

describe("IDOR — concluirTarefa", () => {
  it.todo(
    "COLABORADOR não pode concluir tarefa de outro colaborador — retorna { ok: false } com 'não encontrado'"
  );
});

describe("IDOR — excluirTarefa", () => {
  it.todo(
    "COLABORADOR não pode excluir tarefa de outro colaborador — retorna { ok: false } com 'não encontrado'"
  );
});
