---
phase: 08-dashboards-multi-setor-dp-e-cont-bil
plan: 01
subsystem: database
tags: [prisma, postgres, neon, multi-tenancy]

requires: []
provides:
  - "tarefaSetorWhere(setor) helper — single source of truth for classifying any Tarefa row by sector"
  - "TIPOS_OBRIGACAO_POR_SETOR map — disjoint mapping of all 20 TipoObrigacao values to FISCAL/DP/CONTABIL"
  - "DesempenhoMensal.setor column + unique constraint [competencia, colaboradorId, setor]"
affects: ["08-02", "08-03"]

tech-stack:
  added: []
  patterns:
    - "Sector classification via tarefaSetorWhere(setor): recurring tasks classified by tipoObrigacao, ad-hoc tasks (tipoObrigacao=null) classified by responsavel.setor"

key-files:
  created:
    - src/lib/tipo-obrigacao-setor.ts
    - tests/tipo-obrigacao-setor.test.ts
    - scripts/backfill-desempenho-setor.mjs
  modified:
    - prisma/schema.prisma

key-decisions:
  - "Pre-migration row count of desempenho_mensal verified at 0 before running db push --accept-data-loss — no real data was at risk despite Prisma's generic data-loss warning for the new unique constraint"
  - "setor Setor @default(FISCAL) added so db push auto-populates any future rows; backfill-desempenho-setor.mjs still runs the explicit UPDATE + count verification as the canonical check (mirrors Phase 5's '197 FISCAL rows' pattern), not the @default alone"

patterns-established:
  - "Enum completeness test: every TipoObrigacao value must appear in exactly one setor bucket of TIPOS_OBRIGACAO_POR_SETOR — breaks immediately if the enum changes without updating the map"

requirements-completed: [DP-06, DP-07, DP-08, CONT-07, CONT-08, CONT-09]

duration: ~25min
completed: 2026-06-25
---

# Phase 08 Plan 01: Sector classification helper + DesempenhoMensal schema migration Summary

**`tarefaSetorWhere(setor)` classification helper plus a verified, zero-data-loss migration adding the `setor` dimension to `DesempenhoMensal`**

## Performance

- **Duration:** ~25 min (Task 1 by background executor agent; Task 2 by orchestrator after human-action checkpoint confirmation)
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- `tarefaSetorWhere(setor)` and `TIPOS_OBRIGACAO_POR_SETOR` give the codebase a single source of truth for classifying any `Tarefa` row by sector (FISCAL/DP/CONTABIL), with a completeness test guarding against enum drift.
- `DesempenhoMensal` now carries a `setor` dimension with `@@unique([competencia, colaboradorId, setor])`, unblocking Plan 08-02's per-sector closed-month snapshot isolation (D-05).
- Migration verified safe: pre-migration row count was 0, so `--accept-data-loss` carried no actual data-loss risk; `backfill-desempenho-setor.mjs` confirms post-backfill `setor='FISCAL'` count matches pre-migration count exactly (0 === 0).

## Task Commits

1. **Task 1: Criar helper de classificação por setor + teste de completude do enum** - `6693495` (feat)
2. **Task 2: [BLOCKING] Migrar DesempenhoMensal com coluna setor + db push + backfill verificado** - `1177c3a` (feat)

## Files Created/Modified
- `src/lib/tipo-obrigacao-setor.ts` - `TIPOS_OBRIGACAO_POR_SETOR` map + `tarefaSetorWhere(setor)` helper
- `tests/tipo-obrigacao-setor.test.ts` - DP classification case + enum-completeness test (4 tests, all green)
- `prisma/schema.prisma` - `DesempenhoMensal.setor Setor @default(FISCAL)` + updated unique constraint
- `scripts/backfill-desempenho-setor.mjs` - Verifies backfilled `setor='FISCAL'` count against pre-migration count, non-zero exit on mismatch

## Decisions Made
- Task 2 is a `checkpoint:human-action gate="blocking"` task per the plan (touches production Neon DB). The background executor agent correctly refused a relayed/coordinator-claimed "user approval" for this exact reason — it could not verify the claim came from the real user. The orchestrator then executed Task 2 directly (not via subagent) after the user confirmed directly in conversation, since the orchestrator has direct conversational authority the subagent cannot independently verify.
- Verified the actual pre-migration row count (0) before treating `--accept-data-loss` as safe, rather than assuming the warning was boilerplate.

## Deviations from Plan
None - plan executed exactly as written. Task 2 was executed by the orchestrator directly rather than by a continuation subagent, due to the trust-boundary issue above; this is a process deviation, not a deviation in the technical work delivered.

## Issues Encountered
- Background executor agent (correctly) declined to act on a coordinator-relayed claim of user consent for the production-DB checkpoint. Resolved by having the orchestrator perform Task 2 directly after the user's own, directly-observed confirmation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 08-02 (queries.ts/snapshot.ts parametrization by setor) can now read/write `DesempenhoMensal.setor` and use `tarefaSetorWhere`.
- `desempenho_mensal` table remains empty in production (0 rows) — this is pre-existing state, not introduced by this plan; first real snapshot rows will be written when `calcularSnapshotMensal` (Plan 08-02) runs for a closed month.

---
*Phase: 08-dashboards-multi-setor-dp-e-cont-bil*
*Completed: 2026-06-25*
