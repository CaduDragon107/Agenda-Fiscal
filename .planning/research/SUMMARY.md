# Project Research Summary

**Project:** Agenda Fiscal - v2.0 Expansao Multi-Setor (DP e Contabil)
**Domain:** Extensao de sistema de gestao de tarefas/prazos fiscais (Next.js/Prisma/Postgres) ja em producao, de um unico setor (Fiscal) para tres setores (Fiscal + Departamento Pessoal + Contabil), atendendo a mesma carteira de ~197 empresas-cliente
**Researched:** 2026-06-22
**Confidence:** HIGH

## Executive Summary

Esta milestone nao e um produto novo - e uma extensao estrutural de um sistema ja validado em producao. A pesquisa convergiu numa conclusao consistente: nenhuma tecnologia nova e necessaria, mas a mudanca de modelo de dados e grande e arriscada. O motor de geracao de tarefas (geracao-tarefas.ts mais dia-util.ts mais scheduler.ts) ja resolve calculo de dia util, idempotencia e agendamento mensal de forma generica o suficiente para cobrir DP e Contabil sem trocar nenhuma lib (date-holidays, date-fns, node-cron, Prisma, Postgres permanecem como estao). A unica extensao arquitetural real e introduzir periodicidade ANUAL (para ECD/ECF/DEFIS) ao lado da mensal ja existente.

O risco central da v2.0 nao e construir os 2 novos setores (DP e Contabil tem features conceitualmente simples - replicas do padrao Fiscal ja testado), e sim migrar Empresa.responsavelId de FK unica para responsabilidade por setor sem quebrar o setor Fiscal que ja esta em producao com dados reais. Essa migracao toca autorizacao, o motor de geracao, e todas as queries de dashboard. A pesquisa de arquitetura identificou, lendo o codigo real, exatamente onde isso pode quebrar silenciosamente. A pesquisa de pitfalls encontrou inclusive uma evidencia viva no proprio repositorio - um modulo de dashboard duplicado e orfao que demonstra como esse tipo de duplicacao acontece nesta base de codigo.

A recomendacao geral e: tratar a migracao de schema como fase zero, isolada e verificada antes de qualquer feature nova; estender o motor de geracao com um conceito explicito de periodicidade; manter um modulo de scope e um modulo de dashboard, parametrizados por setor; e tratar DP como mais simples/seguro de entregar primeiro enquanto Contabil carrega o risco arquitetural extra da periodicidade anual.

## Key Findings

### Recommended Stack

Nenhuma dependencia nova. date-holidays (3.30.2) e date-fns (4.4.0) ja implementam a regra de ajuste de dia util que ECF/DEFIS exigem; node-cron (4.4.1) nao precisa de um segundo agendamento; Prisma 6.x suporta a extensao via migration aditiva. A unica funcao nova necessaria e enesimoDiaUtil (contagem de dias uteis para frente), mesma familia de dia-util.ts.

Core technologies mantidas, sem mudanca de versao: date-holidays e date-fns reusados sem alteracao; node-cron estendido para decidir via catalogo quando gerar obrigacoes anuais; Prisma e Postgres com schema estendido aditivamente (enum Periodicidade, enum Setor, novo TipoObrigacao, junction table), sem mudanca de tier/escala.

Decisao explicita de nao usar: nenhuma lib de calendario fiscal brasileiro de terceiros; nenhum job scheduler dedicado (Inngest/BullMQ) - overengineering para uma execucao anual.

### Expected Features

Must have (table stakes) DP: Folha de Pagamento, FGTS, INSS, eSocial mensais; filtro empresa tem funcionarios CLT; responsavel DP por empresa; dashboard DP; tarefas avulsas para colaboradores DP.

Must have (table stakes) Contabil: Escrituracao/balancete mensal; ECD, ECF, DEFIS anuais (DEFIS so Simples Nacional, ECD/ECF tipicamente Lucro Real); responsavel Contabil por empresa; dashboard Contabil.

Cross-sector (fundacao obrigatoria): Empresa com 1 responsavel por setor (mudanca estrutural central, nao aditiva); Setor em Usuario mais 7 colaboradores placeholder (4 DP + 3 Contabil); motor de geracao com periodicidade configuravel; dashboards duplicados por setor, sem visao unificada.

