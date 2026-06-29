---
phase: 09-decimo-terceiro-salario-automatico
verified: 2026-06-29T08:10:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 9: 13º Salário Automático Verification Report

**Phase Goal:** Toda empresa com funcionários CLT tem, todo ano, uma tarefa de 13º salário gerada automaticamente pelo cron mensal — sem necessidade de criação manual, sem duplicação em execuções repetidas, integrada ao motor transacional existente (`executarGeracaoMensal`).

**Verified:** 2026-06-29T08:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Empresa com `temFuncionariosClt=true` recebe 1 tarefa de 13º/ano via cron mensal, sem duplicar em re-execuções | VERIFIED | `src/lib/geracao-tarefas-dp-anual.ts:78-94` (`obrigacoesDpAnuaisParaCompetencia`, triggers only in month 11); `tests/geracao-tarefas-dp-anual.test.ts` 12-month sweep passes (1/12 trigger); `tests/geracao.idempotencia.test.ts:557-585` runs 2 executions of "2026-11" — 1st: `criadas=5,puladas=0`; 2nd: `criadas=0,puladas=5` (skipDuplicates behavior). Backed by `@@unique([empresaId, tipoObrigacao, competencia])` confirmed live in `prisma/schema.prisma:151` AND in the actual Neon DB (`prisma db pull --print` confirms constraint + enum value present on the live database, not just the local schema file). |
| 2 | Empresa sem `temFuncionariosClt` nunca recebe a tarefa | VERIFIED | `src/modules/tarefas/geracao.ts:144-154` (`empresasClt` query gated by `temFuncionariosClt: true`); DP-anual block reuses this exact dataset (`comResponsavelDp`), so a non-CLT empresa structurally never enters the loop. `tests/geracao.idempotencia.test.ts:587-602` — empty `empresasClt` → `createMany` not called, `criadas=0`. |
| 3 | Prazo (20/dez) antecipado para dia útil anterior quando cai em fim de semana/feriado | VERIFIED | `src/lib/geracao-tarefas-dp-anual.ts:103-110` (`calcularPrazoDpAnual` reuses `anticiparParaDiaUtil` unmodified — D-03); SUMMARY 09-01 documents concrete calendar validation (20/dez/2026 = Sunday → anticipated to Friday 18/dez/2026; 20/dez/2027 = Monday, no adjustment). Unit test in `tests/geracao-tarefas-dp-anual.test.ts` (Test 4) passes. |
| 4 | Responsável de DP vê a tarefa nas listas/dashboards de DP (mesmo tratamento de qualquer obrigação DP) | VERIFIED | `src/lib/tipo-obrigacao-setor.ts:23` — `DECIMO_TERCEIRO` registered in `TIPOS_OBRIGACAO_POR_SETOR.DP`; completeness test (`tests/tipo-obrigacao-setor.test.ts`) passes with sum=21, DP=5; explicit test `tests/geracao.idempotencia.test.ts:604-610` asserts `DECIMO_TERCEIRO` is in DP and NOT in FISCAL/CONTABIL; `responsavelId` sourced from `responsaveisPorSetor` filtered by `setor: "DP"` (never legacy `empresa.responsavelId`), same as all other DP tasks — confirmed at `geracao.ts:303`. |
| 5 (PLAN 09-01) | Enum `TipoObrigacao` contains `DECIMO_TERCEIRO` after push (in Prisma schema AND live Neon DB) | VERIFIED | `prisma/schema.prisma:58` contains the value; `npx prisma db pull --print` run live during this verification confirms the value is present on the actual Neon database (21 values total), not just the local schema file — Task 3 of Plan 01 (the BLOCKING DB push task) is genuinely confirmed, not just claimed. |
| 6 (PLAN 09-02) | 6th block integrated into `executarGeracaoMensal`, reusing `empresasClt`/`comResponsavelDp` without a new `tx.empresa.findMany` call | VERIFIED | `src/modules/tarefas/geracao.ts:282-311` — block iterates `comResponsavelDp` (declared at line 156, reused from the DP-mensal block); no new `findMany` call introduced; test `tests/geracao.idempotencia.test.ts:528` asserts `empresaFindManyMock` called exactly 3 times (unchanged from pre-Phase-9 baseline). |
| 7 | Catalog is a pure function, no I/O, structurally parallel to but independent from Contábil-anual module (no regression risk) | VERIFIED | `src/lib/geracao-tarefas-dp-anual.ts` has zero imports from `geracao-tarefas-contabil-anual`; `anoVencimento = anoAtual` (not `+1`) hardcoded and commented explicitly (D-02); `geracao-tarefas-contabil-anual.ts` untouched (confirmed via SUMMARY git diff claims + direct read of both files — no contabil-anual changes present). |
| 8 | Return signature of `executarGeracaoMensal` unchanged (no `semResponsavelDpAnual` key) — design decision honored | VERIFIED | `src/modules/tarefas/geracao.ts:102-107,333-338` — return type still `{ criadas, puladas, semResponsavelDp, semResponsavelContabil }`; no new key added. |
| 9 | Full regression suite remains green after integration (no positional mock displacement, Pitfall 4) | VERIFIED | Ran `npx vitest run` directly during this verification: 32 test files, 216 tests, all passing. Matches SUMMARY claims exactly. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/geracao-tarefas-dp-anual.ts` | Pure annual DP catalog, 6 exports, `anoVencimento=anoAtual` | VERIFIED | All exports present (`TipoObrigacaoDpAnual`, `ObrigacaoDpAnualRegra`, `TITULO_OBRIGACAO_DP_ANUAL`, `CATALOGO_OBRIGACOES_DP_ANUAIS`, `obrigacoesDpAnuaisParaCompetencia`, `calcularPrazoDpAnual`), 111 lines, no `regimesElegiveis` field, no import from `geracao-tarefas-contabil-anual` |
| `tests/geracao-tarefas-dp-anual.test.ts` | Sweep + anoVencimento + dia útil tests | VERIFIED | Exists, runs, 7 tests passing (sweep, D-02 assertion, empty months, dia útil, format validation) |
| `prisma/schema.prisma` | `DECIMO_TERCEIRO` in `TipoObrigacao` enum | VERIFIED | Value present at line 58; confirmed live on Neon DB via `prisma db pull --print` |
| `src/lib/tipo-obrigacao-setor.ts` | `DECIMO_TERCEIRO` in `TIPOS_OBRIGACAO_POR_SETOR.DP` | VERIFIED | Present at line 23, only in DP list |
| `src/modules/tarefas/geracao.ts` | 6th transactional block reusing `comResponsavelDp`, concatenated to final `tarefas` array | VERIFIED | Block at lines 282-311; `...tarefasDpAnual` is last item of `tarefas` array (line 318) |
| `tests/geracao.idempotencia.test.ts` | Integration tests: creation, absence, idempotency, sector classification, eligibility gate | VERIFIED | 5 new tests present (lines 485-610), all passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `tipo-obrigacao-setor.ts` | `prisma/schema.prisma` | `TIPOS_OBRIGACAO_POR_SETOR.DP` includes `DECIMO_TERCEIRO` | WIRED | Completeness test green (sum=21, no orphaned enum value) |
| `geracao-tarefas-dp-anual.ts` | `dia-util.ts` | `calcularPrazoDpAnual` calls `anticiparParaDiaUtil` | WIRED | Confirmed at line 109, real calendar validation in SUMMARY |
| `geracao.ts` | `geracao-tarefas-dp-anual.ts` | Import of `obrigacoesDpAnuaisParaCompetencia`/`calcularPrazoDpAnual`/`TITULO_OBRIGACAO_DP_ANUAL` | WIRED | Imported at lines 77-82, called at line 289 and 308 |
| `geracao.ts` (tarefasDpAnual) | `tipo-obrigacao-setor.ts` (DP) | Tasks created with `tipoObrigacao: "DECIMO_TERCEIRO"` classified as DP by `tarefaSetorWhere("DP")` | WIRED | Verified by explicit test asserting sector membership |
| `tarefasDpAnual` | `comResponsavelDp` (existing DP query) | Direct reuse, no new `findMany` | WIRED | `geracao.ts:302` iterates `comResponsavelDp` directly; mock-call-count test confirms no new query |

### Data-Flow Trace (Level 4)

Not applicable in the traditional UI sense — this phase is 100% backend/batch generation logic (no React component, no API route rendering data to a client). The data-flow that matters here is: `competencia` (string input to `executarGeracaoMensal`) → pure catalog decision (`obrigacoesDpAnuaisParaCompetencia`) → real Prisma `createMany` write → real Postgres unique constraint enforcement. All links traced above are genuinely connected, not hardcoded/static — the catalog returns `[]` for 11/12 months (verified by sweep test) and a real array for November, flowing into a real `tx.tarefa.createMany` call (not a stub/no-op).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Catalog + sector map unit tests pass | `npx vitest run tests/geracao-tarefas-dp-anual.test.ts tests/tipo-obrigacao-setor.test.ts` | 2 files, 12 tests passed | PASS |
| Integration/idempotency tests pass | `npx vitest run tests/geracao.idempotencia.test.ts` | 1 file, 18 tests passed | PASS |
| Full regression suite passes | `npx vitest run` | 32 files, 216 tests passed | PASS |
| TypeScript compiles cleanly | `npx tsc --noEmit` | No output (clean) | PASS |
| Live Neon DB actually contains the new enum value (not just local schema) | `npx prisma db pull --print \| grep -A25 "enum TipoObrigacao"` | `DECIMO_TERCEIRO` present, 21 values total | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DP-09 | 09-01, 09-02 | Geração automática anual de tarefa de 13º salário, por empresa com funcionários CLT, reaproveitando o motor de periodicidade anual já validado no Contábil | SATISFIED | All 4 ROADMAP success criteria verified above; REQUIREMENTS.md confirms `[x] DP-09` and maps to "Phase 9 / Complete" |

No orphaned requirements found — REQUIREMENTS.md maps only DP-09 to Phase 9, and it is claimed by both plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/modules/tarefas/geracao.ts` | 305 | Title separator uses ASCII hyphen (`-`) instead of em dash (`—`) used by every other obligation catalog (Fiscal, DP mensal, Contábil mensal/anual) | WARNING (cosmetic) | End-user-visible inconsistency: "13º Salário - 2026" next to "ECD — 2026" in the same task list. Locked in by a test assertion (`tests/geracao.idempotencia.test.ts:524`), so a future fix requires updating both the catalog title and the test. Does not affect generation, idempotency, eligibility, or visibility — purely a display string. Flagged by 09-REVIEW.md as WR-01. |
| `src/modules/tarefas/geracao.ts` | 282-311 | DP-anual block implicitly depends on DP-mensal block's filter/elegibility staying in sync, with no test asserting the coupling itself (only indirect coverage via a call-count assertion) | INFO/WARNING (maintainability) | No functional defect today (elegibility is identical for both blocks); risk is forward-looking if a future change diverges DP-anual eligibility from DP-mensal without updating this block. Flagged by 09-REVIEW.md as WR-02. |

