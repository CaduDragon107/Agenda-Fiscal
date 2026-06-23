---
phase: 05-funda-o-multi-setor-schema-autoriza-o-e-empresas
plan: 03
subsystem: api
tags: [zod, prisma, server-actions, vitest, idor, multi-tenant-sector]

# Dependency graph
requires:
  - phase: 05-funda-o-multi-setor-schema-autoriza-o-e-empresas
    provides: "Setor enum, EmpresaResponsavelSetor junction table live on Neon + verified 197/197 FISCAL backfill (Plan 01); session.user.setor end-to-end + setor-aware withVisibilityScope (Plan 02)"
provides:
  - "empresaSchema with 3 distinct responsavel fields (responsavelFiscalId required, responsavelDpId/responsavelContabilId optional/nullable) + temFuncionariosClt boolean (default false)"
  - "listarResponsaveis(setor?) filtering db.usuario.findMany by setor (SETOR-03), select never includes senhaHash"
  - "EMPRESA_SELECT exposes responsaveisPorSetor junction relation (setor + usuario { id, nome })"
  - "criarEmpresa/editarEmpresa write Empresa + up-to-3 EmpresaResponsavelSetor upserts inside a single db.\$transaction (no partial-write)"
  - "Server-side DONO-only guard (D-02): non-DONO responsavel field changes are silently stripped/re-merged with current DB values, never applied"
  - "Lockstep: Empresa.responsavelId legacy column always written equal to the effective responsavelFiscalId, in the same transaction as the FISCAL junction row"
