---
phase: 05-funda-o-multi-setor-schema-autoriza-o-e-empresas
plan: 02
subsystem: auth
tags: [next-auth, auth.js, jwt, rbac, idor, vitest, prisma]

# Dependency graph
requires:
  - phase: 05-funda-o-multi-setor-schema-autoriza-o-e-empresas
    provides: "Setor enum, Usuario.setor, EmpresaResponsavelSetor junction table live on Neon + verified 197/197 FISCAL backfill (Plan 01)"
provides:
  - "session.user.setor populated end-to-end (Usuario -> authorize -> JWT -> session), null for DONO, propagated through all 4 next-auth.d.ts declare module blocks"
  - "withVisibilityScope(user, setor?) setor-aware: DONO -> {}; COLABORADOR FISCAL -> legacy { responsavelId } shape (data-equivalent to junction, byte-compatible with pre-v2.0 regression suite); COLABORADOR DP/CONTABIL -> combined responsaveisPorSetor.some({setor, usuarioId}); COLABORADOR sem setor -> fail-safe non-matching filter, never {}"
  - "withTarefaScope unchanged in body, SessionUser type widened (shared type)"
  - "tests/setup.ts factories: mockDpColaboradorUser, mockContabilColaboradorUser added; existing 3 factories gain setor field"
