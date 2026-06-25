# Requirements: Agenda Fiscal

**Defined:** 2026-06-25
**Core Value:** A equipe nunca perde um prazo — fiscal, de pessoal ou contábil — de nenhum cliente, e o dono sempre sabe em tempo real o status de tudo, em qualquer setor.

## v1 Requirements (Milestone v2.1)

### Departamento Pessoal (DP)

- [ ] **DP-09**: Geração automática anual de tarefa de 13º salário, por empresa com funcionários CLT (`temFuncionariosClt`), reaproveitando o motor de periodicidade anual já validado no Contábil (ECD/ECF/DEFIS)

### Notificações

- [ ] **NOTF-01**: Notificação in-app (sino/badge) para tarefa vencendo em breve (mesmo limiar dos alertas visuais existentes)
- [ ] **NOTF-02**: Notificação in-app para tarefa atrasada
- [ ] **NOTF-03**: Notificação in-app para tarefa avulsa atribuída ao usuário
- [ ] **NOTF-04**: Notificações visíveis apenas para o responsável da tarefa (dono vê notificações de todos, mesma regra de `withVisibilityScope`)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### DP avançado

- **DP-10**: Férias como obrigação de DP — depende de cadastro de funcionários individuais (nome, data de admissão), descartado para v2.1
- **DP-11**: Rescisão/desligamento como obrigação com prazo derivado de evento, não fixo por competência — mesma dependência de cadastro de funcionários
- **EMPR-04**: Cadastro de funcionários individuais por empresa (nome, data de admissão) — pré-requisito de DP-10/DP-11

### Notificações avançadas

- **NOTF-05**: Notificação por email para prazos próximos ou atrasados

### Comprovantes

- **ATCH-01**: Anexar comprovante de conclusão à tarefa

### Visão cross-setor

- **DASH-09**: Dashboard unificado entre os 3 setores (visão única do dono cruzando Fiscal/DP/Contábil)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Cadastro de funcionários individuais (nome, data de admissão) | Férias/rescisão ficam manuais via tarefa avulsa neste milestone; cadastro de funcionários é pré-requisito de DP-10/DP-11, deferido |
| Notificação por email/WhatsApp | v2.1 cobre só in-app; canal externo fica candidato a versão futura (NOTF-05) |
| Cálculo de valores de 13º/férias/rescisão | DP-09 gera e rastreia a tarefa, não calcula valores monetários |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DP-09 | TBD | Pending |
| NOTF-01 | TBD | Pending |
| NOTF-02 | TBD | Pending |
| NOTF-03 | TBD | Pending |
| NOTF-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 5 total
- Mapped to phases: 0
- Unmapped: 5 ⚠️ (roadmap pending)

---
*Requirements defined: 2026-06-25*
*Last updated: 2026-06-25 after initial definition*
