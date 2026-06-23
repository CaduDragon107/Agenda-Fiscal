# Feature Research

**Domain:** Tax/compliance workflow management for accounting firms (gestão de tarefas e prazos fiscais)
**Researched:** 2026-06-11
**Confidence:** MEDIUM-HIGH

## Feature Landscape

Research covered two clusters of comparable products:

1. **Brazilian accounting-office task/obligation managers**: G-Click (now part of Omie), Acessórias, Confi — purpose-built for Brazilian tax obligations (SPED, DAS, GIA, DCTF, etc.), the closest analogues to "Agenda Fiscal".
2. **International tax workflow / practice management platforms**: Thomson Reuters ONESOURCE Workflow Manager, Karbon, Financial Cents, TaxDome, Canopy, AKORE TaxCalendar, Orbitax Due Date Tracker — more mature category, useful for understanding the ceiling of this product type (dashboards, capacity management, automation depth).

Both clusters converge on the same core pattern: **a calendar/checklist engine that auto-generates recurring obligation tasks per client based on a client attribute (tax regime / filing frequency / jurisdiction), assigns them to a responsible person, tracks completion against a due date that auto-adjusts for weekends/holidays, and rolls all of that up into team/management dashboards.** This validates the PROJECT.md feature set directly — it is not a novel category, it's a well-understood category that generic tools (Trello/Asana) handle poorly because they lack the "obligation template + regime + auto-adjusted deadline" data model.

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete, and the team will fall back to spreadsheets/WhatsApp within weeks.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Cadastro de empresas-cliente com regime tributário | Every comparable tool (G-Click, Confi, Acessórias, Karbon, TaxDome) treats the client record as the anchor that drives which obligations apply. Without this, recurring task generation is impossible. | LOW | Already in PROJECT.md scope. Fields: nome, CNPJ, regime, responsável, contatos, particularidades. |
| Geração automática de tarefas recorrentes por tipo de obrigação | This is THE core value proposition of the entire category. Confi advertises "400+ tarefas pré-programadas geradas automaticamente"; TaxDome "creates recurring jobs automatically on set schedules"; Acessórias "elimina retrabalho manual com workflows inteligentes". | MEDIUM | Requires an "obligation template" concept (per regime: ICMS, PIS/COFINS, SPED for Lucro Real; DAS for Simples Nacional) that spawns task instances monthly. PROJECT.md already scopes this correctly. |
| Prazo por tipo de obrigação com ajuste automático para fins de semana/feriado | Universal across the category — AKORE TaxCalendar's flagship feature is "automatically adjusts due dates with Weekend, EOM & Holiday rules"; ComplyIQ does the same; this is considered baseline, not advanced. | MEDIUM | National-holiday-only scope (per PROJECT.md Out of Scope) is a reasonable v1 simplification — most tools support this as a base layer before adding state/municipal rules. |
| Atribuição de responsável por tarefa/empresa | Every tool in both clusters has this. "Acompanhe cada processo do cliente com status, prazos e responsáveis" (Acessórias). | LOW | Maps directly to "cada colaborador cuida de um grupo fixo de empresas" — default assignment derived from company-responsible mapping, with override per task. |
| Marcar tarefa como concluída | Universal, minimal interaction. | LOW | Checkbox per PROJECT.md — correct minimal scope. |
| Calendário/lista de tarefas por período (mensal, por responsável, por empresa) | Confi: "visualizar todas as tarefas mensais, trimestrais e pontuais." Karbon/TaxDome have list + calendar + kanban views. | MEDIUM | At minimum needs: "minhas tarefas" view (per colaborador) and "todas as tarefas" view (dono). Calendar view is nice but a filterable list/table is the true minimum. |
| Alertas visuais de prazos próximos/atrasados (in-app) | Universal — every tool surfaces overdue/upcoming items prominently (color coding, badges, dashboard counters). Acessórias: "alertas de prazo"; Orbitax: "proactive alerts". | LOW-MEDIUM | PROJECT.md scopes this as in-app only (no email/WhatsApp) — consistent with how most tools' "free tier" of alerting works; push/email is typically an add-on. |
| Tarefas avulsas (ad-hoc, non-recurring) | Every practice management tool allows manual task creation alongside automated/recurring ones — recurring templates never cover 100% of work. | LOW | PROJECT.md scopes this correctly: any team member can create, assign to anyone. |
| Histórico de conclusões por tarefa/empresa | Audit trail of "quem fez o quê e quando" is standard — needed for both compliance (provar que foi feito) and the dashboards (desempenho ao longo do tempo). | LOW-MEDIUM | This is a dependency for the "evolução mensal" and "comparação entre empresas" dashboards — without persisted completion history, those dashboards have no data to chart. |
| Login individual com permissões diferenciadas (colaborador vs dono) | Universal in B2B SaaS for teams; explicitly required by PROJECT.md. Owner/admin sees everything, staff see their own scope. | LOW-MEDIUM | Standard role-based access: 2 roles (colaborador, dono/admin) is sufficient for v1 — don't over-engineer a permission matrix. |
| Detalhe da tarefa com dados da empresa visíveis | Karbon/TaxDome embed client context directly in the task view so staff don't need to switch systems. | LOW | Show CNPJ, regime, contato, particularidades on the task detail screen — avoids staff needing to cross-reference a separate company list. |

### Differentiators (Competitive Advantage)

