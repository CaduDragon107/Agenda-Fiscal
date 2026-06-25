---
phase: 08-dashboards-multi-setor-dp-e-cont-bil
plan: 02
subsystem: dashboards
tags: [prisma, postgres, multi-tenancy, dashboards]

requires: ["08-01"]
provides:
  - "listarDesempenhoColaboradoresMesAtual(mes, setor, empresaWhereExtra?) — sector-scoped desempenho query"
  - "listarEvolucaoMensal(quantidadeMeses, setor, empresaWhereExtra?) — sector-scoped evolution query, live point fully sector-isolated"
  - "listarRankingEmpresas(inicio, fim, setor, empresaWhereExtra?) — sector-scoped ranking query"
  - "calcularSnapshotMensal — writes 1 row per (colaborador, setor), LinhaSnapshotMensal.setor"
affects: ["08-03"]

tech-stack:
  added: []
  patterns:
    - "tarefaSetorWhere(setor) spread at top-level of Tarefa where clauses (AND-implicit merge with existing filters)"
    - "empresaWhereExtra applied only at the empresa-universe query (db.empresa.groupBy for desempenho), except listarRankingEmpresas where Tarefa has no separate empresa query so empresaWhereExtra is applied via the empresa relation filter"
    - "Post-aggregation enrichment lookup (db.usuario.findMany select {id, setor}) instead of joining setor into the Tarefa query — avoids a new join and matches existing snapshot.ts colaborador-grouping shape"

key-files:
  created: []
  modified:
    - src/modules/dashboards/queries.ts
    - src/modules/dashboards/snapshot.ts
    - tests/dashboards.queries.test.ts
    - tests/dashboards.snapshot.test.ts
    - tests/geracao.idempotencia.test.ts
    - tests/geracao.actions.test.ts

key-decisions:
  - "listarEvolucaoMensal gained an optional 3rd parameter (empresaWhereExtra: Prisma.EmpresaWhereInput = {}) even though the plan's must_haves.truths phrased the signature without it — needed so the live-point call to listarDesempenhoColaboradoresMesAtual can propagate the DP CLT filter when a future caller (Plan 03) needs it; defaults to {} so FISCAL/CONTABIL callers are unaffected"
  - "Colaborador with Usuario.setor === null is defensively skipped (row omitted) in calcularSnapshotMensal rather than thrown or defaulted to a guessed sector — DesempenhoMensal.setor is NOT NULL, and silently guessing a sector would be a worse failure mode than omitting the row"
  - "listarRankingEmpresas applies empresaWhereExtra via a relation filter (empresa: {...empresaWhereExtra}) directly on the Tarefa query — the one documented exception to 'never filter Tarefa by empresaWhereExtra', because ranking's universe IS the empresa universe and there is no separate db.empresa query to attach the filter to (per 08-PATTERNS.md)"

patterns-established:
  - "Sector isolation of the live point in listarEvolucaoMensal requires propagating setor to BOTH internal helpers (listarDesempenhoColaboradoresMesAtual AND calcularCategoriasCriadas) — propagating to only one would silently leave half the live point unscoped"

requirements-completed: [DP-06, DP-07, DP-08, CONT-07, CONT-08, CONT-09]

duration: ~35min
completed: 2026-06-25
---

# Phase 08 Plan 02: Parametrizar queries.ts e snapshot.ts por setor Summary

