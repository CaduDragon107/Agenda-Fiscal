# Roadmap: Agenda Fiscal

## Overview

O sistema nasce com a fundação de acesso (login individual, permissões por papel, cadastro de empresas-cliente já populado via importação da planilha existente, e disponível pela internet). Em seguida, a equipe ganha uma ferramenta de gestão de tarefas completa — criação de tarefas avulsas, conclusão, detalhe com passo a passo e histórico, e alertas visuais — totalmente utilizável mesmo antes de qualquer automação. Depois, o motor de geração mensal automática passa a alimentar essa mesma interface com as tarefas recorrentes de cada empresa (ICMS, PIS/COFINS, SPED, DAS), com prazos corretamente ajustados por dia útil/feriado e sem duplicação. Por fim, com dados reais de uso acumulados, os dashboards comparativos entregam o diferencial central pedido pelo dono: visão de desempenho da equipe, evolução mensal e ranking de empresas problemáticas.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Fundação — Acesso, Empresas e Importação** - Login individual com permissões por papel, cadastro de empresas-cliente populado via importação revisada da planilha existente, sistema acessível pela internet
- [ ] **Phase 2: Gestão de Tarefas — Avulsas, Detalhe e Alertas** - Criação/atribuição de tarefas avulsas, conclusão com histórico, detalhe com passo a passo e referência às automações Python, alertas visuais de prazo
- [ ] **Phase 3: Motor de Geração Automática Mensal** - Geração automática mensal de tarefas recorrentes por regime tributário, com prazos ajustados por dia útil/feriado e sem duplicação
- [ ] **Phase 4: Dashboards Comparativos** - Dashboards de desempenho por colaborador, evolução mensal e comparativo entre empresas

## Phase Details

### Phase 1: Fundação — Acesso, Empresas e Importação

**Goal**: A equipe acessa o sistema pela internet com login individual e visibilidade por papel, e o cadastro de empresas-cliente está populado e gerenciável a partir da planilha existente.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, EMPR-01, EMPR-02, INFRA-01
**Success Criteria** (what must be TRUE):

  1. Cada um dos 5 usuários (4 colaboradores + dono) faz login individual com email/senha e permanece autenticado entre sessões do navegador.
  2. Colaborador vê apenas as empresas e tarefas da sua própria carteira; o dono vê de todas as empresas, sem restrição — enforced no backend, não só escondido na UI.
  3. A lista de empresas-cliente (nome, CNPJ, regime tributário, responsável, contatos, particularidades) está populada a partir da importação da planilha "Controle pis e cofins.xlsx", com etapa de revisão humana antes de persistir.
  4. Usuário consegue cadastrar e editar uma empresa-cliente manualmente pela interface, incluindo definir seu regime tributário.
  5. O sistema está acessível por uma URL pública pela internet, não restrito à rede local do escritório.

**Plans**: 6 plansPlans:
**Wave 1**

- [x] 01-01-PLAN.md — Fundação: bootstrap Next.js + shadcn, deps auditadas, schema Prisma (3 regimes) + db push, seed, infra Vitest

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — Auth (AUTH-01): Auth.js v5 Credentials + JWT com role, middleware, tela de login
- [ ] 01-03-PLAN.md — Camada de dados (AUTH-02/EMPR-01): withVisibilityScope, validarCNPJ, empresaSchema, queries escopadas

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-04-PLAN.md — Empresas (EMPR-01/AUTH-02): shell, lista escopada, CRUD com anti-IDOR
- [ ] 01-05-PLAN.md — Importação (EMPR-02): parser SheetJS 198 empresas, wizard de 3 etapas com revisão humana

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-06-PLAN.md — Deploy (INFRA-01): build standalone + Railway + URL pública

**UI hint**: yes

### Phase 2: Gestão de Tarefas — Avulsas, Detalhe e Alertas

**Goal**: A equipe consegue criar, atribuir, acompanhar e concluir tarefas, com tela de detalhe completa (passo a passo, dados da empresa, histórico) e alertas visuais de prazo — totalmente usável mesmo sem geração automática.
**Depends on**: Phase 1
**Requirements**: TASK-03, TASK-04, TASK-05, TASK-06, ALRT-01
**Success Criteria** (what must be TRUE):

  1. Qualquer membro da equipe consegue criar uma tarefa avulsa (não-recorrente) e atribuí-la a si mesmo ou a qualquer outro colega.
  2. Usuário vê uma lista de tarefas (as suas, ou — se for o dono — de todos), com checkbox para marcar como concluída, e cada conclusão fica registrada em um histórico.
  3. Ao abrir o detalhe de uma tarefa, o usuário vê os dados relevantes da empresa associada, o passo a passo da obrigação (quando aplicável) e o histórico de conclusões anteriores dessa empresa/obrigação.
  4. Para tarefas de ICMS/PIS-COFINS, o passo a passo referencia/conecta com as ferramentas de automação Python já existentes do usuário (link/instrução, sem execução).
  5. Tarefas com prazo próximo ou já atrasado aparecem destacadas visualmente (cores/badges) na lista de tarefas.

**Plans**: TBD
**UI hint**: yes

### Phase 3: Motor de Geração Automática Mensal

**Goal**: O sistema gera automaticamente, todo mês, as tarefas recorrentes de cada empresa conforme seu regime tributário, com prazos corretos e sem duplicação, alimentando a interface de tarefas já existente.
**Depends on**: Phase 1, Phase 2
**Requirements**: TASK-01, TASK-02
**Success Criteria** (what must be TRUE):

  1. No início de cada competência mensal, o sistema gera automaticamente as tarefas recorrentes de cada empresa conforme seu regime tributário (Lucro Real: ICMS + PIS/COFINS + SPED; Simples Nacional: DAS).
  2. O prazo de cada tarefa gerada respeita o prazo fixo definido para o tipo de obrigação, ajustado automaticamente (antecipando ou adiando, conforme a regra de cada obrigação) quando cai em fim de semana ou feriado nacional, calculado dinamicamente (sem listas de feriados fixas por ano).
  3. Executar a geração mensal mais de uma vez para a mesma competência não cria tarefas duplicadas (idempotência verificada na tabela `tarefas`).
  4. As tarefas geradas automaticamente aparecem nas listas e na tela de detalhe construídas na Fase 2, já com os alertas visuais de prazo funcionando normalmente.

**Plans**: TBD

### Phase 4: Dashboards Comparativos

**Goal**: O dono enxerga, em dashboards, o desempenho comparativo da equipe, a evolução mensal de cumprimento de prazos e quais empresas geram mais atrasos recorrentes.
**Depends on**: Phase 2, Phase 3
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):

  1. O dono visualiza um dashboard comparando o desempenho de cada colaborador (percentual de tarefas concluídas no prazo vs atrasadas), com contexto do tamanho/composição da carteira de cada um.
  2. O dono visualiza um dashboard de evolução mensal mostrando a tendência de cumprimento de prazos ao longo do tempo, com números de meses fechados estáveis (não recalculados retroativamente a cada acesso).
  3. O dono visualiza um dashboard comparando empresas, destacando quais geram mais atrasos/problemas recorrentes.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundação — Acesso, Empresas e Importação | 1/6 | In Progress|  |
| 2. Gestão de Tarefas — Avulsas, Detalhe e Alertas | 0/0 | Not started | - |
| 3. Motor de Geração Automática Mensal | 0/0 | Not started | - |
| 4. Dashboards Comparativos | 0/0 | Not started | - |
