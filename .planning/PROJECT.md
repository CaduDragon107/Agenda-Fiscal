# Agenda Fiscal

## What This Is

Um site de gestão de tarefas para a equipe fiscal de um escritório de contabilidade: 4 colaboradores responsáveis por mais de 100 empresas-cliente, mais o dono do escritório como administrador com visão geral. O sistema gera automaticamente, todo mês, as tarefas recorrentes de cada empresa conforme seu regime tributário (ICMS, PIS/COFINS, SPED para Lucro Real; DAS para Simples Nacional), permite tarefas avulsas, e traz dashboards comparativos de desempenho.

## Core Value

A equipe nunca perde um prazo fiscal de nenhum cliente, e o dono sempre sabe em tempo real o status de tudo.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Login individual para os 4 membros da equipe + dono, com visibilidade diferenciada (cada um vê só suas tarefas; o dono vê de todos)
- [ ] Cadastro de empresas-cliente: nome, CNPJ, regime tributário, responsável, contatos, particularidades
- [ ] Importação inicial das 100+ empresas a partir da planilha "Controle pis e cofins.xlsx" já existente
- [ ] Geração automática mensal de tarefas recorrentes por empresa, conforme regime tributário (Lucro Real: ICMS + PIS/COFINS + SPED; Simples Nacional: DAS)
- [ ] Prazo fixo por tipo de obrigação, ajustado automaticamente quando cai em fim de semana/feriado
- [ ] Marcar tarefa como concluída (checkbox simples)
- [ ] Criação de tarefas avulsas (não-recorrentes) por qualquer membro da equipe, atribuíveis a qualquer pessoa
- [ ] Detalhe de cada tarefa: passo a passo da obrigação, dados relevantes da empresa, histórico de conclusões anteriores
- [ ] Passo a passo das tarefas de ICMS/PIS-COFINS referencia/conecta com as ferramentas de automação Python já existentes do usuário
- [ ] Dashboard comparativo de desempenho entre os funcionários (no prazo vs atrasado)
- [ ] Dashboard de evolução mensal (tendências ao longo do tempo)
- [ ] Dashboard comparativo entre empresas (quais geram mais atraso/problema recorrente)
- [ ] Alertas visuais dentro do site para prazos próximos ou atrasados
- [ ] Acesso pela internet (não restrito à rede local do escritório)

### Out of Scope

- Notificações por email/WhatsApp — alertas v1 ficam só dentro do site; pode virar v2
- Calendário de feriados estaduais/municipais — v1 considera apenas feriados nacionais; regras estaduais específicas (ex: ICMS por dígito final do CNPJ) ficam fora
- Execução remota dos scripts de automação a partir do site — v1 apenas referencia/explica o uso das ferramentas existentes, sem rodá-las
- Anexos/comprovantes ao concluir tarefa — v1 usa checkbox simples; comprovantes ficam para depois

## Context

- O usuário é dono de um escritório de contabilidade com equipe fiscal de 4 pessoas e mais de 100 empresas-cliente.
- Cada um dos 4 colaboradores cuida de um grupo fixo de empresas, sendo responsável por todas as obrigações dessas empresas.
- Empresas se dividem em dois regimes tributários: Lucro Real (obrigações: ICMS, PIS/COFINS, SPED) e Simples Nacional (obrigação: DAS).
- Hoje o controle é manual/disperso, o que causa prazos perdidos e falta de visibilidade do dono sobre o progresso de cada pessoa.
- Já existem ferramentas de automação em Python do próprio usuário (pasta irmã "Controle de Pis e Cofins"): leitura de PDF de apuração de ICMS e preenchimento automático da planilha de controle PIS/COFINS (estrutura: 89+ empresas, 19 linhas cada — S.ANT + 12 meses + TOT + delta).
- Existe uma planilha "Controle pis e cofins.xlsx" com a lista de empresas que pode servir de base para a importação inicial de dados.
- Ferramentas genéricas (Trello, Asana, Monday, ClickUp) foram avaliadas e descartadas por não entenderem o contexto fiscal (tipos de obrigação, regime tributário, prazos específicos).

## Constraints

- **Acesso**: precisa estar acessível pela internet — equipe pode acessar remotamente, não só do escritório
- **Autenticação**: login individual obrigatório para os 5 usuários (4 da equipe + dono), com permissões diferenciadas
- **Escala inicial**: ~100-110 empresas-cliente, 4 responsáveis fixos
- **Integração**: deve referenciar (não necessariamente executar) as ferramentas Python de automação existentes para ICMS e PIS/COFINS

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tarefas recorrentes geradas conforme o regime tributário da empresa (Lucro Real vs Simples Nacional) | Cada regime tem um conjunto diferente de obrigações mensais | — Pending |
| Prazo único por tipo de obrigação (não por empresa), ajustado por dia útil/feriado | Neste escritório os prazos não variam por CNPJ; simplifica o modelo do v1 | — Pending |
| "Concluído" = checkbox simples, sem anexo/comprovante | Mantém o v1 simples; comprovantes podem entrar depois | — Pending |
| Importar lista de empresas da planilha "Controle pis e cofins.xlsx" existente | Evita recadastro manual de 100+ empresas | — Pending |
| Dashboards comparativos (equipe, tempo, empresas) como diferencial central | Usuário quer algo "inovador", diferente das ferramentas genéricas de tarefas | — Pending |

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
*Last updated: 2026-06-11 after initialization*
