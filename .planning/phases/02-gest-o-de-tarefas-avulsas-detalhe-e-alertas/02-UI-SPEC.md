---
phase: 2
slug: gestao-de-tarefas-avulsas-detalhe-e-alertas
status: draft
shadcn_initialized: true
preset: radix-nova / neutral / cssVariables
created: 2026-06-17
---

# Phase 2 — UI Design Contract

> Contrato visual e de interação para a Fase 2: Gestão de Tarefas — Avulsas, Detalhe e Alertas.
> Gerado por gsd-ui-researcher. Verificado por gsd-ui-checker.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | shadcn/ui | components.json detectado |
| Preset | radix-nova, baseColor: neutral, cssVariables: true | components.json |
| Component library | Radix UI (via shadcn) | components.json |
| Icon library | lucide-react | components.json `"iconLibrary": "lucide"` |
| Font | Geist Sans (var(--font-sans)) / Geist Mono (var(--font-geist-mono)) | globals.css |
| Theme | Suporta light e dark via next-themes (já instalado) | STATE.md quick task 260615-ci1 |
| Style approach | Tailwind CSS v4 com CSS variables (oklch) | globals.css |

**Componentes shadcn já instalados e disponíveis para esta fase:**
Badge, Checkbox, Card, Table, Dialog, Tabs, Skeleton, Button, Input, Select, AlertDialog, Avatar, Sidebar, DropdownMenu, Sonner (toast)

---

## Spacing Scale

Escala de 8 pontos (múltiplos de 4). Consistente com a Fase 1 (ver `empresas-table.tsx` — gap-2, gap-4, px-2, py-1.5, etc.).

| Token | Value | Uso nesta fase |
|-------|-------|----------------|
| xs | 4px (gap-1) | Gap entre emoji de alerta e Badge; gap entre ícones de ação |
| sm | 8px (gap-2, p-2) | Padding interno de cells de tabela; gap entre filtros inline |
| md | 16px (gap-4, p-4) | Espaçamento padrão entre seções do formulário de tarefa; padding do card de empresa no detalhe |
| lg | 24px (gap-6, p-6) | Padding do Dialog de criação; padding do card de detalhe da empresa |
| xl | 32px (gap-8) | Gap entre o card de empresa e os dados da tarefa na página de detalhe |
| 2xl | 48px (py-12) | Padding vertical do estado vazio |
| 3xl | 64px | Não usado nesta fase |

Exceções:
- Touch targets de ação (editar/excluir) mantidos em `size-11` (44px) — igual ao padrão da Fase 1 em `empresas-table.tsx`
- Badge de contador na sidebar: posicionamento absoluto, sem padding próprio, tamanho mínimo de 20px para legibilidade de dois dígitos

---

## Typography

Mesma escala da Fase 1. Não introduzir novos tamanhos.

| Role | Size (Tailwind) | Weight | Line Height | Uso nesta fase |
|------|----------------|--------|-------------|----------------|
| Body | text-sm (14px) | font-normal (400) | leading-normal (1.5) | Células da tabela de tarefas, labels do formulário, corpo do card de empresa no detalhe |
| Label | text-xs (12px) | font-medium (500) | leading-tight (1.25) | Badge de status (PENDENTE/CONCLUÍDA), badge de prazo, label do contador sidebar, captions do card de empresa |
| Heading | text-xl (20px) | font-semibold (600) | leading-tight (1.25) | Título da página `/tarefas`; título da página `/tarefas/[id]` |
| Display | text-2xl (24px) | font-bold (700) | leading-tight (1.2) | Não usado nesta fase — reservado para dashboards (Fase 4) |

Regras:
- Título da tarefa na lista: `text-sm font-medium` (destaque sem quebrar o grid da tabela)
- Cabeçalhos de coluna da tabela: `text-sm font-medium text-muted-foreground` (padrão shadcn TableHead)
- Prazo em texto na coluna: `text-sm` com variação de cor por estado (ver seção Cor)
- Nome da empresa no card de detalhe: `text-base (16px) font-semibold`

---

## Color

O projeto usa shadcn neutral com oklch. Não há cor de marca definida além do preto/neutro. O sistema de alertas usa cores Tailwind arbitrárias por se tratarem de semântica de status, não de identidade de marca.

