# Project Research Summary

**Project:** Agenda Fiscal
**Domain:** Sistema web de gestão de tarefas e prazos fiscais recorrentes para escritório de contabilidade brasileiro (4 colaboradores + 1 dono, 100+ empresas-cliente)
**Researched:** 2026-06-11
**Confidence:** HIGH (stack central, padrões de arquitetura e pitfalls de engenharia); MEDIUM (regras fiscais brasileiras específicas por obrigação, custo real de hospedagem)

## Executive Summary

A pesquisa confirma que "Agenda Fiscal" não é uma categoria nova — é um padrão bem estabelecido ("calendário/checklist que gera tarefas recorrentes por cliente conforme um atributo do cliente, com prazo ajustado por dia útil/feriado, atribuído a um responsável, e agregado em dashboards de gestão"), presente tanto em ferramentas brasileiras (G-Click, Confi, Acessórias) quanto internacionais (Karbon, TaxDome, Financial Cents). Isso valida diretamente o escopo do PROJECT.md e confirma por que ferramentas genéricas (Trello/Asana) falham: faltam o conceito de "template de obrigação por regime tributário" e "prazo com ajuste de dia útil".

A combinação **Next.js 15.5 (App Router) + TypeScript + PostgreSQL + Prisma 6.x + Auth.js v5 (Credentials)** é a escolha mais segura para um projeto único mantido por IA: framework full-stack maduro, RBAC simples via callbacks de sessão, e tipos ponta a ponta (banco → API → formulário). `date-holidays` (com cálculo algorítmico da Páscoa) resolve feriados móveis brasileiros sem manutenção manual anual. Hospedagem recomendada: **Railway** (~$5-15/mês, processo Node 24/7, sem restrição de uso comercial, `node-cron` interno).

A arquitetura recomendada é um **monolito modular**: um único deploy, módulos internos separados por responsabilidade (Auth, Empresas, Tarefas, Regras de Obrigação, Motor de Geração, Feriados, Dashboards). Dois padrões são centrais: (1) **regras de obrigação como dados** (tabela `regras_obrigacao`, não `if/else`), permitindo adicionar regimes/obrigações sem deploy; e (2) **motor de geração mensal idempotente** via constraint UNIQUE `(empresa_id, tipo_obrigacao, competencia)` + `INSERT ... ON CONFLICT DO NOTHING`.

Os maiores riscos identificados (8 pitfalls) concentram-se em três áreas: (a) **corretude do motor de geração** — duplicação, timezone, feriados hardcoded, e a diferença não-óbvia entre obrigações que **antecipam** vs **adiam** o prazo quando caem em dia não útil (DAS adia, tributos federais geralmente antecipam — precisa validação contra calendário oficial por tipo de obrigação); (b) **qualidade dos dados importados** da planilha "Controle pis e cofins.xlsx", que provavelmente não tem campo de regime tributário e cobre só empresas de Lucro Real; e (c) **autorização enforced no backend** (não só esconder na UI), crítico por se tratar de dados fiscais sensíveis de clientes.

O MVP definido pela pesquisa de features é praticamente idêntico ao escopo já fechado no PROJECT.md, com uma adição importante: o **modelo de dados de "histórico de conclusões"** (empresa, responsável, tipo de obrigação, prazo previsto, data real de conclusão) deve ser desenhado com cuidado **desde a Fase 1/2**, mesmo que os 3 dashboards comparativos só sejam construídos por último — eles compartilham essa única fonte de dados.

## Key Findings

