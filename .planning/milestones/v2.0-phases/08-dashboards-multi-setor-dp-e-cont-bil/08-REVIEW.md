---
phase: 08-dashboards-multi-setor-dp-e-cont-bil
reviewed: 2026-06-25T16:08:12Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/lib/tipo-obrigacao-setor.ts
  - tests/tipo-obrigacao-setor.test.ts
  - scripts/backfill-desempenho-setor.mjs
  - prisma/schema.prisma
  - src/modules/dashboards/queries.ts
  - src/modules/dashboards/snapshot.ts
  - tests/dashboards.queries.test.ts
  - tests/dashboards.snapshot.test.ts
  - tests/geracao.idempotencia.test.ts
  - tests/geracao.actions.test.ts
  - src/app/(app)/dashboards/empty-state.tsx
  - src/app/(app)/dashboards/guard.ts
  - src/app/(app)/dashboards/page.tsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
resolution:
  CR-01: fixed (commit d885854 — snapshot.ts aggregation now partitioned by (colaboradorId, setor), 2 regression tests added)
  CR-02: not fixed (assessed as non-issue — script is a one-time migration verification tied to this run's pre-count, not a recurring idempotent check, mirroring other one-off backfill scripts in this project)
  WR-01: not fixed (deferred)
  WR-02: not fixed (deferred)
  WR-03: not fixed (deferred)
  IN-01: not fixed (deferred)
  IN-02: not fixed (deferred)
---

# Phase 8: Code Review Report

**Reviewed:** 2026-06-25T16:08:12Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the multi-sector dashboard feature (DP and Contábil sector scoping for DASH-01/02/03), the new `tipo-obrigacao-setor.ts` sector-classification helper, the `DesempenhoMensal.setor` backfill script, and the frozen-snapshot calculation module. The live-query path (`src/modules/dashboards/queries.ts`) correctly applies `tarefaSetorWhere(setor)` to every Prisma query, achieving real sector isolation. However, the **frozen snapshot path** (`src/modules/dashboards/snapshot.ts`, which persists `DesempenhoMensal` rows consumed by `listarEvolucaoMensal` for closed months) never applies `tarefaSetorWhere` at all — it aggregates ALL of a colaborador's completed/created tasks regardless of their true sector and labels the resulting single row with the colaborador's static `Usuario.setor`. This silently breaks sector isolation for every closed month whenever a colaborador completes a task outside their home sector (a structurally possible state — `Tarefa.responsavelId` carries no sector constraint, and `EmpresaResponsavelSetor` explicitly allows per-empresa/per-setor assignment). This is the single most consequential defect found and directly contradicts the module's own stated invariant ("CRÍTICO (continuidade live→frozen): ... para que não haja um degrau visível"). A second blocker was found in the backfill verification script, whose pass/fail logic is inverted and can never succeed after its first run. Additional rounding/aggregation, UX-parameter, and silent-data-loss issues are documented below.

## Critical Issues

### CR-01: Frozen snapshot never sector-scopes the task population it aggregates

**File:** `src/modules/dashboards/snapshot.ts:72-87` and `src/modules/dashboards/snapshot.ts:153-166`
**Issue:** `calcularSnapshotMensal` queries `tx.tarefa.findMany` for both the "concluídas" population (lines 72-87) and the "criadas" population (lines 153-166) with **no `tarefaSetorWhere` filter** of any kind. It aggregates ALL tasks across ALL sectors, grouped only by `responsavelId`, and produces exactly one row per colaborador per competência. That row is then tagged with whatever `Usuario.setor` the colaborador currently has (lines 232-254) — not with the sector the underlying tasks actually belong to.

This is inconsistent with the live path: `listarDesempenhoColaboradoresMesAtual` and `calcularCategoriasCriadas` in `src/modules/dashboards/queries.ts` both call `...tarefaSetorWhere(setor)` and are invoked once per sector (FISCAL/DP/CONTABIL) in `guard.ts`'s `Promise.all` fan-out, giving 3 independently-scoped results. The frozen path instead computes a single sector-blind total and "tags" it after the fact.

Concrete failure scenario: a colaborador whose `Usuario.setor` is `DP` completes a `tipoObrigacao: "ICMS"` task (assigned to them via `Tarefa.responsavelId`, e.g. covering for a Fiscal colleague) or an avulsa task that belongs to a different sector. That completion gets folded into the DP row of `DesempenhoMensal` for that competência. When `listarEvolucaoMensal` later reads `db.desempenhoMensal.groupBy({ where: { competencia, setor: "DP" } })` for the frozen month, the FISCAL-typed completion is now counted as DP work, and is invisible to the FISCAL dashboard for that month — even though `tarefaSetorWhere("FISCAL")` would have classified it as FISCAL had the live path been used. This breaks the documented "no live→frozen degrau" guarantee and the disjointness invariant established in `tipo-obrigacao-setor.ts`/T-08-03 for every closed month, permanently and silently (frozen rows are never recomputed per D-05).

The existing test suite (`tests/dashboards.snapshot.test.ts`, describe block "setor derivado de Usuario.setor") only asserts that the colaborador's `Usuario.setor` is copied onto the output row — it never constructs a fixture where a colaborador's completed tasks span more than one sector's `tipoObrigacao`, so the bug is untested and currently invisible to CI.

**Fix:**
```typescript
// snapshot.ts must compute one (colaborador, setor) pair per actual task
// sector, not one row per colaborador tagged with their static Usuario.setor.
// Minimal fix: loop over the 3 sectors and apply tarefaSetorWhere(setor) to
// both findMany calls, exactly like queries.ts does, then key the in-memory
// maps by `${responsavelId}:${setor}` instead of just `responsavelId`.

import { tarefaSetorWhere } from "@/lib/tipo-obrigacao-setor";
import type { Setor } from "@prisma/client";

const SETORES: Setor[] = ["FISCAL", "DP", "CONTABIL"];

for (const setor of SETORES) {
  const tarefasNoPeriodo = await tx.tarefa.findMany({
    where: {
      status: "CONCLUIDA",
      historico: { some: { concluidoEm: { gte: inicio, lte: fim } } },
      ...tarefaSetorWhere(setor),
    },
    // ...same select...
  });
  // aggregate into porColaborador keyed by responsavelId, but only for rows
  // produced by THIS setor's query — then push a LinhaSnapshotMensal with
  // setor explicitly set to the loop variable `setor`, NOT looked up from
  // Usuario.setor.
}
```
This also removes the need for the `Usuario.setor` lookup as a source of truth for sector tagging — `setor` becomes a parameter of the aggregation itself, matching how the live path already works.

---

### CR-02: Backfill verification script's pass/fail check is inverted — cannot succeed after first run

**File:** `scripts/backfill-desempenho-setor.mjs:28,41-47`
**Issue:** `preMigrationCount` is hardcoded to `0` (a one-time manual observation from when the table was empty), and the verification at line 41 asserts:
```js
if (totalFiscal !== preMigrationCount || totalRows !== preMigrationCount) { /* fail */ }
```
i.e. it asserts both `totalFiscal` and `totalRows` equal **zero** — not that they equal each other. The script's own docstring (lines 11-14) claims the intent is "contagem de linhas setor='FISCAL' apos o backfill deve ser EXATAMENTE igual a contagem total de linhas capturada antes da migracao" (i.e., `totalFiscal === totalRows`), but the code instead hardcodes the comparison target to the literal value observed once in one environment. Any future run of this script — in CI, in a different environment, against a database that already has rows (which is the expected, correct post-backfill state) — will report `FALHA DE VERIFICAÇÃO` even though the backfill is working perfectly, because `totalRows`/`totalFiscal` will be > 0. This makes the script unusable as a repeatable verification tool; it is effectively single-use and will mislead anyone who reruns it.

**Fix:**
```javascript
// Capture the pre-migration count dynamically (or accept it as a CLI arg/
// env var if it must be captured before the migration is applied), and
// verify internal consistency (all rows are FISCAL) rather than equality
// to a hardcoded constant:
const totalFiscal = await db.desempenhoMensal.count({ where: { setor: "FISCAL" } });
const totalRows = await db.desempenhoMensal.count();

if (totalFiscal !== totalRows) {
  console.error(
    `FALHA DE VERIFICAÇÃO: esperado todas as ${totalRows} linhas com setor='FISCAL', encontrado apenas ${totalFiscal}`
  );
  process.exitCode = 1;
  return;
}
```

## Warnings

### WR-01: Double-rounding error in `listarEvolucaoMensal`'s live point produces a biased/incorrect aggregate percentage

**File:** `src/modules/dashboards/queries.ts:292-300`
**Issue:** `listarDesempenhoColaboradoresMesAtual` only returns `percentualNoPrazo` (already rounded to the nearest integer percent), never the raw `noPrazo` count. `listarEvolucaoMensal` then reconstructs an approximate `noPrazo` count per colaborador by reversing the rounded percentage:
```js
noPrazo: acc.noPrazo + Math.round((c.percentualNoPrazo / 100) * c.totalConcluidas)
```
This is a lossy round-trip. Concrete counterexample: `totalConcluidas = 9`, actual `noPrazo = 1` → `percentualNoPrazo = Math.round(1/9*100) = 11`. Reversing: `Math.round(0.11 * 9) = Math.round(0.99) = 1` (happens to survive here), but with `totalConcluidas = 9`, `noPrazo = 1` is borderline; slightly different inputs lose data outright — e.g. `totalConcluidas = 19`, `noPrazo = 1` → `percentualNoPrazo = Math.round(5.26) = 5`; reversing: `Math.round(0.05 * 19) = Math.round(0.95) = 1` (survives), but `totalConcluidas = 21`, `noPrazo = 1` → `percent = Math.round(4.76) = 5`; reversing: `Math.round(0.05*21) = Math.round(1.05) = 1` (survives) — but `totalConcluidas = 23`, `noPrazo=1` → `percent = round(4.35) = 4`; reversing: `round(0.04*23) = round(0.92) = 1` (still survives) vs `totalConcluidas = 50, noPrazo = 1` → `percent = round(2) = 2`; reversing: `round(0.02*50) = round(1) = 1` (survives) but `totalConcluidas = 60, noPrazo = 1` → `percent = round(1.67) = 2`; reversing: `round(0.02*60) = round(1.2) = 1` (survives), whereas `totalConcluidas = 70, noPrazo = 1` → `percent = round(1.43) = 1`; reversing: `round(0.01*70) = round(0.7) = 1` (survives) — but at `totalConcluidas = 110, noPrazo = 1` → `percent = round(0.91) = 1`; reversing: `round(0.01*110) = round(1.1) = 1` (survives), while `totalConcluidas = 150, noPrazo = 1` → `percent = round(0.67) = 1`; reversing: `round(0.01*150) = round(1.5) = 2` — **over-counts by 1**. The error direction and magnitude is unpredictable and compounds across multiple colaboradores, producing a "ponto live" percentual that does not match the true team-wide on-time ratio. This is the exact "mesmo critério" continuity the module's own comments insist on (no live→frozen degrau), yet this computation diverges from the frozen snapshot's exact-integer `_sum` aggregation in `db.desempenhoMensal.groupBy` (lines 245-259), which has no such rounding loss.
**Fix:** Expose the raw integer `noPrazo` (or rename it, e.g. `totalNoPrazo`) on `DesempenhoColaborador` alongside `percentualNoPrazo`, and sum the raw integers directly in `listarEvolucaoMensal` instead of reverse-engineering them from a rounded percentage:
```typescript
type DesempenhoColaborador = {
  colaboradorId: string;
  nome: string;
  percentualNoPrazo: number;
  totalConcluidas: number;
  totalNoPrazo: number; // NEW: raw integer, not derived from percentualNoPrazo
  totalEmpresas: number;
};
// ...
return colaboradores.map((c) => {
  const dados = porColaborador.get(c.id) ?? { totalConcluidas: 0, noPrazo: 0 };
  return {
    colaboradorId: c.id,
    nome: c.nome,
    percentualNoPrazo: dados.totalConcluidas
      ? Math.round((dados.noPrazo / dados.totalConcluidas) * 100)
      : 0,
    totalConcluidas: dados.totalConcluidas,
    totalNoPrazo: dados.noPrazo,
    totalEmpresas: carteiraPorColaborador.get(c.id) ?? 0,
  };
});
// then in listarEvolucaoMensal:
const totalAtual = colaboradores.reduce(
  (acc, c) => ({ total: acc.total + c.totalConcluidas, noPrazo: acc.noPrazo + c.totalNoPrazo }),
  { total: 0, noPrazo: 0 }
);
```

### WR-02: `listarRankingEmpresas`'s period window ignores the `?meses=` query parameter — always fixed to 3 months

**File:** `src/app/(app)/dashboards/guard.ts:48-49,61-66`
**Issue:** `inicio3Meses = subMonths(hoje, 3)` is a hardcoded constant, used unconditionally as `periodoInicio` for `listarRankingEmpresas` regardless of the validated `quantidadeMeses` (which defaults to 6 and can be set 1-24 via `?meses=`). Only `listarEvolucaoMensal` actually receives `quantidadeMeses`. A dono changing `?meses=12` expecting the "empresas com mais atrasos" ranking to reflect a wider window will see no change in that card, which is inconsistent and likely to be perceived as a bug by the end user even though it is "by design" per the queries.ts comment. Since the UI exposes a single shared "meses" control (implied by the URL contract) but two of the three dashboard cards (evolução + ranking) interpret it differently, this is a real UX inconsistency.
**Fix:** Either (a) pass `quantidadeMeses` through to derive the ranking window too (`subMonths(hoje, quantidadeMeses)`), or (b) if the 3-month ranking window is intentionally independent, make this explicit in the UI (e.g., a separate, non-shared control) so the dono is not misled into thinking `?meses=` affects all three cards.

### WR-03: Avulsa tasks belonging to a colaborador with `Usuario.setor = null` are silently dropped from every sector dashboard

**File:** `src/lib/tipo-obrigacao-setor.ts:52-59`
**Issue:** `tarefaSetorWhere(setor)`'s second OR clause, `{ tipoObrigacao: null, responsavel: { setor } }`, only matches avulsa tasks whose `responsavel.setor` equals the sector being queried. Since `Usuario.setor` is nullable (`schema.prisma:65`, `setor Setor?`), any avulsa task assigned to a colaborador without a sector set will never match any of the 3 sector queries (FISCAL/DP/CONTABIL) — it disappears from all 3 dashboards with no error, warning, or visible indicator to the dono that data is being excluded. Given the system models exactly 4 colaboradores + 1 dono, a single colaborador with an unset `setor` (e.g., a newly-created account before an admin assigns a sector) would cause every avulsa task they're responsible for to vanish from dashboards entirely.
**Fix:** Either enforce `Usuario.setor` as non-nullable for COLABORADOR-role users at the application layer (validation on user creation/edit), or add a defensive "sem setor" bucket/warning surfaced to the dono so missing data is visible rather than silent.

## Info

### IN-01: `calcularSnapshotMensal`'s carteira (`totalEmpresas`) context metric is not sector-scoped, unlike the live path's `empresaWhereExtra`

**File:** `src/modules/dashboards/snapshot.ts:115-122`
**Issue:** `tx.empresa.groupBy({ where: { ativo: true } })` has no `empresaWhereExtra`-equivalent filter, so `totalEmpresas` in every frozen `DesempenhoMensal` row reflects the colaborador's full active-company count, not scoped to the row's `setor` (e.g., DP's `temFuncionariosClt: true` filter used by the live path in `queries.ts:100`). This means a frozen DP snapshot's `totalEmpresas` will include non-CLT companies, while the live DP dashboard's `totalEmpresas` (via `empresaWhereExtra`) only counts CLT companies — a visible discontinuity in the "carteira" context number specifically at the live→frozen boundary for DP and any other sector with a non-empty `empresaWhereExtra`. Less severe than CR-01 since it only affects a contextual count, not the percentage itself, but still a live→frozen consistency gap the module's docstring promises to avoid.
**Fix:** Thread the relevant `empresaWhereExtra`-equivalent per sector into the carteira groupBy in `snapshot.ts`, mirroring the fix for CR-01 (loop per sector, apply the matching company filter).

### IN-02: `listarEvolucaoMensal`'s own `quantidadeMeses = 3` default is unreachable/dead in production

**File:** `src/modules/dashboards/queries.ts:231`
**Issue:** The exported function's default parameter `quantidadeMeses = 3` can never actually be exercised by the application, because the sole caller (`guard.ts:60`) always passes an explicit value (parsed from `?meses=` or defaulted to `6`). This isn't a bug, but the discrepancy between the two defaults (3 here vs. 6 in guard.ts) is a maintenance trap — a future reader might reasonably assume the function's default reflects production behavior when it does not.
**Fix:** Either remove the default (force callers to be explicit) or align it with the actual production default (6) to avoid confusion.

---

## Resolution

**CR-01 — fixed** (commit `d885854`). `calcularSnapshotMensal` now selects `tipoObrigacao` on both task-population queries and derives each task's sector via a `setorDaTarefa()` helper that mirrors `tarefaSetorWhere`'s classification (recorrentes by `tipoObrigacao`, avulsas by the colaborador's own `Usuario.setor` — no extra join, since `responsavel.setor` for a task IS that colaborador's `Usuario.setor`). Aggregation maps are now keyed by `(colaboradorId, setor)` composite instead of `colaboradorId` alone, so a colaborador with cross-sector tasks now produces one row per sector instead of one contaminated row. 2 regression tests added proving isolation; all 32 pre-existing snapshot/geracao tests pass unmodified.

**CR-02, WR-01, WR-02, WR-03, IN-01, IN-02 — not fixed.** CR-02 was assessed and is not considered an issue (the script is a one-time migration verification script tied to the actual pre-count observed during Plan 08-01's migration, not a reusable idempotent check — consistent with this project's other one-off backfill scripts). The remaining Warnings/Info findings are real but lower-severity and deferred as known follow-ups; they do not block Phase 8 completion.

---

_Reviewed: 2026-06-25T16:08:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
