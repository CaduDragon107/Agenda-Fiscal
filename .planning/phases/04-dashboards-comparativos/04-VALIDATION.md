---
phase: 4
slug: dashboards-comparativos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.8 (existing, `vitest.config.ts` at repo root) |
| **Config file** | `vitest.config.ts` — aliases `@/` to `src/`, inlines `next-auth`/`@auth/core` for ESM resolution — no changes needed |
| **Quick run command** | `npx vitest run tests/dashboards.queries.test.ts tests/dashboards.snapshot.test.ts tests/dashboards.rbac.test.ts` |
| **Full suite command** | `npm run test` (= `vitest run`, 76+ tests across 17 files per Phase 3 summary) |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/dashboards.*.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green, plus the manual visual checkpoint (chart rendering cannot be asserted by Vitest alone)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | DASH-01 | — | % no prazo respects D-01 (`concluidoEm <= prazo`) and D-02 (excludes PENDENTE from denominator) | unit | `npx vitest run tests/dashboards.queries.test.ts -t "colaboradores"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | DASH-01 | — | Absolute volume context (D-03) returned alongside percentage | unit | `npx vitest run tests/dashboards.queries.test.ts -t "volume"` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 0 | DASH-02 | — | Closed-month snapshot never recalculated on read (D-05) — `db.tarefa.findMany` NOT called for closed competências | unit | `npx vitest run tests/dashboards.snapshot.test.ts -t "frozen"` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 0 | DASH-02 | — | Snapshot write is idempotent (`createMany` + `skipDuplicates` against `@@unique`) | unit | `npx vitest run tests/dashboards.snapshot.test.ts -t "idempot"` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 0 | DASH-02 | — | Snapshot closes the correct prior month relative to the competência passed to `executarGeracaoMensal` (boundary/off-by-one) | unit | `npx vitest run tests/dashboards.snapshot.test.ts -t "boundary"` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 1 | DASH-03 | — | "Atrasada" includes PENDENTE with `prazo < now()` (D-06), distinct from D-02's rule | unit | `npx vitest run tests/dashboards.queries.test.ts -t "ranking"` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 1 | DASH-03 | — | Ranking sorted descending by % atraso | unit | `npx vitest run tests/dashboards.queries.test.ts -t "ranking"` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 1 | DASH-01/02/03 | T-4-01 | DONO-only access — COLABORADOR and unauthenticated rejected before any DB query | unit | `npx vitest run tests/dashboards.rbac.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-02 | 04 | 2 | DASH-01/02/03 | — | Manual checkpoint: dashboards render correct charts for DONO; hidden/blocked for COLABORADOR | manual | `npm run dev` + human verification | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/dashboards.queries.test.ts` — covers DASH-01, DASH-03 calculation rules
- [ ] `tests/dashboards.snapshot.test.ts` — covers DASH-02 freeze/idempotency/boundary rules
- [ ] `tests/dashboards.rbac.test.ts` — covers DONO-only guard for all 3 dashboard queries/page
- [ ] Prisma migration for `DesempenhoMensal` — run `npx prisma db push` (no shadow database, per STATE.md Phase 2 precedent)
- [ ] `npx shadcn@latest add chart` — installs `recharts` + `src/components/ui/chart.tsx` before any chart component can be written

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Chart rendering correctness (Area/Bar/Line via shadcn `chart` component) | DASH-01, DASH-02, DASH-03 | DOM/canvas chart rendering cannot be meaningfully asserted by Vitest; requires visual inspection of axes, tooltips, and data shape | Run `npm run dev`, log in as DONO, open each of the 3 dashboards, confirm charts render with correct data and that a COLABORADOR session is redirected/blocked from the same routes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