| Role | Valor (token CSS) | Uso |
|------|-------------------|-----|
| Dominant (60%) | `var(--background)` — oklch(1 0 0) light / oklch(0.145 0 0) dark | Fundo da página `/tarefas` e `/tarefas/[id]` |
| Secondary (30%) | `var(--card)` / `var(--muted)` | Card de empresa no detalhe; área do formulário dentro do Dialog; linhas alternadas de tabela (via TableRow hover) |
| Accent (10%) | `var(--primary)` — oklch(0.205 0 0) light / oklch(0.922 0 0) dark | Botão "Nova tarefa" (CTA primário); estado ativo do item "Tarefas" na sidebar; checkbox marcado |
| Destructive | `var(--destructive)` — oklch(0.577 0.245 27.325) light | Exclusão de tarefa — apenas no AlertDialog de confirmação e no botão de ação destrutiva |

**Sistema de alertas de prazo (semântico, não de marca):**

| Estado | Cor do texto de prazo | Badge className | Emoji |
|--------|----------------------|-----------------|-------|
| Normal (prazo > 3 dias) | `text-muted-foreground` | `variant="outline"` (border-border) | nenhum |
| Próximo (prazo <= 3 dias, PENDENTE) | `text-amber-600 dark:text-amber-400` | `className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"` | 🟡 |
| Atrasada (prazo < now, PENDENTE) | `text-red-600 dark:text-red-400` | `className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"` | 🔴 |
| Concluída | `text-muted-foreground line-through` | `variant="secondary"` (muted) | nenhum |

**Badge de status da tarefa:**

| Status | Badge |
|--------|-------|
| PENDENTE | `variant="outline"` com `text-foreground` |
| CONCLUÍDA | `variant="secondary"` com `text-muted-foreground` |

**Badge de regime tributário** (reutilizar exatamente o padrão da Fase 1):

| Regime | className |
|--------|-----------|
| LUCRO_REAL | `"bg-blue-600 text-white"` |
| SIMPLES_NACIONAL | `"bg-purple-600 text-white"` |
| LUCRO_PRESUMIDO | `"bg-amber-500 text-white"` |

**Badge de contador na sidebar:**
- Classe: `"ml-auto bg-destructive text-destructive-foreground text-xs font-medium min-w-5 h-5 flex items-center justify-center rounded-full px-1"`
- Visível apenas quando contador > 0
- Oculto quando sidebar está colapsada em modo ícone (respeitar `group-data-[collapsible=icon]:hidden`)

Accent reservado exclusivamente para: botão "Nova tarefa" (CTA primário), item ativo na sidebar, checkbox marcado de conclusão.

---

## Copywriting Contract

| Elemento | Texto |
|----------|-------|
| CTA primário (lista `/tarefas`) | "Nova tarefa" |
| Label do item sidebar | "Tarefas" |
| Título da página `/tarefas` | "Tarefas" |
| Título do Dialog de criação | "Nova tarefa" |
| Botão de submissão do formulário | "Criar tarefa" |
| Botão de cancelamento do Dialog | "Cancelar" |
| Checkbox de conclusão (aria-label) | "Marcar tarefa '{titulo}' como concluída" |
| Estado vazio — sem tarefas (heading) | "Nenhuma tarefa encontrada" |
| Estado vazio — sem tarefas (body) | "Crie uma tarefa avulsa para começar a acompanhar os prazos da equipe." |
| Estado vazio — busca sem resultado (heading) | "Nenhuma tarefa encontrada" |
| Estado vazio — busca sem resultado (body) | "Tente ajustar os filtros ou o termo de busca." |
| Filtro de concluídas (toggle/checkbox) | "Mostrar concluídas" |
| Badge de alerta próximo | "Prazo próximo" |
| Badge de alerta atrasada | "Atrasada" |
| Badge status pendente | "Pendente" |
| Badge status concluída | "Concluída" |
| Erro ao criar tarefa | "Não foi possível criar a tarefa. Verifique os dados e tente novamente." |
| Erro ao concluir tarefa | "Não foi possível registrar a conclusão. Tente novamente." |
| Sucesso ao criar tarefa | "Tarefa criada com sucesso." |
| Sucesso ao concluir tarefa | "Tarefa marcada como concluída." |
| Confirmação de exclusão (título) | "Excluir tarefa?" |
| Confirmação de exclusão (body) | "Esta ação não pode ser desfeita. O histórico de conclusões associado também será removido." |
| Botão confirmar exclusão | "Excluir" |
| Label campo empresa (formulário) | "Empresa" |
| Label campo título (formulário) | "Título" |
| Label campo descrição (formulário) | "Descrição (opcional)" |
| Label campo prazo (formulário) | "Prazo" |
| Label campo responsável (formulário) | "Responsável" |
| Placeholder busca na lista | "Buscar por título ou empresa" |
| Seção card empresa no detalhe | "Empresa vinculada" |
| Link "voltar" no detalhe | "← Tarefas" |
| Contador sidebar (singular) | "1 alerta" (tooltip no modo colapsado) |
| Contador sidebar (plural) | "{n} alertas" (tooltip no modo colapsado) |

