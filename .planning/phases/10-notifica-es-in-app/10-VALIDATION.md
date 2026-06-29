---
phase: 10
slug: notifica-es-in-app
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-29
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (already configured, `vitest.config.ts` present) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/notificacoes.sync.test.ts` |
| **Full suite command** | `npm test` (runs `vitest run`; 30+ existing test files including `tarefas.idor.test.ts`, `visibility-scope.test.ts`, `geracao.idempotencia.test.ts`) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/notificacoes.*.test.ts`
- **After every plan wave:** Run `npm test` (full suite — ensures no regression in `visibility-scope.test.ts`, `tarefas.idor.test.ts`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | Wave 0 stubs | — | `it.todo` stubs created for all NOTF/D-ID test names (vencendo, atrasada, avulsa, idempot, patamar, conclusao, IDOR, read-action) | unit | `npx vitest run tests/notificacoes.sync.test.ts tests/notificacoes.idor.test.ts tests/notificacoes.read-action.test.ts` | ✅ created by this task | ⬜ pending |
| 10-01-02 | 01 | 1 | — | — | `classificarPatamarPrazo` extracted; `Notificacao` model + `NotificacaoTipo` enum added to schema with `onDelete: Cascade` on both FKs | source | `grep "model Notificacao" prisma/schema.prisma` | ❌ until task runs | ⬜ pending |
| 10-01-03 | 01 | 1 | — | — | [BLOCKING] `npx prisma db push` applied — schema live in DB before any backend code depends on it | CLI | `npx prisma db push` exits 0 | ❌ until task runs | ⬜ pending |
| 10-02-01 | 02 | 2 | NOTF-01, NOTF-02, NOTF-03, D-03, D-05, D-06 | — | `sincronizarNotificacoes` creates VENCENDO/ATRASADA/AVULSA_ATRIBUIDA rows idempotently (D-11: always keyed to `tarefa.responsavelId`); patamar change creates new unread row even if prior type was read; conclusion produces no new candidate | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "vencendo|atrasada|avulsa|idempot|patamar|conclusao"` | ❌ until task runs | ⬜ pending |
| 10-02-02 | 02 | 2 | NOTF-04 | T-V4 | `listarNotificacoesNaoLidas`/`contarNaoLidas` scoped via `withTarefaScope` on `Notificacao.tarefa` — COLABORADOR sees only own tarefas, DONO sees all; avulsa disappears from read query once tarefa `CONCLUIDA` (D-06 query-side half) | unit | `npx vitest run tests/notificacoes.idor.test.ts` | ❌ until task runs | ⬜ pending |
| 10-02-03 | 02 | 2 | D-12, V4 | T-V4 | Mark-as-read Server Actions scoped via `withTarefaScope` on the tarefa relation (not literal `usuarioId`) per locked D-12 — DONO marking a colaborador's notification read does affect that colaborador's badge; COLABORADOR still restricted to own tarefas (anti-IDOR preserved) | unit | `npx vitest run tests/notificacoes.read-action.test.ts` | ❌ until task runs | ⬜ pending |
| 10-03-01 | 03 | 3 | D-07, D-08, D-09 | — | shadcn `popover`/`scroll-area` installed via CLI; `NotificationBell` renders badge + dropdown | build | `npx tsc --noEmit` | ❌ until task runs | ⬜ pending |
| 10-03-02 | 03 | 3 | D-02, D-07, D-10 | — | Sync+fetch wired into `AppLayout`; old sidebar badge (`contadorAlertas` prop, `contarAlertasTarefas`) fully removed from `app-sidebar.tsx` and `layout.tsx` | build | `npx tsc --noEmit` (no orphaned prop type after 3-file removal) | ❌ until task runs | ⬜ pending |
| 10-03-03 | 03 | 3 | D-07, D-08, D-09, D-10 | — | Bell visible in header on any authenticated page; clicking opens dropdown listing unread items linking to `/tarefas/[id]`; sidebar badge fully gone | manual/visual | checkpoint:human-verify (see Manual-Only Verifications) | n/a — visual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/notificacoes.sync.test.ts` — stubs for NOTF-01/02/03, D-03 idempotency, D-05 patamar-change, D-06 conclusion (covered by Plan 10-01 Task 1)
- [x] `tests/notificacoes.idor.test.ts` — stubs for NOTF-04 visibility scoping (sync + read queries), mirroring `tests/tarefas.idor.test.ts`'s mock pattern (`vi.mock("@/lib/db")`, `vi.mock("@/auth")`) (covered by Plan 10-01 Task 1)
- [x] `tests/notificacoes.read-action.test.ts` — stubs for mark-as-read anti-IDOR (scoped via `withTarefaScope` per D-12) and D-06 conclusion-based disappearance (covered by Plan 10-01 Task 1)
- [x] Framework install: none — Vitest already configured project-wide

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sino visível no header em qualquer página, badge de contagem, dropdown inline com itens linkando para `/tarefas/[id]` | D-07, D-08, D-09 | Visual/UI rendering and navigation — not meaningfully assertable via unit test | Load any authenticated page, confirm bell renders in header with badge count, click bell, confirm dropdown lists unread notifications, click an item, confirm navigation to the tarefa |
| Sidebar badge fully gone (no double-counting between old badge and new bell) | D-10 | Visual confirmation that old UI element no longer renders | Open sidebar, confirm "Tarefas" item has no badge/count remaining |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-06-29 (gsd-plan-checker pass, blockers resolved)
