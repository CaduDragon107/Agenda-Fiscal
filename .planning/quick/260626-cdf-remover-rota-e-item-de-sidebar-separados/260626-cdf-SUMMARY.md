---
phase: quick-260626-cdf
plan: 01
subsystem: ui
tags: [nextjs, tanstack-table, sidebar, empresas]

# Dependency graph
requires:
  - phase: quick-260626-a8d
    provides: rota /empresas/dp e campo informativo Empresa.temEmpregadaDomestica
provides:
  - Consolidação da gestão de empresas em uma única rota (/empresas)
  - Coluna "Empregada doméstica" na tabela principal de Empresas
affects: [empresas, sidebar, dp]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/app/(app)/app-sidebar.tsx
    - src/app/(app)/empresas/derive-rows.ts
    - src/app/(app)/empresas/empresas-table.tsx
    - tests/empresas.derive-rows.test.ts

key-decisions:
  - "Coluna 'Empregada doméstica' é sempre visível (independente de isDono/setor) pois é puramente informativa e não expõe identidade de responsável cross-setor — fora da fronteira de segurança D-10."
  - "Pasta src/app/(app)/empresas/dp/ removida por completo (page.tsx + empresas-dp-table.tsx), e não apenas a rota."

patterns-established: []

requirements-completed: [EMPR-01]

# Metrics
duration: 12min
completed: 2026-06-26
---

# Quick Task 260626-cdf: Consolidar gestão de empresas em /empresas Summary

**Removida a rota separada /empresas/dp e o item de sidebar correspondente; campo "Empregada doméstica" migrado para a tabela principal de Empresas como coluna sempre visível.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-26T11:48:00Z
- **Completed:** 2026-06-26T12:00:49Z
- **Tasks:** 3 completed
- **Files modified:** 4

## Accomplishments
- Rota `/empresas/dp` deletada (pasta inteira removida: `page.tsx` + `empresas-dp-table.tsx`)
- Item de sidebar "Empresas DP" removido; `isActive` de "Empresas" simplificado para `startsWith("/empresas")`; import não usado de `Users` (lucide-react) removido
- Campo `temEmpregadaDomestica` propagado em `derive-rows.ts` nos dois branches (DONO e não-DONO) — campo informativo, fora da fronteira D-10
- Nova coluna "Empregada doméstica" na tabela principal `/empresas` com `Badge "Sim"` quando true, célula vazia quando false — sempre visível, sem condicionamento a `isDono`/setor
- Teste `tests/empresas.derive-rows.test.ts` atualizado com assertivas de `temEmpregadaDomestica` em Test 1 (COLABORADOR/DP) e Test 3 (DONO), sem alterar a varredura anti-vazamento D-10 (Test 4 intacto)

## Task Commits

Each task was committed atomically:

1. **Task 1: Remover rota e item de sidebar de DP** - `89b84d6` (feat)
2. **Task 2: Adicionar coluna "Empregada doméstica" na tabela principal** - `40e6624` (feat)
3. **Task 3: Atualizar teste de derive-rows para o novo campo** - `5777967` (test)

_Note: Task 3 era marcada tdd="true", mas o ciclo RED/GREEN não se aplicou da forma usual — o campo já existia no fixture e na implementação (entregue na plan anterior 260626-a8d); esta task apenas adicionou cobertura de assertiva, sem teste falho intermediário._

## Files Created/Modified
- `src/app/(app)/app-sidebar.tsx` - Removido item "Empresas DP", import `Users`, e cláusula `!pathname.startsWith("/empresas/dp")` do isActive
- `src/app/(app)/empresas/derive-rows.ts` - Adicionado `temEmpregadaDomestica` ao objeto retornado em ambos os branches (DONO e não-DONO)
- `src/app/(app)/empresas/empresas-table.tsx` - Adicionado campo `temEmpregadaDomestica: boolean` ao tipo `EmpresaRow` e nova coluna "Empregada doméstica" (Badge "Sim" / vazio)
- `tests/empresas.derive-rows.test.ts` - Assertivas de `temEmpregadaDomestica` em Test 1 e Test 3

## Decisions Made
- Coluna "Empregada doméstica" mantida sempre visível (não condicionada a `isDono`/setor) — é puramente informativa (boolean) e não contém identidade de responsável de outro setor, portanto não está sujeita à restrição cross-setor de D-10.
- Pasta `dp/` removida por completo via `rm -rf`, não apenas os dois arquivos individualmente — confirma que a pasta não ficou com resíduos.

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered
- `npx tsc --noEmit` inicialmente falhou com erros em `.next/types/app/(app)/empresas/dp/page.ts` — tipos gerados pelo Next.js (cache `.next/`) ainda referenciavam a rota deletada. Resolvido limpando o cache (`rm -rf .next`) antes de rodar `tsc --noEmit` novamente, que então passou limpo. Não é um problema de código-fonte, apenas cache stale do build anterior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `npm run build` e `npm test` (182/182 testes, 30 arquivos) passam limpos após as mudanças
- Rota `/empresas` é agora o único ponto de entrada para gestão de empresas, incluindo a informação de DP (Responsável DP + Empregada doméstica)
- Sem migração de banco necessária; `Empresa.temEmpregadaDomestica` já existia desde a plan 260626-a8d

---
*Phase: quick-260626-cdf*
*Completed: 2026-06-26*

## Self-Check: PASSED

All files (`app-sidebar.tsx`, `derive-rows.ts`, `empresas-table.tsx`, `empresas.derive-rows.test.ts`) confirmed present on disk; `dp/` folder confirmed deleted; all 3 task commits (`89b84d6`, `40e6624`, `5777967`) confirmed present in git log.
