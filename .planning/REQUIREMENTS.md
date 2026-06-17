# Requirements: Agenda Fiscal

**Defined:** 2026-06-11
**Core Value:** A equipe nunca perde um prazo fiscal de nenhum cliente, e o dono sempre sabe em tempo real o status de tudo.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Auth (Autenticação e Permissões)

- [x] **AUTH-01**: Login individual para os 4 membros da equipe + dono (5 usuários), com sessão persistente
- [x] **AUTH-02**: Visibilidade diferenciada por papel — colaborador vê apenas suas tarefas e empresas; dono vê de todos, sem restrição

### Empresas (Cadastro de Clientes)

- [x] **EMPR-01**: Cadastro de empresas-cliente com nome, CNPJ, regime tributário, responsável, contatos e particularidades
- [x] **EMPR-02**: Importação inicial das 100+ empresas a partir da planilha "Controle pis e cofins.xlsx" existente, com etapa de revisão antes de persistir

### Tarefas (Geração, Execução e Histórico)

- [ ] **TASK-01**: Geração automática mensal de tarefas recorrentes por empresa, conforme regime tributário (Lucro Real: ICMS + PIS/COFINS + SPED; Simples Nacional: DAS)
- [ ] **TASK-02**: Prazo fixo por tipo de obrigação, ajustado automaticamente quando cai em fim de semana/feriado nacional
- [x] **TASK-03**: Marcar tarefa como concluída (checkbox simples)
- [x] **TASK-04**: Criação de tarefas avulsas (não-recorrentes) por qualquer membro da equipe, atribuíveis a qualquer pessoa
- [x] **TASK-05**: Detalhe de cada tarefa: passo a passo da obrigação, dados relevantes da empresa, histórico de conclusões anteriores
- [x] **TASK-06**: Passo a passo das tarefas de ICMS/PIS-COFINS referencia/conecta com as ferramentas de automação Python já existentes do usuário

### Alertas

- [x] **ALRT-01**: Alertas visuais dentro do site para tarefas com prazo próximo ou atrasado

### Dashboards (Diferencial Comparativo)

- [ ] **DASH-01**: Dashboard comparativo de desempenho entre os funcionários (no prazo vs atrasado)
- [ ] **DASH-02**: Dashboard de evolução mensal (tendências de cumprimento de prazos ao longo do tempo)
- [ ] **DASH-03**: Dashboard comparativo entre empresas (quais geram mais atraso/problema recorrente)

### Infraestrutura

- [x] **INFRA-01**: Acesso ao sistema pela internet, não restrito à rede local do escritório

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Notificações

- **NOTF-01**: Notificações por email/WhatsApp para prazos próximos ou atrasados

### Comprovantes

- **ATCH-01**: Upload de anexos/comprovantes ao marcar tarefa como concluída

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Calendário de feriados estaduais/municipais e regras de prazo por dígito final do CNPJ | v1 considera apenas feriados nacionais e prazo único por tipo de obrigação (Key Decision do PROJECT.md); este escritório não tem variação de prazo por CNPJ |
| Execução remota dos scripts de automação Python a partir do site | Risco de segurança (execução remota de código) e complexidade de arquitetura desproporcional; v1 apenas referencia/explica o uso das ferramentas existentes |
| Construtor visual de regras/templates de obrigação (admin no-code) | Apenas 2 regimes e ~4 tipos de obrigação no v1 — regras vivem como dados/seed, não precisam de UI de configuração |
| Time tracking / billing por tarefa | Sistema é um tracker de cumprimento de prazos, não uma ferramenta de faturamento por hora |
| Portal do cliente (acesso externo de clientes) | Uso 100% interno da equipe no v1; adicionar usuários externos dobraria a superfície de segurança/UX |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| EMPR-01 | Phase 1 | Complete |
| EMPR-02 | Phase 1 | Complete |
| TASK-01 | Phase 3 | Pending |
| TASK-02 | Phase 3 | Pending |
| TASK-03 | Phase 2 | Complete |
| TASK-04 | Phase 2 | Complete |
| TASK-05 | Phase 2 | Complete |
| TASK-06 | Phase 2 | Complete |
| ALRT-01 | Phase 2 | Complete |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 4 | Pending |
| DASH-03 | Phase 4 | Pending |
| INFRA-01 | Phase 1 | Complete |

**Coverage:**

- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-11*
*Last updated: 2026-06-11 after roadmap creation (4 phases, Vertical MVP structure)*
