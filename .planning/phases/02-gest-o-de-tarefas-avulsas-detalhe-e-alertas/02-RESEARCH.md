# Phase 2: Gestão de Tarefas — Avulsas, Detalhe e Alertas - Research

**Researched:** 2026-06-17
**Domain:** Task management UI — Prisma schema extension, TanStack Table with sorting, Server Actions, RBAC scope, sidebar badge counter, date formatting
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Toda tarefa avulsa tem `empresaId` obrigatório (nunca null).
- **D-02:** Campo título livre (`titulo: String`) + descrição opcional (`descricao: String?`). Sem enum de tipo de obrigação na Fase 2.
- **D-03:** Prazo (`prazo: DateTime`) é obrigatório em toda tarefa.
- **D-04:** Conclusão registra `concluidoPorId` + `concluidoEm` em modelo separado `TarefaHistorico`.
- **D-05:** Status enum `TarefaStatus { PENDENTE, CONCLUIDA }`. Default `PENDENTE`.
- **D-06:** Limiar "prazo próximo" = 3 dias. Atrasada = `prazo < now` + status PENDENTE.
- **D-07:** Visual: emoji (🟡 próximo, 🔴 atrasada) + Badge colorido + texto em cor. Concluídas não participam de alertas.
- **D-08:** Concluídas ocultas por padrão; filtro "Mostrar concluídas" para exibir.
- **D-09:** Contador de pendentes (próximas + atrasadas) na sidebar — badge numérico.
- **D-10:** Página global `/tarefas`. Sem aba de tarefas dentro de `/empresas/[id]` na Fase 2.
- **D-11:** Ordenação padrão = `prazo ASC`. Colunas clicáveis (TanStack Table sorting).
- **D-12:** Tela de detalhe `/tarefas/[id]` exibe título, descrição, prazo com badge, responsável, card da empresa. Histórico cross-task = Fase 3.
- **D-13:** Formulário de criação = `Dialog` modal na própria `/tarefas`. Sem `/tarefas/nova`.
- **D-14:** `withTarefaScope(user)`: DONO vê todas (`{}`), COLABORADOR vê apenas `responsavelId === user.id`.
- **D-15:** Qualquer usuário pode atribuir tarefa a qualquer responsável. Restrição é só na visibilidade da lista.

### Claude's Discretion

- Estrutura de arquivos: replicar padrão de empresas — `modules/tarefas/queries.ts`, `modules/tarefas/schema.ts`, `app/(app)/tarefas/actions.ts`.
- Contador da sidebar: Server Component separado que faz a query, sem estado global client-side.
- Campo de data no formulário: `<input type="date">` com shadcn Input (sem date-picker complexo).

### Deferred Ideas (OUT OF SCOPE)

- Passo a passo estruturado por tipo de obrigação (Fase 3)
- Histórico cross-task de obrigação (Fase 3)
- Referência às ferramentas Python de ICMS/PIS-COFINS (Fase 3)
- Notificações externas por email/WhatsApp (v2)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TASK-03 | Marcar tarefa como concluída (checkbox simples) | Checkbox shadcn + Server Action `concluirTarefa(id)` + TarefaHistorico create + optimistic state pattern |
| TASK-04 | Criação de tarefas avulsas por qualquer membro, atribuíveis a qualquer pessoa | Dialog modal + `criarTarefa` Server Action + Zod schema + `empresaId` obrigatório |
| TASK-05 | Detalhe de cada tarefa: dados da empresa, informações da tarefa | `/tarefas/[id]` page com dois Cards (detalhes + empresa vinculada), `buscarTarefaPorId` query escopada |
| TASK-06 | Passo a passo das tarefas referencia ferramentas Python | Campo `descricao` serve como instrução livre na Fase 2; passo a passo estruturado = Fase 3 |
| ALRT-01 | Alertas visuais para prazos próximos ou atrasados | `calcularAlertaPrazo(prazo, status)` helper + emoji + Badge colorido + cor do texto + sidebar badge counter |

</phase_requirements>

---

## Summary

Esta fase estende o schema Prisma com dois novos modelos (`Tarefa` e `TarefaHistorico`), cria o módulo de queries e actions para tarefas seguindo exatamente o padrão estabelecido na Fase 1 para empresas, e constrói a UI completa de tarefas. O padrão já existe na codebase e é robusto: `withVisibilityScope` → `withTarefaScope`, `EMPRESA_SELECT` → `TAREFA_SELECT`, `buscarEmpresaPorId` → `buscarTarefaPorId`, `actions.ts` de empresas → `tarefas/actions.ts`.

O único componente genuinamente novo é o sistema de alertas de prazo, que é puramente de apresentação (lógica de comparação de datas em um helper `calcularAlertaPrazo`). A tabela TanStack precisa de `getSortedRowModel()` adicionado ao padrão da Fase 1 (que usa só `getCoreRowModel` + `getFilteredRowModel` + `getPaginationRowModel`). O sidebar badge counter é um Server Component filho do layout, que recebe o `user` da sessão e faz a query de contagem escopada.

A fase não instala nenhum pacote novo além de `date-fns` (formatação de datas em pt-BR), que está listado no CLAUDE.md mas não está no `package.json` atual — é a única dependência nova.