affects: [05-03-backend-empresas, 05-04-ui, phase-6-dp-engine, phase-7-contabil-engine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "withVisibilityScope branches on setor value BEFORE building the where-clause: FISCAL keeps the legacy flat-column shape (data-equivalence guaranteed by Plan 01's verified 1:1 backfill), DP/CONTABIL use the junction-table relational filter — this is a deliberate per-setor shape split, not a single uniform shape, justified by the need to keep the pre-v2.0 regression suite passing unmodified while Empresa.responsavelId remains the live legacy column (RESEARCH.md-documented 1-release-cycle deprecation window)"
    - "Auth.js v5 4-module type augmentation (next-auth, @auth/core/types, next-auth/jwt, @auth/core/jwt) extended line-for-line for a new session field (setor), following the exact established id/role pattern"

key-files:
  created: []
  modified:
    - src/types/next-auth.d.ts
    - src/auth.ts
    - src/auth.config.ts
    - src/lib/visibility-scope.ts
    - tests/setup.ts
    - tests/auth.setor.test.ts

key-decisions:
  - "[DEVIATION — see below] withVisibilityScope returns the LEGACY flat shape { responsavelId: user.id } for setor === 'FISCAL' specifically, instead of always using the junction-table relational filter the plan's <action> text describes uniformly. DP/CONTABIL always use the junction-table shape as planned. This was necessary to satisfy two literally-contradictory plan constraints simultaneously: (a) the <action> block's uniform `{ responsaveisPorSetor: { some: {...} } }` return for any setor, and (b) the explicit 'do not edit tests/visibility-scope.test.ts / tests/empresas.idor.test.ts / tests/tarefas.idor.test.ts' instruction, where those exact pre-v2.0 files assert the literal { responsavelId } where-shape for a FISCAL-default mockColaboradorUser(). Resolved by branching on setor, since Plan 01's backfill (197/197, 0 divergent pairs) makes the two shapes data-equivalent for FISCAL today — see Deviations section for full reasoning."
  - "tests/auth.setor.test.ts converted from it.todo to 3 real assertions (jwt copies setor, session copies setor, DONO null-propagation edge case), following the exact authConfig.callbacks!.jwt!/session! direct-invocation pattern already established in tests/auth.test.ts's 4th test — no new test infrastructure needed."

requirements-completed: [SETOR-01, SETOR-02]

# Metrics
duration: 38min
completed: 2026-06-23
status: complete
---

# Phase 5 Plan 02: Autorização Setor-Aware (JWT/Sessão + Scope Functions) Summary

**`session.user.setor` now flows end-to-end through Auth.js v5's 4-module type augmentation (null for DONO), and `withVisibilityScope` branches per-setor — legacy `responsavelId` shape for FISCAL (data-equivalent to the verified junction backfill), combined `responsaveisPorSetor.some({setor, usuarioId})` relational filter for DP/CONTABIL — closing the Pitfall B3 widening bug while keeping the entire pre-v2.0 IDOR/visibility regression suite passing with zero edits.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-06-23T20:37:00Z (approx, worktree base timestamp)
- **Completed:** 2026-06-23T21:15:17Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Extended `src/types/next-auth.d.ts` with `AppSetor = "FISCAL" | "DP" | "CONTABIL"` and `setor: AppSetor | null` added to `Session.user`, `User`, and `JWT` across all 4 `declare module` blocks (`next-auth`, `@auth/core/types`, `next-auth/jwt`, `@auth/core/jwt`), mirroring the existing `id`/`role` augmentation exactly.
- `src/auth.ts`'s `authorize` now selects and returns `setor` alongside `role` — `senhaHash` remains the only sensitive field selected, never exposed outside this function.
- `src/auth.config.ts`'s `jwt`/`session` callbacks copy `user.setor -> token.setor -> session.user.setor`; the file remains edge-safe (verified: no `@/lib/db`/`bcryptjs` import).
- `tests/auth.setor.test.ts` converted from `it.todo` (Plan 01 scaffold) to 3 real GREEN assertions: jwt callback copies setor, session callback copies setor, and the DONO `setor: null` edge case propagates `null` (never `undefined`).
- `src/lib/visibility-scope.ts`: `SessionUser` gained `setor: "FISCAL" | "DP" | "CONTABIL" | null`. `withVisibilityScope(user, setor = user.setor)` now branches: DONO -> `{}` always; no setor -> fail-safe `{ id: "__no_setor_defined__" }` (never `{}`); FISCAL -> legacy `{ responsavelId: user.id }`; DP/CONTABIL -> combined `{ responsaveisPorSetor: { some: { setor, usuarioId: user.id } } }` (setor + usuarioId in the SAME `some` object, per Pitfall B3). `withTarefaScope`'s body is untouched — only the shared `SessionUser` type widened.
- `tests/setup.ts`: `mockDonoUser` -> `setor: null`; `mockColaboradorUser`/`mockOtherColaboradorUser` -> `setor: "FISCAL"`; two new factories added, `mockDpColaboradorUser` (setor `"DP"`) and `mockContabilColaboradorUser` (setor `"CONTABIL"`).
- `tests/visibility-scope.setor.test.ts` (Plan 01 scaffold) turned fully GREEN with **zero edits** to that file — the implementation matches its 3 asserts exactly (DP combined filter, DONO `{}`, setor-null fail-safe).
- Full regression gate verified GREEN with **zero edits**: `tests/visibility-scope.test.ts`, `tests/empresas.idor.test.ts`, `tests/tarefas.idor.test.ts`, `tests/auth.test.ts` — confirmed via `git diff --name-only` excluding all 4 files.
- Full project test suite: **22/22 files, 106/106 tests GREEN**. `npx tsc --noEmit` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Propagar Usuario.setor pelo JWT/sessão (4-module augmentation + authorize + callbacks)** - `96441d8` (feat)
2. **Task 2: Tornar withVisibilityScope/withTarefaScope setor-aware sem regressão** - `825e0b9` (feat)

**Plan metadata:** *(this commit — SUMMARY.md, committed immediately after this file write per worktree protocol)*

## Files Created/Modified

- `src/types/next-auth.d.ts` - `AppSetor` type; `setor` added to Session/User/JWT in all 4 augmented modules
- `src/auth.ts` - `authorize` select + return shape gains `setor`
- `src/auth.config.ts` - `jwt`/`session` callbacks copy `setor`; stays edge-safe
- `src/lib/visibility-scope.ts` - `SessionUser` gains `setor`; `withVisibilityScope` setor-aware (FISCAL legacy shape, DP/CONTABIL junction shape, fail-safe for no-setor); `withTarefaScope` type-only widening
- `tests/setup.ts` - `setor` on all 3 existing factories + 2 new factories (`mockDpColaboradorUser`, `mockContabilColaboradorUser`)
- `tests/auth.setor.test.ts` - `it.todo` replaced with 3 real GREEN assertions

## Decisions Made

- **`withVisibilityScope` returns the legacy `{ responsavelId }` shape specifically for `setor === "FISCAL"`**, not the junction-table shape uniformly across all setores. See Deviations below — this was required to reconcile two contradictory constraints in the plan text itself, and is justified by Plan 01's verified 1:1 backfill equivalence between the legacy column and the FISCAL junction rows.
- **`tests/auth.setor.test.ts` real assertions reuse the exact `authConfig.callbacks!.jwt!`/`session!` direct-invocation pattern** already established in `tests/auth.test.ts`'s 4th test, rather than inventing a new test approach — keeps the test style consistent across the auth test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 - Architectural/Plan Contradiction, resolved via most-conservative interpretation under yolo mode] `withVisibilityScope`'s literal output shape for FISCAL colaboradores conflicts with the plan's "do not edit" regression-file instruction**

- **Found during:** Task 2 (running the plan's exact verification command `npx vitest run tests/visibility-scope.test.ts tests/visibility-scope.setor.test.ts tests/empresas.idor.test.ts tests/tarefas.idor.test.ts` immediately after implementing the `<action>` block literally as written).
- **Issue:** The plan's Task 2 `<action>` text specifies a uniform implementation: `withVisibilityScope` should return `{}` for DONO, the fail-safe filter for no-setor, and otherwise ALWAYS `{ responsaveisPorSetor: { some: { setor, usuarioId } } }` — with no FISCAL-specific branch. The same task's `<action>` text also says `mockColaboradorUser` should default to `setor: "FISCAL"`, claiming "Estes defaults FISCAL preservam o comportamento dos testes de regressão existentes." Implementing the uniform junction-table shape literally as written caused exactly the regression the claim says wouldn't happen: `tests/visibility-scope.test.ts` (1 test), `tests/empresas.idor.test.ts` (3 tests), and `tests/tarefas.idor.test.ts` (1 test) — 5 tests across 3 files — failed, because each literally asserts the OLD flat `{ responsavelId: colaborador.id }` Prisma `where`-shape via `toEqual`/`toMatchObject`/`toHaveBeenCalledWith`, and a FISCAL colaborador now produces the structurally different junction shape. The plan text is self-contradictory: 05-RESEARCH.md line 708 independently confirms this isn't an oversight — "Existing call sites continue to compile without edits; **behavior changes only for COLABORADOR** once `EmpresaResponsavelSetor` exists" — i.e. the planner's own research anticipated a behavior/shape change for COLABORADOR but the PLAN.md task text simultaneously promises zero literal-shape change AND forbids editing the exact files that would need to change to accommodate it.
- **Why this isn't a simple Rule 1-3 fix:** Editing the 3 protected regression files would directly violate an explicit, repeated, capitalized instruction ("NÃO editar") and would reproduce PITFALLS.md's own named worst-case anti-pattern for this exact task ("Existing IDOR tests fail after the scope change and get 'updated' to match new (wider) behavior rather than investigated as a regression — this is the single most dangerous failure mode for this pitfall, because it would make the test suite complicit in masking the security regression"). Silently weakening the new DP/CONTABIL implementation to also use the flat shape was not an option either — there is no flat column for DP/CONTABIL responsibility, so that would have produced no working implementation at all for the phase's actual new requirement.
- **Fix:** `withVisibilityScope` branches explicitly on `setor` value: `setor === "FISCAL"` returns the literal legacy shape `{ responsavelId: user.id }` (byte-identical to the pre-v2.0 behavior); `setor === "DP" | "CONTABIL"` returns the combined junction-table filter `{ responsaveisPorSetor: { some: { setor, usuarioId: user.id } } }` exactly as the plan's Pitfall-B3 security rule requires. This is justified, not just convenient: Plan 01's backfill script verified (and the orchestrator independently cross-checked) that all 197 `Empresa.responsavelId` values exactly match their corresponding FISCAL `EmpresaResponsavelSetor.usuarioId` junction rows with zero divergence — so the two shapes are currently data-equivalent for every live FISCAL company. The branch is also consistent with RESEARCH.md's own documented deprecation plan: `Empresa.responsavelId` is explicitly kept "in place, untouched, ACTIVE" as the legacy column for at least one full release cycle specifically because Fiscal-facing code (including, implicitly, Fiscal-facing tests) still depends on it; DP/CONTABIL have no such legacy column and were never claimed to be shape-compatible with anything.
- **Files modified:** `src/lib/visibility-scope.ts` only (the file the plan explicitly assigns to this task) — no protected test file was touched.
- **Verification:** Re-ran the plan's exact verification command after the fix — all 4 files GREEN (15 tests). Ran the full project suite — 22/22 files, 106/106 tests GREEN. Confirmed via `git diff --name-only` that none of `tests/visibility-scope.test.ts`, `tests/empresas.idor.test.ts`, `tests/tarefas.idor.test.ts`, `tests/auth.test.ts` appear in the diff. Confirmed `tests/visibility-scope.setor.test.ts` (the new DP-focused fixture) is unaffected — its assertions are scoped to `setor: "DP"`, which always uses the junction-table branch.
- **Committed in:** `825e0b9` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 4 — plan self-contradiction, resolved via the most conservative interpretation that satisfies every literal constraint simultaneously, executed without halting since this dispatch runs under `mode: "yolo"` with no synchronous human present to ask). **Impact:** No scope creep, no weakening of the new DP/CONTABIL security guarantee (Pitfall B3's combined-filter rule is fully intact for both new sectors), no edit to any protected regression file. The only behavioral difference from a fully literal reading of the plan's `<action>` text is that FISCAL colaboradores's Prisma `where`-shape stays in its pre-v2.0 form instead of switching to the junction-table form — a difference that is provably inert today (verified 1:1 backfill) and that the phase's own RESEARCH.md independently recommends deferring to Phase 6, not this plan.

**This deviation should be flagged for human review** before Phase 6 (the documented point where `Empresa.responsavelId` is meant to be fully repointed/retired) — at that point, `withVisibilityScope`'s FISCAL branch will need to switch to the junction-table shape too, and the 3 pre-v2.0 regression test files (`visibility-scope.test.ts`, `empresas.idor.test.ts`, `tarefas.idor.test.ts`) will need a deliberate, reviewed update at that time (not before), since they will no longer describe the live behavior.

## Issues Encountered

- **Worktree missing `node_modules`/`.env`** (same as Plan 01) — resolved identically: ran `npm install` (regenerated Prisma Client via the existing `postinstall` hook, 772 packages, no errors) and copied `.env` from the main repo root (`C:/Users/Usuario/Desktop/teste/.env`) into the worktree root. Both checkouts point at the same single live Neon database; no live-database write was needed or attempted for this plan (pure application code + tests, as the dispatch's environment note anticipated).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `session.user.setor` is live end-to-end and `withVisibilityScope`/`withTarefaScope` are fully setor-aware with the Pitfall B3 combined-filter security property intact for DP/CONTABIL. Plan 03 (backend empresas — 3 responsável selectors, junction-table writes, `listarResponsaveis(setor?)`) can proceed immediately on this foundation.
- **Flag for Phase 6/7 (and noted above):** when `Empresa.responsavelId` is eventually retired per the 1-release-cycle deprecation plan, `withVisibilityScope`'s FISCAL branch needs a deliberate follow-up change to the junction-table shape, and `tests/visibility-scope.test.ts`/`tests/empresas.idor.test.ts`/`tests/tarefas.idor.test.ts` will need a reviewed (not silent) update at that time to assert the new shape — this plan intentionally did NOT do that work now, both because it was out of this plan's declared file scope and because `Empresa.responsavelId` is documented as still being read directly by the Fiscal generation engine (Phase 6's responsibility, not this phase's).
- All other phase-level truths for this plan are fully satisfied and verified: `session.user.setor` null for DONO; DP colaborador combined `setor`+`usuarioId` filter in the same `some`; DONO `{}` independent of setor; COLABORADOR-without-setor fails safe (never `{}`); full pre-v2.0 IDOR/visibility regression suite green and unmodified.

---
*Phase: 05-funda-o-multi-setor-schema-autoriza-o-e-empresas*
*Completed: 2026-06-23*
