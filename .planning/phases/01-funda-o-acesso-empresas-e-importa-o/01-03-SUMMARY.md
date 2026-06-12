---
phase: 01-funda-o-acesso-empresas-e-importa-o
plan: 03
subsystem: database
tags: [prisma, zod, visibility-scope, cnpj, idor, empresas]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Prisma schema (Empresa, Usuario, RegimeTributario enum with 3 values), Vitest infra with RED stub tests (visibility-scope, cnpj)"
  - phase: 01-02
    provides: "Auth.js v5 session/JWT typed as { id, role: COLABORADOR|DONO } (src/types/next-auth.d.ts)"
provides:
  - "withVisibilityScope(user) — central AUTH-02 visibility rule: {} for DONO, { responsavelId } for COLABORADOR"
  - "validarCNPJ(cnpj) — full modulo-11 check-digit validation (not format-only regex)"
  - "empresaSchema (Zod, 3-regime enum) + linhaImportadaSchema for the import flow"
  - "listarEmpresas/buscarEmpresaPorId — scoped empresa queries that always spread withVisibilityScope into where"
affects: [01-04, 01-05, 01-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SessionUser type (src/lib/visibility-scope.ts) uses role: 'COLABORADOR' | 'DONO' — matches Prisma Role enum and AppRole from 01-02 auth types directly, no casing normalization needed"
    - "Every Empresa query/mutation spreads ...withVisibilityScope(user) into Prisma where; explicit select never includes Usuario.senhaHash"
    - "tests/setup.ts mocks (mockDonoUser/mockColaboradorUser) updated to role: 'DONO'/'COLABORADOR' to match the real session contract"

key-files:
  created:
    - src/lib/visibility-scope.ts
    - src/lib/cnpj.ts
    - src/modules/empresas/schema.ts
    - src/modules/empresas/queries.ts
    - tests/empresas.queries.test.ts
  modified:
    - tests/visibility-scope.test.ts
    - tests/cnpj.test.ts
    - tests/setup.ts

key-decisions:
  - "SessionUser.role typed as 'COLABORADOR' | 'DONO' (uppercase) to align with the Prisma Role enum and the AppRole type already established in 01-02's src/types/next-auth.d.ts — no normalization layer added"
  - "tests/setup.ts mocks updated from lowercase 'dono'/'colaborador' (01-01 stub convention) to uppercase 'DONO'/'COLABORADOR' so the mocks match the real session shape that withVisibilityScope consumes"
  - "Added a new focused test file tests/empresas.queries.test.ts (not in original files_modified) covering empresaSchema validation and the scoped-query contract (listarEmpresas/buscarEmpresaPorId), per the plan's <behavior> block"

requirements-completed: [AUTH-02, EMPR-01]

# Metrics
duration: 7min
completed: 2026-06-12
---

# Phase 01 Plan 03: Visibility Scope, CNPJ Validation, Empresa Schema & Scoped Queries Summary

**Central AUTH-02 visibility-scope function, modulo-11 CNPJ validator, and Zod-validated/scope-enforced empresa data layer that all future Server Actions and UI consume.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-12T18:36:00Z
- **Completed:** 2026-06-12T18:43:18Z
- **Tasks:** 2 (both TDD, RED->GREEN)
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- `withVisibilityScope(user)` implemented as the single source of truth for empresa visibility: `{}` for `DONO`, `{ responsavelId: user.id }` for `COLABORADOR`
- `validarCNPJ(cnpj)` implements the full modulo-11 algorithm (weights [5,4,3,2,9,8,7,6,5,4,3,2] / [6,5,4,3,2,9,8,7,6,5,4,3,2]), rejecting wrong-size, all-same-digit, and bad-check-digit CNPJs — no format-only regex shortcut
- `empresaSchema` (Zod) validates nome, cnpj (via `validarCNPJ`, message "CNPJ inválido"), `regimeTributario` (3-value enum: LUCRO_REAL/LUCRO_PRESUMIDO/SIMPLES_NACIONAL), and required `responsavelId` ("Responsável é obrigatório"); `linhaImportadaSchema` exported for Plan 05's import flow with `regimeTributario`/`responsavelId` optional
- `listarEmpresas`/`buscarEmpresaPorId` always spread `withVisibilityScope(user)` into the Prisma `where`, with an explicit `select` that excludes `Usuario.senhaHash`

## Task Commits

Each task was committed atomically (TDD RED -> GREEN):

1. **Task 1: withVisibilityScope() + validarCNPJ() (RED)** - `fb79b2a` (test)
2. **Task 1: withVisibilityScope() + validarCNPJ() (GREEN)** - `3e387f9` (feat)
3. **Task 2: empresaSchema + scoped queries (RED)** - `548addb` (test)
4. **Task 2: empresaSchema + scoped queries (GREEN)** - `15af9a8` (feat)

**Plan metadata:** (pending) - `docs(01-03): complete plan`

## Files Created/Modified
- `src/lib/visibility-scope.ts` - Exports `SessionUser` type and `withVisibilityScope()` (core AUTH-02 rule)
- `src/lib/cnpj.ts` - `validarCNPJ()`, full modulo-11 check-digit algorithm
- `src/modules/empresas/schema.ts` - `empresaSchema` (3-regime enum, CNPJ refine) + `linhaImportadaSchema`
- `src/modules/empresas/queries.ts` - `listarEmpresas`/`buscarEmpresaPorId`, both scoped via `withVisibilityScope`
- `tests/visibility-scope.test.ts` - Real assertions replacing RED stub (dono -> {}, colaborador -> {responsavelId})
- `tests/cnpj.test.ts` - Real assertions replacing RED stub (2 valid, 5 invalid-case assertions across 3 `it`s)
- `tests/setup.ts` - Mock role values updated to `'DONO'`/`'COLABORADOR'` to match real session contract
- `tests/empresas.queries.test.ts` - New: covers empresaSchema validation + scoped-query `where` contract

## Decisions Made
- **Role casing alignment:** The plan flagged a potential casing mismatch between the Prisma `Role` enum (`COLABORADOR`/`DONO`, uppercase) and the lowercase `"colaborador" | "dono"` used by `tests/setup.ts` (a 01-01 stub convention). Checked `src/types/next-auth.d.ts` (01-02) and confirmed the real session/JWT carries `role: "COLABORADOR" | "DONO"` verbatim from the Prisma enum, with no normalization in `auth.config.ts` callbacks. Decision: `SessionUser.role` in `visibility-scope.ts` uses `"COLABORADOR" | "DONO"` directly (no normalization layer), and `tests/setup.ts` mocks were updated to match — this is the correct, consistent contract for all consumers (queries, Server Actions, UI).
- **New test file for Task 2:** `tests/empresas.queries.test.ts` was added (not listed in the plan's `files_modified`) to cover the `<behavior>` block's 4 assertions (schema valid/invalid payloads, `listarEmpresas`/`buscarEmpresaPorId` where-scope contract) via `vi.mock("@/lib/db")`, following the `tests/auth.test.ts` mocking pattern from 01-02. The plan's formal `<verify>` command for Task 2 only runs `visibility-scope`/`cnpj` + build, which both pass; this additional file provides direct TDD coverage for the new query/schema modules without modifying the out-of-scope `tests/empresas.crud.test.ts`/`tests/empresas.idor.test.ts` stubs (those remain `expect.fail` placeholders explicitly marked for Plans 04/05).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed inconsistent mock role casing in tests/setup.ts**
- **Found during:** Task 1 (writing real assertions for tests/visibility-scope.test.ts)
- **Issue:** `tests/setup.ts` (committed in 01-01) defined `SessionRole = "colaborador" | "dono"` (lowercase) and mock factories returning those values. This is inconsistent with the Prisma `Role` enum (`COLABORADOR`/`DONO`) and with `src/types/next-auth.d.ts` `AppRole = "COLABORADOR" | "DONO"` (committed in 01-02), which is what the real session/JWT actually carries. Using the lowercase mocks would make `withVisibilityScope` either need a normalization branch that doesn't exist anywhere else in the codebase, or tests would not represent the real session shape.
- **Fix:** Updated `tests/setup.ts` `SessionRole` type and all three mock factories (`mockDonoUser`, `mockColaboradorUser`, `mockOtherColaboradorUser`) to use `"DONO"`/`"COLABORADOR"` (uppercase), matching the Prisma enum and `AppRole`. `withVisibilityScope`'s `SessionUser.role` type is `"COLABORADOR" | "DONO"` with a direct equality check against `"DONO"` — no normalization needed.
- **Files modified:** tests/setup.ts
- **Verification:** `npx vitest run tests/visibility-scope.test.ts tests/cnpj.test.ts tests/empresas.queries.test.ts` — 13/13 pass
- **Committed in:** fb79b2a (Task 1 RED commit, since the test file imports from setup.ts)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 - bug/inconsistency fix)
**Impact on plan:** Necessary correctness fix — without it, the `SessionUser` type consumed by `withVisibilityScope`, `listarEmpresas`, and `buscarEmpresaPorId` would not match the real Auth.js session shape established in 01-02, which is exactly the kind of subtle mismatch the plan asked to resolve explicitly. No scope creep — only `tests/setup.ts` (a shared test helper, not a `files_modified` target but directly imported by the in-scope test files) was touched.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `withVisibilityScope`, `validarCNPJ`, `empresaSchema`, `linhaImportadaSchema`, `listarEmpresas`, and `buscarEmpresaPorId` are all implemented, typed, and tested — ready for Plan 04 (Server Actions / empresa CRUD UI) and Plan 05 (Excel import flow) to consume directly.
- `tests/empresas.crud.test.ts` and `tests/empresas.idor.test.ts` remain RED stubs (`expect.fail`, explicitly marked "implementado no Plano 04/05") — out of scope for this plan, unchanged. Plan 04 should wire Server Action mutation tests against `buscarEmpresaPorId`'s "não encontrado" IDOR contract.
- No blockers identified for Plan 04/05.

---
*Phase: 01-funda-o-acesso-empresas-e-importa-o*
*Completed: 2026-06-12*

## Self-Check: PASSED

All created files verified on disk:
- FOUND: src/lib/visibility-scope.ts
- FOUND: src/lib/cnpj.ts
- FOUND: src/modules/empresas/schema.ts
- FOUND: src/modules/empresas/queries.ts
- FOUND: tests/empresas.queries.test.ts
- FOUND: .planning/phases/01-funda-o-acesso-empresas-e-importa-o/01-03-SUMMARY.md

All commits verified in git log:
- FOUND: fb79b2a (test: RED, Task 1)
- FOUND: 3e387f9 (feat: GREEN, Task 1)
- FOUND: 548addb (test: RED, Task 2)
- FOUND: 15af9a8 (feat: GREEN, Task 2)
