# Phase 2: Gestão de Tarefas — Avulsas, Detalhe e Alertas - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Interface completa de tarefas avulsas (não-recorrentes): criação via modal, lista global `/tarefas` com alertas visuais de prazo, tela de detalhe com dados da empresa vinculada, e checkbox de conclusão com registro de quem concluiu. Totalmente usável sem o motor de geração automática da Fase 3.

**In scope:** criar/editar/concluir tarefas avulsas; lista `/tarefas` com ordenação e filtro de status; tela de detalhe `/tarefas/[id]`; alertas visuais (badge + emoji) na lista; contador de pendentes na sidebar; schema Prisma Tarefa + TarefaHistorico.

**Out of scope (Fase 3):** geração automática mensal; enum de tipo de obrigação (ICMS/DAS/etc.); prazos calculados por dia útil/feriado; histórico cross-task "obrigação X da empresa Y ao longo dos meses"; notificações por email/WhatsApp (v2).

</domain>

<decisions>
## Implementation Decisions

### Modelo de Tarefa (Schema Prisma)

- **D-01:** Toda tarefa avulsa tem `empresaId` obrigatório (nunca null). Não existe tarefa "geral" sem empresa vinculada.
- **D-02:** Fase 2 não tem enum de tipo de obrigação. O campo é título livre (`titulo: String`) + descrição opcional (`descricao: String?`). Tipo/enum de obrigação virá na Fase 3 quando o motor de geração precisar distinguir ICMS, DAS, etc.
- **D-03:** Prazo (`prazo: DateTime`) é obrigatório em toda tarefa. Sem prazo = sem alerta, sem ordenação correta — incompatível com o propósito do sistema.
- **D-04:** Conclusão registra apenas `concluidoPorId` + `concluidoEm` (sem campo de observação). Gravado em modelo separado `TarefaHistorico` para extensibilidade na Fase 3.
- **D-05:** Status da tarefa: enum `TarefaStatus { PENDENTE, CONCLUIDA }`. Default `PENDENTE`.

**Schema Prisma proposto (adicionar ao schema.prisma):**
```prisma
enum TarefaStatus {
  PENDENTE
  CONCLUIDA
}

model Tarefa {
  id            String       @id @default(cuid())
  titulo        String
  descricao     String?
  empresaId     String
  empresa       Empresa      @relation(fields: [empresaId], references: [id])
  responsavelId String
  responsavel   Usuario      @relation("ResponsavelTarefa", fields: [responsavelId], references: [id])
  prazo         DateTime
  status        TarefaStatus @default(PENDENTE)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  historico     TarefaHistorico[]

  @@index([responsavelId])
  @@index([empresaId])
  @@index([prazo])
  @@index([status])
  @@map("tarefas")
}

model TarefaHistorico {
  id             String   @id @default(cuid())
  tarefaId       String
  tarefa         Tarefa   @relation(fields: [tarefaId], references: [id], onDelete: Cascade)
  concluidoPorId String
  concluidoPor   Usuario  @relation("ConcluiuTarefa", fields: [concluidoPorId], references: [id])
  concluidoEm    DateTime @default(now())

  @@index([tarefaId])
  @@map("tarefa_historico")
}
```

`Usuario` também precisa das relações inversas: `tarefasResponsavel Tarefa[] @relation("ResponsavelTarefa")` e `tarefasConcluidas TarefaHistorico[] @relation("ConcluiuTarefa")`.

### Alertas de Prazo

- **D-06:** Limiar "prazo próximo" = 3 dias antes do prazo (`prazo <= now + 3 days`). Atrasada = `prazo < now` + status PENDENTE.
- **D-07:** Visual na lista: emoji (🟡 próximo, 🔴 atrasada) + Badge colorido na coluna de prazo + texto do prazo em cor (verde/amarelo/vermelho). Tarefas concluídas não participam do sistema de alertas.
- **D-08:** Tarefas concluídas ficam ocultas por padrão na lista. Filtro "Mostrar concluídas" para exibir.
- **D-09:** Contador de pendentes (próximas + atrasadas) aparece também na sidebar — badge numérico no item "Tarefas" do menu lateral.

### Layout e Navegação

- **D-10:** Página global `/tarefas` (item no menu da sidebar). Não há aba de tarefas dentro de `/empresas/[id]` na Fase 2.
- **D-11:** Ordenação padrão = `prazo ASC` (mais urgente no topo). Usuário pode reordenar clicando nas colunas de cabeçalho (TanStack Table sorting nativo).
- **D-12:** Tela de detalhe `/tarefas/[id]` exibe: título, descrição, prazo com badge de status, responsável + card com dados da empresa (nome, CNPJ, regime tributário, responsável da empresa). Histórico cross-task é Fase 3.
- **D-13:** Formulário de criação de tarefa abre como `Dialog` modal na própria página `/tarefas` (mesmo padrão do shadcn Dialog já instalado). Não há `/tarefas/nova` como página separada.

### Visibilidade das Tarefas (RBAC)

- **D-14:** `withTarefaScope(user)` segue o mesmo padrão de `withVisibilityScope` de empresas: DONO vê todas (`{}`), COLABORADOR vê apenas tarefas onde `responsavelId === user.id`. Um colaborador que cria uma tarefa e a atribui a outro colaborador não a vê na sua lista — segue a regra "as suas" do ROADMAP.
- **D-15:** Qualquer usuário autenticado pode atribuir uma tarefa avulsa a qualquer responsável (COLABORADOR ou DONO) — sem restrição na atribuição, só na visibilidade da lista.

### Claude's Discretion

