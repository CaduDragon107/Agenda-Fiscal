---
phase: 07-motor-de-gera-o-cont-bil-mensal-e-anual
plan: 02
subsystem: motor-de-geracao-contabil
tags: [contabil, motor-geracao, transacao, prisma, vitest]

# Dependency graph
requires:
  - phase: 07-01
    provides: "Catálogos puros (geracao-tarefas-contabil.ts, geracao-tarefas-contabil-anual.ts) + enum TipoObrigacao estendido e já sincronizado com o banco Neon"
provides:
  - "executarGeracaoMensal gerando, na mesma transação, Contábil mensal (8 rotinas, LUCRO_REAL/LUCRO_PRESUMIDO) e Contábil anual (DEFIS/ECD/ECF, condicional ao mês)"
  - "semResponsavelContabil propagado ponta a ponta: motor → Server Action (AcaoGeracaoResult) → toast na UI (gerar-tarefas-button.tsx)"
  - "Testes de integração cobrindo geração mensal Contábil, pular-e-listar deduplicado, disparo anual ECD em abril, e idempotência mensal+anual"
affects: [08-dashboards (vai precisar agregar tarefas Contábil mensais E anuais nos dashboards comparativos)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bloco transacional adicional segue o molde exato do bloco DP da Fase 6: findMany com responsaveisPorSetor filtrado por setor, split em comResponsavel/semResponsavel, pular-e-listar nunca throw"
    - "Bloco anual condicional ao mês vive dentro do mesmo loop transacional, iterando sobre obrigacoesAnuaisParaCompetencia(competencia) — uma query de empresas por obrigação disparada, filtrando regimesElegiveis dinamicamente (nunca hardcoded)"
    - "Deduplicação de semResponsavelContabil por empresaId via Map, unindo ocorrências do bloco mensal e de todos os blocos anuais disparados no mesmo mês"

key-files:
  created: []
  modified:
    - src/modules/tarefas/geracao.ts
    - src/app/(app)/tarefas/actions.ts
    - src/app/(app)/tarefas/gerar-tarefas-button.tsx
    - tests/geracao.idempotencia.test.ts
    - tests/geracao.actions.test.ts

key-decisions:
  - "[07-02] tarefasContabilAnual tipado localmente como array inline (empresaId/responsavelId/titulo/tipoObrigacao: TipoObrigacaoAnual/competencia/prazo) em vez de reusar TarefaParaCriarContabil — os dois eixos (mensal/anual) têm tipos de tipoObrigacao disjuntos (TipoObrigacaoContabil vs TipoObrigacaoAnual), reusar o tipo mensal quebraria o array.concat sob tsc"
  - "[07-02] tests/geracao.actions.test.ts: a suite roda na data real do sistema (sem fake timers) e gerarTarefasDoMesAction usa competenciaAtual() sem argumento — o mock de empresa.findMany agora usa um mockResolvedValue([]) de fallback (cobre 0+ chamadas extras do bloco anual condicional, ex.: junho dispara ECF) empilhado com 3 mockResolvedValueOnce explícitos para Fiscal/DP/Contábil mensal, tornando o teste estável independente do mês em que a suite é executada"
  - "[07-02] tests/geracao.idempotencia.test.ts: todos os 8 testes legados (D-10/D-11/D-12/DP) usam competências fixas em meses SEM disparo anual (jul/ago/set) e ganham um 3º mockResolvedValueOnce([]) para o novo bloco Contábil mensal — comportamento Fiscal/DP 100% inalterado, apenas a contagem de chamadas mockadas muda"

requirements-completed: [CONT-01, CONT-02, CONT-03, CONT-04, CONT-05]

# Metrics
duration: ~20min
completed: 2026-06-24
---

# Phase 07 Plan 02: Motor de Geração Contábil — Orquestração Transacional Summary

`executarGeracaoMensal` estendido com o bloco Contábil mensal (8 rotinas para LUCRO_REAL/LUCRO_PRESUMIDO, responsável via setor CONTABIL) e o bloco Contábil anual (DEFIS/ECD/ECF, condicional ao mês, filtro dinâmico por regime elegível) na mesma transação dos blocos Fiscal/DP já existentes; `semResponsavelContabil` deduplicado e propagado até o toast de aviso na UI.

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `executarGeracaoMensal` agora gera, na MESMA transação, Fiscal + DP + Contábil mensal + Contábil anual — snapshot e as 4 categorias de tarefas sobem ou caem juntos.
- Bloco Contábil anual (DEFIS/ECD/ECF) filtra empresas elegíveis dinamicamente via `regra.regimesElegiveis` — nunca reusa o filtro hardcoded do bloco mensal (Pitfall 3 evitado, testado explicitamente: ECD exclui SIMPLES_NACIONAL).
- Empresas sem responsável CONTABIL (mensal ou qualquer obrigação anual disparada no mês) são deduplicadas por `empresaId` antes do retorno (Pitfall 4 evitado, testado explicitamente).
- `semResponsavelContabil` chega ponta a ponta: `executarGeracaoMensal` → `AcaoGeracaoResult`/`gerarTarefasDoMesAction` → `toast.warning` em `gerar-tarefas-button.tsx`.
- Suite completa (`npm test`) permanece 100% verde: 28 arquivos, 158 testes — nenhuma regressão em Fiscal/DP/IDOR/dashboards.

## Task Commits

1. **Task 1: Blocos Contábil mensal + anual em executarGeracaoMensal** - `581c3c6` (feat)
2. **Task 2: Propagar semResponsavelContabil até a UI + estender testes de integração** - `e709224` (feat)

## Files Created/Modified
- `src/modules/tarefas/geracao.ts` - 3º bloco (Contábil mensal) + 4º bloco (Contábil anual) na mesma transação; retorno estendido com `semResponsavelContabil` deduplicado nos dois caminhos de return
- `src/app/(app)/tarefas/actions.ts` - `AcaoGeracaoResult` e `gerarTarefasDoMesAction` propagam `semResponsavelContabil`
- `src/app/(app)/tarefas/gerar-tarefas-button.tsx` - novo `toast.warning` para empresas Lucro Real/Presumido sem responsável Contábil
- `tests/geracao.idempotencia.test.ts` - 5 casos novos (geração mensal Contábil, pular-e-listar, disparo anual ECD em abril, idempotência anual, dedup Pitfall 4) + 8 casos legados ajustados para a 3ª chamada de `empresa.findMany`
- `tests/geracao.actions.test.ts` - mock de `empresa.findMany` ajustado com fallback `mockResolvedValue([])` para tornar o teste estável independente do mês real de execução da suite (bloco anual condicional)

## Decisions Made
- `tarefasContabilAnual` tipado inline em vez de reusar `TarefaParaCriarContabil` — `tipoObrigacao` é um union disjunto entre os dois eixos (mensal vs anual), reuso quebraria `Array.concat` sob `tsc`.
- Testes de integração que dependem de `competenciaAtual()` (sem argumento explícito) precisam de um mock de fallback (`mockResolvedValue` sem `Once`) porque a suite roda na data real do sistema e meses de virada anual (fev/abr/jun) disparam uma chamada extra de `empresa.findMany` que variava conforme o dia da execução — descoberto ao rodar a suite em 24/06/2026 (junho, mês de criação do ECF).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tests/geracao.actions.test.ts quebrava em meses de virada anual por usar `competenciaAtual()` sem mock de data fixa**
- **Found during:** Task 2, ao rodar `npx vitest run tests/geracao.actions.test.ts` após estender `geracao.ts` com o bloco anual
- **Issue:** O teste "DONO autenticado dispara a geração..." chama `gerarTarefasDoMesAction()` sem competência explícita, que resolve para `competenciaAtual()` (data real do sistema). Em 24/06/2026 (junho), isso dispara o bloco anual ECF, fazendo uma 4ª chamada de `empresa.findMany` que o mock só tinha 3 `mockResolvedValueOnce` preparados — a 4ª chamada retornava `undefined`, lançando `TypeError` capturado pelo `catch` da action e fazendo `resultado.ok` ser `false` em vez de `true`.
- **Fix:** Adicionado `findManyMock.mockResolvedValue([])` como fallback ANTES dos 3 `mockResolvedValueOnce` explícitos — cobre qualquer chamada adicional do bloco anual condicional, tornando o teste estável independente do mês de execução da suite, sem introduzir fake timers (fora do escopo desta plan).
- **Files modified:** tests/geracao.actions.test.ts
- **Verification:** `npx vitest run tests/geracao.actions.test.ts` verde (3/3); confirmado que o teste também passaria em meses sem disparo anual (o fallback não é consumido nesse caso).
- **Committed in:** e709224 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Correção necessária para a suite passar de forma determinística independente da data real de execução; sem mudança de comportamento em produção (a action sempre chamou `competenciaAtual()`, o teste apenas não previa o caso de mês de virada anual).

## Issues Encountered
None além do deviation documentado acima.

## User Setup Required
None - nenhuma configuração de serviço externo necessária. O enum `TipoObrigacao` e o banco Neon já estavam sincronizados ao início desta plan (resolvido fora desta sessão, conforme nota em `<sequential_execution>`).

## Next Phase Readiness
- Motor de geração Contábil (mensal + anual) 100% funcional e testado, fechando CONT-01 a CONT-05.
- CONT-06 (tarefas avulsas Contábil) já estava coberto por infraestrutura existente (`withVisibilityScope`/`withTarefaScope` setor-aware desde a Fase 5) — nenhuma mudança de código necessária nesta plan.
- Fase 8 (dashboards) precisará agregar tarefas Contábil mensais ("YYYY-MM") e anuais ("YYYY") sob critérios de filtro potencialmente distintos — decisão de UI já sinalizada como não-bloqueante em 07-RESEARCH.md (Open Question 1).
- Nenhum bloqueio para a Fase 8.

---
*Phase: 07-motor-de-gera-o-cont-bil-mensal-e-anual*
*Completed: 2026-06-24*

## Self-Check: PASSED

- FOUND: src/modules/tarefas/geracao.ts
- FOUND: src/app/(app)/tarefas/actions.ts
- FOUND: src/app/(app)/tarefas/gerar-tarefas-button.tsx
- FOUND: tests/geracao.idempotencia.test.ts
- FOUND: tests/geracao.actions.test.ts
- FOUND: commit 581c3c6 (feat(07-02): adicionar blocos Contabil mensal e anual em executarGeracaoMensal)
- FOUND: commit e709224 (feat(07-02): propagar semResponsavelContabil do motor ao toast na UI)
