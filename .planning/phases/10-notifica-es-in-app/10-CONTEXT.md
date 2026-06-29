# Phase 10: Notificações In-App - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Um sino com badge de contagem no header, visível em qualquer página do site, alerta o usuário sobre: (1) tarefas suas vencendo em breve, (2) tarefas suas atrasadas, (3) tarefas avulsas recém-atribuídas a você. Visibilidade segue a mesma regra de `withTarefaScope`/`withVisibilityScope` já estabelecida (COLABORADOR vê só o seu, DONO vê tudo). Esta fase é puramente in-app — notificação por email/WhatsApp é NOTF-05, fora de escopo (v2 backlog).

</domain>

<decisions>
## Implementation Decisions

### Modelo de dados
- **D-01:** Notificações são **persistidas** em uma tabela nova (`Notificacao` ou equivalente), com estado lida/não-lida por usuário — não é um cálculo puramente live como o badge atual da sidebar (`contarAlertasTarefas`). Pesquisador/planner decidem o shape exato (campos, índices), mas a tabela precisa suportar: usuário destinatário, tarefa de origem, tipo de notificação (vencendo/atrasada/avulsa atribuída), estado lida/não-lida, timestamp.
- **D-02:** **Geração sob demanda, sem cron novo.** A cada carregamento de página relevante (ou ao abrir o sino), o sistema sincroniza: verifica as tarefas do usuário contra os critérios atuais (vencendo ≤3 dias, atrasada, avulsa atribuída pendente) e cria os registros de `Notificacao` que ainda não existem para aquela combinação tarefa+tipo+usuário. Não adicionar um job `node-cron` diário — a única infra de cron hoje é o job mensal de geração de tarefas (`src/lib/scheduler.ts`), que não deve ganhar uma responsabilidade não relacionada.
- **D-03:** Idempotência da sincronização: uma notificação não deve ser duplicada para a mesma combinação tarefa+tipo+usuário enquanto ela já existir (lida ou não) — usar constraint única equivalente ao padrão `@@unique` já usado em `Tarefa` (`@@unique([empresaId, tipoObrigacao, competencia])`) para esta nova tabela, adaptado para `(tarefaId, usuarioId, tipo)`.

### Comportamento de "lida"
- **D-04:** Ao marcar uma notificação como lida (clique no item, ou "marcar todas como lidas"), ela **some definitivamente** da lista/badge — não reaparece no dia seguinte mesmo que a tarefa continue no mesmo estado (ex: ainda "vencendo"). Isso evita repetir o mesmo aviso todo dia para o mesmo prazo.
- **D-05:** Excecão à D-04: se a tarefa **mudar de patamar** (ex: estava "vencendo em breve" e passou a "atrasada"), conta como uma notificação NOVA e distinta — sincroniza e aparece novamente, mesmo que a notificação anterior ("vencendo") já tivesse sido lida. Isso decorre naturalmente da constraint `(tarefaId, usuarioId, tipo)` de D-03, já que "vencendo" e "atrasada" são tipos diferentes.
- **D-06:** Notificação de tarefa avulsa atribuída permanece visível **enquanto a tarefa estiver PENDENTE** — sem janela de expiração por tempo (ex: não expira em 3 dias). Some apenas quando lida (D-04) ou quando a tarefa é concluída/cancelada.

### UI — Sino e dropdown
- **D-07:** Sino fica no `<header>` de `src/app/(app)/layout.tsx` (hoje só tem `SidebarTrigger` + `Separator`), visível em qualquer página autenticada.
- **D-08:** Clicar no sino abre um **dropdown inline** (não navega para outra página) listando as notificações não-lidas: título da tarefa, empresa, tipo (vencendo/atrasada/avulsa), prazo — cada item linka para a tarefa (`/tarefas/[id]`).
- **D-09:** Badge de contagem no sino mostra o número de notificações **não-lidas**.

### Relação com a badge existente na sidebar
- **D-10:** O sino do header **substitui** a badge atual no item "Tarefas" da sidebar (`src/app/(app)/app-sidebar.tsx`, prop `contadorAlertas`, função `contarAlertasTarefas` em `src/modules/tarefas/queries.ts`). Remover essa badge e sua prop para evitar dois números diferentes em lugares diferentes (a badge antiga não contava avulsa atribuída, o sino conta os 3 critérios).

### Decisões da pesquisa (confirmadas pelo usuário)
- **D-11:** A sincronização sob demanda sempre gera/atribui notificações para o `responsavelId` real da tarefa, independente de qual usuário disparou o carregamento da página (ex: o DONO navegando não gera notificações "dele" — gera para o responsável de fato).
- **D-12:** O campo `lida` é **global por linha** (uma linha por `tarefaId+usuarioId+tipo`, propriedade da própria notificação daquele destinatário) — não há tabela de leitura por visualizador. Se o DONO abrir o sino e visualizar/marcar como lida uma notificação de um colaborador, isso afeta o badge desse colaborador também (consequência aceita do modelo de dados de D-01/D-03).

