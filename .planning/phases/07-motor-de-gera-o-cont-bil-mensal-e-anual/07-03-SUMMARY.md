---
phase: 07-motor-de-gera-o-cont-bil-mensal-e-anual
plan: 03
subsystem: testing
tags: [vitest, regression-test, visibility-scope, contabil, idor]

# Dependency graph
requires:
  - phase: 05-controle-de-acesso-multi-setor
    provides: "withVisibilityScope/withTarefaScope setor-aware (junction table EmpresaResponsavelSetor)"
provides:
  - "Regression test locking in CONT-06 (tarefa avulsa Contábil) as already satisfied by Phase 5 composition"
affects: [08-dashboards]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Regression-only plan pattern: mirror existing sector test (DP/Fiscal) to lock in CONT-06 without touching production code (D-12)"]

key-files:
  created: [tests/tarefas.contabil.test.ts]
  modified: []

key-decisions:
  - "CONT-06 satisfied entirely by composition with Phase 5 foundation (withVisibilityScope/withTarefaScope); no production code touched, only regression test added — same pattern as DP-05 (06-03)"

patterns-established:
  - "Pattern: when a new requirement is already implicitly covered by existing setor-aware infrastructure, add a regression test mirroring the prior sector's test 1:1 rather than writing new production code"

requirements-completed: [CONT-06]

# Metrics
duration: 5min
completed: 2026-06-24
---

# Phase 07 Plan 03: Regressão CONT-06 — Tarefa Avulsa Contábil Summary

**Teste de regressão `tests/tarefas.contabil.test.ts` provando que `criarTarefa` já suporta tarefas avulsas do setor CONTABIL por composição com `withVisibilityScope`/`withTarefaScope` da Fase 5, sem nenhuma mudança em código de produção.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 1 completed
- **Files modified:** 1 (new test file only)

## Accomplishments
- `tests/tarefas.contabil.test.ts` criado, espelhando `tests/tarefas.dp.test.ts` linha a linha
- 3 cenários cobertos: (a) criação de tarefa avulsa dentro do escopo do colaborador Contábil, (b) bloqueio ao tentar atribuir a outro colaborador, (c) bloqueio ao tentar usar empresa fora do escopo setor-aware
- Confirmado: zero mudança em `src/` — CONT-06 já estava satisfeito pela infraestrutura da Fase 5

## Task Commits

1. **Task 1: Teste de regressão CONT-06 — tarefa avulsa Contábil** - `afcdeb8` (test)

**Plan metadata:** (pending — committed by orchestrator per worktree mode)

## Files Created/Modified
- `tests/tarefas.contabil.test.ts` - Regressão CONT-06: 3 testes (criação dentro do escopo, bloqueio de atribuição a terceiro, bloqueio de empresa fora do escopo CONTABIL)

## Decisions Made
- Nenhuma decisão arquitetural nova — plan reusa 100% o padrão já estabelecido em 06-03 (DP-05) e a infraestrutura da Fase 5.

## Deviations from Plan

None - plan executado exatamente como escrito. `mockContabilColaboradorUser` já existia em `tests/setup.ts` (criado em Fase 5), confirmando a premissa do plan sem necessidade de ajuste.

## Issues Encountered

Nenhum problema durante a execução desta plan. Nota: `npm test` (suite completa) reporta 3 falhas pré-existentes em `tests/auth.test.ts` (`Cannot find package 'next/server'` — erro de resolução de módulo do `next-auth`/Next.js no ambiente de teste, introduzido na Fase 01 e não relacionado a este plan). Fora do escopo desta plan (Rule: scope boundary) — não foi tocado. `npx vitest run tests/tarefas.contabil.test.ts` (verificação exigida pelo plan) passa 3/3 verde.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CONT-06 travado por regressão; setor CONTABIL agora tem paridade de teste com Fiscal e DP para tarefas avulsas
- Pré-existente: falha de ambiente em `tests/auth.test.ts` (não relacionada a este plan) deve ser investigada separadamente antes de depender de `npm test` completo como gate de CI

---
*Phase: 07-motor-de-gera-o-cont-bil-mensal-e-anual*
*Completed: 2026-06-24*

## Self-Check: PASSED
- FOUND: tests/tarefas.contabil.test.ts
- FOUND: afcdeb8
