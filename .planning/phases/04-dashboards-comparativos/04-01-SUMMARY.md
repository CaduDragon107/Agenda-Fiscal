---
phase: 04-dashboards-comparativos
plan: 01
subsystem: database
tags: [prisma, postgresql, zod, shadcn, recharts, vitest]

# Dependency graph
requires:
  - phase: 03-motor-de-gera-o-autom-tica-mensal
    provides: Tarefa/TarefaHistorico/Empresa/Usuario models, executarGeracaoMensal boot-time cron entry point
provides:
  - model DesempenhoMensal (Prisma) with @@unique([competencia, colaboradorId]) snapshot table
  - src/components/ui/chart.tsx (shadcn chart wrappers) + recharts dependency
  - mesesSchema (zod) validating ?meses= query param for DASH-02
  - tests/dashboards.queries.test.ts, tests/dashboards.snapshot.test.ts, tests/dashboards.rbac.test.ts Wave 0 scaffolds
affects: [04-02-snapshot-population, 04-03-dashboard-queries, 04-04-rbac-and-pages, 04-05-charts-ui]

# Tech tracking
tech-stack:
  added: [recharts@3.8.0 (via shadcn CLI), shadcn chart component]
  patterns:
    - "Snapshot table per (competencia, colaboradorId) with createMany/skipDuplicates idempotency, mirroring Tarefa's @@unique idempotency key"
    - "Dedicated zod schema module per validated query param (mesesSchema mirrors competenciaSchema in src/lib/competencia.ts)"
    - "Wave 0 test scaffolds use it.todo without callback to avoid importing not-yet-existing modules"

key-files:
  created:
    - src/modules/dashboards/schema.ts
    - tests/dashboards.queries.test.ts
    - tests/dashboards.snapshot.test.ts
    - tests/dashboards.rbac.test.ts
    - src/components/ui/chart.tsx
  modified:
    - prisma/schema.prisma
    - package.json
    - package-lock.json

key-decisions:
  - "DesempenhoMensal stores raw numerator/denominator counters (totalConcluidas, concluidasNoPrazo, totalEmpresas, totalTarefasPeriodo) rather than a pre-computed percentage, deferring rounding decisions to the read layer (D-01/D-02/D-03)"
  - "No per-empresa rows in DesempenhoMensal — DASH-03 company ranking stays live-only in v1 per 04-RESEARCH.md A1"
  - "recharts installed exclusively via npx shadcn add chart (never npm install recharts directly), per CLAUDE.md mandate and 04-RESEARCH.md Package Legitimacy Audit (verdict OK)"

patterns-established:
  - "Pattern: snapshot tables for frozen historical aggregates use @@unique on the natural key (competencia + entity id) + createMany skipDuplicates for idempotent writes"
  - "Pattern: query-param validation schemas live in a dedicated per-module schema.ts file, one zod schema per exported const, never inlined at the call site"

requirements-completed: [DASH-01, DASH-02, DASH-03]

# Metrics
duration: 7min
completed: 2026-06-22
---

# Phase 4 Plan 1: Fundação dos Dashboards Comparativos Summary

**Prisma model DesempenhoMensal (snapshot idempotente por competência/colaborador), componente shadcn chart com recharts, schema zod de validação de `?meses=`, e 3 suites de teste Wave 0 prontas para receber os casos vermelhos das próximas plans.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-22T12:04:59Z
- **Completed:** 2026-06-22T12:12:20Z
- **Tasks:** 3 completed
- **Files modified:** 9 (1 schema, 4 new files, 3 new test files, 1 lockfile pair)

## Accomplishments
- `model DesempenhoMensal` added to `prisma/schema.prisma` with `@@unique([competencia, colaboradorId])`, applied to the Neon database via `npx prisma db push` (no shadow database, Phase 02/03 precedent) — `db.desempenhoMensal` confirmed exposed on the generated Prisma Client
- `src/components/ui/chart.tsx` installed via `npx shadcn@latest add chart`, adding `recharts@3.8.0` as a transitive dependency in `package.json`/`package-lock.json`
- `src/modules/dashboards/schema.ts` created, exporting `mesesSchema` (`z.coerce.number().int().min(1).max(24)`) to validate the DASH-02 `?meses=` window parameter
- 3 Wave 0 test scaffolds created with named `it.todo` cases matching the exact substrings VALIDATION.md's `-t` filters expect ("colaboradores", "volume", "ranking", "frozen", "idempot", "boundary", "avulsa", "DONO")

