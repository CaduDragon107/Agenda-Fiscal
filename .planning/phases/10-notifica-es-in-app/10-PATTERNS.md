# Phase 10: Notificações In-App - Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 9 (1 schema change, 2 backend modules, 1 actions file, 3 UI files modified/created, 1 new client component, tests)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `prisma/schema.prisma` (add `Notificacao` model + `NotificacaoTipo` enum) | model | CRUD | `TarefaHistorico` model (cascade FK) + `Tarefa` model (`@@unique` constraint) | exact (two analogs combined) |
| `src/modules/notificacoes/sync.ts` (new) | service | batch/event-driven | `src/modules/tarefas/geracao.ts` (`executarGeracaoMensal`) | role-match (idempotent createMany pattern) |
| `src/modules/notificacoes/queries.ts` (new) | service | CRUD (read) | `src/modules/tarefas/queries.ts` (`contarAlertasTarefas`, scoped findMany) | exact |
| `src/app/(app)/notification-actions.ts` (new) | controller (Server Action) | request-response | `src/app/(app)/tarefas/actions.ts` (`concluirTarefa`, `salvarMotivoPendencia`) | exact |
| `src/app/(app)/layout.tsx` (modified) | controller (Server Component) | request-response | itself (current file) — extend existing pattern | exact |
| `src/app/(app)/app-sidebar.tsx` (modified — remove badge) | component | request-response | itself (current file) — remove `contadorAlertas` | exact |
| `src/app/(app)/notification-bell.tsx` (new) | component | request-response | `src/app/(app)/app-sidebar.tsx` (`DropdownMenu` footer block) | role-match (swap DropdownMenu→Popover per research) |
| `src/components/ui/popover.tsx` (new, shadcn-generated) | component (ui primitive) | request-response | `src/components/ui/dropdown-menu.tsx` (existing Radix wrapper) | role-match (install via CLI, don't hand-write) |
| `src/components/ui/scroll-area.tsx` (new, shadcn-generated) | component (ui primitive) | request-response | n/a — shadcn CLI installs | no codebase analog (CLI-managed) |
| `tests/notificacoes.sync.test.ts` (new) | test | batch/event-driven | `tests/tarefas.idor.test.ts` (mock `db`/`auth` pattern) | exact |
| `tests/notificacoes.idor.test.ts` (new) | test | request-response | `tests/tarefas.idor.test.ts` | exact |
| `tests/notificacoes.read-action.test.ts` (new) | test | request-response | `tests/tarefas.idor.test.ts` | exact |

## Pattern Assignments

### `prisma/schema.prisma` — `Notificacao` model + `NotificacaoTipo` enum

**Analogs:** `TarefaHistorico` (lines 160-170) for cascade FK shape; `Tarefa` (lines 133-158) for `@@unique` idempotency constraint shape.

**Cascade FK pattern** (`TarefaHistorico`, lines 160-169):
```prisma
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
Copy `onDelete: Cascade` exactly for `Notificacao.tarefaId` (Pitfall 4 of RESEARCH.md: omitting this breaks `excluirTarefa` with a P2003 FK violation once any tarefa has a notification). Apply the same cascade to `usuarioId` per the RESEARCH.md code example, even though no current Server Action deletes a `Usuario` — defensive consistency.

**Unique constraint pattern** (`Tarefa`, line 151):
```prisma
@@unique([empresaId, tipoObrigacao, competencia])
```
Adapt to: `@@unique([tarefaId, usuarioId, tipo])` exactly as RESEARCH.md specifies (D-03). This is the idempotency anchor for `createMany({ skipDuplicates: true })` in the sync function — do not collapse to `(tarefaId, usuarioId)` only (Pitfall 2 breaks D-05's patamar-change requirement).

**Enum pattern** (existing `TarefaStatus`, lines 32-35):
```prisma
enum TarefaStatus {
  PENDENTE
  CONCLUIDA
}
```
Mirror for:
```prisma
enum NotificacaoTipo {
  VENCENDO
  ATRASADA
  AVULSA_ATRIBUIDA
}
```

**Inverse relations:** Add `notificacoes Notificacao[]` to both `Usuario` (near line 77, alongside `tarefasResponsavel`) and `Tarefa` (near line 149, alongside `historico`).

---

### `src/modules/notificacoes/sync.ts` (new)

**Analog:** `src/modules/tarefas/geracao.ts` (`executarGeracaoMensal`)

**Imports pattern** (geracao.ts lines 67-68, adapted):
```typescript
import { db } from "@/lib/db";
import { withTarefaScope, type SessionUser } from "@/lib/visibility-scope";
```

**Idempotent createMany pattern** (geracao.ts lines 325-331):
```typescript
const resultado = await tx.tarefa.createMany({
  data: tarefas.map((t) => ({ ...t, status: "PENDENTE" as const })),
  skipDuplicates: true, // apoia-se em @@unique([empresaId, tipoObrigacao, competencia])
});
```
Adapt directly per RESEARCH.md's Code Examples section (already a concrete, ready-to-copy function):
```typescript
export async function sincronizarNotificacoes(user: SessionUser): Promise<void> {
  const tarefasPendentes = await db.tarefa.findMany({
    where: { ...withTarefaScope(user), status: "PENDENTE" },
    select: { id: true, prazo: true, status: true, tipoObrigacao: true, responsavelId: true },
  });
  // classify each into VENCENDO / ATRASADA / AVULSA_ATRIBUIDA (reuse alert-prazo.ts thresholds)
  // db.notificacao.createMany({ data: candidatos, skipDuplicates: true });
}
```
**Critical (RESEARCH.md Open Question 1, resolved):** `usuarioId` in each candidate must be `t.responsavelId` (the tarefa's actual owner), never the viewing `user.id` — this lets DONO's page loads also populate colaboradores' notifications. Do not deviate from this without re-raising the question.

**Threshold reuse — do not hand-roll:** Pull the 3-day window from `src/lib/alert-prazo.ts` (lines 47-48 reproduced inline, or — preferred — extract a shared pure function from `alert-prazo.ts` first):
```typescript
const agora = new Date();
const em3Dias = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000);
if (prazo < agora) { /* ATRASADA */ } else if (prazo <= em3Dias) { /* VENCENDO */ }
```

---

### `src/modules/notificacoes/queries.ts` (new)

**Analog:** `src/modules/tarefas/queries.ts` (`contarAlertasTarefas`, lines 104-114)

**Scoped count pattern** (queries.ts lines 104-114):
```typescript
export async function contarAlertasTarefas(user: SessionUser): Promise<number> {
  return db.tarefa.count({
    where: {
      ...withTarefaScope(user),
      status: "PENDENTE",
      prazo: { lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    },
  });
}
```
Adapt to two new functions:
- `contarNaoLidas(user)` — but per RESEARCH.md Open Question 2, this must NOT filter by `usuarioId: user.id` directly for DONO/CHEFE_SETOR; it must join through `Notificacao.tarefa` matching `withTarefaScope(user)`, mirroring the join-based scoping rather than literal ownership, so DONO's badge reflects all visible notifications.
- `listarNotificacoesNaoLidas(user)` — same scoping, plus the `lida: false` AND the avulsa-pendente-only filter from RESEARCH.md Pattern 3 (lines 180-194 of 10-RESEARCH.md), reproduced here verbatim as the query shape to copy:
```typescript
const naoLidas = await db.notificacao.findMany({
  where: {
    usuarioId: user.id,
    lida: false,
    OR: [
      { tipo: { in: ["VENCENDO", "ATRASADA"] } },
      { tipo: "AVULSA_ATRIBUIDA", tarefa: { status: "PENDENTE" } },
    ],
  },
  include: { tarefa: { select: { id: true, titulo: true, prazo: true, empresa: { select: { nome: true } } } } },
  orderBy: { createdAt: "desc" },
});
```
**Note the divergence:** RESEARCH.md's literal example scopes by `usuarioId: user.id` (correct for COLABORADOR), but the planner must extend this for DONO/CHEFE_SETOR per Open Question 2's recommendation — replace the flat `usuarioId: user.id` with a `withTarefaScope`-equivalent join when `user.role !== "COLABORADOR"`.

---

### `src/app/(app)/notification-actions.ts` (new)

**Analog:** `src/app/(app)/tarefas/actions.ts` (`concluirTarefa`, lines 151-192; `salvarMotivoPendencia`, lines 243-283)

**Imports pattern** (actions.ts lines 1-9):
```typescript
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
```

**Anti-IDOR mutation pattern** (actions.ts lines 151-192, `concluirTarefa`):
```typescript
export async function concluirTarefa(id: string): Promise<AcaoTarefaResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Não autenticado" };
  }
  const existente = await db.tarefa.findFirst({
    where: { id, ...withTarefaScope(session.user) },
    select: { id: true, status: true },
  });
  if (!existente) {
    return { ok: false, error: "não encontrado" };
  }
  // ...write, then revalidatePath
}
```
**Resolved scoping (per D-12 in 10-CONTEXT.md, confirmed by user, implemented in Plan 10-02):** for `marcarNotificacaoComoLidaAction`, the ownership check uses `withTarefaScope(session.user)` applied to the `Notificacao.tarefa` relation — NOT literal `usuarioId: session.user.id`. D-12 locks `Notificacao.lida` as global per row, so DONO marking a colaborador's notification as read is intended to affect that colaborador's own badge (DONO's scope is `{}`, which correctly grants DONO that ability; COLABORADOR's scope still restricts them to their own tarefas, preserving anti-IDOR for that role). This supersedes RESEARCH.md's original Open Questions recommendation, which proposed literal-ownership scoping before the user confirmed D-12.
```typescript
"use server";
export async function marcarNotificacaoComoLidaAction(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Não autenticado" };

  const existente = await db.notificacao.findFirst({
    where: { id, tarefa: { ...withTarefaScope(session.user) } },
    select: { id: true },
  });
  if (!existente) return { ok: false, error: "não encontrado" };

  await db.notificacao.update({ where: { id }, data: { lida: true } });
  revalidatePath("/", "layout");
  return { ok: true };
}
```
Also add `marcarTodasComoLidasAction()` following the same shape but with `updateMany({ where: { tarefa: { ...withTarefaScope(session.user) }, lida: false }, data: { lida: true } })`.

**Result type pattern** (actions.ts lines 31-33):
```typescript
export type AcaoTarefaResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };
```
Mirror as `AcaoNotificacaoResult`.

---

### `src/app/(app)/layout.tsx` (modified)

**Analog:** itself, current implementation (full file, 41 lines)

**Current pattern to extend** (lines 16-41):
```typescript
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) { redirect("/login"); }
  const contadorAlertas = await contarAlertasTarefas(session.user);
  return (
    <SidebarProvider>
      <AppSidebar user={session.user} contadorAlertas={contadorAlertas} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```
**Changes required (D-10, D-07):**
1. Remove `contarAlertasTarefas` import and call; remove `contadorAlertas` prop pass to `AppSidebar`.
2. Add `await sincronizarNotificacoes(session.user)` before render (per D-02, runs every page load).
3. Add `const notificacoes = await listarNotificacoesNaoLidas(session.user)`.
4. Insert `<NotificationBell notificacoes={notificacoes} />` inside the `<header>` block, after `<Separator>`, using `className="ml-auto"` or similar to push it right (header currently only has `SidebarTrigger` + `Separator` — D-07 confirms this is the only content today).

---

### `src/app/(app)/app-sidebar.tsx` (modified — remove badge)

**Analog:** itself, current implementation

**Block to remove** (lines 48-51, 53, 100-107):
```typescript
type AppSidebarProps = {
  user: AppSidebarUser;
  contadorAlertas: number;  // REMOVE
};

export function AppSidebar({ user, contadorAlertas }: AppSidebarProps) {  // remove contadorAlertas param
  // ...
  {contadorAlertas > 0 && (
    <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-normal min-w-5 h-5 flex items-center justify-center rounded-full px-1 group-data-[collapsible=icon]:hidden"
      aria-label={`${contadorAlertas} tarefas com alertas de prazo`}>
      {contadorAlertas > 99 ? "99+" : contadorAlertas}
    </span>
  )}  // REMOVE entire block
```
Per Pitfall 5 of RESEARCH.md, treat as one atomic deletion across `app-sidebar.tsx` + `layout.tsx` (the import/call/prop-pass), and grep `contarAlertasTarefas` afterward to confirm no remaining call site before considering removal of the function itself from `tarefas/queries.ts`.

---

### `src/app/(app)/notification-bell.tsx` (new)

**Analog:** `src/app/(app)/app-sidebar.tsx` `DropdownMenu` footer block (lines 143-172) — same client-component + Radix-trigger/content shape, swapped to `Popover` per RESEARCH.md's explicit choice (Popover over DropdownMenu, since the panel needs rich rows not action items).

**Imports pattern to mirror** (app-sidebar.tsx lines 1-7, adapted):
```typescript
"use client";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "next/navigation"; // adjust: useState from "react"
```

**Trigger/Content shape to mirror** (app-sidebar.tsx lines 143-156, swap `DropdownMenu*` → `Popover*`):
```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <SidebarMenuButton size="lg">...</SidebarMenuButton>
  </DropdownMenuTrigger>
  <DropdownMenuContent side="top" align="start" className="w-56">
    ...
  </DropdownMenuContent>
</DropdownMenu>
```
Becomes (after `npx shadcn@latest add popover scroll-area`):
```typescript
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon" className="relative" aria-label={`${unreadCount} notificações não lidas`}>
      <Bell />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs min-w-5 h-5 flex items-center justify-center rounded-full px-1">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  </PopoverTrigger>
  <PopoverContent align="end" className="w-80 p-0">
    <ScrollArea className="max-h-96">
      {notificacoes.map((n) => (
        <Link key={n.id} href={`/tarefas/${n.tarefaId}`} onClick={() => marcarNotificacaoComoLidaAction(n.id)}>
          {/* título, empresa, tipo, prazo */}
        </Link>
      ))}
    </ScrollArea>
  </PopoverContent>
</Popover>
```
Note the bell's `aria-label` mirrors the same accessibility pattern already used for the sidebar badge (`aria-label={`${contadorAlertas} tarefas com alertas de prazo`}`, line 103 of app-sidebar.tsx) — keep consistent phrasing convention.

---

### `src/components/ui/popover.tsx` and `scroll-area.tsx` (new, shadcn CLI-generated)

**No analog needed — do not hand-write.** Confirmed via `Glob`: `popover.tsx` does not exist yet in `src/components/ui/`; `dropdown-menu.tsx` does. Install via:
```bash
npx shadcn@latest add popover
npx shadcn@latest add scroll-area
```
This mirrors the project's existing convention (every file in `src/components/ui/` — `dialog`, `dropdown-menu`, `sheet`, `tabs`, `tooltip`, `sidebar`, `badge` — is CLI-installed, never hand-authored).

---

### Test files (new)

**Analog:** `tests/tarefas.idor.test.ts` (lines 1-80 reproduced as the template)

**Mock setup pattern to copy verbatim** (lines 1-50):
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockColaboradorUser } from "./setup";

const findFirstMock = vi.fn();
const updateMock = vi.fn();
const authMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    notificacao: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      createMany: vi.fn(),
    },
    tarefa: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
```

**Assertion pattern to copy** (lines 61-80):
```typescript
it("COLABORADOR não pode marcar como lida notificação de outro usuário — retorna { ok: false }", async () => {
  const { marcarNotificacaoComoLidaAction } = await import("@/app/(app)/notification-actions");
  authMock.mockResolvedValue({ user: mockColaboradorUser() });
  findFirstMock.mockResolvedValue(null);

  const resultado = await marcarNotificacaoComoLidaAction("notif_de_outro");

  expect(resultado).toEqual({ ok: false, error: "não encontrado" });
  expect(updateMock).not.toHaveBeenCalled();
  const arg = findFirstMock.mock.calls[0][0] as { where: Record<string, unknown> };
  expect(arg.where).toMatchObject({ id: "notif_de_outro", usuarioId: expect.any(String) });
});
```
Use `tests/setup.ts`'s existing `mockColaboradorUser()` (and presumably `mockDonoUser()`/`mockChefeSetorUser()` if present — verify via the same setup file) for role fixtures across all three new test files.

## Shared Patterns

### Visibility scoping (read/sync queries)
**Source:** `src/lib/visibility-scope.ts`, `withTarefaScope(user)` (lines 116-124)
**Apply to:** `sync.ts` (candidate generation), `queries.ts` (list/count reads)
```typescript
export function withTarefaScope(user: SessionUser): Prisma.TarefaWhereInput {
  if (user.role === "DONO") return {};
  if (user.role === "CHEFE_SETOR" && user.setor) return tarefaSetorWhere(user.setor);
  return { responsavelId: user.id };
}
```
**Never write a parallel visibility query** — always spread this into the `where` of any `Tarefa` lookup feeding notification logic.

### Anti-IDOR ownership check (mutations)
**Source:** `src/app/(app)/tarefas/actions.ts`, all mutation actions (`concluirTarefa`, `excluirTarefa`, `salvarMotivoPendencia`)
**Apply to:** `notification-actions.ts` — same `withTarefaScope` pattern as listing/sync (per D-12, resolved): notification visibility AND mark-as-read both scope through `withTarefaScope(session.user)` on the `Notificacao.tarefa` relation, not literal `usuarioId`. DONO's scope (`{}`) intentionally lets DONO mark any colaborador's notification as read, which also flips that colaborador's badge (accepted product behavior per D-12). COLABORADOR's scope (`{ responsavelId: user.id }`) still restricts them to their own tarefas.
```typescript
const existente = await db.notificacao.findFirst({
  where: { id, tarefa: { ...withTarefaScope(session.user) } },
  select: { id: true },
});
if (!existente) return { ok: false, error: "não encontrado" };
```

### Idempotency via DB constraint, not pre-check
**Source:** `src/modules/tarefas/geracao.ts` (`executarGeracaoMensal`), `@@unique([empresaId, tipoObrigacao, competencia])`
**Apply to:** `Notificacao.@@unique([tarefaId, usuarioId, tipo])` + `db.notificacao.createMany({ data, skipDuplicates: true })` in `sync.ts`
```typescript
await db.notificacao.createMany({ data: candidatos, skipDuplicates: true });
```
Never use a `findFirst`-then-conditional-`create` loop (race condition risk between concurrent page loads/tabs).

### Deadline threshold (3-day window)
**Source:** `src/lib/alert-prazo.ts`, `calcularAlertaPrazo` (lines 47-48)
**Apply to:** `sync.ts` classification logic — reuse the literal threshold, ideally by extracting a shared pure function from `alert-prazo.ts` (e.g., `classificarPatamarPrazo`) so both the visual alert and the notification sync can never drift apart.
```typescript
const agora = new Date();
const em3Dias = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000);
```

### Server Component data-fetch → Client Component prop pattern
**Source:** `src/app/(app)/layout.tsx` → `src/app/(app)/app-sidebar.tsx` (`contadorAlertas` prop)
**Apply to:** `layout.tsx` → `notification-bell.tsx` (`notificacoes`/`unreadCount` props) — initial data is always server-fetched and scoped before serialization; never fetch-all-then-filter client-side.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/ui/scroll-area.tsx` | component (ui primitive) | request-response | No scroll-area component exists yet in `src/components/ui/`; CLI-installed, not hand-written — use RESEARCH.md's install command, not a codebase pattern |

## Metadata

**Analog search scope:** `src/lib/`, `src/modules/tarefas/`, `src/app/(app)/`, `src/components/ui/`, `prisma/schema.prisma`, `tests/`
**Files scanned:** `visibility-scope.ts`, `alert-prazo.ts`, `layout.tsx`, `app-sidebar.tsx`, `tarefas/queries.ts`, `tarefas/actions.ts`, `tarefas/geracao.ts`, `schema.prisma`, `dropdown-menu.tsx`, `tarefas.idor.test.ts`
**Pattern extraction date:** 2026-06-29
