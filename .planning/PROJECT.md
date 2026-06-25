# Agenda Fiscal

## What This Is

Um site de gestão de tarefas para um escritório de contabilidade, organizado em 3 setores — Fiscal, Departamento Pessoal (DP) e Contábil — cada um com sua própria equipe de colaboradores, atendendo a mesma carteira de mais de 100 empresas-cliente. O dono do escritório administra com visão geral de todos os setores. O sistema gera automaticamente as obrigações recorrentes de cada empresa conforme seu setor e regime tributário (Fiscal: ICMS/PIS-COFINS/SPED para Lucro Real, DAS para Simples Nacional; DP: folha/FGTS/INSS/eSocial mensal; Contábil: balancete/escrituração mensal, ECF/DEFIS anual), permite tarefas avulsas, e traz dashboards comparativos de desempenho por setor.

## Core Value

A equipe nunca perde um prazo — fiscal, de pessoal ou contábil — de nenhum cliente, e o dono sempre sabe em tempo real o status de tudo, em qualquer setor.

## Current State

**Shipped:** v2.0 Expansão Multi-Setor (DP e Contábil) — 2026-06-25

O sistema agora atende 3 setores (Fiscal, DP, Contábil) para a mesma carteira de ~197 empresas, com responsável próprio por setor, geração automática mensal (DP) e mensal+anual (Contábil — primeira periodicidade anual do sistema), e dashboards comparativos replicados para os 2 novos setores via módulo de queries único parametrizado por setor.

## Next Milestone Goals

Ainda não definidos — rodar `/gsd-new-milestone` para abrir o próximo ciclo (questionamento → pesquisa → requisitos → roadmap). Candidatos levantados durante v2.0 (ver REQUIREMENTS.md "Future Requirements"): DP-09 (rescisão), DP-10 (férias/13º), EMPR-04 (quantidade de funcionários), NOTF-01 (notificações), ATCH-01 (comprovantes).

<details>
<summary>v1.0 MVP — Goal (archived)</summary>

**Goal:** Tracker de prazos fiscais para a equipe Fiscal (4 colaboradores + dono), com geração automática mensal por regime tributário, tarefas avulsas, e dashboards comparativos.

</details>

<details>
<summary>v2.0 Expansão Multi-Setor — Goal (archived)</summary>

**Goal:** Replicar a estrutura já validada do setor Fiscal (geração automática de obrigações, tarefas avulsas, dashboards) para os setores DP e Contábil, atendendo a mesma carteira de ~197 empresas.

**Target features (todas entregues):**
- Empresa passa a ter 1 responsável por setor (fiscal/DP/contábil), não mais 1 único responsável
- 7 novos colaboradores placeholder (4 DP + 3 Contábil), renomeáveis depois
- Motor de geração estendido para DP (folha/FGTS/INSS/eSocial mensal) e Contábil (balancete/escrituração mensal) com suporte a periodicidade anual (ECF/DEFIS no contábil)
- Dashboards (desempenho, evolução mensal, ranking) duplicados por setor — páginas separadas, sem visão unificada entre setores

</details>

## Requirements

### Validated

- ✓ Login individual para os 4 membros da equipe fiscal + dono, com visibilidade diferenciada (cada um vê só suas tarefas; o dono vê de todos) — v1.0
- ✓ Cadastro de empresas-cliente: nome, CNPJ, regime tributário, responsável, contatos, particularidades — v1.0
- ✓ Importação inicial das 100+ empresas (197 reais, via "Lista de Empresas com CNPJ.xlsx") — v1.0
- ✓ Geração automática mensal de tarefas recorrentes por empresa, conforme regime tributário (Lucro Real: ICMS + PIS/COFINS + SPED; Simples Nacional: DAS) — v1.0
- ✓ Prazo fixo por tipo de obrigação, ajustado automaticamente quando cai em fim de semana/feriado — v1.0
- ✓ Marcar tarefa como concluída (checkbox simples) — v1.0
- ✓ Criação de tarefas avulsas (não-recorrentes) por qualquer membro da equipe, atribuíveis a qualquer pessoa — v1.0
- ✓ Detalhe de cada tarefa: passo a passo da obrigação, dados relevantes da empresa, histórico de conclusões anteriores — v1.0
- ✓ Passo a passo das tarefas de ICMS/PIS-COFINS referencia/conecta com as ferramentas de automação Python já existentes do usuário — v1.0
- ✓ Dashboard comparativo de desempenho entre os funcionários (no prazo vs atrasado) — v1.0
- ✓ Dashboard de evolução mensal (tendências ao longo do tempo) — v1.0
- ✓ Dashboard comparativo entre empresas (quais geram mais atraso/problema recorrente) — v1.0
- ✓ Alertas visuais dentro do site para prazos próximos ou atrasados — v1.0
- ✓ Acesso pela internet (não restrito à rede local do escritório) — v1.0
- ✓ Empresa com 1 responsável por setor (fiscal/DP/contábil), migração com backfill verificado 197/197 — v2.0
- ✓ Usuário com campo Setor + 7 colaboradores placeholder (4 DP + 3 Contábil) — v2.0
- ✓ Seletores de tarefa/responsável filtrados por setor — v2.0
- ✓ Campo "tem funcionários CLT?" na Empresa, controla geração de obrigações DP — v2.0
- ✓ Geração automática mensal DP: Folha, FGTS, INSS, eSocial — v2.0
- ✓ Tarefas avulsas DP (reuso do mecanismo existente) — v2.0
- ✓ Dashboards DP (desempenho, evolução mensal, ranking de empresas) — v2.0
- ✓ Geração automática mensal Contábil: Escrituração/Balancete — v2.0
- ✓ Motor de geração estendido para periodicidade anual (primeira vez no sistema) — v2.0
- ✓ Geração automática anual: ECD (Lucro Real), ECF, DEFIS (Simples Nacional) — v2.0
- ✓ Tarefas avulsas Contábil (reuso do mecanismo existente) — v2.0
- ✓ Dashboards Contábil (desempenho, evolução mensal, ranking de empresas) — v2.0

