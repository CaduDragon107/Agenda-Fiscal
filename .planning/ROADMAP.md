# Roadmap: Agenda Fiscal

## Overview

**Milestone v2.0 — Expansão Multi-Setor (DP e Contábil).** O sistema, já validado em produção para o setor Fiscal (v1.0, Phases 1-4 — ver `.planning/STATE.md` Quick Tasks e histórico de commits para o registro de conclusão), passa a atender também os setores de Departamento Pessoal e Contábil, para a mesma carteira de ~197 empresas-cliente. A expansão começa pela fundação estrutural — empresa ganha 1 responsável por setor (não mais 1 único responsável geral), autorização passa a ser setor-aware, e o cadastro de empresas expõe os 3 responsáveis — porque toda automação e todo dashboard subsequente dependem dela. Em seguida, o motor de geração mensal já validado no Fiscal é replicado para DP (100% mensal, menor risco). Depois, o motor é estendido para Contábil, que introduz a primeira periodicidade anual do sistema (ECD/ECF/DEFIS), o maior risco arquitetural da milestone. Por fim, com dados reais de DP e Contábil já sendo gerados, os dashboards comparativos (desempenho, evolução mensal, ranking) são replicados para os dois novos setores, reaproveitando o mesmo módulo de queries parametrizado por setor usado no Fiscal — não três módulos duplicados.

Na v2.0, o sistema validado no setor Fiscal é replicado para os setores Departamento Pessoal (DP) e Contábil, atendendo a mesma carteira de ~197 empresas. Primeiro, a fundação multi-setor estabelece o conceito de setor em usuários e empresas (1 responsável por setor, não mais 1 responsável único), com migração segura dos dados fiscais já em produção e os 7 colaboradores placeholder. Em seguida, o motor de geração mensal é estendido para o DP (folha, FGTS, INSS, eSocial), reaproveitando o padrão de geração e ajuste de dia útil já validado. Depois, o motor ganha sua primeira extensão arquitetural real — periodicidade anual — para suportar o Contábil (escrituração mensal e ECD/ECF/DEFIS anuais). Por fim, os dashboards comparativos são replicados para os dois novos setores e o código órfão remanescente do v1.0 é removido, fechando a milestone com a base de código limpa.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)
- Numbering continua a partir da milestone v1.0 (Phases 1-4, completas) — v2.0 começa na Phase 5

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Fundação — Acesso, Empresas e Importação** - Login individual com permissões por papel, cadastro de empresas-cliente populado via importação revisada da planilha existente, sistema acessível pela internet
- [x] **Phase 2: Gestão de Tarefas — Avulsas, Detalhe e Alertas** - Criação/atribuição de tarefas avulsas, conclusão com histórico, detalhe com passo a passo e referência às automações Python, alertas visuais de prazo (completed 2026-06-17)
- [x] **Phase 3: Motor de Geração Automática Mensal** - Geração automática mensal de tarefas recorrentes por regime tributário, com prazos ajustados por dia útil/feriado e sem duplicação (completed 2026-06-18)
- [x] **Phase 4: Dashboards Comparativos** - Dashboards de desempenho por colaborador, evolução mensal e comparativo entre empresas (completed 2026-06-22)
- [x] **Phase 5: Fundação Multi-Setor — Schema, Autorização e Empresas** - Empresa passa a ter 1 responsável por setor (Fiscal/DP/Contábil) com backfill verificado dos 197 registros existentes, autorização passa a ser setor-aware sem regressão no Fiscal, e o cadastro de empresas expõe os 3 responsáveis e o campo "tem funcionários CLT?" (completed 2026-06-24)
- [x] **Phase 6: Motor de Geração — Departamento Pessoal** - Geração automática mensal de Folha de Pagamento, FGTS, INSS e eventos de eSocial para empresas com funcionários CLT, mais tarefas avulsas para a equipe de DP (completed 2026-06-24)
- [ ] **Phase 7: Motor de Geração — Contábil (mensal e anual)** - Geração automática mensal de Escrituração/Balancete para todas as empresas, mais a primeira periodicidade anual do sistema (ECD, ECF, DEFIS), com tarefas avulsas para a equipe Contábil
- [ ] **Phase 8: Dashboards Multi-Setor — DP e Contábil** - Dono visualiza, em páginas próprias por setor, o desempenho comparativo dos colaboradores de DP e Contábil, a evolução mensal e o ranking de empresas problemáticas, com dados reais de geração já em produção

## Phase Details

### Phase 5: Fundação Multi-Setor — Schema, Autorização e Empresas

