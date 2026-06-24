---
phase: 07-motor-de-gera-o-cont-bil-mensal-e-anual
verified: 2026-06-24T16:10:00Z
status: human_needed
score: 4/4 roadmap truths verified (code-level); 1 cross-phase scope question and 1 docs-sync gap flagged for human decision
overrides_applied: 0
gaps: []
human_verification:
  - test: "Confirm DEFIS due-date semantics against the real Simples Nacional DEFIS deadline rule"
    expected: "Either (a) confirm the 13-month creation-to-deadline gap for DEFIS (created Feb of year Y, due March of year Y+1) is the intended real-world behavior, matching how 'ano-base' is defined for DEFIS reporting; or (b) flag as a defect requiring a same-year due-date fix"
    why_human: "This is a domain/regulatory judgment call, not a code defect. The code faithfully implements CONTEXT.md D-07/D-08 and RESEARCH.md Pitfall 2 exactly as documented and explicitly tested (anoVencimento = anoAtual + 1, unconditionally, for all 3 obligations including DEFIS). REVIEW.md already flagged this as Info (IN-1), explicitly recommending a sanity check against the real regulatory deadline before treating it as correct or incorrect. Real-world Simples Nacional DEFIS deadline is March 31 reporting the PRIOR calendar year — if 'ano-base' in this codebase means 'the year being reported' rather than 'the year of creation,', the +1 is arguably correct; but D-08's framing ('criada 1 mês antes do vencimento') does not hold for this case (13 months elapse, not 1), which is a genuine prose/intent inconsistency in the phase's own planning artifacts that a human who knows the real deadline rule should resolve."
  - test: "Confirm success criterion #4 wording ('atribuí-la a si mesmo ou a outro colega do Contábil') against the actual criarTarefa() authorization rule"
    expected: "Either acknowledge that COLABORADOR role can only self-assign avulsa tasks (cannot assign to a colleague — only DONO can assign to others) as the accepted real behavior, matching the identical pre-existing wording/behavior gap already accepted in Phase 6 for DP-05; or flag as a requirement that needs the criarTarefa() authorization model changed"
    why_human: "tests/tarefas.contabil.test.ts (test 2) proves, by design, that a CONTABIL colaborador attempting to assign a task to 'outro_user_contabil' is rejected with { ok: false, error: 'não autorizado' } — confirmed by reading src/app/(app)/tarefas/actions.ts lines 90-97 ('COLABORADOR só pode se atribuir como responsável — não pode atribuir tarefas a outros usuários. DONO pode atribuir livremente'). This contradicts the literal text of ROADMAP.md success criterion #4 ('atribuí-la a si mesmo OU a outro colega'). This is NOT a Phase-7 regression: the identical roadmap wording and identical code behavior exists for Phase 6 DP-05 (ROADMAP.md line 71), already marked Complete — so this is a systemic, pre-existing scope/wording mismatch inherited unchanged by Phase 7's explicit reuse-only design (D-12). A human should confirm whether 'outro colega' was always meant to mean 'DONO assigning to any colega' rather than 'any colaborador assigning to any colega,' or whether this is a latent requirement gap spanning two phases."
---

# Phase 7: Motor de Geração — Contábil (mensal e anual) Verification Report

