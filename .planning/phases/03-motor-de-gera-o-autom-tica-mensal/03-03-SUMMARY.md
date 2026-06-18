---
phase: 03-motor-de-gera-o-autom-tica-mensal
plan: 03
subsystem: frontend
tags: [server-actions, rbac, sonner, client-component]

# Dependency graph
requires:
  - phase: 03-motor-de-gera-o-autom-tica-mensal
    plan: 02
    provides: executarGeracaoMensal (orquestração idempotente createMany skipDuplicates)
  - phase: 03-motor-de-gera-o-autom-tica-mensal
    plan: 01
    provides: competenciaAtual, competenciaSchema
provides:
  - "gerarTarefasDoMesAction (src/app/(app)/tarefas/actions.ts) — Server Action DONO-only, auth+role guard antes de qualquer DB access, retorna { ok, criadas, puladas }"
  - "GerarTarefasButton (src/app/(app)/tarefas/gerar-tarefas-button.tsx) — client component com toast de resumo D-11 e router.refresh()"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RBAC server-side como primeiro check após auth(), antes de qualquer leitura/escrita no banco (V4 Access Control), mesmo padrão das demais actions do arquivo"
    - "Botão client gated por session.user.role === DONO no Server Component pai (defesa em profundidade) com a Server Action como enforcement real"

key-files:
  created:
    - src/app/(app)/tarefas/gerar-tarefas-button.tsx
    - tests/geracao.actions.test.ts
  modified:
    - src/app/(app)/tarefas/actions.ts
    - src/app/(app)/tarefas/page.tsx

key-decisions:
  - "gerarTarefasDoMesAction aceita competência opcional validada via competenciaSchema; sem argumento usa competenciaAtual() — o botão da UI nunca envia argumento, sempre usa o default da competência atual"
  - "GerarTarefasButton chama router.refresh() no sucesso (não revalidatePath client-side) para repopular a lista Server Component sem reload completo"
  - "TarefasTable, queries.ts e alert-prazo.ts permaneceram inalterados (D-14) — tarefas geradas fluem pela UI da Fase 2 sem nenhuma modificação"

requirements-completed: [TASK-01]

# Metrics
duration: ~15min
completed: 2026-06-18
---

# Phase 3 Plan 3: UI Gatilho Manual Summary

**Server Action DONO-only que expõe `executarGeracaoMensal` como botão manual de fallback em /tarefas, com guard server-side independente da visibilidade do botão e resumo de idempotência via toast**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (1 auto + 1 checkpoint human-verify)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `gerarTarefasDoMesAction` guarda `auth()` e `role !== "DONO"` como os dois primeiros checks, antes de qualquer acesso ao banco (T-3-01, T-3-05) — verificado por teste RBAC que assert `createMany` não é chamado para não-autenticado nem COLABORADOR
- Competência resolvida via `competenciaAtual()` por default, ou validada com `competenciaSchema` se informada explicitamente (T-3-06, V5 Pitfall 4)
- `GerarTarefasButton` (client component) renderizado apenas para DONO em `/tarefas`, ao lado de `NovaTarefaDialog`; mostra toast de sucesso "Geradas N tarefas novas, M já existiam" (D-11) e chama `router.refresh()`
- `npx tsc --noEmit` limpo e suíte completa (76 testes, 17 arquivos) verde
- Verificação humana aprovada: botão aparece só para DONO, clique dispara geração com toast de resumo correto, tarefas geradas aparecem na lista com badges de prazo da Fase 2, segunda execução mostra "0 novas" (idempotência visível), botão corretamente oculto para COLABORADOR

## Task Commits

Each task was committed atomically:

1. **Task 1: gerarTarefasDoMesAction (DONO-only) + teste RBAC** - `e89606e` (feat) — `src/app/(app)/tarefas/actions.ts` estendido; `tests/geracao.actions.test.ts` criado com casos RBAC (não autenticado, COLABORADOR, DONO com sucesso), todos verdes
2. **Task 2: Botão GerarTarefasButton + integração na página** - `a4a739f` (feat) — `gerar-tarefas-button.tsx` criado; `page.tsx` atualizado com render condicional `role === "DONO"`; verificação humana aprovada

## Files Created/Modified
- `src/app/(app)/tarefas/actions.ts` - `gerarTarefasDoMesAction(competencia?)`: auth guard → role DONO guard → resolve competência (`competenciaAtual()` ou `competenciaSchema.safeParse`) → `executarGeracaoMensal` → `revalidatePath("/tarefas")` → `{ ok: true, criadas, puladas }`; tipo `AcaoGeracaoResult` adicionado
- `src/app/(app)/tarefas/gerar-tarefas-button.tsx` - `GerarTarefasButton`: client component, `useState` pending, chama a action, `sonner` toast de sucesso/erro, `router.refresh()` no sucesso
- `src/app/(app)/tarefas/page.tsx` - import de `GerarTarefasButton`, renderizado condicionalmente (`session.user.role === "DONO"`) no header flex, ao lado de `NovaTarefaDialog`
- `tests/geracao.actions.test.ts` - mocks de `db`, `auth`, `next/cache`; casos RBAC (não autenticado, COLABORADOR rejeitados sem `createMany`) e caso de sucesso DONO

## Decisions Made
- Competência aceita como argumento opcional na action (não exposta na UI) para manter a porta aberta a uso programático/futuro sem violar V5 — validada com o mesmo `competenciaSchema` do Plano 01
- `router.refresh()` escolhido sobre qualquer estado client-side para repopular a lista, mantendo `listarTarefas` como única fonte de verdade no Server Component

## Deviations from Plan

None — plano executado exatamente como escrito. Implementação confere literalmente com os trechos de código descritos em `<action>` de ambas as tasks.

## Issues Encountered

None.

## User Setup Required

None.

## Human Verification

Checkpoint "Task 2: Botão GerarTarefasButton + integração na página + verificação visual" verificado manualmente via `npm run dev`:
- DONO: botão "Gerar tarefas do mês" aparece ao lado de "Nova tarefa"; clique dispara geração com toast de resumo correto; tarefas geradas aparecem na lista com badges de prazo (🔴/🟡) funcionando; segundo clique mostra "0 novas" (idempotência visível)
- COLABORADOR: botão corretamente oculto em `/tarefas`

Resultado: **approved**

## Next Phase Readiness

Phase 3 (Motor de Geração Automática Mensal) está completa — TASK-01 e TASK-02 fechados pelos três planos (fundação pura, orquestração+cron, UI gatilho manual). Próxima fase: Phase 4 (Dashboards Comparativos), sem bloqueios identificados.

---
*Phase: 03-motor-de-gera-o-autom-tica-mensal*
*Completed: 2026-06-18*

## Self-Check: PASSED

All created/modified files verified present (src/app/(app)/tarefas/actions.ts, src/app/(app)/tarefas/gerar-tarefas-button.tsx, src/app/(app)/tarefas/page.tsx, tests/geracao.actions.test.ts). Both task commits (e89606e, a4a739f) verified present in git log. `npx tsc --noEmit` and `npx vitest run` (76 tests, 17 files) both green at write time.
