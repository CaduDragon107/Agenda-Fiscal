---
phase: 06-motor-de-gera-o-departamento-pessoal
fixed_at: 2026-06-24T10:41:13Z
review_path: .planning/phases/06-motor-de-gera-o-departamento-pessoal/06-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-06-24T10:41:13Z
**Source review:** .planning/phases/06-motor-de-gera-o-departamento-pessoal/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01 through WR-04; IN-01/IN-02/IN-03 excluded per fix_scope=critical_warning)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: Unhandled rejection from `gerarTarefasDoMesAction` can permanently stick the button in loading state

**Files modified:** `src/app/(app)/tarefas/gerar-tarefas-button.tsx`, `src/app/(app)/tarefas/actions.ts`
**Commit:** e13b665
**Applied fix:** Wrapped `handleClick`'s body in `try/catch/finally`, moving `setIsPending(false)` into the `finally` block and adding a `toast.error` fallback in the `catch` block. Additionally wrapped the entire body of `gerarTarefasDoMesAction` (including the previously-uncovered `auth()` call and `competenciaSchema.safeParse` path) in `try/catch`, closing the gap at the source as suggested in the review.

### WR-02: Missing test assertion on the DP CLT query's `where`/`select` shape — the single most critical line is untested

**Files modified:** `tests/geracao.idempotencia.test.ts`
**Commit:** 446748f
**Applied fix:** Added a new test asserting the exact `where`/`select` argument passed to the second `tx.empresa.findMany` call inside `executarGeracaoMensal`, verifying that `responsaveisPorSetor` is filtered by `where: { setor: "DP" }`. A regression that silently drops this filter (and would otherwise risk picking up the FISCAL responsible per Pitfall 2) is now caught by this assertion, matching the rigor already used in `tests/tarefas.dp.test.ts`.

### WR-03: Duplicated `calcularPrazoBase*` logic between Fiscal and DP catalogs

**Files modified:** `src/lib/dia-util.ts`, `src/lib/geracao-tarefas.ts`, `src/lib/geracao-tarefas-dp.ts`
**Commit:** 7afdfa7
**Applied fix:** Extracted the byte-for-byte identical `calcularPrazoBase` (Fiscal) / `calcularPrazoBaseDiaFixo` (DP) implementation into a single shared `calcularPrazoBaseDiaFixo` helper in `src/lib/dia-util.ts`. Both `geracao-tarefas.ts` and `geracao-tarefas-dp.ts` now import and call this shared helper instead of maintaining separate copies, so any future fix to the D-03/D-04 rule only needs to be applied once.

### WR-04: `gerarTarefasDoMesDp` performs no input validation on `competencia` — silent `NaN`/`Invalid Date` propagation if called outside the validated action path

**Files modified:** `src/lib/geracao-tarefas-dp.ts`, `tests/geracao-tarefas-dp.test.ts`
**Commit:** 194ce0e
**Applied fix:** Added a re-validation guard at the top of `gerarTarefasDoMesDp` using the existing `competenciaSchema` (from `lib/competencia.ts`), throwing an `Error` on malformed `competencia` strings instead of silently propagating an `Invalid Date` into `prazo`. A `@throws` doc comment documents the contract. Added a regression test covering `"2026-13"`, `"abc"`, `""`, and `"2026-1"` (non-canonical) inputs.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-06-24T10:41:13Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
