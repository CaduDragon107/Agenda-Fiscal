---
phase: 8
slug: dashboards-multi-setor-dp-e-cont-bil
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-25
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
| 08-XX | TBD | 0 | DP-06/07/08, CONT-07/08/09 | T-4-01 (reused) | `DesempenhoMensal` gets `setor` column + backfill to `"FISCAL"`, unique constraint becomes `[competencia, colaboradorId, setor]` | unit | row-count assertion script (pre/post migration) | ❌ Wave 0 | ⬜ pending |
| 08-XX | TBD | 0 | DP-06/07/08, CONT-07/08/09 | — | `TIPOS_OBRIGACAO_POR_SETOR` covers every `TipoObrigacao` enum value exactly once; `tarefaSetorWhere(setor)` shape correct | unit | `npx vitest run tests/tipo-obrigacao-setor.test.ts` | ❌ Wave 0 — new file | ⬜ pending |
| 08-XX | TBD | 1 | DP-06, CONT-07 | T-4-01 | `listarDesempenhoColaboradoresMesAtual(mes, setor, opts)` returns only that sector's data | unit | `npx vitest run tests/dashboards.queries.test.ts -t "DP\|CONTABIL"` | ❌ extend existing | ⬜ pending |
| 08-XX | TBD | 1 | DP-07, CONT-08 | — | `listarEvolucaoMensal(n, setor)` reads sector-scoped `DesempenhoMensal` rows for closed months, stable (no retroactive recalc) | unit | `npx vitest run tests/dashboards.queries.test.ts -t "evolucao"` | ❌ extend existing | ⬜ pending |
| 08-XX | TBD | 1 | DP-08, CONT-09 | — | `listarRankingEmpresas(inicio, fim, setor, opts)` ranks only that sector's empresas | unit | `npx vitest run tests/dashboards.queries.test.ts -t "ranking"` | ❌ extend existing | ⬜ pending |
| 08-XX | TBD | 1 | All 6 | T-4-01 | DONO-only guard (`notFound()` pre-query gate) unchanged for all 3 sector pages | regression | `npx vitest run tests/dashboards.rbac.test.ts` | ✅ exists — must stay green | ⬜ pending |
| 08-XX | TBD | 2 | All 6 | — | Fiscal dashboards unchanged in behavior/output after parametrization | regression | `npx vitest run tests/dashboards.queries.test.ts tests/dashboards.rbac.test.ts` | ✅ exists — must stay green | ⬜ pending |
| 08-XX | TBD | 2 | Success Criteria #5 | — | `src/modules/dashboard/queries.ts` (singular, orphan, references non-existent `db.desempenhoMensalSnapshot`) deleted; zero remaining imports | source | `grep -r "modules/dashboard/queries" src/` returns empty | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Prisma migration: add `setor: Setor` to `DesempenhoMensal`, change unique constraint to `[competencia, colaboradorId, setor]`, backfill existing rows to `"FISCAL"` — verify backfilled row count matches pre-migration row count exactly
- [ ] `tests/tipo-obrigacao-setor.test.ts` — new file, covers `TIPOS_OBRIGACAO_POR_SETOR` completeness and `tarefaSetorWhere` shape
- [ ] Extend `tests/dashboards.snapshot.test.ts` to cover the post-migration `setor`-aware `calcularSnapshotMensal` signature

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DP and Contábil dashboard pages render correctly per UI-SPEC (tabs, charts, tables, empty states) | DP-06/07/08, CONT-07/08/09 | Visual layout/UX fidelity to UI-SPEC.md not verifiable by automated assertions alone | Log in as DONO, navigate to `/dashboards/dp` and `/dashboards/contabil`, confirm 3 chart/table sections per page match UI-SPEC.md, confirm non-DONO users get 404 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
