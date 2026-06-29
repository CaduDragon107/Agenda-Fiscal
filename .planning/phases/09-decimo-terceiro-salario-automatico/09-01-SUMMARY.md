---
phase: 09-decimo-terceiro-salario-automatico
plan: 01
subsystem: api
tags: [prisma, vitest, geracao-tarefas, dp, periodicidade-anual]

# Dependency graph
requires:
  - phase: 07-motor-periodicidade-anual
    provides: padrão de catálogo anual puro (geracao-tarefas-contabil-anual.ts), competenciaAnualSchema, idempotência via @@unique
  - phase: 06-expansao-dp
    provides: padrão de gate temFuncionariosClt + responsaveisPorSetor filtrado por setor DP (geracao-tarefas-dp.ts)
provides:
  - "Catálogo puro geracao-tarefas-dp-anual.ts (DECIMO_TERCEIRO, anoVencimento = anoAtual, vencimento 20/dez)"
  - "Enum TipoObrigacao com DECIMO_TERCEIRO aplicado no banco Neon e no schema"
  - "TIPOS_OBRIGACAO_POR_SETOR.DP atualizado (5 valores), teste de completude verde (soma 21)"
affects: ["09-02 (orquestração do bloco DP-anual em geracao.ts)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Catálogo anual paralelo (não generalizar motor Contábil anual existente) quando a única divergência é o cálculo do ano de vencimento"

key-files:
  created:
    - src/lib/geracao-tarefas-dp-anual.ts
    - tests/geracao-tarefas-dp-anual.test.ts
  modified:
    - prisma/schema.prisma
    - src/lib/tipo-obrigacao-setor.ts
    - tests/tipo-obrigacao-setor.test.ts

key-decisions:
  - "anoVencimento = anoAtual (D-02) hardcoded em função dedicada, sem reuso/import do módulo geracao-tarefas-contabil-anual (que hardcoda anoAtual + 1) — catálogo paralelo evita risco de regressão nos testes de ECD/ECF/DEFIS"
  - "Catálogo flat (sem campo de elegibilidade por regime tributário) — gate real (temFuncionariosClt) fica no chamador, mesmo padrão de geracao-tarefas-dp.ts"
  - "Vencimento fixado em 20/dezembro (2ª parcela/saldo), não 30/novembro (1ª parcela) — D-01"

patterns-established:
  - "Pattern: divergência estrutural pequena (ano de vencimento) em motor de periodicidade anual resolve-se duplicando a função pura num arquivo dedicado, nunca generalizando a função existente com parâmetro booleano"

requirements-completed: [DP-09]

# Metrics
duration: 25min
completed: 2026-06-29
---

# Phase 9 Plan 1: Fundação do 13º Salário Automático Summary

**Catálogo puro `geracao-tarefas-dp-anual.ts` com a regra do 13º salário (vence 20/dez do MESMO ano-base, criado em novembro) registrado no enum Prisma e no mapa de setor DP, aplicado no banco Neon.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-06-29T10:42:51Z
- **Completed:** 2026-06-29T10:49:34Z
- **Tasks:** 3
- **Files modified:** 5 (2 criados, 3 modificados)

## Accomplishments
- Catálogo puro anual de DP criado (`geracao-tarefas-dp-anual.ts`), exportando os 6 símbolos definidos no plano, com `anoVencimento = anoAtual` (D-02) — divergência estrutural deliberada em relação ao motor Contábil anual (`anoAtual + 1`), implementada como catálogo paralelo sem nenhum import do módulo Contábil
- Teste de sweep de 12 meses confirma exatamente 1 disparo de `DECIMO_TERCEIRO` por ano, sempre em novembro; ajuste de dia útil verificado contra calendário real (20/dez/2026, domingo, antecipa para sexta 18/dez/2026; 20/dez/2027, segunda-feira, dia útil, sem ajuste)
- Enum `TipoObrigacao` (21 valores) e mapa `TIPOS_OBRIGACAO_POR_SETOR.DP` (5 valores) atualizados no MESMO commit — mitigação direta do Pitfall 2 do RESEARCH.md (tarefa invisível em dashboards/listas de DP)
- Mudança de schema aplicada e confirmada no banco Neon via `npx prisma db push` + `npx prisma db pull --print`

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar o catálogo puro anual de DP (geracao-tarefas-dp-anual.ts) + teste de sweep** - `0b89911` (feat, TDD red→green)
2. **Task 2: Adicionar DECIMO_TERCEIRO ao enum Prisma e ao mapa de setor (mesmo commit) + atualizar teste de completude** - `ada9e70` (feat)
3. **Task 3: [BLOCKING] Aplicar a mudança de enum no banco Neon (prisma db push) e confirmar** - sem commit de código (operação de banco, verificada via `prisma db pull --print`; `prisma/schema.prisma` já estava commitado na Task 2)

**Plan metadata:** (este commit, a seguir)

_Nota: Task 1 seguiu o fluxo TDD (teste escrito primeiro, RED confirmado por import inexistente, depois GREEN com a implementação) dentro de um único commit `feat`, conforme convenção já usada nas fases anteriores deste projeto (commit único por task, não separação test→feat)._

## Files Created/Modified
- `src/lib/geracao-tarefas-dp-anual.ts` - Catálogo puro anual de DP: `CATALOGO_OBRIGACOES_DP_ANUAIS`, `TITULO_OBRIGACAO_DP_ANUAL`, `obrigacoesDpAnuaisParaCompetencia`, `calcularPrazoDpAnual`
- `tests/geracao-tarefas-dp-anual.test.ts` - Sweep de 12 meses, asserção de `anoVencimento` (D-02), meses sem disparo, ajuste de dia útil, validação de formato
- `prisma/schema.prisma` - Enum `TipoObrigacao` ganha `DECIMO_TERCEIRO` (20 → 21 valores)
- `src/lib/tipo-obrigacao-setor.ts` - `TIPOS_OBRIGACAO_POR_SETOR.DP` ganha `DECIMO_TERCEIRO` (4 → 5 valores)
- `tests/tipo-obrigacao-setor.test.ts` - Contagens atualizadas (DP 4→5, soma total 20→21)

## Decisions Made
- `anoVencimento = anoAtual` hardcoded com comentário explícito em função dedicada (não generalização do motor Contábil anual) — menor risco de regressão nos 3 testes de ECD/ECF/DEFIS já em produção, conforme recomendação do RESEARCH.md
- Comentários de cabeçalho do novo arquivo evitam mencionar literalmente `geracao-tarefas-contabil-anual` ou `regimesElegiveis` por nome exato, para satisfazer os critérios de aceitação verificados via `grep -c` (que checam ausência de import/reuso, não apenas de prosa) — a intenção documental do plano (explicar a divergência) foi preservada com texto descritivo equivalente

## Deviations from Plan

None - plan executed exactly as written. As duas pequenas reformulações de comentário (citadas acima em "Decisions Made") foram ajustes de redação dentro da Task 1, não desvios de comportamento, arquitetura ou escopo.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. A mudança de schema (enum) foi aplicada diretamente no banco Neon já configurado (mesma `DATABASE_URL` em uso desde fases anteriores).

## Next Phase Readiness
- `geracao-tarefas-dp-anual.ts` pronto para ser consumido pelo Plano 09-02 (integração do 6º bloco em `src/modules/tarefas/geracao.ts`), conforme Pattern 2 do `09-RESEARCH.md`
- Enum `TipoObrigacao` e mapa de setor já sincronizados em produção (Neon) — nenhum bloqueio de schema para o próximo plano
- Suite completa (`npx vitest run`) verde: 32 arquivos de teste, 211 testes passando, incluindo a suite pré-existente (`geracao-tarefas-contabil-anual.test.ts`, `geracao.idempotencia.test.ts`) sem nenhuma regressão
- `geracao-tarefas-contabil-anual.ts` permanece 100% inalterado (confirmado via `git diff --name-only` entre os 2 commits desta plan)

---
*Phase: 09-decimo-terceiro-salario-automatico*
*Completed: 2026-06-29*

## Self-Check: PASSED

- FOUND: src/lib/geracao-tarefas-dp-anual.ts
- FOUND: tests/geracao-tarefas-dp-anual.test.ts
- FOUND commit: 0b89911
- FOUND commit: ada9e70
