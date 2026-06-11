<!-- GSD:project-start source:PROJECT.md -->

## Project

**Agenda Fiscal**

Um site de gestão de tarefas para a equipe fiscal de um escritório de contabilidade: 4 colaboradores responsáveis por mais de 100 empresas-cliente, mais o dono do escritório como administrador com visão geral. O sistema gera automaticamente, todo mês, as tarefas recorrentes de cada empresa conforme seu regime tributário (ICMS, PIS/COFINS, SPED para Lucro Real; DAS para Simples Nacional), permite tarefas avulsas, e traz dashboards comparativos de desempenho.

**Core Value:** A equipe nunca perde um prazo fiscal de nenhum cliente, e o dono sempre sabe em tempo real o status de tudo.

### Constraints

- **Acesso**: precisa estar acessível pela internet — equipe pode acessar remotamente, não só do escritório
- **Autenticação**: login individual obrigatório para os 5 usuários (4 da equipe + dono), com permissões diferenciadas
- **Escala inicial**: ~100-110 empresas-cliente, 4 responsáveis fixos
- **Integração**: deve referenciar (não necessariamente executar) as ferramentas Python de automação existentes para ICMS e PIS/COFINS

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js** | 15.5.x (App Router) | Framework full-stack (frontend + backend numa coisa só) | Next.js 16 já é estável (lançado out/2025, 16.1 em dez/2025), mas trouxe mudanças disruptivas (Turbopack como default, `middleware.ts` → `proxy.ts`, cache explícito via `'use cache'`). Para um projeto único, mantido por uma pessoa via IA, **15.5 é a escolha mais segura**: Server Actions estáveis, App Router maduro, enorme volume de exemplos/treino disponíveis, e caminho de upgrade para 16 fica disponível depois que o app já estiver em produção e estável. Evita "yak-shaving" de bugs de ferramenta nova logo no v1. |
| **React** | 19.x | Biblioteca de UI (vem com Next 15.5) | Já é a versão suportada nativamente pelo Next 15; Server Components reduzem JS no cliente, importante para usuários não-técnicos numa rede de escritório possivelmente instável. |
| **TypeScript** | 5.x (strict) | Tipagem em todo o projeto | Com Prisma + Zod, o TypeScript dá tipos ponta a ponta (banco → API → formulário), reduzindo bugs de "campo errado" — crítico quando quem mantém é uma IA sem supervisão humana constante. |
| **PostgreSQL** | 16/17 (gerenciado) | Banco de dados relacional | Modelo de dados é claramente relacional (empresas, regimes, obrigações, tarefas, usuários, históricos) com muitos relacionamentos e necessidade de queries agregadas para dashboards (GROUP BY, janelas de tempo). SQLite seria mais simples mas não tem bom suporte a hospedagem multi-usuário concorrente pela internet com backups gerenciados. |
| **Prisma ORM** | 6.x | ORM / camada de acesso a dados | Schema declarativo (`schema.prisma`) é fácil de uma IA manter e versionar; gera migrations automaticamente; tipos TypeScript gerados a partir do schema eliminam drift entre banco e código. Prisma 7 já existe mas muda config de conexão (`prisma.config.ts`) — ficar em 6.x reduz instabilidade inicial. |
| **Auth.js (NextAuth) v5** | 5.x (`next-auth@beta` → release `auth`) | Autenticação + sessões | Suporta `Credentials Provider` (login com email/senha próprio, sem depender de Google/Microsoft — bom para equipe pequena que talvez não use contas corporativas Google/Microsoft). RBAC é feito via callbacks JWT/session, expondo `role` (`admin` vs `colaborador`) na sessão — exatamente o padrão necessário para "dono vê tudo, colaborador vê só o seu". |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **bcryptjs** (ou `@node-rs/bcrypt`) | ^2.4 | Hash de senha para login com Credentials Provider | Sempre — nunca guardar senha em texto plano. `bcryptjs` é puro JS (sem binários nativos), mais simples de rodar em qualquer host. |
| **date-holidays** | ^3.x | Cálculo de feriados nacionais brasileiros + dias úteis | Núcleo da regra "ajustar prazo para o próximo dia útil". Suporta `new Holidays('BR')`, método `isHoliday(date)`. Combinar com checagem de fim de semana (`getDay() === 0 \|\| 6`) para função `proximoDiaUtil(data)`. Biblioteca ativamente mantida, multi-país, boa cobertura de feriados móveis (Carnaval, Páscoa, Corpus Christi) que são os que mais geram bug em implementações caseiras. |
| **node-cron** (se self-host/Railway) **ou** Vercel Cron (se Vercel) | node-cron ^3.x | Disparo do job mensal "gerar tarefas recorrentes do mês" | Se hospedar num processo Node sempre ativo (Railway/VPS): `node-cron` roda dentro do próprio processo, sem infra extra — `0 6 1 * *` (todo dia 1 às 6h). Se hospedar serverless (Vercel): usar Vercel Cron (`vercel.json` + rota `/api/cron/gerar-tarefas`), respeitando limite de execução (10s no plano Hobby/Pro — a geração de ~100 empresas × poucas tarefas é leve o suficiente para caber nisso). **Não usar ambos** — escolher conforme decisão de hospedagem (ver seção Hospedagem abaixo). |
| **xlsx (SheetJS)** | 0.20.3 (via CDN do SheetJS, NÃO via npm puro) | Importação da planilha "Controle pis e cofins.xlsx" | A versão publicada no registro npm (`xlsx@0.18.5`) está desatualizada e tem vulnerabilidades conhecidas (DoS, prototype pollution) — o próprio SheetJS parou de publicar no npm. Instalar via tarball oficial: `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. Usado **uma vez** (script de importação inicial) e depois ocasionalmente se precisar reimportar/atualizar dados em lote. |
| **Recharts** (via shadcn `chart` component) | ^2.x / v3 (conforme shadcn) | Gráficos dos dashboards (comparativo entre funcionários, evolução mensal, comparativo entre empresas) | `npx shadcn@latest add chart` instala wrappers prontos (Area/Bar/Line/Pie) sobre Recharts, já estilizados com Tailwind/tema do shadcn. Evita escrever CSS de gráfico do zero; suficiente para os 3 tipos de dashboard pedidos (sem necessidade de algo mais pesado como D3). |
| **shadcn/ui** | latest (CLI-based, sem versão de pacote fixa) | Biblioteca de componentes (tabelas, formulários, cards, dialogs, badges de status) | Não é uma dependência tradicional — o CLI copia o código-fonte dos componentes para o projeto (`components/ui/*`). Isso é uma vantagem para manutenção por IA: o código do componente fica visível e editável localmente, sem "caixa preta" de node_modules. Construído sobre Radix UI (acessibilidade) + Tailwind CSS. |
| **Tailwind CSS** | 4.x | Estilização | Padrão de fato para projetos Next.js + shadcn em 2025/2026; classes utilitárias reduzem necessidade de arquivos CSS separados, o que ajuda a IA a editar estilos inline sem quebrar outros componentes. |
| **Zod** | ^3.x | Validação de dados (formulários + payloads de API/Server Actions) | Define o schema de "Empresa", "Tarefa", "Usuário" uma vez e reusa para validar formulários no cliente E dados recebidos no servidor (Server Actions). Integra nativamente com React Hook Form e com Prisma (tipos compatíveis). |
| **React Hook Form** | ^7.x | Gerenciamento de formulários | Padrão de mercado para forms em React; baixo overhead de re-render, integra com Zod via `@hookform/resolvers`. Necessário para formulários de cadastro de empresa, criação de tarefa avulsa, edição de usuário. |
| **TanStack Table** | ^8.x | Tabelas de dados (lista de empresas, lista de tarefas, lista de usuários) | Necessário para listas com 100+ empresas: paginação, ordenação e filtro client-side sem reimplementar lógica de tabela manualmente. Integra bem com componentes de tabela do shadcn. |
| **date-fns** | ^4.x | Manipulação de datas (formatação, soma de dias, comparação) | Complementa `date-holidays`; evita reinventar funções de data. Tree-shakeable (importa só o que usa), leve. Evitar `moment.js` (em modo manutenção/legado). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **Prisma Studio** (`npx prisma studio`) | Inspeção/edição visual do banco durante desenvolvimento | Útil para o próprio usuário (não-técnico) ou para a IA conferir/corrigir dados rapidamente sem escrever SQL. |
| **ESLint + Prettier** (config padrão do `create-next-app`) | Lint e formatação consistente | Mantém o código uniforme entre sessões diferentes de geração por IA, reduzindo "diffs de estilo" que poluem revisões. |
| **Git** (GitHub/GitLab privado) | Controle de versão + deploy automático | Push para `main` → deploy automático na plataforma de hospedagem escolhida (Railway/Vercel ambos suportam isso nativamente). |

## Installation

# Criar projeto base

# shadcn/ui

# Banco de dados / ORM

# Autenticação

# Validação e formulários

# Tabelas e datas

# Importação de Excel (instalar via CDN oficial, não via "xlsx" puro do npm)

# Cron (apenas se NÃO for usar Vercel Cron — ex: Railway/VPS com processo sempre ativo)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Next.js 15.5 (App Router) | Next.js 16.x | Se o projeto já estiver estável em produção e houver tempo dedicado para testar Turbopack/`proxy.ts`/cache explícito antes de migrar — ganho real de performance de build, mas não crítico para 5 usuários internos. |
| Next.js full-stack (monolito) | Backend separado (Express/Fastify + frontend separado React/Vite) | Só faria sentido se no futuro a equipe quiser expor uma API pública para terceiros ou integrar sistemas externos de forma mais robusta. Para 5 usuários e um único deploy, separar back/front só aumenta a superfície de manutenção. |
| Prisma | Drizzle ORM | Drizzle é mais leve e "SQL-like", preferido por quem já sabe SQL bem e quer controle fino de queries. Prisma foi preferido aqui pela DX de migrations automáticas e schema declarativo, mais fácil de uma IA manter de forma consistente ao longo de meses. |
| Auth.js (Credentials) | Clerk / Supabase Auth | Se no futuro quiser SSO (Google Workspace do escritório), recuperação de senha por email pronta, ou painel de gestão de usuários sem código. Para 5 usuários fixos cadastrados manualmente pelo admin, Auth.js com Credentials é suficiente e sem custo recorrente. |
| date-holidays | API externa de feriados (ex: BrasilAPI `/api/v1/feriados`) | BrasilAPI é uma alternativa gratuita e simples (`GET https://brasilapi.com.br/api/feriados/v1/{ano}`) que pode ser chamada uma vez por ano e cacheada no banco — vantagem: feriados nacionais sempre atualizados pela fonte oficial, sem depender de a lib estar com a tabela de anos futuros. **Pode ser usada como fonte de dados, com `date-holidays` como fallback offline.** |
| node-cron / Vercel Cron | Inngest / trigger.dev (job scheduling como serviço) | Se o sistema crescer e precisar de jobs mais complexos (retries, filas, jobs disparados por eventos), uma plataforma de jobs gerenciada vale a pena. Para "1 job simples 1x por mês", é overengineering. |
| Recharts (via shadcn) | Tremor / Chart.js / Nivo | Tremor é ótimo para dashboards "estilo SaaS" prontos, mas adiciona outra biblioteca de componentes concorrendo com shadcn. Chart.js é mais leve mas exige mais customização manual para o tema. Recharts via shadcn já resolve os 3 dashboards pedidos com menos código novo. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `npm install xlsx` (registro npm padrão) | Resolve para `xlsx@0.18.5`, não mantido há anos, com vulnerabilidades conhecidas de DoS e prototype pollution | Instalar via tarball oficial do SheetJS CDN (`xlsx-0.20.3.tgz`), conforme seção Installation |
| Vercel **Hobby** (free) para hospedar este projeto | Termos de uso da Vercel proíbem uso comercial/de negócio no plano Hobby — mesmo sendo uso "interno", é uso de uma empresa de contabilidade para suas operações, o que se enquadra como comercial | Vercel **Pro** ($20/mês) se escolher Vercel, **ou** Railway (ver Hospedagem abaixo), que não tem essa restrição nos planos pagos baratos |
| `moment.js` | Projeto em modo manutenção (não recebe novas features), bundle grande | `date-fns` (já recomendado) |
| Autenticação "caseira" sem biblioteca (sessões manuais, JWT manual) | Risco de erros sutis de segurança (timing attack em comparação de senha, expiração de sessão mal feita, CSRF) — perigoso quando ninguém vai revisar manualmente o código de auth linha a linha | Auth.js v5 com Credentials Provider, que já resolve sessão, CSRF e cookies de forma testada |
| Construir o motor de "próximo dia útil" do zero contando feriados manualmente em array fixo | Feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi) mudam de data todo ano; um array fixo desatualiza e quebra o sistema silenciosamente em janeiro do ano seguinte | `date-holidays` (cálculo automático de feriados móveis) ou BrasilAPI cacheada |
| Hospedar em "computador do escritório" / rede local com port-forward | Não atende ao requisito explícito de "acesso pela internet"; depende de o computador estar sempre ligado, IP residencial instável, sem HTTPS fácil, sem backup automático do banco | Hospedagem gerenciada (Railway ou Vercel+Neon, ver abaixo) |

## Stack Patterns by Variant

- App Next.js roda como processo Node 24/7 (`next start`, não serverless)
- Banco Postgres como serviço adicional no mesmo projeto Railway (rede privada interna, sem custo de egress entre eles)
- `node-cron` roda dentro do próprio processo Next.js (um arquivo `lib/scheduler.ts` iniciado no boot do servidor) para gerar as tarefas todo dia 1 do mês
- Custo estimado: Hobby plan ($5/mês de assinatura, cobre $5 de uso) + banco pequeno → tipicamente $5-15/mês total para esse volume (5 usuários, ~100 empresas, baixíssimo tráfego)
- Sem restrição de uso comercial
- App Next.js em modo serverless (padrão Vercel)
- Banco Postgres no Neon (free tier: 0.5 GB, scale-to-zero, integração nativa com Vercel — branch de banco por deploy)
- Geração mensal de tarefas via Vercel Cron (`vercel.json` com `"schedule": "0 6 1 * *"`, rota `/api/cron/gerar-tarefas`, protegida por `CRON_SECRET`)
- **Obrigatório plano Vercel Pro ($20/mês)** por causa da restrição de uso comercial do Hobby — Neon free tier pode continuar gratuito até passar de 0.5GB/100 CU-hours (não deve acontecer nessa escala)
- Cold start do Neon (300-500ms após 5 min idle) é imperceptível para 5 usuários internos

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `next@15.5.x` | `react@19.x`, `next-auth@5.x (beta)`, `prisma@6.x` | Combinação testada e amplamente documentada; Auth.js v5 ainda está em tag `beta` no npm mas é a versão recomendada para App Router (v4 não suporta App Router corretamente) |
| `prisma@6.x` | Node.js 18.18+ (recomendado 20+) | Verificar que o host (Railway) usa Node 20 LTS ou superior |
| `xlsx@0.20.3` (CDN) | Node.js qualquer versão recente | Build via tarball, sem dependências nativas — funciona igual em dev (Windows) e produção (Linux) |
| `date-holidays@3.x` | Nenhuma dependência de Node específica | Funciona client-side e server-side; rodar sempre server-side (Server Action/Server Component) para consistência |
| shadcn `chart` component | `recharts` (instalado automaticamente pelo CLI) | Não instalar `recharts` manualmente antes — deixar o CLI do shadcn resolver a versão compatível |

## Sources

- Next.js — blog oficial `nextjs.org/blog/next-15`, `nextjs.org/blog/next-16`, `nextjs.org/docs/app/guides/upgrading/version-16` — confirmação de que Next 15.5 é a última da série 15 e Next 16 trouxe breaking changes (Turbopack default, `proxy.ts`, cache explícito) — **HIGH**
- Prisma — `prisma.io/docs/guides/nextjs`, `prisma.io/docs/getting-started/prisma-orm/quickstart/postgresql`, GitHub releases — confirma Prisma 6.x estável, Prisma 7 muda config de conexão — **HIGH**
- Auth.js — `authjs.dev/guides/role-based-access-control`, `authjs.dev/reference/nextjs`, `next-auth.js.org/providers/credentials` — padrão RBAC via callbacks JWT/session com Credentials Provider — **HIGH**
- SheetJS — `docs.sheetjs.com/docs/getting-started/installation/nodejs/`, `cdn.sheetjs.com/xlsx`, npmjs.com/package/xlsx — confirma que `xlsx` no registro npm está desatualizado/vulnerável (0.18.5) e que a versão atual (0.20.3) deve vir do CDN oficial — **HIGH**
- date-holidays — `npmjs.com/package/date-holidays`, Socket.dev — confirma suporte a Brasil (BR + estados) e necessidade de combinar `isHoliday()` com checagem de fim de semana — **MEDIUM** (não verificado em código real, apenas documentação/descrição do pacote)
- shadcn/ui charts — `ui.shadcn.com/docs/components/radix/chart`, `shadcn.io/charts` — confirma `npx shadcn add chart` sobre Recharts v3 — **MEDIUM**
- Hospedagem — Vercel (`vercel.com/docs/plans/hobby`, termos de serviço), Railway (`railway.com/pricing`, `docs.railway.com/reference/pricing/plans`), Render (`render.com/pricing`), Neon (`neon.com/docs/introduction/plans`) — confirma restrição de uso comercial no plano Hobby da Vercel e estimativa de custo $5-15/mês no Railway Hobby para apps de baixíssimo tráfego — **MEDIUM** (custo real depende de uso medido pós-deploy, estimativas de blogs de terceiros variam bastante)
- TanStack Form/Table, React Hook Form, Zod — `tanstack.com/form`, `ui.shadcn.com/docs/forms/tanstack-form` — confirma padrão de integração Zod + React Hook Form + shadcn em 2025/2026 — **MEDIUM**

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