**Goal**: Toda a base estrutural da multi-setorialidade existe e está verificada — empresas têm 1 responsável por setor, a autorização respeita esse novo modelo sem quebrar o que já funciona no Fiscal, e a equipe (incluindo os 7 novos colaboradores placeholder) já pode ser atribuída como responsável por empresa em DP e Contábil.
**Depends on**: Phase 4 (sistema Fiscal já em produção)
**Requirements**: SETOR-01, SETOR-02, SETOR-03, EMPR-03
**Success Criteria** (what must be TRUE):

  1. As 197 empresas existentes têm exatamente 1 responsável Fiscal migrado corretamente (verificado por contagem: 197 empresas → 197 registros de responsabilidade Fiscal, nenhum a mais, nenhum a menos) — a geração de tarefas Fiscal continua funcionando sem nenhuma regressão após a migração.
  2. Cada uma das 197 empresas pode ter um responsável de DP e um responsável de Contábil atribuídos separadamente do responsável Fiscal, através da tela de cadastro/edição de empresa (3 seletores distintos, não 1).
  3. Os 7 colaboradores placeholder (4 DP + 3 Contábil) existem no sistema com seu setor definido, e aparecem nos seletores de responsável e de atribuição de tarefa avulsa filtrados pelo setor correspondente — um seletor de responsável de DP não lista colaboradores do Contábil ou Fiscal.
  4. Um colaborador de DP só vê/edita as empresas onde ele é o responsável de DP, mesmo que outra pessoa seja a responsável Fiscal da mesma empresa — testado tanto pela UI quanto por chamada direta (sem regressão nos testes de IDOR/visibilidade já existentes do Fiscal).
  5. Toda empresa tem o campo "tem funcionários CLT?" definido (sim/não), visível e editável no cadastro.

**Plans**: 3/4 plans executed
**Wave 1**

