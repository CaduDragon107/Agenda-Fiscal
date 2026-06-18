---
phase: 03
slug: motor-de-gera-o-autom-tica-mensal
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-18
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| date input → date-holidays/date-fns | Internal computed dates only; no untrusted input crosses into pure functions (competência validated by `competenciaSchema` before reaching callers) | Computed Date objects, validated competência string |
| schema migration → live DB | `npx prisma db push` mutates the Neon database structure | Schema DDL (additive: new enum, nullable columns, indexes) |
| cron callback → DB | Cron runs with no authenticated user; writes via `executarGeracaoMensal` directly; competência is derived internally via `competenciaAtual()`, never from request data | Generated `TarefaParaCriar[]` rows |
| instrumentation register → process runtime | Boot-time side effect executed once per Node process start | None (process lifecycle only) |
| browser (button click) → Server Action | Untrusted client invokes `gerarTarefasDoMesAction`; a COLABORADOR can call it directly even with the button hidden | Session token, optional competência string |
| Server Action → executarGeracaoMensal → DB | Authorized DONO-only write path | Validated competência, generated task rows |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| P01-T-3-01 | Tampering | competência string used as idempotency key component | mitigate | `competenciaSchema` Zod regex `/^\d{4}-(0[1-9]|1[0-2])$/` enforces canonical form (`src/lib/competencia.ts:19-21`); enforced at action boundary (`src/app/(app)/tarefas/actions.ts:240-245`) | closed |
| P01-T-3-02 | Tampering | `npx prisma db push` to Neon | accept | Additive-only schema change (new enum, nullable columns, new indexes); verified 0 pre-existing rows before `--accept-data-loss` fallback (`prisma/schema.prisma:30-36,98-99,105,110`; 03-01-SUMMARY.md) | closed |
| P01-T-3-SC | Tampering | npm installs (date-holidays, node-cron, @types/node-cron) | mitigate | Approved in Package Legitimacy Audit; versions present in `package.json:24,29,47` matching audited floor (`^3.30.2`, `^4.4.1`, `^3.0.11`) | closed |
| P02-T-3-02 | Tampering | `createMany` idempotent write | mitigate | DB `@@unique([empresaId, tipoObrigacao, competencia])` + `skipDuplicates: true`, no app-level pre-check (avoids TOCTOU); `src/modules/tarefas/geracao.ts:38-44`; further hardened by commit `7db76bb` wrapping read+write in `db.$transaction` | closed |
| P02-T-3-03 | Denial of Service / availability | cron job silently failing with no operator visibility | accept | v1 mitigation: `console.log`/`console.error` summary in callback + DONO manual-trigger fallback (`src/lib/scheduler.ts:31-43`); email/WhatsApp alerts explicitly v2-deferred (NOTF-01) | closed |
| P02-T-3-04 | Tampering | double cron registration on hot-reload / redeploy | mitigate | `globalThis.__agendaFiscalCronStarted` guard (`src/lib/scheduler.ts:19-28`) plus DB unique constraint as second layer | closed |
| P03-T-3-01 | Elevation of Privilege | `gerarTarefasDoMesAction` called directly by a COLABORADOR despite hidden button | mitigate | Server-side `if (session.user.role !== "DONO")` check first after `auth()`, before any DB access (`src/app/(app)/tarefas/actions.ts:230-237`); RBAC test asserts `createMany`/`findMany` not called | closed |
| P03-T-3-05 | Spoofing / unauthenticated access | `gerarTarefasDoMesAction` called without a session | mitigate | `auth()` guard returns error before role check (`src/app/(app)/tarefas/actions.ts:230-233`) | closed |
| P03-T-3-06 | Tampering | non-canonical competência string defeating idempotency | mitigate | `competenciaSchema.safeParse` validates optional input; default path uses `competenciaAtual()` (date-fns `format`, always canonical) (`src/app/(app)/tarefas/actions.ts:240-248`) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | P01-T-3-02 | `prisma db push` to Neon is additive-only (new enum, nullable columns, new indexes); table verified empty (0 rows) before applying `--accept-data-loss`, so no real data loss risk existed despite Prisma's structural warning | Caio | 2026-06-18 |
| AR-03-02 | P02-T-3-03 | Cron failures are only visible via `console.log`/`console.error`; email/WhatsApp alerting (NOTF-01) explicitly deferred to v2. Mitigated short-term by the DONO manual-trigger fallback button | Caio | 2026-06-18 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-18 | 9 | 9 | 0 | gsd-security-auditor |

**Informational note (non-blocking):** auditor found one out-of-band hardening — commit `7db76bb` wraps `executarGeracaoMensal`'s read+write in `db.$transaction`, strengthening P02-T-3-02 beyond what was required. Not a new threat.

**Minor note (non-blocking):** RESEARCH/PLAN docs describe dependency versions as "pinned to exact verified versions," but `package.json` records them with caret ranges (`^3.30.2`, `^4.4.1`, `^3.0.11`). Documentation/mechanism mismatch only — the audited version floor is still satisfied; no postinstall-script risk. Flagged for awareness, not classified as open.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-18
