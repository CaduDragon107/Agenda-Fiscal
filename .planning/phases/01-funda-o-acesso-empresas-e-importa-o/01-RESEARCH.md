# Phase 1: Fundação — Acesso, Empresas e Importação - Research

**Researched:** 2026-06-11
**Domain:** Autenticação multiusuário (Auth.js v5 + Credentials), RBAC com escopo de visibilidade (Prisma + PostgreSQL), CRUD de empresas-cliente, importação de planilha Excel (SheetJS) com revisão humana, deploy Next.js 15 + Postgres no Railway
**Confidence:** HIGH (stack central, padrões de auth/RBAC, deploy Railway, e estrutura real da planilha "Lista de Empresas com CNPJ.xlsx" — inspecionada diretamente pelo orquestrador nesta sessão, ver Pattern 3.5)

## Summary

Esta fase estabelece a fundação de todo o sistema: autenticação individual para 5 usuários (4 colaboradores + dono) com Auth.js v5 (Credentials Provider + JWT session), um padrão central de escopo de visibilidade ("colaborador vê só sua carteira, dono vê tudo") **enforced no backend** via uma função reutilizável de query-scoping sobre Prisma, o schema inicial de `usuarios` e `empresas` (com `regime_tributario` e histórico de regime preparado para extensibilidade), um wizard de importação de planilha em 3 etapas (upload → staging/revisão → confirmação) usando SheetJS via CDN oficial, e o deploy inicial no Railway com PostgreSQL gerenciado e URL pública.

A pesquisa de projeto (SUMMARY/STACK/ARCHITECTURE/PITFALLS.md) já definiu a stack e os padrões arquiteturais de alto nível; esta pesquisa de fase aprofunda os detalhes de implementação concretos: configuração exata do `auth.ts` (Auth.js v5) com `authorize()` + bcrypt + callbacks JWT/session expondo `role`; o padrão `withVisibilityScope()` como uma função central que recebe `session.user` e retorna um `where` clause do Prisma; o schema Prisma para `Usuario` (enum `Role`) e `Empresa` (enum `RegimeTributario`, FK `responsavelId`, tabela `EmpresaRegimeHistorico` para suportar mudança de regime sem reescrever histórico); o fluxo SheetJS (ler `.xlsx` no servidor via `XLSX.read()` / `sheet_to_json()`, popular uma tabela de staging em memória/sessão, validar CNPJ via módulo 11, e só persistir após confirmação); e os passos exatos de deploy no Railway (`output: "standalone"`, variável `DATABASE_URL` referenciada do serviço Postgres, pre-deploy command `npx prisma migrate deploy`, domínio público `*.up.railway.app`).

**RESOLVIDO nesta sessão pelo orquestrador:** O arquivo `Lista de Empresas com CNPJ.xlsx` (raiz do projeto, ~21KB) foi inspecionado diretamente via PowerShell (leitura do ZIP/XML interno do `.xlsx` — `xl/worksheets/sheet1.xml` + `xl/sharedStrings.xml`), sem depender de Node/SheetJS. A estrutura completa (2 blocos de colunas, 3 seções de regime tributário, 198 empresas) está documentada no **Pattern 3.5** abaixo. O bloqueio original ("sessão de pesquisa sem ferramenta de execução") está superado — `scripts/inspect-planilha.mjs` (Wave 0) ainda deve ser criado, mas agora como **validação programática** do mapeamento já conhecido (rodar `XLSX.readFile()` e confirmar os 198 registros nas posições esperadas), não como descoberta exploratória.

**Primary recommendation:** Implemente Auth.js v5 com Credentials Provider + Prisma adapter apenas para sessão (NÃO usar PrismaAdapter para credentials — ele não suporta esse fluxo nativamente; usar JWT strategy com `authorize()` consultando `usuarios` diretamente via Prisma + bcrypt), centralize toda regra de visibilidade em uma única função `withVisibilityScope()` testada por API direta (não apenas UI), modele `empresas` com `regime_tributario` enum + tabela de histórico desde o início, e trate a importação como staging-then-confirm com inspeção real da planilha como primeira tarefa de execução.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login / autenticação (AUTH-01) | API/Backend (Server Actions + Auth.js) | Browser (formulário, cookie de sessão) | Credenciais validadas e hash de senha comparado server-side; cookie de sessão JWT gerenciado por Auth.js, lido pelo middleware/proxy |
| Sessão persistente entre navegações | Frontend Server (SSR) | Browser (cookie HTTP-only) | Auth.js v5 `auth()` roda em Server Components/Server Actions/middleware; cookie assinado persiste no browser |
| Escopo de visibilidade colaborador vs dono (AUTH-02) | API/Backend (camada de dados/Prisma) | — | Toda query que retorna empresas/tarefas DEVE passar por `withVisibilityScope()` no servidor — nunca confiar em filtro client-side |
| CRUD de empresas (EMPR-01) | API/Backend (Server Actions) | Browser (formulário React Hook Form + Zod) | Validação client-side é UX; validação e persistência reais (incluindo módulo 11 do CNPJ) ocorrem no servidor |
| Importação de planilha — parsing (EMPR-02) | API/Backend (Server Action / Route Handler) | — | SheetJS roda server-side sobre o arquivo enviado (upload), evita expor parsing pesado ao cliente e mantém consistência com validação server-side |
| Importação de planilha — staging/revisão (EMPR-02) | Browser (TanStack Table editável) | API/Backend (endpoint de confirmação) | Dados staged ficam temporariamente acessíveis para edição inline no cliente; persistência definitiva só ocorre na etapa "Confirmar importação" |
| Banco de dados (`usuarios`, `empresas`, histórico de regime) | Database/Storage (PostgreSQL via Prisma) | — | Fonte única de verdade; schema deve já suportar extensibilidade de regime (Pitfall 5) |
| Acesso público pela internet (INFRA-01) | CDN/Static + Frontend Server | Database/Storage (Postgres gerenciado) | Railway hospeda o processo Next.js (`next start` standalone) + Postgres no mesmo projeto; domínio público gerado automaticamente |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.x (App Router) | Framework full-stack | Já decidido no PROJECT.md/CLAUDE.md — Server Actions estáveis, evita breaking changes do Next 16 `[CITED: nextjs.org/blog/next-15-5]` |
| React | 19.x | UI library (vem com Next 15.5) | Versão mínima exigida pelo Next 15 App Router `[CITED: nextjs.org/docs/app/guides/upgrading/version-15]` |
| TypeScript | 5.x (strict) | Tipagem ponta a ponta | Já decidido — Prisma + Zod dão tipos banco→API→form |
| PostgreSQL | 16/17 (Railway managed) | Banco relacional | Já decidido — suporta multiusuário concorrente + agregações para dashboards futuros |
| Prisma ORM | 6.x | ORM / schema declarativo | Já decidido — migrations automáticas, tipos TS gerados |
| next-auth (Auth.js v5) | `5.0.0-beta.x` (tag `beta` no npm) | Autenticação Credentials + RBAC via JWT | v5 é a única versão com suporte correto a App Router; ainda em tag `beta` mas amplamente usada em produção `[ASSUMED — versão exata não confirmada via npm view nesta sessão; ver Package Legitimacy Audit]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| bcryptjs | ^3.x (verificar — última publicada é 3.0.3, mais recente que `^2.4` citado no CLAUDE.md) | Hash de senha para Credentials Provider | Sempre, no `authorize()` callback e no script de seed dos 5 usuários `[ASSUMED — versão obtida via WebSearch, não verificada em registry nesta sessão]` |
| @auth/prisma-adapter | 2.x (compatível com next-auth@5 beta) | Adapter Prisma para Auth.js | **Discretion:** com Credentials + JWT strategy, o adapter de banco NÃO é estritamente necessário (sessão fica no JWT, não na tabela `Session`). Recomendação: **omitir o adapter** nesta fase — usar `authorize()` consultando Prisma diretamente + `session`/`jwt` callbacks. Reavaliar se v2 precisar de "logout em todos os dispositivos" (sessão em banco) `[ASSUMED]` |
| zod | ^3.x (CLAUDE.md) ou v4 (ecossistema já migrou) | Validação de formulários + Server Actions | **Discretion/flag:** Zod 4 é ~2x menor e mais rápido, mas tem breaking changes vs v3. CLAUDE.md especifica `^3.x`. Recomendação: seguir CLAUDE.md (`^3.x`) para esta fase — migração para v4 é decisão de produto separada, não bloqueante `[CITED: zod.dev/v4/changelog — confirma breaking changes]` |
| react-hook-form | ^7.x (latest 7.78.x) | Formulários (login, empresa create/edit, import review) | Padrão já decidido; usar com `@hookform/resolvers/zod` |
| @tanstack/react-table | ^8.x | Tabela de empresas + tabela de staging editável da importação | Padrão já decidido; ver Pattern "Editable Cells" abaixo |
| xlsx (SheetJS) | 0.20.3 (via CDN oficial, NÃO npm) | Parse server-side da planilha `.xlsx` | Já decidido no CLAUDE.md — `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` `[CITED: docs.sheetjs.com/docs/getting-started/installation/nodejs/]` |
| date-fns | ^4.x | Formatação de datas (não crítico nesta fase, mas usado em "criado em"/"atualizado em") | Padrão já decidido |
| shadcn/ui (CLI) | latest | Componentes (form, table, dialog, badge, sonner, etc.) | Já decidido e documentado no UI-SPEC — preset New York / Neutral / lucide-react |
| Tailwind CSS | 4.x | Estilização | Já decidido, instalado via `create-next-app` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auth.js v5 Credentials + JWT (sem adapter de banco) | Auth.js v5 Credentials + PrismaAdapter + database sessions | Database sessions permitem "logout remoto"/revogação imediata, mas adicionam tabela `Session`/`Account`/`VerificationToken` desnecessárias para Credentials puro (PrismaAdapter foi desenhado primariamente para OAuth). JWT é suficiente para 5 usuários internos; reavaliar só se requisito de segurança mudar |
| `withVisibilityScope()` como função utilitária | Row-Level Security (RLS) no PostgreSQL | RLS é mais "à prova de esquecimento" (aplicado no banco, não no código), mas adiciona complexidade de configuração de roles de banco por usuário da aplicação — overkill para 2 papéis e Prisma sem suporte nativo de primeira classe a RLS multiusuário-por-app-user. Função central + testes de API direta é suficiente e mais simples de auditar |
| SheetJS server-side parsing | Parsing client-side (`FileReader` + `XLSX.read` no browser) | Client-side evitaria upload do arquivo ao servidor antes da validação, mas (a) a planilha real provavelmente tem ~100 linhas — trivial para upload, e (b) validação de CNPJ/duplicatas/regras de negócio deve rodar no servidor de qualquer forma antes de qualquer persistência. Server-side parsing mantém uma única fonte de validação |

**Installation:**
```bash
# Projeto base (já especificado no UI-SPEC)
npx create-next-app@latest agenda-fiscal --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd agenda-fiscal

