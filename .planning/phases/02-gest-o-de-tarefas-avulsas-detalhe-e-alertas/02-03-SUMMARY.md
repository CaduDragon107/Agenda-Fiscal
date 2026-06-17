---
phase: 02-gest-o-de-tarefas-avulsas-detalhe-e-alertas
plan: "03"
subsystem: ui-pagina-tarefas-lista-dialog-sidebar
tags: [tanstack-table, react-hook-form, zod, shadcn, server-component, rbac, sidebar-badge, sorting, date-fns]
dependency_graph:
  requires:
    - "02-01 (schema Prisma Tarefa+TarefaHistorico, calcularAlertaPrazo, withTarefaScope)"
    - "02-02 (queries listarTarefas/contarAlertasTarefas, actions criarTarefa/concluirTarefa/excluirTarefa)"
  provides:
    - "pagina /tarefas funcional com lista, filtros, sorting e checkbox de conclusao"
    - "Dialog Nova tarefa com React Hook Form + Zod + Server Action"
    - "sidebar item Tarefas ativo com badge numerico de alertas"
    - "contarAlertasTarefas integrado ao AppLayout e exibido na sidebar"
  affects:
    - "src/app/(app)/layout.tsx (modificado)"
    - "src/app/(app)/app-sidebar.tsx (modificado)"
    - "src/app/(app)/tarefas/page.tsx (criado)"
    - "src/app/(app)/tarefas/tarefas-table.tsx (criado)"
    - "src/app/(app)/tarefas/nova-tarefa-dialog.tsx (criado)"
tech_stack:
  added: []
  patterns:
    - "novaTarefaFormSchema sem .transform() no cliente — transform fica exclusivamente no tarefaSchema server-side (RESEARCH.md Pattern 8)"
    - "getSortedRowModel() + state.sorting controlado — sorting prazo ASC como default inicial"
    - "userId prop passado do Server Component para TarefasTable — defense in depth para T-02-IDOR-UI"
    - "dadosFiltrados via useMemo — filtros de concluidas/responsavel/busca aplicados client-side sobre dataset completo do servidor"
    - "pendingIds Set<string> para desabilitar checkbox durante transicao (startTransition)"
key_files:
  created:
    - path: "src/app/(app)/tarefas/page.tsx"
      description: "Server Component — auth guard, Promise.all para tarefas+responsaveis+empresas, render TarefasTable+NovaTarefaDialog com userId da sessao"
    - path: "src/app/(app)/tarefas/tarefas-table.tsx"
      description: "Client Component — TanStack Table com getSortedRowModel, filtros (busca/mostrarConcluidas/responsavel), checkbox com pendingIds, PrazoCell com calcularAlertaPrazo, AlertDialog exclusao"
    - path: "src/app/(app)/tarefas/nova-tarefa-dialog.tsx"
      description: "Client Component — Dialog controlado, RHF + Zod (schema sem transform), criarTarefa via FormData, toast sucesso/erro"
  modified:
    - path: "src/app/(app)/layout.tsx"
      description: "importa contarAlertasTarefas e passa contadorAlertas para AppSidebar"
    - path: "src/app/(app)/app-sidebar.tsx"
      description: "AppSidebarProps com contadorAlertas: number; item Tarefas substituido por Link ativo com badge vermelho"
decisions:
  - "novaTarefaFormSchema sem .transform() no RHF — transform de string->Date fica exclusivamente na action server-side (RESEARCH.md Pattern 8)"
  - "userId passado como prop para TarefasTable para defense in depth do botao Excluir (T-02-IDOR-UI)"
  - "dadosFiltrados filtra sobre dataset completo do servidor — nao adicionar status PENDENTE no findMany (RESEARCH.md Pitfall 6)"
  - "pendingIds: Set<string> para rastrear checkboxes em transicao — consistente com padrao useState+startTransition da Fase 1"
metrics:
  duration: "5 min"
  completed: "2026-06-17"
  tasks_completed: 2
  files_changed: 5
---

# Phase 02 Plan 03: UI Pagina Tarefas — Lista, Dialog e Badge Sidebar — Summary