**The 3 dashboard query functions and the monthly snapshot now accept/derive a `setor` dimension, with the evolution chart's live point fully sector-isolated across both its internal helpers — zero duplication, zero Fiscal regression.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed
- **Files modified:** 6 (2 production modules, 4 test files — 2 of the test files were Rule-3 fixes outside the plan's declared `files_modified`, required because they mock `@/lib/db` and broke once `calcularSnapshotMensal` started calling `tx.usuario.findMany`)

## Accomplishments

- `listarDesempenhoColaboradoresMesAtual`, `listarEvolucaoMensal`, and `listarRankingEmpresas` in `src/modules/dashboards/queries.ts` now require an explicit `setor: Setor` parameter and merge `tarefaSetorWhere(setor)` into their `Tarefa` queries — DP/CONTABIL/FISCAL data can no longer leak across sectors (T-08-03 mitigated).
- The internal helper `calcularCategoriasCriadas` (powers the 5 "criadas" fields of `listarEvolucaoMensal`'s live point) also received `setor` and is sector-scoped — closing the gap the plan called out explicitly: without this, the live point's desempenho would be correctly scoped but its "criadas" categories would still mix all sectors.
- `db.desempenhoMensal.groupBy` in `listarEvolucaoMensal` now filters by `setor`, so closed months read from the Plan 08-01 migration are isolated per sector (D-05 preserved per-sector).
- `calcularSnapshotMensal` derives `setor` per colaborador via a single post-aggregation `Usuario` lookup (`select: { id, setor }`, never `colaborador: true`/`responsavel: true` — T-08-04 mitigated) and includes it in every returned `LinhaSnapshotMensal`. `geracao.ts`'s `tx.desempenhoMensal.createMany({ data: snapshots })` required no change — it already spreads the full row object, so `setor` flows through automatically.
- All pre-existing Fiscal-only test cases were updated to call with `"FISCAL"` explicitly and remain green — zero behavioral regression for the existing Fiscal dashboards.
- New tests prove sector isolation end-to-end: DP/CONTABIL cases for all 3 query functions, an explicit test that the live point's 5 "criadas" fields are sector-scoped (not just Fiscal-only implicit), and snapshot tests proving each colaborador's row carries their own `Usuario.setor`.

## Task Commits

1. **Task 1: Parametrizar as 3 funções de queries.ts por setor** - `ac4b233` (feat)
2. **Task 2: Tornar calcularSnapshotMensal setor-aware (1 linha por colaborador+setor)** - `41270aa` (feat)

## Files Created/Modified

- `src/modules/dashboards/queries.ts` - 3 exported functions gained `setor`/`empresaWhereExtra` params; `calcularCategoriasCriadas` gained `setor`; `tarefaSetorWhere` imported and merged into every `Tarefa` where clause; `db.desempenhoMensal.groupBy` filters by `setor`
- `src/modules/dashboards/snapshot.ts` - `LinhaSnapshotMensal.setor` added; `calcularSnapshotMensal` enriches each row via a `tx.usuario.findMany({ select: { id, setor } })` lookup, defensively skipping colaboradores with `setor === null`
- `tests/dashboards.queries.test.ts` - existing Fiscal cases updated to pass `"FISCAL"` explicitly; new DP/CONTABIL cases for all 3 functions; explicit live-point sector-isolation test
- `tests/dashboards.snapshot.test.ts` - `criarTxMock()` now mocks `tx.usuario.findMany` with a FISCAL default (keeps pre-existing tests green); new describe block covers DP/CONTABIL/FISCAL sector derivation, null-setor defensive skip, and explicit-select leak guard
- `tests/geracao.idempotencia.test.ts` - **Rule 3 fix (out of plan scope, required):** added `usuario.findMany` mock to its `@/lib/db` mock — broke when `calcularSnapshotMensal` started calling `tx.usuario.findMany` internally
- `tests/geracao.actions.test.ts` - **Rule 3 fix (out of plan scope, required):** same fix as above

## Decisions Made

- `listarEvolucaoMensal` gained an optional `empresaWhereExtra: Prisma.EmpresaWhereInput = {}` 3rd parameter so it can propagate the DP CLT filter to its internal live-point call to `listarDesempenhoColaboradoresMesAtual`. The plan's `must_haves.truths` described the signature without this parameter; adding it as optional with a safe default does not contradict that truth for FISCAL/CONTABIL callers (who never pass it) and unblocks Plan 03's DP dashboard wiring.
- `Usuario.setor === null` is handled by omitting the colaborador's snapshot row entirely (never throwing, never guessing a sector) — consistent with the project's existing "never throw, list and skip" pattern (D-02/D-03 in `geracao.ts`).
- `listarRankingEmpresas` applies `empresaWhereExtra` via an `empresa: {...empresaWhereExtra}` relation filter directly on the `Tarefa` query, the one documented exception to "never filter Tarefa by empresaWhereExtra" (08-PATTERNS.md) — ranking's universe IS the empresa universe and there's no separate `db.empresa` query to attach the filter to.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `tests/geracao.idempotencia.test.ts` and `tests/geracao.actions.test.ts` broke after Task 2**
- **Found during:** Task 2, full-suite verification after `calcularSnapshotMensal` change
- **Issue:** Both files mock `@/lib/db` locally (independent of `tests/dashboards.snapshot.test.ts`'s mock) to test `executarGeracaoMensal`/`gerarTarefasDoMesAction`, which call `calcularSnapshotMensal` internally. Neither mock included `tx.usuario.findMany`, so the new lookup call threw `TypeError: Cannot read properties of undefined (reading 'findMany')`.
- **Fix:** Added `usuario: { findMany: ... }` to both files' `@/lib/db` mock factories and a default `mockResolvedValue([...])` in their `beforeEach` blocks (FISCAL-sector stand-ins for the colaborador IDs already used by those tests).
- **Files modified:** `tests/geracao.idempotencia.test.ts`, `tests/geracao.actions.test.ts`
- **Commit:** `41270aa` (bundled with Task 2, since the fix was a direct consequence of and verification gate for that task's change)

Otherwise: plan executed exactly as written — both tasks' production code matches the plan's `<action>` instructions verbatim (signatures, merge points, defensive null handling).

## Issues Encountered

None beyond the Rule 3 test-mock fix documented above.

## User Setup Required

None — no external service configuration required, no new packages installed.

## Next Phase Readiness

- Plan 08-03 (UI wiring — `guard.ts` and `page.tsx`) can now call all 3 query functions with an explicit `setor` and the appropriate `empresaWhereExtra` (`{ temFuncionariosClt: true }` for DP per D-02, `{}` for CONTABIL/FISCAL).
- `guard.ts`'s pre-existing `tsc --noEmit` errors (calling the 3 functions with their old 1-2 arg signatures) are expected and out of this plan's scope — Plan 08-03 is responsible for updating those call sites.
- `desempenho_mensal` table will start accumulating per-sector rows the next time `executarGeracaoMensal` runs for a closed month with DP/Contábil colaboradores present (table remains correctly empty until then, per 08-01's readiness note).

---
*Phase: 08-dashboards-multi-setor-dp-e-cont-bil*
*Completed: 2026-06-25*
