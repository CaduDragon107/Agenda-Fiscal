---
phase: 04-dashboards-comparativos
verified: 2026-06-22T14:05:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 4: Dashboards Comparativos Verification Report

**Phase Goal:** O dono enxerga, em dashboards, o desempenho comparativo da equipe, a evolução mensal de cumprimento de prazos e quais empresas geram mais atrasos recorrentes.
**Verified:** 2026-06-22T14:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | DONO visualiza dashboard de desempenho por colaborador (% no prazo vs atrasado + contexto de carteira) | VERIFIED | `src/modules/dashboards/queries.ts:46-121` `listarDesempenhoColaboradoresMesAtual` computes `percentualNoPrazo`/`totalConcluidas`/`totalEmpresas` from a real `db.tarefa.findMany` + `db.empresa.groupBy`; rendered in `desempenho-colaboradores-chart.tsx` with tooltip showing volume context. Tests "colaboradores"/"volume" pass. |
| 2 | DONO visualiza evolução mensal com meses fechados estáveis (não recalculados retroativamente) | VERIFIED | `listarEvolucaoMensal` (`queries.ts:138-188`) reads closed months exclusively via `db.desempenhoMensal.groupBy`, never `db.tarefa` for closed competências (test asserts `tarefaFindManyMock` not called for frozen months — actually verified via the "frozen" test in `dashboards.snapshot.test.ts:272-317`, which shows recalculating in-memory data does NOT change the persisted snapshot — durability backed by `@@unique([competencia, colaboradorId])` + `skipDuplicates`). |
| 3 | Snapshot freeze mechanism is integrated into the same cron transaction as task generation (DASH-02 atomicity) | VERIFIED | `src/modules/tarefas/geracao.ts:54-92` — single `db.$transaction`, snapshot write (`calcularSnapshotMensal` + `tx.desempenhoMensal.createMany`) happens BEFORE task generation, same `tx`. No second transaction opened. |
| 4 | Snapshot freeze is idempotent (re-running generation for the same competência does not duplicate/corrupt rows) | VERIFIED | `prisma/schema.prisma:139` `@@unique([competencia, colaboradorId])` + `skipDuplicates: true` in `geracao.ts:63-66`. Test "idempot" (`dashboards.snapshot.test.ts:242-270`) confirms both calls use `skipDuplicates: true`; DB-level uniqueness is the actual idempotency guarantee (not application pre-check, avoiding TOCTOU — correct pattern, consistent with Phase 3's `Tarefa` idempotency). |
| 5 | Snapshot closes the month immediately PRECEDING the competência passed to executarGeracaoMensal (no off-by-one) | VERIFIED | Test "boundary" (`dashboards.snapshot.test.ts:204-240`) asserts `executarGeracaoMensal("2026-03")` queries Fevereiro (month index 1), not March/April. A real timezone bug (UTC midnight parsing causing an extra off-by-one in negative-offset zones) was found and fixed via `competenciaParaDataLocal` (3-arg `Date` constructor) in both `snapshot.ts` and `geracao.ts`. |
| 6 | DONO visualiza ranking de empresas por % de atraso, com regra distinta de "atrasada" (CONCLUIDA fora do prazo OU PENDENTE vencida) | VERIFIED | `listarRankingEmpresas` (`queries.ts:213-270`) implements D-06 exactly: `(status === "CONCLUIDA" && concluidoEm > prazo) || (status === "PENDENTE" && prazo < agora)`, sorted desc by `percentualAtraso`. Deliberately NOT shared with the D-02 colaborador rule (no common `isAtrasada` helper) — confirmed by direct code read. Tests "ranking" pass. |
| 7 | Dashboards are DONO-only; COLABORADOR is rejected before any query executes (RBAC is a real server-side gate, not UI hiding) | VERIFIED | `guard.ts:25-31` — `auth()` → `redirect` if no session → `notFound()` if `role !== "DONO"` → only then `Promise.all` of the 3 queries. `tests/dashboards.rbac.test.ts` (16 total dashboard tests, 2 RBAC-specific) asserts none of the 3 query functions are called for unauthenticated or COLABORADOR paths. Sidebar gating (`{isDono && (...)}` in `app-sidebar.tsx:107`) is confirmed as defense-in-depth only, not the real barrier — matches anti-IDOR pattern used elsewhere in the codebase (empresa edit, Phase 3 cron trigger). |
| 8 | Snapshot population matches the live query's population exactly (no live→frozen discontinuity, including avulsa tasks) | VERIFIED | Both `calcularSnapshotMensal` (`snapshot.ts:66-81`) and `listarDesempenhoColaboradoresMesAtual` (`queries.ts:55-70`) filter by `TarefaHistorico.concluidoEm` within `[startOfMonth, endOfMonth]`, never by `Tarefa.competencia`. Test "avulsa" (`dashboards.snapshot.test.ts:147-179`) explicitly asserts the where-clause never contains `competencia`, and that a task with no `Tarefa.competencia` field set but `concluidoEm` in range is still counted. |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | `model DesempenhoMensal` with `@@unique([competencia, colaboradorId])` | VERIFIED | Confirmed lines 128-143, all fields present, `@@map("desempenho_mensal")` present |
| `src/components/ui/chart.tsx` | shadcn chart wrappers | VERIFIED | Used by all 3 chart components, `ChartContainer`/`ChartTooltipContent` imported and used |
| `src/modules/dashboards/schema.ts` | `mesesSchema` zod validator | VERIFIED | Used in `guard.ts:30` via `mesesSchema.safeParse(meses)` before reaching `listarEvolucaoMensal` |
| `src/modules/dashboards/snapshot.ts` | `calcularSnapshotMensal(tx, competencia)` | VERIFIED | 127 lines, full aggregation logic, explicit `select`, no leak of `senhaHash` |
| `src/modules/dashboards/queries.ts` | 3 exported query functions | VERIFIED | All 3 exported, return plain arrays (never Map), 271 lines |
| `src/modules/tarefas/geracao.ts` | snapshot call inside same transaction | VERIFIED | Single `db.$transaction`, snapshot step first, atomic with task generation |
| `src/app/(app)/dashboards/page.tsx` | Server Component, 3 sections, guard | VERIFIED | Guard delegated to `guard.ts`; renders 3 `Card` sections with exact UI-SPEC headings |
| `src/app/(app)/dashboards/guard.ts` | testable guard + Promise.all | VERIFIED | `carregarDadosDashboards` — guard precedes all queries; unit tested directly |
| 3 chart/table components | bar/area/table+bar, `min-h-[260px]`, `var(--chart-N)` tokens | VERIFIED | All 3 confirmed via grep: `"use client"`, `min-h-[260px]`, no hardcoded hex/hsl colors |
| `src/app/(app)/app-sidebar.tsx` | nav item DONO-gated | VERIFIED | `{isDono && (...)}` wraps the Dashboards `SidebarMenuItem`, `Link href="/dashboards"` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `geracao.ts` | `snapshot.ts` | `calcularSnapshotMensal` import + `tx.desempenhoMensal.createMany` | WIRED | Confirmed in same transaction, before task generation |
| `snapshot.ts` | `Tarefa.responsavelId` | aggregation key | WIRED | `responsavelId` selected and used as Map key, never `Empresa.responsavelId` |
| `snapshot.ts` | `TarefaHistorico.concluidoEm` | population filter | WIRED | `historico: { some: { concluidoEm: {...} } }` — confirmed never filters by `Tarefa.competencia` |
| `page.tsx` | `queries.ts` | `Promise.all` via `guard.ts` | WIRED | All 3 functions called and results destructured into props |
| `app-sidebar.tsx` | `/dashboards` | `Link` gated by `isDono` | WIRED | Confirmed render-blocked for non-DONO |
| `guard.ts` | `next/navigation` | `notFound()`/`redirect()` before queries | WIRED | RBAC test asserts zero query calls on both rejection paths |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Dashboard-specific test suites pass | `npx vitest run tests/dashboards.queries.test.ts tests/dashboards.snapshot.test.ts tests/dashboards.rbac.test.ts` | 3 files, 16 tests passed | PASS |
| Full test suite has no regressions | `npx vitest run` (full suite, run once) | 20 files, 92 tests passed | PASS |
| TypeScript compiles cleanly | `npx tsc --noEmit -p tsconfig.json` | no output / exit 0 | PASS |
| Production build succeeds with `/dashboards` route registered | `npm run build` | Compiled successfully; `/dashboards` listed as dynamic (ƒ) route, 117 kB | PASS |
| `/dashboards` is DONO-only at the data layer | RBAC tests (`carregarDadosDashboards`) | both unauthenticated and COLABORADOR paths throw before any query mock is invoked | PASS |

Note: SUMMARY files (04-02, 04-03, 04-04) documented a pre-existing `tests/auth.test.ts` failure (`Cannot find package 'next/server'`) as an out-of-scope worktree artifact. Re-run at verification time shows the full suite (92 tests, 20 files) passes cleanly with zero failures — this issue has resolved itself post-merge, consistent with the SUMMARYs' own prediction.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DASH-01 | 04-01, 04-03, 04-04 | Dashboard comparativo de desempenho entre colaboradores | SATISFIED | `listarDesempenhoColaboradoresMesAtual` + `desempenho-colaboradores-chart.tsx`, rendered in page.tsx, RBAC-gated |
| DASH-02 | 04-01, 04-02, 04-03, 04-04 | Dashboard de evolução mensal com snapshot congelado | SATISFIED | `calcularSnapshotMensal` + `executarGeracaoMensal` extension + `listarEvolucaoMensal` + `evolucao-mensal-chart.tsx` |
| DASH-03 | 04-01, 04-03, 04-04 | Dashboard comparativo entre empresas por atraso | SATISFIED | `listarRankingEmpresas` (D-06 rule) + `ranking-empresas-table.tsx` |

**Note on REQUIREMENTS.md drift:** `.planning/REQUIREMENTS.md` lines 35-37 and 82-84 still show DASH-01/02/03 as unchecked (`[ ]`) / status "Pending". This is a stale tracking-document artifact — the code, tests, build, and human checkpoint (04-05) all confirm these requirements are implemented and working. Recommend updating REQUIREMENTS.md as a trivial follow-up; this does NOT block the phase goal, since the actual deliverable exists and functions.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(app)/dashboards/page.tsx` | 57-61 | Unreachable empty-state branch — `listarEvolucaoMensal` always returns ≥1 point (the live point), so `evolucaoMensal.length === 0` never triggers | Warning (carried from 04-REVIEW.md WR-01) | Cosmetic UX gap only on a brand-new install with zero completed tasks ever; does not affect DONO's ability to see the evolution chart once data exists. Does not threaten the phase goal. |
| `src/app/(app)/dashboards/ranking-empresas-table.tsx` | 9, 146 | Dead `getFilteredRowModel` registration with no filter UI wired | Info (carried from 04-REVIEW.md WR-02) | Inert boilerplate, no functional impact |
| `src/app/(app)/dashboards/guard.ts` | 30-40 | `?meses=` parameter affects evolution window but not ranking window (hardcoded 3-month range) | Warning (carried from 04-REVIEW.md WR-03) | Documented design choice (separate windows per dashboard, by design per RESEARCH.md); only becomes confusing if a future UI exposes a unified selector. No current UI element claims unified behavior. |
| `src/modules/dashboards/snapshot.ts` | 107-116 | `totalEmpresas` reflects company roster at generation time (next month), not the frozen competência's roster | Warning (carried from 04-REVIEW.md WR-04) | Data-semantics nuance for a context/secondary metric (not the primary % displayed), not a correctness bug in the primary D-01/D-02 percentages. Does not block the phase goal. |

None of the 4 carried-forward Warnings from 04-REVIEW.md are blockers — they are pre-existing, already-triaged quality notes that don't threaten DASH-01/02/03 delivery. No new Critical or Blocker-level anti-patterns were found during this verification pass (no TBD/FIXME/XXX markers in phase-modified files, no stub returns, no empty handlers).

### Human Verification Required

None outstanding. The phase's only human-verify checkpoint (04-05) already ran and the human confirmed "APROVADO" — 3 charts render correctly for DONO (axes, tooltips, data format) and COLABORADOR receives 404 on direct navigation, per `04-05-SUMMARY.md`. Per the verification brief, this checkpoint result is treated as satisfied and not re-litigated.

### Gaps Summary

No gaps. All 8 derived observable truths (covering the 3 roadmap Success Criteria plus the snapshot-mechanism internals called out in the verification brief — transaction-safety, idempotency, and RBAC-as-real-gate) are VERIFIED against actual code, not SUMMARY claims. Specifically:

- **Transaction-safety**: confirmed via direct read of `geracao.ts` — single `db.$transaction`, snapshot write precedes task generation, same `tx` instance throughout.
- **Idempotency**: confirmed via the `@@unique([competencia, colaboradorId])` Prisma constraint plus `skipDuplicates: true` at the call site — the actual DB-level guarantee, not an application-level pre-check (correctly avoids TOCTOU).
- **RBAC gate reality**: confirmed via `guard.ts` — `notFound()`/`redirect()` execute strictly before any of the 3 dashboard query functions are even invoked (verified by both code read and a passing unit test asserting zero query-mock calls on the rejected paths). The sidebar's `isDono` conditional is correctly understood as defense-in-depth, not the actual barrier.
- **Live↔frozen continuity**: confirmed via matching `concluidoEm`-range filters in both `snapshot.ts` and `queries.ts`, with an explicit "avulsa" test proving tarefas avulsas (competencia=null) are counted identically in both live and frozen paths.

The 4 Warning-level findings from `04-REVIEW.md` were independently re-confirmed by direct code inspection during this verification and are correctly classified as non-blocking — none of them cause DASH-01/02/03 to fail to deliver the dashboards or the freeze mechanism. The REQUIREMENTS.md checkbox/status drift is a documentation-only issue, contradicted by working code, tests (92/92 passing), and a successful production build with `/dashboards` registered as a live route.

---

_Verified: 2026-06-22T14:05:00Z_
_Verifier: Claude (gsd-verifier)_
