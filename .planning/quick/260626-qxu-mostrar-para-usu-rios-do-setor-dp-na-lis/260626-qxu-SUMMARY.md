---
phase: quick-260626-qxu
plan: 01
subsystem: ui
tags: [react, tanstack-table, empresas, dp]

requires:
  - phase: 05-04
    provides: "deriveEmpresaRows (D-10 security boundary) and EmpresasTable column structure"
provides:
  - "Rotulo neutro 'Sem movimento' na celula de Responsavel DP quando ausente, em vez do badge ambar de alerta 'Sem responsavel'"
  - "Cobertura de teste de regressao confirmando responsavelDp null nos casos corretos e isolamento cross-setor"
affects: [empresas, dp-dashboard]

tech-stack:
  added: []
  patterns: ["Fallback de rotulo de ausencia condicional por setor dentro da mesma celula compartilhada (branch nao-DONO)"]

key-files:
  created: []
  modified:
    - src/app/(app)/empresas/empresas-table.tsx
    - tests/empresas.derive-rows.test.ts

key-decisions:
  - "SemMovimentoDp extraido como componente local (span neutro, text-muted-foreground) reutilizado nos dois branches (DONO e nao-DONO) para evitar duplicacao"
  - "Fallback de ausencia no branch nao-DONO tornado condicional por setor: DP usa SemMovimentoDp, Fiscal/Contabil mantem o Badge amber Sem responsavel"
  - "Nenhuma alteracao em deriveEmpresaRows, withVisibilityScope, withTarefaScope ou EMPRESA_SELECT — a fronteira de seguranca D-10 permanece intacta, mudanca e puramente presentacional"

patterns-established:
  - "Pattern: ausencia de dado por contexto de negocio (sem movimento) deve usar estilo neutro, distinto de ausencia por erro/pendencia (badge de alerta)"

requirements-completed: []

duration: 12min
completed: 2026-06-26
status: complete
---

# Quick Task 260626-qxu: Rotulo "Sem movimento" na celula de Responsavel DP Summary

**Celula de Responsavel DP exibe "Sem movimento" (texto neutro) em vez do badge ambar "Sem responsavel" quando a empresa nao tem responsavel de DP atribuido, para viewers com acesso ao setor DP.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-26T22:26:43Z
- **Completed:** 2026-06-26T22:38:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Celula de Responsavel DP (branch DONO e branch nao-DONO/setor DP) agora renderiza "Sem movimento" em texto neutro quando `responsavelDp` e null, comunicando corretamente que a empresa nao tem movimento de pessoal, nao que falta atribuir alguem.
- Colunas Fiscal e Contabil permanecem inalteradas, exibindo o Badge ambar "Sem responsavel" quando vazias.
- Adicionados 3 novos casos de teste em `tests/empresas.derive-rows.test.ts` travando o contrato de que `responsavelDp`/`responsavelDpId` chegam `null` corretamente (DONO e COLABORADOR-DP sem responsavel DP) e que o nome de DP nunca vaza para um viewer fora do setor DP, mesmo quando a empresa tem responsavel de DP no fixture.

## Task Commits

Each task was committed atomically:

1. **Task 1: Renderizar "Sem movimento" na celula de Responsavel DP ausente** - `a63eb72` (feat)
2. **Task 2: Teste de regressao — DP populado só com acesso ao setor DP** - `94e8799` (test)

_Note: Task 2 was test-only (TDD-flavored task), no separate feat commit needed since the production behavior was already implemented in Task 1 and these tests exercise existing `deriveEmpresaRows` logic._

## Files Created/Modified
- `src/app/(app)/empresas/empresas-table.tsx` - Adiciona `SemMovimentoDp` (span neutro) e o usa no fallback de ausencia da celula DP em ambos os branches (DONO/nao-DONO); Fiscal/Contabil inalterados.
- `tests/empresas.derive-rows.test.ts` - Adiciona fixture `montarFixturesSemDp` (empresa sem linha DP) e 3 novos testes (Test 5, 6, 7) cobrindo ausencia de responsavel DP e isolamento cross-setor; asserts D-10 pre-existentes (Test 1-4) inalterados.

## Decisions Made
- `SemMovimentoDp` extraido como componente reutilizavel para evitar duplicar o markup/estilo nos dois branches (DONO e nao-DONO).
- Fallback do branch nao-DONO tornado condicional por `setor` em vez de compartilhado, preservando o comportamento de Fiscal/Contabil.
- Nenhuma mudanca em `deriveEmpresaRows`, `withVisibilityScope`, `withTarefaScope`, `EMPRESA_SELECT` ou na assinatura de `EmpresasTable` — escopo estritamente presentacional, conforme exigido pelo plano.

## Deviations from Plan

None - plan executed exactly as written.

(Nota: `npx prisma generate` foi executado antes do `tsc --noEmit` porque o Prisma Client local estava desatualizado em relacao ao `schema.prisma` ja migrado — erros de tipos pre-existentes e nao relacionados a esta mudanca (CHEFE_SETOR, temEmpregadaDomestica, responsavelExtratoBancario) desapareceram apos o generate. Nenhum codigo de producao foi alterado por essa acao; e regeneracao de artefato, nao fix de codigo.)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Nenhum bloqueio. Mudanca isolada e presentacional, sem impacto em outras fases.
- Smoke manual opcional sugerido pelo plano (logado como COLABORADOR de DP / FISCAL) nao foi executado nesta sessao automatizada — cobertura automatizada (tsc + vitest) e suficiente para os criterios de sucesso do plano.

---
*Phase: quick-260626-qxu*
*Completed: 2026-06-26*

## Self-Check: PASSED

- FOUND: src/app/(app)/empresas/empresas-table.tsx
- FOUND: tests/empresas.derive-rows.test.ts
- FOUND commit: a63eb72
- FOUND commit: 94e8799
