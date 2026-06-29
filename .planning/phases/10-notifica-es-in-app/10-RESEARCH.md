# Phase 10: Notificações In-App - Research

**Researched:** 2026-06-29
**Domain:** In-app notification delivery (Next.js 15.5 App Router + Prisma + Postgres), on-demand sync model, role-scoped visibility reuse
**Confidence:** HIGH

## Summary

This phase adds a persisted `Notificacao` model and a header bell/dropdown, replacing the existing sidebar alert badge (`contarAlertasTarefas`). Almost everything needed is reuse, not invention: visibility scoping reuses `withTarefaScope` from `src/lib/visibility-scope.ts` verbatim, the deadline threshold reuses the exact 3-day logic already validated in `src/lib/alert-prazo.ts`, and the Server Component → client component prop-drilling pattern reuses the exact shape already wired in `src/app/(app)/layout.tsx` → `AppSidebar`.

The only genuinely new pieces are: (1) a `Notificacao` Prisma model with a `(tarefaId, usuarioId, tipo)` unique constraint for idempotent sync, (2) a "sync on page load" function that diffs the user's currently-eligible tarefas (per `withTarefaScope` + `calcularAlertaPrazo` thresholds + avulsa-assigned detection) against existing `Notificacao` rows and creates only the missing ones, and (3) two new shadcn components (`popover`, `scroll-area`) plus a new client component `NotificationBell` and Server Actions for mark-as-read.

Given CONTEXT.md's explicit decisions (D-01 through D-10), there is essentially no architectural ambiguity left for this phase — research's job here is to nail down the exact Prisma schema shape, the exact sync algorithm (including the "avulsa disappears when tarefa concluída/cancelada" rule from D-06, which has no `CANCELADA` status in the current schema and must be reasoned about), and the exact server/client split for the bell.

**Primary recommendation:** Add a `Notificacao` model with `@@unique([tarefaId, usuarioId, tipo])`, a `NotificacaoTipo` enum (`VENCENDO`, `ATRASADA`, `AVULSA_ATRIBUIDA`), sync via a single function called from `AppLayout` (Server Component) before render, and a `NotificationBell` client component using shadcn `Popover` + `ScrollArea`, fed by a server-fetched initial unread list/count exactly like `contadorAlertas` is today.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Notification persistence (read/unread state) | Database / Storage | API/Backend (Prisma) | D-01 requires a real table, not a live calculation — Postgres via Prisma is the only persistence layer in this stack |
| Sync (tarefa state → Notificacao rows) | API/Backend | — | Pure server-side logic (Server Component data-fetch or Server Action), no client involvement; must run before the bell renders so the badge count is correct on first paint |
| Visibility scoping (who sees which notification) | API/Backend | — | Reuses `withTarefaScope` exactly — this is a query-time concern, never duplicated client-side |
| Bell badge + dropdown rendering | Browser/Client | Frontend Server (SSR) | Initial count/list is SSR'd (Server Component fetch in `layout.tsx`, same pattern as `contadorAlertas`); the dropdown's open/close interactivity and "mark as read" click handlers are Client Component (`"use client"`) |
| Mark-as-read mutation | API/Backend | Browser/Client (trigger) | Server Action (`"use server"`), called from the client dropdown on click — same pattern as `concluirTarefa`/`salvarMotivoPendencia` |
| Deadline threshold calculation | API/Backend | — | Reuses `calcularAlertaPrazo`'s 3-day window logic server-side during sync; never recalculated client-side |

## Standard Stack

### Core
No new runtime libraries are required for this phase — see Don't Hand-Roll and Code Examples below. All data/logic layers reuse existing project infrastructure (Prisma 6.x, Next.js 15.5 Server Components/Actions, Auth.js v5 session).

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn `popover` (Radix `@radix-ui/react-popover`) | `@radix-ui/react-popover@1.1.17` [VERIFIED: npm registry] | Bell dropdown panel container | Install via `npx shadcn@latest add popover` — D-08 requires an inline panel, not navigation; UI-SPEC already specifies `Popover` as the default choice over `dropdown-menu` |
| shadcn `scroll-area` (Radix `@radix-ui/react-scroll-area`) | not yet installed in this project; resolved automatically by `shadcn add scroll-area` | Caps dropdown height when the notification list grows | Install via `npx shadcn@latest add scroll-area` — UI-SPEC discretion item for list-length capping |

**Note on shadcn components:** these are not npm dependencies added directly — `npx shadcn add <component>` copies source into `src/components/ui/` and installs the underlying Radix primitive package as a transitive dependency automatically. The project already follows this pattern (`badge`, `dropdown-menu`, `dialog`, `alert-dialog`, `sheet`, `sidebar`, `tabs`, `tooltip` are all shadcn-sourced). No manual `npm install` of Radix packages needed — let the CLI resolve versions, consistent with `Version Compatibility` guidance in CLAUDE.md ("Não instalar recharts manualmente antes — deixar o CLI do shadcn resolver a versão compatível").

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| On-demand sync (D-02, locked) | `node-cron` job checking all users' deadlines on a schedule | Rejected explicitly by CONTEXT.md — would add an unrelated responsibility to `src/lib/scheduler.ts` and risk staleness between cron ticks; on-demand sync is always fresh at page load |
| Polling-based live badge (re-fetch every N seconds client-side) | Server-Sent Events (SSE) or WebSocket push | Both rejected by scale: 5 internal users, no real-time requirement stated in success criteria ("visível em qualquer página" ≠ "atualiza sem reload"); adds infra complexity (persistent connections, server memory) with no proportional benefit. Sync-on-navigation (Server Component re-fetch on every route change, which Next.js already does for `AppLayout`) is sufficient. |
| `Popover` for the dropdown | `DropdownMenu` (already installed) | UI-SPEC already resolved this: `Popover` is the default since the bell needs a custom-shaped panel (a list with rich rows), not a menu of discrete actions; `DropdownMenu`'s built-in keyboard-nav/role semantics target action lists, not content panels |