# shadcn/ui
npx shadcn@latest init -d
npx shadcn@latest add button card table dialog form input label badge select textarea separator dropdown-menu sonner alert tabs checkbox skeleton alert-dialog sidebar avatar

# Prisma + Postgres
npm install prisma @prisma/client
npx prisma init --datasource-provider postgresql

# Auth.js v5 + bcrypt
npm install next-auth@beta
npm install bcryptjs
npm install -D @types/bcryptjs

# Validação e formulários
npm install zod react-hook-form @hookform/resolvers

# Tabelas
npm install @tanstack/react-table

# Importação Excel — via CDN oficial SheetJS, NÃO "npm install xlsx" puro
npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
```

**Version verification:** Antes de gerar o `package.json` definitivo, executar:
```bash
npm view next-auth@beta version
npm view bcryptjs version
npm view prisma version
npm view @tanstack/react-table version
npm view zod version
```
Os valores acima (`5.0.0-beta.x`, `bcryptjs ^3.x`, etc.) foram obtidos via WebSearch nesta sessão e **não foram confirmados via `npm view`** (sem ferramenta de execução disponível nesta sessão de pesquisa) — tratar como `[ASSUMED]` até o executor rodar esses comandos no Wave 0.

## Package Legitimacy Audit

> Esta sessão de pesquisa não teve acesso a ferramenta de execução de comandos (sem Bash/shell), portanto `gsd-tools query package-legitimacy check` e `npm view` não puderam ser executados. Todos os pacotes abaixo são pacotes amplamente conhecidos e estabelecidos (confirmados por múltiplas fontes WebSearch independentes — npm registry pages, GitHub releases, Snyk/Socket.dev), mas a tabela abaixo reflete status `[ASSUMED]` para verificação formal de registry. **O planner deve inserir uma tarefa `checkpoint:human-verify` (ou equivalente: rodar `npm view <pkg> version` e `npm view <pkg> scripts.postinstall`) antes do `npm install` em massa no Wave 0.**

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| next-auth (`@beta` tag = v5) | npm | anos (pacote estabelecido, v5 em beta há tempo) | muito alto (milhões/semana) | github.com/nextauthjs/next-auth | [ASSUMED — não verificado via npm view] | Manter — verificar versão exata no Wave 0 |
| @auth/prisma-adapter | npm | anos | alto | github.com/nextauthjs/next-auth (monorepo) | [ASSUMED] | **Avaliar se será usado** — recomendação é omitir nesta fase (ver Supporting Libraries) |
| bcryptjs | npm | anos (pacote maduro) | muito alto | github.com/dcodeIO/bcrypt.js (ou kelektiv fork) | [ASSUMED] | Manter — confirmar versão `^2.4` (CLAUDE.md) vs `^3.x` (mais recente) no Wave 0 |
| prisma / @prisma/client | npm | anos | muito alto | github.com/prisma/prisma | [ASSUMED] | Manter — confirmar `6.x` ainda é a major recomendada (Prisma 7 já existe, ver CLAUDE.md) |
| @tanstack/react-table | npm | anos | muito alto | github.com/TanStack/table | [ASSUMED] | Manter |
| zod | npm | anos | muito alto | github.com/colinhacks/zod | [ASSUMED] | Manter — confirmar `^3.x` vs v4 com o usuário (flag de discretion) |
| react-hook-form | npm | anos | muito alto | github.com/react-hook-form/react-hook-form | [ASSUMED] | Manter |
| @hookform/resolvers | npm | anos | alto | github.com/react-hook-form/resolvers | [ASSUMED] | Manter |
| xlsx (SheetJS, via CDN tarball, NÃO npm registry) | CDN cdn.sheetjs.com (não npm) | pacote maduro, CDN mantido pelo autor original do SheetJS | N/A (CDN, não medido por downloads npm) | github.com/SheetJS/sheetjs | [OK — fonte oficial confirmada por CLAUDE.md e docs.sheetjs.com] | Aprovado — **NUNCA** `npm install xlsx` puro (resolve para 0.18.5, vulnerável) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none — todos são pacotes estabelecidos e amplamente reconhecidos, mas nenhum foi formalmente verificado via `npm view`/`gsd-tools query package-legitimacy check` nesta sessão por falta de ferramenta de execução.

**Ação obrigatória para o planner:** adicionar uma tarefa inicial (Wave 0) do tipo `checkpoint:human-verify` ou tarefa automatizada que rode `npm view <pkg> version` para cada pacote acima antes do primeiro `npm install`, registrando as versões reais resolvidas no `package.json`.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                              │
│  /login (form email+senha) ──► Server Action signIn()                │
│  /empresas (TanStack Table)  ──► Server Component (lê sessão+dados)  │
│  /empresas/novo|[id]/editar  ──► Server Action create/update         │
│  /empresas/importar (wizard) ──► Server Actions (parse/stage/confirm)│
└───────────────┬────────────────────────────────────────────────────┘
                 │ cookie de sessão JWT (Auth.js)
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  NEXT.JS APP SERVER (Railway, processo Node 24/7, output: standalone)│
│                                                                        │
│  proxy.ts / middleware ──► auth() ──► redireciona /login se sem sessão│
│                                                                        │
│  ┌──────────────┐   ┌────────────────────┐   ┌──────────────────┐   │
│  │ Auth Module  │   │ Empresas Module     │   │ Import Module     │   │
│  │ auth.ts      │   │ - actions.ts (CRUD) │   │ - parse (SheetJS) │   │
│  │ authorize()  │   │ - withVisibility    │   │ - staging (memory │   │
│  │ + bcrypt     │   │   Scope()           │   │   /sessionStorage)│   │
│  │ JWT/session  │   │                     │   │ - confirm (bulk   │   │
│  │ callbacks    │   │                     │   │   insert)         │   │
│  │ (role)       │   │                     │   │                   │   │
│  └──────┬───────┘   └──────────┬──────────┘   └─────────┬─────────┘   │
│         │                      │                         │             │
│         └──────────────────────┴───────────┬─────────────┘             │
│                                              ▼                          │
│                                   Prisma Client (db.ts singleton)       │
└──────────────────────────────────────────────┬───────────────────────┘
                                                 │ DATABASE_URL (Railway ref var)
                                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  POSTGRESQL (Railway managed service, mesmo projeto, rede privada)    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐            │
│  │ usuarios │  │ empresas │  │ empresa_regime_historico  │            │
│  └──────────┘  └──────────┘  └──────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

A primary use case ("colaborador faz login e vê só suas empresas") flui: Browser → Server Action `signIn()` → Auth Module valida credenciais via Prisma + bcrypt → JWT/session callback injeta `role` e `id` → cookie de sessão volta ao Browser → próxima navegação para `/empresas` → Server Component lê `auth()` → chama `withVisibilityScope(session.user)` → Prisma `findMany({ where })` retorna apenas empresas do `responsavelId === session.user.id` (ou todas, se `role === 'dono'`) → TanStack Table renderiza.

### Recommended Project Structure

```
src/
├── app/
│   ├── login/
│   │   └── page.tsx              # Formulário de login (Server Component + Server Action)
│   ├── (app)/                    # Route group autenticado
│   │   ├── layout.tsx            # Sidebar + verificação de sessão
│   │   ├── empresas/
│   │   │   ├── page.tsx          # Lista (TanStack Table, escopo aplicado)
│   │   │   ├── novo/page.tsx     # Criar empresa
│   │   │   ├── [id]/editar/page.tsx
│   │   │   └── importar/
│   │   │       ├── page.tsx      # Wizard shell (3 steps)
│   │   │       └── _components/  # StepUpload, StepReview, StepConfirm
│   │   └── actions.ts            # Server Actions de empresas (CRUD + import)
│   └── api/auth/[...nextauth]/route.ts
├── auth.ts                        # Config Auth.js v5 (Credentials, callbacks)
├── proxy.ts                        # (ou middleware.ts no Next 15) — proteção de rotas
├── lib/
│   ├── db.ts                      # Prisma Client singleton
│   ├── visibility-scope.ts        # withVisibilityScope() — núcleo do AUTH-02
│   ├── cnpj.ts                    # Validação módulo 11 + máscara
│   └── excel/
│       └── parse-empresas.ts      # SheetJS: ler .xlsx → linhas normalizadas
├── modules/
│   └── empresas/
│       ├── schema.ts              # Zod schemas (Empresa, ImportRow)
│       └── queries.ts             # Funções de leitura usando withVisibilityScope
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                    # Seed dos 5 usuários (bcrypt hash)
└── scripts/
    └── inspect-planilha.mjs       # Wave 0: inspeciona "Lista de Empresas com CNPJ.xlsx"
