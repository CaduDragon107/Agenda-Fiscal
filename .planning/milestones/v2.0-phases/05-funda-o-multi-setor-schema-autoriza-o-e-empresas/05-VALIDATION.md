---
phase: 5
slug: funda-o-multi-setor-schema-autoriza-o-e-empresas
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-23
audited: 2026-06-24
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/visibility-scope.test.ts tests/visibility-scope.setor.test.ts tests/empresas.idor.test.ts` |
| **Full suite command** | `npm test` (= `vitest run`) |
| **Estimated runtime** | ~20 seconds (full suite, 20 existing files + new additions) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/visibility-scope.test.ts tests/visibility-scope.setor.test.ts tests/empresas.idor.test.ts`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green, PLUS the backfill script's count-assertion exit code `0` against the actual target database
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

*Updated 2026-06-24 after retroactive audit — all 4 plans (05-01..05-04) executed and merged. Status reflects current code/test state, not the pre-execution forecast below the table header.*

| Req ID | Behavior | Test Type | Automated Command | Status |
|--------|----------|-----------|-------------------|-------------|
| SETOR-01 | Backfill produces exactly 197 FISCAL junction rows matching old `responsavelId` | integration (script-level assertion) | `node --env-file=.env scripts/backfill-responsavel-setor.mjs --apply` | ✅ COVERED (05-01, exit 0 against live Neon, see 05-01-SUMMARY.md) |
| SETOR-01 | Existing IDOR/visibility suite passes UNMODIFIED after scope change | unit/integration (regression gate) | `npx vitest run tests/visibility-scope.test.ts tests/empresas.idor.test.ts tests/tarefas.idor.test.ts tests/empresas.queries.test.ts` | ✅ COVERED (green, zero edits to these files) |
| SETOR-02 | `Usuario.setor` correctly flows into session/JWT | unit | `tests/auth.setor.test.ts` | ✅ COVERED (3/3 passing) |
| SETOR-02 | 7 placeholder users created with correct setor + login works | integration (seed verification) | `prisma/seed.ts` run via `npx prisma db seed`; live confirmation in 05-01-SUMMARY.md (human-authored commit `b30d64f`) | ✅ COVERED |
| SETOR-03 | `listarResponsaveis(setor)` filters correctly | unit | `tests/empresas.queries.test.ts` | ✅ COVERED |
| EMPR-03 | `temFuncionariosClt` defaults false, editable via form | unit + integration | `tests/empresas.crud.test.ts` | ✅ COVERED |
| (D-02) | Non-DONO cannot change responsável fields via direct Server Action call | unit (IDOR-style) | `tests/empresas.idor.test.ts` | ✅ COVERED |
| (D-10) | Cross-sector responsável data omitted at the data layer for non-DONO viewers | unit (anti-leak regression) | `tests/empresas.derive-rows.test.ts` (incl. `JSON.stringify` scan) | ✅ COVERED — upgraded from the manual-only forecast below; 05-04 delivered an automated regression test, with the human checkpoint as confirmation rather than the only safeguard |
| (D-09) | Sector-filtered empty state copy for DP/Contábil colaboradores with no empresas assigned | manual | manual UAT — no RTL/component test infra in this project | ✅ Manual-only, confirmed via approved 05-04 checkpoint (see Manual-Only Verifications below) |

**Audit result (2026-06-24):** 8/9 rows automated and green (`npx vitest run` confirms 42/42 across the 8 relevant test files); 1/9 (D-09) is a legitimate, accepted manual-only item — same disposition the original forecast below anticipated. No gaps found.

---

## Wave 0 Requirements

- [ ] `scripts/backfill-responsavel-setor.mjs` — count-assertion script: 197 `Empresa.responsavelId` → 197 `EmpresaResponsavelSetor` FISCAL rows
- [ ] `tests/visibility-scope.setor.test.ts` — multi-sector RBAC fixtures (Pitfall B3 regression-gate companion: 3 setores x multiple colaboradores x shared empresas)
- [ ] Extension to `tests/empresas.idor.test.ts` — DONO-only responsável-field-change guard (D-02)
- [ ] Extension to `tests/empresas.queries.test.ts` — `listarResponsaveis(setor)` filter test
- [ ] Extension to `tests/empresas.crud.test.ts` — `temFuncionariosClt` default + edit test
- [ ] `tests/auth.setor.test.ts` — JWT/session callback propagates `setor`
- Framework install: none — Vitest already configured and used by all 20 existing test files

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sector-filtered empty state message for DP/Contábil colaboradores with no empresas assigned | D-09 | No React Testing Library / component test infra exists in this project's test suite (Vitest covers server-side/unit only) | Log in as a DP placeholder user (DP1) before any DP responsável assignment exists; confirm the empresas list shows the explanatory empty-state copy instead of the generic empty state |
| Column visibility filtered by logged-in user's setor (DP sees only "Responsável DP" column, not Fiscal/Contábil) | D-10 | *(superseded — see Per-Task Verification Map: this moved to automated coverage via `tests/empresas.derive-rows.test.ts`'s `JSON.stringify` anti-leak scan; the manual checkpoint below confirmed the visual/RBAC behavior, not the only safeguard)* | Confirmed in approved 05-04 checkpoint (DONO/DP1/Caio walkthrough incl. RSC payload view-source check) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (retroactive audit, 2026-06-24)

---

## Validation Audit 2026-06-24

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 4 plans (05-01 through 05-04) had already shipped their declared Wave 0 tests by execution time. This audit re-ran all 8 relevant test files (42/42 passing) and confirmed the Per-Task Verification Map against current code, finding zero gaps — `gsd-nyquist-auditor` was not spawned since no gap-filling work was needed.
