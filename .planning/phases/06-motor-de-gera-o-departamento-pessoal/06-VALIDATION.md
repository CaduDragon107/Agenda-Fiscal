---
phase: 06
slug: motor-de-gera-o-departamento-pessoal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 (já configurado no projeto) |
| **Config file** | nenhum `vitest.config.*` dedicado — usa defaults do Vitest com resolução `@/` via `tsconfig.json` |
| **Quick run command** | `npx vitest run tests/geracao-tarefas-dp.test.ts tests/dia-util.test.ts tests/geracao.idempotencia.test.ts` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~30-60 seconds (suite completa, inclui Fiscal/IDOR existentes) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/geracao-tarefas-dp.test.ts tests/dia-util.test.ts tests/geracao.idempotencia.test.ts`
- **After every plan wave:** Run `npm test` (suite completa — crítico para confirmar que a suite Fiscal/IDOR existente não regrediu, ver Pitfall B3 do PITFALLS.md)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-XX | TBD | 0 | DP-01 | — | Folha de Pagamento gerada no 5º dia útil do mês seguinte | unit | `npx vitest run tests/dia-util.test.ts` | ❌ Wave 0 — estender com casos de `calcularQuintoDiaUtil` | ⬜ pending |
| 06-01-XX | TBD | 0 | DP-01 | — | Catálogo DP gera Folha de Pagamento corretamente | unit | `npx vitest run tests/geracao-tarefas-dp.test.ts` | ❌ Wave 0 — criar arquivo novo | ⬜ pending |
| 06-01-XX | TBD | 1 | DP-02 | — | FGTS gerado dia-base 15, antecipa para dia útil anterior | unit | `npx vitest run tests/geracao-tarefas-dp.test.ts` | ❌ Wave 0 | ⬜ pending |
| 06-01-XX | TBD | 1 | DP-03 | — | INSS gerado dia-base 15, antecipa para dia útil anterior | unit | `npx vitest run tests/geracao-tarefas-dp.test.ts` | ❌ Wave 0 | ⬜ pending |
| 06-01-XX | TBD | 1 | DP-04 | — | Fechamento eSocial gerado dia-base 07, antecipa para dia útil anterior | unit | `npx vitest run tests/geracao-tarefas-dp.test.ts` | ❌ Wave 0 | ⬜ pending |
| 06-01-XX | TBD | 1 | DP-05 | T-DP-01 | Tarefa avulsa de DP respeita escopo setor-aware (`withVisibilityScope`/`withTarefaScope`) | integration/regression | `npx vitest run tests/tarefas.idor.test.ts tests/tarefas.crud.test.ts` | ✅ existe — confirmar cobertura DP, estender com 1 fixture se necessário | ⬜ pending |
| 06-01-XX | TBD | 1 | D-01/D-02/D-03 | T-DP-02 | Empresa CLT sem responsável DP é pulada (sem criar tarefa) e listada no retorno, sem bloquear outras empresas | unit/integration | `npx vitest run tests/geracao.idempotencia.test.ts` | ❌ Wave 0 — estender arquivo existente | ⬜ pending |
| 06-01-XX | TBD | 1 | (idempotência) | — | Rodar geração 2x na mesma competência não duplica tarefas de DP | integration | `npx vitest run tests/geracao.idempotencia.test.ts` | ❌ Wave 0 — estender arquivo existente | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders (TBD) — the planner fills in exact Plan/Task IDs as PLAN.md files are written.*

---

## Wave 0 Requirements

- [ ] `tests/geracao-tarefas-dp.test.ts` — novo arquivo, cobre o catálogo DP puro (mirror de `tests/geracao-tarefas.test.ts`)
- [ ] `tests/dia-util.test.ts` — estender com casos de `calcularQuintoDiaUtil` (ao menos 2 anos diferentes, incluindo virada de ano/feriado de Ano Novo)
- [ ] `tests/geracao.idempotencia.test.ts` — estender com casos de DP: (a) geração normal com responsável DP atribuído, (b) empresa sem responsável DP pulada e listada, (c) segunda execução não duplica
- [ ] Nenhuma instalação de framework necessária — Vitest já configurado e em uso

---

## Manual-Only Verifications

*Nenhuma — todos os comportamentos desta fase têm verificação automatizada via Vitest (geração é um processo de backend/cron, sem UI nova a validar manualmente).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
