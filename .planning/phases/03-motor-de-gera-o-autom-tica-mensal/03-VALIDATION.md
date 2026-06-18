---
phase: 3
slug: motor-de-gera-o-autom-tica-mensal
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.8 (already configured, `vitest.config.ts` at repo root) |
| **Config file** | `vitest.config.ts` (existing — no changes needed; `include: ["tests/**/*.test.ts"]` already covers new test files) |
| **Quick run command** | `npx vitest run tests/geracao-tarefas.test.ts tests/dia-util.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/geracao-tarefas.test.ts tests/dia-util.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | TASK-02 | — | Due date on a known weekend day is anticipated to the preceding Friday | unit | `npx vitest run tests/dia-util.test.ts -t "fim de semana"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | TASK-02 | — | Due date on a known 2026 national holiday is anticipated to the preceding business day | unit | `npx vitest run tests/dia-util.test.ts -t "feriado"` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 0 | TASK-02 | — | `diaBase=31` in a 28/29-day February resolves to the last day of that month (D-04) | unit | `npx vitest run tests/geracao-tarefas.test.ts -t "ultimo dia"` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | TASK-01 | — | `gerarTarefasDoMes` produces correct obligation set per regime (LUCRO_REAL=4, LUCRO_PRESUMIDO=2, SIMPLES_NACIONAL=1) | unit | `npx vitest run tests/geracao-tarefas.test.ts -t "catalogo"` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | TASK-01 | — | `executarGeracaoMensal` run twice for same competência produces 0 new rows on 2nd run (idempotency, D-10) | integration | `npx vitest run tests/geracao.idempotencia.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | TASK-01 | — | Execution summary returns correct `criadas`/`puladas` counts (D-11) | integration | `npx vitest run tests/geracao.idempotencia.test.ts -t "resumo"` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | TASK-01 | T-3-01 | Manual Server Action rejects non-DONO callers (D-08 RBAC) | integration | `npx vitest run tests/geracao.actions.test.ts -t "RBAC"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/dia-util.test.ts` — covers TASK-02 (holiday + weekend anticipation, including the `isHoliday() === false` truthiness assertion from Pitfall 1, and a concrete known-2026-holiday assertion)
- [ ] `tests/geracao-tarefas.test.ts` — covers TASK-01 (catalog correctness per regime, D-04 last-day-of-month handling, generated `titulo` shape)
- [ ] `tests/geracao.idempotencia.test.ts` — covers D-10/D-11 (double-run idempotency, summary counts) — needs a real or test-Postgres `db` instance since it exercises `createMany` against the actual unique constraint, consistent with `tests/tarefas.crud.test.ts`
- [ ] `tests/geracao.actions.test.ts` — covers D-08 RBAC guard on the manual-trigger Server Action, following the same `auth()` mock pattern used in `tests/tarefas.idor.test.ts`
- [ ] No new framework install needed — Vitest is already configured and used by 13 existing test files in `tests/`

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-18 (gsd-plan-checker, all Nyquist checks 8a-8d satisfied across 03-01/02/03 plans)