```

### Pattern 1: Auth.js v5 Credentials Provider com role no JWT/session

**What:** Configurar `auth.ts` na raiz do projeto exportando `{ handlers, auth, signIn, signOut }` via `NextAuth({...})`. O provider `Credentials` define `authorize(credentials)` que busca o usuário no Prisma por email, compara senha com `bcrypt.compare()`, e retorna um objeto `{ id, name, email, role }` (ou `null` se inválido). Os callbacks `jwt` e `session` propagam `role` e `id` do usuário para o token/sessão.

**When to use:** Sempre, para login email/senha dos 5 usuários (AUTH-01).

**Example:**
```typescript
// Source: pattern derivado de authjs.dev/getting-started/migrating-to-v5 + 
// authjs.dev/guides/role-based-access-control [CITED + ASSUMED — código combinado/sintetizado, não copiado de um único exemplo]

// auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const usuario = await db.usuario.findUnique({
          where: { email: credentials.email as string },
        });
        if (!usuario) return null;

        const senhaValida = await bcrypt.compare(
          credentials.password as string,
          usuario.senhaHash
        );
        if (!senhaValida) return null;

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          role: usuario.role, // 'colaborador' | 'dono'
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

```typescript
// app/api/auth/[...nextauth]/route.ts
// Source: authjs.dev/getting-started/migrating-to-v5 [CITED]
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

**Sessão persistente entre reinícios do navegador (AUTH-01):** com `session: { strategy: "jwt" }`, o cookie de sessão tem por padrão duração de 30 dias (configurável via `session.maxAge`) e persiste entre fechamentos do navegador (não é "session cookie" de aba) — atende ao requisito "permanece autenticado entre sessões do navegador" sem necessidade de checkbox "lembrar-me" (já definido no UI-SPEC).

### Pattern 2: `withVisibilityScope()` — escopo central de visibilidade (AUTH-02)

**What:** Uma função utilitária pura que recebe o usuário da sessão (`{ id, role }`) e retorna um objeto `where` do Prisma a ser espalhado em qualquer `findMany`/`findFirst` sobre `empresas` (e, em fases futuras, `tarefas`). Para `role === 'dono'`, retorna `{}` (sem filtro). Para `role === 'colaborador'`, retorna `{ responsavelId: usuario.id }`.

**When to use:** Em TODA query de leitura de `empresas` (e tarefas, em fases futuras) que vier de uma página/Server Action acessível por colaborador. Nunca aplicar o filtro só na UI.

**Example:**
```typescript
// Source: padrão sintetizado a partir de discussões de RBAC com Prisma
// (medium.com/@nikitinal.nal/next-js-with-postgresql-role-based-access-control...) [CITED + ASSUMED]

// lib/visibility-scope.ts
import type { Prisma } from "@prisma/client";

type SessionUser = { id: string; role: "colaborador" | "dono" };

export function withVisibilityScope(
  user: SessionUser
): Prisma.EmpresaWhereInput {
  if (user.role === "dono") {
    return {}; // sem restrição — vê tudo
  }
  return { responsavelId: user.id };
}

// Uso em uma query:
// const empresas = await db.empresa.findMany({
//   where: { ...withVisibilityScope(session.user), ...filtrosDeUI },
// });
```

**Crítico (Pitfall 8 / IDOR):** toda Server Action ou Route Handler que recebe um `empresaId` (ex.: editar/excluir empresa) deve, ANTES de qualquer `update`/`delete`, fazer um `findFirst({ where: { id: empresaId, ...withVisibilityScope(session.user) } })` — se retornar `null`, responder como "não encontrado" (404), não 403, para não vazar a existência do recurso. Isso garante que um colaborador não possa editar/excluir empresa de outro colaborador mesmo manipulando a URL/payload.

**Teste obrigatório:** logar como colaborador A, tentar `editarEmpresa(idDeEmpresaDoColaboradorB)` via chamada direta da Server Action (não pela UI) — deve falhar.

### Pattern 3: Schema Prisma — `usuarios`, `empresas`, histórico de regime

**What:** Schema inicial que já modela `regime_tributario` como enum extensível e prepara histórico de mudança de regime, conforme Pitfall 5 do PITFALLS.md (mesmo que o v1 só popule 2 regimes).

**When to use:** Definição do `schema.prisma` — primeira migration da Fase 1.

**Example:**
```prisma
// Source: padrão sintetizado a partir de prisma.io/docs/guides/nextjs +
// research/ARCHITECTURE.md (Pattern 1: Regras de Obrigação como Dados) [CITED + ASSUMED]

enum Role {
  COLABORADOR
  DONO
}

enum RegimeTributario {
  LUCRO_REAL
  LUCRO_PRESUMIDO
  SIMPLES_NACIONAL
}

model Usuario {
  id        String   @id @default(cuid())
  nome      String
  email     String   @unique
  senhaHash String
  role      Role     @default(COLABORADOR)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  empresas  Empresa[] @relation("ResponsavelEmpresa")

  @@map("usuarios")
}

model Empresa {
  id               String            @id @default(cuid())
  nome             String
  cnpj             String            @unique
  regimeTributario RegimeTributario
  responsavelId    String
  responsavel      Usuario           @relation("ResponsavelEmpresa", fields: [responsavelId], references: [id])
  contatos         String?
  particularidades String?
  ativo            Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  regimeHistorico  EmpresaRegimeHistorico[]

  @@index([responsavelId])
  @@index([regimeTributario])
  @@map("empresas")
}

