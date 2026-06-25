---
phase: 08-dashboards-multi-setor-dp-e-cont-bil
plan: 03
subsystem: dashboards
tags: [nextjs, react-server-components, tabs, shadcn]

requires: ["08-02"]
provides:
  - "EmptyState({ setor }) — parametrized empty-state component (D-04), src/app/(app)/dashboards/empty-state.tsx"
  - "carregarDadosDashboards — now returns Record<'FISCAL'|'DP'|'CONTABIL', {desempenhoColaboradores, evolucaoMensal, rankingEmpresas}>"
  - "/dashboards page — 3 tabs (Fiscal/DP/Contábil), default Fiscal, each tab rendering the same 3-Card layout via SectorDashboard"
affects: []

tech-stack:
  added: []
  patterns:
    - "guard.ts fans out the 3 sector queries via SETORES.map + Promise.all, keyed by a single empresaScopePorSetor record satisfying Record<Setor, Prisma.EmpresaWhereInput>"
    - "page.tsx extracts the existing 3-Card block into a local SectorDashboard({ setor, dados }) helper, rendered once per TabsContent — zero duplication of chart/table JSX"
    - "EmptyState extracted from page.tsx's prior inline function into its own file, now parametrized by setor via a COPY lookup record"

key-files:
  created:
    - src/app/(app)/dashboards/empty-state.tsx
  modified:
    - src/app/(app)/dashboards/guard.ts
    - src/app/(app)/dashboards/page.tsx

key-decisions:
  - "listarEvolucaoMensal is called with empresaScopePorSetor[setor] as its 3rd argument (empresaWhereExtra), diverging from 08-RESEARCH.md's Code Examples snippet which omitted that argument — Plan 08-02's SUMMARY explicitly added that optional 3rd parameter specifically so the live point's internal call to listarDesempenhoColaboradoresMesAtual could be DP CLT-isolated; omitting it here would have silently left the DP evolution chart's live point unscoped (T-08-03), so the verbatim research snippet was corrected per Rule 2 (missing critical sector-isolation behavior already designed for in Plan 02)."
  - "Task 2 (delete src/modules/dashboard/ singular orphan) was a no-op: the file and directory were already deleted earlier in this session in commit c453704 ('fix(08): remove orphaned dashboard/queries.ts blocking build'), before Wave 1 of this phase even started. Re-ran the import scan (grep -rn \"modules/dashboard[\\\"'/]\" src/) and confirmed zero matches; tsc --noEmit confirmed nothing references the deleted module. No new commit was needed for this task."

requirements-completed: [DP-06, DP-07, DP-08, CONT-07, CONT-08, CONT-09]

duration: ~25min
completed: 2026-06-25
---

# Phase 08 Plan 03: Wire multi-sector dashboard UI (tabs, sector-aware empty states) Summary

**The dono now sees 3 tabs (Fiscal/DP/Contábil) on `/dashboards`, each with the same 3 dashboards (desempenho/evolução/ranking) scoped by sector at the query layer, sector-aware empty-state copy, and the long-standing orphan `src/modules/dashboard/` module confirmed gone — closing Success Criterion #5.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3 of 3 completed — Task 3 (`checkpoint:human-verify`) approved by the dono
- **Files modified:** 3 (1 new component, 2 modified — guard.ts, page.tsx)

## Accomplishments