### Active

(A definir no próximo milestone via `/gsd-new-milestone`)

### Out of Scope

- Notificações por email/WhatsApp — alertas ficam só dentro do site; pode virar versão futura
- Calendário de feriados estaduais/municipais — considera apenas feriados nacionais; regras estaduais específicas (ex: ICMS por dígito final do CNPJ) ficam fora
- Execução remota dos scripts de automação a partir do site — v1 apenas referencia/explica o uso das ferramentas existentes, sem rodá-las
- Anexos/comprovantes ao concluir tarefa — usa checkbox simples; comprovantes ficam para depois
- Visão unificada de dashboard entre os 3 setores — v2.0 mantém dashboards separados por setor (decisão explícita desta milestone), reafirmada e ainda válida no fechamento
- Rescisão/desligamento, férias/13º como obrigações de DP (DP-09/DP-10) — fora do v2.0; candidatos a v2.x se a equipe sentir falta
- Cálculo automático de folha de pagamento / execução automática de eSocial — mesma razão do v1.0 (fora do core value, risco de certificado digital/LGPD), reafirmada nesta milestone para o Contábil/DP

## Context

- O usuário é dono de um escritório de contabilidade. v1.0 cobriu só a equipe fiscal (4 pessoas); v2.0 expandiu para os setores DP (Departamento Pessoal, 4 colaboradores) e Contábil (3 colaboradores) — equipe total: 11 colaboradores + dono = 12 usuários.
- A carteira de ~197 empresas-cliente é a MESMA nos 3 setores — toda empresa tem obrigações fiscais, de pessoal e contábeis simultaneamente, cada uma com seu próprio responsável. Backfill 197/197 verificado para FISCAL no fechamento da Fase 5.
- Empresas se dividem em dois regimes tributários: Lucro Real (obrigações fiscais: ICMS, PIS/COFINS, SPED) e Simples Nacional (obrigação fiscal: DAS) — inalterado desde v1.0.
- DP gera mensalmente: folha de pagamento, FGTS, INSS e eventos periódicos de eSocial, por empresa com funcionários CLT (`temFuncionariosClt`).
- Contábil gera mensalmente: balancete e escrituração contábil (livro diário/razão); e anualmente: ECD (Lucro Real), ECF e DEFIS (Simples Nacional) — primeira periodicidade não-mensal do motor de geração, com idempotência comprovada por sweep de 12 meses.
- Dashboards de DP e Contábil reaproveitam o mesmo módulo de queries parametrizado por setor já usado no Fiscal (`src/modules/dashboards/queries.ts`) — não há três módulos duplicados.
- Já existem ferramentas de automação em Python do próprio usuário (pasta irmã "Controle de Pis e Cofins"): leitura de PDF de apuração de ICMS e preenchimento automático da planilha de controle PIS/COFINS. Específico do setor fiscal; sem equivalente conhecido para DP/Contábil ainda.
- Ferramentas genéricas (Trello, Asana, Monday, ClickUp) foram avaliadas e descartadas por não entenderem o contexto fiscal/DP/contábil (tipos de obrigação, regime tributário, prazos específicos).
- Codebase atual: ~10.500 LOC TypeScript em `src/`. v2.0 adicionou 107 arquivos modificados, +12.4k/-0.4k linhas, em 101 commits, ao longo de ~2 dias (2026-06-23 a 2026-06-25).
- Tech debt conhecido após v2.0 (lista completa em `.planning/v2.0-MILESTONE-AUDIT.md`): import wizard de empresas não grava linha FISCAL no junction table (latente até `responsavelId` ser retirado); double-rounding menor em `listarEvolucaoMensal`; `listarRankingEmpresas` ignora parâmetro `?meses=`; tarefas avulsas de colaborador sem `setor` são silenciosamente omitidas dos 3 dashboards.