// Pitfall 5: histórico de regime — preparado desde já, mesmo que
// o v1 só registre 1 entrada por empresa (regime atual = data_inicio = createdAt)
model EmpresaRegimeHistorico {
  id               String            @id @default(cuid())
  empresaId        String
  empresa          Empresa           @relation(fields: [empresaId], references: [id])
  regimeTributario RegimeTributario
  dataInicio       DateTime
  dataFim          DateTime?

  @@index([empresaId, dataInicio])
  @@map("empresa_regime_historico")
}
```

**Nota:** o campo `senhaHash` nunca deve ser retornado em queries usadas para a sessão/UI — usar `select` explícito (omitir `senhaHash`) em todas as queries fora de `authorize()`.

### Pattern 3.5: Estrutura real da planilha `Lista de Empresas com CNPJ.xlsx` (inspeção direta — resolve Pitfall 3 e Open Question 1)

**What:** Inspeção direta do arquivo `Lista de Empresas com CNPJ.xlsx` (raiz do projeto, ~21KB) feita pelo orquestrador nesta sessão via PowerShell + `System.IO.Compression.ZipFile`, lendo `xl/worksheets/sheet1.xml` e `xl/sharedStrings.xml` (um `.xlsx` é um ZIP de XMLs — não precisa de Node/SheetJS para inspecionar). Resultado: **uma única aba** ("Planilha1", dimensão `A1:K157`, 400 strings compartilhadas), montada manualmente como lista de controle (não é export de sistema) — **dois blocos de tabela lado a lado, sem cabeçalho único reutilizável**, com seções de regime tributário marcadas por linhas-label dentro das próprias colunas de nome.

**Bloco 1 (colunas A=Cod, B=Nome, C=CNPJ):**
- Linha 1: `A1="Cod"`, `B1="LUCRO REAL"` (label de seção, não cabeçalho de coluna), `C1="CNPJ"`
- Linhas 3-70: seção **LUCRO REAL** — 61 empresas
- Linha 71: `B71="SIMPLES NACIONAL"` (novo label de seção)
- Linhas 72-157: seção **SIMPLES NACIONAL** — 80 empresas (linhas 148-156 têm `Cod` vazio — parecem pessoas físicas/MEI, mas têm Nome+CNPJ válidos)

**Bloco 2 (colunas E=Cod, F=Nome, G=CNPJ — mesma aba, à direita do Bloco 1):**
- Linhas 3-9: 7 empresas SEM label de seção antes delas (nomes "Sup. Dorothea", "Sup. Elimar", "Sup. Fernando", "Sup. Maia", "Sup. Oliveira", "Sup. Rilu", "Sup. Zezão" — aparentam ser supermercados/varejo; regime não determinável pela posição)
- Linha 19: `F19="LUCRO PRESUMIDO"` (label de seção)
- Linhas 21-39 + 73-103: seção **LUCRO PRESUMIDO** — 50 empresas

Colunas D, H, I, J, K: completamente vazias. Todos os CNPJs são strings de texto já formatadas `XX.XXX.XXX/XXXX-XX` (confirmado via shared-strings — nenhuma célula numérica crua de 8+ dígitos encontrada).

**Totais confirmados (198 empresas):**

| Regime | Empresas |
|--------|----------|
| LUCRO_REAL | 61 |
| SIMPLES_NACIONAL | 80 |
| LUCRO_PRESUMIDO | 50 |
| Sem regime identificável (7 "Sup. X") | 7 |
| **TOTAL** | **198** |

**When to use:** Define o mapeamento real de `parseEmpresasXlsx()` (Pattern 4) e o enum `RegimeTributario` (Pattern 3, já ajustado para 3 valores).

**Implicações diretas:**

1. **`RegimeTributario` precisa de 3 valores desde o v1** (`LUCRO_REAL`, `LUCRO_PRESUMIDO`, `SIMPLES_NACIONAL`), não 2 — Pattern 3 já foi atualizado. O enum continua extensível (suporta valores futuros), mas o import já popula os 3.
2. **Pitfall 4 está PARCIALMENTE INVALIDADO**: Simples Nacional não está ausente — é o MAIOR grupo (80/198, ~40%). A hipótese de "planilha cobre majoritariamente Lucro Real" vinha de research/SUMMARY.md, que se referia a "Controle pis e cofins.xlsx" (outro arquivo, com outro propósito — controle mensal de PIS/COFINS, obrigação de Lucro Real/Presumido). Para `Lista de Empresas com CNPJ.xlsx`, a distribuição real está na tabela acima.
3. **`parseEmpresasXlsx()` precisa de lógica de "seções por bloco"**, não de um único cabeçalho de coluna: para cada bloco (A/B/C e E/F/G), iterar linhas sequencialmente; quando a célula de "Nome" da linha for exatamente um dos textos `"LUCRO REAL"`, `"SIMPLES NACIONAL"` ou `"LUCRO PRESUMIDO"` (e as demais colunas do bloco vazias), tratar como linha de seção — define o `regimeTributario` corrente para as linhas seguintes do mesmo bloco até a próxima seção (não persistir essa linha como empresa). As 7 linhas "Sup. X" do Bloco 2 (antes de qualquer seção) entram com `regimeTributario` vazio = "Sem regime", igual a qualquer outra linha sem regime detectável (já especificado no UI-SPEC).
4. **Não há colunas para "responsável", "contatos" ou "particularidades"** — confirma Pitfall 5: as 198 linhas entram no wizard com `responsavelId`, `contatos` e `particularidades` em branco, preenchidos manualmente na revisão (Step 2).
5. **Open Question 1 RESOLVIDA**: `Lista de Empresas com CNPJ.xlsx` é a fonte correta e suficiente para EMPR-02 — é o cadastro mestre (nome+CNPJ+regime via seção) para as 198 empresas. "Controle pis e cofins.xlsx" (citada no REQUIREMENTS.md) serve outro propósito (apuração mensal PIS/COFINS, conforme MEMORY.md do usuário) e não é necessária para a importação inicial.

**Gap de escopo para Fase 3 (não bloqueia Fase 1 — já registrado em `.planning/STATE.md` → Blockers/Concerns):** TASK-01 define regras de geração mensal apenas para Lucro Real (ICMS+PIS/COFINS+SPED) e Simples Nacional (DAS). Não há regra de obrigação definida para **Lucro Presumido**, que representa 50/198 (~25%) das empresas reais. O `RegimeTributario` da Fase 1 já suporta o valor `LUCRO_PRESUMIDO` (não bloqueia o cadastro/importação), mas a Fase 3 precisará definir quais obrigações esse regime gera antes de implementar o motor de geração.

### Pattern 4: Importação de planilha em 3 etapas com SheetJS (server-side)

**What:** Step 1 (upload) envia o arquivo `.xlsx` via `FormData` para uma Server Action/Route Handler que usa `XLSX.read(buffer)` + `XLSX.utils.sheet_to_json()` para converter a primeira aba em um array de objetos (uma linha = um objeto com chaves = cabeçalhos da planilha). Essas linhas são normalizadas para o shape de `ImportRow` (Zod schema) e devolvidas ao cliente como JSON — ficam em estado React (não persistidas ainda). Step 2 renderiza essas linhas em uma TanStack Table editável (validação de CNPJ inline, regime tributário obrigatório). Step 3 envia apenas as linhas marcadas/válidas para uma segunda Server Action que faz `createMany`/loop de `create` em `empresas`.

**When to use:** Fluxo completo do EMPR-02.

**Example:**
```typescript
// Source: padrão sintetizado a partir de docs.sheetjs.com/docs/getting-started/examples/import/
// e docs.sheetjs.com/docs/getting-started/installation/nodejs/ [CITED + ASSUMED]

// lib/excel/parse-empresas.ts
import * as XLSX from "xlsx"; // instalado via CDN tarball, ver Installation

export type LinhaImportada = {
  nome: string;
  cnpj: string;
  // pré-preenchido a partir da seção do bloco (Pattern 3.5); "" = Sem regime,
  // editável/obrigatório na revisão (Step 2)
  regimeTributario?: "LUCRO_REAL" | "LUCRO_PRESUMIDO" | "SIMPLES_NACIONAL";
};

const LABELS_SECAO = ["LUCRO REAL", "SIMPLES NACIONAL", "LUCRO PRESUMIDO"] as const;
type LabelSecao = (typeof LABELS_SECAO)[number];

const REGIME_POR_LABEL: Record<LabelSecao, LinhaImportada["regimeTributario"]> = {
  "LUCRO REAL": "LUCRO_REAL",
  "SIMPLES NACIONAL": "SIMPLES_NACIONAL",
  "LUCRO PRESUMIDO": "LUCRO_PRESUMIDO",
};

// Lê um bloco de colunas (ex.: A/B/C ou E/F/G) como matriz de linhas,
// detectando labels de seção ("LUCRO REAL" etc.) na coluna "Nome" e
// propagando o regime para as linhas seguintes até o próximo label
// (Pattern 3.5 — estrutura confirmada por inspeção direta da planilha real).
function parseBloco(
  linhas: unknown[][],
  colCod: number,
  colNome: number,
  colCnpj: number
): LinhaImportada[] {
  const resultado: LinhaImportada[] = [];
  let regimeAtual: LinhaImportada["regimeTributario"] = undefined;

  for (const linha of linhas) {
    const nome = String(linha[colNome] ?? "").trim();
    const cnpj = String(linha[colCnpj] ?? "").trim();

    if (LABELS_SECAO.includes(nome as LabelSecao) && !cnpj) {
      regimeAtual = REGIME_POR_LABEL[nome as LabelSecao];
      continue; // linha de label de seção — não é empresa
    }
    if (!nome || !cnpj) continue; // linha vazia entre/antes de seções

    resultado.push({ nome, cnpj, regimeTributario: regimeAtual });
  }
  return resultado;
}

