---
phase: 10
slug: notifica-es-in-app
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 10-XX-XX | TBD | 0 | NOTF-01 | — | Sync creates VENCENDO notification for tarefa due ≤3 days | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "vencendo"` | ❌ W0 | ⬜ pending |
| 10-XX-XX | TBD | 0 | NOTF-02 | — | Sync creates ATRASADA notification for overdue tarefa | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "atrasada"` | ❌ W0 | ⬜ pending |
| 10-XX-XX | TBD | 0 | NOTF-03 | — | Sync creates AVULSA_ATRIBUIDA notification for ad-hoc tarefa | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "avulsa"` | ❌ W0 | ⬜ pending |
| 10-XX-XX | TBD | 0 | NOTF-04 | T-V4 | COLABORADOR sync/read scoped to own tarefas; DONO sees all | unit | `npx vitest run tests/notificacoes.idor.test.ts` | ❌ W0 | ⬜ pending |
| 10-XX-XX | TBD | 0 | D-03 | — | Re-running sync twice does not duplicate (tarefaId, usuarioId, tipo) | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "idempot"` | ❌ W0 | ⬜ pending |
| 10-XX-XX | TBD | 0 | D-04/D-05 | — | Marking read hides notification; patamar change (vencendo→atrasada) creates new unread row | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "patamar"` | ❌ W0 | ⬜ pending |
| 10-XX-XX | TBD | 0 | D-06 | — | Avulsa notification disappears on tarefa conclusion without explicit read | unit | `npx vitest run tests/notificacoes.sync.test.ts -t "conclusao"` | ❌ W0 | ⬜ pending |
| 10-XX-XX | TBD | 0 | D-10 | — | Sidebar badge + `contadorAlertas` prop fully removed | manual/visual | `tsc --noEmit` (no orphaned prop type) + manual review | ❌ W0 | ⬜ pending |
| 10-XX-XX | TBD | 0 | V4 | T-V4 | Mark-as-read Server Action scoped by literal `usuarioId` ownership (not `withTarefaScope`) | unit | `npx vitest run tests/notificacoes.read-action.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/notificacoes.sync.test.ts` — stubs for NOTF-01/02/03, D-03 idempotency, D-05 patamar-change
- [ ] `tests/notificacoes.idor.test.ts` — stubs for NOTF-04 visibility scoping (sync + read queries), mirroring `tests/tarefas.idor.test.ts`'s mock pattern (`vi.mock("@/lib/db")`, `vi.mock("@/auth")`)
- [ ] `tests/notificacoes.read-action.test.ts` — stubs for mark-as-read anti-IDOR (scoped by `usuarioId`) and D-06 conclusion-based disappearance
- [ ] Framework install: none — Vitest already configured project-wide

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sino visível no header em qualquer página, badge de contagem, dropdown inline com itens linkando para `/tarefas/[id]` | D-07, D-08, D-09 | Visual/UI rendering and navigation — not meaningfully assertable via unit test | Load any authenticated page, confirm bell renders in header with badge count, click bell, confirm dropdown lists unread notifications, click an item, confirm navigation to the tarefa |
| Sidebar badge fully gone (no double-counting between old badge and new bell) | D-10 | Visual confirmation that old UI element no longer renders | Open sidebar, confirm "Tarefas" item has no badge/count remaining |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