**Primary recommendation:** Replicar fielmente o padrão Fase 1 (visibility scope → queries → actions → table) para o domínio Tarefa. Não introduzir abstrações novas. A única lógica nova é `calcularAlertaPrazo` (puras comparações JS de Date) e o `getSortedRowModel` no TanStack Table.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema Prisma (Tarefa + TarefaHistorico) | Database / Storage | — | Extensão do schema relacional existente; `prisma migrate dev` gera a migration |
| RBAC scope (`withTarefaScope`) | API / Backend | — | Filtro de visibilidade aplicado server-side em todas as queries; nunca client-side |
| Server Actions (criar/concluir/excluir tarefa) | API / Backend | — | "use server"; guard de sessão + Zod parse + anti-IDOR findFirst antes de writes |
| Lista `/tarefas` (TanStack Table + filtros) | Frontend Server (SSR) + Browser/Client | — | Server Component busca dados; Client Component gerencia estado de filtro/sort/paginação |
| Sidebar badge counter | Frontend Server (SSR) | — | Server Component separado faz `db.tarefa.count` escopado; zero estado client-side |
| Alertas de prazo (emoji + Badge + cor) | Browser / Client | — | Lógica pura de comparação de datas no helper `calcularAlertaPrazo`; rendeirizada no Client Component da tabela |
| Detalhe `/tarefas/[id]` | Frontend Server (SSR) | — | Server Component; `buscarTarefaPorId` + `notFound()` se fora do escopo |
| Dialog de criação + formulário | Browser / Client | — | `Dialog` shadcn controlado com `useState`; React Hook Form + Zod; `startTransition` para submit |

---

## Standard Stack

### Core (já instalado no projeto)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@prisma/client` | 6.19.3 | ORM — query Tarefa + TarefaHistorico | Instalado [VERIFIED: package.json] |
| `@tanstack/react-table` | 8.21.3 | Tabela de tarefas com sorting + paginação | Instalado [VERIFIED: package.json] |
| `zod` | 3.25.76 | Schema de validação do formulário de tarefa | Instalado [VERIFIED: package.json] |
| `react-hook-form` | 7.78.0 | Gerenciamento do formulário de criação | Instalado [VERIFIED: package.json] |
| `@hookform/resolvers` | 5.4.0 | Integração RHF + Zod | Instalado [VERIFIED: package.json] |
| `sonner` | 2.0.7 | Toast de sucesso/erro nas actions | Instalado [VERIFIED: package.json] |
| `lucide-react` | 1.18.0 | Ícones (Eye, Trash2, ChevronUp, ChevronDown, ListChecks, Check, Loader2) | Instalado [VERIFIED: package.json] |
| `next-themes` | 0.4.6 | Dark mode (já ativo) | Instalado [VERIFIED: package.json] |

### Nova dependência necessária

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `date-fns` | ^4.4.0 | Formatação de datas em pt-BR (`format(prazo, "dd/MM/yyyy", { locale: ptBR })`) | Não está em `package.json` mas está no CLAUDE.md. Necessário para formatar `prazo` nas células da tabela e na página de detalhe. Alternativa nativa (`toLocaleDateString('pt-BR')`) funciona mas é menos confiável cross-environment para SSR. [VERIFIED: npm registry — versão 4.4.0 é a latest] |

**Installation:**
```bash
npm install date-fns
```

### Componentes shadcn já disponíveis (sem instalar)

Badge, Checkbox, Card, CardHeader, CardTitle, CardContent, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, Skeleton, Separator — todos confirmados em `src/components/ui/`. [ASSUMED: existência confirmada via CONTEXT.md e UI-SPEC.md; verificação exata de cada arquivo não feita — improvável que falte algo listado]

---

## Package Legitimacy Audit

A única dependência nova nesta fase é `date-fns`, um pacote amplamente estabelecido no ecossistema npm.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `date-fns` | npm | ~9 anos | ~80M/semana | github.com/date-fns/date-fns | OK | Aprovado |

**Packages removed due to [SLOP] verdict:** nenhum
**Packages flagged as suspicious [SUS]:** nenhum

*`date-fns` está no CLAUDE.md como dependência recomendada (`date-fns ^4.x`) e é um dos pacotes mais baixados do ecossistema npm. [ASSUMED: contagem de downloads baseada em conhecimento de treinamento — order of magnitude correto mas não verificado via npm esta sessão]*

---

## Architecture Patterns

### System Architecture Diagram

```
Usuário autenticado
       │
       ▼
AppLayout (Server Component)
  ├── auth() → session.user (role + id)
  ├── AppSidebar ← [contadorAlertas: number]  ←─── ContadorSidebarTarefas (Server Component)
  │                                                   └── db.tarefa.count({ where: { ...scope, prazo ≤ now+3d | prazo < now, status: PENDENTE } })
  │
  └── /tarefas (Server Component — page.tsx)
        ├── listarTarefas(session.user) ──→ db.tarefa.findMany({ where: { ...withTarefaScope }, select: TAREFA_SELECT, orderBy: { prazo: 'asc' } })
        ├── listarEmpresas(session.user)   ← reutiliza query Fase 1 para popular Select do formulário
        ├── listarResponsaveis()           ← reutiliza query Fase 1 para popular Select de responsável
        │
        └── TarefasTable (Client Component)
              ├── useState: busca, mostrarConcluidas, tarefaParaExcluir
              ├── useMemo: dadosFiltrados (busca + mostrarConcluidas)
              ├── useReactTable: getSortedRowModel + getPaginationRowModel + getCoreRowModel
              ├── initialState.sorting: [{ id: 'prazo', desc: false }]
              ├── Coluna Prazo: calcularAlertaPrazo(prazo, status) → { emoji, badgeClass, textClass, label }
              ├── Coluna Checkbox: concluirTarefa(id) via startTransition + optimistic state
              └── AlertDialog: excluirTarefa(id)

  └── /tarefas/[id] (Server Component — page.tsx)
        └── buscarTarefaPorId(session.user, id)
              ├── null → notFound()
              └── <TarefaDetalhe /> (pode ser Server Component — sem interação client-side além do botão "Concluir")
                    ├── Card "Detalhes" (título, prazo + badge, responsável, criado em, descrição)
                    └── Card "Empresa vinculada" (nome, CNPJ formatado, regime, responsável empresa, link /empresas/id)

Server Actions ("use server")
  src/app/(app)/tarefas/actions.ts
  ├── criarTarefa(formData) → { ok: true, id } | { ok: false, error }
  ├── concluirTarefa(id)    → { ok: true }     | { ok: false, error }
  └── excluirTarefa(id)     → { ok: true }     | { ok: false, error }
       │
       └── Anti-IDOR: findFirst({ where: { id, ...withTarefaScope(user) } }) ANTES de qualquer write
```