**One-liner:** pagina /tarefas completa com TanStack Table (sorting prazo ASC, filtros client-side, checkbox de conclusao, badge de alerta por calcularAlertaPrazo), Dialog Nova Tarefa com RHF+Zod, e sidebar com item Tarefas ativo e badge numerico de alertas — build verde, 59/59 testes passando.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Layout + Sidebar — ativar item Tarefas com badge de alertas | `3556d16` | `src/app/(app)/layout.tsx`, `src/app/(app)/app-sidebar.tsx` |
| 2 | /tarefas page.tsx + TarefasTable + NovaTarefaDialog | `0a55076` | `src/app/(app)/tarefas/page.tsx`, `src/app/(app)/tarefas/tarefas-table.tsx`, `src/app/(app)/tarefas/nova-tarefa-dialog.tsx` |

## Verification Results

```
npx tsc --noEmit
  -> sem erros TypeScript (Task 1 e Task 2)

npx next build
  -> build completo sem erros
  -> rota /tarefas: 12.3 kB | 213 kB first load JS

npx vitest run
  -> 59 passed (13 files) — zero falhas, zero skipped
```

## Deviations from Plan

### Auto-added Missing Critical Functionality

**1. [Rule 2 - Security] userId prop adicionado ao TarefasTable**
- **Found during:** Task 2 — implementacao da coluna "acoes"
- **Issue:** O plano especificava `row.original.responsavel.id === user.id` para controle de visibilidade do botao Excluir, mas `user.id` nao estava disponivel no componente Client. Sem isso, a logica de defense in depth (T-02-IDOR-UI) ficaria sem efeito.
- **Fix:** Adicionado `userId?: string` as props de `TarefasTable` e passado `userId={session.user.id}` do Server Component `page.tsx`. A verificacao agora e `isDono || (userId != null && row.original.responsavelId === userId)`.
- **Files modified:** `src/app/(app)/tarefas/tarefas-table.tsx`, `src/app/(app)/tarefas/page.tsx`
- **Commit:** `0a55076`

## Known Stubs

Nenhum stub. Todos os campos exibem dados reais vindos do banco via `listarTarefas`, `listarEmpresas`, `listarResponsaveis`. Os textos de "placeholder" nos inputs sao atributos HTML visuais (dicas de preenchimento), nao stubs de dados.

## Threat Flags

Nenhuma superficie nova alem do planejado. As migracoes T-02-IDOR-UI, T-02-CLIENT-FILTER, T-02-UNAUTH e T-02-OPEN-REDIRECT documentadas no threat_model do plano foram implementadas:

- T-02-IDOR-UI: botao Excluir oculto client-side para COLABORADOR em tarefas alheias (userId prop); barreira real e o anti-IDOR server-side em excluirTarefa
- T-02-CLIENT-FILTER: dadosFiltrados filtra apenas o dataset retornado por listarTarefas(session.user), ja escopado server-side
- T-02-UNAUTH: `const session = await auth(); if (!session?.user) redirect("/login")` como primeira instrucao do page.tsx
- T-02-OPEN-REDIRECT: links para /tarefas/${id} gerados com ids vindos do banco (cuid), nao de input do usuario

## Self-Check: PASSED

- [x] `src/app/(app)/layout.tsx` importa `contarAlertasTarefas` e passa `contadorAlertas` para AppSidebar
- [x] `src/app/(app)/app-sidebar.tsx` aceita `contadorAlertas: number` via AppSidebarProps; item Tarefas e Link ativo com badge
- [x] `src/app/(app)/tarefas/page.tsx` existe — Server Component com auth guard e Promise.all
- [x] `src/app/(app)/tarefas/tarefas-table.tsx` existe — TanStack Table com getSortedRowModel + sorting prazo ASC
- [x] `src/app/(app)/tarefas/nova-tarefa-dialog.tsx` existe — Dialog + RHF + novaTarefaFormSchema sem transform
- [x] `npx tsc --noEmit` — sem erros TypeScript
- [x] `npx next build` — build completo, rota /tarefas listada
- [x] `npx vitest run` — 59/59 testes passando
- [x] Commits `3556d16` e `0a55076` verificados via git log