### Recommended Stack

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Framework full-stack | **Next.js 15.5.x (App Router)** + React 19 + TypeScript 5 (strict) | Server Components + Server Actions maduros; evita breaking changes do Next 16 (Turbopack default, `proxy.ts`, cache explícito) num v1 mantido por IA |
| Banco de dados | **PostgreSQL 16/17** (gerenciado) | Modelo relacional com agregações (GROUP BY) para dashboards; suporte a multiusuário concorrente via internet |
| ORM | **Prisma 6.x** | Schema declarativo fácil de versionar por IA; migrations automáticas; tipos TS gerados eliminam drift banco↔código |
| Autenticação | **Auth.js (NextAuth) v5**, Credentials Provider | Login email/senha próprio; RBAC via callbacks JWT/session expondo `role` (`colaborador`/`dono`) |
| Hash de senha | `bcryptjs` | Padrão seguro, sem dependências nativas |
| Feriados/dia útil | **date-holidays** (`new Holidays('BR')`) + checagem de fim de semana | Cálculo algorítmico de feriados móveis (Carnaval, Páscoa, Corpus Christi) — sem lista hardcoded que quebra ano a ano |
| Job mensal | **node-cron** (se Railway/processo sempre ativo) ou Vercel Cron (se Vercel) | Geração recorrente de tarefas, 1x/mês, idempotente |
| Importação Excel | **xlsx 0.20.3 via CDN oficial SheetJS** (`cdn.sheetjs.com`) — NUNCA `npm install xlsx` puro (0.18.5, vulnerável/não mantido) | Importação única da planilha "Controle pis e cofins.xlsx" |
| UI | **shadcn/ui** + Tailwind CSS 4 | Componentes copiados para o projeto (sem caixa-preta), acessíveis (Radix), fáceis de editar por IA |
| Gráficos | **Recharts via `shadcn add chart`** | Cobre os 3 dashboards (comparativo funcionário, evolução mensal, comparativo empresas) |
| Formulários/validação | **React Hook Form + Zod** | Schema único reusado em cliente e servidor (Server Actions) |
| Tabelas | **TanStack Table** | Paginação/ordenação/filtro para listas de 100+ empresas e tarefas |
| Datas | **date-fns** | Complementa date-holidays; evitar `moment.js` |
| Hospedagem | **Railway** (~$5-15/mês) — alternativa: Vercel Pro ($20/mês) + Neon | Processo Node 24/7 com Postgres no mesmo projeto, sem restrição de uso comercial (Vercel Hobby proíbe uso comercial) |

### Expected Features

#### Must Have (v1)
- Login individual (5 usuários, 2 papéis: colaborador/dono) com visibilidade por escopo
- Cadastro de empresas-cliente (regime tributário, responsável, particularidades) + importação da planilha existente com etapa de revisão
- Templates de obrigação por regime (ICMS, PIS/COFINS, SPED para Lucro Real; DAS para Simples Nacional) com prazo + regra de ajuste de dia útil/feriado
- Geração automática mensal de tarefas recorrentes (idempotente)
- Lista de tarefas filtrável ("minhas tarefas" / "todas as tarefas")
- Detalhe de tarefa: dados da empresa + passo a passo (mesmo que parcial inicialmente) + marcar como concluída
- Histórico de conclusões persistido (prazo previsto, data real, responsável) — base para os dashboards
- Tarefas avulsas (criação manual, atribuição livre)
- Alertas visuais in-app (prazo próximo/atrasado)
- Dashboard comparativo de desempenho por funcionário (no prazo vs atrasado)

#### Should Have (v1.x — após acumular dados)
- Dashboard de evolução mensal (precisa de 2-3 meses de histórico para ter valor)
- Dashboard comparativo entre empresas (mesma base de dados, nova visualização — diferencial genuíno, não encontrado em nenhum concorrente pesquisado)
- Completar passo a passo para todos os tipos de obrigação (esforço de conteúdo contínuo, não bloqueia lançamento)
- Refinamentos de alertas (ex.: "vencendo nos próximos 3 dias" agregado)

#### Defer (v2+)
- Notificações por email/WhatsApp
- Anexos/comprovantes de conclusão
- Regras de feriados estaduais/municipais e prazos por dígito final do CNPJ
- Execução remota das automações Python (tratar como milestone separado, não extensão do tracker)
- Portal do cliente

### Architecture Approach

**Monolito modular** (um deploy, um banco, módulos internos por responsabilidade): Auth, Empresas, Tarefas, Regras de Obrigação, Motor de Geração de Tarefas, Holiday/Business-Day Service, Dashboards.