### Recommended Project Structure

```
src/
├── lib/
│   └── visibility-scope.ts          # EXISTENTE — adicionar withTarefaScope()
├── modules/
│   ├── empresas/                    # EXISTENTE — não modificar queries.ts
│   └── tarefas/                     # NOVO
│       ├── queries.ts               # listarTarefas, buscarTarefaPorId, contarAlertasTarefas
│       └── schema.ts                # tarefaSchema (Zod) para validação do formulário
├── app/(app)/
│   ├── layout.tsx                   # MODIFICAR — passar contadorAlertas para AppSidebar
│   ├── app-sidebar.tsx              # MODIFICAR — aceitar contadorAlertas prop; ativar item "Tarefas"
│   └── tarefas/                     # NOVO
│       ├── actions.ts               # "use server" — criarTarefa, concluirTarefa, excluirTarefa
│       ├── page.tsx                 # Server Component — listarTarefas + render TarefasTable
│       ├── tarefas-table.tsx        # "use client" — TanStack Table com sorting
│       ├── nova-tarefa-dialog.tsx   # "use client" — Dialog + React Hook Form
│       └── [id]/
│           ├── page.tsx             # Server Component — buscarTarefaPorId + render detalhe
│           └── loading.tsx          # Skeleton dos dois Cards
prisma/
└── schema.prisma                    # MODIFICAR — adicionar Tarefa, TarefaHistorico, TarefaStatus
```

### Pattern 1: withTarefaScope — análogo a withVisibilityScope

O padrão existente em `src/lib/visibility-scope.ts` deve ser estendido com uma função análoga para Tarefa. A função retorna `Prisma.TarefaWhereInput`.

```typescript
// src/lib/visibility-scope.ts — ADICIONAR ao arquivo existente

/**
 * Aplica escopo de visibilidade de tarefas conforme papel do usuário.
 * - DONO: vê todas as tarefas → retorna {}
 * - COLABORADOR: vê apenas tarefas onde responsavelId === user.id → retorna { responsavelId: user.id }
 *
 * Toda query de Tarefa DEVE espalhar este retorno no where.
 */
export function withTarefaScope(user: SessionUser): Prisma.TarefaWhereInput {
  if (user.role === "DONO") {
    return {};
  }
  return { responsavelId: user.id };
}
```

[ASSUMED: `Prisma.TarefaWhereInput` estará disponível após a migration que adiciona o model `Tarefa` ao schema]

### Pattern 2: TAREFA_SELECT — sem senhaHash nas relações

```typescript
// src/modules/tarefas/queries.ts

const TAREFA_SELECT = {
  id: true,
  titulo: true,
  descricao: true,
  prazo: true,
  status: true,
  createdAt: true,
  empresaId: true,
  responsavelId: true,
  empresa: {
    select: {
      id: true,
      nome: true,
      cnpj: true,
      regimeTributario: true,
      particularidades: true,
      responsavel: {
        select: { id: true, nome: true },
      },
    },
  },
  responsavel: {
    select: { id: true, nome: true },
  },
  historico: {
    select: {
      id: true,
      concluidoEm: true,
      concluidoPor: { select: { id: true, nome: true } },
    },
    orderBy: { concluidoEm: "desc" as const },
    take: 5,
  },
} as const;
```

**Regra crítica:** NUNCA usar `include` que inclua o model `Usuario` sem `select` explícito — vaza `senhaHash`. Este padrão é estabelecido na Fase 1 e documentado em `queries.ts`.

### Pattern 3: listarTarefas e buscarTarefaPorId

```typescript
export async function listarTarefas(user: SessionUser) {
  return db.tarefa.findMany({
    where: { ...withTarefaScope(user) },
    orderBy: { prazo: "asc" },
    select: TAREFA_SELECT,
  });
}

export async function buscarTarefaPorId(user: SessionUser, id: string) {
  return db.tarefa.findFirst({
    where: { id, ...withTarefaScope(user) },
    select: TAREFA_SELECT,
  });
}

export async function contarAlertasTarefas(user: SessionUser): Promise<number> {
  const agora = new Date();
  const em3Dias = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000);
  return db.tarefa.count({
    where: {
      ...withTarefaScope(user),
      status: "PENDENTE",
      prazo: { lte: em3Dias }, // inclui atrasadas (prazo < agora) e próximas (prazo <= agora+3d)
    },
  });
}
```

### Pattern 4: Server Action — concluirTarefa com anti-IDOR

