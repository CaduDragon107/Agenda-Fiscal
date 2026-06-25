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

## v2.0 Requirements — Expansão Multi-Setor (DP e Contábil)

**Defined:** 2026-06-23
**Goal:** Replicar a estrutura validada do setor Fiscal (geração automática, tarefas avulsas, dashboards) para os setores DP e Contábil, atendendo a mesma carteira de ~197 empresas.

### Fundação Multi-Setor

- [x] **SETOR-01**: Empresa passa a ter 1 responsável por setor (fiscal/DP/contábil), substituindo o responsável único atual — migração de schema com backfill verificado das 197 empresas existentes para o setor Fiscal
- [x] **SETOR-02**: Usuário ganha campo Setor (FISCAL/DP/CONTABIL); sistema é populado com 7 colaboradores placeholder (4 DP + 3 Contábil), renomeáveis depois
- [x] **SETOR-03**: Seletores de atribuição de tarefa avulsa e responsável de empresa filtram colaboradores pelo setor relevante

### Empresas

- [x] **EMPR-03**: Empresa ganha campo "tem funcionários CLT?" (sim/não), usado para decidir se gera obrigações de DP — evita tarefas falsas para empresas só com pró-labore

### Departamento Pessoal (DP)

- [x] **DP-01**: Geração automática mensal de Folha de Pagamento, por empresa com funcionários CLT
- [x] **DP-02**: Geração automática mensal de FGTS
- [x] **DP-03**: Geração automática mensal de INSS
- [x] **DP-04**: Geração automática mensal de eventos periódicos de eSocial
- [x] **DP-05**: Tarefas avulsas atribuíveis aos colaboradores de DP (reuso do mecanismo existente)
- [ ] **DP-06**: Dashboard de desempenho por colaborador DP (no prazo vs atrasado)
- [ ] **DP-07**: Dashboard de evolução mensal DP
- [ ] **DP-08**: Dashboard de ranking de empresas problemáticas no DP

### Contábil

- [x] **CONT-01**: Geração automática mensal de Escrituração/Balancete Contábil, para todas as empresas
- [x] **CONT-02**: Motor de geração estendido para suportar periodicidade ANUAL, além da mensal já existente
- [x] **CONT-03**: Geração automática anual de ECD (Escrituração Contábil Digital) para empresas Lucro Real
- [x] **CONT-04**: Geração automática anual de ECF (Escrituração Contábil Fiscal)
- [x] **CONT-05**: Geração automática anual de DEFIS para empresas Simples Nacional
- [x] **CONT-06**: Tarefas avulsas atribuíveis aos colaboradores Contábil (reuso do mecanismo existente)
- [ ] **CONT-07**: Dashboard de desempenho por colaborador Contábil (no prazo vs atrasado)
- [ ] **CONT-08**: Dashboard de evolução mensal Contábil
- [ ] **CONT-09**: Dashboard de ranking de empresas problemáticas no Contábil

## Future Requirements (v2.x / v3+)

Deferred to future release. Tracked but not in current roadmap.

### Notificações

- **NOTF-01**: Notificações por email/WhatsApp para prazos próximos ou atrasados

### Comprovantes

- **ATCH-01**: Upload de anexos/comprovantes ao marcar tarefa como concluída

### DP avançado

- **DP-09**: Rescisão/desligamento como obrigação com prazo derivado de evento, não fixo por competência
- **DP-10**: Férias e 13º salário como lembretes/obrigações semi-recorrentes (datas variam por funcionário)
- **EMPR-04**: Campo "quantidade de funcionários" na Empresa (não só booleano)

### Visão cross-setor

- **DASH-10**: Visão unificada de dashboard entre os 3 setores (explicitamente fora de escopo da v2.0)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Calendário de feriados estaduais/municipais e regras de prazo por dígito final do CNPJ | v1 considera apenas feriados nacionais e prazo único por tipo de obrigação (Key Decision do PROJECT.md); este escritório não tem variação de prazo por CNPJ |
| Execução remota dos scripts de automação Python a partir do site | Risco de segurança (execução remota de código) e complexidade de arquitetura desproporcional; v1 apenas referencia/explica o uso das ferramentas existentes |
| Construtor visual de regras/templates de obrigação (admin no-code) | Apenas 2 regimes e ~4 tipos de obrigação no v1 — regras vivem como dados/seed, não precisam de UI de configuração |
| Time tracking / billing por tarefa | Sistema é um tracker de cumprimento de prazos, não uma ferramenta de faturamento por hora |
| Portal do cliente (acesso externo de clientes) | Uso 100% interno da equipe no v1; adicionar usuários externos dobraria a superfície de segurança/UX |
| Cálculo automático de folha de pagamento dentro do sistema | Domínio de software de folha dedicado (tabelas INSS/IRRF, convenções coletivas); sistema permanece um gestor de tarefas, referenciando a ferramenta externa já usada pelo escritório |
| Execução/integração automática com eSocial (envio de eventos) | Exige certificado digital, assinatura e validação de schema XML — fora do core value ("nunca perder prazo" é sobre visibilidade, não automação de envio); mesma decisão já tomada para ICMS/PIS-COFINS no v1.0 |
| Cadastro completo de funcionários (mini-RH) | Duplicaria dados já existentes no software de folha do escritório, criando dois lugares de verdade e risco de dados trabalhistas (LGPD) desatualizados |
| Visão unificada de dashboard entre os 3 setores | Decisão explícita do usuário nesta milestone; combinar métricas de cadências diferentes (mensal vs anual) complica a UI sem necessidade validada |
| Calendário de convenções coletivas por categoria/sindicato | Varia por sindicato/região e muda anualmente — escopo de produto jurídico-trabalhista dedicado, fora do core value |

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
| SETOR-01 | Phase 5 | Complete |
| SETOR-02 | Phase 5 | Complete |
| SETOR-03 | Phase 5 | Complete |
| EMPR-03 | Phase 5 | Complete |
| DP-01 | Phase 6 | Complete |
| DP-02 | Phase 6 | Complete |
| DP-03 | Phase 6 | Complete |
| DP-04 | Phase 6 | Complete |
| DP-05 | Phase 6 | Complete |
| DP-06 | Phase 8 | Pending |
| DP-07 | Phase 8 | Pending |
| DP-08 | Phase 8 | Pending |
| CONT-01 | Phase 7 | Complete |
| CONT-02 | Phase 7 | Complete |
| CONT-03 | Phase 7 | Complete |
| CONT-04 | Phase 7 | Complete |
| CONT-05 | Phase 7 | Complete |
| CONT-06 | Phase 7 | Complete |
| CONT-07 | Phase 8 | Pending |
| CONT-08 | Phase 8 | Pending |
| CONT-09 | Phase 8 | Pending |

**Coverage:**

- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓
- v2.0 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-11 (v1) / 2026-06-23 (v2.0)*
*Last updated: 2026-06-23 — v2.0 roadmap created (Phases 5-8), all 21 v2.0 requirements mapped*
