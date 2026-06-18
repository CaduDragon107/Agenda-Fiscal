---
phase: quick-260618-kbg
plan: 01
subsystem: tarefas
tags: [prisma, server-actions, ui, tarefas]
dependency-graph:
  requires: []
  provides: [motivoPendencia field, salvarMotivoPendencia action, MotivoPendenciaForm component]
  affects: [src/app/(app)/tarefas/[id]/page.tsx]
tech-stack:
  added: []
  patterns: ["Server Action anti-IDOR via withTarefaScope", "PENDENTE-only mutation guard mirroring D-05"]
key-files:
  created:
    - "src/app/(app)/tarefas/[id]/motivo-pendencia-form.tsx"
  modified:
    - "prisma/schema.prisma"
    - "src/modules/tarefas/queries.ts"
    - "src/app/(app)/tarefas/actions.ts"
    - "src/app/(app)/tarefas/[id]/page.tsx"
decisions:
  - "motivoPendencia stored as nullable String with no index (free text, never queried/filtered)"
  - "Empty/whitespace-only input normalized to null on save, mirroring other optional text fields"
  - "Editing blocked server-side once status is CONCLUIDA, consistent with D-05 (only PENDENTE tasks can be concluded/edited)"
metrics:
  duration: "~15 min"
  completed: "2026-06-18"
---

# Phase quick-260618-kbg Plan 01: Motivo de Pendência Summary

Added a `motivoPendencia` free-text field to Tarefa, with an auth-guarded, anti-IDOR Server Action and an editable/read-only UI on the task detail page, letting team members document why a pending task hasn't been finalized.

## What Was Built

- **`prisma/schema.prisma`**: Added nullable `motivoPendencia String?` to `model Tarefa`, applied to the Neon database via `npx prisma db push` (no data loss, field is nullable).
- **`src/modules/tarefas/queries.ts`**: Added `motivoPendencia: true` to `TAREFA_SELECT`, exposing the field through both `buscarTarefaPorId` and `listarTarefas`.
- **`src/app/(app)/tarefas/actions.ts`**: New Server Action `salvarMotivoPendencia(id, motivo)` following the exact pattern of `concluirTarefa`/`excluirTarefa`:
  - Auth guard first (`auth()` → 401-equivalent if no session).
  - Anti-IDOR via `db.tarefa.findFirst({ where: { id, ...withTarefaScope(session.user) } })` — returns "não encontrado" (never 403) if out of scope.
  - Blocks edits when `status === "CONCLUIDA"`.
  - Trims input; empty string normalized to `null`; rejects input over 1000 chars.
  - `revalidatePath("/tarefas")` and `revalidatePath(`/tarefas/${id}`)` on success.
- **`src/app/(app)/tarefas/[id]/motivo-pendencia-form.tsx`** (new): `"use client"` component with a controlled `<textarea>` (same Tailwind classes as the `descricao` textarea in `nova-tarefa-dialog.tsx`), a "Salvar motivo" button (disabled while pending or unchanged), `useTransition` + toast + `router.refresh()` on success, matching `concluir-button.tsx` conventions.
- **`src/app/(app)/tarefas/[id]/page.tsx`**: Added a new "Motivo de pendência" `Card` between the detail/empresa grid and the conclude button. Renders `MotivoPendenciaForm` when `status === "PENDENTE"`; renders the saved text read-only (`whitespace-pre-wrap`) or "Nenhum motivo registrado." when `status === "CONCLUIDA"`.

## Deviations from Plan

None — plan executed exactly as written.

## Operational Note: Prisma Client Generation

During Task 1, `npx prisma db push` succeeded (schema synced to Neon), but the chained `generate` step intermittently hit `EPERM: operation not permitted` while renaming the Windows query-engine DLL, because a running `next dev` process (PIDs observed: npm wrapper, `next dev`, `start-server.js`) held a lock on `node_modules/.prisma/client/query_engine-windows.dll.node`. The executor is not permitted to terminate arbitrary node processes without explicit user authorization, so the dev server was left running.

Verification performed instead of a clean re-generate:
- Inspected `node_modules/.prisma/client/index.d.ts` directly — `motivoPendencia: string | null` is present in `TarefaSelect`/`TarefaWhereInput`/`TarefaUpdateInput` etc., confirming the client *was* regenerated successfully on an earlier pass (the EPERM happened on a moot/duplicate regenerate attempt afterward).
- `npx tsc --noEmit` passes cleanly twice (after Task 1 and after Task 2), which would fail immediately if the Prisma Client types did not include `motivoPendencia`.

**If the dev server is restarted and Prisma Client regeneration is needed again**, stop `next dev` first (`Ctrl+C` in its terminal, or close the process) before running `npx prisma generate`, to avoid the Windows file-lock EPERM.

## Self-Check

- [x] `prisma/schema.prisma` contains `motivoPendencia`
- [x] `src/app/(app)/tarefas/actions.ts` contains `salvarMotivoPendencia`
- [x] `src/app/(app)/tarefas/[id]/motivo-pendencia-form.tsx` exists and contains `"use client"`
- [x] `src/app/(app)/tarefas/[id]/page.tsx` imports and renders `MotivoPendenciaForm`, references `motivoPendencia`
- [x] `npx tsc --noEmit` passes with no errors

## Self-Check: PASSED