// Mapeamento confirmado por inspeção direta (Pattern 3.5):
// Bloco 1 = colunas A/B/C, Bloco 2 = colunas E/F/G, ambos a partir da linha 3
export function parseEmpresasXlsx(buffer: Buffer): LinhaImportada[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // header: 1 -> matriz de arrays (linha 0-based, coluna 0-based: A=0, B=1, ...)
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  const linhasDeDados = matriz.slice(2); // pula linha 1 (labels iniciais) e linha 2 (vazia)
  const bloco1 = parseBloco(linhasDeDados, 0, 1, 2); // A/B/C
  const bloco2 = parseBloco(linhasDeDados, 4, 5, 6); // E/F/G

  return [...bloco1, ...bloco2];
}
```

```typescript
// lib/cnpj.ts — validação módulo 11 (Pitfall 7)
// Source: algoritmo padrão de validação de CNPJ (módulo 11), amplamente documentado [ASSUMED — algoritmo de domínio público, não copiado de fonte única]
export function validarCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false; // todos dígitos iguais

  const calcDigit = (base: string, weights: number[]): number => {
    const sum = base
      .split("")
      .reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(digits.slice(0, 12), weights1);
  const d2 = calcDigit(digits.slice(0, 12) + d1, weights2);

  return digits.endsWith(`${d1}${d2}`);
}
```

### Pattern 5: TanStack Table com células editáveis (staging review)

**What:** Usar o exemplo oficial "Editable Data" do TanStack Table — cada célula renderiza um `<input>`/`<select>` controlado por estado local, e `table.options.meta.updateData(rowIndex, columnId, value)` propaga a mudança para o array de linhas staged no componente pai.

**When to use:** Step 2 do wizard de importação — edição inline de Nome/CNPJ/Regime/Responsável/Contatos/Particularidades por linha.

**Example:**
```typescript
// Source: tanstack.com/table/v8/docs/framework/react/examples/editable-data [CITED]
// Padrão: meta.updateData + defaultColumn com célula editável
const defaultColumn: Partial<ColumnDef<LinhaStaged>> = {
  cell: ({ getValue, row: { index }, column: { id }, table }) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);

    const onBlur = () => {
      table.options.meta?.updateData(index, id, value);
    };

    return (
      <input
        value={value as string}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        className="w-full bg-transparent"
      />
    );
  },
};
```

Para a coluna "Regime tributário", substituir o `<input>` por um shadcn `<Select>` (Lucro Real / Simples Nacional) — célula vazia = status "Sem regime" (badge âmbar), bloqueando "Confirmar importação" enquanto houver linhas incluídas nesse estado, conforme UI-SPEC.

### Anti-Patterns to Avoid

- **Filtrar empresas só no frontend (esconder linhas na tabela):** A tabela renderiza exatamente o que o backend retorna. Qualquer filtro de "minhas empresas vs todas" deve estar no `where` do Prisma via `withVisibilityScope()`, nunca em `.filter()` no React após receber todos os dados.
- **Usar PrismaAdapter "porque é o padrão dos tutoriais":** PrismaAdapter foi desenhado para fluxos OAuth (armazena `Account`, `VerificationToken`). Com Credentials + JWT, isso adiciona tabelas e complexidade sem necessidade — `authorize()` consultando Prisma diretamente é suficiente.
- **Persistir a planilha importada "as is" em uma única operação:** sempre staging (em memória/estado React, não em tabela temporária no banco — 100 linhas cabem confortavelmente em payload JSON) → revisão → confirmação explícita.
- **Hardcodar o mapeamento de colunas da planilha sem inspecionar o arquivo real:** o exemplo do Pattern 4 usa `linha["Nome"] ?? linha["Empresa"]` como placeholder — os nomes reais de coluna só são conhecidos após a inspeção (Wave 0).
- **Comparar senha com `===` ou hash caseiro:** sempre `bcrypt.compare()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hash/verificação de senha | Função própria de hash (SHA256 + salt manual) | `bcryptjs` (`hash`/`compare`) | Timing-safe comparison, salt automático, padrão testado — erro aqui é vulnerabilidade crítica |
| Sessão/cookie/CSRF | Sessão manual com JWT assinado à mão + cookie próprio | Auth.js v5 (Credentials + JWT strategy) | CSRF, expiração, assinatura de cookie já resolvidos e testados; já decidido no CLAUDE.md |
| Validação de CNPJ | Regex simples (só formato, sem dígito verificador) | Algoritmo módulo 11 (Pattern 4 acima) | Regex aceita CNPJs com formato correto mas dígitos verificadores inválidos — planilha real provavelmente tem erros de digitação que só o módulo 11 pega |
| Parsing de `.xlsx` | Parser próprio de XML/ZIP do formato OOXML | SheetJS (`xlsx` via CDN) | `.xlsx` é um ZIP com múltiplos XMLs internos (sheets, styles, shared strings) — reimplementar é um projeto em si; SheetJS já lida com células mescladas, fórmulas, formatos de data |
| Tabela paginada/ordenável de 100+ linhas | `<table>` HTML manual com `useState` para sort/paginação | TanStack Table | Já decidido — paginação, sort e filtro são casos resolvidos, evita bugs de "página 2 mostra linhas duplicadas" |
| RBAC genérico (roles/permissions tables) | Tabelas `roles`, `permissions`, `role_permissions`, `user_roles` | Enum `Role` + `withVisibilityScope()` | Anti-Pattern 3 do ARCHITECTURE.md — overkill para 2 papéis fixos |

**Key insight:** Esta fase tem dois "núcleos de risco de segurança" (auth e escopo de visibilidade) e um "núcleo de qualidade de dados" (importação). Em todos os três, a tentação de "fazer rápido e simples na mão" é alta porque o volume é pequeno (5 usuários, ~100 empresas) — mas exatamente por lidar com dados fiscais sensíveis de clientes, usar bibliotecas testadas (Auth.js, bcrypt, SheetJS, módulo 11) é mais barato do que parecer.

## Common Pitfalls

### Pitfall 1: Confiar em filtro de UI para "colaborador vê só sua carteira" (= Pitfall 8 do PITFALLS.md)
**What goes wrong:** A tela de empresas mostra só a carteira do colaborador porque o componente recebe `empresas.filter(e => e.responsavelId === session.user.id)`, mas a Server Action/query original já buscou TODAS as empresas do banco — qualquer chamada direta à Server Action (ou um futuro endpoint de API) retorna tudo.
**Why it happens:** É mais rápido escrever um `.filter()` no componente do que criar a função `withVisibilityScope()` e lembrar de aplicá-la em toda query.
**How to avoid:** `withVisibilityScope()` é chamada DENTRO de toda função de `modules/empresas/queries.ts` — nenhuma Server Action/Server Component chama `db.empresa.findMany()` diretamente sem passar por essas funções.
**Warning signs:** Existe algum `.filter()` ou `.map()` no lado do cliente que remove empresas de outros colaboradores depois de um `findMany` sem `where` de escopo.

### Pitfall 2: PrismaAdapter + Credentials Provider — incompatibilidade conhecida
**What goes wrong:** Seguir um tutorial que usa `PrismaAdapter` junto com `CredentialsProvider` resulta em erro/comportamento inesperado, porque a documentação oficial do Auth.js historicamente recomenda **não usar adapter de banco com Credentials** (a sessão de credentials não passa pelo fluxo de `Account`/`linkAccount` que o adapter espera).
**Why it happens:** A maioria dos tutoriais de "Auth.js + Prisma" no WebSearch desta sessão eram sobre OAuth (GitHub/Google), que usa adapter; poucos cobrem Credentials + Prisma sem adapter.
**How to avoid:** Usar `session: { strategy: "jwt" }` e NÃO declarar `adapter: PrismaAdapter(db)` na config do Auth.js. `authorize()` consulta `db.usuario` diretamente.
**Warning signs:** Erros como "no adapter configured" sendo "corrigidos" adicionando PrismaAdapter sem entender por quê — se o login funciona sem adapter, não adicionar um.

### Pitfall 3: Mapeamento de colunas da importação assumido sem inspecionar a planilha real — **RESOLVIDO (ver Pattern 3.5)**
**What goes wrong:** O wizard de importação seria codificado assumindo nomes de coluna como `"Nome"`, `"CNPJ"`, `"Responsável"` (chutados) — mas a planilha real não tem cabeçalhos de coluna tradicionais: é uma lista de controle manual com 2 blocos de colunas lado a lado (A/B/C e E/F/G) e seções de regime marcadas por linhas-label ("LUCRO REAL", "SIMPLES NACIONAL", "LUCRO PRESUMIDO") dentro da própria coluna de nome.
**Why it happens:** Planilhas de controle mantidas manualmente raramente seguem o formato "1 linha de cabeçalho + N linhas de dados" de um export de sistema.
**How to avoid:** RESOLVIDO — a estrutura completa (blocos, seções, 198 empresas) foi mapeada por inspeção direta nesta sessão (Pattern 3.5). `scripts/inspect-planilha.mjs` (Wave 0) agora serve para VALIDAR esse mapeamento programaticamente (`XLSX.readFile()` + checar contagens por seção = 61/80/50/7), não para descobri-lo do zero.
**Warning signs:** `parseEmpresasXlsx()` retorna menos de 198 linhas, ou linhas com `nome` igual a um dos labels de seção ("LUCRO REAL" etc.) — sinal de que a detecção de linha-de-seção (Pattern 3.5, `parseBloco`) não está filtrando corretamente.