affects: [05-04-ui, phase-6-dp-engine, phase-7-contabil-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Prisma.TransactionClient type (not a hand-rolled interface) for helper functions that receive an already-open tx, mirroring calcularSnapshotMensal's existing convention in src/modules/dashboards/snapshot.ts"
    - "DONO-only guard re-merges with CURRENT junction-table values (read via the same findFirst that already exists for the IDOR scope check) rather than rejecting the whole request — a COLABORADOR's legitimate nome/contatos/temFuncionariosClt edits on an in-scope empresa still apply"
    - "db.\$transaction(async (tx) => {...}) callback form (not the array form) chosen because DP/CONTABIL upserts are conditional (skip when id is null) — exact same precedent as executarGeracaoMensal in geracao.ts"

key-files:
  created: []
  modified:
    - src/modules/empresas/schema.ts
    - src/modules/empresas/queries.ts
    - src/app/(app)/actions.ts
    - src/app/(app)/empresas/importar/actions.ts
    - tests/empresas.queries.test.ts
    - tests/empresas.idor.test.ts
    - tests/empresas.crud.test.ts

key-decisions:
  - "[Rule 1 - Bug, out-of-plan-scope fix] src/app/(app)/empresas/importar/actions.ts's confirmarImportacao mapped its single wizard-collected responsavelId to the new responsavelFiscalId field. This file is NOT in this plan's files_modified list, but Task 1's schema.ts rename from responsavelId -> responsavelFiscalId (required field) would have silently broken every row of the production import wizard (empresaSchema.safeParse would reject every linha, confirmarImportacao would persist 0 rows) — confirmed via the existing tests/import.confirm.test.ts, which still passes after this 1-line-equivalent fix (5/5 green, unchanged assertions)."
  - "DONO-only guard (D-02) re-merges non-DONO submitted responsavel fields with the CURRENT junction-table state (read in the same findFirst scoped query already used for the IDOR check in editarEmpresa) rather than simply rejecting the field. This lets a COLABORADOR legitimately edit nome/contatos/particularidades/temFuncionariosClt on an empresa within their own visibility scope while the 3 responsavel fields stay untouched if they attempt to submit different values."
  - "criarEmpresa's DONO-only guard forces responsavelDpId/responsavelContabilId to null for non-DONO (no 'existing value' exists yet on a brand-new empresa) — only responsavelFiscalId passes through unrestricted on create, matching the schema's pre-existing requirement that every empresa always has a Fiscal responsavel."
  - "Added a defensive fallback (existente.responsavelId, the legacy non-null column) for the case where a non-DONO edits an empresa whose FISCAL junction row is somehow missing — should never happen given Plan 01's verified 197/197 backfill, but prevents responsavelFiscalId from ever resolving to null/undefined for the lockstep write."

requirements-completed: [SETOR-01, SETOR-03, EMPR-03]

# Metrics
duration: 55min
completed: 2026-06-23
status: complete
---

# Phase 5 Plan 03: Backend de Empresas — 3 Responsáveis por Setor, Transação e Guard DONO-only Summary

**empresaSchema now validates 3 distinct responsável fields (Fiscal required, DP/Contábil optional) plus temFuncionariosClt; listarResponsaveis(setor?) filters by sector; criarEmpresa/editarEmpresa write Empresa + up to 3 EmpresaResponsavelSetor rows inside a single db.$transaction with a server-side DONO-only guard (D-02) that re-merges non-DONO submissions with current DB state, and the legacy responsavelId column is kept in lockstep with responsavelFiscalId.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-06-23T20:43:00Z (approx, worktree base timestamp)
- **Completed:** 2026-06-23T21:38:00Z
- **Tasks:** 2
- **Files modified:** 7 (4 source files, 3 test files)

## Accomplishments

- `src/modules/empresas/schema.ts`: replaced the single `responsavelId: z.string().min(1, ...)` field with 3 distinct fields per D-01/D-02 — `responsavelFiscalId` (required, mirrors prior behavior), `responsavelDpId`/`responsavelContabilId` (`.optional().nullable()`), plus `temFuncionariosClt: z.boolean().default(false)` (EMPR-03). `linhaImportadaSchema` left untouched per the plan's explicit instruction.
- `src/modules/empresas/queries.ts`: `EMPRESA_SELECT` extended with `responsaveisPorSetor: { select: { setor: true, usuario: { select: { id: true, nome: true } } } }` (junction relation, never exposes `senhaHash`) and `temFuncionariosClt: true`; `responsavelId`/`responsavel` (legacy) preserved unchanged. `listarResponsaveis` extended to `listarResponsaveis(setor?: "FISCAL" | "DP" | "CONTABIL")`, applying `where: setor ? { setor } : undefined` against `db.usuario.findMany`, `select` unchanged (`{ id, nome }`, never `senhaHash`).
- `src/app/(app)/actions.ts`: `dadosFormulario` reads the 3 new responsável fields + `temFuncionariosClt`. New private helper `upsertResponsaveisPorSetor(tx: Prisma.TransactionClient, empresaId, { fiscalId, dpId, contabilId })` upserts FISCAL always (keyed `empresaId_setor`), DP/CONTABIL only when the respective id is non-null. `criarEmpresa`/`editarEmpresa` now wrap the `empresa.create`/`update` call plus the junction upserts in `db.$transaction(async (tx) => {...})` (callback form, since DP/CONTABIL upserts are conditionally skipped). Server-side DONO-only guard (D-02, T-05-10): in `editarEmpresa`, the pre-existing scoped `findFirst` was extended to also select `responsaveisPorSetor: { select: { setor: true, usuarioId: true } }`; for a non-DONO session, the 3 submitted responsável values are discarded and replaced with the current junction-table values (with a legacy-column fallback for the defensive case of a missing FISCAL row); in `criarEmpresa`, a non-DONO has `responsavelDpId`/`responsavelContabilId` forced to `null` (no existing value to fall back to on create). Lockstep (T-05-12): `Empresa.responsavelId` is always written equal to the *effective* `responsavelFiscalId` (post-guard value), in the same transaction as the FISCAL junction upsert — both call sites verified via grep.
- `src/app/(app)/empresas/importar/actions.ts` (Rule 1 fix, see Deviations): `confirmarImportacao`'s call to `empresaSchema.safeParse` now maps the wizard's single collected `responsavelId` to `responsavelFiscalId`; the persisted `db.empresa.create` call passes `responsavelId: dados.responsavelFiscalId` and adds `temFuncionariosClt: dados.temFuncionariosClt` (defaults `false`, schema default applies).
- Tests: `tests/empresas.queries.test.ts` gained 4 new assertions (`responsavelDpId`/`responsavelContabilId` optional, `temFuncionariosClt` defaults `false`, plus the 3-test `listarResponsaveis(setor)` block: filtered `where`, unfiltered `where: undefined`, no `senhaHash` in `select`) and existing schema tests were renamed to the new field name. `tests/empresas.idor.test.ts` gained the D-02 IDOR-style test (colaborador's `responsavelDpId` submission is never applied — verified against both the `empresa.update` payload and every `empresaResponsavelSetor.upsert` call) plus a DONO-3-upserts test; existing IDOR tests (read/edit/delete isolation, DONO unrestricted access) updated to the new field name and mock shape, all still pass unedited in their security assertions. `tests/empresas.crud.test.ts` gained 2 new tests for `temFuncionariosClt` (create default `false`; edit-only-CLT produces exactly 1 upsert — no junction row duplicated/erased) plus the existing edit test updated to the new `findFirst`/field shapes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Estender empresaSchema (3 responsáveis + CLT) e listarResponsaveis(setor)** - `fd44bad` (feat)
2. **Task 2: criarEmpresa/editarEmpresa transacionais com guard DONO-only (D-02) e lockstep responsavelId** - `6d77041` (feat)

**Plan metadata:** *(this commit — SUMMARY.md, committed immediately after this file write per worktree protocol)*

## Files Created/Modified

- `src/modules/empresas/schema.ts` - 3 distinct responsável fields (Fiscal required, DP/Contábil optional/nullable) + `temFuncionariosClt` boolean
- `src/modules/empresas/queries.ts` - `EMPRESA_SELECT.responsaveisPorSetor` relation + `temFuncionariosClt`; `listarResponsaveis(setor?)` filter
- `src/app/(app)/actions.ts` - `criarEmpresa`/`editarEmpresa` transactional (Empresa + junction upserts), DONO-only guard (D-02), lockstep `responsavelId`
- `src/app/(app)/empresas/importar/actions.ts` - `confirmarImportacao` mapped to `responsavelFiscalId` (Rule 1 fix, kept the import wizard functional)
- `tests/empresas.queries.test.ts` - `listarResponsaveis(setor)` tests; schema tests updated to new field names
- `tests/empresas.idor.test.ts` - D-02 guard test (colaborador's responsavelDpId ignored) + DONO 3-upserts test
- `tests/empresas.crud.test.ts` - `temFuncionariosClt` create-default and edit-isolation tests

## Decisions Made

- **DONO-only guard re-merges with current junction-table state rather than rejecting the whole request.** A COLABORADOR may still legitimately edit `nome`/`contatos`/`particularidades`/`temFuncionariosClt` on an empresa within their own visibility scope; only the 3 responsável fields are silently reverted to their current DB values when the submitter is not DONO. This matches the plan's explicit instruction ("não rejeitar o request inteiro, apenas strip dos campos de responsável").
- **`criarEmpresa`'s guard forces DP/Contábil to `null` for non-DONO** (rather than re-merging with "current" values, since none exist on a brand-new empresa) — only `responsavelFiscalId` is unrestricted at creation time, consistent with it being a required field for every empresa regardless of who creates it.
- **Defensive `existente.responsavelId` fallback** added to the `editarEmpresa` guard for the (should-never-happen, given the verified 197/197 backfill) case where a non-DONO edits an empresa with no FISCAL junction row — prevents `responsavelFiscalId` from ever resolving to `null`/`undefined` and violating the lockstep invariant or the DB's non-null constraint.
- **`Prisma.TransactionClient` type used for the `upsertResponsaveisPorSetor` helper**, mirroring the exact precedent already established by `calcularSnapshotMensal` in `src/modules/dashboards/snapshot.ts`, rather than inventing a narrower hand-rolled interface (which failed to structurally match the real Prisma client's `upsert` arg types under `tsc --noEmit`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, file outside this plan's files_modified] `confirmarImportacao` (import wizard) silently broken by the schema field rename**
- **Found during:** Task 1, post-implementation `npx tsc --noEmit` sweep (run proactively to check for unintended breakage beyond this plan's declared files)
- **Issue:** Task 1 replaced `empresaSchema`'s single required `responsavelId` field with `responsavelFiscalId`. `src/app/(app)/empresas/importar/actions.ts`'s `confirmarImportacao` (NOT in this plan's `files_modified` list) calls `empresaSchema.safeParse({ ..., responsavelId: linha.responsavelId, ... })` to validate each row before persisting — after the rename, `responsavelFiscalId` is missing from every payload, so `safeParse` would fail for every row, and `confirmarImportacao` would silently persist 0 rows (the function's existing "skip rows that fail validation" behavior, designed for genuinely incomplete rows, would have masked a complete functional break of the import feature). Confirmed via `tests/import.confirm.test.ts`, which exercises exactly this path.
- **Why this isn't out of scope to fix:** Leaving a production code path (the empresa-import wizard, EMPR-02) silently broken because of an unrelated-file schema rename is a Rule 1 bug directly caused by this plan's own Task 1 change — not a pre-existing issue unrelated to this plan's work.
- **Fix:** `confirmarImportacao` now maps `linha.responsavelId` (the wizard's single per-row responsável, collected at Step 2) to `responsavelFiscalId` when calling `empresaSchema.safeParse`, and to `responsavelId: dados.responsavelFiscalId` when calling `db.empresa.create` — consistent with D-01 (DP/Contábil start unassigned for all imported empresas, which this code path already implies by never setting them). Also added `temFuncionariosClt: dados.temFuncionariosClt` to the create payload (schema default `false` applies automatically when absent from the row).
- **Files modified:** `src/app/(app)/empresas/importar/actions.ts`
- **Verification:** `npx vitest run tests/import.confirm.test.ts` — 5/5 green, zero test assertions changed. `npx tsc --noEmit` — no remaining errors in this file.
- **Committed in:** `fd44bad` (Task 1 commit, same commit as the schema change that caused the breakage — kept together so the schema rename and its immediate consumer-fix land atomically)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in a file outside this plan's literal `files_modified` list, but directly caused by this plan's own schema change). **Impact:** Necessary to avoid silently shipping a broken production feature (empresa import wizard) as a side effect of this plan's Task 1. No scope creep beyond the minimal field-name fix; no plan logic was changed; the fix is a 1-mapping-line-equivalent change verified against the pre-existing test file for that feature.

## Issues Encountered

None beyond the deviation documented above. The worktree was missing `node_modules`/`.env` exactly as anticipated by the dispatch's environment note — resolved identically to Plans 01/02: ran `npm install` (regenerated Prisma Client via the existing `postinstall` hook, 772 packages) and copied `.env` from the main repo root (`C:/Users/Usuario/Desktop/teste/.env`) into the worktree root (gitignored, never staged — confirmed via `git check-ignore -v .env` and `git status --short` showing no `.env` entry). No live-database write was performed or attempted — this plan touched only application code and tests against mocked Prisma calls, per the dispatch's production_note.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend for the 3-responsável-per-setor model is complete and tested: schema validation, sector-filtered responsável selector, transactional multi-table writes, and the server-side DONO-only security guard are all in place and verified.
- Plan 04 (UI — `empresa-form.tsx` 3-selector grid + CLT checkbox) can proceed immediately. Note: `npx tsc --noEmit` currently shows pre-existing type errors in `src/app/(app)/empresas/empresa-form.tsx` (lines 68-205) because that file still references the old single `responsavelId` field shape — this is expected and explicitly out of this plan's scope (the file is not in this plan's `files_modified` list); Plan 04 is the designated point where it gets updated to the new 3-field schema shape (the plan's own RESEARCH.md/PATTERNS.md already describe the target 3-column grid + Checkbox pattern for that work).
- All 3 target test files (`tests/empresas.queries.test.ts`, `tests/empresas.idor.test.ts`, `tests/empresas.crud.test.ts`) are green (24/24), and the full project suite is green (22/22 files, 115/115 tests) — up from the pre-plan baseline of 106 tests (9 new tests added across the 3 files).
- D-02 (DONO-only guard) has a real, passing test proving the security property: a COLABORADOR's `responsavelDpId` submission via a direct `editarEmpresa` call is verified to never reach either the `empresa.update` payload or any `empresaResponsavelSetor.upsert` call.

---
*Phase: 05-funda-o-multi-setor-schema-autoriza-o-e-empresas*
*Completed: 2026-06-23*
