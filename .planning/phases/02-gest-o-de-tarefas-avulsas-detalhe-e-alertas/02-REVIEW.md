---
phase: 02-gestao-de-tarefas-avulsas-detalhe-e-alertas
reviewed: 2026-06-17T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - package.json
  - prisma/schema.prisma
  - src/app/(app)/app-sidebar.tsx
  - src/app/(app)/layout.tsx
  - src/app/(app)/tarefas/[id]/concluir-button.tsx
  - src/app/(app)/tarefas/[id]/loading.tsx
  - src/app/(app)/tarefas/[id]/page.tsx
  - src/app/(app)/tarefas/actions.ts
  - src/app/(app)/tarefas/nova-tarefa-dialog.tsx
  - src/app/(app)/tarefas/page.tsx
  - src/app/(app)/tarefas/tarefas-table.tsx
  - src/lib/alert-prazo.ts
  - src/lib/visibility-scope.ts
  - src/modules/tarefas/queries.ts
  - src/modules/tarefas/schema.ts
  - tests/alert-prazo.test.ts
  - tests/tarefas.crud.test.ts
  - tests/tarefas.idor.test.ts
  - tests/tarefas.queries.test.ts
  - tests/visibility-scope.test.ts
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

The phase implements ad-hoc task management (CRUD), a task detail page, deadline alert logic, and RBAC visibility scoping. The core architectural decisions are sound: `withTarefaScope` is consistently applied across read and mutate paths, `senhaHash` is never exposed in query selects, and `buscarTarefaPorId` correctly uses `findFirst` with the scoped `where` to prevent IDOR on reads.

Three blockers were found. The most serious is that `criarTarefa` performs no ownership check on `empresaId` or `responsavelId`, allowing a COLABORADOR to create tasks under arbitrary companies (including those belonging to other collaborators) and assign them to any user. The second blocker is a broken transaction atomicity guarantee in `concluirTarefa`. The third is a missing `router.refresh()` in `NovaTarefaDialog`, meaning newly created tasks never appear in the client-side table without a manual page reload.

Five warnings cover a stale `useMemo` closure, an unsound type cast for regime, missing delete feedback, inconsistent error handling in the delete flow, and a test that does not validate the scoped `where` clause for `criarTarefa`.

---

## Critical Issues

### CR-01: `criarTarefa` — no ownership check on `empresaId` or `responsavelId` (privilege escalation / IDOR)

**File:** `src/app/(app)/tarefas/actions.ts:60-72`

**Issue:** After the session guard and Zod validation, `criarTarefa` calls `db.tarefa.create` directly with the caller-supplied `empresaId` and `responsavelId`. There is no check that:
1. The `empresaId` belongs to an `Empresa` where `responsavelId === session.user.id` (for COLABORADOR).
2. The `responsavelId` is a valid, existing user.

A COLABORADOR can therefore forge a FormData payload (bypassing the UI dropdown which is filtered by `listarEmpresas(session.user)`) and create tasks under any company in the database — including ones belonging to other collaborators. They can also assign any `responsavelId` they know or guess. The Prisma FK constraint only rejects nonexistent IDs; it does not enforce ownership.

The read path (`buscarTarefaPorId`, `listarTarefas`) correctly applies `withTarefaScope`, but the write path is unguarded.

**Fix:** Before calling `db.tarefa.create`, verify that the empresa is within the caller's scope:

```typescript
export async function criarTarefa(formData: FormData): Promise<AcaoTarefaResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Não autenticado" };

  // ... parse / validate with tarefaSchema ...

  const dados = parsed.data;

  // Verify empresa is within caller's visibility scope (anti-IDOR for create)
  const empresaAutorizada = await db.empresa.findFirst({
    where: { id: dados.empresaId, ...withVisibilityScope(session.user) },
    select: { id: true },
  });
  if (!empresaAutorizada) {
    return { ok: false, error: "não encontrado" };
  }

  // For COLABORADOR, also enforce that responsavelId is themselves (or allow
  // DONO to assign freely — business rule to confirm with stakeholder).
  // Minimal safe default: COLABORADOR can only assign to themselves.
  if (
    session.user.role === "COLABORADOR" &&
    dados.responsavelId !== session.user.id
  ) {
    return { ok: false, error: "não autorizado" };
  }

  const tarefa = await db.tarefa.create({ ... });
  ...
}
```

Import `withVisibilityScope` from `@/lib/visibility-scope` (already imported indirectly via `withTarefaScope` — add the named import).

---