### Pitfall 4: Empresas de Simples Nacional ausentes da planilha de origem — **INVALIDADO para `Lista de Empresas com CNPJ.xlsx`, ver Pattern 3.5**
**What goes wrong (hipótese original, baseada em research/SUMMARY.md):** A hipótese era que a planilha de importação cobriria majoritariamente Lucro Real (já que "Controle pis e cofins.xlsx" é uma ferramenta de apuração de PIS/COFINS, obrigação de Lucro Real/Presumido), deixando Simples Nacional sub-representado.
**O que a inspeção real mostrou:** `Lista de Empresas com CNPJ.xlsx` (a fonte real de EMPR-02, ver Open Question 1) tem 198 empresas: LUCRO_REAL=61, SIMPLES_NACIONAL=80 (o MAIOR grupo, ~40%), LUCRO_PRESUMIDO=50, 7 sem regime identificável. A hipótese do Pitfall 4 era sobre "Controle pis e cofins.xlsx" — um arquivo diferente, com outro propósito, que não é usado para EMPR-02.
**Ação residual:** O total importado (198) já excede a expectativa de "100-110 empresas" do ROADMAP — o relatório de importação (Step 3, UI-SPEC) deve simplesmente reportar o total real e a distribuição por regime, sem necessidade de nota de aviso sobre "Simples Nacional ausente". As 7 linhas "Sup. X" sem regime identificável (Pattern 3.5) seguem o fluxo normal de "Sem regime" já especificado no UI-SPEC.
**Warning signs:** Se `parseEmpresasXlsx()` retornar 0 empresas com `regimeTributario = SIMPLES_NACIONAL`, é sinal de bug no parser (Pattern 3.5), não uma característica real dos dados.

### Pitfall 5: `responsavelId` obrigatório, mas planilha pode não ter "responsável" mapeável diretamente
**What goes wrong:** O schema exige `responsavelId` (FK não-nula para `Usuario`). Se a planilha real não tiver uma coluna de responsável, ou tiver nomes que não batem exatamente com os 5 usuários cadastrados (ex.: apelidos, nomes incompletos), o `createMany` falha por FK constraint, ou pior, é codificado como nullable "para não travar" — quebrando o pressuposto de AUTH-02 (toda empresa tem um responsável).
**Why it happens:** Dados de planilhas mantidas manualmente raramente têm uma FK limpa para uma tabela de usuários que ainda não existia quando a planilha foi criada.
**How to avoid:** Na etapa de revisão (Step 2), a coluna "Responsável" é um `<Select>` com os 5 usuários cadastrados, **sem valor pré-selecionado** se não houver correspondência clara — tratado como campo obrigatório igual ao regime tributário (mesma regra de "Confirmar importação desabilitado enquanto houver linha sem responsável definido"). Isso já está implícito no UI-SPEC ("Responsável (editable Select)") mas deve ser tratado com a mesma obrigatoriedade que "Sem regime".
**Warning signs:** `createMany` lança erro de foreign key constraint durante o "Confirmar importação"; ou empresas são importadas com `responsavelId` apontando para um usuário "padrão"/genérico que não reflete a carteira real.

## Runtime State Inventory

> Esta fase é greenfield (projeto Next.js ainda não existe — confirmado pelo UI-SPEC: "no Next.js app, no `components.json`, and no existing component library exist on disk yet"). Não há estado de runtime pré-existente a migrar.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Nenhum banco de dados existente — projeto greenfield | Nenhuma migração de dados; primeira migration cria schema do zero |
| Live service config | Nenhum serviço externo configurado ainda (Railway/Postgres serão criados nesta fase) | Criar projeto Railway + serviço Postgres como parte da Fase 1 |
| OS-registered state | Nenhum | — |
| Secrets/env vars | Nenhum `.env` existente no repo (verificado — diretório raiz só contém `.git`, `.planning`, `CLAUDE.md`, `.claude`, e a planilha `.xlsx`) | Criar `.env`/`.env.local` com `DATABASE_URL`, `AUTH_SECRET` (gerar via `npx auth secret` ou `openssl rand -base64 32`), nunca commitar |
| Build artifacts | Nenhum — projeto Next.js ainda não inicializado | `create-next-app` cria estrutura do zero |

**Nota:** o arquivo `Lista de Empresas com CNPJ.xlsx` na raiz do projeto NÃO é "estado de runtime" — é o dado-fonte de importação (EMPR-02). Ele deve ser movido/copiado para um local apropriado (ex.: `data/` ou usado diretamente via script de importação) como parte da Fase 1, mas não requer "migração" no sentido de Pitfall — é a entrada do processo de importação que esta fase constrói.

## Code Examples

### Server Action de criação de empresa (CRUD, EMPR-01)
```typescript
// Source: padrão sintetizado de robinwieruch.de/next-server-actions [CITED + ASSUMED]
"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { empresaSchema } from "@/modules/empresas/schema";
import { revalidatePath } from "next/cache";

export async function criarEmpresa(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const dados = empresaSchema.parse({
    nome: formData.get("nome"),
    cnpj: formData.get("cnpj"),
    regimeTributario: formData.get("regimeTributario"),
    responsavelId: formData.get("responsavelId"),
    contatos: formData.get("contatos"),
    particularidades: formData.get("particularidades"),
  });

  await db.empresa.create({ data: dados });
  revalidatePath("/empresas");
}
```

### Proteção de rotas via middleware/proxy (Next.js 15.5 — `middleware.ts`)
```typescript
// Source: authjs.dev/getting-started/migrating-to-v5 [CITED]
// Nota: Next.js 15.5 ainda usa `middleware.ts` (rename para `proxy.ts` é
// mudança do Next 16, fora do escopo desta stack — ver CLAUDE.md)
export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|login|favicon.ico).*)"],
};
```

### Seed dos 5 usuários
```typescript
// Source: padrão padrão de seed Prisma + bcrypt [ASSUMED — sintetizado]
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const usuarios = [
    { nome: "Dono do Escritório", email: "dono@escritorio.com.br", role: Role.DONO },
    { nome: "Colaborador 1", email: "colaborador1@escritorio.com.br", role: Role.COLABORADOR },
    { nome: "Colaborador 2", email: "colaborador2@escritorio.com.br", role: Role.COLABORADOR },
    { nome: "Colaborador 3", email: "colaborador3@escritorio.com.br", role: Role.COLABORADOR },
    { nome: "Colaborador 4", email: "colaborador4@escritorio.com.br", role: Role.COLABORADOR },
  ];

  for (const u of usuarios) {
    const senhaHash = await bcrypt.hash("trocar-no-primeiro-login", 10);
    await db.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, senhaHash },
    });
  }
}

main().finally(() => db.$disconnect());
```

**Nota de segurança:** senhas placeholder ("trocar-no-primeiro-login") devem ser substituídas por senhas reais fornecidas pelo dono ANTES do deploy em produção, ou o seed deve gerar senhas aleatórias por usuário e exibi-las uma única vez no console (nunca commitadas). Esta decisão de produto (como os 5 usuários recebem suas credenciais iniciais) deve ser confirmada com o usuário — ver Open Questions.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `next-auth@4` com `pages/api/auth/[...nextauth].ts` (Pages Router) | Auth.js v5 com `auth.ts` central + `app/api/auth/[...nextauth]/route.ts` (App Router) | v5 (beta, amplamente adotado desde 2024-2025) | API unificada `auth()` funciona em Server Components, Route Handlers, Server Actions e middleware — v4 exigia `getServerSession()` com config duplicada |
| `npm install xlsx` (resolve para 0.18.5) | Tarball CDN oficial `cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` | SheetJS parou de publicar no npm registry | 0.18.5 tem vulnerabilidades de DoS/prototype pollution conhecidas; 0.20.3 via CDN é a versão mantida |
| `middleware.ts` | `proxy.ts` | Next.js 16 (out/dez 2025) | **Não aplicável a esta fase** — projeto fica em Next 15.5, que ainda usa `middleware.ts` (CLAUDE.md já documenta essa decisão) |

