---
phase: 06-motor-de-gera-o-departamento-pessoal
plan: 01
subsystem: database
tags: [prisma, date-fns, date-holidays, vitest, tdd, dp]

# Dependency graph
requires:
  - phase: 03-motor-de-geracao-mensal
    provides: anticiparParaDiaUtil / isDiaUtil singleton pattern, TarefaParaCriar shape, CATALOGO_OBRIGACOES Fiscal pattern this plan mirrors
provides:
  - "enum TipoObrigacao estendido com FOLHA, ESOCIAL, FGTS, INSS (aditivo, sem remoções)"
  - "calcularQuintoDiaUtil(competencia): contagem de 5º dia útil para frente, reusando o hd singleton existente"
  - "CATALOGO_OBRIGACOES_DP + gerarTarefasDoMesDp(empresas, competencia): gerador puro das 4 obrigações de DP, catálogo flat (não por regime)"
affects: [06-02 (orquestrador transacional geracao.ts que consome gerarTarefasDoMesDp), 07 (motor contábil análogo)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Catálogo flat (array, não Record<RegimeTributario,...>) para obrigações que não variam por regime tributário"
    - "Contagem de dia útil para frente (calcularQuintoDiaUtil) como espelho invertido de anticiparParaDiaUtil, reusando o mesmo singleton de feriados"

key-files:
  created:
    - src/lib/geracao-tarefas-dp.ts
    - tests/geracao-tarefas-dp.test.ts
  modified:
    - prisma/schema.prisma
    - src/lib/dia-util.ts
    - tests/dia-util.test.ts

key-decisions:
  - "Catálogo de DP é flat (ObrigacaoRegraDp[]), não Record<RegimeTributario,...> — DP não varia por regime tributário, apenas pelo gate temFuncionariosClt aplicado no chamador (Plan 06-02)"
  - "FOLHA usa calcularQuintoDiaUtil sem compor com anticiparParaDiaUtil — o resultado já é dia útil por construção"
  - "ESOCIAL/FGTS/INSS reusam a mesma calcularPrazoBaseDiaFixo (renomeada) + anticiparParaDiaUtil do padrão Fiscal"

patterns-established:
  - "Pattern: catálogo flat para domínios sem variação por regime tributário"
  - "Pattern: contagem de dia útil para frente reusando singleton hd/isDiaUtil existente, nunca segunda instância de Holidays"

requirements-completed: [DP-01, DP-02, DP-03, DP-04]

# Metrics
duration: 13min
completed: 2026-06-24
---

# Phase 06 Plan 01: Motor de Cálculo Puro do DP Summary

**Catálogo flat de 4 obrigações de Departamento Pessoal (FOLHA/ESOCIAL/FGTS/INSS) com gerador puro `gerarTarefasDoMesDp`, e nova função `calcularQuintoDiaUtil` em `dia-util.ts` para a regra de prazo da Folha (5º dia útil contado para frente).**

## Performance

- **Duration:** 13 min
- **Started:** 2026-06-24T12:44:00Z
- **Completed:** 2026-06-24T12:57:16Z
- **Tasks:** 3
- **Files modified:** 5 (3 source/schema, 2 test)

## Accomplishments
- Enum Prisma `TipoObrigacao` estendido aditivamente com `FOLHA`, `ESOCIAL`, `FGTS`, `INSS`, sem remover/renomear nenhum valor Fiscal existente
- `calcularQuintoDiaUtil` adicionada a `dia-util.ts`, reusando o singleton `hd`/`isDiaUtil` já validado (sem segunda fonte de feriados)
- Novo arquivo `src/lib/geracao-tarefas-dp.ts` com catálogo flat `CATALOGO_OBRIGACOES_DP` e gerador puro `gerarTarefasDoMesDp`, espelhando a estrutura de `geracao-tarefas.ts`
- Schema sincronizado com o banco Neon (`prisma db push`, mudança não-destrutiva) e Prisma Client regenerado expondo os 4 novos valores de enum
- Ciclo TDD completo (RED → GREEN) com 13 testes verdes cobrindo os 4 comportamentos especificados

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): testes falhando para calcularQuintoDiaUtil e gerarTarefasDoMesDp** - `c511aba` (test)
2. **Task 2 (GREEN): estender enum, calcularQuintoDiaUtil, geracao-tarefas-dp.ts** - `817f4b5` (feat)
3. **Task 3 [BLOCKING]: prisma db push + generate** - sem diff de arquivo (ação runtime contra o banco Neon; schema já commitado na Task 2); verificado via `npx tsc --noEmit` verde

_Nota: Task 3 não gera commit próprio — é uma ação de infraestrutura (sincronização de banco), não uma mudança de arquivo versionado._

## Files Created/Modified
- `prisma/schema.prisma` - enum `TipoObrigacao` com 4 novos valores (FOLHA, ESOCIAL, FGTS, INSS)
- `src/lib/dia-util.ts` - nova função `calcularQuintoDiaUtil` (contagem de dia útil para frente)
- `src/lib/geracao-tarefas-dp.ts` - novo catálogo flat + gerador puro `gerarTarefasDoMesDp`
- `tests/dia-util.test.ts` - novo bloco `describe("calcularQuintoDiaUtil")` com 3 casos (07/07/2026, 08/01/2027, varredura de 2 anos)
- `tests/geracao-tarefas-dp.test.ts` (novo) - 4 testes cobrindo tipos gerados, prazo FOLHA, prazos ESOCIAL/FGTS/INSS, campos obrigatórios

## Decisions Made
- Catálogo de DP mantido FLAT (array `ObrigacaoRegraDp[]`), não `Record<RegimeTributario, ...>` como o Fiscal — DP não varia por regime; o gate de "tem funcionários CLT" fica no chamador (Plan 06-02), não neste catálogo
- `calcularQuintoDiaUtil` não compõe com `anticiparParaDiaUtil` — o resultado já é dia útil por construção da própria contagem para frente
- `calcularPrazoBaseDiaFixo` (renomeada de `calcularPrazoBase`) duplicada no novo arquivo em vez de extraída para um módulo compartilhado — replica exatamente o padrão analog do Fiscal por decisão do PATTERNS.md desta fase, mantendo os dois catálogos (Fiscal/DP) desacoplados

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered
None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. `prisma db push` aplicado diretamente contra o banco Neon já configurado em sessões anteriores.

## Next Phase Readiness
- `gerarTarefasDoMesDp` e `CATALOGO_OBRIGACOES_DP`/`TITULO_OBRIGACAO_DP` prontos para serem consumidos pelo orquestrador transacional em `src/modules/tarefas/geracao.ts` (Plan 06-02)
- Enum do banco já sincronizado — Plan 06-02 pode criar `Tarefa` com `tipoObrigacao` em qualquer um dos 4 novos valores sem migração adicional
- Nenhum bloqueio identificado para a Plan 06-02

---
*Phase: 06-motor-de-gera-o-departamento-pessoal*
*Completed: 2026-06-24*

## Self-Check: PASSED

- FOUND: src/lib/geracao-tarefas-dp.ts
- FOUND: tests/geracao-tarefas-dp.test.ts
- FOUND: SUMMARY.md (this file)
- FOUND: commit c511aba (test)
- FOUND: commit 817f4b5 (feat)