Features that set the product apart from both generic tools (Trello/Asana/ClickUp) AND from baseline obligation-tracking tools (G-Click/Confi/Acessórias). These align directly with the "Core Value" stated in PROJECT.md.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dashboard comparativo de desempenho entre funcionários (no prazo vs atrasado) | This is explicitly the differentiator the owner asked for, and it's a feature present in *higher-tier* international tools (Karbon Analytics "team performance" views, Financial Cents "Insights Dashboard" showing workload/performance) but largely ABSENT from the Brazilian SMB-focused tools (G-Click/Confi/Acessórias focus on "did the obligation get done", not "how does staff member A compare to B"). For a 5-person office, this is a meaningful step up from what competitors in this price segment offer. | MEDIUM | Requires: persisted completion history with timestamps + due dates (dependency on table-stakes "histórico de conclusões"). Core metric: % tasks completed on time per person per period. Visualize as ranked bar chart / table per month. |
| Dashboard de evolução mensal (tendências ao longo do tempo) | Thomson Reuters ONESOURCE and Karbon offer "multiyear" trend views, but these are enterprise-tier features. For a small office, having month-over-month trend lines (e.g., "atrasos caindo de 12% para 4% em 3 meses") turns the tool into a management instrument, not just a checklist — directly serves "o dono sempre sabe em tempo real o status de tudo". | MEDIUM | Time-series aggregation of the same on-time/late metric, grouped by month. Depends on accumulating history across multiple months — value compounds over time (won't be useful in month 1, very useful by month 3-6). |
| Dashboard comparativo entre empresas (quais geram mais atraso/problema recorrente) | Not found as a standard feature in ANY of the researched tools (Brazilian or international) — most tools focus on "client status" (done/not done this period) but not "which clients are chronically problematic across time". This is a genuine gap-filler differentiator specific to this office's pain point (identifying clients that consistently cause friction, e.g., late document delivery). | MEDIUM | Aggregates the same completion data by empresa instead of by colaborador. Same underlying data model — implement as a second "slice" of the same analytics dataset (low marginal cost once per-task history exists). |
| Passo a passo por tipo de obrigação, com referência às automações Python existentes | Most tools provide generic "checklists" or "workflow templates" (Canopy: 250+ templates; Karbon: workflow templates), but none of the researched tools integrate a firm's own custom internal automation tooling into the step text. This is a low-competition, high-relevance differentiator: it directly encodes this office's tribal knowledge (e.g., "rode o script de leitura de PDF de apuração ICMS, depois preencha a planilha PIS/COFINS, depois confira a coluna J/K/M") into the task itself. | LOW-MEDIUM | v1 = static, editable text/markdown per obligation type with instructions + a reference/link to where the Python tool lives (per PROJECT.md, NOT executed from the site). This is essentially a "knowledge base entry per task type" — content authoring effort > engineering effort. |
| Acesso remoto via internet (não preso à rede local) | Both PROJECT.md and the researched cloud tools (all of them — TaxDome, Karbon, Confi, Acessórias, G-Click are cloud-native) treat this as default, but it's worth flagging as a differentiator relative to the office's CURRENT state (presumably local spreadsheets/files), not relative to the competitive set. | LOW-MEDIUM | Standard web app deployment — not a feature so much as an architectural requirement. Listed here because it's a stated constraint with real user-facing impact (equipe acessa de casa/cliente). |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for a 5-user, 100-company v1. These map closely to PROJECT.md's "Out of Scope" — research confirms those calls are sound, plus flags a few additional traps.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Notificações por email/WhatsApp | Every competitor (Acessórias' "Komunic", Confi, TaxDome) heavily markets automated client/staff notifications — feels like an obvious "must have". | For an internal 5-person tool, email/WhatsApp integration adds significant complexity (delivery infrastructure, opt-in/out, rate limits, template management) for a problem that in-app alerts + a habit of checking the dashboard daily already solves. Risk of becoming a "notification spam" project instead of a task-tracking project. | In-app badges/colors for due-soon and overdue (already scoped). Revisit in v2 once daily usage habit is established and the team can articulate exactly which notifications they'd act on. |
| Calendário de feriados estaduais/municipais e regras de prazo por dígito final do CNPJ (ICMS) | Real tax compliance calendars (AKORE, ComplyIQ, Orbitax) DO support jurisdiction-specific rules — it feels incomplete without it. | This office operates with a SINGLE fixed deadline per obligation type regardless of CNPJ (per Key Decisions), so building a jurisdiction/digit-based rule engine is speculative complexity solving a problem this office doesn't have. It also multiplies the holiday-calendar maintenance burden (27 states × municipalities). | National-holiday-only adjustment (already scoped). If a specific client genuinely has a different deadline, handle via the "particularidades" field + manual avulsa task, not a rule engine. |
| Execução remota das automações Python a partir do site | Feels like the "obvious next step" once the step-by-step references the scripts — "why not just run it from here?" | Running arbitrary local Python scripts from a web app introduces a huge security/architecture problem (remote code execution, file system access, environment parity between web server and the user's local machine where PDFs/spreadsheets live). This is a multi-week project on its own and orthogonal to "never miss a deadline". | v1 references/explains usage (already scoped). If automation is genuinely valuable to centralize, that's a SEPARATE future milestone (e.g., "Automation Service"), not a feature bolted onto the task tracker. |
| Anexos/comprovantes de conclusão (upload de arquivo) | Acessórias' "Protocolo Digital" and most practice management tools treat document attachment as core — "prova de que foi feito". | File storage adds infrastructure (storage backend, virus scanning considerations, size limits, retention policy) and UI complexity (upload, preview, versioning) disproportionate to the stated need ("nunca perde um prazo"). The checkbox + history already proves "when" something was marked done; "proof of work" is a different problem. | Simple checkbox + completion timestamp + completer's name (already scoped). If proof-of-delivery becomes a real need, it's a clean v1.x addition once the core loop is validated. |
| Construtor visual de regras/templates (admin UI para o dono criar novos tipos de obrigação sem código) | Enterprise tools (Thomson Reuters ONESOURCE, Canopy with 250+ templates) expose template builders so firms can self-customize. | For exactly 2 regimes and ~4 obligation types total, a no-code rule builder is massive over-engineering. The "templates" are static and rarely change (tax obligation types don't change monthly). | Hardcode the obligation templates (ICMS, PIS/COFINS, SPED, DAS) with their cadence/deadline rules in config/seed data. If a 3rd regime or 5th obligation type appears later, add it via a code change/migration — happens maybe once a year. |
| Time tracking / billing por tarefa | Karbon and Financial Cents both heavily feature time-tracking tied to billing — common in practice management suites. | This office isn't billing clients per-task via this tool (it's an internal compliance tracker, not a client billing system); adding time tracking conflates "did we meet the deadline" with "how many billable hours did this take", which is a different product (and likely already handled by existing accounting/payroll systems). | Out of scope entirely. Performance dashboards measure ON-TIME COMPLETION, not hours spent. |
| Portal do cliente (cliente acessa o sistema para enviar documentos/ver status) | Acessórias, Confi, TaxDome all heavily promote client-facing portals as a key value-add. | Adds a third user type (external, untrusted) with its own auth, permission, and UX needs — roughly doubles the security surface and UI scope for a tool whose stated users are exactly 5 internal staff. | Out of scope for v1. Document/data exchange with clients continues via existing channels (email/WhatsApp outside the system). |

## Feature Dependencies

```
Cadastro de empresas-cliente (regime tributário, responsável)
    └──requires──> [base de dados importada da planilha existente]

Geração automática de tarefas recorrentes por regime
    └──requires──> Cadastro de empresas-cliente (precisa saber o regime e o responsável)
    └──requires──> Templates de obrigação por regime (ICMS/PIS-COFINS/SPED para Lucro Real; DAS para Simples Nacional)
    └──requires──> Regra de ajuste de prazo por dia útil/feriado (calendário de feriados nacionais)

Detalhe da tarefa (passo a passo + dados da empresa + histórico)
    └──requires──> Geração automática de tarefas recorrentes (a tarefa precisa existir)
    └──requires──> Cadastro de empresas-cliente (para exibir dados relevantes)
    └──requires──> Conteúdo de "passo a passo" por tipo de obrigação (autoria de conteúdo, não só engenharia)

Histórico de conclusões por tarefa
    └──requires──> Marcar tarefa como concluída (gera o evento de histórico)

Dashboard comparativo entre funcionários (no prazo vs atrasado)
    └──requires──> Histórico de conclusões por tarefa (precisa de dados: data prevista vs data real)
    └──requires──> Login individual (precisa atribuir conclusões a uma pessoa)

Dashboard de evolução mensal
    └──requires──> Histórico de conclusões por tarefa
    └──requires──> [acúmulo de pelo menos 2-3 meses de dados para ser útil]

Dashboard comparativo entre empresas
    └──requires──> Histórico de conclusões por tarefa
    └──requires──> Cadastro de empresas-cliente

Alertas visuais de prazos
    └──requires──> Geração automática de tarefas recorrentes (ou tarefas avulsas) com prazo definido

Tarefas avulsas
    ──enhances──> Cobertura geral (preenche lacunas que templates não cobrem)
    └──requires──> Login individual (para atribuir a alguém)

[Execução remota de automações Python] ──conflicts──> [Escopo v1 / arquitetura simples]
[Notificações email/WhatsApp] ──conflicts──> [Foco em alertas in-app v1]
```

### Dependency Notes

- **Os 3 dashboards compartilham a mesma base de dados (histórico de conclusões com timestamps + prazos previstos).** Implementação eficiente: construir UM modelo de dados de "eventos de conclusão" (empresa, responsável, tipo de obrigação, prazo previsto, data de conclusão real, atraso em dias) e depois criar 3 visualizações/agregações diferentes sobre ele (por pessoa, por mês, por empresa). Não tratar como 3 features separadas no nível de dados — só no nível de UI/relatório.
- **Geração automática de tarefas recorrentes requer que o cadastro de empresas já tenha regime tributário e responsável preenchidos** — isso reforça que a importação da planilha "Controle pis e cofins.xlsx" deve ocorrer ANTES (ou na mesma fase) da implementação do gerador de tarefas. Se a importação atrasar, o gerador não tem o que gerar.
- **O "passo a passo" é majoritariamente um problema de CONTEÚDO, não de engenharia** — a estrutura de dados (campo de texto/markdown por tipo de obrigação) é trivial, mas o valor real depende de o usuário escrever/transcrever os passos reais de cada obrigação. Isso pode ser feito incrementalmente (começar com 1-2 tipos de obrigação bem documentados, completar os demais depois) sem bloquear o lançamento.
- **Dashboard de evolução mensal só entrega valor real após 2-3 ciclos mensais de uso** — isso não bloqueia a implementação (pode ser construído desde o início), mas é importante gerenciar expectativa: no mês 1 o gráfico de tendência terá um único ponto.
- **Histórico de conclusões é a dependência crítica que conecta "tarefas do dia a dia" aos "dashboards diferenciadores"** — se o modelo de dados de conclusão for subdimensionado (ex: só um booleano "feito/não feito" sem timestamp e sem snapshot do prazo original), os dashboards de desempenho não terão dados suficientes para calcular "no prazo vs atrasado" retroativamente. Recomenda-se desenhar esse modelo de dados com cuidado desde a Fase 1, mesmo que os dashboards só sejam construídos em fases posteriores.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept ("a equipe nunca perde um prazo, e o dono sempre sabe o status").

- [ ] Login individual (5 usuários: 4 colaboradores + dono) com 2 níveis de permissão
- [ ] Cadastro de empresas-cliente (importado da planilha existente) com regime tributário, responsável, particularidades
- [ ] Templates de obrigação por regime (ICMS, PIS/COFINS, SPED para Lucro Real; DAS para Simples Nacional) com prazo fixo + ajuste por feriado nacional/fim de semana
- [ ] Geração automática mensal de tarefas recorrentes a partir desses templates
- [ ] Lista de tarefas filtrável (por responsável, por empresa, por status, por mês) — "minhas tarefas" e "todas as tarefas" (dono)
- [ ] Detalhe da tarefa: dados da empresa + passo a passo (mesmo que inicialmente só para 1-2 tipos de obrigação) + marcar como concluída
- [ ] Histórico de conclusões persistido (data prevista, data real, responsável) — base de dados para os dashboards
- [ ] Tarefas avulsas (criação manual, atribuição livre)
- [ ] Alertas visuais in-app (cores/badges para prazo próximo/atrasado)
- [ ] Dashboard comparativo de desempenho por funcionário (no prazo vs atrasado, mesmo que só com dados do mês corrente no início)

### Add After Validation (v1.x)

Features to add once core loop is working and 1-3 months of data has accumulated.

- [ ] Dashboard de evolução mensal (trend lines) — adicionar quando houver pelo menos 2-3 meses de histórico
- [ ] Dashboard comparativo entre empresas — mesma base de dados, nova visualização
- [ ] Completar passo a passo para todos os tipos de obrigação (esforço de conteúdo contínuo)
- [ ] Refinamentos de UX em alertas (ex: dashboard de "tarefas vencendo nos próximos 3 dias" agregado)

### Future Consideration (v2+)

Features to defer until the core tool is embedded in daily routine.

- [ ] Notificações por email/WhatsApp — defer até o hábito de checar o site diariamente estar consolidado
- [ ] Anexos/comprovantes de conclusão — defer até surgir necessidade real de auditoria de evidências
- [ ] Regras de feriados estaduais/municipais e prazos por dígito final de CNPJ — defer até (se) o escritório expandir para clientes com regras divergentes
- [ ] Integração de execução das automações Python — tratar como milestone separado, não como extensão do tracker de tarefas
- [ ] Portal do cliente — fora de escopo enquanto o produto for uso 100% interno

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Cadastro de empresas + importação da planilha | HIGH | MEDIUM | P1 |
| Geração automática de tarefas recorrentes por regime | HIGH | MEDIUM | P1 |
| Ajuste de prazo por feriado/fim de semana | HIGH | MEDIUM | P1 |
| Login individual com permissões (colaborador/dono) | HIGH | LOW | P1 |
| Lista/visão de tarefas (minhas/todas) | HIGH | LOW | P1 |
| Marcar concluído + histórico (data prevista/real) | HIGH | LOW-MEDIUM | P1 |
| Detalhe de tarefa (dados da empresa) | MEDIUM | LOW | P1 |
| Tarefas avulsas | MEDIUM | LOW | P1 |
| Alertas visuais in-app | HIGH | LOW | P1 |
| Dashboard desempenho por funcionário | HIGH | MEDIUM | P1 |
| Passo a passo detalhado (todos os tipos) | MEDIUM | LOW (eng.) / HIGH (conteúdo) | P2 |
| Dashboard evolução mensal | HIGH | MEDIUM | P2 |
| Dashboard comparativo entre empresas | MEDIUM-HIGH | LOW (reusa dados) | P2 |
| Notificações email/WhatsApp | MEDIUM | HIGH | P3 |
| Anexos/comprovantes | LOW-MEDIUM | MEDIUM | P3 |
| Regras de feriados estaduais/CNPJ | LOW | HIGH | P3 |
| Execução remota de automações | LOW (para v1) | VERY HIGH | P3 |
| Portal do cliente | LOW (uso interno) | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible (depends on data accumulation or content authoring)
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | G-Click / Confi / Acessórias (BR) | Karbon / Financial Cents / TaxDome (Intl) | Our Approach |
|---------|-----------------------------------|---------------------------------------------|--------------|
| Geração automática de obrigações | Sim — "400+ tarefas pré-programadas" (Confi); workflows automatizados (Acessórias) | Sim — "creates recurring jobs automatically on set schedules" (TaxDome); 250+ templates (Canopy/Karbon) | Sim, mas com escopo enxuto: apenas os ~4 tipos de obrigação que o escritório realmente usa (ICMS, PIS/COFINS, SPED, DAS), não uma biblioteca genérica de centenas de templates |
| Ajuste de prazo por feriado | Implícito (não destacado nas fontes) | Sim, destacado como diferencial (AKORE, ComplyIQ) | Sim — feriados nacionais apenas (v1), conforme decisão do PROJECT.md |
| Dashboard de indicadores operacionais | Sim — "Tela de Insights" (Acessórias) | Sim — Insights Dashboard (Financial Cents), Analytics (Karbon) | Sim, mas focado especificamente em "no prazo vs atrasado" por pessoa/empresa/mês — mais estreito e mais acionável que dashboards genéricos de "status geral" |
| Comparação de desempenho entre colaboradores | Não encontrado como destaque nas fontes BR pesquisadas | Sim, em nível "enterprise" (Karbon Resource Planning, Financial Cents Capacity Reports) — focado em CARGA DE TRABALHO, não em pontualidade | Foco diferente: não é "quanto trabalho cada um tem" (capacity), é "quem está cumprindo prazos" (accountability) — mais simples de implementar e mais alinhado ao objetivo do dono |
| Comparação entre clientes (quais geram mais atraso) | Não encontrado em nenhuma fonte pesquisada | Não encontrado em nenhuma fonte pesquisada | Diferencial genuíno — gap real no mercado pesquisado para esse nicho |
| Passo a passo / checklist por obrigação | Genérico (templates de tarefas, sem detalhe de "como fazer") | Genérico (workflow templates, focado em status/etapas, não em instruções operacionais) | Diferencial: passo a passo escrito pelo próprio escritório, incluindo referência às automações Python internas — conhecimento tácito virando ativo do sistema |
| Portal do cliente | Sim, destaque forte (Acessórias, Confi, TaxDome) | Sim, destaque forte (todos) | Fora de escopo v1 — uso 100% interno |
| Notificações WhatsApp/email | Sim, destaque forte (Acessórias "Komunic", Confi, TaxDome) | Sim (lembretes automáticos para staff/clientes) | Fora de escopo v1 — alertas in-app apenas |

## Sources

- [Tax Workflow Management Software: Streamlining Compliance — Cflow](https://www.cflowapps.com/tax-workflow-management-software/)
- [Thomson Reuters ONESOURCE Workflow Manager](https://tax.thomsonreuters.com/en/onesource/workflow-manager)
- [10 Best Workflow Management Software for Accountants — TaxDome](https://taxdome.com/blog/workflow-management-software-for-accountants)
- [10 Best Tax Practice Management Software — Karbon Magazine](https://karbonhq.com/resources/best-tax-practice-management-software/)
- [The 7 Best Tax Workflow Software — Financial Cents](https://financial-cents.com/resources/articles/tax-workflow-software/)
- [Workflow Software for Tax, Accounting, and Finance Teams — Wolters Kluwer](https://www.wolterskluwer.com/en/solutions/tax-accounting-us/corporate-tax-software/corporate-tax-office-solutions/workflow-software)
- [Tax workflow for accounting firms: Best practices & automation — Thomson Reuters](https://tax.thomsonreuters.com/blog/tax-workflow-for-accounting-firms-best-practices-and-automation-tips/)
- [Practice Management Software for Tax Firms — Karbon](https://karbonhq.com/solution/tax/)
- [Capacity Management For Accounting Firms — Financial Cents](https://financial-cents.com/capacity-management/)
- [Financial Cents Vs. Karbon for Small and Mid-Sized Firms](https://financial-cents.com/resources/articles/financial-cents-vs-karbon-for-small-and-mid-sized-accounting-firms/)
- [Acessórias — Automação contábil e gestão online](https://acessorias.com/site/)
- [Confi — Gestão de tarefas contábeis](https://confi.net.br/)
- [Confi — Gestão de Tarefas Contábeis (landing)](https://confi.net.br/gestao-de-tarefas-contabeis-vb-a/)
- [Os 5 Melhores Softwares para Gestão de Escritórios de Contabilidade — Hitech Soluções](https://hitechsolucoes.com.br/os-5-melhores-softwares-para-gestao-de-escritorios-de-contabilidade/)
- [G-Click (agora parte da Omie)](https://www.omie.com.br/gclick/)
- [ComplyIQ Compliance Intelligence Platform — IGEN](https://igentax.com/products/complyiq/)
- [AKORE TaxCalendar](https://akoretax.com/)
- [Due Date Tracker — Orbitax](https://orbitax.com/solutions/due-date-tracker)
- [Top 12 Project & Task Management Software for Accountants — TaxDome](https://taxdome.com/blog/top-project-task-management-software-for-accountants)
- [Checklist + Planilhas de Controle: Obrigações Acessórias — Dominando a Contabilidade](https://dominandoacontabilidade.com/checklist-planilhas-de-controle-obrigacoes-acessorias-simples-nacional-lucro-presumido-e-lucro-real/)

---
*Feature research for: Tax/compliance workflow management for Brazilian accounting firm (Agenda Fiscal)*
*Researched: 2026-06-11*

---

# Addendum: v2.0 Expansão Multi-Setor (DP e Contábil)

**Domain:** Gestão de tarefas para escritório de contabilidade — extensão para Departamento Pessoal (DP) e Contábil
**Researched:** 2026-06-22
**Confidence:** MEDIUM

## Context

Esta seção cobre a expansão do "Agenda Fiscal" (v1.0 acima, setor Fiscal já validado em produção) para os setores **Departamento Pessoal (DP)** e **Contábil**, atendendo à mesma carteira de ~197 empresas. O schema Prisma existente (`prisma/schema.prisma`) já define o padrão a replicar: `Empresa.responsavelId` (hoje único), enum `TipoObrigacao`, `Tarefa.competencia` (string mensal), `@@unique([empresaId, tipoObrigacao, competencia])`, e `DesempenhoMensal` agregado por colaborador/competência. A análise de complexidade abaixo é relativa a esse modelo existente — não a um produto novo do zero.

## Feature Landscape — v2.0

### Table Stakes — Departamento Pessoal (DP)

Obrigações recorrentes que toda empresa com funcionários CLT gera mensalmente. Faltar qualquer uma = produto incompleto para o setor DP.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Geração mensal: Folha de Pagamento | Toda empresa com funcionários precisa calcular e pagar salários até o 5º-7º dia útil do mês seguinte à competência (MEDIUM confidence, múltiplas fontes convergem) | LOW | Mesmo padrão de `competencia` mensal já usado no Fiscal; novo `TipoObrigacao` no enum |
| Geração mensal: FGTS (FGTS Digital) | Recolhimento obrigatório, prazo dia 7 do mês seguinte via FGTS Digital (substituiu guia antiga) | LOW | Prazo fixo por tipo, igual ao padrão DAS/ICMS já implementado |
| Geração mensal: INSS (contribuição previdenciária) | Recolhimento obrigatório, prazo dia 20 do mês seguinte | LOW | Prazo fixo por tipo |
| Geração mensal: eSocial — eventos periódicos (S-1200/S-1210, folha) | Substituiu GFIP/CAGED/DIRF; prazo dia 15 do mês seguinte; envio incorreto/atrasado bloqueia FGTS Digital e gera multa | LOW | Mesma mecânica de "obrigação com prazo fixo ajustado por dia útil" do Fiscal |
| Filtro "empresa tem funcionários?" antes de gerar obrigações DP | Nem toda empresa-cliente tem CLT contratado (ex: empresas só com sócios pró-labore); gerar DP para quem não tem funcionário gera ruído/tarefa falsa | MEDIUM | Requer campo booleano ou contagem de funcionários na `Empresa` (ou tabela `Funcionario` mínima) — não existe hoje no schema |
| Responsável DP por empresa (não fiscal) | Pessoa diferente cuida do DP da mesma empresa — já é decisão validada da milestone | MEDIUM | Requer migrar `Empresa.responsavelId` único → relação por setor (ver Cross-Sector abaixo) |
| Dashboard DP (desempenho, evolução mensal, ranking) | Mesma exigência de visibilidade do dono já validada no Fiscal — não pode ficar "menos visível" que o setor mais antigo | LOW (réplica) | Reaproveita componentes/queries do Fiscal, filtrando por setor |
| Tarefas avulsas atribuíveis a colaboradores DP | Nem toda demanda de DP é recorrente automática (ex: cálculo de rescisão pontual, dúvida de cliente) | LOW (já existe genérico) | Mecanismo de tarefa avulsa já é setor-agnóstico no v1.0; só precisa expor os novos colaboradores no seletor |

### Table Stakes — Contábil

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Geração mensal: Escrituração Contábil (lançamentos/balancete interno) | Toda empresa precisa ter a contabilidade escriturada mês a mês internamente, mesmo que a entrega oficial (ECD) seja anual | LOW | Nova obrigação mensal, mesmo padrão `competencia` |
| Geração ANUAL: ECD (Escrituração Contábil Digital) | Obrigatória para Lucro Real, entrega até último dia útil de maio referente ao ano anterior (MEDIUM confidence) | HIGH | **Primeira obrigação com periodicidade não-mensal do sistema** — motor de geração precisa suportar "competência = ano" e disparo único anual, não no job mensal padrão |
| Geração ANUAL: ECF (Escrituração Contábil Fiscal) | Obrigatória para a maioria das pessoas jurídicas (substituiu DIPJ), entrega até último dia útil de julho do ano seguinte | HIGH | Mesma extensão arquitetural do ECD; pode reusar a mesma mecânica de "obrigação anual" |
| Geração ANUAL: DEFIS (Simples Nacional) | Obrigatória para empresas do Simples Nacional, prazo até 31 de março do ano seguinte (MEDIUM confidence) | MEDIUM | Empresas Simples Nacional não têm ECD/ECF (que são do Lucro Real) — precisa de regra "DEFIS só se regime = SIMPLES_NACIONAL", análoga à regra já existente "DAS só se regime = SIMPLES_NACIONAL" |
| Responsável Contábil por empresa | Mesmo racional do DP — pessoa contábil dedicada por empresa | MEDIUM | Mesma migração de modelo do DP |
| Dashboard Contábil (desempenho, evolução mensal, ranking) | Mesma paridade de visibilidade exigida pelo dono | LOW (réplica) | Reaproveita componentes do Fiscal |
| Tarefas avulsas atribuíveis a colaboradores Contábil | Demandas pontuais (ex: parcelamento, retificação, pedido de cliente) | LOW (já existe genérico) | Idem DP |

### Cross-Sector Features (Fiscal + DP + Contábil)

Funcionalidades que tocam a arquitetura compartilhada entre os 3 setores.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Empresa com 1 responsável POR SETOR** (não 1 responsável geral) | Decisão explícita do usuário: pessoas diferentes cuidam do fiscal/DP/contábil da mesma empresa | **HIGH** — mudança estrutural central da v2.0 | Hoje `Empresa.responsavelId` é uma FK única para `Usuario`. Precisa virar 3 FKs (`responsavelFiscalId`, `responsavelDpId`, `responsavelContabilId`) OU uma tabela de junção `EmpresaResponsavel(empresaId, setor, usuarioId)`. A tabela de junção é mais extensível (facilita 4º setor futuro) mas exige reescrever toda query que hoje faz `empresa.responsavel` — **toda a base de código do Fiscal que lê responsável precisa de migração**, não é puramente aditivo |
| **Campo `Setor` no modelo de Usuário** | Os 11 novos colaboradores (4 DP + 3 Contábil) precisam ser distinguíveis dos 4 fiscais — RBAC e seletores de "atribuir tarefa" devem listar só colaboradores do setor relevante | MEDIUM | Novo enum `Setor { FISCAL, DP, CONTABIL }` em `Usuario`; pequeno mas toca toda tela de atribuição de tarefa avulsa |
| **`TipoObrigacao` estendido com setor** | Hoje o enum mistura tipos (ICMS, DAS, SPED) sem campo de setor explícito — ao adicionar FOLHA, FGTS, INSS, ESOCIAL, ECD, ECF, DEFIS, BALANCETE ao mesmo enum, fica implícito demais qual obrigação pertence a qual setor | MEDIUM | Recomendado adicionar campo `setor` a uma tabela de "tipo de obrigação" (hoje é só enum) ou, no mínimo, mapear setor→tipos em código central, não espalhado |
| **Motor de geração com periodicidade configurável (mensal vs anual)** | ECD/ECF/DEFIS são a primeira necessidade real de obrigação não-mensal — sem isso, o job mensal teria que ter lógica especial "só gera em maio" hardcoded, ou rodar um job separado para anuais | **HIGH** | Maior risco arquitetural da milestone. Hoje o job roda 1x/mês e gera tudo que é "deste mês". Precisa de um conceito de `periodicidade` (MENSAL/ANUAL) por tipo de obrigação + lógica "só gera obrigação anual X no mês de disparo Y, com competência = ano anterior" |
| **Dashboards duplicados por setor, sem visão unificada** | Decisão explícita do usuário para simplificar v2.0 | LOW | Reaproveita componentes existentes (Recharts/shadcn chart) só filtrando por setor — sem agregação cross-setor, sem mudança de schema em `DesempenhoMensal` além de um campo `setor` |
| **`DesempenhoMensal` segmentado por setor** | Sem isso, o ranking/evolução mensal misturaria desempenho fiscal com DP/Contábil do mesmo colaborador, o que nunca acontece pois colaboradores são fixos por setor — mas a agregação SQL (`GROUP BY competencia, colaboradorId`) ainda precisa do filtro implícito de setor para os relatórios "por setor" | LOW | Como colaboradores já são fixos por setor (campo `Setor` em `Usuario`), o filtro vem de JOIN com `Usuario.setor` — não precisa de coluna nova em `DesempenhoMensal` |
| **7 colaboradores placeholder renomeáveis** | Mesmo padrão usado no Fiscal v1.0 (colaborador1-4 → nomes reais depois) | LOW | Seed script simples, já há precedente direto |

### Differentiators (mantidos do v1.0, agora replicados por setor)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dashboard comparativo de desempenho por setor | Dono enxerga gargalos por equipe (DP atrasando vs Contábil em dia) sem misturar dados | LOW (réplica) | Mesma UI, filtro de setor |
| Ranking de empresas problemáticas por setor | Uma empresa pode ser tranquila no fiscal mas problemática no DP (ex: alta rotatividade de funcionários gerando muitas rescisões) — informação só aparece se segmentada por setor | LOW (réplica) | Reaproveita lógica de ranking já validada |
| Histórico de conclusões por tarefa (passo a passo) | Mesmo valor do Fiscal: rastreabilidade de quem fez o quê e quando, útil em auditoria trabalhista/contábil | LOW (já existe genérico) | `TarefaHistorico` já é setor-agnóstico |

### Anti-Features (v2.0)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|--------------|
| Cálculo automático de folha de pagamento dentro do sistema | "Já que estamos automatizando, por que não calcular a folha também?" | Cálculo de folha exige tabelas de INSS/IRRF atualizadas, convenções coletivas por categoria, regras de adicional noturno/hora extra — é o domínio de um software de folha dedicado (ex: Domínio, Alterdata), não de um gestor de tarefas. Replicar isso é reconstruir um ERP de RH inteiro | Manter o sistema como **gestor de tarefas e prazos** (igual ao padrão já estabelecido para ICMS/PIS-COFINS no Fiscal): a tarefa "Gerar Folha de Pagamento" referencia o sistema de folha externo já usado pelo escritório, sem recalcular nada |
| Execução/integração direta com eSocial (envio automático de eventos) | "Já que sabemos o prazo, por que não enviar automaticamente?" | eSocial exige certificado digital, assinatura, validação de schema XML complexa e tratamento de erros de rejeição — escopo de uma integração robusta, fora do core value ("nunca perder prazo") que é sobre visibilidade, não automação de envio | Mesma decisão já tomada no v1.0 para ICMS/PIS-COFINS: o sistema referencia/explica o passo a passo, não executa |
| Cadastro completo de funcionários (módulo de RH) | "Já que tem DP, por que não cadastrar os funcionários também (admissão, dados pessoais, histórico)?" | Isso é o domínio de um sistema de RH/folha completo — duplicaria dados que já existem no software de folha do escritório, criando dois lugares de verdade e risco de dados trabalhistas sensíveis (LGPD) desatualizados | Cadastro de `Empresa` ganha, no máximo, um campo simples "tem funcionários CLT? (sim/não)" ou contagem aproximada — suficiente para decidir se gera ou não as obrigações de folha/FGTS/eSocial daquela empresa |
| Visão unificada de dashboard entre os 3 setores | "Já que o dono vê tudo, por que não um dashboard combinado?" | Já decidido explicitamente como fora de escopo nesta milestone pelo usuário — combinar métricas de 3 setores com cadências diferentes (mensal vs anual) complica a UI sem necessidade validada ainda | Dashboards separados por setor, reavaliar visão unificada em milestone futura quando houver demanda real |
| Calendário de convenções coletivas por categoria profissional | Departamento pessoal de fato depende de convenções coletivas para datas de reajuste, piso salarial etc. | Convenções coletivas variam por sindicato/categoria/região e mudam anualmente — manter isso atualizado é trabalho equivalente a um produto jurídico-trabalhista dedicado, fora do escopo de "nunca perder prazo de obrigação" | Tarefas avulsas cobrem casos pontuais (ex: "verificar reajuste sindicato X"); não modelar como obrigação recorrente automática |

## Feature Dependencies — v2.0

```
[Setor em Usuario]
    └──requires antes de──> [Filtro de colaboradores por setor nos seletores]
                                └──requires antes de──> [Atribuição de tarefa avulsa por setor]

[Empresa com 1 responsável por setor]
    └──requires──> [Migração de Empresa.responsavelId único → relação por setor]
                       └──requires──> [Reescrita de toda query/tela que hoje lê empresa.responsavel]
                       └──enhances──> [Dashboard "minhas empresas" por colaborador DP/Contábil]

[Motor de geração com periodicidade configurável (mensal/anual)]
    └──requires antes de──> [Geração ANUAL: ECD]
    └──requires antes de──> [Geração ANUAL: ECF]
    └──requires antes de──> [Geração ANUAL: DEFIS]
    └──enhances──> [Reuso futuro para outras obrigações anuais não previstas hoje]

[Campo "empresa tem funcionários CLT?"]
    └──requires antes de──> [Geração mensal de obrigações DP (Folha/FGTS/INSS/eSocial)]
    (sem esse filtro, empresas só-pró-labore recebem tarefas DP falsas)

[TipoObrigacao estendido + mapeamento setor→tipo]
    └──requires antes de──> [Qualquer geração de obrigação DP ou Contábil]
    └──conflicts com──> [Adicionar tipos novos direto no enum existente sem mapear setor] (gera ambiguidade de qual obrigação pertence a qual setor)

[Dashboards duplicados por setor] ──enhances──> [Dashboard comparativo de desempenho] (reuso de componente, não bloqueante)
```

### Dependency Notes — v2.0

- **Empresa com 1 responsável por setor requer migração de schema antes de qualquer feature DP/Contábil:** é a mudança mais arriscada e mais "na base" — toda tela existente do Fiscal que assume `empresa.responsavel` único vai quebrar ou exibir dado errado se não for migrada primeiro. Deve ser a primeira fase técnica da v2.0, antes de qualquer geração de tarefa DP/Contábil.
- **Motor de periodicidade anual requer ser resolvido antes do ECD/ECF/DEFIS, mas não bloqueia DP:** todas as obrigações DP (Folha, FGTS, INSS, eSocial) são mensais e reaproveitam o motor mensal já existente sem mudança estrutural. Só o Contábil (ECD/ECF/DEFIS) força a extensão de periodicidade — isso significa que **DP pode ser entregue em paralelo ou antes do Contábil**, já que sua complexidade arquitetural é menor.
- **Campo "tem funcionários CLT" é um bloqueador pequeno mas real para DP:** sem ele, o sistema geraria tarefas de folha/FGTS/eSocial para as ~poucas empresas-cliente que não têm CLT (ex: holdings, empresas só com sócio pró-labore), gerando ruído e desconfiança no sistema desde o primeiro mês.
- **TipoObrigacao + mapeamento setor conflita com "adicionar direto no enum":** o enum atual (`ICMS, PIS_COFINS, SPED_FISCAL, SPED_CONTRIBUICOES, DAS`) não tem conceito de setor. Adicionar `FOLHA, FGTS, INSS, ESOCIAL, ECD, ECF, DEFIS, BALANCETE` sem um mapeamento explícito setor→tipo funciona tecnicamente mas torna qualquer query "obrigações do setor X" dependente de uma lista hardcoded espalhada pelo código — recomendação é centralizar esse mapeamento em um único lugar (constante ou tabela) desde o início.

## MVP Definition — v2.0

### Launch With (v2.0)

Mínimo para replicar o valor central do Fiscal nos 2 novos setores.

- [ ] Migração `Empresa`: responsável por setor (fiscal/DP/contábil) — **fundação obrigatória, sem isso nada mais funciona corretamente**
- [ ] `Setor` em `Usuario` + 7 colaboradores placeholder (4 DP + 3 Contábil)
- [ ] Campo "empresa tem funcionários CLT?" — evita geração de tarefa DP falsa
- [ ] Geração mensal DP: Folha de Pagamento, FGTS, INSS, eSocial (eventos periódicos) — só para empresas com funcionários
- [ ] Geração mensal Contábil: Escrituração/Balancete — para todas as empresas
- [ ] Extensão do motor de geração para suportar periodicidade ANUAL
- [ ] Geração anual Contábil: ECD (Lucro Real), ECF (todas exceto MEI/Simples conforme regra), DEFIS (Simples Nacional)
- [ ] Tarefas avulsas habilitadas para os novos colaboradores DP/Contábil (reuso do mecanismo existente)
- [ ] Dashboards (desempenho, evolução mensal, ranking de empresas) duplicados para DP e para Contábil — páginas separadas

### Add After Validation (v2.x)

- [ ] Rescisão/desligamento como obrigação com prazo derivado de evento (não fixo por competência) — trigger: usuário reportar que rescisões pontuais não se encaixam bem no modelo de "competência mensal fixa" atual
- [ ] Férias e 13º salário como lembretes/obrigações semi-recorrentes (datas variam por funcionário) — trigger: depois que o fluxo mensal estiver estável, se DP achar falta desse controle
- [ ] Campo "quantidade de funcionários" na Empresa (não só booleano) — trigger: se quantidade afetar volume/complexidade de tarefa de forma que o dono queira ver no dashboard

### Future Consideration (v3+)

- [ ] Visão unificada de dashboard entre os 3 setores — explicitamente fora de escopo desta milestone por decisão do usuário
- [ ] Cadastro de funcionários (mini-RH) dentro do sistema — redundante com software de folha existente, alto risco de duplicar fonte de verdade
- [ ] Integração/envio automático ao eSocial — mesma decisão já tomada para Fiscal (só referenciar, não executar)
- [ ] Calendário de convenções coletivas por sindicato/categoria — escopo de produto jurídico-trabalhista separado

## Feature Prioritization Matrix — v2.0

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Migração responsável por setor | HIGH | HIGH | P1 |
| Setor em Usuario + colaboradores placeholder | HIGH | LOW | P1 |
| Geração mensal DP (Folha/FGTS/INSS/eSocial) | HIGH | LOW | P1 |
| Campo "tem funcionários CLT" | MEDIUM | LOW | P1 |
| Geração mensal Contábil (Escrituração/Balancete) | HIGH | LOW | P1 |
| Motor de periodicidade anual | HIGH | HIGH | P1 |
| Geração anual ECD/ECF/DEFIS | HIGH | MEDIUM (depende do motor anual) | P1 |
| Dashboards duplicados DP/Contábil | HIGH | LOW | P1 |
| Tarefas avulsas para novos colaboradores | MEDIUM | LOW | P1 |
| Rescisão como obrigação orientada a evento | MEDIUM | MEDIUM | P2 |
| Férias/13º como lembrete | LOW-MEDIUM | MEDIUM | P2 |
| Quantidade de funcionários (não só booleano) | LOW | LOW | P3 |
| Dashboard unificado cross-setor | LOW (explicitamente descartado) | HIGH | P3 (fora de escopo) |
| Cadastro de funcionários / mini-RH | LOW (redundante) | HIGH | P3 (anti-feature) |
| Integração automática eSocial | LOW (fora do core value) | HIGH | P3 (anti-feature) |

**Priority key:**
- P1: Must have para v2.0
- P2: Should have, considerar após v2.0 estabilizar
- P3: Nice to have ou explicitamente fora de escopo

## Competitor Feature Analysis — v2.0

| Feature | Nuubes / Sistema Makro / Contmatic / Alterdata (mercado) | Agenda Fiscal v1.0 (hoje) | Nosso plano v2.0 |
|---------|-----------------------------------------------------------|----------------------------|--------------------|
| Separação por setor (Fiscal/DP/Contábil) | Sim — "Áreas de Trabalho" pré-definidas por departamento, padrão estabelecido no mercado | Só Fiscal | Replicar o padrão de mercado: 3 setores com geração e dashboard próprios |
| Geração automática de tarefa recorrente por área | Sim, padrão do mercado | Sim, só Fiscal | Estender para DP e Contábil, reaproveitando motor existente |
| Workflow por tipo de cliente | Sim (ex: cliente Simples vs Lucro Real tem fluxo diferente) | Sim, via `RegimeTributario` | Já coberto pelo padrão existente — DEFIS só Simples, ECD/ECF só Lucro Real, igual a DAS vs ICMS hoje |
| Cálculo de folha integrado | Sim (módulos completos de folha) | Não se aplica (não existe DP ainda) | **Não replicar** — manter como gestor de tarefas, referenciando ferramentas externas de folha (mesma filosofia do ICMS/PIS-COFINS) |
| Dashboard comparativo de desempenho por colaborador | Parcial (alguns oferecem relatórios, mas dashboards comparativos visuais são descritos como diferencial do usuário em relação a ferramentas genéricas) | Sim, validado como diferencial central no v1.0 | Replicar como diferencial em DP e Contábil — é o "algo inovador" que o usuário já busca |

## Sources — v2.0

- [Checklist do Departamento Pessoal — Blog Alterdata](https://blog.alterdata.com.br/obrigacoes-departamento-pessoal/) — MEDIUM
- [Contabilidade e departamento pessoal: rotinas — Anderson Hernandes](https://andersonhernandes.com.br/contabilidade-e-departamento-pessoal/) — MEDIUM
- [Rotinas de departamento pessoal: checklist mensal — Convenia](https://blog.convenia.com.br/rotinas-de-departamento-pessoal/) — MEDIUM
- [Agenda Permanente de Obrigações Trabalhistas e Previdenciárias — Guia Trabalhista](https://www.guiatrabalhista.com.br/guia/agenda.htm) — MEDIUM
- [ECD e ECF 2026 — IOB Notícias](https://noticias.iob.com.br/ecd-e-ecf/) — MEDIUM
- [ECD: Guia 2026 — Conta Azul](https://contaazul.com/blog/parceiros/ecd/) — MEDIUM
- [ECF 2025 — IOB](https://iob.com.br/escrituracao-contabil-fiscal/) — MEDIUM
- [DEFIS 2026: prazo, regras e como entregar — Contábeis](https://www.contabeis.com.br/noticias/75213/defis-2026-prazo-regras-e-como-entregar/) — MEDIUM
- [Obrigações Acessórias Federais 2026: Calendário Completo](https://escolasuperioresn.com.br/obrigacoes-acessorias-federais-2026-calendario-completo/) — MEDIUM
- [DCTFWeb 2026 — Contajá](https://contaja.com.br/blog/dctfweb-o-que-e/) — MEDIUM
- [Prazos fiscais críticos maio 2026 — Ledware](https://www.ledware.com.br/2026/05/04/prazos-fiscais-criticos-maio-2026-esocial-efd-reinf-dctfweb-ecd-irpf/) — MEDIUM
- [Desligamento e rescisão complementar S-2299/S-2399 — Senior Documentação](https://documentacao.senior.com.br/gestao-de-pessoas-hcm/esocial/manual-processos/desligamento.htm) — MEDIUM
- [Prazo da rescisão CLT — BPO Folha de Pagamento](https://bpofolhadepagamento.com.br/departamento-pessoal/qual-o-prazo-para-pagar-a-rescisao-clt-e-quais-as-multas-pelo-atraso/) — MEDIUM
- [Software para automação de tarefas contábeis — Nuubes](https://nuubes.com/nuubes-contabil-gestao-de-tarefas-contabeis/) — LOW (single source, marketing page)
- [Sistema para Escritórios Contábeis — System Sistemas de Gestão](https://www.systempro.com.br/solucoes/empresas-contabeis/) — LOW
- [Férias e 13º Salário — Guia Trabalhista](https://www.guiatrabalhista.com.br/obras/ferias-13-salario.htm) — MEDIUM
- Leitura direta do `prisma/schema.prisma` do projeto (Agenda Fiscal v1.0) — HIGH (fonte primária, código existente)

---
*Feature research for: Agenda Fiscal v2.0 — Expansão Multi-Setor (DP e Contábil)*
*Researched: 2026-06-22*
</content>