## Constraints

- **Acesso**: precisa estar acessível pela internet — equipe pode acessar remotamente, não só do escritório
- **Autenticação**: login individual obrigatório para todos os usuários, com permissões diferenciadas (COLABORADOR vs DONO)
- **Escala**: ~197 empresas-cliente, mesma carteira nos 3 setores; 11 colaboradores fixos (4 fiscal + 4 DP + 3 contábil) + 1 dono
- **Integração**: deve referenciar (não necessariamente executar) as ferramentas Python de automação existentes para ICMS e PIS/COFINS (setor fiscal apenas)
- **Periodicidade**: motor de geração suporta obrigações anuais (ECD/ECF/DEFIS) além de mensais, sem colidir com a geração mensal — confirmado em produção
- **Autorização**: COLABORADOR só pode autoatribuir tarefa avulsa; apenas o DONO atribui tarefas a outros colaboradores — modelo confirmado intencional e idêntico nos 3 setores (não é uma limitação a corrigir)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tarefas recorrentes geradas conforme o regime tributário da empresa (Lucro Real vs Simples Nacional) | Cada regime tem um conjunto diferente de obrigações mensais | ✓ Good — v1.0 |
| Prazo único por tipo de obrigação (não por empresa), ajustado por dia útil/feriado | Neste escritório os prazos não variam por CNPJ; simplifica o modelo do v1 | ✓ Good — v1.0 |
| "Concluído" = checkbox simples, sem anexo/comprovante | Mantém o v1 simples; comprovantes podem entrar depois | ✓ Good — v1.0 |
| Importar lista de empresas da planilha existente | Evita recadastro manual de 100+ empresas | ✓ Good — v1.0 (197 empresas reais) |
| Dashboards comparativos (equipe, tempo, empresas) como diferencial central | Usuário quer algo "inovador", diferente das ferramentas genéricas de tarefas | ✓ Good — v1.0 e v2.0 |
| v2.0: 1 responsável por setor por empresa (não 1 responsável geral) | Pessoas diferentes cuidam do fiscal/DP/contábil da mesma empresa | ✓ Good — 197/197 backfill verificado, zero regressão no Fiscal |
| v2.0: dashboards duplicados por setor, sem visão unificada | Decisão explícita do usuário ao escopar o milestone — simplifica v2.0 | ✓ Good — reafirmada no fechamento, ainda a decisão certa |
| v2.0: 7 novos colaboradores como placeholders, renomeados depois | Mesmo padrão usado para o fiscal em v1.0 (colaborador1-4 → nomes reais via quick task) | ✓ Good |
| v2.0: motor de geração ganha periodicidade anual (ECD/ECF/DEFIS) coexistindo com a mensal na mesma transação | Contábil é o primeiro setor com obrigações não-mensais; reaproveitar a transação existente evita um segundo motor paralelo | ✓ Good — idempotência comprovada por sweep de 12 meses, testes de colisão mensal/anual passando |
| v2.0: dashboards DP/Contábil reaproveitam um único módulo de queries parametrizado por setor (não 3 módulos) | Evita triplicar lógica de agregação; setor vira apenas um parâmetro de filtro | ✓ Good — CR-01 do `08-REVIEW.md` corrigido (partição por setor no snapshot mensal) |
| DEFIS criada ~13 meses antes do vencimento (ano-base = ano fiscal reportado, não ano de criação) | Regra real do Simples Nacional: DEFIS vence 31/março reportando o ano-base anterior | ✓ Good — confirmado pelo dono no fechamento do v2.0 (2026-06-25) como comportamento correto, não defeito |
| COLABORADOR não pode atribuir tarefa avulsa a outro colaborador (só autoatribuição); apenas DONO atribui entre colaboradores | Modelo de autorização original do v1.0 (DP-05/CONT-06 herdam o mesmo padrão do Fiscal) | ✓ Good — confirmado pelo dono no fechamento do v2.0 como comportamento esperado; redação do ROADMAP corrigida para refletir isso com precisão |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-25 after v2.0 milestone*
