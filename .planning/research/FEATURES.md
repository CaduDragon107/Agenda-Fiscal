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
