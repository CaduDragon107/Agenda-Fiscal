---
phase: 02-gest-o-de-tarefas-avulsas-detalhe-e-alertas
plan: "04"
subsystem: ui-detalhe-tarefa-card-empresa
tags: [server-component, client-component, anti-idor, shadcn, date-fns, skeleton, rbac]
dependency_graph:
  requires:
    - "02-01 (schema Prisma Tarefa+TarefaHistorico, withTarefaScope, calcularAlertaPrazo)"
    - "02-02 (buscarTarefaPorId, concluirTarefa action)"
    - "02-03 (página /tarefas funcional — ícone Eye gera link para /tarefas/[id])"
  provides:
    - "rota /tarefas/[id] completa com detalhe, card empresa e histórico"
    - "ConcluirButton client component com useTransition e toast"
    - "loading.tsx Skeleton no shape dos dois Cards"
  affects:
    - "src/app/(app)/tarefas/[id]/page.tsx (criado)"
    - "src/app/(app)/tarefas/[id]/loading.tsx (criado)"
    - "src/app/(app)/tarefas/[id]/concluir-button.tsx (criado)"
tech_stack:
  added: []
  patterns:
    - "await params — Next.js 15 App Router params é Promise em Server Components de rota dinâmica"
    - "notFound() em vez de 403 para tarefa fora do escopo — anti-IDOR não vaza existência"
    - "ConcluirButton em arquivo separado com 'use client' — impossível misturar server/client no mesmo arquivo"
    - "router.refresh() após concluirTarefa para revalidar Server Component sem navegação"
    - "helpers formatarCnpj / REGIME_LABEL / REGIME_BADGE_CLASS copiados localmente — sem módulo compartilhado (per RESEARCH.md Principal Recommendation)"
key_files:
  created:
    - path: "src/app/(app)/tarefas/[id]/page.tsx"
      description: "Server Component — auth guard, buscarTarefaPorId anti-IDOR, badge de alerta de prazo, dois Cards em grid (Detalhes + Empresa vinculada), botão Marcar como concluída condicional (PENDENTE only), seção Histórico"
    - path: "src/app/(app)/tarefas/[id]/loading.tsx"
      description: "Skeleton de carregamento no shape dos dois Cards (CardHeader + 4 linhas de CardContent cada)"
    - path: "src/app/(app)/tarefas/[id]/concluir-button.tsx"
      description: "Client Component — useTransition para estado de loading, toast.success/error, router.refresh() após conclusão bem-sucedida"
  modified: []
decisions:
  - "await params usado para id — Next.js 15 App Router params é Promise em componentes de rota dinâmica assíncronos"
  - "notFound() (404) em vez de redirect ou resposta 403 quando tarefa fora do escopo do colaborador — anti-IDOR não confirma existência"
  - "ConcluirButton em arquivo separado concluir-button.tsx com 'use client' — Server Component não pode conter diretiva 'use client' no mesmo arquivo"
  - "router.refresh() em vez de redirect para atualizar o Server Component após conclusão — mantém o usuário na mesma página"
  - "descricao exibida com whitespace-pre-wrap para preservar quebras de linha digitadas pelo usuário"
  - "helpers de formatação copiados localmente (sem módulo compartilhado) — evitar over-abstraction per RESEARCH.md"
metrics:
  duration: "8 min"
  completed: "2026-06-17"
  tasks_completed: 1
  files_changed: 3
---

# Phase 02 Plan 04: Página de Detalhe /tarefas/[id] — Summary

**One-liner:** rota /tarefas/[id] como Server Component com buscarTarefaPorId anti-IDOR (notFound em vez de 403), badge de alerta de prazo via calcularAlertaPrazo, dois Cards em grid (Detalhes da tarefa + Empresa vinculada com CNPJ formatado/regime colorido), ConcluirButton Client Component com useTransition e router.refresh, seção Histórico e loading.tsx Skeleton — build verde, 59/59 testes passando.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Página de detalhe /tarefas/[id] (page.tsx + loading.tsx + concluir-button.tsx) | `81a31a0` | `src/app/(app)/tarefas/[id]/page.tsx`, `src/app/(app)/tarefas/[id]/loading.tsx`, `src/app/(app)/tarefas/[id]/concluir-button.tsx` |

## Verification Results

```
npx tsc --noEmit
  -> sem erros TypeScript (incluindo tarefas/[id])

npx vitest run
  -> 59 passed (13 files) — zero falhas, zero skipped
```

## Deviations from Plan

None — plan executed exactly as written. O plano já antecipava o arquivo separado para ConcluirButton e todos os padrões foram seguidos conforme especificado.

## Known Stubs

Nenhum stub. Todos os campos exibem dados reais vindos do banco via `buscarTarefaPorId`:
- `tarefa.titulo`, `tarefa.prazo`, `tarefa.responsavel.nome`, `tarefa.descricao` — dados da tarefa
- `tarefa.empresa.nome`, `tarefa.empresa.cnpj`, `tarefa.empresa.regimeTributario`, `tarefa.empresa.responsavel.nome`, `tarefa.empresa.particularidades` — card empresa (TASK-05)
- `tarefa.historico` — conclusões anteriores com nome do usuário e data

## Threat Flags

Nenhuma superfície nova além do planejado. As mitigações do threat_model foram implementadas:

| Threat ID | Mitigação |
|-----------|-----------|
| T-02-IDOR-DETAIL | `buscarTarefaPorId(session.user, id)` usa findFirst com withTarefaScope — retorna null para tarefa fora do escopo → notFound() (404, não 403) |
| T-02-UNAUTH-DETAIL | `const session = await auth(); if (!session?.user) redirect("/login")` como primeira instrução |
| T-02-IDOR-CONCLUIR | `concluirTarefa` (implementado em 02-02) já tem anti-IDOR via findFirst escopado; defesa está no server, não no botão client |
| T-02-PARAMS | id passado diretamente para findFirst com escopo composto — Prisma usa query parametrizada; id inválido retorna null → notFound() |

## Self-Check: PASSED

- [x] `src/app/(app)/tarefas/[id]/page.tsx` existe — Server Component com auth guard + buscarTarefaPorId + notFound() + badge alerta + dois Cards + ConcluirButton condicional + seção Histórico
- [x] `src/app/(app)/tarefas/[id]/loading.tsx` existe — Skeleton no shape dos dois Cards
- [x] `src/app/(app)/tarefas/[id]/concluir-button.tsx` existe — Client Component com useTransition + toast + router.refresh
- [x] Anti-IDOR: buscarTarefaPorId retorna null para tarefa fora do escopo → notFound() (404)
- [x] Botão Marcar como concluída visível apenas quando `tarefa.status === "PENDENTE"`
- [x] Seção Histórico exibe apenas quando `tarefa.historico.length > 0`
- [x] Link "← Tarefas" aponta para /tarefas
- [x] Botão "Ver empresa" aponta para /empresas/${tarefa.empresa.id}
- [x] `npx tsc --noEmit` — sem erros TypeScript
- [x] `npx vitest run` — 59/59 testes passando
- [x] Commit `81a31a0` verificado