```typescript
// src/app/(app)/tarefas/actions.ts
"use server";

export async function concluirTarefa(id: string): Promise<AcaoTarefaResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Não autenticado" };

  // Anti-IDOR: findFirst escopado ANTES do write
  const existente = await db.tarefa.findFirst({
    where: { id, ...withTarefaScope(session.user) },
    select: { id: true, status: true },
  });
  if (!existente) return { ok: false, error: "não encontrado" };
  if (existente.status === "CONCLUIDA") return { ok: true }; // idempotente

  await db.tarefa.update({
    where: { id },
    data: { status: "CONCLUIDA" },
  });

  await db.tarefaHistorico.create({
    data: {
      tarefaId: id,
      concluidoPorId: session.user.id,
      concluidoEm: new Date(),
    },
  });

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${id}`);
  return { ok: true };
}
```

**Nota crítica:** A conclusão de tarefa é uma operação de dois writes (`tarefa.update` + `tarefaHistorico.create`). Ambos devem ser executados juntos. Considerar wrapping em `db.$transaction([...])` para garantir atomicidade, mas para esta escala (5 usuários) a probabilidade de falha entre os dois writes é extremamente baixa. [ASSUMED: `$transaction` array API funciona no Prisma 6 — baseado em conhecimento de treinamento]

### Pattern 5: TanStack Table com sorting (diferença em relação à Fase 1)

A tabela da Fase 1 (`empresas-table.tsx`) usa `getCoreRowModel + getFilteredRowModel + getPaginationRowModel` mas **não tem sorting**. A tabela de tarefas precisa de sorting por prazo como padrão.

```typescript
// src/app/(app)/tarefas/tarefas-table.tsx
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,   // ← NOVO em relação à Fase 1
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";

// No componente:
const [sorting, setSorting] = useState<SortingState>([
  { id: "prazo", desc: false }, // prazo ASC default (mais urgente no topo)
]);

const table = useReactTable({
  data: dadosFiltrados,
  columns,
  state: { sorting, pagination: { pageIndex, pageSize: 20 } },
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
});
```

**Cabeçalho de coluna ordenável:**
```tsx
// Padrão para colunas ordenáveis (ex: coluna Prazo)
{
  accessorKey: "prazo",
  header: ({ column }) => (
    <button
      className="flex items-center gap-1 text-sm text-muted-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      Prazo
      {column.getIsSorted() === "asc" ? (
        <ChevronUp className="size-3" />
      ) : column.getIsSorted() === "desc" ? (
        <ChevronDown className="size-3" />
      ) : null}
    </button>
  ),
  cell: ({ row }) => <PrazoCell tarefa={row.original} />,
  sortingFn: "datetime", // TanStack Table built-in para Date objects
}
```

**Importante:** a coluna `prazo` recebe `DateTime` do Prisma (objeto `Date` JavaScript). O TanStack Table tem `sortingFn: "datetime"` built-in que compara `Date` objetos corretamente. [ASSUMED: `sortingFn: "datetime"` está disponível no @tanstack/react-table 8.x — baseado em conhecimento de treinamento; alternativa segura: `sortingFn: (a, b) => a.original.prazo.getTime() - b.original.prazo.getTime()`]

### Pattern 6: calcularAlertaPrazo helper

```typescript
// src/lib/alert-prazo.ts (novo arquivo utilitário)

export type AlertaPrazo = {
  emoji: string;
  label: string;
  badgeClass: string;
  textClass: string;
};

const ALERTA_NORMAL: AlertaPrazo = {
  emoji: "",
  label: "",
  badgeClass: "variant-outline", // via variant prop
  textClass: "text-muted-foreground",
};

export function calcularAlertaPrazo(
  prazo: Date,
  status: "PENDENTE" | "CONCLUIDA"
): AlertaPrazo {
  if (status === "CONCLUIDA") {
    return { ...ALERTA_NORMAL, textClass: "text-muted-foreground line-through" };
  }

  const agora = new Date();
  const em3Dias = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000);

  if (prazo < agora) {
    return {
      emoji: "🔴",
      label: "Atrasada",
      badgeClass: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
      textClass: "text-red-600 dark:text-red-400",
    };
  }

  if (prazo <= em3Dias) {
    return {
      emoji: "🟡",
      label: "Prazo próximo",
      badgeClass: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
      textClass: "text-amber-600 dark:text-amber-400",
    };
  }

  return ALERTA_NORMAL;
}
```

Este helper é puro (sem side effects, sem dependências externas). Pode ser testado diretamente com Vitest sem mocks.

### Pattern 7: Sidebar badge counter via Server Component

O `AppLayout` (Server Component) faz a query de contagem e passa como prop para `AppSidebar`. A sidebar já é `"use client"` (usa `usePathname`), então a prop `contadorAlertas: number` é uma serialização simples.

```typescript
// src/app/(app)/layout.tsx — MODIFICAR
export default async function AppLayout({ children }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const contadorAlertas = await contarAlertasTarefas(session.user);

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} contadorAlertas={contadorAlertas} />
      {/* ... */}
    </SidebarProvider>
  );
}
```

```typescript
// src/app/(app)/app-sidebar.tsx — MODIFICAR prop type
type AppSidebarProps = {
  user: AppSidebarUser;
  contadorAlertas: number;  // ← novo
};
```

**Limitação:** O contador na sidebar só atualiza quando há um full page load ou quando `revalidatePath` é chamado. Para 5 usuários com ~100 tarefas, isso é comportamento adequado — não há necessidade de polling ou websocket.

### Pattern 8: `<input type="date">` e conversão para DateTime no Server Action

O campo `<input type="date">` enviado via FormData chega como string no formato `"YYYY-MM-DD"`. O Server Action deve converter para `Date` antes de salvar no Prisma.

```typescript
// No tarefaSchema (Zod):
prazo: z.string()
  .min(1, "Prazo é obrigatório")
  .refine((val) => !isNaN(Date.parse(val)), "Data inválida")
  .transform((val) => new Date(val)),
