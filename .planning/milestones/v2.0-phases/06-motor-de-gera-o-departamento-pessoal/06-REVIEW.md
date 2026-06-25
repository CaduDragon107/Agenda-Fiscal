---
phase: 06-motor-de-gera-o-departamento-pessoal
reviewed: 2026-06-24T13:14:56Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/lib/geracao-tarefas-dp.ts
  - tests/geracao-tarefas-dp.test.ts
  - prisma/schema.prisma
  - src/lib/dia-util.ts
  - tests/dia-util.test.ts
  - src/modules/tarefas/geracao.ts
  - src/app/(app)/tarefas/actions.ts
  - src/app/(app)/tarefas/gerar-tarefas-button.tsx
  - tests/geracao.idempotencia.test.ts
  - tests/geracao.actions.test.ts
  - tests/tarefas.dp.test.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-06-24T13:14:56Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the Departamento Pessoal (DP) generation engine: the pure catalog/calculator (`geracao-tarefas-dp.ts`, `dia-util.ts`), the orchestration layer (`geracao.ts`), the Server Actions (`actions.ts`), the DONO-only trigger button, and the associated test suites. All 26 tests across the 5 test files pass (`npx vitest run` confirmed). The pure date-calculation logic (`calcularQuintoDiaUtil`, `anticiparParaDiaUtil`, `calcularPrazoBaseDiaFixo`) is correct and well-tested, including the documented `isHoliday() === false` pitfall and the local-Date-construction pitfall for competência parsing.

No Critical/security-class defects were found in the reviewed files. The main issues are: (1) a UI robustness gap where an unhandled promise rejection from the Server Action can leave the "Gerar tarefas do mês" button permanently stuck in a loading state, (2) a test coverage gap on the single most safety-critical line of the new DP code (the `setor: "DP"` filter that prevents picking up the FISCAL responsible by mistake), (3) duplicated day-fixed-prazo calculation logic between the Fiscal and DP catalogs, and (4) a couple of missing input-validation/defensive-coding items in the pure DP functions that are consistent with — but also propagate — pre-existing patterns from the Fiscal catalog.

## Warnings

### WR-01: Unhandled rejection from `gerarTarefasDoMesAction` can permanently stick the button in loading state

**File:** `src/app/(app)/tarefas/gerar-tarefas-button.tsx:22-30`
**Issue:** `handleClick` calls `await gerarTarefasDoMesAction()` with no `try/catch`. `gerarTarefasDoMesAction` (in `actions.ts:289-321`) wraps only the `executarGeracaoMensal` call in `try/catch` — the preceding `await auth()` call (line 292) and the `competenciaSchema.safeParse` path are NOT covered by that try/catch. If `auth()` throws (e.g., transient session-store/DB connectivity error) or any other exception occurs before the inner try block, the returned promise rejects. In the client component, this means:
- `setIsPending(false)` on line 25 never executes — the button stays disabled with the spinner forever (until the page is reloaded).
- The rejection becomes an unhandled promise rejection in the browser, with no `toast.error` shown to the user.

**Fix:**
```tsx
async function handleClick() {
  setIsPending(true);
  try {
    const resultado = await gerarTarefasDoMesAction();
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    toast.success(
      `Geradas ${resultado.criadas} tarefas novas, ${resultado.puladas} já existiam.`
    );
    if (resultado.semResponsavelDp.length > 0) {
      const nomes = resultado.semResponsavelDp.map((e) => e.nome).join(", ");
      toast.warning(
        `${resultado.semResponsavelDp.length} empresa(s) com funcionários CLT sem responsável de DP atribuído: ${nomes}. Atribua um responsável na tela de Empresas.`
      );
    }
    router.refresh();
  } catch {
    toast.error("Erro ao gerar tarefas. Tente novamente.");
  } finally {
    setIsPending(false);
  }
}
```
Additionally, wrapping the entire body of `gerarTarefasDoMesAction` (including the `auth()` call) in try/catch would close this gap at the source as well.

### WR-02: Missing test assertion on the DP CLT query's `where`/`select` shape — the single most critical line is untested

**File:** `tests/geracao.idempotencia.test.ts` (whole file); corresponding production code: `src/modules/tarefas/geracao.ts:95-105`
**Issue:** The code comment in `geracao.ts` explicitly flags this as "CRÍTICO": the second `empresa.findMany` call MUST filter `responsaveisPorSetor` by `where: { setor: "DP" }` — omitting it risks picking up the FISCAL responsible instead of DP (Pitfall 2 of RESEARCH.md). However, none of the tests in `tests/geracao.idempotencia.test.ts` assert the actual `where`/`select` argument passed to the second `empresa.findMany` call (the one feeding `comResponsavelDp`). The existing tests only control what the *mock* returns for that call (`mockResolvedValueOnce(empresasClt)`), which proves nothing about whether production code actually applies the `setor: "DP"` filter — a regression that silently drops the filter (e.g., during a future refactor) would not be caught by this suite. Compare with `tests/tarefas.dp.test.ts:74-84`, which DOES assert the exact `where` shape for `criarTarefa`'s `withVisibilityScope` call — the same rigor is missing here.

**Fix:** Add an assertion similar to the idempotência test pattern:
```ts
expect(empresaFindManyMock).toHaveBeenNthCalledWith(2, {
  where: { ativo: true, temFuncionariosClt: true },
  select: {
    id: true,
    nome: true,
    responsaveisPorSetor: {
      where: { setor: "DP" },
      select: { usuarioId: true },
    },
  },
});
```