**Deprecated/outdated:**
- `next-auth@4`: ainda funcional mas não recomendado para App Router novo — usar v5 conforme já decidido.
- PrismaAdapter para fluxos Credentials-only: padrão antigo de tutoriais; v5 com JWT strategy não precisa dele.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `next-auth@beta` resolve para uma versão `5.0.0-beta.x` específica e funcional com Next 15.5/React 19 | Standard Stack, Package Legitimacy Audit | Se a versão beta tiver um bug específico não documentado, pode exigir pin de uma versão beta anterior — mitigado por checagem `npm view next-auth@beta version` no Wave 0 |
| A2 | `bcryptjs` mais recente é `^3.x` (vs `^2.4` citado no CLAUDE.md) | Standard Stack | Baixo risco — API de `hash`/`compare` é estável entre 2.x e 3.x; planner deve confirmar versão real via `npm view` e decidir entre seguir CLAUDE.md (`^2.4`) ou usar a mais recente |
| A3 | PrismaAdapter deve ser omitido para Credentials + JWT (não causa erro de configuração) | Pattern 1, Pitfall 2 | Se Auth.js v5 beta atual exigir um adapter mesmo para Credentials (mudança de comportamento entre betas), o login falharia — mitigado: testar login local antes de prosseguir para outras tarefas |
| A4 | ~~A planilha "Lista de Empresas com CNPJ.xlsx" é a fonte relevante para EMPR-02~~ — **CONFIRMADO** por inspeção direta (Pattern 3.5): 198 empresas, nome+CNPJ+regime via seções | Pattern 3.5, Open Questions | Resolvido — sem risco residual |
| A5 | ~~Estrutura de colunas da planilha é placeholder~~ — **CONFIRMADA**: 2 blocos (A/B/C e E/F/G) com seções de regime por label de linha, mapeamento implementado em `parseBloco`/`parseEmpresasXlsx` (Pattern 3.5) | Pattern 3.5, Pattern 4 | Resolvido — risco residual baixo: `scripts/inspect-planilha.mjs` (Wave 0) deve validar contagens (61/80/50/7=198) contra este mapeamento antes de finalizar |
| A6 | Sessão JWT com `maxAge` padrão (~30 dias) atende "permanece autenticado entre sessões do navegador" sem necessidade de configuração adicional | Pattern 1 | Baixo risco — se o dono quiser sessão mais longa/curta, é um único parâmetro (`session.maxAge`) a ajustar, não uma mudança estrutural |
| A7 | Railway gera automaticamente um domínio público `*.up.railway.app` sem custo adicional, satisfazendo INFRA-01 | Environment Availability, Architecture | Baixo risco — comportamento padrão documentado da plataforma; mitigado por ser parte do fluxo padrão de "Generate Domain" |

**Se esta tabela não estivesse vazia (não está):** todos os itens acima precisam de confirmação rápida (comandos `npm view`, inspeção da planilha, teste de login local) durante a execução — nenhum bloqueia o INÍCIO da implementação, mas A4/A5 bloqueiam a FINALIZAÇÃO do módulo de importação.

## Open Questions (RESOLVED)

1. ~~Qual planilha é a fonte real de EMPR-02~~ — **RESOLVIDA nesta sessão.**
   - **Resposta:** `Lista de Empresas com CNPJ.xlsx` é a fonte real e suficiente para EMPR-02. Inspeção direta (Pattern 3.5) confirmou 198 empresas com nome, CNPJ e regime tributário (via seções LUCRO REAL/SIMPLES NACIONAL/LUCRO PRESUMIDO) — exatamente o que EMPR-02 precisa como cadastro mestre inicial. `"Controle pis e cofins.xlsx"` (citada no REQUIREMENTS.md) serve outro propósito (apuração mensal de PIS/COFINS, estrutura de ~19 linhas/empresa, conforme MEMORY.md do usuário) e não precisa ser usada para a importação inicial — pode ser referenciada futuramente (TASK-06) como ferramenta externa de automação, não como fonte de dados de EMPR-02.
   - **Nota para o planner:** o texto de EMPR-02 em REQUIREMENTS.md cita "Controle pis e cofins.xlsx" — esse é um nome de arquivo desatualizado no requisito; a implementação deve usar `Lista de Empresas com CNPJ.xlsx`. Não é necessário editar REQUIREMENTS.md (fora do escopo desta fase), mas o PLAN.md deve deixar essa correspondência explícita.

2. **Como os 5 usuários recebem suas credenciais iniciais (senha)?**
   - What we know: AUTH-01 exige login individual com email/senha para 5 usuários fixos, cadastrados manualmente (não há fluxo de "criar conta" self-service nem recuperação de senha por email no v1, conforme CLAUDE.md/Alternatives — Auth.js Credentials simples).
   - What's unclear: se o dono fornecerá os emails/senhas reais dos 5 usuários para o seed, ou se o sistema deve gerar senhas temporárias e exibi-las (com expectativa de troca no primeiro login — o que exigiria uma tela de "alterar senha", não especificada no UI-SPEC desta fase).
   - Recommendation: para a Fase 1, seed com senhas placeholder conhecidas (documentadas em local seguro, não no código-fonte público) é suficiente — "trocar senha" pode ser v1.x. Confirmar com o usuário os 4 nomes/emails reais dos colaboradores antes do seed final (atualmente são placeholders genéricos).
   - **RESOLVED:** recomendação aceita como decisão. O seed (`prisma/seed.ts`) cria os 5 usuários com credenciais placeholder documentadas (senha `"trocar-no-primeiro-login"`). O dono substitui os 5 emails/nomes seedados pelos da equipe real e cada usuário troca a senha no primeiro login (ou via script de atualização de credenciais) antes do handoff para a equipe. Nenhuma tela de "recuperar senha por email" é necessária no v1.

3. **O domínio público Railway (`*.up.railway.app`) é suficiente para INFRA-01, ou o escritório espera um domínio próprio (ex.: `agenda.escritoriocontabil.com.br`)?**
   - What we know: INFRA-01 exige apenas "acessível por uma URL pública pela internet, não restrito à rede local" — o domínio gerado automaticamente pelo Railway atende literalmente esse requisito.
   - What's unclear: se há expectativa (não documentada em CONTEXT.md, que não existe para esta fase) de domínio customizado com o nome do escritório.
   - Recommendation: usar o domínio `*.up.railway.app` para esta fase (atende ao requisito formal); domínio customizado é uma configuração adicional trivial no Railway (CNAME) que pode ser feita a qualquer momento depois, sem bloquear a Fase 1.
   - **RESOLVED:** recomendação aceita como decisão. O domínio fornecido pelo Railway (`*.up.railway.app`) é suficiente para INFRA-01 no v1 — nenhum domínio próprio é requerido. Um domínio customizado (CNAME) pode ser adicionado depois sem bloquear nem alterar a Fase 1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Todo o projeto (Next.js, Prisma, scripts) | Não verificado nesta sessão (sem ferramenta de execução) | — | Wave 0 deve confirmar `node --version` ≥ 20 LTS (requisito do Prisma 6, conforme CLAUDE.md Version Compatibility) |
| npm | Instalação de dependências | Não verificado | — | Vem com Node.js; confirmar junto com Node |
| Git | Versionamento (já em uso — `.git` existe no projeto) | ✓ (confirmado — diretório `.git` presente) | — | — |
| PostgreSQL local (dev) | Desenvolvimento local antes do deploy | Não verificado | — | Pode-se desenvolver apontando `DATABASE_URL` direto para o Postgres do Railway (rede pública) durante dev, evitando exigir Postgres local — ou usar Docker/Postgres local se disponível |
| Railway CLI/conta | Deploy (INFRA-01) | Não verificado — depende de o usuário ter conta Railway | — | Deploy via GitHub (push to main → auto-deploy), sem exigir CLI local |
| Conexão com internet (WebSearch/CDN) | Download do tarball SheetJS via `cdn.sheetjs.com` | Assumido disponível (usado nesta própria pesquisa) | — | — |

**Missing dependencies with no fallback:**
- Nenhum identificado como bloqueante absoluto — todos os itens "não verificados" têm um caminho de confirmação simples no Wave 0 (rodar `node --version`, `npm --version`) ou um fallback viável (deploy via GitHub em vez de CLI Railway).