```

**Pitfall:** `new Date("2026-06-17")` em JavaScript interpreta a string como UTC midnight, não como meia-noite local. Para prazos (que são datas, não datetime), isso é aceitável — o importante é usar a mesma lógica de comparação em `calcularAlertaPrazo`. Não misturar `Date.parse` em UTC com `toLocaleDateString` no cliente sem considerar o offset de fuso horário.

**Alternativa mais segura para evitar o problema de UTC:**
```typescript
// Converter "2026-06-17" para Date no fuso local
prazo: z.string()
  .transform((val) => {
    const [year, month, day] = val.split("-").map(Number);
    return new Date(year, month - 1, day, 23, 59, 59); // fim do dia local
  }),
```

Usar "fim do dia" (23:59:59) é mais seguro para prazos fiscais — uma tarefa com prazo "17/06" não deve aparecer como "atrasada" durante o dia 17 apenas por causa do offset UTC. [ASSUMED: convenção de "fim do dia" para prazos fiscais — não há decisão explícita no CONTEXT.md; alternativa é armazenar como meia-noite UTC e aceitar que a comparação seja feita em UTC]

### Anti-Patterns to Avoid

- **`include` sem `select` explícito em relações de Usuario:** Jamais usar `include: { responsavel: true }` — isso expõe `senhaHash`. Sempre `responsavel: { select: { id: true, nome: true } }`. Padrão estabelecido na Fase 1.
- **Filtro client-side por responsavelId:** A página `/tarefas` deve renderizar EXATAMENTE o que `listarTarefas(session.user)` retorna do servidor. Não adicionar `.filter(t => t.responsavelId === userId)` no cliente — isso contorna o escopo RBAC server-side.
- **`findUnique` em mutações:** Mutações de tarefa (concluir, excluir) DEVEM usar `findFirst` com escopo, nunca `findUnique` por id sozinho. `findUnique` não aceita `responsavelId` no where junto com `id` sem composição manual.
- **`useOptimistic` do React 19 para o checkbox:** A API `useOptimistic` de React 19 é adequada, mas o padrão estabelecido na codebase usa `useState` + `startTransition`. Manter consistência com a Fase 1 — não introduzir `useOptimistic` se não foi usado antes.
- **`getSortedRowModel` sem `state.sorting`:** Se `getSortedRowModel()` for adicionado sem passar `state: { sorting }` e `onSortingChange`, o TanStack Table vai gerenciar sorting internamente (uncontrolled) — o `initialState.sorting` funciona mas `sorting` externo não. Para o padrão da codebase (useState explícito), usar controlled sorting.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Formatação de data em pt-BR | `prazo.toLocaleDateString('pt-BR')` direto | `format(prazo, "dd/MM/yyyy", { locale: ptBR })` de `date-fns` | `toLocaleDateString` tem comportamento inconsistente em SSR (Node.js locale pode diferir do browser); `date-fns` é determinístico |
| Comparação de datas para alertas | Lógica inline espalhada nos componentes | Helper `calcularAlertaPrazo(prazo, status)` em `src/lib/alert-prazo.ts` | Centraliza a lógica que é usada em 3 lugares: célula da tabela, página de detalhe, e sidebar counter query |
| Dialog de formulário | `<dialog>` HTML nativo ou modal manual | `Dialog` do shadcn (já instalado) | Acessibilidade (focus trap, Escape, aria-modal) já implementada pelo Radix UI subjacente |
| Confirmação de exclusão | `window.confirm()` | `AlertDialog` do shadcn (já usado em `empresas-table.tsx`) | `window.confirm()` bloqueia a thread, não tem estilo consistente, não funciona bem em mobile |
| Paginação da tabela | Paginação manual com slice() | `getPaginationRowModel()` do TanStack Table (já configurado na Fase 1) | Manter pageSize: 20, botões Anterior/Próxima — exato mesmo padrão de `empresas-table.tsx` |

**Key insight:** Toda a "nova" lógica desta fase é na verdade uma replicação do padrão da Fase 1 aplicada ao domínio Tarefa. O único código genuinamente novo é `calcularAlertaPrazo` e `withTarefaScope`.

---

## Common Pitfalls

### Pitfall 1: Duas relações de Tarefa para Usuario quebram o Prisma sem nomes explícitos

**What goes wrong:** O model `Tarefa` tem dois campos que referenciam `Usuario`: `responsavel` e (via `TarefaHistorico`) `concluidoPor`. Prisma exige nomes de relação explícitos quando há mais de uma relação entre dois modelos.

**Why it happens:** `Tarefa → Usuario` (responsavel) e `TarefaHistorico → Usuario` (concluidoPor) são relações separadas. Além disso, `Usuario` já tem `empresas Empresa[] @relation("ResponsavelEmpresa")`. Qualquer nova relação para `Usuario` deve ter nome único.

**How to avoid:** Seguir exatamente o schema do CONTEXT.md (D-01 a D-05):
- `responsavel Usuario @relation("ResponsavelTarefa", ...)` no model `Tarefa`
- `concluidoPor Usuario @relation("ConcluiuTarefa", ...)` no model `TarefaHistorico`
- Relações inversas em `Usuario`: `tarefasResponsavel Tarefa[] @relation("ResponsavelTarefa")` e `tarefasConcluidas TarefaHistorico[] @relation("ConcluiuTarefa")`

**Warning signs:** `prisma migrate dev` retorna erro `"Ambiguous relation"` ou `"The relation field ... must specify the @relation attribute"`.

### Pitfall 2: Empresa também precisa de relação inversa para Tarefa

**What goes wrong:** O schema atual de `Empresa` não tem campo `tarefas Tarefa[]`. Quando o model `Tarefa` for adicionado com `empresaId`, o Prisma Client requer que `Empresa` declare a relação inversa.

**How to avoid:** Adicionar ao model `Empresa` no schema:
```prisma
tarefas Tarefa[]
```
Não precisa de `@relation` nomeada pois é a única relação entre `Empresa` e `Tarefa`.

**Warning signs:** `prisma generate` retorna erro de relação ambígua ou ausente em `Empresa`.

### Pitfall 3: `<input type="date">` envia string vazia quando não preenchido

**What goes wrong:** Se o usuário não preenche o campo de prazo, `formData.get("prazo")` retorna `""` (string vazia), não `null`. O Zod schema precisa capturar isso.

**How to avoid:** Usar `.min(1, "Prazo é obrigatório")` antes de `.refine` ou `.transform` no schema Zod. A ordem importa: validar presença antes de tentar parsear como data.

### Pitfall 4: `revalidatePath` não atualiza o sidebar badge counter no mesmo request

**What goes wrong:** O badge de contador na sidebar é renderizado no `AppLayout` (Server Component). Quando `concluirTarefa` chama `revalidatePath("/tarefas")`, o Next.js invalida o cache da página `/tarefas`, mas o layout que contém a sidebar também precisa ser revalidado para atualizar o contador.

**How to avoid:** Chamar `revalidatePath("/tarefas", "layout")` para revalidar toda a árvore de rotas de `/tarefas` incluindo o layout pai, ou chamar `revalidatePath("/")` para revalidar todos os layouts. Para este projeto, `revalidatePath("/tarefas")` sem segundo argumento já invalida a árvore incluindo layouts.

[ASSUMED: comportamento de `revalidatePath` com layouts no Next.js 15.5 App Router — baseado em conhecimento de treinamento; verificar na prática se o contador atualiza após `concluirTarefa`]

### Pitfall 5: Checkbox de conclusão irreversível — disabled quando CONCLUIDA

**What goes wrong:** A Fase 2 não implementa "desmarcar" tarefa. Se o Checkbox não for `disabled` quando `status === "CONCLUIDA"`, o usuário pode clicar e a UI entra em estado inconsistente (checked mas a action não faz nada de útil).

**How to avoid:**
```tsx
<Checkbox
  checked={tarefa.status === "CONCLUIDA"}
  disabled={tarefa.status === "CONCLUIDA" || isPending}
  aria-label={`Marcar tarefa '${tarefa.titulo}' como concluída`}
  onCheckedChange={() => handleConcluir(tarefa.id)}