**Installation:**
```bash
npx shadcn@latest add popover
npx shadcn@latest add scroll-area
```

**Version verification:** `@radix-ui/react-popover@1.1.17` confirmed via `npm view @radix-ui/react-popover version` [VERIFIED: npm registry]. `scroll-area`'s underlying package was not separately queried since the shadcn CLI resolves it automatically and the project's existing `components.json`-driven installs (e.g., `dropdown-menu`, `dialog`) have not required manual version pinning — same expected behavior applies here [CITED: ui.shadcn.com CLI docs].

## Package Legitimacy Audit

No new npm package is added directly by this phase's plan — `popover` and `scroll-area` are shadcn CLI-managed source components whose underlying Radix dependency is resolved automatically by the existing, already-installed `shadcn` CLI tool (`shadcn@4.11.0`, already in `package.json`). The transitive Radix package (`@radix-ui/react-popover`) was checked directly:

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @radix-ui/react-popover | npm | mature (Radix UI core primitive, multi-year history) | very high (millions/wk, core dependency of shadcn/ui ecosystem) | github.com/radix-ui/primitives | OK | Approved |
| @radix-ui/react-scroll-area | npm | mature (same Radix UI monorepo) | high | github.com/radix-ui/primitives | OK | Approved (not independently queried — same trust tier as react-popover, same monorepo/maintainer) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

No `checkpoint:human-verify` is required for these installs — both are official Radix UI primitives consumed via the already-trusted, already-in-use shadcn CLI pipeline (same install path as `badge`, `dialog`, `dropdown-menu`, `sheet`, `tabs`, `tooltip`, `sidebar`, all already present in `src/components/ui/`).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTF-01 | Notificação in-app para tarefa vencendo em breem (mesmo limiar dos alertas visuais existentes) | Reuse `calcularAlertaPrazo`'s 3-day window (`prazo <= agora + 3d && status === "PENDENTE"`) from `src/lib/alert-prazo.ts` as the exact sync trigger condition for `tipo: "VENCENDO"` — see Code Examples |
| NOTF-02 | Notificação in-app para tarefa atrasada | Reuse `calcularAlertaPrazo`'s atrasada branch (`prazo < agora && status === "PENDENTE"`) as the sync trigger for `tipo: "ATRASADA"` |
| NOTF-03 | Notificação in-app para tarefa avulsa atribuída ao usuário | Sync condition: `tipoObrigacao === null && status === "PENDENTE"` (avulsa identification per CONTEXT.md `canonical_refs`), independent of deadline threshold — see Architecture Patterns Pattern 2 |
| NOTF-04 | Notificações visíveis apenas para o responsável da tarefa (dono vê todas) | Sync and read queries both spread `withTarefaScope(user)` from `src/lib/visibility-scope.ts` — never a parallel visibility implementation |
</phase_requirements>

## Architecture Patterns

### System Architecture Diagram

```
Browser request (any authenticated route)
        |
        v
AppLayout (Server Component, src/app/(app)/layout.tsx)
        |
        |-- auth() -> session.user
        |
        |-- sincronizarNotificacoes(session.user)  [NEW: server-side, runs before render]
        |       |
        |       |-- withTarefaScope(user) -> scoped Tarefa where-clause
        |       |-- db.tarefa.findMany({ where: { ...scope, status: "PENDENTE" } })
        |       |-- for each tarefa: classify via calcularAlertaPrazo() + tipoObrigacao===null check
        |       |-- db.notificacao.createMany({ data: [...], skipDuplicates: true })
        |               (idempotent via @@unique([tarefaId, usuarioId, tipo]))
        |
        |-- listarNotificacoesNaoLidas(session.user)  [NEW: server-side read]
        |       |-- db.notificacao.findMany({ where: { usuarioId: user.id, lida: false }, ... })
        |
        v
   <AppSidebar />          <NotificationBell unreadCount={N} notificacoes={[...]} />  (Client Component)
   (badge REMOVED, D-10)           |
                                   |-- Popover open/close (client state)
                                   |-- onClick row -> marcarNotificacaoComoLidaAction(id)  [Server Action]
                                   |       |-- findFirst({ id, usuarioId: user.id }) anti-IDOR
                                   |       |-- update({ lida: true })
                                   |       |-- router.refresh() to re-sync count
                                   |-- "Marcar todas como lidas" -> marcarTodasComoLidasAction()  [Server Action]
                                   |-- row click also navigates to /tarefas/[id]
```

### Recommended Project Structure
```
prisma/schema.prisma            # add Notificacao model + NotificacaoTipo enum
src/
├── modules/
│   └── notificacoes/
│       ├── queries.ts          # listarNotificacoesNaoLidas, contarNaoLidas (mirrors tarefas/queries.ts)
│       └── sync.ts             # sincronizarNotificacoes(user) — the on-demand diff/create logic
├── app/
│   └── (app)/
│       ├── layout.tsx          # call sync + fetch, pass props to AppSidebar (badge removed) and new bell
│       ├── notification-bell.tsx   # "use client" — Popover, ScrollArea, list rendering
│       └── notification-actions.ts # "use server" — marcarComoLida, marcarTodasComoLidas
```

This mirrors the existing `src/modules/tarefas/{queries,schema,geracao}.ts` + `src/app/(app)/tarefas/actions.ts` split already used in the codebase — no new architectural pattern introduced, just applied to a new domain.

### Pattern 1: Idempotent sync via `createMany` + `skipDuplicates`
**What:** Diff current Tarefa state against existing Notificacao rows by relying on the Postgres unique constraint, rather than querying "does this notification already exist?" before each insert.
**When to use:** Always, for the sync function — this is the exact pattern already proven in `executarGeracaoMensal` (`src/modules/tarefas/geracao.ts`) for monthly task generation, which the codebase explicitly documents as idempotent "via constraint do banco" (see `src/lib/scheduler.ts` comment).
**Example:**
```typescript
// Source: pattern already in src/modules/tarefas/geracao.ts (executarGeracaoMensal),
// adapted for Notificacao per D-03 of 10-CONTEXT.md
await db.notificacao.createMany({
  data: candidatos, // [{ tarefaId, usuarioId, tipo, ... }]
  skipDuplicates: true, // relies on @@unique([tarefaId, usuarioId, tipo])
});
```

