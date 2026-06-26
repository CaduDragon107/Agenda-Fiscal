---
phase: 09
slug: decimo-terceiro-salario-automatico
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-25
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (já configurado no projeto desde a Fase 1) |
| **Config file** | `vitest.config.ts` (raiz do projeto) |
| **Quick run command** | `npx vitest run tests/geracao-tarefas-dp-anual.test.ts tests/tipo-obrigacao-setor.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30-60 segundos (suite completa, inclui Fiscal/DP/Contábil/IDOR existentes) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/geracao-tarefas-dp-anual.test.ts tests/tipo-obrigacao-setor.test.ts tests/geracao.idempotencia.test.ts`
- **After every plan wave:** Run `npx vitest run` (suite completa — crítico para pegar a quebra do teste de completude de `tipo-obrigacao-setor.test.ts` e qualquer deslocamento posicional de mock em `geracao.idempotencia.test.ts`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (assigned during planning) | — | — | DP-09 (critério 1) | — | Empresa CLT recebe exatamente 1 tarefa de 13º por ano, sem duplicar em execuções repetidas | unit + sweep 12 meses | `npx vitest run tests/geracao-tarefas-dp-anual.test.ts` | ❌ W0 | ⬜ pending |
| TBD (assigned during planning) | — | — | DP-09 (critério 2) | — | Empresa sem `temFuncionariosClt` nunca recebe a tarefa | unit | `npx vitest run tests/geracao-tarefas-dp-anual.test.ts` | ❌ W0 | ⬜ pending |
| TBD (assigned during planning) | — | — | DP-09 (critério 3) | — | Prazo (20/dez) ajustado para dia útil anterior quando cai em fim de semana/feriado | unit | `npx vitest run tests/geracao-tarefas-dp-anual.test.ts` | ❌ W0 | ⬜ pending |
| TBD (assigned during planning) | — | — | DP-09 (critério 4) | T-DP09-01 | Tarefa aparece nas listas/dashboards de DP do responsável correto (setor registrado em `TIPOS_OBRIGACAO_POR_SETOR`) | integration | `npx vitest run tests/tipo-obrigacao-setor.test.ts tests/geracao.idempotencia.test.ts` | ⚠️ partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs to be reconciled against actual PLAN.md files once planning completes.*

---

## Wave 0 Requirements

- [ ] `tests/geracao-tarefas-dp-anual.test.ts` — novo arquivo, cobre o catálogo novo, sweep de 12 meses (1 disparo de `DECIMO_TERCEIRO` em novembro, 0 nos demais meses), `calcularPrazoDpAnual` com dia útil normal e com ajuste de fim de semana/feriado real (validar 20/dez do ano de execução com `date-holidays` em tempo de implementação)
- [ ] Atualizar `tests/tipo-obrigacao-setor.test.ts` — contagem DP de 4→5, soma total 20→21, `arrayContaining` do bloco DP incluindo `"DECIMO_TERCEIRO"`
- [ ] Atualizar `tests/geracao.idempotencia.test.ts` — novo `it()` cobrindo o bloco DP-anual (idempotência entre 2 execuções da mesma competência) + ajuste posicional de mocks nos testes existentes se o novo bloco inserir uma chamada `findMany` extra
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