Differentiators ja validados no v1.0, agora replicados: dashboard comparativo de desempenho por colaborador, ranking de empresas problematicas, historico de conclusoes, tudo por setor.

Defer/anti-features v2.0 fora de escopo: calculo automatico de folha de pagamento dentro do sistema; integracao/envio automatico ao eSocial; cadastro completo de funcionarios (mini-RH); visao unificada de dashboard cross-setor; calendario de convencoes coletivas.

### Architecture Approach

O sistema e um monolito Next.js/Prisma com camadas claras: presentation, authorization (visibility-scope.ts), domain modules (empresas, tarefas, dashboards), calculo puro sem I/O (geracao-tarefas.ts, dia-util.ts, competencia.ts), scheduling (cron), persistence. A pesquisa recomenda 3 padroes centrais para a v2.0:

1. EmpresaResponsavelSetor (junction table) substitui Empresa.responsavelId unico, com constraint unica em empresaId mais setor, seguindo a convencao ja usada no projeto.
2. setor como coluna denormalizada em Tarefa, evitando inferir setor a partir de tipoObrigacao (mapeamento espalhado gera bug silencioso).
3. Motor de geracao separado por periodicidade, mesmo shell de persistencia: executarGeracaoAnual como funcao irma de executarGeracaoMensal, reaproveitando o mesmo padrao de idempotencia.
4. Um unico visibility-scope.ts com parametro setor opcional, nao tres copias forkeadas.
5. Um unico modulo de dashboard queries, parametrizado por setor, com tres rotas estaticas reaproveitando o mesmo guard por rota.

Achado relevante: ja existe codigo orfao no repositorio (modulo de dashboard singular) que referencia um schema que nao existe mais, evidencia viva de que duplicacao de modulos ja aconteceu uma vez neste projeto e deve ser deletada, nao estendida.

### Critical Pitfalls

1. Migracao de responsavel por setor sem backfill verificado - dropar a coluna antiga ou deixa-la pendurada sem mapear as 197 empresas existentes para o setor Fiscal na nova junction table quebra silenciosamente a geracao de tarefas Fiscal ja em producao.
2. Periodicidade anual implementada como condicional solto no cron em vez de conceito de dados - gera ambiguidade no formato de competencia e arrisca colisao/duplicacao na constraint unica.
3. RBAC de setor alargando ou estreitando visibilidade por engano - combinar setor do usuario sem tambem filtrar por responsavel por setor pode causar visibilidade incorreta.
4. Duplicacao de modulo de dashboard por setor - ja aconteceu uma vez neste codigo.
5. Campo empresa tem funcionarios CLT ausente - sem ele, empresas so com pro-labore recebem tarefas falsas de Folha/FGTS/eSocial desde o primeiro mes.

## Implications for Roadmap

### Phase 1: Migracao de schema - responsavel por setor (fundacao)
Rationale: toda feature subsequente depende do enum Setor, Usuario.setor e EmpresaResponsavelSetor existirem no client Prisma gerado. E a unica fase que nao pode ser paralelizada com nada.
Delivers: enum Setor, Usuario.setor, junction table EmpresaResponsavelSetor com backfill verificado (197 empresas para 197 linhas Fiscal), coluna antiga mantida como rede de seguranca.
Addresses: empresa com 1 responsavel por setor (FEATURES.md).
Avoids: backfill incompleto/incorreto (Pitfall B1).

### Phase 2: Autorizacao sector-aware
Rationale: nenhuma query setor-aware pode ser escrita com seguranca ate o modulo de scope ser estendido e re-testado contra a suite de IDOR existente.
Delivers: funcoes de scope com parametro setor explicito; suite de testes IDOR existente passando inalterada como regression gate, mais novos fixtures multi-setor.
Uses: padrao de scope unico ja estabelecido no v1.0.

### Phase 3: CRUD de empresas - 3 responsaveis por setor
Rationale: a geracao de tarefas DP/Contabil precisa de dados reais de responsavel por setor; a UI precisa expor os 3 campos na mesma fase do schema, nao depois.
Delivers: queries e formulario de empresa com 3 seletores de responsavel; campo tem funcionarios CLT.
Addresses: responsavel DP/Contabil por empresa, campo tem funcionarios CLT (FEATURES.md).