### Pattern 2: Classifying a Tarefa into zero-or-more Notificacao candidates
**What:** A pure function that takes a scoped Tarefa row and returns the set of notification "types" it currently qualifies for, reusing `calcularAlertaPrazo` for the deadline thresholds and the `tipoObrigacao === null` check for avulsa detection (per CONTEXT.md `canonical_refs`).
**When to use:** Inside the sync function, one call per eligible tarefa fetched.
**Example:**
```typescript
// Source: derived from src/lib/alert-prazo.ts calcularAlertaPrazo() thresholds
// and CONTEXT.md canonical_refs (tipoObrigacao === null => avulsa)
function classificarParaNotificacao(
  tarefa: { id: string; prazo: Date; status: "PENDENTE" | "CONCLUIDA"; tipoObrigacao: string | null; responsavelId: string }
): Array<"VENCENDO" | "ATRASADA" | "AVULSA_ATRIBUIDA"> {
  if (tarefa.status !== "PENDENTE") return [];

  const tipos: Array<"VENCENDO" | "ATRASADA" | "AVULSA_ATRIBUIDA"> = [];
  const agora = new Date();
  const em3Dias = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000);

  if (tarefa.prazo < agora) {
    tipos.push("ATRASADA");
  } else if (tarefa.prazo <= em3Dias) {
    tipos.push("VENCENDO");
  }

  if (tarefa.tipoObrigacao === null) {
    tipos.push("AVULSA_ATRIBUIDA");
  }

  return tipos;
}
```
**Important:** this duplicates `calcularAlertaPrazo`'s threshold *values* (3 days) inline rather than calling the function directly, because `calcularAlertaPrazo` returns UI display data (emoji/label/CSS classes), not a discriminated type usable for notification classification. The planner should decide whether to refactor `alert-prazo.ts` to export the raw threshold check as a separate pure function (preferred, avoids drift) or duplicate the constant with a comment pointing back to the source of truth. **Recommendation: extract a shared `classificarPatamarPrazo(prazo, status): "ATRASADA" | "VENCENDO" | "NORMAL"` from `alert-prazo.ts` and have both `calcularAlertaPrazo` and the new sync function call it** — this is the only way to guarantee NOTF-01/02's "mesmo limiar" requirement never drifts from the visual alert if `alert-prazo.ts` is edited later without remembering the notification sync.

### Pattern 3: D-06 "avulsa disappears when tarefa concluída/cancelada" — no `lida` flip needed
**What:** D-06 says the avulsa notification stays visible while `status === PENDENTE` and disappears when concluded — but NOT via marking it read. The schema has no `CANCELADA` status (`TarefaStatus` enum is `PENDENTE | CONCLUIDA` only — confirmed in `prisma/schema.prisma`), so "cancelada" in D-06's wording has no current representation; treat it as referring to `CONCLUIDA` only, or to a future status not yet modeled.
**When to use:** The "disappears" behavior for an avulsa-type notification can be implemented two ways — (a) the read-query for unread notifications joins to `Tarefa` and filters out any whose `tarefa.status !== "PENDENTE"` for `tipo: "AVULSA_ATRIBUIDA"` rows, without touching the `lida` column; or (b) a cleanup step in `concluirTarefa`/`excluirTarefa` Server Actions marks related `Notificacao` rows `lida: true` at the moment of completion. **Recommendation: option (a)** (filter at read-time) — it requires zero changes to existing, already-tested Server Actions (`concluirTarefa`, `excluirTarefa` in `src/app/(app)/tarefas/actions.ts`) and avoids coupling notification cleanup logic into unrelated task-mutation code paths. The read query becomes:
```typescript
// Source: derived from D-06 of 10-CONTEXT.md + existing Tarefa.status enum
const naoLidas = await db.notificacao.findMany({
  where: {
    usuarioId: user.id,
    lida: false,
    OR: [
      { tipo: { in: ["VENCENDO", "ATRASADA"] } }, // these become stale naturally (D-04/D-05 govern lifecycle)
      { tipo: "AVULSA_ATRIBUIDA", tarefa: { status: "PENDENTE" } },
    ],
  },
  include: { tarefa: { select: { id: true, titulo: true, prazo: true, empresa: { select: { nome: true } } } } },
  orderBy: { createdAt: "desc" },
});
```