Padrões centrais:
- **Regras de obrigação como dados** — tabela `regras_obrigacao` (`regime_tributario`, `tipo_obrigacao`, `dia_base`, `ajuste_dia_nao_util`), com tabela de associação regime↔obrigação extensível e suporte a override por empresa (`empresa_obrigacao_extra`/`excecao`) e histórico de mudança de regime (`empresa_regime_historico`).
- **Motor de geração mensal idempotente** — `(empresa_id, tipo_obrigacao, competencia)` UNIQUE + `INSERT ... ON CONFLICT DO NOTHING`; determinístico (mesma entrada → mesma saída).
- **RBAC simples** — enum `role` (`colaborador`/`dono`) + função central `withVisibilityScope()`; enforcement sempre no backend.
- **"Atrasado" como campo derivado**, nunca armazenado: `status === 'pendente' && prazo < hoje`.
- **Histórico de conclusões** (`historico_conclusoes`) como fonte única de verdade compartilhada pelos 3 dashboards — uma tabela, três agregações (por pessoa, por mês, por empresa).

Ordem de construção (dependência de dados, não de "valor isolado"):
`Auth + Empresas (importação)` → `Tarefas (modelo + avulsas + histórico)` → `Motor de Geração + Feriados/Dia Útil` → `Detalhe de Tarefa + Alertas` (paralelo ao anterior) → `Dashboards/Analytics`.

### Critical Pitfalls

1. **Geração duplicada de tarefas** — job mensal rodando 2x (redeploy, retry, clique manual). Mitigação: constraint UNIQUE `(empresa_id, tipo_obrigacao, competencia)` + `ON CONFLICT DO NOTHING`, sempre.
2. **Bug de timezone no job mensal** — servidor em UTC pode gerar tarefas no dia/mês errado. Mitigação: fixar `America/Sao_Paulo` explicitamente, calcular competência sempre nesse fuso, persistir datas como `DATE` (sem hora).
3. **Feriados hardcoded** — lista fixa de datas quebra silenciosamente no ano seguinte (feriados móveis dependem do cálculo da Páscoa). Mitigação: `date-holidays` ou algoritmo de Páscoa, nunca array fixo.
4. **Regra de ajuste antecipa vs adia errada** — DAS adia para o próximo dia útil; tributos federais (DARF) geralmente antecipam para o dia útil anterior. Aplicar uma regra única para todas as obrigações gera prazos errados. Mitigação: campo `regra_ajuste_prazo` por tipo de obrigação, validado contra calendário oficial (Receita Federal/Simples Nacional) com casos de teste reais.
5. **Modelo de regime tributário não extensível** — `if/else` por regime quebra quando uma empresa muda de regime ou surge um 3º regime/obrigação extra. Mitigação: modelar como dados (`tipos_obrigacao`, associação regime↔obrigação, histórico de regime por empresa).
6. **Dashboards lentos/enganosos com histórico crescente** — agregações ao vivo ficam lentas após meses; comparar contagens absolutas entre colaboradores com carteiras diferentes (Simples vs Lucro Real) gera ranking injusto. Mitigação: índices desde o início, snapshot mensal pré-calculado, comparar **percentuais** com contexto da carteira.
7. **Importação suja da planilha Excel** — CNPJs inconsistentes, sem campo de regime tributário (a planilha cobre só PIS/COFINS = Lucro Real), empresas inativas. Empresas sem regime ficam "invisíveis" (não geram tarefas). Mitigação: importação em duas etapas (staging + revisão humana), validação de CNPJ (módulo 11), relatório de importação.
8. **Autorização só na UI (IDOR)** — colaborador pode acessar dados de outro trocando IDs na URL/API. Mitigação: checagem de propriedade centralizada no backend em toda rota, testada via chamada de API direta.

## Implications for Roadmap

### Phase 1: Fundação — Autenticação, Empresas e Importação

- **Rationale:** Nada mais funciona sem usuários autenticados e sem o cadastro de empresas (regime + responsável). É a base de dados de que o motor de geração e os dashboards dependem.
- **Delivers:** Login individual (5 usuários) com Auth.js v5 Credentials + RBAC (`colaborador`/`dono`); CRUD de empresas (nome, CNPJ, regime, responsável, particularidades); importação da planilha "Controle pis e cofins.xlsx" em duas etapas (staging + revisão humana antes de persistir).
- **Addresses:** Pitfall 5 (modelo de regime extensível desde o schema), Pitfall 7 (importação suja — validação de CNPJ, relatório de importação, regime tributário obrigatório), Pitfall 8 (autorização enforced no backend desde o início).
- **Avoids:** RBAC genérico com tabelas roles/permissions (Anti-Pattern 3); importação "as is" sem revisão.
- **Uses:** Next.js 15.5 + Prisma 6 + PostgreSQL, Auth.js v5 + bcryptjs, xlsx 0.20.3 (CDN SheetJS), shadcn/ui.
- **Implements:** tabelas `usuarios`, `empresas`, `empresa_regime_historico`.