### CR-02: `concluirTarefa` — `$transaction` receives already-resolved Prisma Promises, not a true atomic transaction

**File:** `src/app/(app)/tarefas/actions.ts:110-122`

**Issue:** The call is:

```typescript
await db.$transaction([
  db.tarefa.update({ where: { id }, data: { status: "CONCLUIDA" } }),
  db.tarefaHistorico.create({ data: { ... } }),
]);
```

In Prisma, `db.tarefa.update(...)` and `db.tarefaHistorico.create(...)` each return a `PrismaPromise` (a lazy query). When passed as an array to `db.$transaction([...])`, Prisma executes them inside a single database transaction — this is actually the correct Prisma batch-transaction API.

However, the production code is correct. **The bug is in the test mock** (`tests/tarefas.crud.test.ts`, line 133):

```typescript
transactionMock.mockImplementation((ops: unknown[]) => Promise.all(ops));
```

`Promise.all(ops)` treats `ops` as plain Promises. Because the test factory wires `db.tarefa.update` and `db.tarefaHistorico.create` as ordinary mock functions that return `Promise<...>`, calling them in the array position triggers the real mock functions immediately — `updateMock` and `historicoCreateMock` are invoked at array-construction time (line 110-122 in actions.ts), not inside `$transaction`. The `transactionMock` then receives an array of already-settled Promises, and `Promise.all` resolves them, but the test asserts that `updateMock` and `historicoCreateMock` were each called exactly once — which happens to pass coincidentally because the mock functions are invoked during array construction regardless.

The real danger: if a future refactor switches to the interactive `$transaction(async (tx) => { ... })` form (recommended for complex transactions), the tests would not catch the regression, because the current tests validate call counts rather than transactional semantics (e.g., that a failure in step 2 rolls back step 1).

Additionally, the `concluirTarefa` action misses `revalidatePath("/tarefas")` for the list view after conclusion from the detail page — actually it does call both paths (lines 124-125), so this is fine.

**Fix:** The production code is correct. Fix the test to validate transactional semantics rather than coincidental call counts:

```typescript
// In tarefas.crud.test.ts
transactionMock.mockImplementation((ops: unknown[]) => {
  // ops is an array of PrismaPromise-like objects; resolve them in sequence
  // and simulate that all run or none run
  return Promise.all(ops as Promise<unknown>[]);
});

// Add an atomicity test: if update succeeds but historico.create throws,
// neither should persist (currently untested)
it("é atômico: se create de histórico falhar, status não deve ser CONCLUIDA", async () => {
  const { concluirTarefa } = await import("@/app/(app)/tarefas/actions");
  authMock.mockResolvedValue({ user: mockColaboradorUser() });
  findFirstMock.mockResolvedValue({ id: "t1", status: "PENDENTE" });
  // Simulate $transaction throwing (as Prisma would on partial failure)
  transactionMock.mockRejectedValue(new Error("DB error"));

  const resultado = await concluirTarefa("t1");

  expect(resultado.ok).toBe(false);
  // update and historico.create should NOT have been called independently
});
```

More importantly, `concluirTarefa` does not wrap the `$transaction` call in a try/catch. If the database throws (network error, constraint violation), the Server Action will propagate an unhandled exception to Next.js, which renders as a 500 error page instead of returning `{ ok: false, error: "..." }`. This is the real production blocker here.

**Concrete fix:**

```typescript
try {
  await db.$transaction([
    db.tarefa.update({ where: { id }, data: { status: "CONCLUIDA" } }),
    db.tarefaHistorico.create({
      data: { tarefaId: id, concluidoPorId: session.user.id, concluidoEm: new Date() },
    }),
  ]);
} catch {
  return { ok: false, error: "Erro ao concluir tarefa. Tente novamente." };
}
```

The same missing try/catch applies to `criarTarefa` (line 60) and `excluirTarefa` (line 153) — any DB error throws unhandled.

---

### CR-03: `NovaTarefaDialog` — no `router.refresh()` after successful task creation; new task never appears in list

**File:** `src/app/(app)/tarefas/nova-tarefa-dialog.tsx:82-84`

**Issue:** After `criarTarefa` returns `{ ok: true }`, the dialog calls `setOpen(false)` and `reset()` but never triggers a client-side data refresh:

```typescript
toast.success("Tarefa criada com sucesso.");
setOpen(false);
reset();
// Missing: router.refresh()
```

