---
phase: 04-dashboards-comparativos
reviewed: 2026-06-22T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - prisma/schema.prisma
  - src/app/(app)/app-sidebar.tsx
  - src/app/(app)/dashboards/desempenho-colaboradores-chart.tsx
  - src/app/(app)/dashboards/evolucao-mensal-chart.tsx
  - src/app/(app)/dashboards/guard.ts
  - src/app/(app)/dashboards/page.tsx
  - src/app/(app)/dashboards/ranking-empresas-table.tsx
  - src/components/ui/chart.tsx
  - src/modules/dashboards/queries.ts
  - src/modules/dashboards/schema.ts
  - src/modules/dashboards/snapshot.ts
  - src/modules/tarefas/geracao.ts
  - tests/dashboards.queries.test.ts
  - tests/dashboards.rbac.test.ts
  - tests/dashboards.snapshot.test.ts
  - tests/geracao.actions.test.ts
  - tests/geracao.idempotencia.test.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-06-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the dashboards comparativos feature (DASH-01/02/03): RBAC guard, three
read-only query functions, the monthly snapshot freezing mechanism integrated
into `executarGeracaoMensal`, the chart/table presentation components, and the
associated unit tests. The DONO-only access gate is correctly implemented as a
real barrier (`notFound()` before any query, mirroring the established
anti-IDOR pattern), the live/frozen continuity logic for monthly evolution is
carefully reasoned through code comments, and idempotency for the snapshot
write piggybacks correctly on the existing `skipDuplicates` + unique-constraint
pattern. No critical/security-class defects were found in this batch.

The issues found are mostly quality/robustness gaps: an unreachable
"empty state" branch in `page.tsx`, dead TanStack Table filtering wiring in the
ranking table, an undocumented mismatch between the `?meses=` query parameter
and the (hardcoded) ranking window, and a historical-accuracy caveat in the
"empresas ativas" count baked into frozen snapshots. None of these block
shipping but should be tracked.

## Warnings

### WR-01: `evolucaoMensal.length === 0` empty-state branch in page.tsx is unreachable

**File:** `src/app/(app)/dashboards/page.tsx:57-61`
**Issue:** `listarEvolucaoMensal` (src/modules/dashboards/queries.ts:138-188) always
appends exactly one "live" point for the current month (`pontoAtual`) to the
returned array, in addition to zero or more closed-month points. The function
therefore can never return an empty array — the minimum length is 1. As a
result, the `evolucaoMensal.length === 0 ? <EmptyState /> : <EvolucaoMensalChart .../>`
branch in `page.tsx` is dead code: it will never render, even on a brand new
installation with zero tasks ever completed. Instead of the intended
"Ainda não há dados suficientes" message, a brand-new install will silently
render a chart with a single 0% data point, which is a confusing UX for the
exact scenario the empty state was designed to cover.
**Fix:** Either have `listarEvolucaoMensal` omit the live point when there is
no underlying data (`totalAtual.total === 0` and no closed points), or change
the page-level condition to check the meaningful state directly, e.g.:
```tsx
const semDadosEvolucao =
  evolucaoMensal.every((p) => p.percentual === 0) && evolucaoMensal.length <= 1;
```
or, cleaner, have the query return `[]` when there is truly nothing to show and
let the live point be appended only when there is at least one closed point or
at least one concluded task this month.

### WR-02: Dead TanStack Table filtering wiring in RankingEmpresasTable

**File:** `src/app/(app)/dashboards/ranking-empresas-table.tsx:9,146`
**Issue:** `getFilteredRowModel` is imported from `@tanstack/react-table` and
registered on the table instance (`getFilteredRowModel: getFilteredRowModel()`),
but there is no `columnFilters`/`globalFilter` state, no filter input UI, and
no `state.columnFilters` wired up anywhere in the component. The row model is
registered but never actually used to filter anything — it's inert
boilerplate that adds confusion for future maintainers expecting a filter
feature to exist.
**Fix:** Remove the unused `getFilteredRowModel` import and registration, or
if filtering was intended to ship in this phase, wire up an input + state and
add it to `columnFilters`.

### WR-03: `?meses=` query parameter silently has no effect on the ranking dashboard's time window

**File:** `src/app/(app)/dashboards/guard.ts:30-40`
**Issue:** `carregarDadosDashboards` parses the `meses` query parameter and
applies it to `listarEvolucaoMensal(quantidadeMeses)`, but `listarRankingEmpresas`
is always called with a hardcoded `inicio3Meses = subMonths(hoje, 3)` window
regardless of the `meses` parameter's value. If a future iteration exposes a
`meses` selector in the UI (a natural next step given the parameter already
exists and is validated), a user changing the selector would see the evolution
chart's window change but the ranking table/chart silently keep using a fixed
3-month window — a surprising and hard-to-debug behavioral split for anyone
unaware that ranking intentionally uses a separate, undocumented-in-UI window.
**Fix:** At minimum, add an inline comment in `guard.ts` next to
`inicio3Meses` explicitly stating "intentionally independent of `meses`,
documented in queries.ts DASH-03 docstring" so a future contributor wiring up
a UI selector does not assume the same `meses` value drives both. If a unified
period selector is desired, parameterize `listarRankingEmpresas`'s window with
the same `quantidadeMeses` value.

