---
phase: 02-gest-o-de-tarefas-avulsas-detalhe-e-alertas
plan: "01"
subsystem: schema-e-infraestrutura-de-tarefas
tags: [prisma, schema, rbac, alertas, testes, wave-0]
dependency_graph:
  requires: []
  provides:
    - "Modelo Tarefa e TarefaHistorico no banco Neon"
    - "Enum TarefaStatus (PENDENTE, CONCLUIDA) no Prisma Client"
    - "Prisma.TarefaWhereInput disponível para plans seguintes"
    - "withTarefaScope(user) exportado de src/lib/visibility-scope.ts"
    - "calcularAlertaPrazo(prazo, status) exportado de src/lib/alert-prazo.ts"
    - "Wave 0 test stubs prontos para planos 02-02 e 02-03"
  affects:
    - "src/lib/visibility-scope.ts (estendido)"
    - "prisma/schema.prisma (extendido)"
tech_stack:
  added: []
  patterns:
    - "withTarefaScope análogo a withVisibilityScope — mesmo padrão RBAC de Fase 1"
    - "Helper puro calcularAlertaPrazo — comparação de Date sem dependências"
    - "Wave 0 stubs com it.todo sem imports de módulos inexistentes"
key_files:
  created:
    - path: "src/lib/alert-prazo.ts"
      description: "Helper puro calcularAlertaPrazo — retorna emoji, label, badgeClass, textClass"
    - path: "tests/alert-prazo.test.ts"
      description: "5 casos unitários cobrindo ALRT-01 — todos verdes"
    - path: "tests/tarefas.crud.test.ts"
      description: "7 stubs it.todo para TASK-03 (concluirTarefa/excluirTarefa) e TASK-04 (criarTarefa)"
    - path: "tests/tarefas.idor.test.ts"
      description: "2 stubs it.todo para T-02-IDOR (COLABORADOR não modifica tarefa de outro)"
    - path: "tests/tarefas.queries.test.ts"
      description: "3 stubs it.todo para TASK-05 (buscarTarefaPorId escopado)"
  modified:
    - path: "prisma/schema.prisma"
      description: "Adicionado enum TarefaStatus, model Tarefa (4 indexes), model TarefaHistorico (Cascade), relações inversas em Usuario e Empresa"
    - path: "src/lib/visibility-scope.ts"
      description: "Adicionado withTarefaScope retornando Prisma.TarefaWhereInput"
    - path: "tests/visibility-scope.test.ts"
      description: "Estendido com 2 casos de withTarefaScope (AUTH-02)"
decisions:
  - "withTarefaScope segue o padrão idêntico a withVisibilityScope: DONO → {}, COLABORADOR → { responsavelId: user.id }"
  - "calcularAlertaPrazo é helper puro sem dependências externas; usa Date.now() diretamente (sem date-fns nesta plan)"
  - "Wave 0 stubs usam it.todo sem callbacks para não importar módulos inexistentes; descrevem o contrato esperado nos comentários"
  - "npx prisma db push foi usado em vez de prisma migrate dev pois o ambiente Neon não tem shadow database configurado"
metrics:
  duration: "3 min"
  completed: "2026-06-17"
  tasks_completed: 3
  files_changed: 7
---

# Phase 02 Plan 01: Schema Prisma + Alert Helper + Wave 0 Stubs — Summary

**One-liner:** Schema Prisma estendido com Tarefa + TarefaHistorico aplicados ao Neon, helper calcularAlertaPrazo puro com testes verdes, withTarefaScope adicionado, e 5 arquivos de teste Wave 0 prontos para as plans seguintes.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Schema Prisma — Tarefa + TarefaHistorico + TarefaStatus | `6cf1206` | `prisma/schema.prisma` |
| 2 | calcularAlertaPrazo + withTarefaScope + testes verdes | `0a89b8c` | `src/lib/alert-prazo.ts`, `src/lib/visibility-scope.ts`, `tests/alert-prazo.test.ts`, `tests/visibility-scope.test.ts` |
| 3 | Wave 0 stubs — tarefas.crud, tarefas.idor, tarefas.queries | `0efd0e6` | `tests/tarefas.crud.test.ts`, `tests/tarefas.idor.test.ts`, `tests/tarefas.queries.test.ts` |

## Verification Results

```
npx prisma validate → The schema at prisma/schema.prisma is valid

npx vitest run tests/alert-prazo.test.ts tests/visibility-scope.test.ts
  → 9 passed (9)

npx vitest run tests/tarefas.crud.test.ts tests/tarefas.idor.test.ts tests/tarefas.queries.test.ts
  → 3 skipped | 12 todo (sem erros)

npx vitest run (suite completa)
  → 47 passed | 12 todo | 3 skipped (13 files)
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

Os seguintes stubs Wave 0 foram criados intencionalmente e serão preenchidos nas plans 02-02 e 02-03:

| Arquivo | Stubs | Plan que implementa |
|---------|-------|---------------------|
| `tests/tarefas.crud.test.ts` | 7 it.todo (criarTarefa, concluirTarefa, excluirTarefa) | Plan 02-02 (Server Actions) |
| `tests/tarefas.idor.test.ts` | 2 it.todo (IDOR concluir/excluir) | Plan 02-02 (Server Actions) |
| `tests/tarefas.queries.test.ts` | 3 it.todo (buscarTarefaPorId escopado) | Plan 02-03 (queries module) |

Estes stubs não impedem o objetivo desta plan (schema + helpers + infraestrutura), pois os módulos que eles testam (actions.ts, queries.ts) são criados nas plans subsequentes.

## Threat Flags

Nenhuma superfície nova além do planejado. O `withTarefaScope` implementa a mitigação T-02-IDOR documentada no `<threat_model>` do plano — aplicado em todas as queries de Tarefa pelas plans seguintes.

## Self-Check: PASSED

- [x] `prisma/schema.prisma` contém `model Tarefa`, `model TarefaHistorico`, `enum TarefaStatus`
- [x] `src/lib/alert-prazo.ts` exporta `calcularAlertaPrazo` e `AlertaPrazo`
- [x] `src/lib/visibility-scope.ts` exporta `withTarefaScope`
- [x] `tests/alert-prazo.test.ts` existe e passa (5 casos verdes)
- [x] `tests/visibility-scope.test.ts` estendido com `withTarefaScope` (4 casos verdes)
- [x] `tests/tarefas.crud.test.ts`, `tests/tarefas.idor.test.ts`, `tests/tarefas.queries.test.ts` existem e rodam sem erros
- [x] Commits `6cf1206`, `0a89b8c`, `0efd0e6` verificados em `git log`