/>
```

### Pitfall 6: Filtro "Mostrar concluídas" vs. dados carregados do servidor

**What goes wrong:** Se a página carregar apenas tarefas PENDENTES do servidor (para performance), o toggle "Mostrar concluídas" não pode funcionar client-side (não há dados de concluídas para mostrar).

**How to avoid:** `listarTarefas` retorna TODAS as tarefas do escopo (PENDENTES + CONCLUÍDAS). O filtro "Mostrar concluídas" é aplicado client-side via `useMemo` sobre os dados já carregados:
```typescript
const dadosFiltrados = useMemo(() => {
  let dados = tarefas;
  if (!mostrarConcluidas) {
    dados = dados.filter(t => t.status !== "CONCLUIDA");
  }
  // ... filtro de busca
  return dados;
}, [tarefas, mostrarConcluidas, busca]);
```

Para ~100 tarefas ativas por usuário, carregar todas é completamente aceitável. Não adicionar `status: "PENDENTE"` no where do `findMany` — isso quebraria o toggle.

---

## Code Examples

### Prisma Schema — adições completas ao schema.prisma

```prisma
// Adicionar ANTES dos models existentes

enum TarefaStatus {
  PENDENTE
  CONCLUIDA
}

// Adicionar DEPOIS de EmpresaRegimeHistorico

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

**Modificações nos models existentes:**

```prisma
// Em model Usuario — adicionar após `empresas Empresa[]`:
tarefasResponsavel Tarefa[]          @relation("ResponsavelTarefa")
tarefasConcluidas  TarefaHistorico[] @relation("ConcluiuTarefa")

// Em model Empresa — adicionar após `regimeHistorico EmpresaRegimeHistorico[]`:
tarefas            Tarefa[]
```

### Zod Schema para tarefa

```typescript
// src/modules/tarefas/schema.ts
import { z } from "zod";

export const tarefaSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  empresaId: z.string().min(1, "Empresa é obrigatória"),
  responsavelId: z.string().min(1, "Responsável é obrigatório"),
  prazo: z.string()
    .min(1, "Prazo é obrigatório")
    .refine((val) => !isNaN(Date.parse(val)), "Data inválida")
    .transform((val) => {
      const [year, month, day] = val.split("-").map(Number);
      return new Date(year, month - 1, day, 23, 59, 59); // fim do dia local
    }),
});

export type TarefaInput = z.infer<typeof tarefaSchema>;
```

### Formatação de data com date-fns

