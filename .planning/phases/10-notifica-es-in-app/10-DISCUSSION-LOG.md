# Phase 10: Notificações In-App - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 10-Notificações In-App
**Areas discussed:** Modelo de dados, Interação do sino, Relação com a sidebar, Janela da notificação de avulsa, Mecânica de geração, Comportamento de "lida"

---

## Modelo de dados (live vs persistido)

| Option | Description | Selected |
|--------|-------------|----------|
| Live, sem persistência | Mesmo padrão do badge já existente na sidebar (`contarAlertasTarefas`): recalcula a cada carregamento, sem tabela nova, sem "lida" | |
| Persistido com lida/não-lida | Tabela `Notificacao` nova no banco, marca como lida ao abrir/clicar, permite histórico | ✓ |

**User's choice:** Persistido com lida/não-lida.
**Notes:** Mais trabalho que a alternativa live, mas o usuário priorizou ter o conceito de "já vi isso".

---

## Interação do sino

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown com lista | Painel inline no header listando as tarefas que geraram notificação, cada item linkando para a tarefa | ✓ |
| Vai direto para /tarefas filtrado | Sino só mostra contagem; clicar navega para a lista de tarefas filtrada | |

**User's choice:** Dropdown com lista.

---

## Relação com a badge existente na sidebar

| Option | Description | Selected |
|--------|-------------|----------|
| Sino substitui a badge da sidebar | Remove o badge atual de "Tarefas" na sidebar, centraliza contagem no sino do header | ✓ |
| Mantém as duas, critérios diferentes | Sidebar continua mostrando só vencendo+atrasada; sino soma também avulsa atribuída | |

**User's choice:** Sino substitui a badge da sidebar.
**Notes:** Evita dois números diferentes em lugares diferentes para o mesmo conceito de "alerta".

---

## Janela da notificação de tarefa avulsa atribuída

| Option | Description | Selected |
|--------|-------------|----------|
| Enquanto estiver PENDENTE | Notificação de atribuição permanece visível até a tarefa ser concluída, sem importar há quanto tempo foi criada | ✓ |
| Só por alguns dias após ser atribuída | Notificação "expira" depois de N dias mesmo que a tarefa continue pendente | |

**User's choice:** Enquanto estiver PENDENTE.

---

## Mecânica de geração das notificações de prazo

| Option | Description | Selected |
|--------|-------------|----------|
| Sincroniza sob demanda | Sem cron novo; a cada carregamento de página, sincroniza notificações com os critérios atuais | ✓ |
| Cron diário novo | Job `node-cron` diário que varre tarefas e gera notificações proativamente | |

**User's choice:** Sincroniza sob demanda.
**Notes:** Evita adicionar infraestrutura agendada nova além do cron mensal já existente (`src/lib/scheduler.ts`).

---

## Comportamento de "lida" para notificações de prazo

| Option | Description | Selected |
|--------|-------------|----------|
| Some definitivamente até mudar de status | Notificação lida não reaparece, a não ser que a tarefa mude de patamar (vencendo → atrasada) | ✓ |
| Reaparece enquanto o problema existir | "Lida" só controla o badge de contagem, mas a tarefa nunca desaparece da lista enquanto pendente | |

**User's choice:** Some definitivamente até mudar de status.

---

## Claude's Discretion

- Nome exato da tabela/model Prisma e nomenclatura de campos.
- Onde exatamente a sincronização sob demanda é disparada (layout.tsx, page.tsx, ou Server Action ao montar o sino).
- Limite de itens exibidos no dropdown (paginação/"ver tudo") se o volume crescer.
- Comportamento de CHEFE_SETOR — não discutido explicitamente; segue `withTarefaScope` existente sem tratamento especial.
- Ícone/visual exato do sino (provavelmente `lucide-react`, já em uso no projeto).

## Deferred Ideas

None — discussão ficou inteiramente dentro do escopo de NOTF-01 a NOTF-04. NOTF-05 (email/WhatsApp) já estava fora de escopo no REQUIREMENTS.md, não foi reaberto.
