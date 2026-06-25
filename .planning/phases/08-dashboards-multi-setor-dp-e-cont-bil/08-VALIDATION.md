---
phase: 8
slug: dashboards-multi-setor-dp-e-cont-bil
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-25
validated: 2026-06-25
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.8 |
| **Config file** | `vitest.config.ts` (existing — no `@vitejs/plugin-react`; preserve the `guard.ts`/`page.tsx` split pattern for new sector-aware tests) |
| **Quick run command** | `npx vitest run tests/dashboards.queries.test.ts tests/dashboards.rbac.test.ts tests/dashboards.snapshot.test.ts tests/tipo-obrigacao-setor.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/dashboards.queries.test.ts tests/dashboards.rbac.test.ts tests/dashboards.snapshot.test.ts tests/tipo-obrigacao-setor.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01 T2 | 08-01 | 0 | DP-06/07/08, CONT-07/08/09 | T-4-01 (reused) | `DesempenhoMensal` gets `setor` column + backfill to `"FISCAL"`, unique constraint becomes `[competencia, colaboradorId, setor]` | unit | `scripts/backfill-desempenho-setor.mjs` (row-count assertion, pre=0/post=0 verified) | ✅ Wave 0 | ✅ green |
| 08-01 T1 | 08-01 | 0 | DP-06/07/08, CONT-07/08/09 | — | `TIPOS_OBRIGACAO_POR_SETOR` covers every `TipoObrigacao` enum value exactly once; `tarefaSetorWhere(setor)` shape correct | unit | `npx vitest run tests/tipo-obrigacao-setor.test.ts` | ✅ Wave 0 — new file (4 tests) | ✅ green |
| 08-02 T1 | 08-02 | 1 | DP-06, CONT-07 | T-4-01 | `listarDesempenhoColaboradoresMesAtual(mes, setor, opts)` returns only that sector's data | unit | `npx vitest run tests/dashboards.queries.test.ts` (lines 152, 191) | ✅ extended | ✅ green |
| 08-02 T1 | 08-02 | 1 | DP-07, CONT-08 | T-08-03 | `listarEvolucaoMensal(n, setor)` reads sector-scoped `DesempenhoMensal` rows for closed months, stable (no retroactive recalc); live-point `calcularCategoriasCriadas` also sector-scoped | unit | `npx vitest run tests/dashboards.queries.test.ts` (lines 227, 302) | ✅ extended | ✅ green |
| 08-02 T1 | 08-02 | 1 | DP-08, CONT-09 | — | `listarRankingEmpresas(inicio, fim, setor, opts)` ranks only that sector's empresas | unit | `npx vitest run tests/dashboards.queries.test.ts` (line 468) | ✅ extended | ✅ green |
| 08-03 T1 | 08-03 | 1 | All 6 | T-4-01 | DONO-only guard (`notFound()` pre-query gate) unchanged for all 3 sector pages | regression | `npx vitest run tests/dashboards.rbac.test.ts` | ✅ exists — stayed green | ✅ green |
| 08-02/03 | 08-02, 08-03 | 2 | All 6 | — | Fiscal dashboards unchanged in behavior/output after parametrization | regression | `npx vitest run` (full suite: 29 files / 171 tests) | ✅ exists — stayed green | ✅ green |
| 08-03 T2 | 08-03 | 2 | Success Criteria #5 | — | `src/modules/dashboard/queries.ts` (singular, orphan, references non-existent `db.desempenhoMensalSnapshot`) deleted; zero remaining imports | source | `grep -rn "modules/dashboard[\"'/]" src/` returns empty | ✅ confirmed absent | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Re-run at audit time (2026-06-25): `npx vitest run` → 29 files passed, 171 tests passed, 9.35s.

---

## Wave 0 Requirements

- [x] Prisma migration: add `setor: Setor` to `DesempenhoMensal`, change unique constraint to `[competencia, colaboradorId, setor]`, backfill existing rows to `"FISCAL"` — verified backfilled row count (0) matches pre-migration row count (0) exactly via `scripts/backfill-desempenho-setor.mjs`
- [x] `tests/tipo-obrigacao-setor.test.ts` — new file, covers `TIPOS_OBRIGACAO_POR_SETOR` completeness and `tarefaSetorWhere` shape (4 tests, green)
- [x] Extend `tests/dashboards.snapshot.test.ts` to cover the post-migration `setor`-aware `calcularSnapshotMensal` signature (sector derivation, null-setor defensive skip, cross-sector colaborador, explicit-select leak guard — all green)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| DP and Contábil dashboard pages render correctly per UI-SPEC (tabs, charts, tables, empty states) | DP-06/07/08, CONT-07/08/09 | Visual layout/UX fidelity to UI-SPEC.md not verifiable by automated assertions alone | Log in as DONO, navigate to `/dashboards`, confirm 3 tabs (Fiscal/DP/Contábil) each render 3 chart/table sections matching UI-SPEC.md, confirm sector-aware empty states | ✅ done — dono ran `npm run dev`, approved directly in conversation (08-03 Task 3 checkpoint, 2026-06-25) |

---

## Validation Audit 2026-06-25

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 8 rows in the Per-Task Verification Map were already backed by real, passing automated tests at audit time (the map had simply never been updated from its pre-execution draft). Full suite re-run: `npx vitest run` → 29 files passed, 171 tests passed. Orphan-module grep re-confirmed empty. No subagent spawn was needed since there were no gaps to fill.

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-25