```typescript
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Uso na célula da tabela e na página de detalhe:
format(tarefa.prazo, "dd/MM/yyyy", { locale: ptBR })
// → "17/06/2026"
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Sorting client-side manual com Array.sort() | `getSortedRowModel()` do TanStack Table 8.x | Sorting integrado com estado reativo, suporte a multi-column, ícones de indicação automáticos |
| `useOptimistic` React 19 | `useState` + `startTransition` (padrão da codebase) | Consistência com padrão Fase 1; `useOptimistic` seria alternativa válida mas introduziria nova API |
| Server-Sent Events / polling para atualizar badge | `revalidatePath` em Server Actions | Para 5 usuários, cache invalidation sob demanda é suficiente — sem necessidade de tempo real |

**Deprecated/outdated:**
- `moment.js`: não usar — projeto já usa `date-fns` (recomendado no CLAUDE.md)
- `window.confirm()`: não usar para confirmação de exclusão — usar `AlertDialog` shadcn (padrão da Fase 1)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Prisma.TarefaWhereInput` estará disponível após a migration | Pattern 1 | Baixo — gerado automaticamente pelo `prisma generate` após schema update |
| A2 | `sortingFn: "datetime"` está disponível no @tanstack/react-table 8.21.3 | Pattern 5 | Baixo — alternativa imediata: `sortingFn: (a, b) => a.original.prazo.getTime() - b.original.prazo.getTime()` |
| A3 | `db.$transaction([])` funciona no Prisma 6 para atomicidade dos dois writes de conclusão | Pattern 4 | Baixo — alternativa: dois writes sequenciais com try/catch no segundo (TarefaHistorico) |
| A4 | `revalidatePath("/tarefas")` invalida layouts pai no Next.js 15.5 | Pitfall 4 | Médio — se o badge não atualizar, adicionar `revalidatePath("/tarefas", "layout")` |
| A5 | Contagem de downloads de `date-fns` (~80M/semana) | Package Legitimacy Audit | Muito baixo — date-fns é um dos pacotes mais estabelecidos do npm, independente de número exato |
| A6 | Usar "fim do dia" (23:59:59) para conversão de `<input type="date">` é convenção adequada | Pattern 8 | Médio — se o usuário espera que "prazo = hoje" não apareça como atrasada durante o dia de hoje, é a escolha certa; confirmar com usuário se necessário |

---

## Open Questions

1. **Atomicidade de concluirTarefa**
   - What we know: A conclusão faz dois writes: `tarefa.update` + `tarefaHistorico.create`.
   - What's unclear: O planner deve embrulhar em `db.$transaction` ou deixar sequencial?
   - Recommendation: Usar `db.$transaction` para garantir que se `tarefaHistorico.create` falhar, o status da tarefa não fica como CONCLUIDA sem histórico. Para 5 usuários a chance de falha é remota, mas a transação é a prática correta.

2. **Quem pode excluir tarefas — COLABORADOR pode excluir suas próprias?**
   - What we know: O CONTEXT.md (D-14) define visibilidade mas não menciona permissão de exclusão explicitamente. A UI-SPEC define: "Botão 'Excluir' tarefa — COLABORADOR: Visível apenas em suas próprias tarefas; DONO: Visível em todas".
   - What's unclear: A UI-SPEC implica que COLABORADOR pode excluir suas próprias tarefas, mas a regra RBAC não foi explicitada no CONTEXT.md.
   - Recommendation: Implementar que qualquer usuário autenticado pode excluir tarefas dentro do seu escopo (COLABORADOR exclui as suas; DONO exclui qualquer uma). O `withTarefaScope` no `excluirTarefa` já garante isso via anti-IDOR.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | date-fns, Prisma | ✓ | engines: >=20 (package.json) | — |
| `date-fns` | Formatação de datas pt-BR | ✗ (não em package.json) | — | `toLocaleDateString('pt-BR')` (menos confiável em SSR) |
| `prisma migrate dev` | Adicionar Tarefa ao schema | ✓ (prisma 6.19.3 instalado) | 6.19.3 | — |
| Neon Postgres (produção) | Migration em produção | ✓ (configurado na Fase 1) | PostgreSQL 16/17 | — |

