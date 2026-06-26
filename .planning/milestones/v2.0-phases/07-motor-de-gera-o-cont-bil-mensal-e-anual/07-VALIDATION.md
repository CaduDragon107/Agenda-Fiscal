---
phase: 07
slug: motor-de-gera-o-cont-bil-mensal-e-anual
status: executed
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-24
validated: 2026-06-24
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (já configurado no projeto) |
| **Config file** | nenhum `vitest.config.*` dedicado — usa defaults do Vitest, mesma configuração já válida para as fases anteriores |
| **Quick run command** | `npx vitest run tests/geracao-tarefas-contabil.test.ts tests/geracao-tarefas-contabil-anual.test.ts tests/dia-util.test.ts` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~30-60 seconds (suite completa, inclui Fiscal/DP/IDOR existentes) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/geracao-tarefas-contabil.test.ts tests/geracao-tarefas-contabil-anual.test.ts tests/geracao.idempotencia.test.ts`
- **After every plan wave:** Run `npm test` (suite completa — crítico para confirmar que as suítes Fiscal/DP/IDOR existentes não regridem)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-T1/T2 | 07-01 | 0 | CONT-01 | — | Geração mensal das 8 rotinas Contábil para Lucro Real/Presumido, vencimento por dia-base + antecipação | unit | `npx vitest run tests/geracao-tarefas-contabil.test.ts` | ✅ exists | ✅ green |
| 07-02-T1 | 07-02 | 1 | CONT-02 | — | Motor de geração suporta periodicidade ANUAL coexistindo com mensal, sem colisão de competência | unit/integration | `npx vitest run tests/geracao-tarefas-contabil-anual.test.ts tests/geracao.idempotencia.test.ts` | ✅ exists | ✅ green |
| 07-01-T1/T2 | 07-01 | 0 | CONT-03 | — | Geração anual de ECD para Lucro Real e Lucro Presumido | unit | `npx vitest run tests/geracao-tarefas-contabil-anual.test.ts` | ✅ exists | ✅ green |
| 07-01-T1/T2 | 07-01 | 0 | CONT-04 | — | Geração anual de ECF para Lucro Real e Lucro Presumido | unit | `npx vitest run tests/geracao-tarefas-contabil-anual.test.ts` | ✅ exists | ✅ green |
| 07-01-T1/T2 | 07-01 | 0 | CONT-05 | — | Geração anual de DEFIS para Simples Nacional | unit | `npx vitest run tests/geracao-tarefas-contabil-anual.test.ts` | ✅ exists | ✅ green |
| 07-03-T1 | 07-03 | 1 | CONT-06 | T-CONT-01 | Tarefa avulsa atribuível a colaboradores Contábil (reuso de `criarTarefa`), respeitando escopo setor-aware | integration/regression | `npx vitest run tests/tarefas.contabil.test.ts` | ✅ exists | ✅ green |
| 07-02-T2 | 07-02 | 1 | D-11 | T-CONT-02 | Empresa sem responsável Contábil é pulada (mensal e anual) e listada no retorno, sem bloquear outras empresas | unit/integration | `npx vitest run tests/geracao.idempotencia.test.ts` | ✅ exists | ✅ green |
| 07-02-T1 | 07-02 | 1 | (idempotência anual) | — | Rodar as 12 competências de um ano gera exatamente 1 tarefa de cada obrigação anual por empresa elegível, sem duplicação em reexecução do mesmo mês | unit/integration | `npx vitest run tests/geracao-tarefas-contabil-anual.test.ts tests/geracao.idempotencia.test.ts` | ✅ exists | ✅ green |
| 07-01-T1/T2 | 07-01 | 0 | (Pitfall 2) | — | Vencimento anual cai no ano SEGUINTE ao ano-base da competência, com antecipação correta para dia útil quando aplicável | unit | `npx vitest run tests/geracao-tarefas-contabil-anual.test.ts` | ✅ exists | ✅ green |
| 07-01-T3 | 07-01 | 1 | T-07-02 (enum sync) | T-07-02 | Enum `TipoObrigacao` (11 novos valores) aplicado ao banco Neon via `prisma db push`, confirmado por `prisma db pull --print` | manual+introspection | `npx prisma db pull --print \| grep -A 25 "enum TipoObrigacao"` | ✅ resolved (was blocked in 07-01 checkpoint, closed in 07-VERIFICATION.md/07-SECURITY.md) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs reconciled against 07-01/07-02/07-03 PLAN+SUMMARY files during /gsd-validate-phase audit (2026-06-24).*

---

## Wave 0 Requirements

- [x] `tests/geracao-tarefas-contabil.test.ts` — novo arquivo, cobre o catálogo mensal Contábil puro (mirror de `tests/geracao-tarefas.test.ts` e `tests/geracao-tarefas-dp.test.ts`)
- [x] `tests/geracao-tarefas-contabil-anual.test.ts` — novo arquivo, cobre `obrigacoesAnuaisParaCompetencia` e o cálculo de prazo anual, incluindo varredura das 12 competências de pelo menos 1 ano completo
- [x] `tests/geracao.idempotencia.test.ts` — estendido com casos: (a) geração mensal Contábil normal, (b) empresa sem responsável Contábil pulada e listada, (c) bloco anual disparando no mês correto, (d) segunda execução não duplica tarefas anuais nem mensais Contábil
- [x] Nenhuma instalação de framework necessária — Vitest já configurado e em uso

---

## Manual-Only Verifications

*Nenhuma — todos os comportamentos desta fase têm verificação automatizada via Vitest (geração é um processo de backend/cron, sem UI nova a validar manualmente; CONT-06 reusa `criarTarefa()` já coberto por testes existentes). O sync do enum `TipoObrigacao` com o banco Neon (Task 3, 07-01) foi confirmado por introspecção (`prisma db pull --print`) e está documentado como ✓ VERIFIED em 07-VERIFICATION.md e `closed` em 07-SECURITY.md — não requer follow-up manual.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-24 (gsd-plan-checker — VERIFICATION PASSED)

---

## Validation Audit 2026-06-24

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 9 requirement rows reconciled against actual Plan/Task IDs (07-01, 07-02, 07-03) and confirmed COVERED. Targeted suite (`tests/geracao-tarefas-contabil.test.ts`, `tests/geracao-tarefas-contabil-anual.test.ts`, `tests/geracao.idempotencia.test.ts`, `tests/tarefas.contabil.test.ts`) — 31/31 passed. Full suite (`npm test`) — 158/158 passed, 28 files, no regressions. The Task-3 Prisma enum-sync blocker noted in 07-01-SUMMARY.md was confirmed resolved (closed in 07-SECURITY.md, ✓ VERIFIED in 07-VERIFICATION.md).
