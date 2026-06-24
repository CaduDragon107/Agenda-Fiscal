---
phase: 06-motor-de-gera-o-departamento-pessoal
verified: 2026-06-24T00:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 6: Motor de Geração — Departamento Pessoal Verification Report

**Phase Goal:** Toda empresa com funcionários CLT recebe, automaticamente todo mês, as obrigações de Folha de Pagamento, FGTS, INSS e eSocial, atribuídas ao responsável de DP correto, com prazos ajustados por dia útil/feriado e sem duplicação — e a equipe de DP já consegue usar tarefas avulsas como o Fiscal usa hoje.
**Verified:** 2026-06-24
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (from ROADMAP Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | Toda empresa com `temFuncionariosClt=true` recebe automaticamente Folha/FGTS/INSS/eSocial | ✓ VERIFIED | `src/modules/tarefas/geracao.ts:95-105` queries `where: { ativo: true, temFuncionariosClt: true }`; `gerarTarefasDoMesDp` (`src/lib/geracao-tarefas-dp.ts:74-102`) emits exactly the 4 `CATALOGO_OBRIGACOES_DP` entries (FOLHA, ESOCIAL, FGTS, INSS) per company. Confirmed by `tests/geracao-tarefas-dp.test.ts` (4 types produced) and `tests/geracao.idempotencia.test.ts` positive-path case (`criadas:4`, all 4 `tipoObrigacao` present). |
| 2 | Empresas sem CLT não recebem nenhuma tarefa de DP | ✓ VERIFIED | The DP query gate is `temFuncionariosClt: true` — companies without it are never selected into `empresasClt`, so `gerarTarefasDoMesDp` is never called for them. No DP tarefa is generated unless this flag is true (read directly in `geracao.ts:95-96`). |
| 3 | Cada tarefa de DP é atribuída ao responsável de DP correto (nunca Fiscal por engano), prazo ajustado por dia útil/feriado | ✓ VERIFIED | `responsaveisPorSetor: { where: { setor: "DP" }, select: { usuarioId: true } }` (`geracao.ts:100-103`) — filter present in production code (not just claimed). Regression test `tests/geracao.idempotencia.test.ts:186-212` confirms tasks use `dp_user`, never `user_fiscal`, when both responsibles coexist (though the test asserts via mock-shape simulation rather than asserting the actual Prisma call args — see Warning below). Date math verified directly: `calcularQuintoDiaUtil("2026-06")` → 07/07/2026 (Tue); `calcularQuintoDiaUtil("2026-12")` → 08/01/2027 (Fri, pushed by New Year's holiday) — matches RESEARCH.md's independently-executed values. ESOCIAL/FGTS/INSS use `calcularPrazoBaseDiaFixo` + `anticiparParaDiaUtil` (dia 7/15, retreat-to-business-day) — same pattern as Fiscal, holiday-aware via shared `hd` singleton (no second `Holidays()` instance, confirmed by reading `dia-util.ts`). |
| 4 | Rodar a geração 2x na mesma competência não duplica nenhuma tarefa de DP | ✓ VERIFIED | Single merged `[...tarefasFiscal, ...tarefasDp]` array flows into one `tx.tarefa.createMany({ skipDuplicates: true })` (`geracao.ts:122-134`), backed by `@@unique([empresaId, tipoObrigacao, competencia])` (verified in `prisma/schema.prisma`). `tests/geracao.idempotencia.test.ts:214+` ("idempotência DP: segunda execução... não duplica") exercises this directly. |
| 5 | Qualquer colaborador de DP consegue criar tarefa avulsa e atribuí-la a si mesmo ou a colega de DP, reusando o mecanismo existente | ✓ VERIFIED | Zero production code changed for DP-05 (confirmed: `git diff --stat` for plan 06-03 touched only `tests/tarefas.dp.test.ts`). `criarTarefa` already applies `withVisibilityScope` which for a DP user resolves to `{ responsaveisPorSetor: { some: { setor: "DP", usuarioId } } }` — proven by 3 real regression tests in `tests/tarefas.dp.test.ts` (self-assign passes; third-party assign blocked with `"não autorizado"`; out-of-scope company blocked with `"não encontrado"`), each asserting actual `where` clause passed to `empresa.findFirst`, not just return values. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `prisma/schema.prisma` | enum `TipoObrigacao` +FOLHA/ESOCIAL/FGTS/INSS | ✓ VERIFIED | Grep confirms all 4 values present; ICMS/PIS_COFINS/SPED_FISCAL/SPED_CONTRIBUICOES/DAS untouched (additive only). |
| `src/lib/dia-util.ts` | `calcularQuintoDiaUtil` (forward business-day count) | ✓ VERIFIED | Function exists, reuses shared `hd` singleton/`isDiaUtil`, no second Holidays instance, no compose with `anticiparParaDiaUtil`. |
| `src/lib/geracao-tarefas-dp.ts` | Flat DP catalog + pure generator | ✓ VERIFIED | `CATALOGO_OBRIGACOES_DP`, `TITULO_OBRIGACAO_DP`, `gerarTarefasDoMesDp` all present and substantive (not stubs) — full logic for both QUINTO_DIA_UTIL and DIA_BASE branches implemented. |
| `src/modules/tarefas/geracao.ts` | Second DP loop inside same transaction + extended return type | ✓ VERIFIED | `executarGeracaoMensal` returns `{ criadas, puladas, semResponsavelDp }` on every return path including the `tarefas.length === 0` early-return. Fiscal loop unchanged (`select: { id, regimeTributario, responsavelId }` still present, unmodified per RESEARCH.md's explicit decision not to migrate it). |
| `src/app/(app)/tarefas/actions.ts` | `AcaoGeracaoResult` ganha `semResponsavelDp` | ✓ VERIFIED | Type extended; `gerarTarefasDoMesAction` destructures and propagates the field; DONO-only guard intact. |
| `src/app/(app)/tarefas/gerar-tarefas-button.tsx` | UI surfaces `semResponsavelDp` to DONO | ✓ VERIFIED | `toast.warning` rendered when `resultado.semResponsavelDp.length > 0`, listing company names — D-02 requirement satisfied end-to-end. |
| `tests/tarefas.dp.test.ts` | DP-05 regression suite | ✓ VERIFIED | 3 real test cases, asserting actual `where` clauses, not just return shapes. Zero production code touched by this plan (confirmed via git log). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `geracao-tarefas-dp.ts` | `dia-util.ts` | `import { anticiparParaDiaUtil, calcularQuintoDiaUtil }` | ✓ WIRED | Import present and both functions actually called in `gerarTarefasDoMesDp`. |
| `geracao.ts` | `geracao-tarefas-dp.ts` | `import { gerarTarefasDoMesDp }` | ✓ WIRED | Imported and called inside the transaction with the partitioned `comResponsavelDp` array. |
| `geracao.ts` | `responsaveisPorSetor` (setor=DP) | `tx.empresa.findMany` with `where: { setor: "DP" }` in select | ✓ WIRED | Filter literally present in production source (`geracao.ts:100-103`), confirmed by direct file read, not just grep on test mocks. |
| `actions.ts` | `geracao.ts` | `executarGeracaoMensal(...)` destructure | ✓ WIRED | `semResponsavelDp` destructured and returned in `ok:true` branch. |
| `gerar-tarefas-button.tsx` | `gerarTarefasDoMesAction` | `resultado.semResponsavelDp` | ✓ WIRED | Read and rendered as a toast — reaches the DONO-visible UI surface, satisfying D-02. |
| `tests/tarefas.dp.test.ts` | `src/app/(app)/tarefas/actions.ts` (`criarTarefa`) | `import { criarTarefa }` | ✓ WIRED | Imported and exercised against 3 scenarios with real assertions on `where` clauses passed to the mocked Prisma client. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full test suite (133 tests, 25 files) actually passes | `npx vitest run --reporter=dot` | `Test Files 25 passed (25)` / `Tests 133 passed (133)` | ✓ PASS |
| TypeScript compiles with new enum values and extended return types | `npx tsc --noEmit` | No errors | ✓ PASS |
| Enum `TipoObrigacao` in schema contains the 4 new DP values, Fiscal values intact | `grep -n "FOLHA\|ESOCIAL\|FGTS\|INSS\|enum TipoObrigacao" prisma/schema.prisma` | All 4 present inside `enum TipoObrigacao` block | ✓ PASS |
| Date math for FOLHA (5th business day) matches independently-verified research values | Direct read of `calcularQuintoDiaUtil` + corresponding test assertions (`07/07/2026`, `08/01/2027`) | Matches RESEARCH.md's separately-executed verification | ✓ PASS |
| Referenced commits actually exist in repo history | `git cat-file -e <hash>` for c511aba, 817f4b5, fb2b953, d9513fe, a0917a0 | All 5 commits exist | ✓ PASS |
| DP-05 plan touched zero production files | git log for `tests/tarefas.dp.test.ts` only modifies that test file | Confirmed — `06-03` plan/summary lists only the test file as created, no `src/` changes | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DP-01 | 06-01, 06-02 | Geração mensal de Folha de Pagamento | ✓ SATISFIED | `CATALOGO_OBRIGACOES_DP` FOLHA entry + `calcularQuintoDiaUtil`, wired into `executarGeracaoMensal`. |
| DP-02 | 06-01, 06-02 | Geração mensal de FGTS | ✓ SATISFIED | FGTS dia-base 15, `anticiparParaDiaUtil` applied, wired. |
| DP-03 | 06-01, 06-02 | Geração mensal de INSS | ✓ SATISFIED | INSS dia-base 15, `anticiparParaDiaUtil` applied, wired. |
| DP-04 | 06-01, 06-02 | Geração mensal de eSocial (genérico) | ✓ SATISFIED | ESOCIAL dia-base 7, `anticiparParaDiaUtil` applied, wired. |
| DP-05 | 06-03 | Tarefas avulsas atribuíveis a colaboradores DP | ✓ SATISFIED | Proven via 3 real regression tests against existing `criarTarefa`/`withVisibilityScope`, zero new production code. |

No orphaned requirements found for this phase — REQUIREMENTS.md maps exactly DP-01 through DP-05 to Phase 6, all 5 covered.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `tests/geracao.idempotencia.test.ts` | 186-212 | Regression test for the `setor: "DP"` filter simulates the filter via mock-return shape rather than asserting the actual `where`/`select` args passed to `empresa.findMany` (carried over from code review WR-02) | ⚠️ Warning | The production code itself (`geracao.ts:100-103`) is verified correct by direct read — this is a test-rigor gap, not a functional defect. A future refactor that silently drops the `setor: "DP"` filter would not be caught by this specific test, though it would likely be caught by other behavioral assertions in the same file (e.g., the `responsavelId === "dp_user"` checks would still pass coincidentally if the mock continues to only return the DP row). |
| `src/app/(app)/tarefas/gerar-tarefas-button.tsx` | 22-25 | `handleClick` awaits `gerarTarefasDoMesAction()` without try/catch; only the inner `executarGeracaoMensal` call inside the action has a try/catch, not the preceding `auth()`/parse path | ⚠️ Warning | If `auth()` throws before reaching the inner try block, the button's `setIsPending(false)` (line 25) never executes, leaving the UI stuck in a loading state with no user-facing error (carried over from code review WR-01, confirmed present in the actual file as of this verification). |

No critical/blocker anti-patterns found. No TBD/FIXME/XXX debt markers in any phase-modified file. No placeholder/stub implementations detected in any of the 11 reviewed files.

### Human Verification Required

None. All phase truths are objectively verifiable via code inspection, automated tests, and direct execution (tsc, vitest) — no visual/UX/real-time behavior introduced by this phase that requires human judgment.

### Gaps Summary

No blocking gaps. Two pre-existing warnings (carried forward from `06-REVIEW.md`, both still present in the current code state) are non-blocking:

1. **WR-01 (UI robustness):** `gerar-tarefas-button.tsx` can get stuck in a permanent loading state if `auth()` throws before `executarGeracaoMensal` is reached. This is a UX robustness issue, not a goal-blocking defect — the core DP generation, persistence, and reporting behavior all work correctly when the happy path executes (which is the overwhelmingly common case for a DONO clicking a button while already authenticated).
2. **WR-02 (test rigor):** The FISCAL-vs-DP regression test doesn't directly assert the `where: { setor: "DP" }` clause on the production Prisma call — it simulates the filter via what the mock returns. The actual production code DOES have the filter (verified directly), so the phase goal (correct DP responsible assignment) is genuinely achieved; only the depth of regression protection against a future silent removal of that filter is slightly weaker than ideal.

Neither warning changes whether the phase goal — "every CLT company automatically gets Folha/FGTS/INSS/eSocial assigned to the correct DP responsible, with correct due dates, no duplication, plus working avulsa tasks for DP" — is achieved. It is achieved, and is fully test-covered and runtime-verified (133/133 tests passing, tsc clean, all key wiring confirmed by direct source inspection rather than SUMMARY claims).

---

_Verified: 2026-06-24_
_Verifier: Claude (gsd-verifier)_