- Estrutura de arquivos para tarefas: replicar padrão de empresas — `modules/tarefas/queries.ts`, `modules/tarefas/schema.ts`, `app/(app)/tarefas/actions.ts`.
- Contador da sidebar pode ser um Server Component separado que faz a query, para não adicionar estado global de client-side.
- Campo de data no formulário: usar `<input type="date">` com shadcn Input (sem date-picker complexo — mantém simplicidade).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos desta fase
- `.planning/REQUIREMENTS.md` — TASK-03, TASK-04, TASK-05, TASK-06, ALRT-01 (requisitos da Fase 2)
- `.planning/ROADMAP.md` §Phase 2 — Goal, Success Criteria e Requirements mapeados

### Padrões estabelecidos na Fase 1 (reutilizar)
- `src/lib/visibility-scope.ts` — Padrão withVisibilityScope; criar withTarefaScope análogo
- `src/modules/empresas/queries.ts` — Padrão de queries escopadas com `EMPRESA_SELECT`; replicar para `modules/tarefas/queries.ts`
- `src/app/(app)/actions.ts` — Padrão Server Actions: guard de sessão, Zod parse, retorno `{ ok: true | false, error? }`, `revalidatePath`
- `src/modules/empresas/schema.ts` — Padrão de schema Zod para validação de formulário; criar `modules/tarefas/schema.ts` análogo
- `prisma/schema.prisma` — Schema atual (adicionar Tarefa + TarefaHistorico + enums)

### UI e componentes instalados (reutilizar)
- `src/components/ui/` — Badge, Checkbox, Card, Table, Dialog, Tabs, Skeleton disponíveis
- `src/app/(app)/app-sidebar.tsx` — Sidebar existente onde adicionar item "Tarefas" com badge de contador
- `src/app/(app)/empresas/empresas-table.tsx` — Padrão TanStack Table com paginação e ordenação

### Decisões de arquitetura da Fase 1
- `.planning/phases/01-funda-o-acesso-empresas-e-importa-o/01-02-PLAN.md` — RBAC JWT/session (role COLABORADOR/DONO maiúsculas)
- `.planning/STATE.md` §Decisions — Decisões chave Phase 01 (IDOR, Server Actions, notFound())

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `withVisibilityScope(user)` em `src/lib/visibility-scope.ts` → criar `withTarefaScope(user)` análogo retornando `{ responsavelId: user.id }` para COLABORADOR e `{}` para DONO, mas com `Prisma.TarefaWhereInput`
- `Badge` (`src/components/ui/badge.tsx`) → usado para status (PENDENTE/CONCLUIDA) e alertas de prazo
- `Checkbox` (`src/components/ui/checkbox.tsx`) → checkbox de conclusão de tarefa na lista
- `Dialog` (`src/components/ui/dialog.tsx`) → modal de criação de tarefa
- `TanStack Table` (usado em `empresas-table.tsx`) → reutilizar padrão para `tarefas-table.tsx` com sorting por prazo

### Established Patterns
- **Server Actions guard:** toda action começa com `const session = await auth(); if (!session?.user) return { ok: false, error: "Não autenticado" };`
- **Anti-IDOR:** mutações (editar/concluir/deletar tarefa) fazem `findFirst` escopado ANTES de qualquer write — nunca `findUnique` sem escopo
- **Zod parse antes de qualquer write:** `schema.safeParse(...)`, se falhar retorna `{ ok: false, error: "..." }`
- **revalidatePath:** toda action bem-sucedida chama `revalidatePath("/tarefas")` e possivelmente `revalidatePath("/tarefas/[id]")`
- **EMPRESA_SELECT sem senhaHash:** queries de tarefa que incluírem dados da empresa devem usar `select` explícito, nunca `include` que vaze `senhaHash`

### Integration Points
- `app/(app)/layout.tsx` → Sidebar recebe o badge de contador de tarefas pendentes/atrasadas
- `prisma/schema.prisma` → adicionar `Tarefa`, `TarefaHistorico`, `TarefaStatus` enum, e relações inversas em `Usuario` e `Empresa`
- `src/app/(app)/empresas/` → padrão de estrutura de rotas a replicar em `src/app/(app)/tarefas/`

</code_context>

<specifics>
## Specific Ideas

- Alerta visual: emoji (🟡 para prazo próximo ≤3 dias, 🔴 para atrasada) ao lado do Badge colorido na coluna de prazo — escolha explícita do usuário (combinação de emoji + badge)
- Ordenação padrão ao entrar na página: prazo ascendente. O usuário pode reordenar clicando nos cabeçalhos de coluna (TanStack Table sorting).
- Sidebar: badge numérico no item "Tarefas" mostrando total de tarefas pendentes que estão próximas ou atrasadas do usuário logado.

</specifics>

<deferred>
## Deferred Ideas

- **Passo a passo estruturado (TASK-05/TASK-06):** TASK-05 menciona "passo a passo da obrigação (quando aplicável)" e TASK-06 menciona "referência às ferramentas Python de ICMS/PIS-COFINS". Para Fase 2 (tarefas avulsas com título livre), não há passo a passo automático por tipo de obrigação. O campo `descricao` serve como instrução livre. O passo a passo estruturado por tipo de obrigação e a referência às ferramentas Python serão implementados na Fase 3, quando o motor de geração automática criar tarefas com `tipo` de obrigação definido.
- **Histórico cross-task:** "histórico de conclusões anteriores dessa empresa/obrigação" (TASK-05) faz sentido quando a Fase 3 gerar a mesma obrigação mês a mês. Para Fase 2, a tela de detalhe mostra apenas os dados da empresa — o histórico de obrigações recorrentes fica para Fase 3.
- **Notificações externas (NOTF-01):** notificações por email/WhatsApp são v2 — fora do escopo do v1.

</deferred>

---

*Phase: 2-Gestão de Tarefas — Avulsas, Detalhe e Alertas*
*Context gathered: 2026-06-17*