`revalidatePath("/tarefas")` is called server-side in `criarTarefa`, which invalidates the RSC cache. But `NovaTarefaDialog` is a Client Component that does not re-mount the parent Server Component. Without `router.refresh()`, the client's in-memory copy of the task list is stale — the newly created task is invisible until the user manually navigates away and back.

In contrast, `ConcluirButton` in `[id]/concluir-button.tsx` correctly calls `router.refresh()` after a successful action (line 21).

**Fix:**

```typescript
// nova-tarefa-dialog.tsx
import { useRouter } from "next/navigation";

export function NovaTarefaDialog(...) {
  const router = useRouter();
  ...
  async function onSubmit(data: NovaTarefaFormData) {
    ...
    if (!result.ok) { ... return; }

    toast.success("Tarefa criada com sucesso.");
    setOpen(false);
    reset();
    router.refresh(); // <-- add this
  }
}
```

---

## Warnings

### WR-01: `tarefas-table.tsx` — `useMemo` dependency array for `columns` omits `userId` (stale closure)

**File:** `src/app/(app)/tarefas/tarefas-table.tsx:282-284`

**Issue:** The `columns` memoization at line 169:

```typescript
const columns = useMemo<ColumnDef<TarefaRow>[]>(
  () => [ ... ],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [isDono, pendingIds]   // <-- userId is missing
);
```

The `acoes` column cell (line 251) uses `userId` to compute `podeExcluir`:

```typescript
const podeExcluir = isDono || (userId != null && row.original.responsavelId === userId);
```

If `userId` ever changes between renders (e.g., hypothetical re-login without page reload in a future session-swap scenario), the stale closure would use the previous `userId`, displaying or hiding the delete button incorrectly. The `// eslint-disable-next-line react-hooks/exhaustive-deps` comment suppresses the ESLint warning that would catch this.

**Fix:** Add `userId` to the dependency array:

```typescript
[isDono, pendingIds, userId]
```

---

### WR-02: `[id]/page.tsx` — unsafe `as RegimeTributario` cast without runtime guard

**File:** `src/app/(app)/tarefas/[id]/page.tsx:62`

**Issue:**

```typescript
const regime = tarefa.empresa.regimeTributario as RegimeTributario
```

`regimeTributario` is typed by Prisma as the full `RegimeTributario` enum. The local `RegimeTributario` type (line 28) covers the three known values. If the Prisma schema gains a fourth regime (e.g., `MEI`) and the page is not updated, `REGIME_LABEL[regime]` and `REGIME_BADGE_CLASS[regime]` at lines 171-172 will return `undefined`, causing a crash or blank display. The `as` cast hides this at compile time because TypeScript trusts it.

**Fix:** Either use the Prisma-generated enum type directly (import `RegimeTributario` from `@prisma/client`) and keep the `REGIME_LABEL`/`REGIME_BADGE_CLASS` records exhaustive via TypeScript, or add a runtime fallback:

```typescript
// Use Prisma's type directly
import type { RegimeTributario } from "@prisma/client";

// Or guard with a fallback
const label = REGIME_LABEL[regime] ?? regime; // raw enum value as last resort
```

---

### WR-03: `tarefas-table.tsx` — `confirmarExclusao` does not call `router.refresh()` after successful delete

**File:** `src/app/(app)/tarefas/tarefas-table.tsx:156-167`

**Issue:** After a successful `excluirTarefa`, the row is not removed from the client-side table. `tarefasTable` is a Client Component with `tarefas` as a prop; deleting a task server-side revalidates the path, but without `router.refresh()` the client's stale prop data remains, and the deleted row stays visible until the next navigation.

`handleConcluir` at line 141 has the same issue — after `concluirTarefa`, the table doesn't reflect the status change (no `router.refresh()`). The checkbox will appear unchecked again if filters are re-applied.

**Fix:** In `confirmarExclusao` and `handleConcluir`, call `router.refresh()` on success. `TarefasTable` needs `useRouter`:

```typescript
const router = useRouter();

async function confirmarExclusao() {
  if (!tarefaParaExcluir) return;
  setIsDeleting(true);
  const result = await excluirTarefa(tarefaParaExcluir.id);
  setIsDeleting(false);
  setTarefaParaExcluir(null);
  if (!result.ok) {
    toast.error("...");
  } else {
    toast.success("Tarefa excluida com sucesso.");
    router.refresh(); // <-- add this
  }
}
```

---

### WR-04: `tarefas.crud.test.ts` — `criarTarefa` is not tested for COLABORADOR creating a task under another user's company

**File:** `tests/tarefas.crud.test.ts:54-115`