## Task Commits

Each task was committed atomically:

1. **Task 1: Adicionar model DesempenhoMensal e aplicar db push** - `077c4b8` (feat)
2. **Task 2: Instalar componente shadcn chart e criar schema de validação de meses** - `97feb9f` (feat)
3. **Task 3: Criar scaffolds de teste (Wave 0) para as 3 suites da fase** - `590bd13` (test)

_No plan-metadata commit in worktree mode — orchestrator handles shared-file updates after merge._

## Files Created/Modified
- `prisma/schema.prisma` - Added `model DesempenhoMensal` (id, competencia, colaboradorId/colaborador relation, 4 raw counters, createdAt) with `@@unique([competencia, colaboradorId])`, `@@index([competencia])`, `@@index([colaboradorId])`, `@@map("desempenho_mensal")`; added reverse relation `desempenhoMensal DesempenhoMensal[]` on `model Usuario`
- `src/components/ui/chart.tsx` - shadcn-generated chart wrappers (`ChartContainer`, `ChartConfig`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`) over Recharts
- `src/modules/dashboards/schema.ts` - `mesesSchema` zod validator for the `?meses=` query param, header comment explaining the ASVS V5 tampering pitfall it mitigates
- `tests/dashboards.queries.test.ts` - 6 `it.todo` cases for DASH-01/DASH-03 (D-01, D-02, D-03, D-06 ranking — 2 cases)
- `tests/dashboards.snapshot.test.ts` - 4 `it.todo` cases for DASH-02 (frozen/D-05, idempot, boundary, avulsa)
- `tests/dashboards.rbac.test.ts` - 2 `it.todo` cases for the DONO-only guard (unauthenticated, COLABORADOR)
- `package.json` / `package-lock.json` - `recharts@^3.8.0` added (transitive, via shadcn CLI, not `npm install` directly)

## Decisions Made
- Raw numerator/denominator counters stored in `DesempenhoMensal` instead of a pre-computed percentage column, so rounding/display decisions stay in the read layer (matches plan's explicit instruction, not a deviation)
- No per-empresa snapshot rows — DASH-03's company ranking remains live-only per 04-RESEARCH.md's "A1" decision, consistent with the plan's explicit scope
- Copied `.env` from the parent repository into the worktree (gitignored, not committed) so that `npx prisma validate`/`db push`/`generate` could resolve `DATABASE_URL`/`DIRECT_URL` — required for Task 1's verification; no schema or production credentials were modified, this only enabled local tooling to read the existing Neon connection string already used by the main repo

## Deviations from Plan

None - plan executed exactly as written. All three tasks completed with their specified acceptance criteria met on the first attempt; no Rule 1-4 fixes were required.

## Issues Encountered
- Initial `npx tsc --noEmit` run showed 8 pre-existing type errors unrelated to this plan's files (stale Prisma Client output path resolving one directory level above the worktree's own `node_modules`). Re-running `npx prisma generate` regenerated the client into the worktree-local `node_modules/@prisma/client`, after which `npx tsc --noEmit` passed with zero errors. This was an environment-resolution artifact, not a code defect introduced by this plan, and required no source changes — included here for traceability since it occurred between Task 1 and Task 2.

## User Setup Required

None - no external service configuration required. The `DesempenhoMensal` table was applied directly to the already-configured Neon database using the existing `DATABASE_URL`/`DIRECT_URL` connection strings (same database Phases 1-3 already use).

## Next Phase Readiness
- `db.desempenhoMensal` is available for Plan 02 (snapshot population inside `executarGeracaoMensal`) to write to via `createMany({ skipDuplicates: true })`
- `src/components/ui/chart.tsx` and `recharts` are ready for Plan 05 (chart components) to import
- `mesesSchema` is ready for Plan 03/04 (queries/pages) to validate the `?meses=` selector
- All 3 test files exist with named `it.todo` placeholders exactly matching VALIDATION.md's per-task `-t` filter substrings — Plans 02/03/04 can convert each into a red→green test without renaming
- No blockers identified for subsequent Wave 1/2 plans

---
*Phase: 04-dashboards-comparativos*
*Completed: 2026-06-22*
