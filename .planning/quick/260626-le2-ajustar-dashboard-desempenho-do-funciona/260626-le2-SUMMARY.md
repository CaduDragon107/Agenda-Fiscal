---
phase: quick-260626-le2
plan: 01
subsystem: dashboards
tags: [prisma, groupBy, multi-setor, dashboards, vitest, tdd]

# Dependency graph
requires:
  - phase: 05-autorizacao-setor-aware
    provides: "EmpresaResponsavelSetor junction table + withVisibilityScope/withTarefaScope setor-aware"
  - phase: 08-dashboards-multi-setor
    provides: "listarDesempenhoColaboradoresMesAtual e calcularSnapshotMensal parametrizados por setor"
provides:
  - "listarDesempenhoColaboradoresMesAtual deriva carteira (totalEmpresas) e lista de colaboradores via EmpresaResponsavelSetor para DP/CONTABIL, nunca via Empresa.responsavelId legado"
  - "calcularSnapshotMensal aplica o mesmo critério no snapshot congelado mensal, sem degrau live->frozen"
affects: [dashboards, snapshot-mensal, geracao-mensal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Branch condicional setor===FISCAL vs DP/CONTABIL para escolher a fonte de carteira (Empresa.responsavelId vs EmpresaResponsavelSetor.groupBy), normalizando o resultado para o mesmo shape { responsavelId, _count } usado pelo restante da função"

key-files:
  created: []
  modified:
    - src/modules/dashboards/queries.ts
    - src/modules/dashboards/snapshot.ts
    - tests/dashboards.queries.test.ts
    - tests/dashboards.snapshot.test.ts

key-decisions:
  - "FISCAL mantém Empresa.responsavelId (forma legada, equivalência 197/197 já verificada por backfill); DP/CONTABIL passam a usar exclusivamente EmpresaResponsavelSetor.groupBy filtrado por setor"
  - "Normalização do resultado do groupBy novo (usuarioId -> responsavelId) feita no ponto de origem, para que o código de agregação subsequente (carteiraPorColaborador / totalEmpresasPorColaboradorSetor) não precise de nenhuma outra alteração"

patterns-established:
  - "Toda query de carteira por setor em dashboards deve seguir o branch FISCAL-legado vs DP/CONTABIL-junction-table, espelhando o padrão já usado em geracao.ts (responsaveisPorSetor: { where: { setor } })"

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-06-26
---

# Quick Task 260626-le2: Corrigir vazamento de carteira/colaboradores entre setores no dashboard de desempenho

**Dashboards de DP e CONTABIL agora derivam carteira e colaboradores via `EmpresaResponsavelSetor.groupBy` (filtrado por setor) em vez da coluna legada `Empresa.responsavelId`, que é exclusiva do setor FISCAL — eliminando o vazamento de colaboradores/contagens entre setores no card "Desempenho por colaborador" (ponto live e snapshot congelado).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-26T18:29:36Z
- **Completed:** 2026-06-26T18:33:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `listarDesempenhoColaboradoresMesAtual` (ponto live) corrigida: DP/CONTABIL usam `db.empresaResponsavelSetor.groupBy({ by: ["usuarioId"], where: { setor, empresa: {...} } })`; FISCAL inalterado
- `calcularSnapshotMensal` (snapshot congelado mensal) recebeu a mesma correção, preservando continuidade live→frozen sem degrau
- 4 novos/atualizados testes em `tests/dashboards.queries.test.ts` cobrindo DP, CONTABIL, FISCAL-inalterado e colaborador-sem-tarefa-concluida
- 2 novos testes em `tests/dashboards.snapshot.test.ts` cobrindo a mesma correção no snapshot
- Suite completa (200 testes, 31 arquivos) passa sem regressões; `tsc --noEmit` limpo

## Task Commits

Each task was committed atomically:

1. **Task 1: Corrigir carteira por setor em listarDesempenhoColaboradoresMesAtual (queries.ts)** - `f7be782` (fix)
2. **Task 2: Aplicar a mesma correção em calcularSnapshotMensal (snapshot.ts)** - `c5fddfe` (fix)

_Ambos os commits seguiram o ciclo RED→GREEN: testes escritos/atualizados e confirmados falhando antes da mudança de implementação, depois confirmados passando após o fix._

## Files Created/Modified
- `src/modules/dashboards/queries.ts` - `listarDesempenhoColaboradoresMesAtual` agora ramifica por `setor`: FISCAL usa `db.empresa.groupBy` por `responsavelId` (legado); DP/CONTABIL usam `db.empresaResponsavelSetor.groupBy` por `usuarioId` filtrado por `setor` e `empresaWhereExtra`
- `src/modules/dashboards/snapshot.ts` - `calcularSnapshotMensal`, bloco `totalEmpresasPorColaboradorSetor`, mesmo branch condicional aplicado por setor presente nas chaves (colaborador, setor)
- `tests/dashboards.queries.test.ts` - novo mock `empresaResponsavelSetorGroupByMock`; testes DP/CONTABIL reescritos para mockar a junção em vez de `db.empresa.groupBy`; novo teste FISCAL-inalterado; novo teste colaborador-só-via-setor
- `tests/dashboards.snapshot.test.ts` - novo mock `empresaResponsavelSetorGroupByMock` (global e por-tx); teste IN-01 DP reescrito para a nova fonte; novo teste FISCAL-inalterado; teste de "múltiplos setores -> no máx 1 groupBy por fonte por setor" atualizado para refletir as 2 fontes distintas

## Decisions Made
- Mantida a forma legada **apenas** para FISCAL, conforme já documentado em `visibility-scope.ts` (equivalência 197/197 via backfill) — nenhuma migração de dados necessária, apenas correção da query de leitura
- Normalização do shape (`usuarioId` → `responsavelId`/chave composta) feita no ponto de origem da carteira, preservando o restante do código de agregação intocado, conforme instrução explícita do plano

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Dashboards de DP e CONTABIL agora exibem exclusivamente colaboradores/carteiras corretos do próprio setor, tanto no ponto live quanto no snapshot congelado mensal
- Nenhum blocker identificado; correção é estritamente de leitura, sem mudança de schema ou migração necessária

---
*Phase: quick-260626-le2*
*Completed: 2026-06-26*

## Self-Check: PASSED
All claimed files and commits verified present on disk / in git history.
