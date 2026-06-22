---
phase: 04-dashboards-comparativos
plan: 04
subsystem: frontend
tags: [nextjs, server-components, recharts, tanstack-table, rbac, vitest]

# Dependency graph
requires:
  - phase: 04-dashboards-comparativos (Plan 01)
    provides: src/components/ui/chart.tsx, mesesSchema, tests/dashboards.rbac.test.ts Wave 0 scaffold
  - phase: 04-dashboards-comparativos (Plan 03)
    provides: listarDesempenhoColaboradoresMesAtual, listarEvolucaoMensal, listarRankingEmpresas (src/modules/dashboards/queries.ts)
provides:
  - "/dashboards route — DONO-only Server Component page rendering DASH-01/02/03"
  - "src/app/(app)/dashboards/guard.ts — carregarDadosDashboards(), testable guard+fetch orchestration"
  - "3 client chart/table components: DesempenhoColaboradoresChart, EvolucaoMensalChart, RankingEmpresasTable"
  - "Sidebar nav item Dashboards, DONO-only, pointing to /dashboards"
affects: [04-05-charts-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component guard+data-fetch logic extracted to a sibling .ts file (no JSX) when the page itself is .tsx, to allow direct unit testing without a JSX transform pipeline in Vitest (this project's vitest.config.ts has no @vitejs/plugin-react registered)"
    - "Chart components receive role-checked, serializable array props only — never fetch or check auth themselves (Server Component owns auth+data, client components own rendering)"

key-files:
  created:
    - src/app/(app)/dashboards/page.tsx
    - src/app/(app)/dashboards/guard.ts
    - src/app/(app)/dashboards/desempenho-colaboradores-chart.tsx
    - src/app/(app)/dashboards/evolucao-mensal-chart.tsx
    - src/app/(app)/dashboards/ranking-empresas-table.tsx
  modified:
    - src/app/(app)/app-sidebar.tsx
    - tests/dashboards.rbac.test.ts

key-decisions:
  - "Guard + Promise.all data-fetch orchestration extracted from page.tsx into a sibling guard.ts (carregarDadosDashboards) — page.tsx (.tsx, JSX) cannot be imported directly in this project's Vitest setup (no @vitejs/plugin-react in vitest.config.ts), so the plan's documented escape hatch ('extrair a lógica de guard para uma função testável') was applied to make the DONO-only guard unit-testable"
  - "RankingEmpresasTable defines its own LIMIAR_ALTO_ATRASO = 30 (%) threshold for the destructive Badge — not specified numerically in UI-SPEC/RESEARCH, chosen as a reasonable mid-point flag for 'problematic' companies, documented inline for future adjustment"
  - "redirect()/notFound() mocks in the RBAC test throw synchronously (matching Next.js's real runtime behavior) so the test can assert exactly which gate fired and that no dashboard query ran afterward, via expect(...).rejects.toThrow"

patterns-established:
  - "Pattern: when a Server Component page needs unit-testable guard logic and the test environment lacks JSX transform support, move the guard+fetch into a co-located .ts module the page imports and calls — keeps the page itself trivial (await guard, render JSX) while making the security-critical logic directly testable"

requirements-completed: [DASH-01, DASH-02, DASH-03]

# Metrics
duration: 25min
completed: 2026-06-22
---

# Phase 4 Plan 4: Camada de UI dos Dashboards Comparativos Summary

**`/dashboards` Server Component DONO-only (guard extraído para `guard.ts` testável), 3 componentes client de visualização (bar/area/ranking) consumindo `src/modules/dashboards/queries.ts`, e item de nav "Dashboards" habilitado na sidebar apenas para DONO.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-06-22T13:10:00Z (approx)
- **Completed:** 2026-06-22T13:38:00Z
- **Tasks:** 3 completed
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- `src/app/(app)/dashboards/page.tsx` renders the 3 stacked `Card` sections with exact UI-SPEC headings ("Dashboards" / "Desempenho por colaborador" / "Evolução mensal" / "Empresas com mais atrasos") and the documented empty-state copy when a dataset is empty.
- `src/app/(app)/dashboards/guard.ts` (`carregarDadosDashboards`) implements the DONO-only guard sequence exactly as specified: `auth()` → `redirect("/login")` if no session → `notFound()` if `role !== "DONO"` → THEN (and only then) `Promise.all` of the 3 dashboard queries. `?meses=` is validated via `mesesSchema` before reaching `listarEvolucaoMensal`, defaulting to 6 when absent/invalid.
- 3 client components built per RESEARCH.md Patterns 4/5/7: `DesempenhoColaboradoresChart` (bar, `min-h-[260px]`, tooltip in the exact UI-SPEC format), `EvolucaoMensalChart` (area chart over the mixed snapshot+live series), `RankingEmpresasTable` (top-10 horizontal bar chart + full TanStack Table with sortable "Empresa"/"% de atraso"/"Total de tarefas" columns, `Badge variant="destructive"` for rows at/above a 30% atraso threshold).
- Sidebar "Dashboards" placeholder replaced with the same `asChild`/`Link`/`isActive` shape used for "Tarefas", wrapped in `{isDono && (...)}` — COLABORADOR never sees the nav item.
- `tests/dashboards.rbac.test.ts` converted from Wave 0 `it.todo` scaffolds into 2 green tests asserting that neither an unauthenticated user nor a COLABORADOR ever triggers any of the 3 dashboard queries.

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Página /dashboards DONO-only + 3 componentes de visualização** - `a183386` (feat) — combined because `page.tsx` imports all 3 chart/table components and `npx tsc --noEmit` cannot pass with the page committed alone; both were developed in one coherent pass
2. **Task 3: Habilitar item de nav Dashboards na sidebar (DONO-only)** - `63f054e` (feat)

_No plan-metadata commit in worktree mode — orchestrator handles shared-file updates after merge._

## Files Created/Modified

- `src/app/(app)/dashboards/page.tsx` (NEW) - Server Component, default export `DashboardsPage`; awaits `carregarDadosDashboards(params?.meses)` then renders 3 `Card` sections + empty states
- `src/app/(app)/dashboards/guard.ts` (NEW) - `carregarDadosDashboards(meses?)`: auth+role guard (T-4-01) before any query, `?meses=` validation via `mesesSchema`, `Promise.all` of the 3 dashboard queries — extracted to a `.ts` file specifically to be unit-testable (see Decisions)
- `src/app/(app)/dashboards/desempenho-colaboradores-chart.tsx` (NEW) - `"use client"` bar chart, `ChartContainer min-h-[260px]`, `var(--chart-1)`/`var(--color-percentualNoPrazo)` tokens, tooltip format "{percentual}% no prazo ({totalConcluidas} tarefas, {totalEmpresas} empresas)"
- `src/app/(app)/dashboards/evolucao-mensal-chart.tsx` (NEW) - `"use client"` area chart over `{ competencia, percentual }[]`, same `min-h-[260px]`/color-token conventions
- `src/app/(app)/dashboards/ranking-empresas-table.tsx` (NEW) - `"use client"` horizontal bar chart (top 10) + `useReactTable` full list, columns "Empresa"/"% de atraso"/"Total de tarefas", `Badge variant="destructive"` at >=30% atraso, fully read-only (no mutation columns)
- `src/app/(app)/app-sidebar.tsx` (MODIFIED) - "Dashboards" `SidebarMenuItem` no longer `disabled`; now `<Link href="/dashboards">` with `isActive={pathname?.startsWith("/dashboards")}`, wrapped in `{isDono && (...)}`; no new imports (reused existing `LayoutDashboard`, `Link`)
- `tests/dashboards.rbac.test.ts` (MODIFIED) - 2 `it.todo` scaffolds converted to real tests against `guard.ts`'s `carregarDadosDashboards`, mocking `@/auth`, `next/navigation`, and `@/modules/dashboards/queries`

## Decisions Made

- Guard logic extracted to `guard.ts` instead of testing `page.tsx` directly — this project's `vitest.config.ts` has no `@vitejs/plugin-react`/JSX transform configured, and attempting to import a `.tsx` file containing JSX directly into a test fails with `Failed to parse source for import analysis... contains invalid JS syntax`. This matches the plan's own documented fallback ("Se testar a page diretamente for inviável... extrair a lógica de guard para uma função testável") — applied as written, not a deviation from plan intent.
- `LIMIAR_ALTO_ATRASO = 30` (%) chosen as the destructive-Badge threshold in the ranking table — UI-SPEC specifies the `Badge variant="destructive"` token but not a numeric cutoff; documented inline in the component for easy future tuning.
- Tasks 1 and 2 committed together (`a183386`) rather than as two sequential commits — `page.tsx` imports all 3 chart components by name, so `npx tsc --noEmit`/`npm run build` cannot pass with only `page.tsx` staged; both were developed in one coherent pass and are functionally inseparable at the commit boundary. Documented here for traceability per the executor's commit-granularity guidance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Extracted guard logic to a separate `.ts` file to make the RBAC test runnable**
- **Found during:** Task 1, first `npx vitest run tests/dashboards.rbac.test.ts` attempt
- **Issue:** Importing `src/app/(app)/dashboards/page.tsx` (a `.tsx` Server Component with JSX) directly into a Vitest test failed with `Failed to parse source for import analysis because the content contains invalid JS syntax` — this project's `vitest.config.ts` has no React/JSX Vite plugin registered, and no other test in the repo imports a `.tsx` file, confirming this is a real environment constraint, not a one-off fluke.
- **Fix:** Extracted the guard sequence (`auth()` → `redirect`/`notFound` → `Promise.all` of the 3 queries) into `src/app/(app)/dashboards/guard.ts` (`carregarDadosDashboards`), a plain `.ts` file with zero JSX. `page.tsx` now just awaits this function and renders JSX with the result. The test imports `guard.ts` directly, which parses and executes without any JSX transform. This exactly matches the plan's pre-written fallback instruction for this scenario.
- **Files modified:** `src/app/(app)/dashboards/page.tsx`, `src/app/(app)/dashboards/guard.ts` (new), `tests/dashboards.rbac.test.ts`
- **Commit:** `a183386`

**2. [Rule 1 - Bug] Fixed a TypeScript spread-argument type error in the RBAC test's `redirect` mock**
- **Found during:** Task 1, `npx tsc --noEmit -p tsconfig.json` verification step
- **Issue:** `const redirectMock = vi.fn(() => { throw ... })` infers a zero-argument function type; the mock implementation `redirect: (...args: unknown[]) => redirectMock(...args)` then fails to typecheck (`TS2556: A spread argument must either have a tuple type or be passed to a rest parameter`) because `redirectMock` itself doesn't accept a rest/spread argument.
- **Fix:** Typed `redirectMock`'s callback as `(..._args: unknown[]) => { throw ... }` so the spread call site typechecks correctly.
- **Files modified:** `tests/dashboards.rbac.test.ts`
- **Commit:** `a183386`

## Issues Encountered

- `npm run test` (full suite) reproduces the same pre-existing `tests/auth.test.ts` failure (3/4 tests, `Cannot find package 'next/server'`) already documented in `.planning/phases/04-dashboards-comparativos/deferred-items.md` by Plans 04-02 and 04-03 — confirmed out of scope per the executor's scope-boundary rule (pre-existing, unrelated to this plan's `files_modified`). This plan's target file (`tests/dashboards.rbac.test.ts`, 2 tests) passes 100%, `npx tsc --noEmit` is clean, and `npm run build` completes successfully with `/dashboards` registered as a dynamic route. No new entry added to `deferred-items.md` since this is the third independent confirmation of the exact same already-logged issue.

## User Setup Required

None — no external service configuration required. All changes are pure Next.js/React/TypeScript UI code consuming already-built query functions (Plan 04-03) and the already-installed shadcn chart component (Plan 04-01).

## Next Phase Readiness

- `/dashboards` is fully wired end-to-end: DONO sees 3 live sections, COLABORADOR gets a 404 on direct navigation, and the sidebar nav item only renders for DONO.
- All 3 DASH-01/02/03 requirements are now visually represented and gated, completing the phase's functional scope per `04-PLAN.md`'s success criteria.
- The `guard.ts` extraction pattern (testable Server Component guard logic in a sibling `.ts` file) is documented here for any future page in this codebase that needs the same RBAC-guard-unit-test treatment without adding a JSX transform dependency to the test runner.
- No blockers identified. Manual visual checkpoint (chart rendering, dark mode, sidebar collapse behavior) remains for the phase-level human verification step per `04-VALIDATION.md`'s "Sampling Rate" (DOM/canvas rendering cannot be fully asserted by Vitest alone).

---
*Phase: 04-dashboards-comparativos*
*Completed: 2026-06-22*