**Missing dependencies with no fallback:**
- `date-fns`: necessário instalar (`npm install date-fns`). Sem ele, a formatação de datas ficará inconsistente entre SSR e cliente.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (raiz do projeto) |
| Quick run command | `npx vitest run tests/tarefas*.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TASK-03 | `concluirTarefa(id)` cria TarefaHistorico e muda status para CONCLUIDA | unit | `npx vitest run tests/tarefas.crud.test.ts` | ❌ Wave 0 |
| TASK-03 | COLABORADOR não pode concluir tarefa de outro (IDOR) | unit | `npx vitest run tests/tarefas.idor.test.ts` | ❌ Wave 0 |
| TASK-04 | `criarTarefa(formData)` valida campos e persiste | unit | `npx vitest run tests/tarefas.crud.test.ts` | ❌ Wave 0 |
| TASK-04 | `criarTarefa` sem título/empresa/prazo retorna `{ ok: false }` | unit | `npx vitest run tests/tarefas.crud.test.ts` | ❌ Wave 0 |
| TASK-05 | `buscarTarefaPorId` retorna null para tarefa fora do escopo | unit | `npx vitest run tests/tarefas.queries.test.ts` | ❌ Wave 0 |
| ALRT-01 | `calcularAlertaPrazo` retorna 🔴/"Atrasada" para prazo < now | unit | `npx vitest run tests/alert-prazo.test.ts` | ❌ Wave 0 |
| ALRT-01 | `calcularAlertaPrazo` retorna 🟡/"Prazo próximo" para prazo <= now+3d | unit | `npx vitest run tests/alert-prazo.test.ts` | ❌ Wave 0 |
| ALRT-01 | `calcularAlertaPrazo` retorna normal para prazo > now+3d | unit | `npx vitest run tests/alert-prazo.test.ts` | ❌ Wave 0 |
| AUTH-02 | `withTarefaScope` retorna `{}` para DONO e `{ responsavelId }` para COLABORADOR | unit | `npx vitest run tests/visibility-scope.test.ts` | ❌ precisa de extensão |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/tarefas*.test.ts tests/alert-prazo.test.ts tests/visibility-scope.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green antes do `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/tarefas.crud.test.ts` — cobre TASK-03 (concluirTarefa) e TASK-04 (criarTarefa, excluirTarefa)
- [ ] `tests/tarefas.idor.test.ts` — cobre AUTH-02 aplicado a tarefas (TASK-03 IDOR)
- [ ] `tests/tarefas.queries.test.ts` — cobre TASK-05 (buscarTarefaPorId com escopo)
- [ ] `tests/alert-prazo.test.ts` — cobre ALRT-01 (calcularAlertaPrazo helper puro)
- [ ] `tests/visibility-scope.test.ts` — já existe; estender com casos de `withTarefaScope`

---

## Security Domain

> `security_enforcement: true` (ausente no config = enabled). `security_asvs_level: 1`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Sim (indiretamente) | `auth()` guard no início de cada Server Action — padrão estabelecido na Fase 1 |
| V3 Session Management | Não (gerenciado pelo Auth.js) | Auth.js v5 gerencia sessão; sem lógica manual de sessão nesta fase |
| V4 Access Control | **Sim — principal risco** | `withTarefaScope(user)` em todas as queries; anti-IDOR via `findFirst` com escopo antes de mutations |
| V5 Input Validation | Sim | `tarefaSchema.safeParse(formData)` via Zod antes de qualquer `db.tarefa.create/update` |
| V6 Cryptography | Não | Nenhuma operação criptográfica nova nesta fase |

### Known Threat Patterns para este stack

| Pattern | STRIDE | Mitigação Standard |
|---------|--------|-------------------|
| IDOR — colaborador acessa/modifica tarefa de outro via id direto | Elevation of Privilege | `findFirst({ where: { id, ...withTarefaScope(user) } })` antes de qualquer mutation; retornar "não encontrado" (nunca 403) |
| Injection via FormData (campos de texto livres: titulo, descricao) | Tampering | Zod `z.string().min(1)` sanitiza; Prisma usa queries parametrizadas — sem SQL injection |
| Unauthenticated Server Action call | Spoofing | Guard `const session = await auth(); if (!session?.user) return { ok: false, error: "Não autenticado" }` em todas as actions — idêntico ao padrão da Fase 1 |
| Campo empresa/responsavel manipulado para IDs inválidos | Tampering | `z.string().min(1)` valida presença; Prisma lança erro de FK constraint se `empresaId`/`responsavelId` não existirem — não expõe dados, apenas falha na escrita |

---

## Sources

### Primary (HIGH confidence — verificado diretamente no código da codebase)
- `src/lib/visibility-scope.ts` — padrão `withVisibilityScope` que `withTarefaScope` deve replicar [VERIFIED: lido nesta sessão]
- `src/modules/empresas/queries.ts` — padrão `EMPRESA_SELECT` e `listarEmpresas`/`buscarEmpresaPorId` [VERIFIED: lido nesta sessão]
- `src/app/(app)/actions.ts` — padrão Server Actions (guard + Zod + anti-IDOR + revalidatePath) [VERIFIED: lido nesta sessão]
- `src/app/(app)/empresas/empresas-table.tsx` — padrão TanStack Table com paginação e filtros [VERIFIED: lido nesta sessão]
- `src/app/(app)/app-sidebar.tsx` — estrutura atual da sidebar (item Tarefas com `disabled`) [VERIFIED: lido nesta sessão]
- `prisma/schema.prisma` — schema atual (sem Tarefa) [VERIFIED: lido nesta sessão]
- `vitest.config.ts` — framework de teste e aliases [VERIFIED: lido nesta sessão]
- `package.json` — dependências instaladas e versões [VERIFIED: lido nesta sessão]
- `tests/setup.ts`, `tests/empresas.idor.test.ts`, `tests/visibility-scope.test.ts` — padrão de testes [VERIFIED: lido nesta sessão]
- `.planning/phases/02-.../02-CONTEXT.md` — decisões D-01 a D-15 [VERIFIED: lido nesta sessão]
- `.planning/phases/02-.../02-UI-SPEC.md` — contrato visual e de interação [VERIFIED: lido nesta sessão]

### Secondary (MEDIUM confidence)
- `npm view date-fns dist-tags.latest` → 4.4.0 [VERIFIED: executado nesta sessão]
- Package.json atual confirma `@tanstack/react-table@8.21.3`, `zod@3.25.76`, `react-hook-form@7.78.0` [VERIFIED: lido nesta sessão]

### Tertiary (LOW confidence — conhecimento de treinamento)
- TanStack Table `sortingFn: "datetime"` disponível em v8.x [ASSUMED]
- Comportamento exato de `revalidatePath` com layouts no Next.js 15.5 [ASSUMED]
- `db.$transaction` array API no Prisma 6 [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — verificado via package.json e código fonte
- Architecture: HIGH — baseado em padrões confirmados na codebase da Fase 1
- Prisma Schema: HIGH — schema proposto vem do CONTEXT.md aprovado pelo usuário
- Pitfalls: HIGH — baseados em análise direta do código existente (relações Prisma, padrão anti-IDOR)
- Test patterns: HIGH — baseados nos arquivos de teste existentes da Fase 1

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (stack estável — Next.js 15.5, Prisma 6, TanStack Table 8.x)