### Phase 2: Modelo de Tarefas, Tarefas Avulsas e Histórico

- **Rationale:** Construir o modelo de `tarefas` e a criação manual (avulsas) antes do motor automático testa o CRUD, status e histórico com dados reais, sem depender ainda do gerador mensal.
- **Delivers:** Tabela `tarefas` (status pendente/concluída, prazo, responsável, empresa opcional para avulsas), criação/atribuição de tarefas avulsas por qualquer membro da equipe, marcar como concluída, tabela `historico_conclusoes` (prazo previsto, data real, responsável).
- **Addresses:** dependência crítica apontada na pesquisa de features — o modelo de "evento de conclusão" precisa existir desde já para alimentar os 3 dashboards futuros.
- **Avoids:** campo `status='atrasado'` armazenado/calculado por job (Anti-Pattern 2) — atraso é sempre derivado na consulta/UI.
- **Uses:** Zod + React Hook Form para formulários de tarefa avulsa; TanStack Table para listas.
- **Implements:** tabelas `tarefas`, `historico_conclusoes`, com índices `(responsavel_id, status, prazo)` e `(empresa_id, tipo_obrigacao, competencia)`.

### Phase 3: Motor de Geração Mensal e Cálculo de Dia Útil/Feriados

- **Rationale:** Componente de maior risco do sistema; depende de Empresas (Fase 1) e do modelo de Tarefas (Fase 2) já existirem corretamente.
- **Delivers:** Tabela `regras_obrigacao` (regime × tipo de obrigação × dia base × regra de ajuste) com seed inicial (Lucro Real: ICMS/PIS-COFINS/SPED; Simples Nacional: DAS); serviço de feriados/dia útil (`date-holidays` + lógica de antecipar/adiar); job mensal idempotente que gera tarefas via `INSERT ... ON CONFLICT DO NOTHING`.
- **Addresses:** Pitfall 1 (duplicação — UNIQUE constraint testada com 2 execuções seguidas), Pitfall 2 (timezone — fuso `America/Sao_Paulo` explícito, testes em horários limítrofes), Pitfall 3 (feriados móveis calculados algoritmicamente, testados para múltiplos anos), Pitfall 4 (regra antecipa/adia por tipo de obrigação, validada contra calendário oficial).
- **Avoids:** `if/else` por regime no motor (Anti-Pattern 1); endpoint de geração sem proteção (Anti-Pattern 4 — exigir token de serviço).
- **Uses:** date-holidays, node-cron (ou Vercel Cron), endpoint protegido por `CRON_SECRET`/token.
- **Implements:** tabela `regras_obrigacao` + seed, módulo `feriados/`, módulo `geracao-tarefas/`.

### Phase 4: Detalhe de Tarefa, Passo a Passo e Alertas Visuais

- **Rationale:** Camada de UX sobre o modelo de `tarefas` já existente (Fase 2); pode evoluir em paralelo com a Fase 3, pois não depende do motor de geração — só da existência da tabela `tarefas`.
- **Delivers:** Tela de detalhe da tarefa (dados da empresa: CNPJ, regime, particularidades; passo a passo por tipo de obrigação, mesmo que inicialmente cobrindo 1-2 tipos; histórico de conclusões da empresa/obrigação); referência textual às automações Python existentes (link/instrução, sem execução); alertas visuais in-app (cores/badges para prazo próximo/atrasado, diferenciados por severidade/tipo de obrigação).
- **Addresses:** diferenciador "passo a passo conectado às automações Python" do PROJECT.md; UX pitfall de tratar todas as obrigações com a mesma urgência visual.
- **Uses:** shadcn/ui (badges, cards, dialogs), campo de instruções estruturado (texto/markdown) por `tipo_obrigacao`.
- **Implements:** campo de conteúdo "passo a passo" em `tipos_obrigacao` (ou tabela própria), componentes de alerta visual reutilizáveis.

### Phase 5: Dashboards Comparativos (Analytics)