### Phase 4: Motor de geracao mensal DP
Rationale: DP e 100% mensal, nao exige a extensao de periodicidade anual, pode ser entregue com risco arquitetural menor.
Delivers: catalogo DP (Folha/FGTS/INSS/eSocial) e extensao do motor mensal para incluir DP, filtrando por tem funcionarios CLT.
Addresses: table stakes DP (FEATURES.md).

### Phase 5: Motor de geracao - periodicidade anual e Contabil
Rationale: maior risco arquitetural da milestone, primeira obrigacao nao-mensal do sistema.
Delivers: conceito de periodicidade no catalogo e em Tarefa; catalogo Contabil (Escrituracao mensal mais ECD/ECF/DEFIS anual); funcao de geracao anual irma da mensal; schema de competencia anual.
Avoids: condicional solto no cron, parsing quebrado de competencia anual (Pitfall B2).

### Phase 6: Dashboards parametrizados por setor
Rationale: precisa de dados reais de DP e Contabil gerados nas fases anteriores para validar contra dados reais.
Delivers: queries de dashboard parametrizadas por setor; tres rotas estaticas com guard hardcoded por rota; snapshot mensal com setor na constraint unica.
Avoids: duplicacao de modulo de dashboard (Pitfall B4).

### Phase 7: Cleanup e placeholders
Rationale: ultima fase, renomear os 7 colaboradores placeholder e remover codigo orfao, mesmo padrao usado no fechamento do v1.0.
Delivers: delecao do modulo orfao de dashboard singular; colaboradores placeholder renomeados; remocao planejada da coluna antiga apos 1 ciclo de release de seguranca.

### Phase Ordering Rationale

Schema e autorizacao vem primeiro porque sao a unica dependencia hard-block para tudo mais. DP antes de Contabil porque DP nao exige a extensao de periodicidade anual. Dashboards por ultimo porque dependem de dados reais de geracao. Cleanup por ultimo para nao distrair do trabalho estrutural, mas nao deve ser esquecido.

### Research Flags

Needs deeper research during planning: Phase 1 (estrategia de backfill e janela de coexistencia entre coluna antiga e junction table) e Phase 5 (maior risco arquitetural, formato de competencia anual e testes de idempotencia cruzando mensal e anual).

Phases com padroes ja estabelecidos, podem pular research-phase: Phase 2 (padrao ja documentado no scope module), Phase 4 (replica direta do padrao Fiscal), Phase 6 (mecanico uma vez que setor existe, reaproveita componentes de grafico ja existentes).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Extensao de codigo ja lido e verificado diretamente neste repositorio |
| Features | MEDIUM | Regras de prazo DP/Contabil confirmadas por multiplas fontes secundarias consistentes entre si |
| Architecture | HIGH | Grounded em leitura direta do codigo real, nao em pesquisa generica de mercado |
| Pitfalls | HIGH | Derivados de inspecao direta do codigo, incluindo evidencia viva ja presente no repositorio |

Overall confidence: HIGH

### Gaps to Address

Regra exata de Nesimo dia util para folha de pagamento pode ser convencao interna do escritorio, validar com o dono antes de codificar como regra fixa. Mapeamento exato de tipo de obrigacao para setor em ECD/ECF/DEFIS por regime merece validacao durante o planejamento da fase 5. Janela de coexistencia da coluna antiga com a junction table nao foi definida nesta pesquisa, fica para o planejamento da fase 1.

## Sources

Primary (HIGH): codigo-fonte deste repositorio (schema Prisma, motor de geracao, modulo de scope, modulos de dashboard e empresas), PROJECT.md da milestone v2.0, fonte oficial gov.br da Receita Federal para prazo DEFIS, package.json deste repositorio.

Secondary (MEDIUM): fontes contabeis sobre prazos ECD/ECF/DEFIS 2026, blogs especializados em rotinas de Departamento Pessoal, analise de mercado de ferramentas brasileiras e internacionais de gestao de tarefas contabeis.

Tertiary (LOW): paginas de marketing de fornecedores usadas apenas para contexto de mercado, nao para decisoes tecnicas.

---
Research completed: 2026-06-22
Ready for roadmap: yes