- [x] 05-01-PLAN.md — Schema multi-setor (enum Setor, junction, Usuario.setor, CLT), db push e backfills verificados (197 FISCAL + 4 colaboradores) + seed dos 7 placeholders

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — setor no JWT/sessão (Auth.js v5) e withVisibilityScope/withTarefaScope setor-aware sem regressão IDOR

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-03-PLAN.md — Backend de empresas: schema Zod 3 responsáveis + CLT, listarResponsaveis(setor), actions transacionais com guard DONO-only (D-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 05-04-PLAN.md — UI de empresas: 3 seletores + checkbox CLT, tabela setor-aware, filtro/badge "sem responsável", estado vazio por setor + checkpoint humano

### Phase 6: Motor de Geração — Departamento Pessoal

**Goal**: Toda empresa com funcionários CLT recebe, automaticamente todo mês, as obrigações de Folha de Pagamento, FGTS, INSS e eSocial, atribuídas ao responsável de DP correto, com prazos ajustados por dia útil/feriado e sem duplicação — e a equipe de DP já consegue usar tarefas avulsas como o Fiscal usa hoje.
**Depends on**: Phase 5
**Requirements**: DP-01, DP-02, DP-03, DP-04, DP-05
**Success Criteria** (what must be TRUE):

  1. No início de cada competência mensal, toda empresa com "tem funcionários CLT? = sim" recebe automaticamente as tarefas de Folha de Pagamento, FGTS, INSS e eventos periódicos de eSocial.
  2. Empresas sem funcionários CLT (só pró-labore) não recebem nenhuma dessas tarefas — nenhuma tarefa falsa.
  3. Cada tarefa gerada de DP é atribuída ao responsável de DP correto daquela empresa (nunca ao responsável Fiscal por engano), com prazo ajustado por dia útil/feriado.
  4. Executar a geração mensal mais de uma vez para a mesma competência não duplica nenhuma tarefa de DP.
  5. Qualquer colaborador de DP consegue criar uma tarefa avulsa e atribuí-la a si mesmo ou a outro colega de DP, reaproveitando o mecanismo de tarefas avulsas já existente.

**Plans**: 3 plans

**Wave 1**

- [x] 06-01-PLAN.md — Camada de cálculo puro: enum TipoObrigacao +FOLHA/ESOCIAL/FGTS/INSS (db push), calcularQuintoDiaUtil (5º dia útil), catálogo geracao-tarefas-dp.ts + testes unitários
- [x] 06-03-PLAN.md — Teste de regressão DP-05: tarefa avulsa de DP reusa criarTarefa setor-aware (sem mudança de produção)

**Wave 2** *(blocked on Plan 06-01)*

- [x] 06-02-PLAN.md — Orquestração: segundo loop DP em executarGeracaoMensal (responsaveisPorSetor setor=DP, pular-e-listar), AcaoGeracaoResult + UI com semResponsavelDp, testes de integração

### Phase 7: Motor de Geração — Contábil (mensal e anual)

**Goal**: Toda empresa recebe automaticamente, todo mês, a obrigação de Escrituração/Balancete Contábil, e — pela primeira vez no sistema — obrigações anuais (ECD, ECF, DEFIS) são geradas corretamente uma única vez por ano por empresa, conforme seu regime tributário, sem confundir ou colidir com a geração mensal.
**Depends on**: Phase 5
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06
**Success Criteria** (what must be TRUE):

  1. No início de cada competência mensal, toda empresa recebe automaticamente a tarefa de Escrituração/Balancete Contábil, atribuída ao responsável Contábil correto.
  2. Uma vez por ano, cada empresa Lucro Real recebe automaticamente exatamente uma tarefa de ECD e uma de ECF; cada empresa Simples Nacional recebe automaticamente exatamente uma tarefa de DEFIS — nunca zero, nunca duplicada, mesmo que a geração mensal rode 12 vezes ao longo do ano.
  3. As tarefas anuais e mensais do Contábil convivem na mesma competência/ano sem colidir entre si e sem corromper os cálculos de prazo/dia útil de nenhuma das duas periodicidades.
  4. Qualquer colaborador do Contábil consegue criar uma tarefa avulsa e atribuí-la a si mesmo ou a outro colega do Contábil, reaproveitando o mecanismo de tarefas avulsas já existente.

**Plans**: 3 plans

**Wave 1**

- [x] 07-01-PLAN.md — Camada de cálculo puro: enum TipoObrigacao +11 valores (db push), catálogos geracao-tarefas-contabil.ts (8 rotinas mensais por regime) e geracao-tarefas-contabil-anual.ts (ECD/ECF/DEFIS + obrigacoesAnuaisParaCompetencia), competenciaAnualSchema, testes unitários
- [x] 07-03-PLAN.md — Teste de regressão CONT-06: tarefa avulsa de Contábil reusa criarTarefa setor-aware (sem mudança de produção)

**Wave 2** *(blocked on Plan 07-01)*

- [ ] 07-02-PLAN.md — Orquestração: blocos Contábil mensal + anual em executarGeracaoMensal (setor=CONTABIL, pular-e-listar deduplicado), semResponsavelContabil ponta a ponta na UI, testes de integração

### Phase 8: Dashboards Multi-Setor — DP e Contábil

**Goal**: O dono enxerga, em páginas próprias por setor, o desempenho comparativo dos colaboradores de DP e de Contábil, a evolução mensal de cumprimento de prazos de cada setor, e quais empresas geram mais atrasos recorrentes em cada um — exatamente como já existe para o Fiscal, sem visão unificada entre setores (decisão explícita desta milestone).
**Depends on**: Phase 6, Phase 7 (precisa de dados reais de geração para validar contra dados de produção, não apenas dados fictícios)
**Requirements**: DP-06, DP-07, DP-08, CONT-07, CONT-08, CONT-09
**Success Criteria** (what must be TRUE):

  1. O dono visualiza um dashboard de desempenho por colaborador de DP (percentual no prazo vs atrasado), em página própria, separada do dashboard Fiscal.
  2. O dono visualiza um dashboard de evolução mensal de DP, com números de meses fechados estáveis (não recalculados retroativamente).
  3. O dono visualiza um dashboard de ranking de empresas problemáticas no DP.
  4. O dono visualiza os mesmos três tipos de dashboard (desempenho, evolução mensal, ranking) para o setor Contábil, em página própria.
  5. As consultas dos 3 dashboards de DP e dos 3 dashboards de Contábil reaproveitam o mesmo módulo de queries parametrizado por setor já usado no Fiscal — sem três módulos de dashboard duplicados e sem o código órfão do módulo de dashboard singular antigo.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8

**Previous milestone (v1.0):** Phases 1-4 completas — ver histórico em `.planning/STATE.md` (Quick Tasks Completed) e commits do repositório. Resumo: Fundação de acesso/empresas/importação (Phase 1), gestão de tarefas avulsas/detalhe/alertas (Phase 2), motor de geração automática mensal Fiscal (Phase 3), dashboards comparativos Fiscal (Phase 4) — todas concluídas entre 2026-06-15 e 2026-06-22.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Fundação Multi-Setor — Schema, Autorização e Empresas | 4/4 | Complete   | 2026-06-24 |
| 6. Motor de Geração — Departamento Pessoal | 3/3 | Complete   | 2026-06-24 |
| 7. Motor de Geração — Contábil (mensal e anual) | 2/3 | In Progress|  |
| 8. Dashboards Multi-Setor — DP e Contábil | 0/TBD | Not started | - |