---

## Component Inventory

### Página `/tarefas` — Lista Global

**Layout:**
```
<page>
  <header>
    <h1>"Tarefas"</h1>
    <Button variant="default">Nova tarefa</Button>  {/* abre Dialog */}
  </header>
  <toolbar>
    <Input placeholder="Buscar por título ou empresa" className="max-w-xs" />
    <Select>Responsável</Select>           {/* isDono only */}
    <Checkbox id="mostrar-concluidas" />
    <label for="mostrar-concluidas">Mostrar concluídas</label>
  </toolbar>
  <TarefasTable />
  <NovasTarefasDialog />
</page>
```

**Colunas da TarefasTable (TanStack Table, replicar padrão empresas-table.tsx):**

| Coluna | Conteúdo | Ordenável | Largura |
|--------|----------|-----------|---------|
| (sem header) | `<Checkbox>` conclusão | não | w-10 |
| Tarefa | Título + nome da empresa em `text-xs text-muted-foreground` abaixo | sim | flex-1 |
| Prazo | Emoji + Badge alerta + data formatada em pt-BR | sim (default ASC) | w-40 |
| Responsável | Nome do responsável | sim | w-36 |
| Ações | Botão ícone link para detalhe (Eye) + botão ícone excluir (Trash2) | não | w-20 |

**Ordenação padrão:** `prazo ASC` — configurado em `initialState.sorting: [{ id: 'prazo', desc: false }]`

**TanStack Table config:**
- `getSortedRowModel()` habilitado
- `getPaginationRowModel()` com pageSize: 20 (igual Fase 1)
- Clique no cabeçalho da coluna alterna ASC/DESC com ícone ChevronUp/ChevronDown (lucide-react)
- Colunas "Tarefa" e "Prazo" e "Responsável" têm `enableSorting: true`; demais têm `enableSorting: false`

**Formato de data do prazo:**
- `format(prazo, "dd/MM/yyyy", { locale: ptBR })` via date-fns
- Exibir como: `🔴 <Badge>Atrasada</Badge> 10/06/2026` — emoji + Badge + data na mesma célula

### Dialog de Nova Tarefa

```
<Dialog>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Nova tarefa</DialogTitle>
    </DialogHeader>
    <form>
      <div className="flex flex-col gap-4">
        <ComboboxEmpresas />           {/* Select com busca — lista de empresas do escopo do usuário */}
        <Input name="titulo" />        {/* Label: "Título" */}
        <Textarea name="descricao" />  {/* Label: "Descrição (opcional)", rows=3 */}
        <Select name="responsavelId"/> {/* Label: "Responsável" */}
        <Input type="date" name="prazo" /> {/* Label: "Prazo" — sem date-picker complexo */}
      </div>
    </form>
    <DialogFooter>
      <Button variant="outline">Cancelar</Button>
      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin size-4" /> : null}
        Criar tarefa
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Campo empresa:** `<Select>` com busca via Input interno (não Combobox complexo). Lista todas as empresas do escopo do usuário (COLABORADOR: suas empresas; DONO: todas), ordenadas por nome. Placeholder: "Selecionar empresa...".

**Campo responsável:** `<Select>` listando todos os usuários (qualquer papel) — conforme D-15. Placeholder: "Selecionar responsável...".

**Campo data:** `<input type="date">` estilizado com shadcn Input. Sem date-picker externo — D-15 do CONTEXT.md.

**Interação de submit:**
- Botão "Criar tarefa" desabilitado durante `isPending` (useTransition ou estado de loading)
- Ícone Loader2 animado ao lado do texto durante pending
- Ao sucesso: fechar Dialog + `toast.success("Tarefa criada com sucesso.")`
- Ao erro: `toast.error("Não foi possível criar a tarefa. Verifique os dados e tente novamente.")`

### Checkbox de Conclusão

- `<Checkbox>` shadcn na primeira coluna da tabela
- Estado: `checked={tarefa.status === 'CONCLUIDA'}`
- `disabled` quando `isPending` do `optimistic update`
- Ao marcar: chamada à Server Action `concluirTarefa(id)` com feedback imediato via estado otimista
- Ao desmarcar: não suportado na Fase 2 (conclusão é irreversível via UI — apenas admin pode reverter via Prisma Studio se necessário). Checkbox fica marcado e desabilitado quando `status === 'CONCLUIDA'`

### Sidebar — Item "Tarefas" com Badge

```tsx
<SidebarMenuItem>
  <SidebarMenuButton asChild isActive={pathname?.startsWith("/tarefas")}>
    <Link href="/tarefas">
      <ListChecks />
      <span>Tarefas</span>
      {contador > 0 && (
        <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-medium
                         min-w-5 h-5 flex items-center justify-center rounded-full px-1
                         group-data-[collapsible=icon]:hidden">
          {contador > 99 ? "99+" : contador}
        </span>
      )}
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

