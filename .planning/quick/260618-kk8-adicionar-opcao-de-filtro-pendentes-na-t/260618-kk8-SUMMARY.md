---
phase: quick-260618-kk8
plan: 01
subsystem: ui
tags: [react, shadcn-select, tarefas, filtro, useMemo]

# Dependency graph
requires:
  - phase: 02-gestao-de-tarefas
    provides: tela de Tarefas (tarefas-table.tsx) com filtro client-side por responsavel/busca e checkbox "Mostrar concluidas"
provides:
  - Select de status (Pendentes/Concluidas/Todas) substituindo o checkbox binario "Mostrar concluidas" na tela de Tarefas
affects: [tarefas, dashboards-comparativos]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Filtro de status de 3 estados (PENDENTE/CONCLUIDA/TODOS) reusando o componente shadcn Select ja usado no filtro de responsavel"

key-files:
  created: []
  modified:
    - "src/app/(app)/tarefas/tarefas-table.tsx"

key-decisions:
  - "Default do Select de status e 'PENDENTE', preservando o comportamento anterior (esconder concluidas por padrao) e atendendo diretamente ao pedido de um filtro 'Pendentes' explicito"
  - "Checkbox da coluna 'concluir' (tabela) mantido intacto -- apenas o checkbox da toolbar foi removido, pois tem proposito diferente (concluir tarefa vs filtrar lista)"

patterns-established:
  - "Filtro de status de tarefas como Select de 3 valores (PENDENTE/CONCLUIDA/TODOS) ao inves de checkbox binario, quando a UI precisar expressar 'apenas estado X' como intencao primaria do usuario"

requirements-completed: [QUICK-260618-kk8]

# Metrics
duration: 10min
completed: 2026-06-18
---

# Quick Task 260618-kk8: Filtro de Status "Pendentes" na Tela de Tarefas Summary

**Checkbox binario "Mostrar concluidas" substituido por Select de status com tres opcoes (Pendentes/Concluidas/Todas), default "Pendentes", reusando o useMemo de filtro client-side existente**

## Performance

- **Duration:** 10 min
- **Tasks:** 1 (mais checkpoint de verificacao humana)
- **Files modified:** 1

## Accomplishments
- Estado `statusFiltro` (`"PENDENTE" | "CONCLUIDA" | "TODOS"`) substitui o booleano `mostrarConcluidas`, com default `"PENDENTE"`
- `useMemo` `dadosFiltrados` agora filtra por `t.status === statusFiltro` quando `statusFiltro !== "TODOS"`, mantendo intactos os filtros de responsavel e busca
- Toolbar troca o `<Checkbox id="mostrar-concluidas">` por um `<Select>` com `SelectItem` "Pendentes"/"Concluidas"/"Todas", no mesmo padrao visual do Select de responsavel ja existente
- Checkbox da coluna "concluir" da tabela permanece sem alteracao (proposito distinto: concluir tarefa, nao filtrar)

## Task Commits

Each task was committed atomically:

1. **Task 1: Substituir checkbox "Mostrar concluidas" por Select de status (Pendentes/Concluidas/Todas)** - `3bbb2e5` (feat)

_Checkpoint `type="checkpoint:human-verify"` auto-aprovado (auto mode ativo); verificacao logica realizada em substituicao a verificacao visual (ver secao abaixo)._

## Files Created/Modified
- `src/app/(app)/tarefas/tarefas-table.tsx` - Estado `statusFiltro` substitui `mostrarConcluidas`; `useMemo` `dadosFiltrados` filtra por status; toolbar usa `Select` de status no lugar do `Checkbox` "Mostrar concluidas"

## Decisions Made
- Default do filtro definido como "PENDENTE" (nao "TODOS"), preservando o comportamento anterior do checkbox (concluidas escondidas por padrao) e atendendo ao pedido explicito de uma opcao "Pendentes"
- Import de `Checkbox` mantido pois ainda e usado na coluna "concluir" da tabela

## Deviations from Plan

None - plan executado exatamente como escrito.

## Issues Encountered

None.

## Verification (in lieu of browser-based human-verify)

O checkpoint `type="checkpoint:human-verify"` foi auto-aprovado (auto mode ativo). Como nao ha acesso a navegador neste ambiente, a logica de filtro foi verificada por leitura de codigo, tracando os 3 estados:

1. **"Pendentes"** (`statusFiltro="PENDENTE"`, default ao carregar a pagina): `dados.filter((t) => t.status === "PENDENTE")` -> somente tarefas PENDENTE aparecem. Correto.
2. **"Concluidas"** (`statusFiltro="CONCLUIDA"`): `dados.filter((t) => t.status === "CONCLUIDA")` -> somente tarefas CONCLUIDA aparecem. Correto.
3. **"Todas"** (`statusFiltro="TODOS"`): condicao `statusFiltro !== "TODOS"` e falsa, nenhum filtro de status aplicado -> pendentes e concluidas aparecem juntas. Correto.

Os filtros de busca (`busca`) e responsavel (`responsavelFiltro`, visivel so para DONO) permanecem encadeados no mesmo `useMemo`, sem alteracao de logica -- apenas a variavel de dependencia foi renomeada de `mostrarConcluidas` para `statusFiltro`.

`npx tsc --noEmit` nao reportou erros em `tarefas-table.tsx`.

**Recomendacao:** confirmacao visual pelo usuario no navegador (`npm run dev` -> `/tarefas`) ainda e recomendada para validar estilo/posicionamento do Select e comportamento real de clique, conforme os passos descritos no `how-to-verify` do plano original.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Tela de Tarefas pronta com filtro de status de 3 estados; nenhum bloqueio para Fase 4 (Dashboards Comparativos)
- Recomenda-se validacao visual rapida pelo usuario na proxima vez que acessar `/tarefas`

---
*Phase: quick-260618-kk8*
*Completed: 2026-06-18*

## Self-Check: PASSED