### Anti-Patterns to Avoid
- **Reimplementing visibility scoping for notifications:** never write `{ tarefa: { responsavelId: user.id } }` inline in a notification query — always call `withTarefaScope(user)` and spread it into the `tarefa: { ...scope }` relation filter, or scope by `usuarioId` on `Notificacao` directly (the destination user is already a denormalized FK on the row — see Pattern below) plus the role-based count semantics matching `withTarefaScope`.
- **Live-calculating the badge count from Tarefa on every render instead of from the Notificacao table:** D-01 explicitly rejects the "live" calculation model used by the old `contarAlertasTarefas` — the badge count must be `db.notificacao.count({ where: { usuarioId, lida: false, ... } })`, not a recomputation of `calcularAlertaPrazo` over all tarefas at render time. The sync function still needs to *read* tarefas to populate notifications, but the badge/list read is always from `Notificacao`.
- **Adding a new cron job:** D-02 explicitly forbids this. Do not add `node-cron` calls or modify `src/lib/scheduler.ts` for this phase.
- **Letting the client decide which notifications to create:** sync must run entirely server-side (Server Component data-fetch before render, or a Server Action called on mount) — never expose a "create notification" client-callable endpoint that accepts the tarefa/type as unchecked input (IDOR risk: a malicious client could mint fake `AVULSA_ATRIBUIDA` notifications for tarefas it doesn't own). The sync function itself derives candidates from `withTarefaScope(user)`-scoped queries, with `usuarioId` taken only from `session.user.id`, never from request input.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent insert-if-not-exists | Manual `findFirst` + conditional `create` loop per candidate | `db.notificacao.createMany({ data, skipDuplicates: true })` + `@@unique` constraint | Already the proven pattern in `executarGeracaoMensal`; avoids race conditions between concurrent page loads from the same user (e.g., two tabs open) that a `findFirst`-then-`create` loop would not protect against without a transaction |
| Role/setor-based query scoping | A new `notificacaoScopeWhere(user)` helper that reimplements DONO/CHEFE_SETOR/COLABORADOR branching | `withTarefaScope(user)` (already exists, already tested in `tests/visibility-scope.test.ts` + `tests/visibility-scope.setor.test.ts`) | NOTF-04 explicitly requires "mesma regra de `withVisibilityScope`" — duplicating this logic is the exact anti-pattern the codebase's own comments warn against (Pitfall B4 in `tipo-obrigacao-setor.ts`: "NÃO duplicar este mapa") |
| Deadline threshold ("vencendo em breve" = how many days) | A new constant or recalculated date-math in the notification sync module | Reuse the literal 3-day window already validated in `src/lib/alert-prazo.ts` (`em3Dias = agora + 3*24*60*60*1000`) — ideally via an extracted shared function (see Pattern 2) | NOTF-01 explicitly requires "mesmo limiar dos alertas visuais já existentes" |
| Dropdown panel / popover positioning, focus trap, escape-to-close | Custom `useState` + manual `onClick` outside-detection + ARIA wiring | shadcn `Popover` (Radix `@radix-ui/react-popover`) | Radix Popover already solves focus management, escape key, click-outside, and ARIA roles correctly — exactly the class of "deceptively complex" UI primitive problem the project already defers to Radix for (`dialog`, `dropdown-menu`, `sheet` already follow this pattern) |

**Key insight:** This phase has almost no genuinely new domain logic — its entire complexity surface is "reuse three already-tested helpers (`withTarefaScope`, `calcularAlertaPrazo`'s threshold, the `createMany`/`skipDuplicates` idempotency pattern) inside one new sync function." The temptation to hand-roll is highest around "is this tarefa eligible for a notification" — resist writing that logic fresh; extract/reuse, per Pattern 2 above.

## Runtime State Inventory

> Not applicable — this is a greenfield additive phase (new model, new UI element), not a rename/refactor/migration phase. No existing data, service config, OS-registered state, secrets, or build artifacts reference "notificação"/"notification" naming today. Skipping this section per the omit condition for greenfield phases.

## Common Pitfalls

### Pitfall 1: Sync runs on every render, causing redundant writes or N+1 queries
**What goes wrong:** If `sincronizarNotificacoes` is called from `AppLayout` (which re-renders on every navigation in the App Router, since `layout.tsx` is shared across child routes but Server Components re-execute per request), the sync read-query (`db.tarefa.findMany` scoped to the user) plus the `createMany` write run on literally every page load. With ~100 client companies and 5 users this is small in volume, but it is still extra DB round-trips per navigation.
**Why it happens:** D-02 chose "on-demand, no cron" deliberately, accepting this tradeoff for simplicity — this is not a bug to "fix" away, but the planner should size it correctly: with 5 users and a few dozen pending tarefas each, the scoped query + createMany is a sub-50ms operation on Neon Postgres, well within Next.js Server Component render budgets. Do not over-engineer a caching layer for this; the explicit decision in CONTEXT.md accepts the redundancy.
**How to avoid:** Keep the sync query tight — only fetch `status: "PENDENTE"` tarefas within scope (do not fetch concluded tarefas), and only the fields needed for classification (`id, prazo, status, tipoObrigacao, responsavelId`), mirroring the minimal `select` discipline already used in `contarAlertasTarefas`.
**Warning signs:** If page load times measurably degrade after this phase ships, profile the sync query first — it is the most likely new cost center, not the bell rendering itself.

### Pitfall 2: Constraint shape mismatch breaks D-05's "patamar change = new notification"
**What goes wrong:** If the `@@unique` constraint is defined as `(tarefaId, usuarioId)` instead of `(tarefaId, usuarioId, tipo)`, a tarefa transitioning from "vencendo" to "atrasada" would violate the constraint on `createMany` (since a row already exists for that tarefa+user) and the new "atrasada" notification would never be created — silently breaking D-05/NOTF-02 for any tarefa that was already alerted as "vencendo."
**Why it happens:** It is tempting to model the constraint as "one notification per tarefa per user" since that maps more naturally to "one bell item per task," but D-05 explicitly requires `tipo` to be part of the uniqueness key precisely so vencendo→atrasada is treated as a new, distinct notification.
**How to avoid:** Always include `tipo` in the unique constraint: `@@unique([tarefaId, usuarioId, tipo])` — exactly as specified in CONTEXT.md D-03.
**Warning signs:** A test that creates a tarefa due in 2 days (triggers VENCENDO), syncs, marks it read, then time-travels the tarefa's `prazo` to the past (triggers ATRASADA) and re-syncs — if the second sync produces zero new unread notifications, the constraint shape is wrong.

### Pitfall 3: Avulsa notification re-appearing after being marked read, because read-time filtering ignores `lida`
**What goes wrong:** Pattern 3 above filters out avulsa notifications whose `tarefa.status !== "PENDENTE"` — but combining this read-time filter with D-04 ("lida = desaparece definitivamente") requires the query to still respect `lida: false` as the primary filter, and the `tarefa.status === "PENDENTE"` check is an *additional* AND-condition layered on top, not a replacement for checking `lida`. Getting the boolean composition wrong (e.g., an `OR` that accidentally surfaces read items because the tarefa is still pending) would resurrect notifications the user already dismissed.
**Why it happens:** D-04 and D-06 sound like they could conflict (D-04: once read, gone forever; D-06: avulsa stays until read OR tarefa concluded) but they don't — D-06 just adds a second "disappear" trigger (tarefa completion) alongside the existing "marked read" trigger from D-04. Both conditions must independently hide the row.
**How to avoid:** The read query must always start with `lida: false` as a hard AND-filter, with the `tarefa.status === "PENDENTE"` check for avulsa-type rows layered inside that already-`lida:false` result set (see the corrected query shape in Pattern 3 — `lida: false` is the outer AND, the `OR` only distinguishes vencendo/atrasada from avulsa for the *second* condition).
**Warning signs:** A test where an avulsa notification is marked read, then the underlying tarefa is separately concluded — if the notification reappears as unread after that, the boolean composition is wrong.

### Pitfall 4: `Notificacao.tarefaId` without `onDelete: Cascade` orphans rows when a tarefa is deleted
**What goes wrong:** `excluirTarefa` (already exists, `src/app/(app)/tarefas/actions.ts`) hard-deletes a `Tarefa` row. If `Notificacao.tarefaId` is a foreign key without `onDelete: Cascade`, deleting a tarefa that has associated notifications will throw a Prisma foreign-key-violation error, breaking the existing, already-shipped `excluirTarefa` action for any tarefa that has ever triggered a notification.
**Why it happens:** The existing `TarefaHistorico` model already solved this exact problem with `onDelete: Cascade` (see `prisma/schema.prisma` line ~163) — it is easy to forget to apply the same relation modifier to the new `Notificacao` model since it is added in a different phase by a different session.
**How to avoid:** Mirror `TarefaHistorico`'s relation declaration exactly: `tarefa Tarefa @relation(fields: [tarefaId], references: [id], onDelete: Cascade)`.
**Warning signs:** `excluirTarefasDaCompetenciaAtualAction` (bulk delete, already shipped) or `excluirTarefa` throwing a Prisma `P2003` foreign key constraint error in logs/tests after this phase ships, specifically for tarefas that have ever appeared in someone's notification dropdown.

### Pitfall 5: Forgetting the sidebar badge removal leaves a dangling unused prop/import
**What goes wrong:** D-10 requires removing `contadorAlertas` prop from `AppSidebar`, the badge JSX block, and the `contarAlertasTarefas` import/call in `layout.tsx`. If only the visual badge JSX is deleted but the prop type and the `contarAlertasTarefas()` call in `layout.tsx` remain, the codebase carries a now-meaningless unused query result (still queries the DB for a number nobody renders) and a confusing unused-but-still-required prop — `tsc --noEmit` may not catch an unused prop that's still passed and typed consistently end-to-end.
**Why it happens:** It's a 3-file deletion (`app-sidebar.tsx` JSX + prop type, `layout.tsx` import + call + prop-pass) and easy to do partially across separate edits.
**How to avoid:** Treat D-10 as a single atomic deletion task in the plan: remove `contarAlertasTarefas` export usage from `layout.tsx`, remove the `contadorAlertas` prop from `AppSidebarProps`, remove the badge `<span>` JSX block. Optionally also remove `contarAlertasTarefas` itself from `src/modules/tarefas/queries.ts` if nothing else calls it (confirm via grep before deleting the exported function, since other modules/dashboards might reuse it for unrelated counts).
**Warning signs:** `grep -r contarAlertasTarefas src/` returning a call site after the phase is "done."

## Code Examples

### Prisma model addition
```prisma
// Source: derived from D-01/D-03 of 10-CONTEXT.md, mirroring TarefaHistorico's
// onDelete: Cascade pattern (prisma/schema.prisma) and Tarefa's @@unique pattern
enum NotificacaoTipo {
  VENCENDO
  ATRASADA
  AVULSA_ATRIBUIDA
}

model Notificacao {
  id         String          @id @default(cuid())
  tarefaId   String
  tarefa     Tarefa          @relation(fields: [tarefaId], references: [id], onDelete: Cascade)
  usuarioId  String
  usuario    Usuario         @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  tipo       NotificacaoTipo
  lida       Boolean         @default(false)
  createdAt  DateTime        @default(now())

  @@unique([tarefaId, usuarioId, tipo])
  @@index([usuarioId, lida])
  @@map("notificacoes")
}
```
Also add the inverse relation to `Usuario` and `Tarefa` models (`notificacoes Notificacao[]`), mirroring how `tarefasResponsavel`/`historico` are declared today.

### Sync function (Server Component data-fetch, called from `layout.tsx`)
```typescript
// Source: pattern derived from src/modules/tarefas/geracao.ts (executarGeracaoMensal)
// adapted per D-02/D-03 of 10-CONTEXT.md
import { db } from "@/lib/db";
import { withTarefaScope, type SessionUser } from "@/lib/visibility-scope";

export async function sincronizarNotificacoes(user: SessionUser): Promise<void> {
  const tarefasPendentes = await db.tarefa.findMany({
    where: { ...withTarefaScope(user), status: "PENDENTE" },
    select: { id: true, prazo: true, status: true, tipoObrigacao: true, responsavelId: true },
  });

  const agora = new Date();
  const em3Dias = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000);

  const candidatos: { tarefaId: string; usuarioId: string; tipo: "VENCENDO" | "ATRASADA" | "AVULSA_ATRIBUIDA" }[] = [];

  for (const t of tarefasPendentes) {
    // NOTF-04: notification belongs to the tarefa's actual responsavel, not
    // the viewing user — DONO/CHEFE_SETOR sync candidates on behalf of every
    // responsavel in scope, never just themselves.
    if (t.prazo < agora) {
      candidatos.push({ tarefaId: t.id, usuarioId: t.responsavelId, tipo: "ATRASADA" });
    } else if (t.prazo <= em3Dias) {
      candidatos.push({ tarefaId: t.id, usuarioId: t.responsavelId, tipo: "VENCENDO" });
    }
    if (t.tipoObrigacao === null) {
      candidatos.push({ tarefaId: t.id, usuarioId: t.responsavelId, tipo: "AVULSA_ATRIBUIDA" });
    }
  }

  if (candidatos.length > 0) {
    await db.notificacao.createMany({ data: candidatos, skipDuplicates: true });
  }
}
```
**Critical nuance surfaced by writing this example:** since DONO's `withTarefaScope` returns `{}` (all tarefas), DONO's sync pass would, if not careful, attempt to create notifications addressed to *every responsável*, not just DONO. This is actually correct and desired per NOTF-04 ("dono vê notificações de todos") — the sync, when triggered by the DONO's page load, populates notifications for every colaborador's tarefas too. **Open question for the planner:** does this mean a colaborador's notification can be created as a side-effect of the DONO loading a page (before the colaborador ever visits)? Or should sync always run scoped to `usuarioId: user.id` candidates only, with DONO's *view* (not sync) pulling cross-user `Notificacao` rows that *colaboradores' own page loads* created? See Open Questions below — this is the single biggest design decision left for the planner.

### Mark-as-read Server Action
```typescript
// Source: pattern from src/app/(app)/tarefas/actions.ts (concluirTarefa) —
// same anti-IDOR findFirst-before-write shape
"use server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function marcarNotificacaoComoLidaAction(id: string) {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Não autenticado" };

  const existente = await db.notificacao.findFirst({
    where: { id, usuarioId: session.user.id }, // scoped to the OWNING user, not withTarefaScope
    select: { id: true },
  });
  if (!existente) return { ok: false, error: "não encontrado" };

  await db.notificacao.update({ where: { id }, data: { lida: true } });
  revalidatePath("/", "layout"); // re-renders AppLayout, refreshing the bell count
  return { ok: true };
}
```
Note: mark-as-read is scoped by `usuarioId: session.user.id` directly (the row's literal owner), not by `withTarefaScope` — a notification's owner is fixed at creation time and DONO marking their own notifications read should not accidentally mark a colaborador's notification read just because DONO's scope is `{}`. This is a deliberate divergence from the read/sync queries, which DO use `withTarefaScope` for the *listing* (DONO sees everyone's), but the *mutation* of "my notification is read" must stay personal. Cross-check against D-09 ("badge... não-lidas" — implies the badge for DONO must count DONO's own unread items reflecting all-scope visibility, separately from "did I personally read this row").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Live-calculated badge (`contarAlertasTarefas`, recomputed every render from `Tarefa` table) | Persisted `Notificacao` table with explicit read/unread state | This phase (D-01) | Enables D-04/D-05's "stays read forever unless patamar changes" semantics, which a live recalculation can never express (a live calc always reflects current Tarefa state, with no memory of "user already saw this") |
| Sidebar badge on "Tarefas" nav item | Header bell, app-wide | This phase (D-07/D-10) | Single source of truth for alert count; consistent across pages instead of scoped to the tarefas list page context |

**Deprecated/outdated:**
- `contarAlertasTarefas` (`src/modules/tarefas/queries.ts`): superseded as the badge's source of truth by `Notificacao`-table counts, per D-10. Function itself may remain if used elsewhere (verify via grep before deleting), but its sidebar call-site is removed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@radix-ui/react-scroll-area`'s exact version was not independently queried via `npm view` (only `@radix-ui/react-popover` was checked) — assumed to be in the same trust/maturity tier as the rest of the Radix UI monorepo. | Package Legitimacy Audit | Low risk: if the package were somehow malicious or abandoned, the shadcn CLI itself (already trusted, already used for 10+ other components in this codebase) would have surfaced an installation error; worth a `npm view @radix-ui/react-scroll-area version` sanity check during execution but not blocking for planning. |
| A2 | The DONO-triggers-sync-for-everyone-else's-notifications behavior (see Code Examples nuance) is the correct interpretation of NOTF-04 combined with D-02's "on-demand sync." CONTEXT.md does not explicitly resolve whether sync candidates should always be scoped to `usuarioId: user.id` regardless of who triggers it, or scoped to `withTarefaScope(user)`'s full visible set (DONO syncing for everyone). | Code Examples, Open Questions | High risk if wrong: if sync should ONLY ever create notifications for `user.id` (the person triggering the page load), then a colaborador who never logs in for a week would have zero notifications until their own next login — meaning DONO's "always knows status" success criterion (core value of the whole product, "o dono sempre sabe em tempo real o status de tudo") could be undermined if DONO's dashboard view doesn't ALSO trigger sync for the colaboradores DONO is viewing. This needs explicit planner/user resolution — see Open Questions. |
| A3 | `Notificacao` foreign keys (`tarefaId`, `usuarioId`) should both cascade-delete, mirroring `TarefaHistorico`. CONTEXT.md does not explicitly state cascade behavior for the new model. | Code Examples (Prisma model), Pitfall 4 | Medium risk: if `usuarioId` cascade is omitted and a `Usuario` row is ever hard-deleted (no current Server Action does this — `usuarios/actions.ts` only edits names, never deletes — but worth flagging), orphaned notification rows referencing a deleted user would violate referential integrity on any future user-deletion feature. |

## Open Questions (RESOLVED)

**Resolution (confirmed by user, recorded as D-11/D-12 in 10-CONTEXT.md, implemented in Plan 10-02):**
- **OQ1 → D-11:** Sync always assigns `usuarioId: t.responsavelId` (the tarefa's actual responsible person), regardless of who triggered the page load that ran the sync pass. Matches the recommendation below.
- **OQ2 → D-12:** `Notificacao.lida` is global per row, not per-viewer. DONO's list/count query is scoped via `withTarefaScope` on the `Notificacao.tarefa` relation (not literal `usuarioId`), and the **mark-as-read mutation uses the SAME `withTarefaScope`-based scoping — NOT literal `usuarioId: session.user.id` ownership**. This means DONO marking a colaborador's notification as read DOES affect that colaborador's own badge, which is the accepted/locked product behavior per D-12. This corrects the recommendation below (which proposed literal-ownership scoping for the mark-as-read mutation) — that proposal is superseded by the user's explicit D-12 confirmation. **PATTERNS.md's ownership-check guidance has been updated to match this resolution.**

1. **Who triggers sync for whom? (the DONO-visibility-vs-on-demand tension)**
   - What we know: D-02 says sync happens "a cada carregamento de página relevante" for "o usuário" (the logged-in user). NOTF-04 says DONO must see notifications for ALL colaboradores' tarefas.
   - What's unclear: If sync only ever creates `Notificacao` rows scoped to the *currently logged-in* user's own tarefas (via `withTarefaScope` returning `{ responsavelId: user.id }` for COLABORADOR), then DONO — whose `withTarefaScope` returns `{}` — would, on their own page load, generate notifications addressed to OTHER colaboradores (since the sync loop iterates `responsavelId` from the fetched tarefas, not `user.id`). This means a colaborador's notifications could be pre-populated by the DONO browsing the dashboard before the colaborador ever opens the app, OR could remain empty if DONO never visits before the colaborador does and the colaborador's own COLABORADOR-scoped sync (limited to their own tarefas, which is the same set) creates them on their own first visit anyway.
   - Recommendation: Resolve before/during planning — the safest interpretation (and the one modeled in the Code Examples sync function) is that the sync loop always assigns `usuarioId: t.responsavelId` (the tarefa's actual responsible person), regardless of who triggered the sync pass. This means ANY authenticated page load (by anyone whose scope includes that tarefa) can "discover" and persist a notification on behalf of its responsável. This is consistent with D-02's intent (idempotent, sync-on-access) and doesn't require DONO to "manually" generate colaborador notifications — colaboradores will always end up syncing their own on their own next visit regardless, and DONO's visits don't hurt by additionally pre-populating them sooner. Flag this resolution explicitly in the plan so the executor doesn't second-guess it.

2. **Badge count semantics for DONO/CHEFE_SETOR: total across all visible notifications, or only literally-theirs?**
   - What we know: D-09 says "Badge de contagem no sino mostra o número de notificações não-lidas." NOTF-04 says DONO sees notifications "de todos os setores e colaboradores."
   - What's unclear: Does DONO's bell count `Notificacao` rows where `usuarioId` is ANY user in DONO's scope (i.e., everyone, since DONO's scope is unrestricted), or only rows where `usuarioId === DONO's own id`? Since DONO has no tarefas of their own (DONO is "visão geral," not a `responsavelId` target in practice — though the schema doesn't forbid it), a literal "only mine" interpretation would always show DONO a near-zero badge, defeating the success criterion "DONO vê notificações de todos os setores e colaboradores."
   - Recommendation: DONO's (and CHEFE_SETOR's) notification *list/count* query should NOT filter by `usuarioId: user.id` at all — it should filter by the same `withTarefaScope`-equivalent join (`Notificacao.tarefa` matches the scope) rather than `Notificacao.usuarioId === me`. This is a meaningfully different query shape than the mark-as-read mutation (which IS scoped to literal ownership, since "lida" state is presumably per the destinatário's perspective when DONO reads someone else's notification — does it mark it read FOR the colaborador too, or just hide it from DONO's view?). **This sub-question (does DONO marking a colaborador's notification "read" affect the colaborador's own badge) is unresolved by CONTEXT.md and should be raised explicitly to the user during planning/discuss-phase if not already settled** — recommend defaulting to "lida is global per notification row, not per-viewer" (i.e., `Notificacao.lida` is a single boolean, and if DONO reads it, it's read for everyone who could see it, including the colaborador) since the schema as designed (D-03's unique key) models one notification row per (tarefa, usuario, tipo) where `usuario` is the tarefa's responsável — meaning DONO viewing it IS viewing the colaborador's notification row directly, not a separate DONO-owned copy. Under this model, DONO marking it read does affect the colaborador's badge too. This should be explicitly confirmed as acceptable product behavior before implementation, since it's a real UX implication not explicitly discussed in CONTEXT.md.

## Environment Availability

> Skipped — this phase has no external service/tool dependency beyond what's already provisioned (Postgres via Neon, Node runtime, npm/shadcn CLI already used throughout the project). No new environment variable, API key, or infrastructure dependency is introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (already configured, `vitest.config.ts` present) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/notificacoes.sync.test.ts` (new file, to be created in Wave 0) |
| Full suite command | `npm test` (runs `vitest run`, currently exercises 30+ test files including `tarefas.idor.test.ts`, `visibility-scope.test.ts`, `geracao.idempotencia.test.ts` — direct structural analogues to this phase's needs) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTF-01 | Sync creates a VENCENDO notification for a tarefa due within 3 days | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "vencendo"` | ❌ Wave 0 |
| NOTF-02 | Sync creates an ATRASADA notification for an overdue tarefa | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "atrasada"` | ❌ Wave 0 |
| NOTF-03 | Sync creates an AVULSA_ATRIBUIDA notification for a tarefa with `tipoObrigacao: null` | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "avulsa"` | ❌ Wave 0 |
| NOTF-04 | COLABORADOR's sync/read query only includes their own tarefas; DONO's includes all | unit | `npx vitest run tests/notificacoes.idor.test.ts` | ❌ Wave 0 |
| D-03 (idempotency) | Re-running sync twice does not duplicate the same (tarefaId, usuarioId, tipo) row | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "idempot"` | ❌ Wave 0 |
| D-04/D-05 (read lifecycle, patamar change) | Marking read hides the notification; tarefa transitioning vencendo→atrasada creates a NEW unread notification despite the old one being read | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "patamar"` | ❌ Wave 0 |
| D-06 (avulsa lifecycle) | Avulsa notification disappears from unread list once tarefa is concluded, without being explicitly marked read | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "conclusao"` | ❌ Wave 0 |
| D-10 (sidebar badge removed) | `AppSidebar` no longer renders a badge span; `contadorAlertas` prop removed | manual/visual | n/a — covered by `tsc --noEmit` (no orphaned prop type) + manual review | ❌ Wave 0 (visual, see UI-SPEC checker sign-off) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/notificacoes.*.test.ts`
- **Per wave merge:** `npm test` (full suite, ensures no regression in `visibility-scope.test.ts`, `tarefas.idor.test.ts`)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/notificacoes.sync.test.ts` — covers NOTF-01/02/03, D-03 idempotency, D-05 patamar-change
- [ ] `tests/notificacoes.idor.test.ts` — covers NOTF-04 visibility scoping for sync candidates and read queries, mirroring `tests/tarefas.idor.test.ts`'s mock-based pattern (`vi.mock("@/lib/db")`, `vi.mock("@/auth")`)
- [ ] `tests/notificacoes.read-action.test.ts` — covers mark-as-read Server Action anti-IDOR (scoped by `usuarioId`, not `withTarefaScope`) and D-06 conclusion-based disappearance
- Framework install: none — Vitest already configured project-wide

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | `auth()` guard as first check in every new Server Action, exactly matching `concluirTarefa`/`excluirTarefa` pattern — already established, not new for this phase |
| V3 Session Management | yes (inherited) | Auth.js v5 JWT session, `session.user.id`/`role`/`setor` — no change needed, already covers this phase's needs |
| V4 Access Control | yes | This is the CENTRAL concern of NOTF-04 — `withTarefaScope` reuse for listing/sync, literal `usuarioId` ownership check for mark-as-read mutation (see Code Examples note on the deliberate divergence) |
| V5 Input Validation | yes | Mark-as-read Server Action takes a notification `id` (string) as its only input — validate it is a non-empty string before the `findFirst` lookup; no Zod schema strictly required for a single-id action (matches the existing `concluirTarefa(id: string)` pattern, which also has no Zod schema, just a `findFirst` ownership check) |
| V6 Cryptography | no | No new secrets, tokens, or cryptographic operations introduced by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on mark-as-read (colaborador marks another colaborador's notification as read by guessing/enumerating IDs) | Tampering / Information Disclosure | `findFirst({ where: { id, usuarioId: session.user.id } })` before any `update` — exact anti-IDOR pattern already used in `concluirTarefa`/`excluirTarefa`/`salvarMotivoPendencia`. **Critical: do NOT use `withTarefaScope` for this check** — see Code Examples note; ownership of a notification row is always literal `usuarioId`, since `withTarefaScope` for DONO returns `{}` and would let DONO "mark read" by id without an actual ownership check being meaningful (acceptable for DONO per the resolved Open Question 2, but the implementation must be a conscious choice, not an accidental side-effect of reusing the wrong scope helper) |
| Sync function trusting client input for `usuarioId`/`tarefaId` | Tampering / Elevation of Privilege | Sync is 100% server-derived — `usuarioId` always comes from `tarefa.responsavelId` (a DB-read value), never from request body/query string; no client-callable "create notification" action should ever exist |
| Cross-tenant notification leakage via Popover SSR/CSR hydration mismatch | Information Disclosure | Initial notification list passed as a prop from the Server Component (`AppLayout`) is already scoped server-side before serialization — no client-side fetch of "all notifications" ever occurs, so there is no window where over-broad data reaches the browser before client-side filtering (which would be a real bug pattern: fetch-all-then-filter-on-client is forbidden here, exactly as the existing `TAREFA_SELECT` explicit-fields discipline already guards against over-fetching) |

## Sources

### Primary (HIGH confidence)
- `src/lib/visibility-scope.ts` (direct codebase read) — exact `withTarefaScope`/`withVisibilityScope` signatures and DONO/CHEFE_SETOR/COLABORADOR branching logic
- `src/lib/alert-prazo.ts` (direct codebase read) — exact 3-day threshold logic (`calcularAlertaPrazo`) already validated for NOTF-01/02's "mesmo limiar" requirement
- `prisma/schema.prisma` (direct codebase read) — exact `Tarefa`, `Usuario`, `TarefaHistorico` model shapes, existing `@@unique`/`onDelete: Cascade` conventions to mirror
- `src/modules/tarefas/queries.ts`, `src/app/(app)/tarefas/actions.ts` (direct codebase read) — exact Server Component/Server Action patterns, anti-IDOR `findFirst`-before-write convention, `contarAlertasTarefas`'s current implementation (the function being superseded)
- `src/app/(app)/layout.tsx`, `src/app/(app)/app-sidebar.tsx` (direct codebase read) — exact integration points for the bell (D-07) and the badge removal (D-10)
- `src/lib/scheduler.ts` (direct codebase read) — confirms the only existing cron infra and why D-02 explicitly avoids extending it
- `npm view @radix-ui/react-popover version` (tool-verified) — confirms `1.1.17` exists on the npm registry [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- shadcn CLI auto-resolving transitive Radix dependencies for `popover`/`scroll-area` — based on observed project convention (`components.json`, existing installed components) rather than independently re-verified for this specific pair of components in this session [CITED: ui.shadcn.com CLI install behavior, consistent with project's existing pattern]

### Tertiary (LOW confidence)
- None — all claims in this research are either direct codebase reads or a single registry-verified package check.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new runtime libraries beyond the existing, already-adopted shadcn pattern; the one new transitive package was registry-verified
- Architecture: HIGH — entirely reuse of already-tested, already-documented helpers (`withTarefaScope`, `calcularAlertaPrazo`, the `createMany`/`skipDuplicates` idempotency pattern); CONTEXT.md left almost no open architectural decisions
- Pitfalls: HIGH — all five pitfalls are derived directly from concrete schema/code inspection (existing `TarefaHistorico` cascade pattern, existing `@@unique` shape, existing D-04/D-05/D-06 wording), not speculative

**Research date:** 2026-06-29
**Valid until:** 2026-07-29 (30 days — stable stack, no fast-moving dependency in this phase's scope)
