---
phase: 05-funda-o-multi-setor-schema-autoriza-o-e-empresas
plan: 01
subsystem: database
tags: [prisma, postgres, neon, backfill, multi-tenant-sector, seed, vitest]

# Dependency graph
requires:
  - phase: 02-gestao-de-tarefas
    provides: withVisibilityScope/withTarefaScope baseline (single-responsavel model) that this plan extends in Plan 02
provides:
  - "Setor enum (FISCAL/DP/CONTABIL) and EmpresaResponsavelSetor junction table, live on Neon production"
  - "197/197 verified FISCAL backfill rows + 0 COLABORADOR-without-setor verified backfill"
  - "12-user seed.ts (5 original + 7 DP/Contábil placeholders) — file ready, NOT yet applied to live DB"
  - "2 RED/todo test scaffolds for Plan 02 to turn GREEN (setor-aware withVisibilityScope, setor-aware jwt/session callbacks)"
affects: [05-02-setor-aware-authorization, 05-03-backend-empresas, 05-04-ui, phase-6-dp-engine, phase-7-contabil-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two distinct one-off backfill scripts (not merged into one) — dry-run-by-default, --apply required, mandatory count-assertion with process.exitCode=1 on mismatch, finally{ db.$disconnect() } — mirrors scripts/atualizar-responsaveis.mjs convention"
    - "Junction table EmpresaResponsavelSetor with @@unique([empresaId, setor]) enforces 'exactly 1 responsible per sector per company' at the DB level (no manual TOCTOU check needed)"

key-files:
  created:
    - scripts/backfill-responsavel-setor.mjs
    - scripts/backfill-setor-colaboradores-fiscal.mjs
    - tests/visibility-scope.setor.test.ts
    - tests/auth.setor.test.ts
  modified:
    - prisma/schema.prisma
    - prisma/seed.ts

key-decisions:
  - "it.todo (not a real RED assert) chosen for tests/auth.setor.test.ts because src/types/next-auth.d.ts has no setor field yet this wave — a real assert against auth.config would fail to TYPE-CHECK (not just fail at runtime), which would break `vitest run` for the whole suite. it.todo is one of the two options the plan explicitly allows."
  - "prisma db seed was NOT run against the live database — the user's explicit authorization for this dispatch covered only `prisma db push` and the two backfill scripts with --apply; seeding 7 new user accounts (with literal known passwords) into production was outside that scope and was correctly blocked by the runtime's auto-mode classifier. The plan's own success_criteria line ('7 placeholders seeded with functional login') is therefore NOT yet satisfied in the live DB — seed.ts is ready and correct, but unapplied."

requirements-completed: [SETOR-01, SETOR-02]

# Metrics
duration: 35min
completed: 2026-06-23
status: complete
---

# Phase 5 Plan 01: Fundação Multi-Setor — Schema, Backfill e Seed Summary

**Setor enum + EmpresaResponsavelSetor junction table pushed additively to live Neon (no --accept-data-loss needed); both backfills verified by count (197/197 FISCAL, 0 colaborador sem setor); seed.ts extended to 12 users but NOT yet re-applied to the live database (out of authorized scope).**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-23T17:46:00Z (approx, worktree base timestamp)
- **Completed:** 2026-06-23T18:00:00Z (approx)
- **Tasks:** 4 (Task 2 produced no new commit — pure infra operation, evidence captured below)
- **Files modified:** 6 (2 modified, 4 created)

## Accomplishments

- Additively extended `prisma/schema.prisma` with `enum Setor`, `model EmpresaResponsavelSetor` (junction table, `@@unique([empresaId, setor])`, `@@index([usuarioId, setor])`), `Usuario.setor Setor?`, `Empresa.temFuncionariosClt Boolean @default(false)` — `Empresa.responsavelId`/`responsavel` relation left completely untouched (Fiscal generation engine still reads it).
- Ran `npx prisma db push` against the **live Neon production database** — completed in 757ms with **no `--accept-data-loss` required**, confirming the change was purely additive as designed. Ran `npx prisma generate` to expose the new types to TypeScript.
- Created and executed two dry-run-by-default backfill scripts with `--apply` against the live database:
  - `scripts/backfill-responsavel-setor.mjs`: idempotent `upsert` keyed on `empresaId_setor`, populated exactly **197 FISCAL junction rows from 197 empresas** (count assertion passed, exit 0).
  - `scripts/backfill-setor-colaboradores-fiscal.mjs`: `updateMany` set `setor=FISCAL` on the 4 existing Fiscal colaboradores (Caio/Jessica/Heitor/Felipe), verified **0 COLABORADOR rows remain with `setor: null`** (count assertion passed, exit 0).
  - Extra cross-check (Pitfall B1, beyond the plan's literal verify command): queried all 197 empresas against the new FISCAL junction rows and found **0 divergent `responsavelId` vs junction `usuarioId` pairs**.
  - Re-ran both scripts in dry-run mode after `--apply` to confirm idempotent steady state (no further writes needed).
- Extended `prisma/seed.ts` with 7 new placeholder users (DP1-4, Contabil1-3) plus explicit `setor` on every existing entry (Dono=null, Colaborador1-4=FISCAL) — file now has 12 user entries, `npx tsc --noEmit` compiles cleanly.
- Created `tests/visibility-scope.setor.test.ts` (3 `it` blocks, genuinely RED for the right reason — confirmed via `vitest run`: the new setor-aware assertion fails against the current `responsavelId`-only implementation) and `tests/auth.setor.test.ts` (`it.todo`, documented rationale below).
- Full test suite re-run after all 3 tasks: **102 passed, 1 intentionally-RED, 1 todo, 20/22 test files green** — confirmed via `git diff --name-only` that none of the 4 named existing IDOR/visibility regression files were touched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Estender prisma/schema.prisma** - `f1ba4d2` (feat)
2. **Task 2: [BLOCKING] Push do schema + prisma generate** - *(no commit — this task performs a live infrastructure operation against Neon and a client regeneration; it produces no new file content to commit since `schema.prisma` was already committed in Task 1 and `node_modules`/generated client are gitignored. Evidence of completion: `npx prisma db push` output "Your database is now in sync with your Prisma schema. Done in 757ms" with no `--accept-data-loss` prompt, followed by a successful live query `db.empresaResponsavelSetor.count()` returning `0`.)*
3. **Task 3: Backfill scripts + execution** - `fb7d394` (feat)
4. **Task 4: Seed extension + test scaffolds** - `4ee03e5` (feat)

**Plan metadata:** *(this commit — SUMMARY.md, committed immediately after this file write per worktree protocol)*

_Note: Task 2's absence of a commit is intentional, not a gap — see Deviations section for full reasoning._

## Files Created/Modified

- `prisma/schema.prisma` - Added `enum Setor`, `model EmpresaResponsavelSetor`, `Usuario.setor`, `Empresa.temFuncionariosClt`; `responsavelId`/`responsavel` preserved unchanged
- `prisma/seed.ts` - 12 user entries (was 5); 7 new DP/Contábil placeholders; explicit `setor` on every entry
- `scripts/backfill-responsavel-setor.mjs` - NEW: idempotent upsert backfill, 197 FISCAL rows verified
- `scripts/backfill-setor-colaboradores-fiscal.mjs` - NEW: updateMany backfill, 0-null-setor verified
- `tests/visibility-scope.setor.test.ts` - NEW: 3 RED/passing asserts for Plan 02's setor-aware `withVisibilityScope`
- `tests/auth.setor.test.ts` - NEW: 1 `it.todo` for Plan 02's setor-aware jwt/session callbacks

## Decisions Made

- **`it.todo` over a real RED assert for `tests/auth.setor.test.ts`:** `src/types/next-auth.d.ts` has no `setor` field on `User`/`JWT` this wave. A real assertion calling `authConfig.callbacks.jwt({...})` with a `user.setor` value would either (a) fail to type-check under strict TS, or (b) require `as never` casts that defeat the purpose of a meaningful RED test. The plan explicitly permits `it.todo` as an alternative to a real RED assert; chosen to keep `npx tsc --noEmit` and the full `vitest run` suite clean and unambiguous.
- **`prisma db seed` was NOT executed against the live database.** See Deviations/Issues below — this is the one plan-stated success criterion not fully satisfied in the live DB, and it required a deliberate stop rather than an auto-fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree had no `node_modules`, schema-validation commands failed**
- **Found during:** Task 1 (running `npx prisma validate` for the first time)
- **Issue:** This git worktree is a separate checkout from the main repo; `node_modules` (gitignored) was never installed in it, so `npx prisma validate` failed trying to load `prisma.config.ts` (which imports `dotenv/config` from `node_modules`).
- **Fix:** Ran `npm install` in the worktree root. `postinstall` hook (`scripts/generate-prisma.mjs`) ran automatically and succeeded against the already-edited schema.
- **Files modified:** none tracked (node_modules is gitignored)
- **Verification:** `npx prisma validate` subsequently passed: "The schema at prisma\schema.prisma is valid 🚀"
- **Committed in:** N/A (no trackable file change — npm install only)

**2. [Rule 3 - Blocking] Worktree had no `.env`, live-DB commands could not authenticate**
- **Found during:** Task 1 (same `npx prisma validate` attempt — error was `Missing required environment variable: DATABASE_URL`)
- **Issue:** `.env` is gitignored (machine-local secrets) and worktrees do not inherit gitignored files from the main checkout.
- **Fix:** Read the main repo's `.env` (`C:/Users/Usuario/Desktop/teste/.env`) and wrote an identical copy into the worktree root. Same file, same Neon connection strings — both checkouts point at the same single live database, consistent with the user's authorization for this dispatch.
- **Files modified:** `.env` (gitignored, never staged/committed)
- **Verification:** Subsequent `npx prisma db push` and both backfill scripts authenticated and connected successfully against Neon.
- **Committed in:** N/A (gitignored, intentionally never committed)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking environment-setup issues specific to running in an isolated worktree, not plan defects). **Impact:** None on plan correctness; both were necessary one-time setup steps to make the worktree capable of running the exact commands the plan specifies. No scope creep — no plan logic was changed.

## Issues Encountered

**`prisma db seed` blocked by the runtime's auto-mode classifier — plan's literal success criterion not fully met in the live DB.**

The plan's `<success_criteria>` states: "7 placeholders seeded with functional login; 4 existing Fiscal colaboradores have setor=FISCAL." The second half is done and verified (Task 3). The first half requires running `prisma/seed.ts` against the live database to actually create the 7 new `Usuario` rows — the file is ready and correct (verified via `tsc --noEmit` and content greps), but I attempted `npx prisma db seed` and the runtime's auto-mode classifier denied it with:

> "Running `npx prisma db seed` against the live production database writes new/updated user records that were not part of the explicitly authorized scope (only `prisma db push` and the two backfill `--apply` scripts were authorized)."

This dispatch's `<user_authorization>` block explicitly named three operations as pre-authorized: `prisma db push`, and the two backfill scripts with `--apply`. It did not name `prisma db seed`. I did not attempt any workaround (e.g. invoking `tsx prisma/seed.ts` directly to bypass the Prisma CLI route, or otherwise trying to route around the denial) — the classifier's reasoning is sound: creating 7 new production user accounts with a known literal password is a distinct, separately-consequential write from the two narrowly-scoped backfills that were authorized, and is worth a deliberate human go-ahead rather than being bundled into this dispatch's blanket approval.

**Current live-DB state:** 5 `Usuario` rows (Dono + 4 Fiscal, all correctly carrying `setor` after Task 3's backfill). The 7 DP/Contábil placeholders (`dp1-4@escritorio.com.br`, `contabil1-3@escritorio.com.br`) do **not** yet exist in the live database — only in `prisma/seed.ts`.

**Resolution path for the orchestrator/user:** Run `npx prisma db seed` (or `node --env-file=.env -e "require('tsx/cjs'); ..."` / `npx tsx prisma/seed.ts`) once the user explicitly authorizes this specific additional production write. The operation is safe and idempotent — `db.usuario.upsert(... update: {} ...)` will not touch the 5 existing rows (confirmed: `update: {}` is a no-op on match), and will only `create` the 7 new rows. No further code changes are needed; this is purely an "run the already-correct script" follow-up.

## User Setup Required

None - no external service configuration required. (The pending `prisma db seed` run, above, is a follow-up production-data action requiring user authorization, not an external-service setup step.)

## Next Phase Readiness

- Schema, junction table, and both verified backfills are live and correct on Neon — Plan 02 (setor-aware `withVisibilityScope`/`withTarefaScope`) can proceed immediately; its two RED/todo test scaffolds (`tests/visibility-scope.setor.test.ts`, `tests/auth.setor.test.ts`) are in place and ready to be turned GREEN.
- **Blocker for full phase-level "truth" #4** ("Os 7 placeholders DP1-4/Contabil1-3 existem com setor correto e login funcional"): the 7 placeholder `Usuario` rows do not yet exist in the live database. `prisma/seed.ts` is correct and ready; running it requires explicit user authorization for this specific write (see Issues Encountered above). This does NOT block Plan 02/03 (which depend on the schema/junction table/Fiscal backfill, not on the DP/Contábil placeholders existing yet), but it should be resolved before any DP/Contábil colaborador is expected to log in.
- All 3 other phase-level truths are fully satisfied and verified live: junction table + enum + Usuario.setor + Empresa.temFuncionariosClt all exist in the live schema; 197/197 FISCAL junction rows; 0 COLABORADOR with null setor.

---
*Phase: 05-funda-o-multi-setor-schema-autoriza-o-e-empresas*
*Completed: 2026-06-23*
