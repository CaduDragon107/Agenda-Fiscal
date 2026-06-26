---
phase: quick-260626-kn2
plan: 01
subsystem: auth
tags: [rbac, dashboards, chefe-setor, nextjs, vitest]

requires:
  - phase: quick-260626-dfc
    provides: Role CHEFE_SETOR (Caio/Lauany/Elisabete), withVisibilityScope/withTarefaScope branches, SessionUser.setor contract
provides:
  - carregarDadosDashboards permite CHEFE_SETOR escopado a 1 setor (lido de session.user.setor)
  - page.tsx renderiza Tabs (DONO, >=2 setores), card único sem Tabs (CHEFE_SETOR, 1 setor) ou estado vazio (0 setores)
  - Link "Dashboards" na sidebar liberado para DONO e CHEFE_SETOR
affects: [dashboards, rbac]

tech-stack:
  added: []
  patterns:
    - "Guard antes da query, never 403: notFound() para qualquer role que não seja DONO/CHEFE_SETOR"
    - "Escopo de setor sempre lido de session.user.setor, nunca de query string/input do client"
    - "Fail-safe de setor null: Record vazio sem disparar query, nunca amplia para todos os setores"

key-files:
  created: []
  modified:
    - src/app/(app)/dashboards/guard.ts
    - src/app/(app)/dashboards/page.tsx
    - src/app/(app)/app-sidebar.tsx
    - tests/dashboards.rbac.test.ts

key-decisions:
  - "CHEFE_SETOR com setor null/inválido recebe Record vazio (fail-safe = sem dados), nunca notFound — alinhado ao branch CHEFE_SETOR de visibility-scope.ts"
  - "Lista de setores presentes em page.tsx derivada de Object.keys(dados), não mais do array fixo SETORES — suporta 0/1/3 chaves sem branch explícito por role"

patterns-established:
  - "Setor visível em dashboards = setoresPresentes.length (0 → estado vazio, 1 → card único sem seletor, >=2 → Tabs)"

requirements-completed: [DASH-RBAC-CHEFE]

duration: 25min
completed: 2026-06-26
---

# Quick Task 260626-kn2: Acesso de CHEFE_SETOR a /dashboards Summary

**CHEFE_SETOR agora acessa /dashboards vendo apenas o card do próprio setor (sem seletor de abas), enquanto DONO mantém as 3 abas Fiscal/DP/Contábil inalteradas.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-26T17:55:00Z
- **Completed:** 2026-06-26T18:02:30Z
- **Tasks:** 3 (2 com commit de código + 1 de verificação sem mudança de arquivo)
- **Files modified:** 4

## Accomplishments
- `carregarDadosDashboards` (guard.ts) agora aceita DONO (3 setores, comportamento inalterado) e CHEFE_SETOR (1 setor, escopado pela sessão), com fail-safe de Record vazio para setor null/inválido
- `page.tsx` deriva a lista de setores presentes dinamicamente (`Object.keys(dados)`), renderizando Tabs para >=2 setores, card único sem Tabs para exatamente 1, e estado vazio para 0
- Sidebar libera o link "Dashboards" para DONO e CHEFE_SETOR; item "Usuários" permanece DONO-only
- 4 novos casos de teste cobrindo CHEFE_SETOR (FISCAL/DP, isolamento), regressão DONO (9 chamadas) e fail-safe de setor null

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Testes falhando para CHEFE_SETOR em guard.ts** - `2dea968` (test)
2. **Task 1 (GREEN): Implementação do escopo CHEFE_SETOR em guard.ts** - `dbb5c72` (feat)
3. **Task 2: page.tsx renderiza card único + sidebar libera link** - `517e696` (feat)
4. **Task 3: Verificação completa de regressão** - sem commit de código (apenas verificação: `npx vitest run` 197/197 verde, `npx tsc --noEmit` limpo, `npm run build` sem novos erros)

_TDD: RED (2dea968) → GREEN (dbb5c72), sem fase REFACTOR separada (código já limpo na primeira passagem)._

## Files Created/Modified
- `src/app/(app)/dashboards/guard.ts` - Guard estendido para permitir CHEFE_SETOR (1 setor da sessão) além de DONO (3 setores); fail-safe de setor null retorna Record vazio
- `src/app/(app)/dashboards/page.tsx` - Lista de setores derivada de `Object.keys(dados)`; Tabs só quando >=2 setores presentes, card único sem Tabs quando 1, estado vazio quando 0
- `src/app/(app)/app-sidebar.tsx` - `podeVerDashboards` (DONO || CHEFE_SETOR) substitui `isDono` no gate do item "Dashboards"; item "Usuários" inalterado
- `tests/dashboards.rbac.test.ts` - 4 novos casos: CHEFE_SETOR FISCAL (1 setor, 3 queries x1), CHEFE_SETOR DP (isolamento + empresaScopePorSetor.DP), DONO regressão (9 queries, 3 setores), CHEFE_SETOR setor null (Record vazio, 0 queries)

## Decisions Made
- CHEFE_SETOR com `setor` null/inválido aplica fail-safe "Record vazio, nenhuma query disparada" em vez de `notFound()` — escolha alinhada ao padrão já estabelecido em `withVisibilityScope`/`withTarefaScope` (260626-dfc), onde "fail seguro" significa "sem dados visíveis", não bloqueio total da rota.
- A decisão de Tabs vs. card único em page.tsx é feita por contagem de chaves do `dados` retornado (`Object.keys(dados).length`), não por checagem explícita de `role` — mantém page.tsx desacoplado do guard e funciona corretamente mesmo se um futuro papel introduzir outro padrão de escopo.

## Deviations from Plan

None - plan executado exatamente como escrito. Task 3 não exigiu nenhuma correção (nenhum teste pré-existente quebrou com a mudança de contrato de `carregarDadosDashboards`).

## Issues Encountered
None.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness
- CHEFE_SETOR (Caio/Lauany/Elisabete) já pode navegar para `/dashboards` em produção e ver apenas os dados do próprio setor.
- DONO continua com o comportamento idêntico ao pré-existente (3 abas, 9 chamadas de query).
- Nenhum bloqueio identificado para o próximo trabalho planejado (Phase 9: 13º Salário Automático).

---
*Phase: quick-260626-kn2*
*Completed: 2026-06-26*

## Self-Check: PASSED

All claimed files exist on disk (guard.ts, page.tsx, app-sidebar.tsx, dashboards.rbac.test.ts, this SUMMARY.md) and all 3 task commit hashes (2dea968, dbb5c72, 517e696) are present in git history.
