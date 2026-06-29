---
phase: 09-decimo-terceiro-salario-automatico
plan: 02
subsystem: api
tags: [prisma, vitest, geracao-tarefas, dp, periodicidade-anual]

# Dependency graph
requires:
  - phase: 09-01
    provides: catálogo puro geracao-tarefas-dp-anual.ts (obrigacoesDpAnuaisParaCompetencia, calcularPrazoDpAnual, TITULO_OBRIGACAO_DP_ANUAL), enum TipoObrigacao com DECIMO_TERCEIRO, TIPOS_OBRIGACAO_POR_SETOR.DP atualizado
provides:
  - "6º bloco transacional (DP anual / 13º) integrado em executarGeracaoMensal, reusando empresasClt/comResponsavelDp sem nova query"
  - "Tarefa DECIMO_TERCEIRO criada automaticamente pelo cron mensal em novembro, atribuída ao responsável de DP, competência YYYY"
  - "DP-09 fechado ponta a ponta: fundação pura (Plano 09-01) + orquestração real (este plano)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bloco anual adicionado como ÚLTIMO bloco da transação, reusando query já existente — evita round-trip extra e preserva cadeia de mocks posicional dos testes (Pitfall 4)"

key-files:
  created: []
  modified:
    - src/modules/tarefas/geracao.ts
    - tests/geracao.idempotencia.test.ts

key-decisions:
  - "Bloco DP-anual reusa comResponsavelDp (já computado pelo bloco DP mensal) em vez de fazer um novo tx.empresa.findMany — mesma elegibilidade (temFuncionariosClt + setor DP), zero round-trip extra ao banco"
  - "Sem nova chave de retorno semResponsavelDpAnual — empresa CLT sem responsável de DP já é reportada uma única vez em semResponsavelDp (mesma query/elegibilidade), conforme decisão de design registrada no PLAN.md"
  - "Bloco adicionado como ÚLTIMO item da transação (após Contábil anual), preservando 100% a ordem posicional dos mocks de findMany nos testes de regressão Fiscal/DP/Contábil"

patterns-established: []

requirements-completed: [DP-09]

# Metrics
duration: 18min
completed: 2026-06-29
---

# Phase 9 Plan 2: Integração do 6º Bloco (DP Anual / 13º Salário) Summary

**6º bloco transacional integrado em `executarGeracaoMensal`, reusando `empresasClt`/`comResponsavelDp` do bloco DP mensal sem nenhuma nova query — fecha DP-09 ponta a ponta, tornando a tarefa de 13º salário visível nas listas/dashboards de DP a partir desta integração.**

## Performance

- **Duration:** 18 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 6º bloco (DP anual / 13º salário) integrado em `executarGeracaoMensal`, importando `obrigacoesDpAnuaisParaCompetencia`/`calcularPrazoDpAnual`/`TITULO_OBRIGACAO_DP_ANUAL` do catálogo puro criado no Plano 09-01
- Bloco reusa `comResponsavelDp` (já buscado pelo bloco DP mensal) — confirmado via `tsc --noEmit` limpo e `grep -c "tx.empresa.findMany"` inalterado (continua 6, nenhuma chamada nova) e suite de regressão 100% verde sem ajuste de mock
- 5 novos testes de integração cobrindo: criação em novembro (`tipoObrigacao: "DECIMO_TERCEIRO"`, `competencia: "2026"`, `responsavelId` correto, título "13º Salário - 2026"), ausência fora de novembro, idempotência entre duas execuções da mesma competência, gate `temFuncionariosClt` (empresasClt vazio), e classificação de setor (`DECIMO_TERCEIRO` pertence a `TIPOS_OBRIGACAO_POR_SETOR.DP`, nunca FISCAL/CONTABIL)
- Suite completa verde: 32 arquivos de teste, 216 testes passando — nenhuma regressão posicional de mock nos blocos Fiscal/DP/Contábil existentes

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrar o 6º bloco (DP anual / 13º) em executarGeracaoMensal, reusando empresasClt** - `89fb2e9` (feat)
2. **Task 2: Adicionar testes de integração do bloco DP-anual em geracao.idempotencia.test.ts** - `7da3e68` (test)

## Files Created/Modified
- `src/modules/tarefas/geracao.ts` - Novo import de `geracao-tarefas-dp-anual`; novo bloco DP-anual (variáveis `regrasDpAnuais`/`tarefasDpAnual`) inserido após o bloco Contábil anual, reusando `comResponsavelDp`; `...tarefasDpAnual` concatenado como último item do array `tarefas` final
- `tests/geracao.idempotencia.test.ts` - 5 novos testes cobrindo o bloco DP-anual (criação, ausência, idempotência, gate de elegibilidade, classificação de setor)

## Decisions Made
- Reuso direto de `comResponsavelDp` em vez de uma query nova — elimina round-trip extra ao banco e preserva a cadeia de mocks posicional dos 13 testes de regressão pré-existentes (Pitfall 4 do RESEARCH.md), confirmado por todos passarem sem nenhuma alteração de mock
- Assinatura de retorno de `executarGeracaoMensal` mantida intocada (`{ criadas, puladas, semResponsavelDp, semResponsavelContabil }`) — decisão de design já registrada no PLAN.md, sem nova chave `semResponsavelDpAnual`

## Deviations from Plan

None - plan executed exatamente como escrito. Único ajuste de redação: um comentário inline mencionava o nome da função `obrigacoesDpAnuaisParaCompetencia` em prosa, o que elevava o `grep -c` desse símbolo para 3 em vez do esperado 2 (1 import + 1 chamada) especificado no acceptance criteria — reescrito para "a função de regras anuais de DP" preservando a intenção documental sem violar o critério verificável.

## Issues Encountered
None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. Nenhuma mudança de schema nesta plan (já aplicada no Plano 09-01).

## Next Phase Readiness
- DP-09 fechado ponta a ponta: fundação pura (Plano 09-01) + orquestração real (este plano) — tarefa `DECIMO_TERCEIRO` é gerada automaticamente pelo cron mensal em novembro, idempotente entre execuções, visível para o responsável de DP via `tarefaSetorWhere("DP")`
- Nenhuma plan de dashboard dedicada necessária para esta fase — visibilidade é automática via `tipoObrigacao: "DECIMO_TERCEIRO"` (este plano) + registro no mapa de setor (Plano 09-01)
- Suite completa (`npx vitest run`) verde: 32 arquivos, 216 testes
- `geracao-tarefas-contabil-anual.ts` permanece 100% inalterado (confirmado via `git diff --name-only` desta plan: apenas `geracao.ts` e `tests/geracao.idempotencia.test.ts` tocados)

---
*Phase: 09-decimo-terceiro-salario-automatico*
*Completed: 2026-06-29*

## Self-Check: PASSED

- FOUND: src/modules/tarefas/geracao.ts (modified)
- FOUND: tests/geracao.idempotencia.test.ts (modified)
- FOUND commit: 89fb2e9
- FOUND commit: 7da3e68