### WR-03: Duplicated `calcularPrazoBase*` logic between Fiscal and DP catalogs

**File:** `src/lib/geracao-tarefas-dp.ts:57-63` vs `src/lib/geracao-tarefas.ts:63-69`
**Issue:** `calcularPrazoBaseDiaFixo` (DP) and `calcularPrazoBase` (Fiscal) are byte-for-byte identical implementations (parse competência → add one month → clamp to `lastDayOfMonth` → `setDate`). This is intentional duplication per the DP file's own comment ("mesma regra D-03/D-04 do catálogo Fiscal"), but duplicating exact logic across two files means any future fix (e.g., a timezone edge case, or a change to the D-03/D-04 rule) must be applied in two places, and a future maintainer could fix one and forget the other.

**Fix:** Extract a shared helper, e.g., in `src/lib/dia-util.ts` or a new `src/lib/prazo-base.ts`:
```ts
export function calcularPrazoBaseDiaFixo(competencia: string, diaBase: number): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  const mesVencimento = addMonths(new Date(ano, mes - 1, 1), 1);
  const ultimoDia = lastDayOfMonth(mesVencimento).getDate();
  const dia = Math.min(diaBase, ultimoDia);
  return setDate(mesVencimento, dia);
}
```
and import it from both `geracao-tarefas.ts` and `geracao-tarefas-dp.ts`.

### WR-04: `gerarTarefasDoMesDp` and `calcularQuintoDiaUtil`/`anticiparParaDiaUtil` callers perform no input validation on `competencia` — silent `NaN` propagation if called outside the validated action path

**File:** `src/lib/geracao-tarefas-dp.ts:74-102`, `src/lib/dia-util.ts:64-78`
**Issue:** `gerarTarefasDoMesDp(empresas, competencia)` does `competencia.split("-").map(Number)` with no validation. If `competencia` is malformed (e.g., `"2026-13"`, `"abc"`, or `""`), `ano`/`mes` become `NaN` or out-of-range, and `new Date(NaN, ...)` produces an `Invalid Date`, which then flows silently into `prazo` (an `Invalid Date` object) and gets persisted via `createMany`. The only validation gate is `competenciaSchema` in `actions.ts`, which the pure function has no way of knowing was applied. This mirrors the pre-existing pattern in `geracao-tarefas.ts` (Fiscal), so it is not a new regression, but the DP module is new code and an opportunity to harden it was not taken.
**Fix:** Either re-validate at the top of `gerarTarefasDoMesDp` (cheap, no I/O) or add a clear `@throws`/precondition doc comment making the caller-must-validate contract explicit:
```ts
export function gerarTarefasDoMesDp(
  empresas: { id: string; responsavelId: string }[],
  competencia: string
): TarefaParaCriar[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
    throw new Error(`competencia inválida: ${competencia}`);
  }
  // ...
}
```

## Info

### IN-01: `semResponsavelDp.nome` is interpolated directly into a toast message — no escaping concern (React-safe), but no truncation for very long lists

**File:** `src/app/(app)/tarefas/gerar-tarefas-button.tsx:36-41`
**Issue:** Not a security issue (toast text, not `dangerouslySetInnerHTML`), but with ~100+ companies, if a large fraction lack a DP responsible, `nomes` could be a very long comma-joined string rendered in a single toast, degrading UX. Minor.
**Fix:** Consider capping the displayed list (e.g., first 5 + "e mais N") when `semResponsavelDp.length` is large.

### IN-02: `TipoObrigacaoDp` and `TipoObrigacao` (Fiscal) are structurally disjoint but not statically guaranteed disjoint from the Prisma enum

**File:** `src/lib/geracao-tarefas-dp.ts:30`, `prisma/schema.prisma:36-46`
**Issue:** `TipoObrigacaoDp` is a hand-written string union that must stay in sync with the subset of `enum TipoObrigacao` values added in the schema (`FOLHA | ESOCIAL | FGTS | INSS`). There's no compile-time link (e.g., `Extract<TipoObrigacao, ...>` from the generated Prisma enum) enforcing that the two definitions can't drift if someone adds a new DP obligation type to the Prisma enum without updating this union, or vice versa. Low risk today (4 fixed values, well-tested), but worth a TS-level guard as the catalog grows.
**Fix:** Optionally derive from the Prisma enum:
```ts
import type { TipoObrigacao as PrismaTipoObrigacao } from "@prisma/client";
export type TipoObrigacaoDp = Extract<PrismaTipoObrigacao, "FOLHA" | "ESOCIAL" | "FGTS" | "INSS">;
```

### IN-03: `executarGeracaoMensal`'s DP loop performs two extra DB round trips beyond what's strictly needed, but acceptable at current scale

**File:** `src/modules/tarefas/geracao.ts:84-105`
**Issue:** Two separate `tx.empresa.findMany` calls are issued (one for Fiscal/all-active-empresas, one for CLT-only-with-DP-responsible) instead of a single query selecting both `regimeTributario` and `responsaveisPorSetor` in one pass. This is a minor inefficiency, not flagged as a performance defect per the explicit out-of-scope rule for v1 (data volume is ~100-110 empresas, well within acceptable latency), but noting it for future maintainers who might be tempted to "optimize" by merging the queries — doing so would need to preserve the exact `setor: "DP"` filter semantics from WR-02 to avoid reintroducing Pitfall 2.
**Fix:** No action needed at current scale; documented for awareness only.

---

_Reviewed: 2026-06-24T13:14:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
