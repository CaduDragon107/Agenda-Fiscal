---
phase: 5
slug: funda-o-multi-setor-schema-autoriza-o-e-empresas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
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

*Task IDs are not yet assigned — plans for this phase have not been created. This table is populated once PLAN.md files exist and tasks are mapped to the requirement rows below. See "Phase Requirements → Test Map" in `05-RESEARCH.md` (## Validation Architecture) for the requirement-level detail this map will be derived from:*

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETOR-01 | Backfill produces exactly 197 FISCAL junction rows matching old `responsavelId` | integration (script-level assertion) | `node --env-file=.env scripts/backfill-responsavel-setor.mjs --apply` | ❌ Wave 0 |
| SETOR-01 | Existing IDOR/visibility suite passes UNMODIFIED after scope change | unit/integration (regression gate) | `npx vitest run tests/visibility-scope.test.ts tests/empresas.idor.test.ts tests/tarefas.idor.test.ts tests/empresas.queries.test.ts` | ✅ (must stay green, zero edits) |
| SETOR-02 | `Usuario.setor` correctly flows into session/JWT | unit | new `tests/auth.setor.test.ts` | ❌ Wave 0 |
| SETOR-02 | 7 placeholder users created with correct setor + login works | integration (seed verification) | seed-verification script/test | ❌ Wave 0 |
| SETOR-03 | `listarResponsaveis(setor)` filters correctly | unit | extension to `tests/empresas.queries.test.ts` | ❌ Wave 0 |
| EMPR-03 | `temFuncionariosClt` defaults false, editable via form | unit + integration | extension to `tests/empresas.crud.test.ts` | ❌ Wave 0 |
| (D-02) | Non-DONO cannot change responsável fields via direct Server Action call | unit (IDOR-style) | extension to `tests/empresas.idor.test.ts` | ❌ Wave 0 |
| (D-09/D-10) | Sector-filtered empty state + column visibility | manual | manual UAT — no RTL/component test infra in this project | n/a — manual-only |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — to be tracked per-task once plans assign Task IDs.*

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
| Column visibility filtered by logged-in user's setor (DP sees only "Responsável DP" column, not Fiscal/Contábil) | D-10 | Same — no component test infra | Log in as DP1, Contabil1, and DONO; confirm DP/Contábil colaboradores see only their own sector's responsável column while DONO sees all 3 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