- `contador` = número de tarefas PENDENTES com prazo próximo (≤3 dias) OU atrasadas, no escopo do usuário logado
- Busca feita em Server Component separado (passar como prop para AppSidebar) — sem estado global client-side
- Limite de exibição: "99+" quando contador > 99

### Página `/tarefas/[id]` — Detalhe

**Layout — dois blocos verticais com divisor:**

```
<page>
  <nav>
    <Link href="/tarefas">← Tarefas</Link>
  </nav>
  <header>
    <div className="flex items-start justify-between">
      <h1>{tarefa.titulo}</h1>
      <div>
        <span>{emoji}</span>
        <Badge>{statusLabel}</Badge>
      </div>
    </div>
  </header>

  <section className="grid gap-6 md:grid-cols-2">
    {/* Coluna esquerda: dados da tarefa */}
    <Card>
      <CardHeader><CardTitle>Detalhes</CardTitle></CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-3">
          <div><dt>Prazo</dt><dd>{emoji} {badge} {data formatada}</dd></div>
          <div><dt>Responsável</dt><dd>{nome}</dd></div>
          <div><dt>Criado em</dt><dd>{data}</dd></div>
          {descricao && <div><dt>Descrição</dt><dd>{descricao}</dd></div>}
        </dl>
      </CardContent>
    </Card>

    {/* Coluna direita: card da empresa */}
    <Card>
      <CardHeader><CardTitle>Empresa vinculada</CardTitle></CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-3">
          <div><dt>Nome</dt><dd className="font-semibold">{empresa.nome}</dd></div>
          <div><dt>CNPJ</dt><dd>{cnpjFormatado}</dd></div>
          <div><dt>Regime</dt><dd><Badge className={REGIME_BADGE_CLASS}>{regimeLabel}</Badge></dd></div>
          <div><dt>Responsável</dt><dd>{empresa.responsavel.nome}</dd></div>
          {empresa.particularidades && <div><dt>Particularidades</dt><dd>{empresa.particularidades}</dd></div>}
        </dl>
        <div className="mt-4">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/empresas/${empresa.id}`}>Ver empresa</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  </section>

  {/* Conclusão — só se PENDENTE */}
  {tarefa.status === 'PENDENTE' && (
    <section>
      <Button onClick={handleConcluir} disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin size-4" /> : <Check className="size-4" />}
        Marcar como concluída
      </Button>
    </section>
  )}

  {/* Histórico — se CONCLUÍDA */}
  {tarefa.historico.length > 0 && (
    <section>
      <h2>Histórico</h2>
      {tarefa.historico.map(h => (
        <p key={h.id}>Concluída por {h.concluidoPor.nome} em {formatDate(h.concluidoEm)}</p>
      ))}
    </section>
  )}