No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) found in any of the 7 files modified by this phase.

### Human Verification Required

None. This phase is 100% backend/batch logic with no UI, no external service call, and no user-facing flow that requires manual exercise — all observable truths are mechanically verifiable via tests, schema inspection, and a live DB query, all of which were performed directly during this verification (not just trusted from SUMMARY.md).

### Gaps Summary

No blocking gaps. Both warnings carried over from `09-REVIEW.md` (WR-01 em-dash inconsistency, WR-02 implicit coupling) are real but non-blocking:

- **WR-01** is a cosmetic title-formatting inconsistency. It does not affect any of the 4 ROADMAP success criteria (generation, eligibility gate, dia útil adjustment, sector visibility) — the task is generated, idempotent, correctly gated, and correctly classified as DP regardless of which dash character appears in its title. Acceptable to ship; recommended as a fast-follow fix (update the catalog's title template + the one locked-in test assertion to use `—`).
- **WR-02** is a maintainability observation about an emergent invariant (DP-anual and DP-mensal currently share the exact same eligibility query/dataset), not a present defect — the shared dataset is real and correctly wired today, confirmed by the call-count test. No corrective action required to ship; worth a comment/dedicated test if a future DP-anual obligation needs different eligibility.

Goal-backward verification confirms: the 13º salário obligation is genuinely generated by the real transactional orchestrator (not a stub), the live Neon database genuinely contains the new enum value (not just the local schema file — this was independently re-confirmed during this verification, not trusted from SUMMARY), idempotency rests on a real unique constraint (not an in-memory flag), the CLT gate is structurally enforced by query reuse, and DP visibility is enforced by a registered map entry backed by a completeness test. All four ROADMAP success criteria and DP-09 are satisfied end-to-end.

---

_Verified: 2026-06-29T08:10:00Z_
_Verifier: Claude (gsd-verifier)_
