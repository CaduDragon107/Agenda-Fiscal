# Phase 2: Gestão de Tarefas — Avulsas, Detalhe e Alertas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 2-Gestão de Tarefas — Avulsas, Detalhe e Alertas
**Areas discussed:** Modelo de Tarefa, Alertas de prazo, Layout e navegação

---

## Modelo de Tarefa

| Pergunta | Opções | Selecionada |
|----------|--------|-------------|
| Empresa obrigatória ou opcional? | Sempre vinculada / Empresa opcional | ✓ Sempre vinculada |
| Tipo de obrigação na Fase 2? | Título livre / Enum (ICMS, DAS, etc.) | ✓ Título livre |
| Prazo obrigatório? | Obrigatório / Opcional | ✓ Obrigatório |
| O que registrar ao concluir? | Data + usuário / Data + usuário + observação | ✓ Data + usuário |

**Notas:** Usuário confirma que tarefas avulsas na Fase 2 são simples — título livre, empresa obrigatória, prazo obrigatório. Tipo de obrigação (ICMS/DAS) entra na Fase 3 com o motor automático.

---

## Alertas de Prazo

| Pergunta | Opções | Selecionada |
|----------|--------|-------------|
| Limiar "prazo próximo"? | 3 dias / 5 dias / 7 dias | ✓ 3 dias |
| Visual do alerta? | Badge colorido / Fundo da linha / Só emoji | ✓ Emoji + badge (resposta livre: "usar emoji e também badge") |
| Tarefas concluídas visíveis? | Ocultas por padrão + filtro / Todas visíveis | ✓ Ocultas por padrão + filtro |
| Alertas onde? | Só na lista / Na sidebar também | ✓ Na sidebar também (contador de pendentes) |

**Notas:** Usuário quer combinação emoji + badge — não uma coisa ou outra. 🟡 para próximo (≤3 dias), 🔴 para atrasado. Sidebar deve mostrar badge numérico com total de tarefas urgentes/atrasadas do usuário logado.

---

## Layout e Navegação

| Pergunta | Opções | Selecionada |
|----------|--------|-------------|
| Localização da lista? | Página global /tarefas / Dentro de empresa / Ambas | ✓ Página global /tarefas |
| Ordenação padrão? | Por prazo / Por empresa depois prazo / Por criação | ✓ Por prazo (+ escolha do usuário — resposta livre) |
| O que aparece no detalhe? | Dados da empresa / Histórico de conclusões / Botão concluir / Passo a passo | ✓ Dados da empresa |
| Formulário de criação? | Modal/Dialog / Página separada | ✓ Modal/Dialog |

**Notas:** Ordenação — usuário disse "o usuario pode escolher a melhor forma, mas quando entrar na pagina ficar por prazo e prioridade". Interpretado como: padrão = prazo ASC (mais urgente no topo), com sorting interativo por colunas (TanStack Table). Detalhe: usuário selecionou apenas "dados da empresa" — histórico cross-task e passo a passo foram deferidos para Fase 3.

---

## Claude's Discretion

- Estrutura de arquivos de tarefas: `modules/tarefas/queries.ts`, `modules/tarefas/schema.ts`, `app/(app)/tarefas/actions.ts`
- Contador da sidebar implementado como Server Component para evitar estado global client-side
- Campo de data no formulário: `<input type="date">` com shadcn Input (sem date-picker complexo)

## Deferred Ideas

- Passo a passo estruturado por tipo de obrigação (TASK-06) → Fase 3
- Histórico cross-task de obrigações recorrentes (TASK-05 full) → Fase 3
- Notificações por email/WhatsApp (NOTF-01) → v2
