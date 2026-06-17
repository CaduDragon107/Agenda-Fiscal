---
phase: 02-gest-o-de-tarefas-avulsas-detalhe-e-alertas
plan: "02"
subsystem: camada-de-dados-e-server-actions-de-tarefas
tags: [prisma, queries, server-actions, zod, rbac, anti-idor, vitest, date-fns]
dependency_graph:
  requires:
    - "02-01 (schema Prisma Tarefa+TarefaHistorico, withTarefaScope, Wave 0 stubs)"
  provides:
    - "tarefaSchema Zod com prazo transformado para Date fim do dia local"
    - "listarTarefas, buscarTarefaPorId, contarAlertasTarefas (queries escopadas)"
    - "criarTarefa, concluirTarefa, excluirTarefa (Server Actions com guard sessão + anti-IDOR)"
    - "date-fns ^4.4.0 em dependencies para planos de UI"
  affects:
    - "src/modules/tarefas/ (novo diretório)"
    - "src/app/(app)/tarefas/ (novo diretório)"
    - "tests/tarefas.crud.test.ts (stubs → implementação real)"
    - "tests/tarefas.idor.test.ts (stubs → implementação real)"
    - "tests/tarefas.queries.test.ts (stubs → implementação real)"
    - "package.json (date-fns adicionado)"
tech_stack:
  added:
    - "date-fns ^4.4.0 — formatação de datas em pt-BR para plans de UI Wave 3"
  patterns:
    - "tarefaSchema.transform — prazo YYYY-MM-DD → Date(year, month-1, day, 23, 59, 59) sem UTC drift"
    - "TAREFA_SELECT constante com select explícito — nunca inclui senhaHash"
    - "findFirst (não findUnique) para queries com escopo composto id + withTarefaScope"
    - "db.$transaction([update, historicoCreate]) — atomicidade na conclusão de tarefa"
    - "Anti-IDOR: findFirst escopado ANTES de qualquer write; null → 'não encontrado' (nunca 403)"
key_files:
  created:
    - path: "src/modules/tarefas/schema.ts"
      description: "tarefaSchema Zod — titulo/empresaId/responsavelId/prazo obrigatórios; prazo transforma string em Date fim do dia local"
    - path: "src/modules/tarefas/queries.ts"
      description: "TAREFA_SELECT, listarTarefas, buscarTarefaPorId, contarAlertasTarefas — todas escopadas via withTarefaScope"
    - path: "src/app/(app)/tarefas/actions.ts"
      description: "Server Actions: criarTarefa, concluirTarefa, excluirTarefa — guard sessão + anti-IDOR + Zod parse"
  modified:
    - path: "tests/tarefas.crud.test.ts"
      description: "7 it.todo → 7 testes reais: criarTarefa (4), concluirTarefa (2), excluirTarefa (1)"
    - path: "tests/tarefas.idor.test.ts"
      description: "2 it.todo → 2 testes reais: COLABORADOR não pode concluir/excluir tarefa de outro"
    - path: "tests/tarefas.queries.test.ts"
      description: "3 it.todo → 3 testes reais: buscarTarefaPorId com escopo COLABORADOR/DONO"
    - path: "package.json"
      description: "date-fns ^4.4.0 adicionado em dependencies"
decisions:
  - "prazo transformado em Date(year, month-1, day, 23:59:59) local para evitar UTC drift em prazos fiscais (RESEARCH.md Pattern 8)"
  - "findFirst (não findUnique) em todas queries/mutations com escopo composto — findUnique não aceita filtros além de campos únicos"
  - "db.$transaction([update, create]) para concluirTarefa — atomicidade garante que status CONCLUIDA nunca fica sem TarefaHistorico"
  - "idempotência em concluirTarefa — status já CONCLUIDA → { ok: true } sem criar histórico duplicado"
  - "date-fns instalado nesta plan (Wave 2) para estar disponível nas plans de UI (Wave 3)"
metrics:
  duration: "4 min"
  completed: "2026-06-17"
  tasks_completed: 3
  files_changed: 7
---

# Phase 02 Plan 02: Camada de Dados e Server Actions de Tarefas — Summary

**One-liner:** tarefaSchema Zod + queries escopadas (listarTarefas, buscarTarefaPorId, contarAlertasTarefas) + Server Actions (criarTarefa, concluirTarefa com $transaction, excluirTarefa) com guard de sessão, anti-IDOR via findFirst escopado, e 12 novos testes verdes (59/59 na suite completa).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Schema Zod + queries escopadas de Tarefa | `7fd01a3` | `src/modules/tarefas/schema.ts`, `src/modules/tarefas/queries.ts` |
| 2 | Server Actions criarTarefa + concluirTarefa + excluirTarefa | `2b06c56` | `src/app/(app)/tarefas/actions.ts`, `tests/tarefas.crud.test.ts`, `tests/tarefas.idor.test.ts`, `tests/tarefas.queries.test.ts` |
| 3 | Instalar date-fns | `c718d28` | `package.json`, `package-lock.json` |

## Verification Results

```
npx tsc --noEmit
  → sem erros TypeScript

npx vitest run tests/tarefas.crud.test.ts tests/tarefas.idor.test.ts tests/tarefas.queries.test.ts
  → 12 passed (3 files)

npx vitest run tests/tarefas.crud.test.ts tests/tarefas.idor.test.ts tests/tarefas.queries.test.ts tests/alert-prazo.test.ts tests/visibility-scope.test.ts
  → 21 passed (5 files)

npx vitest run (suite completa)
  → 59 passed (13 files) — zero falhas, zero skipped

node -e "require('date-fns'); console.log('date-fns OK')"
  → date-fns OK
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

Nenhum stub restante nesta plan. Os 12 stubs Wave 0 das plans de tarefas foram preenchidos com implementações reais:

| Arquivo | Stubs preenchidos | Todos verdes? |
|---------|------------------|---------------|
| `tests/tarefas.crud.test.ts` | 7/7 | Sim |
| `tests/tarefas.idor.test.ts` | 2/2 | Sim |
| `tests/tarefas.queries.test.ts` | 3/3 | Sim |

## Threat Flags

Nenhuma superfície nova além do planejado. As mitigações T-02-IDOR, T-02-INPUT, T-02-UNAUTH, T-02-FK e T-02-SC documentadas no `<threat_model>` do plano foram implementadas e verificadas pelos testes.

## Self-Check: PASSED

- [x] `src/modules/tarefas/schema.ts` existe e exporta `tarefaSchema`, `TarefaInput`
- [x] `src/modules/tarefas/queries.ts` existe e exporta `listarTarefas`, `buscarTarefaPorId`, `contarAlertasTarefas`
- [x] TAREFA_SELECT sem `senhaHash` em nenhum nível
- [x] `src/app/(app)/tarefas/actions.ts` existe e exporta `criarTarefa`, `concluirTarefa`, `excluirTarefa`, `AcaoTarefaResult`
- [x] `tests/tarefas.crud.test.ts` — 7 testes reais passando
- [x] `tests/tarefas.idor.test.ts` — 2 testes reais passando
- [x] `tests/tarefas.queries.test.ts` — 3 testes reais passando
- [x] `date-fns` em `package.json` dependencies (`^4.4.0`)
- [x] Commits `7fd01a3`, `2b06c56`, `c718d28` verificados
