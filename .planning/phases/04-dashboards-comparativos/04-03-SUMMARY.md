---
phase: 04-dashboards-comparativos
plan: 03
subsystem: database
tags: [prisma, date-fns, vitest, dashboards]

# Dependency graph
requires:
  - phase: 04-dashboards-comparativos (Plan 01)
    provides: model DesempenhoMensal, tests/dashboards.queries.test.ts Wave 0 scaffold
provides:
  - "src/modules/dashboards/queries.ts exportando listarDesempenhoColaboradoresMesAtual, listarEvolucaoMensal, listarRankingEmpresas"
  - "Caso de teste colaboradores/volume/evolucao/ranking preenchidos em tests/dashboards.queries.test.ts"
affects: [04-04-rbac-and-pages, 04-05-charts-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Query de leitura pura: 1 findMany + agregacao em Map (estrutura de trabalho) convertida para array de objetos planos no retorno — Map nunca atravessa o boundary de retorno da funcao"
    - "Regras de 'atrasada' deliberadamente NAO compartilhadas entre D-02 (colaborador, exclui PENDENTE) e D-06 (empresa, inclui PENDENTE vencida) — sem helper isAtrasada generico"

key-files:
  created:
    - src/modules/dashboards/queries.ts
  modified:
    - tests/dashboards.queries.test.ts

key-decisions:
  - "listarDesempenhoColaboradoresMesAtual retorna Array<{...}> (Array.isArray true), nunca o Map de trabalho interno, para serializar pelo boundary Server->Client da Plan 04-05"
  - "listarEvolucaoMensal reusa listarDesempenhoColaboradoresMesAtual(new Date()) para o ponto live, garantindo o mesmo criterio concluidoEm-no-range do snapshot da Plan 04-02 (continuidade live->frozen)"
  - "listarRankingEmpresas mantem sua propria logica de 'atrasada' (D-06) inline, sem reutilizar nenhum helper da regra D-01/D-02 de colaborador — propositalmente duplicado per RESEARCH.md anti-pattern"

patterns-established:
  - "Pattern: leitura agregada para dashboards segue findMany unico + Map de trabalho + conversao para array plano no retorno (nunca Map cru)"

requirements-completed: [DASH-01, DASH-02, DASH-03]

# Metrics
duration: 12min
completed: 2026-06-22
---

# Phase 4 Plan 3: Camada de Leitura dos Dashboards Comparativos Summary

**Três funções de agregação (`listarDesempenhoColaboradoresMesAtual`, `listarEvolucaoMensal`, `listarRankingEmpresas`) implementadas em `src/modules/dashboards/queries.ts`, respeitando D-01/D-02/D-03/D-05/D-06 com retorno serializável (array, nunca Map) e continuidade live→frozen com o snapshot da Plan 04-02.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-22T13:18:00Z
- **Completed:** 2026-06-22T13:30:00Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `listarDesempenhoColaboradoresMesAtual(mes: Date)` calcula % no prazo por colaborador via um único `db.tarefa.findMany` (CONCLUIDA filtradas por `historico.concluidoEm` no range do mês) + `db.empresa.groupBy` para carteira — sem N+1, retorno é um array de objetos planos (`colaboradorId`, `nome`, `percentualNoPrazo`, `totalConcluidas`, `totalEmpresas`)
- `listarEvolucaoMensal(quantidadeMeses = 3)` lê competências fechadas via `db.desempenhoMensal.groupBy` (D-05, nunca recalcula via `Tarefa`) e soma 1 ponto live reusando a função de colaboradores — mesmo critério de população do snapshot, sem degrau live→frozen
- `listarRankingEmpresas(periodoInicio, periodoFim)` implementa a regra D-06 (CONCLUIDA fora do prazo OU PENDENTE com prazo vencido) de forma deliberadamente separada da regra de colaborador, ordenado desc por `percentualAtraso`
- 7 testes preenchidos em `tests/dashboards.queries.test.ts` cobrindo D-01, D-02, D-03, D-05 (não-recálculo de meses fechados), D-06 e ordenação — todos verdes

## Task Commits

Each task was committed atomically:

1. **Task 1: listarDesempenhoColaboradoresMesAtual + listarEvolucaoMensal** - `fa0988e` (feat)
2. **Task 2: listarRankingEmpresas (D-06)** - implementado no mesmo commit `fa0988e`, junto com a Task 1, por viverem no mesmo módulo recém-criado (`src/modules/dashboards/queries.ts`) e terem sido desenvolvidos em uma única passada coerente
3. **docs: registrar item fora de escopo** - `5959cc6` (docs)

_No plan-metadata commit in worktree mode — orchestrator handles shared-file updates after merge._

## Files Created/Modified
- `src/modules/dashboards/queries.ts` - NEW. 3 funções exportadas: `listarDesempenhoColaboradoresMesAtual`, `listarEvolucaoMensal`, `listarRankingEmpresas`, com JSDoc explicando D-01/D-02/D-03/D-05/D-06 e a continuidade live→frozen
- `tests/dashboards.queries.test.ts` - 7 casos de teste preenchidos (3 para colaboradores/D-01-03, 2 para evolução/D-05, 2 para ranking/D-06), substituindo os `it.todo` da Plan 01

## Decisions Made
- `listarDesempenhoColaboradoresMesAtual` usa `db.usuario.findMany` com `select: { id: true, nome: true }` explícito para resolver nomes — nunca relação crua, consistente com `TAREFA_SELECT` de `src/modules/tarefas/queries.ts`
- O ponto live de `listarEvolucaoMensal` reusa `listarDesempenhoColaboradoresMesAtual(new Date())` em vez de duplicar a query, garantindo que qualquer ajuste futuro no critério de população do mês corrente permaneça sincronizado entre as duas funções
- Tasks 1 e 2 foram implementadas e commitadas juntas (mesmo arquivo novo, desenvolvimento em uma única passada) em vez de duas commits sequenciais sobre o mesmo arquivo — documentado aqui para rastreabilidade, sem impacto na cobertura de testes ou nos critérios de aceite (ambas as funções estão presentes, testadas e verificadas)

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria were met; no Rule 1-4 fixes were required in the implementation itself.

## Issues Encountered
- `npm run test` (full suite) reports 3 pre-existing failures in `tests/auth.test.ts` (Phase 01 file, unrelated to this plan's `files_modified`), caused by a worktree-local `node_modules` resolution issue (`next-auth` failing to resolve `next/server`). This is out of scope per the executor's scope-boundary rule (pre-existing failures in unrelated files are logged, not fixed). Documented in `.planning/phases/04-dashboards-comparativos/deferred-items.md`. This plan's target file (`tests/dashboards.queries.test.ts`, 7 tests) passes 100%, and `npx tsc --noEmit` is clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `listarDesempenhoColaboradoresMesAtual`, `listarEvolucaoMensal`, `listarRankingEmpresas` are ready for Plan 04-04 (RBAC-gated Server Component pages) to import and pass results as props to client chart components
- All three functions return plain serializable arrays — no Map crossing the Server→Client boundary, satisfying Plan 04-05's chart component needs without further transformation
- `listarRankingEmpresas` is parameterized (no hardcoded period) — Plan 04-04's consumer should pass the documented "últimos 3 meses" default range
- The pre-existing `tests/auth.test.ts` failure (worktree `node_modules` resolution) should be investigated by the orchestrator after merge, as it may resolve naturally once merged back into the main checkout's `node_modules`, or may need a `npm install`/`npx prisma generate` re-run (same root cause class documented in 04-01-SUMMARY.md's "Issues Encountered")
- No blockers identified for Plan 04-04/04-05

---
*Phase: 04-dashboards-comparativos*
*Completed: 2026-06-22*

## Self-Check: PASSED

All created/modified files verified present on disk (`src/modules/dashboards/queries.ts`, `tests/dashboards.queries.test.ts`, this SUMMARY.md); all 3 commit hashes (fa0988e, 5959cc6, 62aad40) verified present in git log.