- **Rationale:** Última fase — depende de `tarefas` + `historico_conclusoes` reais (gerados pelas fases 1-3 em uso) para ter dados significativos para agregar e validar visualmente.
- **Delivers:** Dashboard comparativo de desempenho por funcionário (% no prazo vs atrasado, com contexto da carteira); dashboard de evolução mensal (tendências ao longo do tempo); dashboard comparativo entre empresas (ranking de atrasos recorrentes).
- **Addresses:** Pitfall 6 (índices desde Fase 2 já preparam isso; aqui adicionar normalização por percentual + contexto de carteira; considerar snapshot mensal pré-calculado para estabilizar números de meses fechados).
- **Avoids:** ranking "cru" sem contexto (Goodhart's Law — métrica virar meta perversa).
- **Uses:** Recharts via `shadcn add chart`, queries agregadas (`GROUP BY`) sobre `tarefas`/`historico_conclusoes`.
- **Implements:** módulo `dashboards/`, possivelmente tabela/view de snapshot mensal.

### Phase Ordering Rationale

A ordem segue estritamente as dependências de **dados**, conforme a pesquisa de arquitetura: sem usuários e empresas (Fase 1), o motor de geração (Fase 3) não tem o que processar; sem o modelo de tarefas e histórico (Fase 2), nem o motor (Fase 3) nem os dashboards (Fase 5) têm onde escrever/ler. As Fases 3 e 4 podem avançar em paralelo após a Fase 2, pois a Fase 4 (UX de detalhe/alertas) só depende da tabela `tarefas` existir, não do motor automático já estar gerando dados. Os dashboards (Fase 5) ficam por último de propósito — são a "camada de valor" que o dono pediu como diferencial, mas só geram insumo real depois que o sistema já está em uso e acumulando `historico_conclusoes`.

### Research Flags

- **Validar a regra antecipa/adia por tipo de obrigação** (DAS, ICMS, PIS/COFINS, SPED) contra o calendário oficial vigente da Receita Federal/Simples Nacional antes de codificar `regras_obrigacao` na Fase 3 — não assumir por analogia entre obrigações.
- **Confirmar se Corpus Christi (ponto facultativo federal, mas tratado como feriado bancário em muitos casos) entra no cálculo de "dia útil" deste escritório** — decisão de produto a tomar antes/durante a Fase 3.
- **Verificar a estrutura real da planilha "Controle pis e cofins.xlsx"** antes da Fase 1: é praticamente certo que não existe campo de "regime tributário" pronto (a planilha cobre só PIS/COFINS = Lucro Real) e que as empresas de Simples Nacional **não estão nela** — precisarão ser cadastradas separadamente.
- **Reavaliar o custo real de hospedagem no Railway** após o primeiro mês em produção para confirmar a estimativa de $5-15/mês.
- **Cobertura de `date-holidays` para feriados móveis brasileiros** não foi verificada em código real (apenas documentação) — validar com testes unitários cobrindo Carnaval/Páscoa/Corpus Christi de pelo menos 2-3 anos diferentes.

## Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| Stack central (Next.js/Prisma/Auth.js/PostgreSQL/TypeScript) | HIGH | Verificado via documentação oficial e changelogs recentes |
| Bibliotecas de suporte (date-holidays, xlsx via CDN, shadcn, Recharts, Zod, RHF, TanStack) | HIGH-MEDIUM | Versões e padrões de integração confirmados; cobertura real de `date-holidays` para feriados móveis BR não testada em código |
| Escopo de features / MVP | MEDIUM-HIGH | Validado contra concorrentes brasileiros (G-Click, Confi, Acessórias) e internacionais (Karbon, TaxDome, Financial Cents) — converge com o PROJECT.md |
| Padrões de arquitetura (monolito modular, regras como dados, idempotência, RBAC simples, "atrasado" derivado) | HIGH | Padrões estabelecidos e estáveis, independentes de stack |
| Pitfalls de engenharia (duplicação, timezone, índices, IDOR) | HIGH | Padrões bem documentados na indústria |
| Pitfalls fiscais brasileiros específicos (regra antecipa vs adia por obrigação) | MEDIUM | Datas/regras mudam ano a ano e por norma — sempre validar contra calendário oficial vigente no momento da implementação |
| Custo de hospedagem (Railway $5-15/mês) | MEDIUM | Estimativa de terceiros; custo real depende de uso medido pós-deploy |

### Gaps to Address

- Validar regras de antecipação/postergação de prazo por tipo de obrigação (DAS, ICMS, PIS/COFINS, SPED) contra fonte oficial antes da Fase 3.
- Inspecionar a planilha "Controle pis e cofins.xlsx" real para mapear colunas existentes, identificar ausência do campo "regime tributário" e confirmar que empresas de Simples Nacional precisarão de cadastro separado.
- Decidir explicitamente se Corpus Christi (e outros pontos facultativos federais) contam como "dia não útil" para este escritório.
- Medir custo real de hospedagem no Railway após deploy inicial.

## Sources

### Primary
- [Next.js Blog — Next 15](https://nextjs.org/blog/next-15) / [Next 16](https://nextjs.org/blog/next-16) / [Guia de upgrade v16](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Prisma Docs — Next.js Guide](https://www.prisma.io/docs/guides/nextjs) / [Quickstart PostgreSQL](https://www.prisma.io/docs/getting-started/prisma-orm/quickstart/postgresql)
- [Auth.js — Role-Based Access Control](https://authjs.dev/guides/role-based-access-control) / [Reference Next.js](https://authjs.dev/reference/nextjs) / [Credentials Provider](https://next-auth.js.org/providers/credentials)
- [SheetJS — Instalação Node.js](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) / [CDN oficial](https://cdn.sheetjs.com/xlsx) / [npm xlsx (desatualizado)](https://www.npmjs.com/package/xlsx)
- [date-holidays (npm)](https://www.npmjs.com/package/date-holidays)

### Secondary
- [shadcn/ui — Chart component](https://ui.shadcn.com/docs/components/radix/chart) / [shadcn.io/charts](https://www.shadcn.io/charts)
- Hospedagem: [Vercel Pricing/Plans](https://vercel.com/docs/plans/hobby), [Railway Pricing](https://railway.com/pricing), [Render Pricing](https://render.com/pricing), [Neon Plans](https://neon.com/docs/introduction/plans)
- [TanStack Form/Table](https://tanstack.com/form), [shadcn TanStack Form forms](https://ui.shadcn.com/docs/forms/tanstack-form)
- Concorrentes BR: [Acessórias](https://acessorias.com/site/), [Confi](https://confi.net.br/), [G-Click/Omie](https://www.omie.com.br/gclick/)
- Concorrentes internacionais: [Karbon Tax](https://karbonhq.com/solution/tax/), [TaxDome blog](https://taxdome.com/blog/workflow-management-software-for-accountants), [Financial Cents](https://financial-cents.com/resources/articles/tax-workflow-software/), [Thomson Reuters ONESOURCE](https://tax.thomsonreuters.com/en/onesource/workflow-manager), [AKORE TaxCalendar](https://akoretax.com/), [Orbitax Due Date Tracker](https://orbitax.com/solutions/due-date-tracker)

### Tertiary
- [Idempotent Cron Jobs are Operable Cron Jobs](https://www.robustperception.io/idempotent-cron-jobs-are-operable-cron-jobs/), [Cronitor — duplicate cron prevention](https://cronitor.io/guides/how-to-prevent-duplicate-cron-executions)
- [Cron Timezones Explained](https://www.codeava.com/blog/cron-timezones-explained-utc-offset)
- [Vencimento de tributos federais em feriados/fins de semana — Portal Tributário](https://www.portaltributario.com.br/guia/vencimento-dos-tributos-em-feriados-sabados-ou-domingos.htm)
- [Calendário mensal do Simples Nacional — Conube](https://suporte.conube.com.br/como-%C3%A9-o-calend%C3%A1rio-mensal-de-apura%C3%A7%C3%B5es-do-simples-nacional)
- [Prazos EFD Contribuições — e-Auditoria](https://www.e-auditoria.com.br/blog/prazos-efd-contribuicoes-cumpra-os-prazos-sem-expor-seu-escritorio/)
- [RBAC com PostgreSQL em Next.js — Medium](https://medium.com/@nikitinal.nal/next-js-with-postgresql-role-based-access-control-implementation-ca024fd6d471)
- [Goodhart's Law and metrics](https://www.ilms.academy/blog/goodharts-law-the-danger-of-making-metrics-into-targets)

---
*Research completed: 2026-06-11*
*Ready for roadmap: yes*