</page>
```

**Labels `<dt>`:** `text-xs font-medium text-muted-foreground uppercase tracking-wide`
**Valores `<dd>`:** `text-sm text-foreground`

### Estados de Carregamento

- Tabela de tarefas: `<Skeleton>` em 5 linhas com colunas proporcionais ao layout real — exibido enquanto dados carregam via Suspense
- Página de detalhe: `<Skeleton>` no shape dos dois Cards — exibido via `loading.tsx`
- Checkbox em pending: `opacity-50 cursor-not-allowed` no wrapper do Checkbox

### Estados de Erro

- 404 em `/tarefas/[id]` não encontrado (ou fora do escopo): `notFound()` do Next.js (padrão da Fase 1)
- Erro de Server Action: `toast.error(...)` com mensagem do contrato de Copywriting acima

---

## Interaction Contracts

### Ordenação da tabela

- Coluna "Prazo" ordenável: clique no `<TableHead>` alterna entre ASC e DESC
- Indicadores visuais: `ChevronUp` (ASC), `ChevronDown` (DESC), nenhum ícone (não ordenado)
- Ordenação padrão ao entrar na página: `prazo ASC` (mais urgente no topo)
- Multi-column sort: não suportado — apenas uma coluna ativa por vez

### Filtro "Mostrar concluídas"

- `<Checkbox>` + `<label>` na toolbar
- Default: desmarcado (concluídas ocultas)
- Quando marcado: adiciona tarefas com `status === 'CONCLUIDA'` ao dataset da tabela (filtro client-side via `useMemo`)
- Tarefas concluídas exibidas com `opacity-60` na linha inteira e prazo com `line-through`

### Busca por título ou empresa

- Input controlado com `useState`
- Filtro client-side aplicado via `useMemo` sobre os dados já carregados (igual padrão Fase 1)
- Sem debounce (dataset pequeno — máx. ~100 tarefas ativas por usuário)

### Conclusão via Checkbox (lista)

1. Usuário marca o Checkbox
2. Estado otimista: Checkbox aparece marcado imediatamente, `opacity-50` na linha
3. Server Action `concluirTarefa(id)` executada em background
4. Sucesso: `revalidatePath("/tarefas")` → linha some da view (ou fica visível se "Mostrar concluídas" ativo) + `toast.success`
5. Erro: reverter estado otimista + `toast.error`

### Dialog — abrir/fechar

- Botão "Nova tarefa" abre o Dialog (estado `open` controlado no componente pai)
- Botão "Cancelar" e clique no overlay fecham o Dialog sem submeter
- Após submit bem-sucedido: Dialog fecha automaticamente (`setOpen(false)` na callback de sucesso)
- Ao fechar: resetar o formulário (React Hook Form `reset()`)

### Navegação para detalhe

- Clique no ícone Eye (Lucide) na coluna "Ações" navega para `/tarefas/{id}`
- Título da tarefa na coluna "Tarefa" também é um link para `/tarefas/{id}` (`<Link>` com `text-sm font-medium hover:underline`)

---

## RBAC — Contratos Visuais

| Elemento | COLABORADOR | DONO |
|----------|-------------|------|
| Filtro "Responsável" na toolbar | Oculto | Visível (todos os usuários) |
| Tarefas exibidas | Apenas onde `responsavelId === user.id` | Todas |
| Botão "Excluir" tarefa | Visível apenas em suas próprias tarefas | Visível em todas |
| Badge contador sidebar | Conta pendentes/atrasadas do próprio usuário | Conta todas as pendentes/atrasadas |
| Formulário — campo Responsável | Pré-selecionado com o próprio usuário, mas editável para qualquer usuário | Sem pré-seleção |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Badge, Checkbox, Card, Table, Dialog, AlertDialog, Button, Input, Select, Skeleton, Avatar, Sidebar, DropdownMenu | not required |
| Terceiros | nenhum | não aplicável |

Nenhum bloco ou registry de terceiros declarado. Gate de vetting não necessário.

---

## Accessibility Notes

- Checkbox de conclusão: `aria-label="Marcar tarefa '{titulo}' como concluída"` (título interpolado)
- Botões de ícone (Eye, Trash2): `aria-label` descritivo com nome da tarefa
- Badge de alerta: `aria-label` textual além do emoji (ex: `aria-label="Tarefa atrasada"`) para leitores de tela
- Dialog: `DialogTitle` obrigatório (já presente no shadcn Dialog)
- Colunas ordenáveis: `aria-sort="ascending" | "descending" | "none"` no `<th>`
- Contador sidebar: `aria-label="{n} tarefas com alertas de prazo"` no span do badge

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
