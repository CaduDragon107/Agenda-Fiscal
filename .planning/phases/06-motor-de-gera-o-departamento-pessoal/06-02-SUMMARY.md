---
phase: 06-motor-de-gera-o-departamento-pessoal
plan: 02
subsystem: backend
tags: [prisma, vitest, tdd, dp, server-actions]

# Dependency graph
requires:
  - phase: 06-motor-de-gera-o-departamento-pessoal
    plan: 01
    provides: "gerarTarefasDoMesDp, TipoObrigacaoDp, enum TipoObrigacao com FOLHA/ESOCIAL/FGTS/INSS"
provides:
  - "executarGeracaoMensal estendido com segundo loop DP (transacional, mesma tx do Fiscal/snapshot)"
  - "AcaoGeracaoResult.semResponsavelDp propagado ate a UI do DONO"
  - "Lista 'pular e listar' de empresas CLT sem responsavel DP, sem abortar geracao"
affects: [07 (motor contabil analogo), 08 (dashboards DP)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Particao em memoria (Array.filter) para 'pular e listar' em vez de throw — D-03"
    - "Segundo findMany dentro da MESMA db.$transaction, merge de arrays antes de um unico createMany"
    - "where: { setor: \"DP\" } obrigatorio dentro do select de responsaveisPorSetor para evitar pegar o responsavel errado"

key-files:
  created: []
  modified:
    - src/modules/tarefas/geracao.ts
    - src/app/(app)/tarefas/actions.ts
    - src/app/(app)/tarefas/gerar-tarefas-button.tsx
    - tests/geracao.idempotencia.test.ts
    - tests/geracao.actions.test.ts

key-decisions:
  - "Loop Fiscal existente permanece 100% inalterado (select id/regimeTributario/responsavelId) — decisao arquitetural do RESEARCH.md de NAO migrar Fiscal para a junction table nesta fase"
  - "Tarefas Fiscal e DP mescladas em um unico array antes de um unico tx.tarefa.createMany — idempotencia continua apoiada exclusivamente na constraint @@unique([empresaId, tipoObrigacao, competencia]), nunca em segundo createMany ou check-before-insert"
  - "semResponsavelDp e retornado em TODOS os caminhos de retorno de executarGeracaoMensal, inclusive o early-return de tarefas.length === 0"

requirements-completed: [DP-01, DP-02, DP-03, DP-04]

# Metrics
duration: 22min
completed: 2026-06-24
---

# Phase 06 Plan 02: Orquestrador Transacional do DP Summary

**Segundo loop dentro de `executarGeracaoMensal` que gera as 4 tarefas de DP por empresa CLT com responsável atribuído via `responsaveisPorSetor` (setor DP), pulando-e-listando empresas sem responsável em `semResponsavelDp` — propagado ponta a ponta até um toast de aviso para o DONO — sem alterar o loop Fiscal existente.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-06-24T13:44:00Z (estimado a partir do contexto da sessão)
- **Completed:** 2026-06-24
- **Tasks:** 3
- **Files modified:** 5 (3 source, 2 test)

## Accomplishments
- `executarGeracaoMensal` agora executa, dentro da MESMA transação (junto com snapshot + loop Fiscal), um segundo `tx.empresa.findMany` filtrando `temFuncionariosClt: true` e o responsável via `responsaveisPorSetor` com `where: { setor: "DP" }` obrigatório no select
- Empresas CLT sem responsável de DP são particionadas em memória (`Array.filter`) e retornadas em `semResponsavelDp: { empresaId, nome }[]`, nunca via `throw` — a geração Fiscal e a de outras empresas CLT seguem intactas
- Tarefas Fiscal + DP mescladas (`[...tarefasFiscal, ...tarefasDp]`) antes de um único `tx.tarefa.createMany({ skipDuplicates: true })` — sem segundo `createMany`, idempotência apoiada exclusivamente na constraint `@@unique`
- `AcaoGeracaoResult` (branch `ok: true`) e `gerarTarefasDoMesAction` estendidos com `semResponsavelDp`; `GerarTarefasButton` exibe um `toast.warning` adicional listando as empresas puladas quando a lista não está vazia
- Ciclo TDD completo (RED → GREEN): 7 testes novos/ajustados cobrindo skip-and-list, caminho positivo, regressão de filtro de setor (FISCAL vs DP), e idempotência DP
- `npm test` (suite completa, 25 arquivos/133 testes) verde — zero regressão Fiscal/IDOR

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): testes de integração com os casos de DP** - `fb2b953` (test)
2. **Task 2 (GREEN): segundo loop DP + propagação de semResponsavelDp** - `d9513fe` (feat)
3. **Task 3: suite completa sem regressão** - sem commit próprio (verificação `npm test`, nenhum arquivo alterado)

## Files Created/Modified
- `src/modules/tarefas/geracao.ts` - segundo loop DP dentro da `db.$transaction`, retorno estendido com `semResponsavelDp`
- `src/app/(app)/tarefas/actions.ts` - `AcaoGeracaoResult` (`ok: true`) estendido com `semResponsavelDp`; `gerarTarefasDoMesAction` propaga o campo
- `src/app/(app)/tarefas/gerar-tarefas-button.tsx` - toast de aviso adicional listando empresas CLT sem responsável de DP
- `tests/geracao.idempotencia.test.ts` - mocks sequenciados (2 chamadas de `empresa.findMany`), 4 novos `it` (skip-and-list, positivo, regressão de setor, idempotência DP)
- `tests/geracao.actions.test.ts` - mock sequenciado, asserção de `semResponsavelDp` no caminho DONO-sucesso

## Decisions Made
- Loop Fiscal mantido 100% inalterado (`select: { id, regimeTributario, responsavelId }`) — decisão arquitetural explícita do RESEARCH.md de não migrar Fiscal para a junction table nesta fase
- `semResponsavelDp` retornado em todos os caminhos de saída de `executarGeracaoMensal`, inclusive o early-return de `tarefas.length === 0` (evita campo `undefined` chegando à UI)
- Nenhum arquivo de teste de regressão IDOR/visibilidade pré-existente foi tocado — apenas os dois arquivos de teste de geração (já alvo desta plan) foram ajustados

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered
None.

## User Setup Required

None - nenhuma migração de banco ou configuração externa necessária (schema já sincronizado pela Plan 06-01).

## Next Phase Readiness
- DP-01 a DP-04 completos: empresas CLT com responsável de DP recebem as 4 tarefas (Folha/eSocial/FGTS/INSS) com prazos ajustados
- `semResponsavelDp` disponível na UI do DONO para atribuição manual de responsáveis pendentes
- Nenhum bloqueio identificado para a Plan 06-03 (já executada nesta sessão, conforme STATE.md) ou para a Fase 7 (motor contábil análogo)

---
*Phase: 06-motor-de-gera-o-departamento-pessoal*
*Completed: 2026-06-24*

## Self-Check: PASSED

- FOUND: src/modules/tarefas/geracao.ts (modified)
- FOUND: src/app/(app)/tarefas/actions.ts (modified)
- FOUND: src/app/(app)/tarefas/gerar-tarefas-button.tsx (modified)
- FOUND: commit fb2b953 (test)
- FOUND: commit d9513fe (feat)
