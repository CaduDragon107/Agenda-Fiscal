---
phase: 09-decimo-terceiro-salario-automatico
reviewed: 2026-06-29T11:04:27Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - prisma/schema.prisma
  - src/lib/geracao-tarefas-dp-anual.ts
  - src/lib/tipo-obrigacao-setor.ts
  - src/modules/tarefas/geracao.ts
  - tests/geracao-tarefas-dp-anual.test.ts
  - tests/geracao.idempotencia.test.ts
  - tests/tipo-obrigacao-setor.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-06-29T11:04:27Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the new DP-anual (13º Salário) catalog, its wiring into the monthly generation orchestrator, the sector mapping update, and the corresponding tests. The implementation is careful and well-documented: it correctly diverges from the Contábil-anual pattern (`anoVencimento = anoAtual`, not `+1`), correctly reuses the already-fetched `comResponsavelDp`/`empresasClt` query results instead of issuing a new `tx.empresa.findMany` (preserving the positional-mock contract of the existing test suite), and is exercised by both unit tests (pure catalog function, 12-month sweep) and integration-style idempotency tests (mocked Prisma transaction).

No correctness or security defects were found that would risk data loss, duplicate task creation, or misattribution. The two warnings below are about cosmetic/consistency drift (title separator) and a latent fragility in the reused empresa list across DP-mensal/DP-anual blocks that is currently masked by the single-entry catalog. Info items cover minor maintainability nits.

## Warnings

### WR-01: Title separator for DECIMO_TERCEIRO breaks established convention

**File:** `src/modules/tarefas/geracao.ts:305`
**Issue:** Every other task-title template in the codebase uses an em dash (`—`) as the separator between the obligation name and the competência/month: `geracao-tarefas.ts:83` (`` `${TITULO_OBRIGACAO[regra.tipo]} — ${nomeMes}/${ano}` ``), `geracao-tarefas-dp.ts:97` (same pattern), `geracao-tarefas-contabil-anual.ts` (implied by `${TITULO_OBRIGACAO_ANUAL[regra.tipo]} — ${competenciaAnual}` at `geracao.ts:265`). The new DECIMO_TERCEIRO title at `geracao.ts:305` uses a plain ASCII hyphen instead: `` `${TITULO_OBRIGACAO_DP_ANUAL[regra.tipo]} - ${competenciaAnual}` ``. This is locked in by the test at `tests/geracao.idempotencia.test.ts:524` (`titulo.startsWith("13º Salário - 2026")`), so it will not be caught by regression — but it is a visible inconsistency for end users who will see "ECD — 2026" next to "13º Salário - 2026" in the same task list, and for anyone grepping/parsing titles by separator.
**Fix:**
```ts
// geracao-tarefas-dp-anual.ts and geracao.ts:305
titulo: `${TITULO_OBRIGACAO_DP_ANUAL[regra.tipo]} — ${competenciaAnual}`, // em dash, consistent with other catalogs
```
Update the test assertion accordingly (`titulo.startsWith("13º Salário — 2026")`).

### WR-02: DP-anual block silently depends on DP-mensal block's filter staying in sync — no test guards the coupling itself

**File:** `src/modules/tarefas/geracao.ts:282-311`
**Issue:** The DP-anual loop reuses `comResponsavelDp` (derived from the DP-mensal `tx.empresa.findMany` call at lines 144-154, filtered by `setor: "DP"`). This is a deliberate and currently-correct optimization (avoids a redundant query and preserves the positional mock chain), but it creates an implicit coupling: if a future change modifies the DP-mensal query's `where`/`select` (e.g., adds a sector-scoped flag, or changes elegibility beyond `temFuncionariosClt`), the DP-anual block will silently inherit that change without any test specifically asserting "DP-anual elegibility == DP-mensal elegibility". The existing tests check outcomes (e.g., "empresa CLT com responsável DP gera ... 13º") but none assert that the two blocks are reading from literally the same dataset by construction — a regression here (e.g., someone re-introducing a separate `findMany` for DP-anual with a different filter) would only be caught indirectly through `empresaFindManyMock).toHaveBeenCalledTimes(3)` in one single test (`tests/geracao.idempotencia.test.ts:528`), which is easy to overlook when adding future DP-anual obligations.
**Fix:** Add an explicit comment/test asserting this invariant more directly, e.g. a test that changes `comResponsavelDp`'s eligibility (empty vs non-empty) and confirms DP-mensal and DP-anual tasks appear/disappear together for the same empresa, making the coupling an explicit, tested contract rather than an emergent property of shared variable reuse.

## Info

### IN-01: `ObrigacaoDpAnualRegra.tipo` union type has only one member — premature/inert generality

**File:** `src/lib/geracao-tarefas-dp-anual.ts:44-51`
**Issue:** `TipoObrigacaoDpAnual` is declared as a string-literal type (`"DECIMO_TERCEIRO"`) with the apparatus of a multi-entry catalog (`Record<TipoObrigacaoDpAnual, string>`, array-based `CATALOGO_OBRIGACOES_DP_ANUAIS`, `.filter()`/`.map()` over the catalog) even though there is exactly one obligation today. This is reasonable forward-looking design (mirrors the Contábil-anual catalog shape) and not a bug, but worth flagging: if no second DP-anual obligation is anticipated in the near roadmap, the indirection (array + filter + map + Record lookup) is more machinery than the single fact it encodes.
**Fix:** No action required if a second annual DP obligation is anticipated soon; otherwise consider this acceptable, deliberate consistency with the Contábil-anual module's shape (as the file's own header comment argues for parity).

### IN-02: Duplicated `calcularPrazoAnual`/`calcularPrazoDpAnual` bodies (already flagged by design comment, but worth tracking as quality debt)

**File:** `src/lib/geracao-tarefas-dp-anual.ts:103-110` vs `src/lib/geracao-tarefas-contabil-anual.ts:116-123`
**Issue:** `calcularPrazoDpAnual` is a byte-for-byte duplicate of `calcularPrazoAnual` (same body: build `Date(ano, mes-1, dia)`, pipe through `anticiparParaDiaUtil`). The file header explicitly justifies this duplication as a deliberate tradeoff to avoid regression risk in the Contábil module — a reasonable call given the no-shared-test-surface constraint described in the comment. Recorded here as quality debt rather than a defect: if a third annual catalog is added later, consider extracting the common `calcularPrazoAnualGenerico(ano, mes, dia)` helper that both `calcularPrazoAnual` and `calcularPrazoDpAnual` delegate to (both already call `anticiparParaDiaUtil` identically), trimmed down to a single source of truth without touching either module's public signature.
**Fix:** No action required now; consider extraction if a third anual catalog appears.

### IN-03: `semResponsavelDp` does not distinguish "no DP-mensal responsavel" from "no DP-anual responsavel for a CLT company with FOLHA/FGTS already running"

**File:** `src/modules/tarefas/geracao.ts:54-65, 159-161`
**Issue:** The header comment explicitly states this is intentional ("Como a elegibilidade é idêntica à do bloco DP mensal, não há lista semResponsavelDpAnual separada"). This is correct today since elegibility is identical. Noting only for future maintainers: if DP-anual elegibility ever diverges from DP-mensal elegibility (e.g., 13º only applies above some headcount threshold), this merged reporting would become misleading, since `semResponsavelDp` is consumed by callers expecting it to mean "no DP responsible for monthly obligations," not "...and also no responsible for 13º."
**Fix:** No action required while elegibility is identical; flag in the DP-anual module's header comment (already partially done) so future changes to elegibility criteria trigger a deliberate decision to split the list.

---

_Reviewed: 2026-06-29T11:04:27Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
