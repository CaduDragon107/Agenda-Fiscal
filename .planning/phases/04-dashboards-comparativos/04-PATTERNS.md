# Phase 4: Dashboards Comparativos - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 11
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prisma/schema.prisma` (+ `model DesempenhoMensal`) | model | CRUD (write-once, append-only) | `model Tarefa` / `model TarefaHistorico` (same file) | exact |
| `src/modules/dashboards/snapshot.ts` (NEW — `calcularSnapshotMensal`) | service | batch (aggregate + write) | `src/modules/tarefas/geracao.ts` (`executarGeracaoMensal`) | exact |
| `src/modules/tarefas/geracao.ts` (MODIFIED — call snapshot before generating new month) | service | batch / event-driven (cron-triggered) | itself (same file, extend in place) | exact |
| `src/modules/dashboards/queries.ts` (NEW — `listarDesempenhoColaboradoresMesAtual`, `listarEvolucaoMensal`, `listarRankingEmpresas`) | service (query module) | CRUD (read/aggregate) | `src/modules/tarefas/queries.ts` | exact |
| `src/modules/dashboards/schema.ts` (NEW — zod for `?meses=` param) | utility (validation schema) | request-response | `src/lib/competencia.ts` (`competenciaSchema`) | exact |
| `src/app/(app)/dashboards/page.tsx` (NEW) | route (Server Component page) | request-response | `src/app/(app)/tarefas/page.tsx` | exact |
| `src/app/(app)/dashboards/desempenho-colaboradores-chart.tsx` (NEW) | component (client chart) | transform (props → SVG) | none in-repo (first chart component) — shadcn docs / RESEARCH.md Pattern 4 | no analog (new pattern) |
| `src/app/(app)/dashboards/evolucao-mensal-chart.tsx` (NEW) | component (client chart) | transform | none in-repo — RESEARCH.md Pattern 5 | no analog (new pattern) |
| `src/app/(app)/dashboards/ranking-empresas-table.tsx` (NEW — table + optional top-N bar chart) | component | CRUD (display) / transform | `src/app/(app)/tarefas/tarefas-table.tsx` | role-match (table half), no analog (chart half) |
| `src/app/(app)/app-sidebar.tsx` (MODIFIED — enable "Dashboards" nav item, DONO-only) | component (nav) | request-response | itself (same file, "Tarefas" `SidebarMenuItem` block) | exact |
| `tests/dashboards.snapshot.test.ts`, `tests/dashboards.queries.test.ts`, `tests/dashboards.rbac.test.ts` (NEW) | test | batch (unit, mocked db) | `tests/geracao.idempotencia.test.ts`, `tests/tarefas.queries.test.ts`, `tests/tarefas.idor.test.ts` | exact |

## Pattern Assignments

### `prisma/schema.prisma` — `model DesempenhoMensal`

**Analog:** `model Tarefa` / `model TarefaHistorico` (same file, lines 88-125)

**Naming/shape conventions to copy** (lines 38-125 — `Usuario`, `Tarefa`, `TarefaHistorico`):
```prisma
model Tarefa {
  id            String       @id @default(cuid())
  ...
  competencia   String?
  ...
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

model TarefaHistorico {
  id             String   @id @default(cuid())
  tarefaId       String
  tarefa         Tarefa   @relation(fields: [tarefaId], references: [id], onDelete: Cascade)
  ...
  @@index([tarefaId])
  @@map("tarefa_historico")
}
```

**Apply:** `cuid()` ids, `@@map("snake_case")`, explicit `@@index` on every FK/filter column, `@@unique([...])` for idempotency keys (mirrors how `Tarefa` presumably has `@@unique([empresaId, tipoObrigacao, competencia])` per `geracao.ts` comments). `DesempenhoMensal` should use `@@unique([competencia, colaboradorId])` + `@@index([competencia])` + `@@index([colaboradorId])`, exactly the RESEARCH.md Pattern 1 schema — already vetted against this file's conventions.

---

### `src/modules/dashboards/snapshot.ts` (NEW)

**Analog:** `src/modules/tarefas/geracao.ts` (full file, 52 lines)

**Header-comment convention** (lines 1-18):
```typescript
/**
 * src/modules/tarefas/geracao.ts
 *
 * Orquestração do motor de geração mensal: ...
 * CRÍTICO: esta função NUNCA chama `withTarefaScope`/`withVisibilityScope`
 * — o cron não tem usuário autenticado; ...
 */
```
**Apply:** `snapshot.ts` should open with the same style comment explaining: pure-ish aggregation function, takes `tx` (Prisma transaction client) as a parameter (per RESEARCH.md Pattern 3), never calls `withTarefaScope`/`withVisibilityScope` (cron has no session user).

**Core orchestration pattern** (lines 23-51 — `executarGeracaoMensal`):
```typescript
export async function executarGeracaoMensal(
  competencia: string
): Promise<{ criadas: number; puladas: number }> {
  return db.$transaction(async (tx) => {
    const empresas = await tx.empresa.findMany({
      where: { ativo: true },
      select: { id: true, regimeTributario: true, responsavelId: true },
    });
    const tarefas = gerarTarefasDoMes(empresas, competencia);
    if (tarefas.length === 0) return { criadas: 0, puladas: 0 };
    const resultado = await tx.tarefa.createMany({
      data: tarefas.map((t) => ({ ...t, status: "PENDENTE" as const })),
      skipDuplicates: true, // apoia-se em @@unique([...])
    });
    return { criadas: resultado.count, puladas: tarefas.length - resultado.count };
  });
}
```
**Apply:** `calcularSnapshotMensal(tx, competencia)` should be a function accepting `tx` directly (not wrapping its own `$transaction` — the caller, `executarGeracaoMensal`, owns the transaction boundary, per RESEARCH.md Pattern 3). It separates pure calculation from I/O the same way `gerarTarefasDoMes` (pure, in `src/lib/geracao-tarefas.ts`) is separated from `executarGeracaoMensal` (I/O orchestration) — keep `calcularSnapshotMensal` itself doing the read+aggregate, return row data, and let the caller do `tx.desempenhoMensal.createMany({ data, skipDuplicates: true })` exactly like `tx.tarefa.createMany` above.

---

### `src/modules/tarefas/geracao.ts` (MODIFIED)

**Analog:** itself — extend the existing `executarGeracaoMensal` transaction body (lines 23-51, reproduced above).

**Apply:** Insert the snapshot-close-out step as the FIRST statement inside the same `db.$transaction(async (tx) => {...})` callback, before the existing `tx.empresa.findMany` for the new month — see RESEARCH.md Pattern 3 for the exact `competenciaAnterior` computation via `subMonths`/`format` (reuses `date-fns`, same library already imported project-wide per `src/lib/competencia.ts`). Do not create a second `$transaction` call — one atomic transaction covers both writes, matching the project's existing atomicity convention (`concluirTarefa` in `tarefas/actions.ts` does `update` + `historico.create` in one `db.$transaction([...])`).

---

### `src/modules/dashboards/queries.ts` (NEW)

**Analog:** `src/modules/tarefas/queries.ts` (full file, 115 lines)

**Imports pattern** (lines 1-2):
```typescript
import { db } from "@/lib/db";
import { withTarefaScope, type SessionUser } from "@/lib/visibility-scope";
```
**Apply:** dashboards queries import `db` the same way; import `type SessionUser` from `@/lib/visibility-scope` for the role-check parameter type, even though dashboards don't need `withTarefaScope`'s row-filtering (DONO-only, not per-row scoping) — see Shared Patterns below for the actual role guard to apply instead.

**Explicit-select convention** (lines 11-56 — `TAREFA_SELECT`):
```typescript
const TAREFA_SELECT = {
  id: true,
  ...
  responsavel: { select: { id: true, nome: true } }, // NEVER `responsavel: true` (would include senhaHash)
} as const;
```
**Apply:** Any dashboard query selecting `Usuario`/`colaborador` relations MUST use `select: { id: true, nome: true }` explicitly — never `colaborador: true` — same anti-leak rule, critical since `DesempenhoMensal.colaborador` is a relation to `Usuario`.

**Function-per-query convention with JSDoc** (lines 58-74 — `listarTarefas`):
```typescript
/**
 * Lista tarefas visíveis para o usuário autenticado.
 *
 * CRITICAL (AUTH-02 / T-02-IDOR): SEMPRE espalha withTarefaScope(user) no
 * `where` — ...
 */
export async function listarTarefas(user: SessionUser) {
  return db.tarefa.findMany({
    where: { ...withTarefaScope(user) },
    orderBy: { prazo: "asc" },
    select: TAREFA_SELECT,
  });
}
```
**Apply:** `listarDesempenhoColaboradoresMesAtual`, `listarEvolucaoMensal`, `listarRankingEmpresas` each follow this one-exported-function-per-query-with-JSDoc-explaining-the-critical-rule shape. The "CRITICAL" comment block should explain the D-05 freeze rule instead of IDOR (e.g., "CRÍTICO (D-05): para competências fechadas, lê exclusivamente `db.desempenhoMensal` — nunca recalcula a partir de `Tarefa`/`TarefaHistorico`").

---

### `src/modules/dashboards/schema.ts` (NEW)

**Analog:** `src/lib/competencia.ts` (full file, 26 lines)

```typescript
import { z } from "zod";

export const competenciaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência deve estar no formato YYYY-MM");
```
**Apply:** Mirror exactly — a single `z.string()`/`z.coerce.number()` schema with a clear error message, exported as a `const`, for validating `?meses=` query param on the DASH-02 period selector. No class-based validators, no manual regex inlined elsewhere — always export the compiled schema from a small dedicated module the way `competenciaSchema` is exported from `competencia.ts`.

---

### `src/app/(app)/dashboards/page.tsx` (NEW)

**Analog:** `src/app/(app)/tarefas/page.tsx` (full file, 36 lines)

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarTarefas } from "@/modules/tarefas/queries";
...

export default async function TarefasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [tarefas, responsaveis, empresas] = await Promise.all([
    listarTarefas(session.user),
    listarResponsaveis(),
    listarEmpresas(session.user),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tarefas</h1>
        ...
      </div>
      <TarefasTable ... />
    </div>
  );
}
```
**Apply:** Same `async function DashboardsPage()` Server Component shape — `auth()` first, then a role guard (see Shared Patterns: DONO-only uses `notFound()` per UI-SPEC, not `redirect`), then `Promise.all([...])` to fetch the 3 datasets in parallel (mirrors fetching `tarefas`/`responsaveis`/`empresas` in parallel here), then render a `<div className="flex flex-col gap-6 p-6">` page shell with `<h1 className="text-xl font-semibold">` heading — exact Tailwind classes to reuse for "Dashboards" / "Visão geral de desempenho..." per UI-SPEC.md.

---

### `src/app/(app)/dashboards/desempenho-colaboradores-chart.tsx`, `evolucao-mensal-chart.tsx` (NEW)

**No in-repo analog** — first Recharts/shadcn `chart` usage in this codebase. Use RESEARCH.md Pattern 4 (bar chart) and Pattern 5 (trend line/area) verbatim as the canonical code to copy — both already adapted to this project's `var(--chart-N)` (no `hsl()` wrapper) CSS-variable convention and explicit `min-h-[260px]` sizing per UI-SPEC.md spacing exception.

**`"use client"` convention to copy from elsewhere in repo** (e.g. `tarefas-table.tsx` line 1, `gerar-tarefas-button.tsx` line 1):
```typescript
"use client";

import { useState } from "react";
```
**Apply:** Every chart component file starts with `"use client";` as the literal first line — matches every interactive component in this codebase (`tarefas-table.tsx`, `gerar-tarefas-button.tsx`, `app-sidebar.tsx`). Server Component (`page.tsx`) fetches/aggregates data and passes plain serializable props down — never fetch inside a chart component.

---

### `src/app/(app)/dashboards/ranking-empresas-table.tsx` (NEW)

**Analog (table half):** `src/app/(app)/tarefas/tarefas-table.tsx` (lines 1-50, 173-308, 371-401 — imports, `ColumnDef` setup, `useReactTable`, `<Table>` JSX)

```typescript
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
...
const table = useReactTable({
  data: dadosFiltrados,
  columns,
  state: { sorting, pagination: { pageIndex, pageSize: 20 } },
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  manualPagination: false,
});
```
**Apply:** Reuse this exact TanStack Table wiring for the full ~100-110 empresa ranking list (sortable by `% de atraso`, no manual pagination needed at this scale per RESEARCH.md Pattern 7 / UI-SPEC.md). Column headers from UI-SPEC.md: "Empresa" / "% de atraso" / "Total de tarefas". Read-only (no checkbox/delete/edit columns — this phase has zero mutations on `Tarefa`/`Empresa`).

**Badge convention for "atrasado" indicator** (`PrazoCell`, lines 85-98 of `tarefas-table.tsx`):
```typescript
function PrazoCell({ tarefa }: { tarefa: TarefaRow }) {
  const alerta = calcularAlertaPrazo(tarefa.prazo, tarefa.status);
  return (
    <span className={`flex items-center gap-1.5 ${alerta.textClass}`}>
      {alerta.label && <Badge className={alerta.badgeClass}>{alerta.label}</Badge>}
      ...
    </span>
  );
}
```
**Apply:** For a high-`percentualAtraso` row, reuse `Badge variant="destructive"` (per UI-SPEC.md, not the custom red `badgeClass` from `alert-prazo.ts` — UI-SPEC explicitly calls for the standard shadcn `Badge` `variant="destructive"` token here, simpler than `calcularAlertaPrazo`'s bespoke classes since this is a percentage, not a date comparison).

---

### `src/app/(app)/app-sidebar.tsx` (MODIFIED)

**Analog:** itself — the existing "Tarefas" `SidebarMenuItem` block (lines 91-106) and the already-present disabled "Dashboards" placeholder (lines 107-112).

```tsx
<SidebarMenuItem>
  <SidebarMenuButton asChild isActive={pathname?.startsWith("/tarefas")}>
    <Link href="/tarefas">
      <ListChecks />
      <span>Tarefas</span>
      {contadorAlertas > 0 && (
        <span className="ml-auto bg-destructive text-destructive-foreground text-xs ...">
          {contadorAlertas > 99 ? "99+" : contadorAlertas}
        </span>
      )}
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
<SidebarMenuItem>
  <SidebarMenuButton disabled>
    <LayoutDashboard />
    <span>Dashboards</span>
  </SidebarMenuButton>
</SidebarMenuItem>
```
**Apply:** Replace the `disabled` placeholder block with the same `asChild`/`Link`/`isActive={pathname?.startsWith("/dashboards")}` shape used for "Tarefas", AND wrap the whole `SidebarMenuItem` in `{isDono && (...)}` (the file already computes `const isDono = user.role === "DONO";` on line 55) so COLABORADOR never sees the nav item at all — defense in depth per RESEARCH.md, the real gate is server-side in `page.tsx`. `LayoutDashboard` icon import already exists (line 6) — no new import needed.

## Shared Patterns

### DONO-only role guard (server-side, first statement after `auth()`)
**Source:** `src/app/(app)/tarefas/actions.ts`, `gerarTarefasDoMesAction` (lines 284-294)
**Apply to:** `dashboards/page.tsx` and every function in `dashboards/queries.ts`
```typescript
const session = await auth();
if (!session?.user) {
  return { ok: false, error: "Não autenticado" };
}
if (session.user.role !== "DONO") {
  return { ok: false, error: "não autorizado" };
}
```
For the Server Component page specifically, UI-SPEC.md mandates `notFound()` (404) instead of a redirect/error object — matching the project's anti-IDOR convention ("não encontrado, never 403") already used on Phase 1's empresa edit page:
```typescript
import { notFound } from "next/navigation";
const session = await auth();
if (!session?.user) redirect("/login");
if (session.user.role !== "DONO") notFound();
```

### Idempotent snapshot write (`createMany` + `@@unique` + `skipDuplicates`)
**Source:** `src/modules/tarefas/geracao.ts` line 43 + `tests/geracao.idempotencia.test.ts` (entire file)
**Apply to:** `src/modules/dashboards/snapshot.ts` — `tx.desempenhoMensal.createMany({ data: snapshots, skipDuplicates: true })` against `@@unique([competencia, colaboradorId])`. Mirror the idempotency test structure exactly: mock `@/lib/db` with a `tx` object exposing only the methods used, run the function twice with the same competência, assert the second run's effective writes are zero/skipped.

### Atomic multi-write via `db.$transaction`
**Source:** `src/app/(app)/tarefas/actions.ts`, `concluirTarefa` (lines 148-160) and `src/modules/tarefas/geracao.ts` (lines 26-50)
**Apply to:** the modified `executarGeracaoMensal` — snapshot write and new-month task generation happen inside ONE `db.$transaction(async (tx) => {...})` callback, never two separate transactions.

### Explicit `select` — never `relation: true` for `Usuario`
**Source:** `src/modules/tarefas/queries.ts`, `TAREFA_SELECT` (lines 11-56), comment lines 6-9
**Apply to:** every dashboard query touching `colaborador`/`responsavel` (a `Usuario` relation) — always `select: { id: true, nome: true }`, never bare `colaborador: true` (would leak `senhaHash`).

### Canonical competência format via `date-fns`, never manual string concat
**Source:** `src/lib/competencia.ts` (full file)
**Apply to:** `calcularSnapshotMensal`'s `competenciaAnterior` computation and any DASH-02 month-range math — always `format(subMonths(...), "yyyy-MM")`, never `${year}-${month}` string building (Pitfall 1 in RESEARCH.md documents exactly this risk).

### Zod validation of any user-facing query param before it reaches Prisma/date-fns
**Source:** `src/lib/competencia.ts` (`competenciaSchema`) + usage in `tarefas/actions.ts` line 298 (`competenciaSchema.safeParse(competencia)`)
**Apply to:** DASH-02's `?meses=6` period selector — validate via a new schema in `dashboards/schema.ts` before passing into `subMonths`/Prisma `where`.

### Error-result objects, never thrown exceptions, for Server Actions
**Source:** `src/app/(app)/tarefas/actions.ts`, `AcaoTarefaResult`/`AcaoGeracaoResult` types (lines 14-27) and every action's `try { ... } catch { return { ok: false, error: "..." } }` shape
**Apply to:** any Server Action introduced for the period selector (if implemented as a Server Action rather than a search-param-driven Server Component re-render) — same `{ ok: true, data } | { ok: false, error }` discriminated union shape.

### `"use client"` boundary discipline
**Source:** `src/app/(app)/tarefas/tarefas-table.tsx` line 1, `src/app/(app)/tarefas/gerar-tarefas-button.tsx` line 1, `src/app/(app)/app-sidebar.tsx` line 1
**Apply to:** all 3 new chart components and the ranking table component — `"use client"` as the literal first line; all data fetching/aggregation/auth happens in the parent Server Component (`page.tsx`) and is passed down as plain props.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/app/(app)/dashboards/desempenho-colaboradores-chart.tsx` | component | transform | First Recharts/shadcn `chart` usage in this codebase — no prior chart component exists to copy from. Use RESEARCH.md Pattern 4 (already adapted to this project's `var(--chart-N)` token convention) as the canonical source instead. |
| `src/app/(app)/dashboards/evolucao-mensal-chart.tsx` | component | transform | Same as above — use RESEARCH.md Pattern 5. |
| `src/components/ui/chart.tsx` | component (generated) | transform | Generated by `npx shadcn add chart` CLI, not hand-written — no in-repo analog needed; do not hand-author this file. |

## Metadata

**Analog search scope:** `src/modules/`, `src/app/(app)/`, `src/lib/`, `tests/`, `prisma/schema.prisma`
**Files scanned:** `geracao.ts`, `queries.ts` (tarefas), `visibility-scope.ts`, `competencia.ts`, `alert-prazo.ts`, `app-sidebar.tsx`, `tarefas/page.tsx`, `tarefas/actions.ts`, `tarefas/tarefas-table.tsx`, `tarefas/gerar-tarefas-button.tsx`, `schema.prisma` (model definitions), `tests/geracao.idempotencia.test.ts`
**Pattern extraction date:** 2026-06-22