### WR-04: Frozen snapshot's `totalEmpresas` reflects company roster at *generation* time, not at the *competência* being frozen

**File:** `src/modules/dashboards/snapshot.ts:107-116`, `src/modules/tarefas/geracao.ts:55-67`
**Issue:** `calcularSnapshotMensal` computes `totalEmpresas` via
`tx.empresa.groupBy({ where: { ativo: true } })`, which reflects the set of
companies active *right now* (at the moment `executarGeracaoMensal` runs for
the next month), not the set of companies that were active during the
competência being frozen (the month just closed). Because the snapshot is
written once and protected by `skipDuplicates`, this value is captured exactly
once, permanently, using current-roster data evaluated one month after the
fact. If companies are added/deactivated between the end of the frozen month
and the cron run that freezes it (which is normal, since the snapshot for
month M is only written when generating tasks for month M+1), the
`totalEmpresas` context number for month M's dashboard becomes slightly stale
relative to "how many companies were actually being served in month M."
**Fix:** This is a product/data-semantics decision, not a crash risk, so it
may be intentional — but it should be explicit. Either document this caveat
directly in the `DesempenhoMensal.totalEmpresas` Prisma schema comment (it is
currently undocumented in `prisma/schema.prisma:128-143`), or, if "roster at
the time of the competência" is the intended semantics, capture
`totalEmpresas` using `EmpresaRegimeHistorico`/an "ativo as of end of
competência" query instead of "ativo now."

## Info

### IN-01: Test mock for `desempenhoMensalGroupByMock` not reset in the `listarDesempenhoColaboradoresMesAtual` describe block's `beforeEach`

**File:** `tests/dashboards.queries.test.ts:33-38`
**Issue:** The top-level mocks include `desempenhoMensalGroupByMock`, but the
`beforeEach` inside `describe("listarDesempenhoColaboradoresMesAtual", ...)`
(lines 34-38) only resets `tarefaFindManyMock`, `empresaGroupByMock`, and
`usuarioFindManyMock` — it omits `desempenhoMensalGroupByMock.mockReset()`.
Currently harmless because `listarDesempenhoColaboradoresMesAtual` never calls
`db.desempenhoMensal.groupBy`, but it is an inconsistency versus the second
`describe` block (`listarEvolucaoMensal`, line 153) which does reset it. A
future refactor that makes the first function start using that mock could
silently leak mock state between tests in this file.
**Fix:** Add `desempenhoMensalGroupByMock.mockReset();` to the first
`beforeEach` for consistency, even though it is currently a no-op.

### IN-02: `ChartTooltipContent` `formatter` callback in `desempenho-colaboradores-chart.tsx` accesses `item.payload` fields without a type guard

**File:** `src/app/(app)/dashboards/desempenho-colaboradores-chart.tsx:45-48`
**Issue:** `item.payload.totalConcluidas` / `item.payload.totalEmpresas` are
accessed directly inside the `formatter` callback. `item.payload` is typed
generically by Recharts (effectively `any`/`unknown` shape from the library's
perspective), so there is no compile-time guarantee that these fields exist on
the payload at the call site if the `dados` shape passed to the chart ever
changes without updating this formatter. Today the shapes line up because
`page.tsx` always passes the same `DesempenhoColaborador[]` shape, but nothing
enforces that invariant at the formatter boundary.
**Fix:** Not required for this phase, but consider narrowing the payload type
locally (`item.payload as DesempenhoColaborador`) so a future shape change at
least produces a visible type error instead of a silent `undefined` rendering
in the tooltip.

### IN-03: Hardcoded `LIMIAR_ALTO_ATRASO = 30` magic-number threshold has no single source of truth with badge thresholds elsewhere in the app

**File:** `src/app/(app)/dashboards/ranking-empresas-table.tsx:50`
**Issue:** The 30% "alto atraso" threshold for the destructive Badge variant
is a local constant in this file only. If similar visual severity thresholds
exist or get added elsewhere (e.g., a future per-empresa detail view), there
is no shared module establishing this threshold, risking silent drift between
different parts of the UI that should agree on what counts as "alto atraso."
**Fix:** Low priority for a single-file v1; if a second consumer of this
threshold appears, extract it to a shared constants module
(e.g., `src/modules/dashboards/constants.ts`).

### IN-04: `EmpresaRegimeHistorico.dataFim` is never written/closed anywhere in the reviewed files

**File:** `prisma/schema.prisma:77-87`
**Issue:** The `EmpresaRegimeHistorico` model has a nullable `dataFim` field
clearly intended to be set when a regime change closes out a historical
period, but none of the dashboards or geração modules in this phase write to
it. This isn't a regression introduced by this phase (the model predates it),
but it is referenced in code comments in this phase
(`src/modules/tarefas/geracao.ts:5` — "D-12 — regime ATUAL, nunca via
`empresaRegimeHistorico`") as deliberately unused for task generation, so its
write-path may simply live in a different, unreviewed module. Flagging for
visibility in case no module anywhere closes `dataFim`, which would make the
entire historico table write-only with stale/incomplete data.
**Fix:** No action needed if `dataFim` is populated by Phase 1/2 empresa-edit
logic (outside this review's scope) — verify in a future pass if not already
confirmed.

---

_Reviewed: 2026-06-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
