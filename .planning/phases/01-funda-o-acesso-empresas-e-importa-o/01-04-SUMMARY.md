---
phase: 01-funda-o-acesso-empresas-e-importa-o
plan: 04
subsystem: ui
tags: [nextjs, shadcn, tanstack-table, react-hook-form, zod, prisma, server-actions, idor]

# Dependency graph
requires:
  - phase: 01-funda-o-acesso-empresas-e-importa-o
    provides: "Auth.js v5 session (src/auth.ts), withVisibilityScope, validarCNPJ, empresaSchema, listarEmpresas/buscarEmpresaPorId (Plans 01-02, 01-03)"
provides:
  - "Authenticated app shell with shadcn sidebar (240px, collapsible) and role-aware user menu"
  - "Scoped CRUD Server Actions: criarEmpresa, editarEmpresa, excluirEmpresa with anti-IDOR findFirst ownership checks"
  - "/empresas list (TanStack Table) backend-scoped by withVisibilityScope, never client-filtered for security"
  - "Empresa create/edit form (react-hook-form + zodResolver(empresaSchema)) reused by /empresas/novo and /empresas/[id]/editar"
  - "EmpresaRegimeHistorico first entry written on creation"
  - "listarResponsaveis query for the Responsavel select"
affects: [02-tarefas, dashboards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action result type { ok: true, id } | { ok: false, error } returned to client (no thrown errors crossing the server/client boundary for expected validation failures)"
    - "Anti-IDOR: findFirst({ id, ...withVisibilityScope(user) }) before every update/delete; returns 'nao encontrado' (never 403) on null"
    - "Edit page uses notFound() when buscarEmpresaPorId returns null (scope-enforced 404, not a permission error)"

key-files:
  created:
    - src/app/(app)/layout.tsx
    - src/app/(app)/app-sidebar.tsx
    - src/app/(app)/actions.ts
    - src/app/(app)/empresas/page.tsx
    - src/app/(app)/empresas/empresas-table.tsx
    - src/app/(app)/empresas/empresa-form.tsx
    - src/app/(app)/empresas/novo/page.tsx
    - "src/app/(app)/empresas/[id]/editar/page.tsx"
  modified:
    - src/modules/empresas/queries.ts
    - src/app/layout.tsx
    - tests/empresas.idor.test.ts
    - tests/empresas.crud.test.ts

key-decisions:
  - "criarEmpresa writes the first EmpresaRegimeHistorico entry (regimeTributario + dataInicio = now) at creation time, keeping regime history coherent from v1"
  - "Server Actions return a typed result object ({ ok, id|error }) instead of throwing, so the form can show toasts without try/catch boilerplate"
  - "Edit page renders Next.js notFound() (404) when buscarEmpresaPorId returns null, satisfying 'nao encontrado, never 403' without a custom error page"
  - "Added sonner <Toaster /> to the root layout (was not wired by any prior plan) so success/error toasts from empresa-form render"
  - "Added listarResponsaveis() to modules/empresas/queries.ts (not in original file list) to populate the Responsavel select in the form"

patterns-established:
  - "All future module CRUD actions under app/(app)/actions.ts should follow the auth() guard -> scoped findFirst -> validate -> mutate -> revalidatePath sequence"

requirements-completed: [EMPR-01, AUTH-02]

# Metrics
duration: 35min
completed: 2026-06-15
---

# Phase 01 Plan 04: Authenticated Shell, Scoped Empresa CRUD, and IDOR-proof Server Actions Summary

**Authenticated sidebar shell, /empresas list (TanStack Table, backend-scoped), and create/edit form wired to anti-IDOR Server Actions (criarEmpresa/editarEmpresa/excluirEmpresa) that return "nao encontrado" — never 403 — for cross-colaborador access attempts.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-15T09:46:00Z
- **Completed:** 2026-06-15T10:21:33Z
- **Tasks:** 2 completed
- **Files modified:** 10 (8 created, 2 modified, plus 2 test files rewritten)

## Accomplishments

- Authenticated app shell: `(app)/layout.tsx` guards every route under it with `auth()` + redirect to `/login`; `app-sidebar.tsx` renders the shadcn sidebar (collapsible, 240px), nav item "Empresas" (active), disabled placeholders for "Tarefas"/"Dashboards", and a user menu with "Sair" (`signOut`). Dono sees a "Visão geral" label in the sidebar header.
- Three scoped Server Actions (`criarEmpresa`, `editarEmpresa`, `excluirEmpresa`) in `app/(app)/actions.ts`, each starting with a session guard, validating with `empresaSchema`, and — for edit/delete — running `db.empresa.findFirst({ id, ...withVisibilityScope(user) })` before any mutation, returning `{ ok: false, error: "não encontrado" }` (never a permission error) if the record is out of scope.
- `criarEmpresa` writes the first `EmpresaRegimeHistorico` row (current regime, `dataInicio = new Date()`) so regime history is coherent from the first record onward.
- `/empresas` (Server Component) calls `listarEmpresas(session.user)` and passes the result straight to `EmpresasTable` — no client-side `.filter()` by `responsavelId` is used to enforce visibility (the security boundary lives entirely in `withVisibilityScope` inside the query).
- `EmpresasTable` (TanStack Table): columns Nome / CNPJ (formatted `00.000.000/0000-00`) / Regime (badge — blue Lucro Real, purple Simples Nacional, amber Lucro Presumido) / Responsável / Ações (44px edit/delete icon buttons); search by nome/CNPJ; regime filter (Todos + 3 regimes); responsável filter visible only to `DONO`; pagination at 20 rows/page; empty states with the exact copy from UI-SPEC ("Nenhuma empresa cadastrada" / "Nenhuma empresa encontrada"); delete flow opens an `AlertDialog` titled "Excluir empresa?" with "Excluir"/"Cancelar".
- `EmpresaForm` (react-hook-form + `zodResolver(empresaSchema)`): Nome, CNPJ, Regime (Select, 3 values), Responsável (Select populated by the new `listarResponsaveis()`), Contatos, Particularidades; CTA "Salvar empresa"; success toast "Empresa salva com sucesso." + redirect to `/empresas`; error toast "Não foi possível salvar. Verifique os dados e tente novamente." Reused by `/empresas/novo` ("Nova empresa") and `/empresas/[id]/editar` ("Editar empresa: {nome}", pre-populated).
- `tests/empresas.idor.test.ts` and `tests/empresas.crud.test.ts` rewritten from RED `expect.fail` stubs to real assertions against the Server Actions (mocking `@/lib/db`, `@/auth`, `next/cache`) — all 9 tests pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Shell autenticado (sidebar role-aware) + Server Actions CRUD escopadas** - `4158f81` (feat)
2. **Task 2 (TDD RED): real IDOR/CRUD tests for empresas Server Actions** - `6feeb1d` (test)
2. **Task 2 (TDD GREEN): /empresas list, table, and create/edit form** - `80e546a` (feat)

_TDD note: by the time Task 2's tests were written, `actions.ts` (built in Task 1 within the same plan, per its own `<behavior>` contract) already satisfied the IDOR/CRUD assertions — so the `test` commit's 9 assertions passed immediately against existing code. The GREEN-making work for Task 2 was therefore the `/empresas` UI layer (page, table, form, routes), committed in the subsequent `feat` commit. The plan-level verification command (`vitest run ... && npm run build`) passes after both commits._

## Files Created/Modified

- `src/app/(app)/layout.tsx` - Authenticated shell: `auth()` guard, redirect `/login`, renders `AppSidebar` + `SidebarInset`
- `src/app/(app)/app-sidebar.tsx` - shadcn sidebar: logo, nav (Empresas active; Tarefas/Dashboards disabled), user menu with Sair
- `src/app/(app)/actions.ts` - `criarEmpresa`/`editarEmpresa`/`excluirEmpresa` Server Actions, anti-IDOR findFirst, regime history write
- `src/app/(app)/empresas/page.tsx` - `/empresas` list Server Component, backend-scoped
- `src/app/(app)/empresas/empresas-table.tsx` - TanStack Table: columns, badges, search/filters, pagination, AlertDialog delete
- `src/app/(app)/empresas/empresa-form.tsx` - create/edit form (react-hook-form + zod), toasts
- `src/app/(app)/empresas/novo/page.tsx` - "Nova empresa" page
- `src/app/(app)/empresas/[id]/editar/page.tsx` - "Editar empresa: {nome}" page, 404 on out-of-scope
- `src/modules/empresas/queries.ts` - added `listarResponsaveis()`
- `src/app/layout.tsx` - wired `<Toaster />` (sonner) for app-wide toast rendering
- `tests/empresas.idor.test.ts` - real IDOR assertions (cross-colaborador edit/delete -> "não encontrado", no mutation; dono bypass)
- `tests/empresas.crud.test.ts` - real CRUD assertions (3 regimes, regime history write, invalid CNPJ rejection, edit persistence)

## Decisions Made

- `criarEmpresa` writes the first `EmpresaRegimeHistorico` entry at creation (regime atual, `dataInicio = now`) rather than deferring it — keeps history coherent from v1, as the plan recommended.
- Server Actions return `{ ok: true, id } | { ok: false, error }` instead of throwing, simplifying client-side toast handling.
- Edit page calls Next.js `notFound()` when `buscarEmpresaPorId` returns `null` — this naturally satisfies "não encontrado, nunca 403" for the read path without inventing a custom error UI.
- Added `<Toaster />` to the root layout (Rule 2 — missing critical piece for the form's toast UX to function; no prior plan had wired it).
- Added `listarResponsaveis()` to `modules/empresas/queries.ts` (Rule 2 — the Responsável `<Select>` in the form has no data source without it; not destructive, additive only, returns only `id`/`nome`, never `senhaHash`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Wired sonner `<Toaster />` into root layout**
- **Found during:** Task 2 (empresa-form success/error toasts)
- **Issue:** `src/components/ui/sonner.tsx` existed but was never rendered anywhere in the app; `toast.success(...)`/`toast.error(...)` calls in the form would have no visual effect.
- **Fix:** Imported and rendered `<Toaster />` in `src/app/layout.tsx`.
- **Files modified:** `src/app/layout.tsx`
- **Verification:** `npm run build` passes; component renders at the app root.
- **Committed in:** `4158f81` (Task 1 commit, since the shell/root layout was touched there)

**2. [Rule 2 - Missing Critical] Added `listarResponsaveis()` query**
- **Found during:** Task 2 (empresa-form Responsável select)
- **Issue:** The plan's `empresa-form.tsx` requires a "Responsável (Select dos usuários)" field, but no query existed to fetch the list of users; without it the select would have no options.
- **Fix:** Added `listarResponsaveis()` to `src/modules/empresas/queries.ts`, returning `{ id, nome }` for all `Usuario` rows (explicit `select`, never exposes `senhaHash`), ordered by `nome`.
- **Files modified:** `src/modules/empresas/queries.ts`
- **Verification:** `npm run build` passes; form select renders 5 seeded users in dev.
- **Committed in:** `80e546a` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 - missing critical functionality)
**Impact on plan:** Both additions were necessary for the plan's own UI deliverables (toasts, Responsável select) to function. No scope creep beyond what Task 2's `<action>` already specified.

## Issues Encountered

- The acceptance criteria for Task 2 state "NÃO há `.filter()` client-side por `responsavelId` em empresas-table.tsx". `empresas-table.tsx` does contain a `.filter()` call, but it implements the plan-required "filtro por responsável visível só para dono" UX feature (narrowing an already-scoped/already-fully-visible dataset for the dono's convenience) — it is not used to enforce the AUTH-02 visibility boundary, which lives entirely in `withVisibilityScope` inside `listarEmpresas` (Prisma `where` clause, proven by `tests/empresas.queries.test.ts` and `tests/empresas.idor.test.ts`). This is the intended distinction per 01-PATTERNS.md (the anti-pattern is using client `.filter()` *instead of* backend scoping, not using it for an opt-in UI filter on top of backend-scoped data). No code change made; documented here for verifier awareness.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/empresas` is fully navigable, scoped by role, with working create/edit/delete and IDOR protection proven by tests.
- Plan 01-05 (Excel import, EMPR-02) can now build on `modules/empresas/schema.ts` (`linhaImportadaSchema`), `criarEmpresa`-equivalent bulk creation, and the `/empresas` page's empty-state "Importar planilha" link (already wired to `/empresas/importar`, which does not exist yet — Plan 01-05 must create it).
- No blockers.

---
*Phase: 01-funda-o-acesso-empresas-e-importa-o*
*Completed: 2026-06-15*

## Self-Check: PASSED

All 11 created/modified files verified present on disk. All 3 commits
(`4158f81`, `6feeb1d`, `80e546a`) verified present in git log. Plan-level
verification (`npx vitest run tests/empresas.idor.test.ts
tests/empresas.crud.test.ts && npm run build`) re-ran successfully.
