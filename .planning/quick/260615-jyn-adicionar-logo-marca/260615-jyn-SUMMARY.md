---
phase: quick
plan: 260615-jyn
subsystem: ui
tags: [next-image, branding, sidebar, login, tailwind]

# Dependency graph
requires: []
provides:
  - Logo da empresa (public/logo-branco.png) renderizada no header da sidebar do app
  - Logo da empresa renderizada no header do card de login
affects: [ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Logo branca sempre dentro de container com bg-neutral-900 (fundo escuro FIXO, theme-independent) para garantir visibilidade em light e dark mode"

key-files:
  created: []
  modified:
    - "src/app/(app)/app-sidebar.tsx"
    - "src/app/login/login-form.tsx"

key-decisions:
  - "No SidebarHeader, a logo (169x64, renderizada em h-8) substitui a antiga caixa bg-primary com Building2; o container da logo recebe group-data-[collapsible=icon]:hidden para não estourar a largura da sidebar colapsada"
  - "O bloco de texto 'Agenda Fiscal' foi removido do SidebarHeader (a logo já comunica o branding); o subtítulo 'Visão geral' (isDono) foi preservado, condicionado a isDono"
  - "Building2 permanece importado e usado no item de menu 'Empresas'"
  - "No login, CardTitle 'Agenda Fiscal' foi removido em favor da logo (h-12, priority, centralizada em container bg-neutral-900); CardDescription preservada e centralizada"

patterns-established:
  - "Logo branca = sempre sobre bg-neutral-900 (não bg-primary/bg-sidebar), independentemente de light/dark mode"

requirements-completed: [QUICK-LOGO]

# Metrics
duration: 12min
completed: 2026-06-15
---

# Quick Task 260615-jyn: Adicionar logo da marca Summary

**Logo da Agenda Fiscal (logo-branco.png, 169x64) adicionada via next/image no header da sidebar e no card de login, sempre sobre container bg-neutral-900 para visibilidade garantida em light e dark mode.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-15T17:19:00Z
- **Completed:** 2026-06-15T17:31:13Z
- **Tasks:** 3 (2 com mudança de código + 1 verificação)
- **Files modified:** 2

## Accomplishments
- SidebarHeader agora exibe a logo branca da empresa em vez do ícone Building2 sobre bg-primary
- CardHeader do login exibe a mesma logo, em destaque (h-12, priority), substituindo o título textual
- Ambas as instâncias usam um container de fundo escuro fixo (bg-neutral-900), garantindo que a logo branca nunca fique invisível independentemente do tema
- Modo collapsible=icon da sidebar continua funcional (logo escondida no estado colapsado, igual ao bloco de texto anterior)
- npm run build e npm run lint passam sem erros

## Task Commits

Each task was committed atomically:

1. **Task 1: Substituir ícone/texto do SidebarHeader pela logo** - `8cc35e6` (feat)
2. **Task 2: Adicionar logo no CardHeader do login** - `1554cc1` (feat)
3. **Task 3: Verificar build e lint** - sem commit (apenas verificação, nenhum arquivo alterado)

**Plan metadata:** (pendente - commit de documentação a seguir)

## Files Created/Modified
- `src/app/(app)/app-sidebar.tsx` - SidebarHeader agora renderiza `<Image src="/logo-branco.png" .../>` (h-8, w-auto) dentro de um container `bg-neutral-900 rounded-md px-2 py-1.5`, escondido em modo colapsado; `Image` importado de `next/image`; `Building2` mantido para o item de menu "Empresas"; bloco de texto "Agenda Fiscal" removido, subtítulo "Visão geral" preservado para `isDono`
- `src/app/login/login-form.tsx` - CardHeader agora renderiza a logo (`h-12 w-auto`, `priority`) centralizada dentro de `bg-neutral-900 rounded-md px-4 py-3`; `CardTitle` removido do JSX e do import; `CardDescription` preservada e centralizada (`text-center`); `Image` importado de `next/image`; formulário, validação e onSubmit intactos

## Decisions Made
- Removido o texto "Agenda Fiscal" do SidebarHeader e o `CardTitle` do login, pois a logo (169:64, branca) já comunica o branding de forma mais forte que o texto duplicado ao lado/abaixo dela
- Subtítulo "Visão geral" (exibido apenas para `isDono`) foi preservado no SidebarHeader, agora ao lado da logo, mantendo a informação de contexto para o dono
- Container `bg-neutral-900` escolhido (em vez de `bg-primary`/`bg-sidebar`) por ser uma cor fixa que não muda entre os temas light/dark, evitando que a logo branca fique invisível
- No modo `collapsible=icon`, o wrapper completo da logo recebe `group-data-[collapsible=icon]:hidden` (a logo 169:64 é larga demais para caber no estado ícone da sidebar)

## Deviations from Plan

None - plan executed exactly as written. Todas as decisões "do executor" mencionadas no PLAN.md (remover textos, esconder a logo no modo colapsado, manter Building2 e CardDescription) foram tomadas conforme as opções já antecipadas no próprio plano.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. O arquivo `public/logo-branco.png` já existia no repositório antes da execução.

## Next Phase Readiness
- Branding visual da Agenda Fiscal está consistente entre sidebar e tela de login
- Nenhum bloqueio identificado para próximas fases

---
*Phase: quick*
*Completed: 2026-06-15*

## Self-Check: PASSED

- FOUND: src/app/(app)/app-sidebar.tsx
- FOUND: src/app/login/login-form.tsx
- FOUND: .planning/quick/260615-jyn-adicionar-logo-marca/260615-jyn-SUMMARY.md
- FOUND: commit 8cc35e6
- FOUND: commit 1554cc1
