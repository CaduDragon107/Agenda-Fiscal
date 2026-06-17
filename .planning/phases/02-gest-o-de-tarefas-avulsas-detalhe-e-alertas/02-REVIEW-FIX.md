---
phase: 02-gestao-de-tarefas-avulsas-detalhe-e-alertas
fixed_at: 2026-06-17T00:00:00Z
review_path: .planning/phases/02-gest-o-de-tarefas-avulsas-detalhe-e-alertas/02-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-06-17T00:00:00Z
**Source review:** `.planning/phases/02-gest-o-de-tarefas-avulsas-detalhe-e-alertas/02-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical + 5 Warning; Info excluded by fix_scope)
- Fixed: 8
- Skipped: 0

---

## Fixed Issues

### CR-01 + CR-02: `criarTarefa` — ownership check + try/catch in all DB calls

**Files modified:** `src/app/(app)/tarefas/actions.ts`
**Commit:** `33f7725`
**Applied fix:**
- Added `withVisibilityScope` import from `@/lib/visibility-scope`.
- Before `db.tarefa.create`, verify the `empresaId` is within the caller's visibility scope via `db.empresa.findFirst({ where: { id: dados.empresaId, ...withVisibilityScope(session.user) } })`. Returns `{ ok: false, error: "não encontrado" }` if the empresa is out of scope (COLABORADOR trying to create under another user's company).
- Added check: COLABORADOR can only set `responsavelId` to themselves; attempting to assign another user returns `{ ok: false, error: "não autorizado" }`. DONO can assign freely.
- Wrapped `db.tarefa.create` in `criarTarefa`, `db.$transaction` in `concluirTarefa`, and `db.tarefa.delete` in `excluirTarefa` in `try/catch` blocks that return `{ ok: false, error: "..." }` instead of propagating unhandled exceptions to Next.js (which would produce 500 error pages).
- Note: CR-02's production-code issue (missing try/catch around `$transaction`) was fixed here; the test mock improvement suggested by the reviewer is a nice-to-have and was not applied to avoid scope creep on the test file that is covered by WR-04.

### CR-03: `NovaTarefaDialog` — add `router.refresh()` after successful task creation

**Files modified:** `src/app/(app)/tarefas/nova-tarefa-dialog.tsx`
**Commit:** `d5cc060`
**Applied fix:**
- Added `import { useRouter } from "next/navigation"`.
- Initialized `const router = useRouter()` inside the component.
- Added `router.refresh()` after `setOpen(false)` and `reset()` in `onSubmit` on the success path. Without this, `revalidatePath("/tarefas")` (server-side) was not enough to re-render the already-mounted client component tree, leaving the task list stale until manual navigation.

### WR-01 + WR-03: `tarefas-table.tsx` — stale `useMemo` closure + `router.refresh()` on mutations

**Files modified:** `src/app/(app)/tarefas/tarefas-table.tsx`
**Commit:** `335b676`
**Applied fix (WR-01):**
- Added `userId` to the `useMemo` dependency array for `columns` (line 286): `[isDono, pendingIds, userId]`.
- Removed the `// eslint-disable-next-line react-hooks/exhaustive-deps` comment that was suppressing the lint warning. ESLint will now correctly flag any future missing dependency.

**Applied fix (WR-03):**
- Added `import { useRouter } from "next/navigation"`.
- Initialized `const router = useRouter()` inside `TarefasTable`.
- Added `router.refresh()` in `handleConcluir` on the success branch (after `toast.success`).
- Added `router.refresh()` in `confirmarExclusao` on the success branch (after `toast.success`). Without these calls, the concluded/deleted row remained visible in the client-side table until the next navigation event.

### WR-02: `[id]/page.tsx` — replace local `RegimeTributario` type with Prisma import

**Files modified:** `src/app/(app)/tarefas/[id]/page.tsx`
**Commit:** `7625de7`
**Applied fix:**
- Added `import type { RegimeTributario } from "@prisma/client"`.
- Removed the local `type RegimeTributario = "LUCRO_REAL" | "LUCRO_PRESUMIDO" | "SIMPLES_NACIONAL"` definition (duplicate of the Prisma enum).
- Removed the `as RegimeTributario` cast on `tarefa.empresa.regimeTributario` (Prisma already returns the correct type; the cast was hiding type errors).
- Added runtime fallbacks: `(REGIME_BADGE_CLASS as Record<string, string>)[regime] ?? ""` and `(REGIME_LABEL as Record<string, string>)[regime] ?? regime` — if a new enum value (e.g. `MEI`) is added to the Prisma schema and the UI is not updated, the page now renders the raw enum key rather than crashing with `undefined`.

### WR-04: `tarefas.idor.test.ts` — add IDOR tests for `criarTarefa` empresa ownership

**Files modified:** `tests/tarefas.idor.test.ts`
**Commit:** `c17f075`
**Applied fix:**
- Added a new `describe("IDOR — criarTarefa")` block with two tests:
  1. COLABORADOR cannot create a task for a company belonging to another collaborator — `empresa.findFirst` returns `null` (out of scope), `tarefa.create` must not be called, and the result is `{ ok: false }`. The test also asserts that `empresa.findFirst` was called with `{ where: { id: "empresa_de_b", responsavelId: colaboradorA.id } }` (correct scope).
  2. COLABORADOR cannot assign a task to a different `responsavelId` — empresa guard passes but the `responsavelId !== session.user.id` check rejects the request before `tarefa.create`.
- Uses `vi.doMock` inside the suite to extend the `db` mock with `empresa.findFirst` (not present in the outer `vi.mock` which was only set up for `tarefa` and `tarefaHistorico`).

### WR-05: `tarefas/schema.ts` — strict `prazo` validation with regex + `date-fns` `isValid`

**Files modified:** `src/modules/tarefas/schema.ts`
**Commit:** `5a4204f`
**Applied fix:**
- Added `import { isValid, parseISO } from "date-fns"`.
- Replaced `.refine((val) => !isNaN(Date.parse(val)), "Data inválida")` with two steps:
  1. `.regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (esperado YYYY-MM-DD)")` — enforces exact format before any date parsing.
  2. `.refine((val) => isValid(parseISO(val)), "Data inválida")` — `date-fns/parseISO` is strict about month/day ranges (month 13, day 32, etc.) and does not silently roll over, unlike the JS `Date` constructor and `Date.parse`.
- The `transform` step is unchanged — it still produces a local-time `Date` at `23:59:59` to avoid the UTC/timezone issue with fiscal deadlines.

---

## Skipped Issues

None — all 8 in-scope findings were fixed successfully.

---

_Fixed: 2026-06-17T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