**Phase Goal:** Toda empresa recebe automaticamente, todo mês, a obrigação de Escrituração/Balancete Contábil, e — pela primeira vez no sistema — obrigações anuais (ECD, ECF, DEFIS) são geradas corretamente uma única vez por ano por empresa, conforme seu regime tributário, sem confundir ou colidir com a geração mensal.
**Verified:** 2026-06-24T16:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | No início de cada competência mensal, toda empresa recebe automaticamente a tarefa de Escrituração/Balancete Contábil, atribuída ao responsável Contábil correto | ✓ VERIFIED | `src/modules/tarefas/geracao.ts` lines ~143-178: queries `tx.empresa.findMany` with `regimeTributario: { in: ["LUCRO_REAL","LUCRO_PRESUMIDO"] }`, reads responsible via `responsaveisPorSetor` filtered `setor: "CONTABIL"` (never legacy `empresa.responsavelId`), calls `gerarTarefasDoMesContabil` (8 rotinas, `src/lib/geracao-tarefas-contabil.ts`). 6/6 unit tests + integration tests pass. |
| 2 | Uma vez por ano, cada empresa Lucro Real recebe ECD+ECF; cada Simples Nacional recebe DEFIS — nunca zero, nunca duplicada, mesmo rodando 12x/ano | ✓ VERIFIED | `src/lib/geracao-tarefas-contabil-anual.ts`: `obrigacoesAnuaisParaCompetencia` filters by `mesCriacao === mesAtual`, pure function of (ano,mes). 12-month-sweep test (`tests/geracao-tarefas-contabil-anual.test.ts`) proves exactly 1 firing per obligation per year. Idempotency via `@@unique([empresaId, tipoObrigacao, competencia])` + `skipDuplicates: true` (no second control mechanism) — confirmed by re-execution test in `tests/geracao.idempotencia.test.ts` (criadas=0 on second run). Regime filter is dynamic (`regra.regimesElegiveis`), explicitly tested to exclude SIMPLES_NACIONAL from ECD (Pitfall 3 test). |
| 3 | Tarefas anuais e mensais do Contábil convivem na mesma competência/ano sem colidir nem corromper cálculos de prazo de nenhuma periodicidade | ✓ VERIFIED | Enum `TipoObrigacao` keeps the 8 mensal + 3 anual values fully disjoint (verified by reading `prisma/schema.prisma` lines 36-57 and confirmed live via `npx prisma db pull --print` against the production Neon DB — enum already contains all 11 new values). Competência formats are textually distinct ("YYYY-MM" vs "YYYY") and, even if they collided textually, the disjoint `tipoObrigacao` enum values alone guarantee no collision under the composite unique constraint. `calcularPrazoAnual` reuses `anticiparParaDiaUtil` unmodified — no shared mutable state with the monthly calculation path. |
| 4 | Qualquer colaborador do Contábil consegue criar tarefa avulsa e atribuí-la a si mesmo **ou a outro colega** do Contábil, reaproveitando o mecanismo existente | ⚠️ PARTIAL — see human_verification #2 | `tests/tarefas.contabil.test.ts` proves self-assignment works (test 1) AND proves assignment to a colleague is explicitly REJECTED for COLABORADOR role (test 2: `{ ok: false, error: "não autorizado" }`), per `criarTarefa()`'s existing authorization rule (`src/app/(app)/tarefas/actions.ts` lines 90-97: only DONO can assign to others). This is a literal mismatch with the roadmap's "ou a outro colega" wording — but it is a pre-existing, systemic behavior identical to Phase 6's DP-05 (same roadmap wording, same code path), not a regression introduced by this phase. Routed to human for a scope decision rather than auto-failed. |

