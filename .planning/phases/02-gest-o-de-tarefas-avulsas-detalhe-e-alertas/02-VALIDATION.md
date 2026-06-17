---
phase: 2
slug: gest-o-de-tarefas-avulsas-detalhe-e-alertas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 |
| **Config file** | `vitest.config.ts` (raiz do projeto) |
| **Quick run command** | `npx vitest run tests/tarefas*.test.ts tests/alert-prazo.test.ts tests/visibility-scope.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/tarefas*.test.ts tests/alert-prazo.test.ts tests/visibility-scope.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| concluirTarefa-ok | TBD | 0 | TASK-03 | — | status muda para CONCLUIDA, TarefaHistorico criado | unit | `npx vitest run tests/tarefas.crud.test.ts` | ❌ W0 | ⬜ pending |
| concluirTarefa-idor | TBD | 0 | TASK-03 | T-02-IDOR | COLABORADOR não pode concluir tarefa de outro → retorna "não encontrado" | unit | `npx vitest run tests/tarefas.idor.test.ts` | ❌ W0 | ⬜ pending |
| criarTarefa-ok | TBD | 0 | TASK-04 | — | cria Tarefa com todos campos obrigatórios | unit | `npx vitest run tests/tarefas.crud.test.ts` | ❌ W0 | ⬜ pending |
| criarTarefa-invalida | TBD | 0 | TASK-04 | T-02-INPUT | sem título/empresa/prazo retorna `{ ok: false }` | unit | `npx vitest run tests/tarefas.crud.test.ts` | ❌ W0 | ⬜ pending |
| buscarTarefaPorId-scope | TBD | 0 | TASK-05 | T-02-IDOR | retorna null para tarefa fora do escopo do usuário | unit | `npx vitest run tests/tarefas.queries.test.ts` | ❌ W0 | ⬜ pending |
| alerta-atrasada | TBD | 0 | ALRT-01 | — | `calcularAlertaPrazo` retorna 🔴/"Atrasada" para prazo < now | unit | `npx vitest run tests/alert-prazo.test.ts` | ❌ W0 | ⬜ pending |
| alerta-proximo | TBD | 0 | ALRT-01 | — | `calcularAlertaPrazo` retorna 🟡/"Prazo próximo" para prazo ≤ now+3d | unit | `npx vitest run tests/alert-prazo.test.ts` | ❌ W0 | ⬜ pending |
| alerta-normal | TBD | 0 | ALRT-01 | — | `calcularAlertaPrazo` retorna normal para prazo > now+3d | unit | `npx vitest run tests/alert-prazo.test.ts` | ❌ W0 | ⬜ pending |
| withTarefaScope-dono | TBD | 0 | AUTH-02 | T-02-SCOPE | DONO recebe `{}` (todas as tarefas) | unit | `npx vitest run tests/visibility-scope.test.ts` | ❌ W0 ext | ⬜ pending |
| withTarefaScope-colab | TBD | 0 | AUTH-02 | T-02-SCOPE | COLABORADOR recebe `{ responsavelId: user.id }` | unit | `npx vitest run tests/visibility-scope.test.ts` | ❌ W0 ext | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/tarefas.crud.test.ts` — stubs para TASK-03 (concluirTarefa) e TASK-04 (criarTarefa)
- [ ] `tests/tarefas.idor.test.ts` — stubs para AUTH-02 aplicado a tarefas (TASK-03 IDOR)
- [ ] `tests/tarefas.queries.test.ts` — stubs para TASK-05 (buscarTarefaPorId com escopo)
- [ ] `tests/alert-prazo.test.ts` — stubs para ALRT-01 (calcularAlertaPrazo helper puro)
- [ ] `tests/visibility-scope.test.ts` — já existe; estender com casos de `withTarefaScope` (Wave 0)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tarefas concluídas ficam ocultas por padrão e visíveis com filtro | TASK-03 + D-08 | Estado visual de filtro e ocultação depende de interação na tabela | Acessar `/tarefas`, verificar que tarefas CONCLUIDAS não aparecem; ativar filtro "Mostrar concluídas" e verificar que aparecem |
| Badge numérico da sidebar conta corretamente pendentes/atrasadas do usuário logado | ALRT-01 + D-09 | Depende de sessão ativa com papel COLABORADOR vs DONO | Login como colaborador com 2 tarefas próximas → sidebar mostra "2"; login como dono → mostra total geral |
| Dialog "Nova tarefa" abre e fecha corretamente; formulário valida campos obrigatórios no client | TASK-04 | Comportamento de modal interativo | Clicar "Nova tarefa", deixar campo em branco, verificar mensagem de erro; preencher e submeter → tarefa aparece na lista |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
