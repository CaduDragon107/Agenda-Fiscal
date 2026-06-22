# Agenda Fiscal

## What This Is

Um site de gestão de tarefas para um escritório de contabilidade, organizado em 3 setores — Fiscal, Departamento Pessoal (DP) e Contábil — cada um com sua própria equipe de colaboradores, atendendo a mesma carteira de mais de 100 empresas-cliente. O dono do escritório administra com visão geral de todos os setores. O sistema gera automaticamente as obrigações recorrentes de cada empresa conforme seu setor e regime tributário (Fiscal: ICMS/PIS-COFINS/SPED para Lucro Real, DAS para Simples Nacional; DP: folha/FGTS/INSS/eSocial mensal; Contábil: balancete/escrituração mensal, ECF/DEFIS anual), permite tarefas avulsas, e traz dashboards comparativos de desempenho por setor.

## Core Value

A equipe nunca perde um prazo — fiscal, de pessoal ou contábil — de nenhum cliente, e o dono sempre sabe em tempo real o status de tudo, em qualquer setor.

## Current Milestone: v2.0 Expansão Multi-Setor (DP e Contábil)

**Goal:** Replicar a estrutura já validada do setor Fiscal (geração automática de obrigações, tarefas avulsas, dashboards) para os setores DP e Contábil, atendendo a mesma carteira de ~197 empresas.

**Target features:**
- Empresa passa a ter 1 responsável por setor (fiscal/DP/contábil), não mais 1 único responsável
- 7 novos colaboradores placeholder (4 DP + 3 Contábil), renomeáveis depois
- Motor de geração estendido para DP (folha/FGTS/INSS/eSocial mensal) e Contábil (balancete/escrituração mensal) com suporte a periodicidade anual (ECF/DEFIS no contábil)
- Dashboards (desempenho, evolução mensal, ranking) duplicados por setor — páginas separadas, sem visão unificada entre setores

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

### Active

(A definir em REQUIREMENTS.md para v2.0 — setores DP e Contábil)

### Out of Scope

- Notificações por email/WhatsApp — alertas ficam só dentro do site; pode virar versão futura
- Calendário de feriados estaduais/municipais — considera apenas feriados nacionais; regras estaduais específicas (ex: ICMS por dígito final do CNPJ) ficam fora
- Execução remota dos scripts de automação a partir do site — v1 apenas referencia/explica o uso das ferramentas existentes, sem rodá-las
- Anexos/comprovantes ao concluir tarefa — usa checkbox simples; comprovantes ficam para depois
- Visão unificada de dashboard entre os 3 setores — v2.0 mantém dashboards separados por setor (decisão explícita desta milestone)

## Context

- O usuário é dono de um escritório de contabilidade. v1.0 cobriu só a equipe fiscal (4 pessoas); v2.0 expande para os setores DP (Departamento Pessoal, 4 colaboradores) e Contábil (3 colaboradores) — equipe total: 11 colaboradores + dono = 12 usuários.
- A carteira de ~197 empresas-cliente é a MESMA nos 3 setores — toda empresa tem obrigações fiscais, de pessoal e contábeis simultaneamente, cada uma com seu próprio responsável.
- Empresas se dividem em dois regimes tributários: Lucro Real (obrigações fiscais: ICMS, PIS/COFINS, SPED) e Simples Nacional (obrigação fiscal: DAS) — isso já existe e não muda nesta milestone.
- DP gera mensalmente: folha de pagamento, FGTS, INSS e eventos periódicos de eSocial, por empresa com funcionários.
- Contábil gera mensalmente: balancete e escrituração contábil (livro diário/razão); e anualmente: ECF e DEFIS — primeira necessidade de periodicidade não-mensal no motor de geração.
- Hoje o controle é manual/disperso, o que causa prazos perdidos e falta de visibilidade do dono sobre o progresso de cada pessoa — esse problema também existe nos setores DP e Contábil, não só no fiscal.
- Já existem ferramentas de automação em Python do próprio usuário (pasta irmã "Controle de Pis e Cofins"): leitura de PDF de apuração de ICMS e preenchimento automático da planilha de controle PIS/COFINS (estrutura: 89+ empresas, 19 linhas cada — S.ANT + 12 meses + TOT + delta). Específico do setor fiscal; sem equivalente conhecido para DP/Contábil ainda.
- Ferramentas genéricas (Trello, Asana, Monday, ClickUp) foram avaliadas e descartadas por não entenderem o contexto fiscal (tipos de obrigação, regime tributário, prazos específicos) — mesma razão se aplica a DP e Contábil.

## Constraints

- **Acesso**: precisa estar acessível pela internet — equipe pode acessar remotamente, não só do escritório
- **Autenticação**: login individual obrigatório para todos os usuários, com permissões diferenciadas (COLABORADOR vs DONO)
- **Escala v2.0**: ~197 empresas-cliente, mesma carteira nos 3 setores; 11 colaboradores fixos (4 fiscal + 4 DP + 3 contábil) + 1 dono
- **Integração**: deve referenciar (não necessariamente executar) as ferramentas Python de automação existentes para ICMS e PIS/COFINS (setor fiscal apenas)
- **Periodicidade**: motor de geração precisa suportar obrigações anuais (ECF, DEFIS) além de mensais — extensão arquitetural sobre o motor mensal existente da Fase 3

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tarefas recorrentes geradas conforme o regime tributário da empresa (Lucro Real vs Simples Nacional) | Cada regime tem um conjunto diferente de obrigações mensais | — Pending |
| Prazo único por tipo de obrigação (não por empresa), ajustado por dia útil/feriado | Neste escritório os prazos não variam por CNPJ; simplifica o modelo do v1 | — Pending |
| "Concluído" = checkbox simples, sem anexo/comprovante | Mantém o v1 simples; comprovantes podem entrar depois | — Pending |
| Importar lista de empresas da planilha "Controle pis e cofins.xlsx" existente | Evita recadastro manual de 100+ empresas | — Pending |
| Dashboards comparativos (equipe, tempo, empresas) como diferencial central | Usuário quer algo "inovador", diferente das ferramentas genéricas de tarefas | — Pending |
| v2.0: 1 responsável por setor por empresa (não 1 responsável geral) | Pessoas diferentes cuidam do fiscal/DP/contábil da mesma empresa | — Pending |
| v2.0: dashboards duplicados por setor, sem visão unificada | Decisão explícita do usuário ao escopar o milestone — simplifica v2.0 | — Pending |
| v2.0: 7 novos colaboradores como placeholders, renomeados depois | Mesmo padrão usado para o fiscal em v1.0 (colaborador1-4 → nomes reais via quick task) | — Pending |

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
*Last updated: 2026-06-22 after starting milestone v2.0*
