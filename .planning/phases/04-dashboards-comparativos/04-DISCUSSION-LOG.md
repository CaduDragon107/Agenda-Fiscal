# Phase 4: Dashboards Comparativos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 4-Dashboards Comparativos
**Areas discussed:** Métricas de desempenho por colaborador, Congelamento de meses fechados, Ranking de empresas problemáticas

---

## Critério de "no prazo" por tarefa

| Option | Description | Selected |
|--------|-------------|----------|
| Data de conclusão ≤ prazo (já ajustado p/ dia útil) | Compara `concluidoEm` com `prazo` já calculado pelo motor de geração | ✓ |
| Considerar apenas tarefas concluídas | Só entram no cálculo tarefas com status CONCLUIDA | ✓ |

**User's choice:** Ambas as opções foram selecionadas em conjunto — concluído vs prazo, apenas tarefas já concluídas entram no denominador.
**Notes:** Tarefas pendentes (mesmo vencidas) ficam fora do dashboard de desempenho por colaborador até serem concluídas.

---

## Normalização entre colaboradores

| Option | Description | Selected |
|--------|-------------|----------|
| Percentual no prazo (Recomendado) | % no prazo + volume absoluto como contexto secundário | ✓ |
| Só percentual, sem mostrar volume | Apenas % sem contexto de carteira | |

**User's choice:** Percentual no prazo, com volume absoluto exibido como contexto.

---

## Congelamento de meses fechados

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot automático no dia 1 do mês seguinte (Recomendado) | Acoplado ao cron de geração mensal já existente | ✓ |
| Snapshot manual disparado pelo dono | Botão "Fechar mês" | |

**User's choice:** Snapshot automático, acoplado ao mesmo cron/instrumentation.ts da Fase 3.

---

## Ranking de empresas problemáticas

| Option | Description | Selected |
|--------|-------------|----------|
| % de tarefas atrasadas sobre total da empresa (Recomendado) | Normalizado, comparável entre empresas de cargas diferentes | ✓ |
| Contagem absoluta de tarefas atrasadas | Ranking bruto sem normalização | |

**User's choice:** Percentual de atraso por empresa.

---

## Claude's Discretion

- Definição exata de "atrasada" para tarefas PENDENTE com prazo vencido no DASH-03 (atrasada a partir de `prazo < now()`).
- Período padrão de exibição e estrutura de navegação dos 3 dashboards (página única vs separadas vs tabs).

## Deferred Ideas

Nenhuma — discussão permaneceu dentro do escopo da fase (3 dashboards somente leitura).