**Missing dependencies with fallback:**
- PostgreSQL local: usar instância do Railway durante desenvolvimento se Postgres local não estiver disponível.
- Railway CLI: usar fluxo "Deploy from GitHub repo" (sem CLI).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Nenhum configurado ainda — projeto greenfield. Recomendação: **Vitest** (compatível com Next.js 15/React 19, mais rápido que Jest, configuração mínima) para testes unitários de `withVisibilityScope()`, `validarCNPJ()`, `parseEmpresasXlsx()`. Para teste de Server Actions/rotas (auth, IDOR), usar testes de integração simples com `@testing-library/react` + chamadas diretas às funções server-side (não precisa de E2E completo nesta fase). `[ASSUMED — escolha de framework não confirmada com usuário, mas Vitest é o padrão de fato para projetos Next.js novos em 2025/2026]` |
| Config file | none — Wave 0 |
| Quick run command | `npx vitest run` (após setup) |
| Full suite command | `npx vitest run` (mesmo comando — suite pequena nesta fase) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Login com email/senha correto retorna sessão; credenciais erradas retornam erro "Email ou senha incorretos" | unit/integration | `npx vitest run tests/auth.test.ts` | ❌ Wave 0 |
| AUTH-01 | Sessão persiste (JWT cookie com `maxAge` configurado) | manual + unit (verificar config) | `npx vitest run tests/auth.test.ts -t "session maxAge"` | ❌ Wave 0 |
| AUTH-02 | `withVisibilityScope({role: 'colaborador', id: X})` retorna `{ responsavelId: X }`; `{role: 'dono'}` retorna `{}` | unit | `npx vitest run tests/visibility-scope.test.ts` | ❌ Wave 0 |
| AUTH-02 | Colaborador A não consegue editar/ler empresa de Colaborador B via Server Action direta (IDOR) | integration | `npx vitest run tests/empresas.idor.test.ts` | ❌ Wave 0 |
| EMPR-01 | Criar/editar empresa com `regimeTributario` válido persiste corretamente; CNPJ inválido é rejeitado | unit/integration | `npx vitest run tests/empresas.crud.test.ts` | ❌ Wave 0 |
| EMPR-01 | `validarCNPJ()` aceita CNPJs válidos conhecidos e rejeita dígitos verificadores incorretos | unit | `npx vitest run tests/cnpj.test.ts` | ❌ Wave 0 |
| EMPR-02 | `parseEmpresasXlsx()` lê o arquivo real e retorna N linhas com campos esperados (após Wave 0 de inspeção) | unit (fixture = cópia da planilha real ou subset) | `npx vitest run tests/import.test.ts` | ❌ Wave 0 |
| EMPR-02 | Importação não persiste linhas com regime tributário ausente (bloqueio "Confirmar importação") | integration | `npx vitest run tests/import.confirm.test.ts` | ❌ Wave 0 |
| INFRA-01 | App responde na URL pública do Railway após deploy | manual (smoke test pós-deploy) | `curl -I https://<app>.up.railway.app` | manual-only — justificativa: depende de deploy real, não testável localmente |

### Sampling Rate
- **Per task commit:** `npx vitest run` (suite ainda pequena — roda inteira rapidamente)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Suite verde + smoke test manual da URL pública (Railway) antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `package.json` com script `"test": "vitest run"` + instalar `vitest` — framework install: `npm install -D vitest`
- [ ] `vitest.config.ts` — configuração mínima (ambiente Node para testes de lib/, jsdom se necessário para componentes)
- [ ] `tests/setup.ts` — helper para criar usuário de teste + sessão mockada (para testes de `withVisibilityScope` e IDOR)
- [ ] `scripts/inspect-planilha.mjs` — script de inspeção da planilha real (pré-requisito para `tests/import.test.ts`)
- [ ] Confirmar `node --version` ≥ 20 e `npm view` das versões de pacote (ver Package Legitimacy Audit)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Auth.js v5 Credentials Provider + bcrypt (`bcrypt.compare`, custo ≥ 10) — nunca comparação de senha em texto plano |
| V3 Session Management | yes | Auth.js JWT session strategy — cookie `httpOnly`, `secure` (em produção HTTPS via Railway), `sameSite`; `AUTH_SECRET` forte (32+ bytes aleatórios) via env var |
| V4 Access Control | yes | `withVisibilityScope()` aplicado em toda query de leitura/escrita de `empresas`; checagem de propriedade (`findFirst` com escopo) antes de update/delete — previne IDOR (Pitfall 1/8) |
| V5 Input Validation | yes | Zod schemas para `Empresa` e `LinhaImportada` (client + server); validação de CNPJ via módulo 11; sanitização de upload (`.xlsx` apenas — checar extensão/MIME type) |
| V6 Cryptography | yes | `bcryptjs` para hash de senha (nunca hand-rolled); `AUTH_SECRET` gerado via `openssl rand -base64 32` ou `npx auth secret`, armazenado como variável de ambiente (Railway), nunca no código |

### Known Threat Patterns for Next.js + Prisma + Auth.js

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — colaborador acessa/edita empresa de outro via manipulação de `empresaId` | Elevation of Privilege / Information Disclosure | `withVisibilityScope()` + `findFirst` com escopo antes de toda mutação (Pattern 2, Pitfall 1) |
| Brute-force de login (5 usuários, senhas previsíveis) | Spoofing | Rate limiting básico no `authorize()` (ex.: delay incremental ou bloqueio temporário após N tentativas) — **nota:** rate limiting completo pode ser v1.x; mínimo viável é não vazar "usuário existe vs senha errada" na mensagem de erro (já especificado no UI-SPEC: "Email ou senha incorretos.") |
| Upload de arquivo malicioso disfarçado de `.xlsx` no wizard de importação | Tampering | Validar extensão E tentar `XLSX.read()` em try/catch — se o parse falhar, retornar erro genérico ("Arquivo inválido. Envie um arquivo .xlsx válido.", já especificado no UI-SPEC) sem expor detalhes do erro de parsing |
| Exposição de `senhaHash` em payload de API/Server Component | Information Disclosure | `select` explícito em todas as queries de `Usuario` fora de `authorize()` — nunca `findMany()` sem `select` em uma tabela com campo de hash |
| CSRF em Server Actions | Tampering | Next.js Server Actions têm proteção CSRF nativa (verificação de origem) — não desabilitar; Auth.js também valida CSRF token em `signIn`/`signOut` |
| Endpoint de geração de tarefas (futuro, Fase 3) acessível sem autenticação | Spoofing/DoS | Fora do escopo desta fase, mas a estrutura de `auth.ts`/middleware criada aqui deve ser reutilizável para proteger esse endpoint futuro com token de serviço separado |

## Sources

### Primary (HIGH confidence)
- [Auth.js — Migrating to v5](https://authjs.dev/getting-started/migrating-to-v5) — config `auth.ts`, route handler, `proxy`/middleware pattern, callbacks
- [Railway Docs — Deploy Next.js](https://docs.railway.com/guides/nextjs) — `output: standalone`, build/start commands, PostgreSQL service, `DATABASE_URL` reference variable, pre-deploy `npx prisma migrate deploy`, domínio público
- [SheetJS — NodeJS Installation](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) — instalação via tarball CDN, `XLSX.read()`/`sheet_to_json()`
- [TanStack Table — Editable Data Example](https://tanstack.com/table/v8/docs/framework/react/examples/editable-data) — padrão `meta.updateData` para células editáveis
- `.planning/research/SUMMARY.md`, `STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` — pesquisa de projeto já realizada (HIGH confidence conforme suas próprias seções de Sources)
- `.planning/phases/01-funda-o-acesso-empresas-e-importa-o/01-UI-SPEC.md` — contrato de UI já aprovado para esta fase

### Secondary (MEDIUM confidence)
- [Prisma Docs — Authentication with Auth.js + Next.js](https://www.prisma.io/docs/guides/authentication/authjs/nextjs) — confirma padrão geral de integração, mas exemplo é OAuth (GitHub), não Credentials — extrapolação necessária
- [Role-Based Access Control (RBAC) in Next.js Apps Backed by PostgreSQL](https://medium.com/@nikitinal.nal/next-js-with-postgresql-role-based-access-control-implementation-ca024fd6d471) — padrão de query-scoping por role
- [bcryptjs — npm](https://www.npmjs.com/package/bcryptjs) — versão `3.0.3` mencionada via WebSearch, não confirmada via `npm view`

### Tertiary (LOW confidence)
- Versões exatas (`next-auth@beta`, `bcryptjs`, `prisma`) — obtidas via WebSearch, não via `npm view`/registry direto

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH para escolhas (já decididas no projeto), MEDIUM para versões exatas (não verificadas via registry nesta sessão)
- Architecture (Auth.js + RBAC + schema Prisma): HIGH — padrões bem estabelecidos e documentados, mesmo que exemplos específicos de Credentials+Prisma sejam escassos
- Importação Excel: HIGH — padrão SheetJS é HIGH confidence e mapeamento de colunas foi confirmado por inspeção direta da planilha real nesta sessão (Pattern 3.5)
- Pitfalls: HIGH — derivados diretamente do PITFALLS.md de projeto (já validado) + observações específicas desta fase
- Deploy Railway: HIGH — documentação oficial consultada e específica

**Research date:** 2026-06-11
**Valid until:** 30 dias para decisões de stack/arquitetura (estáveis); a inspeção da planilha (Wave 0) deve ocorrer no início da execução da Fase 1, não pode "expirar" — é uma tarefa, não uma claim de pesquisa
