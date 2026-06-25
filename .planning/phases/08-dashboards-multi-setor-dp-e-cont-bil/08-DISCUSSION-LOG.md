# Phase 8: Dashboards Multi-Setor — DP e Contábil - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 8-Dashboards Multi-Setor — DP e Contábil
**Areas discussed:** Navegação, Universo de empresas no DP, Estado vazio por setor

---

## Navegação

| Option | Description | Selected |
|--------|-------------|----------|
| Abas na mesma página /dashboards | Uma aba por setor (Fiscal/DP/Contábil) dentro da mesma rota. Menos itens na sidebar, reforça visualmente que são 3 visões separadas do mesmo conceito | ✓ |
| 3 itens separados na sidebar | "Dashboards Fiscal", "Dashboards DP", "Dashboards Contábil" como entradas distintas. Mais cliques, mas URL direta por setor | |

**User's choice:** Abas na mesma página /dashboards (recomendado)
**Notes:** Nenhuma observação adicional.

---

## Universo de empresas no DP

| Option | Description | Selected |
|--------|-------------|----------|
| Só empresas com CLT=sim | Empresas sem funcionários CLT nunca geram tarefa de DP — incluí-las só popularia o ranking/desempenho com 0% irrelevante | ✓ |
| Todas as 197 aparecem | Mantém o universo igual ao Fiscal, mesmo que a maioria fique zerada/sem dado no DP | |

**User's choice:** Só empresas com CLT=sim (recomendado)
**Notes:** Contábil continua com todas as 197 — corolário de CONT-01 (Phase 7), que já define escrituração mensal para todas as empresas independente de CLT. Não foi uma pergunta separada, mas decorre diretamente da resposta dada aqui.

---

## Estado vazio por setor

| Option | Description | Selected |
|--------|-------------|----------|
| Mensagem mencionando o setor | Ex: "Ainda não há dados suficientes de DP. Os dashboards são alimentados pelas tarefas de DP concluídas a cada mês." | ✓ |
| Mesma mensagem genérica do Fiscal | Reusa o texto exato que já existe, sem mencionar o setor | |

**User's choice:** Mensagem mencionando o setor (recomendado)
**Notes:** Nenhuma observação adicional.

---

## Claude's Discretion

- Estrutura exata de componentes (extração de helpers, nomes de arquivo por setor, parametrização do módulo de queries por string literal vs enum Prisma) — decisão de implementação, não discutida.
- Qual join exato usar para inferir o setor de uma `Tarefa` (via `tipoObrigacao` e/ou `responsavel.setor`, já que `Tarefa` não tem coluna `setor` própria) — fica para pesquisa/planejamento confirmar.

## Deferred Ideas

- Renomear os placeholders DP1-4/Contabil1-3 para nomes reais (mesmo padrão do quick-task 260615-mt3 que renomeou os colaboradores Fiscais) — é um quick-task de gestão de usuários, não uma decisão de implementação desta fase. Os gráficos exibirão `Usuario.nome` como está no banco hoje.