**Issue:** The CRUD test suite for `criarTarefa` only validates field-level input validation (empty titulo, empresaId, prazo). There is no test that verifies a COLABORADOR cannot create a task with an `empresaId` belonging to another collaborador's company. This missing test coverage directly corresponds to CR-01 — the bug in `criarTarefa` that lacks an ownership check. The test suite passes with the current buggy implementation.

**Fix:** Add an IDOR test for `criarTarefa` in `tests/tarefas.idor.test.ts`:

```typescript
it("COLABORADOR não pode criar tarefa para empresa de outro colaborador", async () => {
  const { criarTarefa } = await import("@/app/(app)/tarefas/actions");
  const colaboradorA = mockColaboradorUser();

  authMock.mockResolvedValue({ user: colaboradorA });
  // empresa.findFirst escopado retorna null — empresa existe mas pertence a outro
  findFirstEmpresaMock.mockResolvedValue(null);

  const resultado = await criarTarefa(buildFormData({ empresaId: "empresa_de_b" }));

  expect(resultado.ok).toBe(false);
  expect(createMock).not.toHaveBeenCalled();
});
```

---

### WR-05: `tarefas/schema.ts` — `prazo` transform splits on `-` without validating that the resulting parts are valid date components

**File:** `src/modules/tarefas/schema.ts:27-30`

**Issue:**

```typescript
.transform((val) => {
  const [year, month, day] = val.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59);
})
```

The `.refine` before the transform checks `!isNaN(Date.parse(val))`. `Date.parse` is lenient: it accepts strings like `"2026-13-45"` (month 13, day 45) which JS will silently roll over to a valid future date. So the refine does not reject out-of-range month/day values. The `split("-").map(Number)` transform then constructs a `Date` using the JS `Date` constructor which also rolls over — `new Date(2026, 12, 1)` becomes 2027-01-01.

This means a client sending `prazo: "2026-13-01"` will create a task with `prazo = 2027-01-01 23:59:59` without any validation error. This is an input integrity issue, not a security issue, but it could lead to tasks with silently incorrect deadlines.

**Fix:** Replace the loose `Date.parse` refine with a strict regex or use `date-fns/parseISO` with an isValid check:

```typescript
import { isValid, parseISO } from "date-fns";

prazo: z
  .string()
  .min(1, "Prazo é obrigatório")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (esperado YYYY-MM-DD)")
  .refine((val) => isValid(parseISO(val)), "Data inválida")
  .transform((val) => {
    const [year, month, day] = val.split("-").map(Number);
    return new Date(year, month - 1, day, 23, 59, 59);
  }),
```

---

## Info

### IN-01: `[id]/page.tsx` — `alerta.emoji` is rendered twice (header badge + date cell)

**File:** `src/app/(app)/tarefas/[id]/page.tsx:79, 115`

**Issue:** `alerta.emoji` is rendered in the header badge area (line 79) and again inline before the deadline date (line 115). For a screen reader, the emoji is announced twice in sequence with no differentiation. The header instance has an `aria-label` on its wrapper span, but the second instance (line 115) has no `aria-hidden="true"`.

**Fix:** Add `aria-hidden="true"` to the second emoji rendering at line 115, or remove the decorative duplication:

```tsx
<dd className={`text-sm ${alerta.textClass}`}>
  <span aria-hidden="true">{alerta.emoji}</span>{" "}
  {format(tarefa.prazo, "dd/MM/yyyy", { locale: ptBR })}
</dd>
```

---

### IN-02: `tarefas-table.tsx` — `isPending` from `useTransition` is suppressed with `void isPending`

**File:** `src/app/(app)/tarefas/tarefas-table.tsx:110-111`

**Issue:**

```typescript
const [isPending, startTransition] = useTransition();
// Suprimir warning de isPending não utilizado diretamente
void isPending;
```

`isPending` is destructured but never used to provide any visual feedback during the `handleConcluir` transition. The individual row-level `pendingIds` Set is used instead (line 179). The `void isPending` pattern is a code smell indicating dead state. Using `useTransition`'s `isPending` only for its `startTransition` side-effect while suppressing the returned boolean is unusual and confusing to future maintainers.

**Fix:** Either use `isPending` to disable the toolbar or show a global loading indicator, or replace `useTransition` with a plain `async` pattern (since individual row pending state is already tracked via `pendingIds`). If `startTransition` is still needed for concurrent mode batching, document why `isPending` is intentionally unused instead of suppressing it.

---

_Reviewed: 2026-06-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
