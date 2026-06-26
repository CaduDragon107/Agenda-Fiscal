---
phase: quick-260626-aim
plan: 01
subsystem: tarefas
tags: [server-action, rbac, alert-dialog, geracao-mensal]
dependency_graph:
  requires: [src/lib/competencia.ts, src/lib/db.ts, src/app/(app)/tarefas/actions.ts]
  provides: [excluirTarefasDaCompetenciaAtualAction, ExcluirTarefasCompetenciaButton]
  affects: [src/app/(app)/tarefas/page.tsx]
tech_stack:
  added: []
  patterns: ["DONO-only Server Action guard (role check primeiro, antes de qualquer acesso ao banco)", "AlertDialog de confirmacao antes de acao destrutiva"]
key_files:
  created:
    - src/app/(app)/tarefas/excluir-tarefas-competencia-button.tsx
  modified:
    - src/app/(app)/tarefas/actions.ts
    - src/app/(app)/tarefas/page.tsx
decisions:
  - "DesempenhoMensal da competencia atual tambem e limpo na mesma transacao do delete de tarefas, para manter os dashboards consistentes com a ausencia das tarefas excluidas"
  - "Avulsas (competencia=null) sao incluidas no delete via segunda condicao OR (createdAt no range LOCAL do mes atual), pois um filtro simples por competencia as deixaria de fora"
  - "Sem teste contra DB ao vivo neste ambiente local (sem DATABASE_URL); verificacao limitada a tsc --noEmit, lint, build e suite de testes mockada (vitest)"
metrics:
  duration: ~20min
  completed: 2026-06-26
---

# Quick Task 260626-aim: Botão (só dono) para excluir todas as tarefas da competência atual Summary

Server Action DONO-only que exclui em massa todas as tarefas (recorrentes + avulsas, todos os setores) da competência atual via `$transaction`, com guard de role como primeiro check pós-`auth()`, mais um botão client com `AlertDialog` de confirmação plugado na página de Tarefas.

## What Was Built

### Task 1: Server Action `excluirTarefasDaCompetenciaAtualAction`

Adicionada ao final de `src/app/(app)/tarefas/actions.ts`, espelhando a estrutura de guards de `gerarTarefasDoMesAction`:

1. `auth()` → se `!session?.user`, retorna `{ ok: false, error: "Não autenticado" }`.
2. **Primeiro check pós-auth, antes de qualquer acesso ao banco:** se `session.user.role !== "DONO"`, retorna `{ ok: false, error: "não autorizado" }` (T-AIM-01).
3. Resolve `competenciaAtual()` e calcula o range do mês atual em horário LOCAL (`new Date(ano, mes - 1, 1)` / `new Date(ano, mes, 1)`), nunca `new Date("YYYY-MM-01")` — evita o off-by-one UTC documentado em `geracao.ts` (T-AIM-03).
4. Dentro de `db.$transaction(async (tx) => {...})`:
   - `tx.tarefa.deleteMany({ where: { OR: [{ competencia: comp }, { competencia: null, createdAt: { gte: inicioMes, lt: inicioProximoMes } }] } })` — cobre recorrentes E avulsas.
   - `tx.desempenhoMensal.deleteMany({ where: { competencia: comp } })` — limpa o snapshot de desempenho da competência.
5. Try/catch com `console.error` no catch (mesmo padrão de `gerarTarefasDoMesAction` após o fix de `erro-gerar-tarefas-dono`), retornando mensagem genérica ao cliente.
6. Sucesso: `revalidatePath("/tarefas")` + `{ ok: true, excluidas: count }`.

Novo tipo `AcaoExcluirTarefasResult` foi criado (não reaproveitando `AcaoTarefaResult`, que não expõe contagem).

Não usa `withTarefaScope` — operação administrativa global do DONO, sem escopo de visibilidade aplicável; a barreira real é o guard de role.

### Task 2: Botão `ExcluirTarefasCompetenciaButton` + wiring na page

Componente client criado em `src/app/(app)/tarefas/excluir-tarefas-competencia-button.tsx`, espelhando `gerar-tarefas-button.tsx` para estado/toast/refresh (`useRouter`, `useState` para `isPending`, `toast` de sonner, `Loader2`).

Estrutura: `AlertDialog` + `AlertDialogTrigger asChild` envolvendo `<Button variant="destructive">` "Excluir tarefas do mês" (com spinner quando pendente). `AlertDialogContent` com título "Excluir todas as tarefas do mês atual?", descrição explicando o escopo (recorrentes + avulsas, todos os setores, histórico preservado, ação irreversível), `AlertDialogCancel` "Cancelar" e `AlertDialogAction` "Excluir" chamando `handleExcluir`.

`handleExcluir` chama a action; em sucesso mostra toast com a contagem (`"${resultado.excluidas} tarefa(s) do mês atual excluída(s)."`) e `router.refresh()`; em erro, toast com a mensagem da action ou mensagem genérica no catch.

O componente `src/components/ui/alert-dialog.tsx` já existia no projeto (instalado em fase anterior) — não foi necessário rodar `npx shadcn add alert-dialog`.

Em `src/app/(app)/tarefas/page.tsx`, `ExcluirTarefasCompetenciaButton` foi importado e renderizado dentro do bloco existente `{session.user.role === "DONO" && (...)}`, ao lado de `<GerarTarefasButton />`.

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made (Claude's Discretion, per CONTEXT.md)

1. **Avulsas incluídas via OR createdAt-no-range.** `Tarefa.competencia` é `String?` — recorrentes carregam `"YYYY-MM"`, avulsas têm `competencia = null`. Um filtro simples `{ competencia: comp }` deixaria todas as avulsas de fora, violando a decisão travada "recorrentes E avulsas". O delete usa duas condições `OR`: recorrentes por `competencia = competenciaAtual()`; avulsas por `competencia = null` AND `createdAt` no range do mês atual, calculado em horário LOCAL via construtor de 3 argumentos (nunca string UTC).

2. **DesempenhoMensal também limpo.** Decidido limpar `DesempenhoMensal` da competência atual na mesma transação do delete de tarefas, porque os snapshots de desempenho são derivados das tarefas — deixá-los para trás faria o dashboard reportar números de um mês cujas tarefas não existem mais.

3. **Sem teste contra DB ao vivo.** Não há `DATABASE_URL` configurada neste ambiente local. A verificação foi limitada a `tsc --noEmit`, `npx next lint`, `npm run build` e `npm test` (vitest, mocks, não DB real). A action roda server-side no app já deployado em produção (Railway), não foi executada manualmente contra nenhum banco.

## Verification Results

- `npx tsc --noEmit`: sem erros.
- `npx next lint --file ... --file ...`: "No ESLint warnings or errors" nos arquivos da plan.
- `npm run build`: build de produção concluído com sucesso (avisos pré-existentes em `tarefas-table.tsx` e `scheduler.ts`, fora do escopo desta plan).
- `npm test` (vitest): 171/171 testes passando (29 arquivos), sem regressão.

## Self-Check

- `src/app/(app)/tarefas/excluir-tarefas-competencia-button.tsx`: FOUND
- `src/app/(app)/tarefas/actions.ts` (contém `excluirTarefasDaCompetenciaAtualAction`): FOUND
- `src/app/(app)/tarefas/page.tsx` (contém `ExcluirTarefasCompetenciaButton`): FOUND
- Commit `62b5b57` (Task 1): FOUND
- Commit `a03e4d6` (Task 2): FOUND

## Self-Check: PASSED
