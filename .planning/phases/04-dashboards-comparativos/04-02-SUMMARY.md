---
phase: 04-dashboards-comparativos
plan: 02
subsystem: backend
tags: [prisma, date-fns, vitest, snapshot, cron]

# Dependency graph
requires:
  - phase: 04-dashboards-comparativos/04-01
    provides: model DesempenhoMensal (Prisma), tests/dashboards.snapshot.test.ts Wave 0 scaffold
provides:
  - calcularSnapshotMensal(tx, competencia) — pure aggregation function exported from src/modules/dashboards/snapshot.ts
  - executarGeracaoMensal extended to freeze the previous month's DesempenhoMensal rows in the same transaction
affects: [04-03-dashboard-queries, 04-04-rbac-and-pages, 04-05-charts-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snapshot population query mirrors the live dashboard query exactly (filters by TarefaHistorico.concluidoEm in range, never Tarefa.competencia) to avoid a live->frozen discontinuity for tarefas avulsas"
    - "competenciaParaDataLocal(competencia) helper (3-arg Date constructor) replaces new Date(`${competencia}-01`) wherever a competência string must become a Date, to avoid UTC-parsing off-by-one in negative-offset timezones"

key-files:
  created:
    - src/modules/dashboards/snapshot.ts
  modified:
    - src/modules/tarefas/geracao.ts
    - tests/dashboards.snapshot.test.ts
    - tests/geracao.idempotencia.test.ts
    - tests/geracao.actions.test.ts

key-decisions:
  - "calcularSnapshotMensal filters population by TarefaHistorico.concluidoEm within [startOfMonth, endOfMonth] of the target competência, never by Tarefa.competencia — required to include tarefas avulsas (competencia=null) and match the live query's population exactly (T-04-SKEW)"
  - "Fixed a timezone bug found while testing: new Date(`${competencia}-01`) parses as UTC midnight, which renders as the last day of the PREVIOUS month in negative-offset timezones (e.g. Brazil GMT-03:00), shifting subMonths/startOfMonth one month back. Replaced with a competenciaParaDataLocal helper using the 3-arg Date constructor (always local) in both snapshot.ts and geracao.ts"
  - "Updated 3 pre-existing test files' tx mocks (geracao.idempotencia.test.ts, geracao.actions.test.ts) to include tarefa.findMany/empresa.groupBy/desempenhoMensal.createMany — executarGeracaoMensal's side effects changed when the snapshot step was added (Rule 3 — blocking issue, not a deviation from plan intent)"

patterns-established:
  - "Pattern: any future code converting a competência string to a Date MUST use competenciaParaDataLocal-style 3-arg Date construction, never new Date(`${competencia}-01`) — see Pitfall note in both modified files' header comments"

requirements-completed: [DASH-02]

# Metrics
duration: 28min
completed: 2026-06-22
---

# Phase 4 Plan 2: Congelamento de Meses Fechados Summary

**`calcularSnapshotMensal` agrega desempenho por colaborador filtrando por `TarefaHistorico.concluidoEm` (nunca `Tarefa.competencia`, garantindo paridade com a query live e incluindo tarefas avulsas), e `executarGeracaoMensal` agora congela o mês anterior na mesma transação, idempotente via `createMany skipDuplicates`.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-06-22T15:52:00Z (approx, per worktree commit graph)
- **Completed:** 2026-06-22T16:20:13Z
- **Tasks:** 2 completed
- **Files modified:** 5 (1 new, 4 modified) + 1 deferred-items log

## Accomplishments

- `src/modules/dashboards/snapshot.ts` created, exporting `calcularSnapshotMensal(tx, competencia)`. Population is filtered exclusively by `TarefaHistorico.concluidoEm` within the target month's range (`startOfMonth`/`endOfMonth`), never by `Tarefa.competencia` — this is the exact fix for the live→frozen discontinuity flagged as Blocker 1 in the plan-checker feedback (tarefas avulsas with `competencia=null` are correctly counted).
- All 4 `DesempenhoMensal` counters (`totalConcluidas`, `concluidasNoPrazo`, `totalEmpresas`, `totalTarefasPeriodo`) derive from the same `concluidoEm`-filtered population, consistent with the live query in Plan 04-03.
- `executarGeracaoMensal` (in `src/modules/tarefas/geracao.ts`) extended: as the first step inside the existing `db.$transaction`, it now computes `competenciaAnterior` and calls `calcularSnapshotMensal` + `tx.desempenhoMensal.createMany({ skipDuplicates: true })`, before generating the new month's tasks. Snapshot write and task generation share the same transaction boundary (atomic).
- Found and fixed a real timezone bug during test-writing: `new Date(`${competencia}-01`)` parses as UTC midnight, which in negative-offset timezones (Brazil, GMT-03:00) renders as the last day of the PREVIOUS month locally — this silently shifted `subMonths`/`startOfMonth` one month back, producing wrong `competenciaAnterior` values and wrong date ranges. Fixed via a `competenciaParaDataLocal` helper (3-arg `Date` constructor, always local) added to both `snapshot.ts` and `geracao.ts`.
- Test cases "avulsa", "boundary", "idempot", and the D-01/D-02/D-03 calculation cases all converted from `it.todo` scaffolds to real green tests in `tests/dashboards.snapshot.test.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implementar calcularSnapshotMensal (agregação por colaborador, filtrada por concluidoEm)** - `577af18` (feat)
2. **Task 2: Estender executarGeracaoMensal para congelar o mês anterior na mesma transação** - `99a5005` (feat)

_No plan-metadata commit in worktree mode — orchestrator handles shared-file updates after merge._

## Files Created/Modified

- `src/modules/dashboards/snapshot.ts` (NEW) - `calcularSnapshotMensal(tx, competencia)` pure aggregation; `competenciaParaDataLocal` helper; explicit `select` on all Prisma queries (no `responsavel: true`/`colaborador: true` leakage of `senhaHash`)
- `src/modules/tarefas/geracao.ts` (MODIFIED) - extended `executarGeracaoMensal` to call `calcularSnapshotMensal` + `tx.desempenhoMensal.createMany` before task generation, in the same transaction; added the same `competenciaParaDataLocal` helper; updated header comment to document DASH-02/D-04
- `tests/dashboards.snapshot.test.ts` (MODIFIED) - converted all 4 Wave 0 `it.todo` scaffolds into real tests, plus 3 additional calculation-focused cases (D-01/D-02/D-03 detail, status filter, select-leak guard); fixed a `vi.mock` hoisting warning by switching to `vi.hoisted`
- `tests/geracao.idempotencia.test.ts` (MODIFIED) - extended the `tx` mock with `tarefa.findMany`, `empresa.groupBy`, `desempenhoMensal.createMany` (defaulted to empty/no-op) since `executarGeracaoMensal`'s side effects changed; pre-existing Phase 3 assertions unchanged and still passing
- `tests/geracao.actions.test.ts` (MODIFIED) - same `tx` mock extension as above, for the Server Action's underlying call to `executarGeracaoMensal`
- `.planning/phases/04-dashboards-comparativos/deferred-items.md` (NEW) - logs the pre-existing, out-of-scope `tests/auth.test.ts` failure discovered during full-suite verification

## Decisions Made

- Population filter is by `concluidoEm` in range, never `Tarefa.competencia` — explicit plan requirement (Blocker 1 fix), implemented exactly as specified, not a deviation
- `competenciaParaDataLocal` helper added in both files to fix the timezone parsing bug (Rule 1 — auto-fixed bug, see Deviations below)
- No per-empresa snapshot rows (DASH-03 stays live-only) — out of this plan's scope, consistent with 04-01's decision

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed timezone off-by-one in competência-to-Date parsing**
- **Found during:** Task 2, while writing the "boundary" test case and observing `competenciaAnterior` resolve to the wrong month
- **Issue:** Both the plan's prescribed code (`new Date(`${competencia}-01`)`, copied verbatim from 04-RESEARCH.md Pattern 3) and the new `snapshot.ts` code parsed competência strings via ISO 8601 date-only format, which JS interprets as UTC midnight. In negative-offset timezones (Brazil, GMT-03:00, the deployment timezone per CLAUDE.md context), this renders as 21:00 the PREVIOUS day in local time — shifting `startOfMonth`/`endOfMonth` (date-fns, local-time-based) and `subMonths` one whole month backward. This would have caused `executarGeracaoMensal("2026-03")` to close out "2026-01" instead of "2026-02", silently breaking D-04/D-05 in production.
- **Fix:** Added `competenciaParaDataLocal(competencia)` helper using the 3-argument `Date` constructor (`new Date(ano, mes - 1, 1)`), which is always interpreted in local time regardless of timezone offset. Applied in both `src/modules/dashboards/snapshot.ts` and `src/modules/tarefas/geracao.ts`.
- **Files modified:** `src/modules/dashboards/snapshot.ts`, `src/modules/tarefas/geracao.ts`
- **Commit:** `99a5005`

**2. [Rule 3 - Blocking issue] Updated pre-existing test mocks for changed `tx` side effects**
- **Found during:** Task 2, running `npm run test` (full suite) for regression verification
- **Issue:** `tests/geracao.idempotencia.test.ts` and `tests/geracao.actions.test.ts` (both pre-existing from Phase 3) mock the Prisma `tx` client with only `empresa.findMany` and `tarefa.createMany`. Since `executarGeracaoMensal` now also calls `tx.tarefa.findMany`, `tx.empresa.groupBy`, and `tx.desempenhoMensal.createMany` (via `calcularSnapshotMensal`), these mocks threw `TypeError: tx.X is not a function`, blocking all tests in those files.
- **Fix:** Extended both mocks with the 3 new `tx` methods, defaulted to return empty/no-op results in `beforeEach`, so the pre-existing Phase 3 assertions (D-10/D-11/D-12) remain unaffected and green.
- **Files modified:** `tests/geracao.idempotencia.test.ts`, `tests/geracao.actions.test.ts`
- **Commit:** `99a5005`

## Issues Encountered

- `tests/dashboards.snapshot.test.ts` initially had a `vi.mock("@/lib/db")` call nested inside a `describe` block, which Vitest warned would become a hoisting error in a future version. Fixed by switching to `vi.hoisted()` + a module-level `vi.mock` call, consistent with Vitest's documented mocking pattern — no behavior change, just removed the warning before it could become a real error.
- `tests/auth.test.ts` (pre-existing, Phase 1) fails with `Cannot find package 'next/server'` when running the full suite in this worktree. Verified via `git stash`/`git stash pop` that this failure exists at the Task 1 commit (577af18), i.e. before any Plan 04-02 source changes — confirmed out of scope per the executor's scope-boundary rule. Logged to `.planning/phases/04-dashboards-comparativos/deferred-items.md` rather than fixed.

## User Setup Required

None — no external service configuration required. All changes are pure TypeScript/Prisma transaction logic against the already-configured Neon database.

## Next Phase Readiness

- `calcularSnapshotMensal` is ready for Plan 04-03's live query (`listarDesempenhoColaboradoresMesAtual`) to mirror its exact population filter, guaranteeing no live→frozen discontinuity
- `executarGeracaoMensal` now persists `DesempenhoMensal` rows automatically on every cron run / manual DONO trigger — Plan 04-03/04-04 can read frozen months directly from `db.desempenhoMensal` without ever recomputing them
- The `competenciaParaDataLocal` pattern is documented in both files' header comments for any future competência-to-Date conversion in this phase
- No blockers identified for Plan 04-03

---
*Phase: 04-dashboards-comparativos*
*Completed: 2026-06-22*

## Self-Check: PASSED

All created/modified files verified present on disk; all 3 commit hashes (577af18, 99a5005, a5f0f8f) verified present in git log.