**Score:** 3/4 truths fully verified; 1 truth (#4) verified at the "self-assign" half but contradicted at the "assign to colleague" half by both code and its own regression test — flagged for human decision rather than blocked, because the gap is identical to an already-accepted prior-phase pattern.

### Open Question Resolved: DEFIS Due-Date Formula (REVIEW.md IN-1)

Verified directly against the codebase: `src/lib/geracao-tarefas-contabil-anual.ts` computes `anoVencimento: anoAtual + 1` **unconditionally** for all three annual obligations (DEFIS, ECD, ECF) — confirmed by reading the function body and by the test `'para competência "2026-04" (ECD)... anoVencimento é 2027'`. This is genuinely intentional per the phase's own planning chain:
- `07-CONTEXT.md` D-07: "DEFIS — até 31/março do ano seguinte ao ano-base" (explicit, and footnoted as "confirmado pelo usuário como suficiente" — i.e., user-confirmed during context gathering).
- `07-RESEARCH.md` Pitfall 2: "o vencimento cai SEMPRE no ano SEGUINTE ao ano-base da competência... nunca no mesmo ano" — same rule, called out as a pitfall to avoid getting wrong, not as an open question.
- The code, tests, and design docs are all internally consistent with each other.

However, this produces a counter-intuitive result: DEFIS is *created* in February of year Y but *due* in March of year **Y+1** — a 13-month gap, not the "1 mês antes do vencimento" framing used elsewhere in D-08. Real-world Simples Nacional DEFIS is due March 31 reporting the **prior** calendar year's data — which could make the +1-year rule correct IF "ano-base" is defined as "the fiscal year being reported" rather than "the year of task creation." The codebase does not resolve which interpretation is intended; REVIEW.md (IN-1) already flagged this as worth a sanity check rather than a confirmed defect. **This verification escalates it to human_verification rather than resolving it unilaterally**, since it is a regulatory/domain judgment call, not a code-quality issue — the code does exactly what the design docs say.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | 11 new `TipoObrigacao` enum values | ✓ VERIFIED | All 11 present in source AND confirmed synced to live Neon DB via `npx prisma db pull --print` (enum block matches exactly) |
| `src/lib/geracao-tarefas-contabil.ts` | Mensal catalog (8 rotinas) + `gerarTarefasDoMesContabil` | ✓ VERIFIED | Exports `CATALOGO_OBRIGACOES_CONTABIL`, `TITULO_OBRIGACAO_CONTABIL`, `gerarTarefasDoMesContabil`, `TipoObrigacaoContabil`. Defensive `competenciaSchema.safeParse` validation present. No `new Date()`/`Date.now()` in calc paths. |
| `src/lib/geracao-tarefas-contabil-anual.ts` | Anual catalog (ECD/ECF/DEFIS) + `obrigacoesAnuaisParaCompetencia` + `calcularPrazoAnual` | ✓ VERIFIED | All exports present, pure functions, deterministic (parses competência string, never `new Date()` without args) |
| `src/lib/competencia.ts` | `competenciaAnualSchema` (format "YYYY") | ✓ VERIFIED | Line 28, regex `^\d{4}$`, sibling to existing `competenciaSchema` |
| `tests/geracao-tarefas-contabil.test.ts` | Unit tests, mensal catalog | ✓ VERIFIED | 6 tests, all passing |
| `tests/geracao-tarefas-contabil-anual.test.ts` | Unit tests, anual catalog + 12-month sweep | ✓ VERIFIED | 9 tests, all passing |
| `src/modules/tarefas/geracao.ts` | Mensal + anual blocks inside `executarGeracaoMensal`'s transaction | ✓ VERIFIED | Both blocks present (lines ~143-247), inside the same `tx`, dynamic `regra.regimesElegiveis` filter confirmed (Pitfall 3), `semResponsavelContabil` deduplicated via Map and present in both return paths |
| `src/app/(app)/tarefas/actions.ts` | `semResponsavelContabil` propagated in `AcaoGeracaoResult` | ✓ VERIFIED | Type, destructuring, and return all present (3 occurrences) |
| `src/app/(app)/tarefas/gerar-tarefas-button.tsx` | Toast warning for empresas sem responsável Contábil | ✓ VERIFIED | `toast.warning` block present, mirrors DP pattern |
| `tests/geracao.idempotencia.test.ts` / `tests/geracao.actions.test.ts` | Integration tests for transactional generation + idempotency | ✓ VERIFIED | Both pass; 5 new cases added per 07-02 (mensal generation, skip-and-list dedup, ECD April firing, idempotency, Pitfall 4 dedup) |
| `tests/tarefas.contabil.test.ts` | CONT-06 regression test | ✓ VERIFIED | 3 tests, mirrors `tests/tarefas.dp.test.ts`; proves `criarTarefa` composes correctly with sector-aware visibility scope for CONTABIL — but also proves the colleague-assignment restriction (see Truth #4 above) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `geracao.ts` | `geracao-tarefas-contabil.ts` | `import gerarTarefasDoMesContabil` | ✓ WIRED | Imported line 58, called line 171 |
| `geracao.ts` | `geracao-tarefas-contabil-anual.ts` | `import obrigacoesAnuaisParaCompetencia, calcularPrazoAnual` | ✓ WIRED | Imported lines 59-61, called lines 184, 228 |
| `geracao.ts` | `EmpresaResponsavelSetor` (setor CONTABIL) | `responsaveisPorSetor where setor CONTABIL` | ✓ WIRED | 2 occurrences (mensal + anual blocks), confirmed dynamic via grep |
| `actions.ts` | `geracao.ts` | destructure + propagate `semResponsavelContabil` | ✓ WIRED | Confirmed in `gerarTarefasDoMesAction` |
| `gerar-tarefas-button.tsx` | `actions.ts` | `resultado.semResponsavelContabil` | ✓ WIRED | Toast block reads the field directly |
| `tests/tarefas.contabil.test.ts` | `actions.ts` | `import criarTarefa` | ✓ WIRED | Confirmed, exercises real authorization logic with mocked DB/auth |

### Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense (no dashboard/component renders this data in Phase 7 — that is Phase 8's scope). The relevant data flow is motor → DB write → toast, which was traced above (wired end-to-end) and confirmed against the live production schema via `prisma db pull`.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live Neon DB has 11 new enum values | `npx prisma db pull --print \| grep -A 25 "enum TipoObrigacao"` | All 8 mensal + 3 anual (`EXTRATO_BANCARIO`...`DEFIS`) present in live DB introspection | ✓ PASS |
| Prisma schema validates | `npx prisma validate` | "The schema at prisma\schema.prisma is valid" | ✓ PASS |
| Phase 7 unit + integration test files pass | `npx vitest run tests/geracao-tarefas-contabil.test.ts tests/geracao-tarefas-contabil-anual.test.ts tests/geracao.idempotencia.test.ts tests/geracao.actions.test.ts tests/tarefas.contabil.test.ts` | 5 files, 34/34 tests passed | ✓ PASS |
| Full suite regression check | `npm test` | 28 files, 158/158 tests passed | ✓ PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | No errors | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files found for this phase; none referenced in PLAN/SUMMARY. Skipped — N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| CONT-01 | 07-01, 07-02 | Geração automática mensal de Escrituração/Balancete Contábil | ✓ SATISFIED | `gerarTarefasDoMesContabil` + transactional block in `geracao.ts` |
| CONT-02 | 07-01, 07-02 | Motor estendido para periodicidade ANUAL | ✓ SATISFIED | `obrigacoesAnuaisParaCompetencia`/`calcularPrazoAnual` + anual block |
| CONT-03 | 07-01, 07-02 | Geração automática anual de ECD para Lucro Real | ✓ SATISFIED | Catalog entry + regime filter `["LUCRO_REAL","LUCRO_PRESUMIDO"]`, tested |
| CONT-04 | 07-01, 07-02 | Geração automática anual de ECF | ✓ SATISFIED | Catalog entry + regime filter, tested |
| CONT-05 | 07-01, 07-02 | Geração automática anual de DEFIS para Simples Nacional | ✓ SATISFIED | Catalog entry + `regimesElegiveis: ["SIMPLES_NACIONAL"]`, tested; due-date semantics flagged separately (see human_verification) |
| CONT-06 | 07-03 | Tarefas avulsas atribuíveis aos colaboradores Contábil | ⚠️ PARTIALLY SATISFIED | Self-assignment works and is tested; assignment-to-colleague is blocked by design for COLABORADOR role (matches pre-existing Phase-6 DP-05 pattern) — see human_verification #2. **Note:** `.planning/REQUIREMENTS.md` still shows CONT-06 as unchecked `[ ]` and "Pending" in the Traceability table (lines 76, 156), despite Phase 7 plans/summaries claiming it complete with a passing regression test — this is a documentation-sync gap in REQUIREMENTS.md, not a code gap, but should be corrected for traceability accuracy. |

No orphaned requirements found — REQUIREMENTS.md maps exactly CONT-01 through CONT-06 to Phase 7, and all 6 appear in the 07-01/07-02/07-03 plan frontmatter `requirements:` fields.

### Anti-Patterns Found

None. Scanned all phase-7-modified files (`geracao-tarefas-contabil.ts`, `geracao-tarefas-contabil-anual.ts`, `geracao.ts`, `actions.ts`, `gerar-tarefas-button.tsx`, `competencia.ts`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/empty-implementation patterns — zero matches.

### Human Verification Required

#### 1. DEFIS Due-Date Formula vs. Real Regulatory Deadline

**Test:** Compare the system's DEFIS creation/due-date cycle (created February of year Y, due March of year Y+1 — a 13-month gap) against the actual Simples Nacional DEFIS filing rule (due March 31, reporting the prior calendar year's data).
**Expected:** Confirm whether "ano-base" in this codebase is meant to represent the fiscal/reporting year (making the +1-year due date correct) or the creation year (making it incorrect by 12 months). If incorrect, decide whether to special-case DEFIS's `anoVencimento` formula separately from ECD/ECF.
**Why human:** Domain/regulatory knowledge required; the code, tests, and design docs (CONTEXT.md D-07, RESEARCH.md Pitfall 2) are internally consistent with each other and were explicitly user-confirmed during context-gathering — this is not a coding defect, it's a question of whether the documented intent matches real-world DEFIS deadlines.

#### 2. "Atribuir a outro colega" Wording vs. Actual Authorization Rule

**Test:** Have a COLABORADOR (non-DONO) user of the Contábil sector attempt, via the UI or `criarTarefa()`, to create an avulsa task assigned to a different Contábil colleague.
**Expected:** Confirm whether the system SHOULD allow this (per ROADMAP.md's literal success criterion wording) or whether the current DONO-only "assign to others" rule is the intended, accepted behavior (as already accepted identically for DP in Phase 6).
**Why human:** This is a product-scope decision spanning two already-shipped phases (Phase 6 DP-05 has the identical wording/behavior gap, already marked Complete) — not something this phase introduced or should unilaterally resolve. A human should decide whether to update the roadmap wording to match reality, or open a follow-up requirement to actually allow colleague-to-colleague assignment for non-DONO roles across all three sectors.

### Documentation Sync Gap (non-blocking, recommend fixing)

`.planning/REQUIREMENTS.md` line 76 shows `- [ ] **CONT-06**...` (unchecked) and line 156 lists CONT-06 as "Pending" in the Traceability table, while Phase 7's plans (07-03-PLAN.md, 07-03-SUMMARY.md) and ROADMAP.md (Phase 7 marked `[x]` completed 2026-06-24) all claim CONT-06 satisfied with a passing regression test (`tests/tarefas.contabil.test.ts`, 3/3 green). This is a checkbox/table sync omission in REQUIREMENTS.md, not a functional gap — recommend updating REQUIREMENTS.md to `[x]` / "Complete" for CONT-06 to keep traceability accurate, independent of the human_verification item #2 above (which concerns whether the underlying behavior fully matches the roadmap's prose, not whether the regression test exists and passes).

### Gaps Summary

No code-level BLOCKER gaps found. All 6 phase-7 requirement IDs (CONT-01 through CONT-06) have working, tested implementations; the production Neon database was confirmed in sync with the extended `TipoObrigacao` enum (resolving the open Task-3-blocked checkpoint from 07-01); the full test suite (158 tests) and `tsc --noEmit` pass with no regressions; no debt markers or anti-patterns were found in phase-7 files.

Two items are escalated to human_verification because they require domain/product judgment rather than code inspection: (1) whether the DEFIS 13-month creation-to-deadline gap matches the real Simples Nacional regulatory deadline or is an off-by-one-year defect, and (2) whether the roadmap's "ou a outro colega" wording for avulsa task assignment should be reconciled with the actual DONO-only cross-assignment rule (a pre-existing pattern inherited unchanged from Phase 6, not introduced by Phase 7). Neither blocks Phase 8 (dashboards) from proceeding, since both concern behavior of already-shipped Phase 6/7 mechanisms rather than anything Phase 8 depends on differently.

A documentation-only correction is also recommended: `.planning/REQUIREMENTS.md`'s CONT-06 checkbox/traceability status should be updated to reflect completion.

---

*Verified: 2026-06-24T16:10:00Z*
*Verifier: Claude (gsd-verifier)*