### Claude's Discretion
- Nome exato da tabela/model Prisma e nomenclatura dos campos.
- Onde exatamente a sincronização sob demanda é disparada (no `layout.tsx` do app shell, em cada `page.tsx`, ou via Server Action chamada ao montar o componente do sino) — decisão de arquitetura, não de produto.
- Limite de itens exibidos no dropdown (ex: 10 mais recentes com link "ver tudo") se o volume crescer — não foi discutido, mas não deve travar o design caso a lista fique grande.
- Comportamento de CHEFE_SETOR (papel introduzido em quick task 260626-dfc, não mencionado nos critérios de sucesso do ROADMAP) — por consistência com `withTarefaScope`, que já trata CHEFE_SETOR como "vê tudo do próprio setor", o sino deve seguir a mesma função de escopo sem tratamento especial. Não foi um ponto de discussão explícito porque a função de escopo já existe e cobre esse papel automaticamente.
- Ícone/visual exato do sino (lib de ícones já em uso no projeto, provavelmente `lucide-react` dado os ícones já vistos em `app-sidebar.tsx` como `Building2`, `ListChecks`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Modelo de visibilidade (reaproveitado, não rediscutido)
- `src/lib/visibility-scope.ts` — `withTarefaScope(user)`: DONO vê tudo (`{}`), CHEFE_SETOR vê tudo do próprio setor via `tarefaSetorWhere`, COLABORADOR vê só `{ responsavelId: user.id }`. As notificações desta fase DEVEM usar esta mesma função para determinar quais tarefas geram notificação para qual usuário — nunca implementar uma query de visibilidade paralela.

### Critério de alerta já validado (reaproveitar a lógica, não a função em si)
- `src/lib/alert-prazo.ts` — `calcularAlertaPrazo(prazo, status)`: define os limiares já em uso nos alertas visuais existentes (atrasada = prazo < agora; vencendo em breve = prazo ≤ agora+3 dias). NOTF-01/NOTF-02 dizem "mesmo limiar dos alertas visuais já existentes" — usar este mesmo cálculo de 3 dias, não inventar um novo.
- `src/modules/tarefas/queries.ts` (linha 104, `contarAlertasTarefas`) — implementação atual do badge a ser substituído (D-10); mostra o cálculo equivalente em query Prisma (`status: PENDENTE`, `prazo: { lte: agora+3d }`).

### Integração de UI
- `src/app/(app)/layout.tsx` — header onde o sino entra (D-07); hoje só tem `SidebarTrigger` + `Separator`.
- `src/app/(app)/app-sidebar.tsx` (linhas ~48-110) — badge atual a ser removida (D-10).

### Identificação de tarefa avulsa
- Tarefa avulsa = `tipoObrigacao: null` (recorrentes sempre têm `tipoObrigacao` preenchido, ver `prisma/schema.prisma` model `Tarefa`). Não existe campo `assignedAt`/`origemAtribuicao` — `createdAt` da tarefa é o único timestamp disponível para "quando foi atribuída", mas D-06 decidiu não usar janela de tempo, então isso não é necessário para esta fase.

No external specs/ADRs além do ROADMAP.md e REQUIREMENTS.md já carregados — requisitos NOTF-01 a NOTF-04 fully capturados nas decisões acima.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `withTarefaScope(user)` (`src/lib/visibility-scope.ts`) — escopo de visibilidade já testado (`tests/visibility-scope.test.ts`, `tests/visibility-scope.setor.test.ts`), reusar diretamente para a query de notificações.
- `calcularAlertaPrazo` (`src/lib/alert-prazo.ts`) — limiares de 3 dias já validados e testados (`tests/alert-prazo.test.ts`), reusar a mesma constante/lógica para decidir quando sincronizar uma notificação "vencendo" ou "atrasada".

### Established Patterns
- Constraint única (`@@unique`) sobre combinação de campos para garantir idempotência — mesmo padrão de `Tarefa.@@unique([empresaId, tipoObrigacao, competencia])`, a ser replicado para `Notificacao` (D-03).
- Server Components com fetch direto no `layout.tsx`/`page.tsx` (sem client-side fetching) — `contarAlertasTarefas` já é chamado diretamente no `AppLayout` (Server Component) e passado como prop; o sino provavelmente segue o mesmo padrão para a contagem inicial, com um componente client para o dropdown interativo.

### Integration Points
- `AppLayout` (`src/app/(app)/layout.tsx`) já busca `session.user` e dados derivados (contador) antes de renderizar — ponto natural para disparar a sincronização sob demanda (D-02) e buscar notificações não-lidas.
- Marcar como lida precisa de uma Server Action nova (padrão já em uso em `src/app/(app)/tarefas/actions.ts` e `src/app/(app)/actions.ts`).

</code_context>

<specifics>
## Specific Ideas

- O usuário confirmou explicitamente: persistência com lida/não-lida (não live), dropdown ao clicar (não navegação), sino substitui a badge da sidebar (fonte única de contagem), e notificação de avulsa fica enquanto a tarefa estiver pendente (sem expiração por tempo).
- Geração das notificações é sob demanda (sincronizada a cada acesso), não via cron novo — decisão explícita para não adicionar infraestrutura agendada nova além do cron mensal já existente.
- Lida = some definitivamente, a não ser que a tarefa mude de patamar (vencendo → atrasada conta como notificação nova).

</specifics>

<deferred>
## Deferred Ideas

Nenhuma ideia fora do escopo de NOTF-01 a NOTF-04 surgiu durante a discussão. Notificação por email/WhatsApp (NOTF-05) já estava nominalmente fora de escopo no REQUIREMENTS.md antes desta discussão — não foi reaberta.

[Nenhum todo pendente encontrado para esta fase via `todo.match-phase`.]

</deferred>

---

*Phase: 10-Notificações In-App*
*Context gathered: 2026-06-29*
