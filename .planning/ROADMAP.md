# Roadmap: Agenda Fiscal

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-06-22)
- ✅ **v2.0 Expansão Multi-Setor (DP e Contábil)** — Phases 5-8 (shipped 2026-06-25) — see `.planning/milestones/v2.0-ROADMAP.md`
- 🔄 **v2.1 13º Salário e Notificações In-App** — Phases 9-10 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-06-22</summary>

- [x] Phase 1: Fundação — Acesso, Empresas e Importação — completed 2026-06-15
- [x] Phase 2: Gestão de Tarefas — Avulsas, Detalhe e Alertas — completed 2026-06-17
- [x] Phase 3: Motor de Geração Automática Mensal — completed 2026-06-18
- [x] Phase 4: Dashboards Comparativos — completed 2026-06-22

</details>

<details>
<summary>✅ v2.0 Expansão Multi-Setor — DP e Contábil (Phases 5-8) — SHIPPED 2026-06-25</summary>

- [x] Phase 5: Fundação Multi-Setor — Schema, Autorização e Empresas (4/4 plans) — completed 2026-06-24
- [x] Phase 6: Motor de Geração — Departamento Pessoal (3/3 plans) — completed 2026-06-24
- [x] Phase 7: Motor de Geração — Contábil (mensal e anual) (3/3 plans) — completed 2026-06-24
- [x] Phase 8: Dashboards Multi-Setor — DP e Contábil (3/3 plans) — completed 2026-06-25

Full phase details (goals, success criteria, plans): `.planning/milestones/v2.0-ROADMAP.md`

</details>

### v2.1 13º Salário e Notificações In-App (Phases 9-10) — IN PROGRESS

- [ ] **Phase 9: 13º Salário Automático** - Geração automática anual de tarefa de 13º salário, reaproveitando o motor de periodicidade anual já validado no Contábil
- [ ] **Phase 10: Notificações In-App** - Sino/badge no header notifica o usuário sobre tarefas vencendo, atrasadas ou avulsas atribuídas a ele, com visibilidade escopada por responsável

## Phase Details

### Phase 9: 13º Salário Automático
**Goal**: Toda empresa com funcionários CLT tem, todo ano, uma tarefa de 13º salário gerada automaticamente — sem necessidade de criação manual.
**Depends on**: Phase 7 (motor de periodicidade anual já validado — ECD/ECF/DEFIS)
**Requirements**: DP-09
**Success Criteria** (what must be TRUE):
  1. Empresa com `temFuncionariosClt = true` recebe, uma vez por ano, uma tarefa de 13º salário gerada automaticamente pelo cron mensal (sem duplicação em execuções repetidas no mesmo ano)
  2. Empresa sem funcionários CLT (`temFuncionariosClt = false`) nunca recebe tarefa de 13º salário
  3. Prazo da tarefa de 13º salário é ajustado automaticamente para o próximo dia útil quando cai em fim de semana/feriado, igual às demais obrigações
  4. Responsável de DP da empresa vê a tarefa de 13º salário na sua lista de tarefas e nos dashboards de DP, com o mesmo tratamento de qualquer outra obrigação DP
**Plans**: TBD

### Phase 10: Notificações In-App
**Goal**: A equipe recebe um alerta visível (sino/badge) dentro do site para prazos próximos, tarefas atrasadas, e tarefas avulsas atribuídas a ela — sem precisar abrir cada lista de tarefas para descobrir.
**Depends on**: Phase 9 (não bloqueante — notificações consomem o mesmo modelo de Tarefa já existente; ordenação reflete prioridade de entrega, não dependência técnica rígida)
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04
**Success Criteria** (what must be TRUE):
  1. Usuário vê um sino com badge de contagem no header, visível em qualquer página do site
  2. Usuário recebe notificação quando uma tarefa sua está vencendo em breve (mesmo limiar dos alertas visuais já existentes)
  3. Usuário recebe notificação quando uma tarefa sua está atrasada
  4. Usuário recebe notificação quando uma tarefa avulsa é atribuída a ele
  5. COLABORADOR só vê notificações das tarefas das quais é responsável; DONO vê notificações de todos os setores e colaboradores (mesma regra de `withVisibilityScope`)
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status   | Completed  |
| ----- | --------- | --------------- | -------- | ---------- |
| 1. Fundação — Acesso, Empresas e Importação | v1.0 | — | Complete | 2026-06-15 |
| 2. Gestão de Tarefas | v1.0 | — | Complete | 2026-06-17 |
| 3. Motor de Geração Automática Mensal | v1.0 | — | Complete | 2026-06-18 |
| 4. Dashboards Comparativos | v1.0 | — | Complete | 2026-06-22 |
| 5. Fundação Multi-Setor | v2.0 | 4/4 | Complete | 2026-06-24 |
| 6. Motor de Geração — DP | v2.0 | 3/3 | Complete | 2026-06-24 |
| 7. Motor de Geração — Contábil | v2.0 | 3/3 | Complete | 2026-06-24 |
| 8. Dashboards Multi-Setor | v2.0 | 3/3 | Complete | 2026-06-25 |
| 9. 13º Salário Automático | v2.1 | 0/0 | Not started | - |
| 10. Notificações In-App | v2.1 | 0/0 | Not started | - |

Phase numbering continues from the next milestone (v2.1 or v3.0 starts at Phase 9 — never restart at 01). Run `/gsd-new-milestone` to scope the next milestone.