- `guard.ts`'s `carregarDadosDashboards` now fans out the 3 sector-parametrized query functions (from Plan 08-02) across `FISCAL`/`DP`/`CONTABIL` in parallel via `SETORES.map` + `Promise.all`, returning `Record<Setor, {desempenhoColaboradores, evolucaoMensal, rankingEmpresas}>` instead of a single flat object. The 3-line DONO-only guard (`auth()` → `redirect`; `role !== "DONO"` → `notFound()`) remains verbatim at the top, executing before any query — T-4-01 unaffected.
- `empresaScopePorSetor` (`{ FISCAL: {}, DP: { temFuncionariosClt: true }, CONTABIL: {} }`) is the single source of truth for D-02 (DP only CLT-bearing empresas) and D-03 (Contábil sees the full 197-empresa universe), passed to all 3 query functions for DP/CONTABIL.
- New `src/app/(app)/dashboards/empty-state.tsx` exports `EmptyState({ setor })`, replacing the prior inline `EmptyState()` function in `page.tsx`. The DP and Contábil copy explicitly name the sector ("de DP" / "de Contábil") per D-04, while the Fiscal copy is preserved verbatim (zero regression for existing users).
- `page.tsx` now renders `<Tabs defaultValue="FISCAL">` with 3 `TabsTrigger`s ("Fiscal", "DP", "Contábil", in that fixed order) and 3 `TabsContent`s, each rendering a new local `SectorDashboard({ setor, dados })` helper that contains the exact same 3-Card block (Desempenho/Evolução/Ranking) used by the pre-existing Fiscal-only page — each Card independently checks its own array length and renders `<EmptyState setor={setor} />` if empty, matching the UI-SPEC's "each card empty independently" interaction contract.
- The 3 chart/table components (`DesempenhoColaboradoresChart`, `EvolucaoMensalChart`, `RankingEmpresasTable`) were not touched — reused as-is across all 3 sectors via props, per the UI-SPEC's binding Component Reuse Contract.
- Confirmed `src/modules/dashboard/` (singular, orphan) does not exist (already deleted in commit `c453704` before this phase's Wave 1) and that zero real imports of `@/modules/dashboard` (singular) exist anywhere in `src/` — Success Criterion #5 satisfied.
- Full test suite (29 files, 169 tests) passes, including the unmodified `tests/dashboards.rbac.test.ts` regression gate for T-4-01.

## Task Commits

1. **Task 1: Guard fan-out por setor + EmptyState parametrizado + Tabs na página** - `3a6a4ac` (feat)
2. **Task 2: Deletar módulo órfão singular e verificar zero imports** - no commit (no-op; file/directory already absent from a prior session commit `c453704`, confirmed via re-scan + `tsc --noEmit`)

## Files Created/Modified

- `src/app/(app)/dashboards/empty-state.tsx` (NEW) - `COPY` record keyed by `"FISCAL"|"DP"|"CONTABIL"` with heading/body text from 08-UI-SPEC.md's Copywriting Contract; `EmptyState({ setor })` component with classNames pixel-identical to the original inline version
- `src/app/(app)/dashboards/guard.ts` - `carregarDadosDashboards` body replaced with a per-sector `Promise.all` fan-out; `empresaScopePorSetor` const added; guard auth/role lines kept verbatim at the top
- `src/app/(app)/dashboards/page.tsx` - imports `Tabs`/`TabsContent`/`TabsList`/`TabsTrigger` and `EmptyState`; removed the old inline `EmptyState` function; extracted the 3-Card block into a local `SectorDashboard({ setor, dados })` helper; renders `<Tabs defaultValue="FISCAL">` with 3 tabs

## Decisions Made

- `listarEvolucaoMensal` is called with the sector's `empresaWhereExtra` as its 3rd argument, departing from the literal RESEARCH.md "Code Examples" snippet (which calls it with only 2 args). This is a deliberate correction, not a deviation from intent: Plan 08-02 added that optional parameter specifically so the live point's internal `listarDesempenhoColaboradoresMesAtual` call could be DP CLT-isolated end-to-end (per 08-02-SUMMARY.md's documented decision). Omitting it here would silently leave the DP evolution chart's live "desempenho" half unscoped by `temFuncionariosClt`, while its "criadas" half (via `calcularCategoriasCriadas`) would remain correctly scoped — a partial sector leak. Passing it closes that gap.
- Task 2 required no new commit. The orphan `src/modules/dashboard/queries.ts` module and its directory were already deleted in this same session, before this phase's Wave 1, in commit `c453704` ("fix(08): remove orphaned dashboard/queries.ts blocking build") — confirmed by the plan's own `<context_note>`. Re-running the Pitfall 4 import scan (`grep -rn "modules/dashboard[\"'/]" src/`) after this plan's edits returned zero matches, and `tsc --noEmit` passed clean, satisfying all 3 of Task 2's acceptance criteria without any file changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `listarEvolucaoMensal` call in guard.ts passes `empresaScopePorSetor[setor]` as 3rd argument, not omitted as in RESEARCH.md's literal Code Examples snippet**
- **Found during:** Task 1, while writing `guard.ts`'s fan-out body
- **Issue:** The plan's `<action>` instructed copying the RESEARCH.md guard fan-out "verbatim," but that snippet calls `listarEvolucaoMensal(quantidadeMeses, setor)` — 2 args, no `empresaWhereExtra`. Plan 08-02's own SUMMARY documents that the 3rd parameter was added specifically so a future caller (this plan) could propagate the DP CLT filter to the live point's internal desempenho call. Calling it verbatim per RESEARCH.md would have left that gap unclosed — a sector-isolation correctness issue (T-08-03), not a cosmetic difference.
- **Fix:** Added `empresaScopePorSetor[setor]` as the 3rd argument to the `listarEvolucaoMensal` call in the fan-out.
- **Files modified:** `src/app/(app)/dashboards/guard.ts`
- **Commit:** `3a6a4ac` (bundled with Task 1, since this was a correctness requirement of the same code being written, not a separate follow-up)

Otherwise: plan executed as written — Task 2 confirmed as a pre-satisfied no-op (see Decisions Made above).

## Issues Encountered

None beyond the documented Rule 2 fix above.

## User Setup Required

None — no new packages, no environment variables, no external service configuration. `Tabs` was already installed (shadcn, pre-existing `src/components/ui/tabs.tsx`).

## Checkpoint Status

**Task 3 (`checkpoint:human-verify`, gate="blocking") approved by the dono.** Automated verification ahead of the checkpoint:

- `npx tsc --noEmit` — passes clean
- `npx vitest run tests/dashboards.rbac.test.ts` — 2/2 pass (T-4-01 regression gate intact)
- `npx vitest run` (full suite) — 169/169 tests pass across 29 files

The dono ran through `npm run dev`, logged in as DONO, and confirmed `/dashboards` renders 3 tabs (Fiscal default), all cards load in each tab, and sector-aware empty-state copy is correct. Approved directly in conversation with the orchestrator.

## Next Phase Readiness

- Phase 8 (dashboards-multi-setor-dp-e-cont-bil) is fully complete — all 3 plans (08-01, 08-02, 08-03) done, all 6 requirements (DP-06/07/08, CONT-07/08/09) satisfied.
- No outstanding code work remains in this phase.

---
*Phase: 08-dashboards-multi-setor-dp-e-cont-bil*
*Completed: 2026-06-25*
