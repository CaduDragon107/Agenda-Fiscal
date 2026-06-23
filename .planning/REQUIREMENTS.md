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

- [x] **TASK-01**: Geração automática mensal de tarefas recorrentes por empresa, conforme regime tributário (Lucro Real: ICMS + PIS/COFINS + SPED; Simples Nacional: DAS)
- [x] **TASK-02**: Prazo fixo por tipo de obrigação, ajustado automaticamente quando cai em fim de semana/feriado nacional
- [x] **TASK-03**: Marcar tarefa como concluída (checkbox simples)
- [x] **TASK-04**: Criação de tarefas avulsas (não-recorrentes) por qualquer membro da equipe, atribuíveis a qualquer pessoa
- [x] **TASK-05**: Detalhe de cada tarefa: passo a passo da obrigação, dados relevantes da empresa, histórico de conclusões anteriores
- [x] **TASK-06**: Passo a passo das tarefas de ICMS/PIS-COFINS referencia/conecta com as ferramentas de automação Python já existentes do usuário

### Alertas

- [x] **ALRT-01**: Alertas visuais dentro do site para tarefas com prazo próximo ou atrasado

### Dashboards (Diferencial Comparativo)

- [x] **DASH-01**: Dashboard comparativo de desempenho entre os funcionários (no prazo vs atrasado)
- [x] **DASH-02**: Dashboard de evolução mensal (tendências de cumprimento de prazos ao longo do tempo)
- [x] **DASH-03**: Dashboard comparativo entre empresas (quais geram mais atraso/problema recorrente)

### Infraestrutura

- [x] **INFRA-01**: Acesso ao sistema pela internet, não restrito à rede local do escritório

## v2.0 Requirements (Active Milestone — Expansão Multi-Setor)

Requirements for the DP + Contábil multi-sector expansion. Each maps to roadmap phases.

### Fundação Multi-Setor

- [ ] **SETR-01**: Sistema reconhece 3 setores (Fiscal, DP, Contábil) como dimensão de organização de usuários, empresas e tarefas
- [ ] **SETR-02**: Cada empresa-cliente tem 1 responsável por setor (fiscal, DP e contábil podem ser pessoas diferentes para a mesma empresa)
- [ ] **SETR-03**: Migração dos dados existentes preserva o responsável fiscal das 197 empresas já cadastradas, sem perda/duplicação
- [ ] **SETR-04**: Cada usuário colaborador pertence a um setor (Fiscal, DP ou Contábil)
- [ ] **SETR-05**: 7 novos colaboradores são cadastrados como placeholders (4 DP + 3 Contábil), renomeáveis depois sem mudança de estrutura
- [ ] **SETR-06**: Colaborador só vê tarefas/empresas do seu próprio setor E onde é o responsável (visibilidade não se amplia nem se restringe incorretamente em relação ao padrão já validado no setor Fiscal)
- [ ] **SETR-07**: Dono mantém visão geral de todos os 3 setores

### Departamento Pessoal (DP)

- [ ] **DP-01**: Sistema identifica quais empresas têm funcionários CLT (campo explícito), para não gerar obrigações de folha/FGTS/eSocial para empresas só com pró-labore
- [ ] **DP-02**: Geração automática mensal de Folha de Pagamento por empresa com funcionários CLT
- [ ] **DP-03**: Geração automática mensal de FGTS por empresa com funcionários CLT
- [ ] **DP-04**: Geração automática mensal de INSS por empresa com funcionários CLT
- [ ] **DP-05**: Geração automática mensal de eventos periódicos de eSocial por empresa com funcionários CLT
- [ ] **DP-06**: Prazos do DP ajustados automaticamente por dia útil/feriado, reaproveitando a mesma lógica do setor Fiscal
- [ ] **DP-07**: Criação de tarefas avulsas no setor DP, atribuíveis a qualquer colaborador DP
- [ ] **DP-08**: Dashboard de desempenho, evolução mensal e ranking de empresas — escopado ao setor DP

### Contábil

- [ ] **CONT-01**: Geração automática mensal de Escrituração Contábil/Balancete por empresa
- [ ] **CONT-02**: Motor de geração de tarefas suporta periodicidade ANUAL além da mensal (extensão arquitetural — primeira obrigação não-mensal do sistema)
- [ ] **CONT-03**: Geração automática anual de ECD (Escrituração Contábil Digital)
- [ ] **CONT-04**: Geração automática anual de ECF (Escrituração Contábil Fiscal)
- [ ] **CONT-05**: Geração automática anual de DEFIS, restrita a empresas do regime Simples Nacional
- [ ] **CONT-06**: Prazos anuais ajustados automaticamente por dia útil/feriado, reaproveitando a mesma lógica do setor Fiscal
- [ ] **CONT-07**: Criação de tarefas avulsas no setor Contábil, atribuíveis a qualquer colaborador Contábil
- [ ] **CONT-08**: Dashboard de desempenho, evolução mensal e ranking de empresas — escopado ao setor Contábil

### Cleanup

- [ ] **CLN-01**: Módulo de dashboard órfão e não utilizado (`src/modules/dashboard/`, singular) é removido do código

## v3 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Notificações (de v1.0)

- **NOTF-01**: Notificações por email/WhatsApp para prazos próximos ou atrasados

### Comprovantes (de v1.0)

- **ATCH-01**: Upload de anexos/comprovantes ao marcar tarefa como concluída

### Pessoal/DP avançado

- **DP-F01**: Cálculo automático de folha de pagamento dentro do sistema
- **DP-F02**: Integração/envio automático de eventos ao eSocial
- **DP-F03**: Cadastro completo de funcionários (mini-RH)

### Dashboards

- **DASH-F01**: Visão unificada de dashboard entre os 3 setores

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Calendário de feriados estaduais/municipais e regras de prazo por dígito final do CNPJ | v1 considera apenas feriados nacionais e prazo único por tipo de obrigação (Key Decision do PROJECT.md); este escritório não tem variação de prazo por CNPJ |
| Execução remota dos scripts de automação Python a partir do site | Risco de segurança (execução remota de código) e complexidade de arquitetura desproporcional; v1 apenas referencia/explica o uso das ferramentas existentes |
| Construtor visual de regras/templates de obrigação (admin no-code) | Regras vivem como catálogo em código, não precisam de UI de configuração |
| Time tracking / billing por tarefa | Sistema é um tracker de cumprimento de prazos, não uma ferramenta de faturamento por hora |
| Portal do cliente (acesso externo de clientes) | Uso 100% interno da equipe; adicionar usuários externos dobraria a superfície de segurança/UX |
| Cálculo de folha de pagamento | Fora do core value do sistema (gestão de prazos, não folha); escritório já tem processo próprio |
| Envio automático de eventos ao eSocial | Mesma decisão já tomada para ICMS/PIS-COFINS no v1.0 — sistema referencia, não executa automações externas |
| Cadastro completo de funcionários (mini-RH) | Expande demais o escopo de dados; sistema rastreia obrigações da empresa, não funcionários individuais |
| Dashboard unificado entre setores | Decisão explícita do usuário ao escopar o milestone v2.0 — cada setor tem visão própria |
| Calendário de convenções coletivas para prazo de folha | Convenção varia por categoria/sindicato; v2.0 usa regra fixa a confirmar com o dono, não um calendário dinâmico |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| EMPR-01 | Phase 1 | Complete |
| EMPR-02 | Phase 1 | Complete |
| TASK-01 | Phase 3 | Complete |
| TASK-02 | Phase 3 | Complete |
| TASK-03 | Phase 2 | Complete |
| TASK-04 | Phase 2 | Complete |
| TASK-05 | Phase 2 | Complete |
| TASK-06 | Phase 2 | Complete |
| ALRT-01 | Phase 2 | Complete |
| DASH-01 | Phase 4 | Complete |
| DASH-02 | Phase 4 | Complete |
| DASH-03 | Phase 4 | Complete |
| INFRA-01 | Phase 1 | Complete |
| SETR-01 | Pending roadmap | Pending |
| SETR-02 | Pending roadmap | Pending |
| SETR-03 | Pending roadmap | Pending |
| SETR-04 | Pending roadmap | Pending |
| SETR-05 | Pending roadmap | Pending |
| SETR-06 | Pending roadmap | Pending |
| SETR-07 | Pending roadmap | Pending |
| DP-01 | Pending roadmap | Pending |
| DP-02 | Pending roadmap | Pending |
| DP-03 | Pending roadmap | Pending |
| DP-04 | Pending roadmap | Pending |
| DP-05 | Pending roadmap | Pending |
| DP-06 | Pending roadmap | Pending |
| DP-07 | Pending roadmap | Pending |
| DP-08 | Pending roadmap | Pending |
| CONT-01 | Pending roadmap | Pending |
| CONT-02 | Pending roadmap | Pending |
| CONT-03 | Pending roadmap | Pending |
| CONT-04 | Pending roadmap | Pending |
| CONT-05 | Pending roadmap | Pending |
| CONT-06 | Pending roadmap | Pending |
| CONT-07 | Pending roadmap | Pending |
| CONT-08 | Pending roadmap | Pending |
| CLN-01 | Pending roadmap | Pending |

**Coverage:**

- v1 requirements: 15 total (shipped)
- v2.0 requirements: 24 total
- Mapped to phases: 15 of 15 (v1.0) — v2.0 mapping pending roadmap creation
- Unmapped: 24 ⚠️ (will be resolved by gsd-roadmapper)

---
*Requirements defined: 2026-06-11*
*Last updated: 2026-06-22 after defining v2.0 milestone requirements*
