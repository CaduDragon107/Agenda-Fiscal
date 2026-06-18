---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Phase 3 context gathered
last_updated: "2026-06-18T13:33:20.932Z"
last_activity: 2026-06-17 -- Phase 02 Plan 02 completed (queries, schema Zod, Server Actions, testes verdes)
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 10
  completed_plans: 10
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-11)

**Core value:** A equipe nunca perde um prazo fiscal de nenhum cliente, e o dono sempre sabe em tempo real o status de tudo.
**Current focus:** Phase 02 — gest-o-de-tarefas-avulsas-detalhe-e-alertas

## Current Position

Phase: 02 (gest-o-de-tarefas-avulsas-detalhe-e-alertas) — EXECUTING
Plan: 4 of 4
Status: Phase complete — ready for verification
Last activity: 2026-06-17 -- Phase 02 Plan 02 completed (queries, schema Zod, Server Actions, testes verdes)

Progress: [███░░░░░░░] 30%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 35min | 4 tasks | 52 files |
| Phase 01 P02 | 18min | 2 tasks | 10 files |
| Phase 01 P03 | 7 min | 2 tasks | 8 files |
| Phase 01 P04 | 35min | 2 tasks | 11 files |
| Phase 01 P05 | 70min | 3 tasks | 13 files |
| Phase 01 P06 | 12min | 2 tasks | 3 files |
| Phase 02 P01 | 3 min | 3 tasks | 7 files |
| Phase 02 P02 | 4 min | 3 tasks | 7 files |
| Phase 02 P03 | 5min | - tasks | - files |
| Phase 02 P04 | 8min | 1 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Estrutura Vertical MVP com 4 fases — Fundação (auth+empresas+import) → Gestão de Tarefas (avulsas+detalhe+alertas) → Motor de Geração Mensal → Dashboards. Cada fase entrega algo navegável/usável de ponta a ponta.
- [Roadmap]: Fases 2 e 3 reordenadas em relação à proposta inicial da pesquisa — UX de tarefas (avulsas, detalhe, alertas) vem ANTES do motor de geração automática, pois não depende dele e já entrega valor usável; o motor (Fase 3) então "alimenta" essa UI já existente.
- [Roadmap]: INFRA-01 (acesso pela internet) absorvido na Fase 1 como parte da fundação de infraestrutura/deploy.
- [Phase ?]: Database hosting: Neon (managed Postgres) instead of Railway-provisioned Postgres for DATABASE_URL/DIRECT_URL — User supplied Neon pooled+direct connection strings directly; Plan 06 Railway deploy must set these as env vars, not provision Railway Postgres
- [Phase ?]: AUTH_SECRET generated via node crypto.randomBytes(32).base64 fallback — npx auth secret resolved to unrelated better-auth CLI (writes BETTER_AUTH_SECRET, not AUTH_SECRET)
- [Phase ?]: [01-02] Middleware é uma instância NextAuth(authConfig) própria (edge-safe), não re-exportada de @/auth, para manter Prisma/bcrypt fora do bundle do edge runtime
- [Phase ?]: [01-02] Tipos de Session/JWT (id+role) também são aumentados via @auth/core/types e @auth/core/jwt diretamente, pois a reexportacao de next-auth/next-auth-jwt nao propaga module augmentation
- [Phase 01]: [01-03] SessionUser.role tipado como 'COLABORADOR' | 'DONO' (maiusculas) em src/lib/visibility-scope.ts, alinhado ao enum Prisma Role e ao AppRole de 01-02 -- sem camada de normalizacao de casing
- [Phase 01]: [01-03] tests/setup.ts atualizado de role 'colaborador'/'dono' (minusculas, convencao do stub 01-01) para 'COLABORADOR'/'DONO', para refletir o contrato real de sessao
- [Phase 01-04]: criarEmpresa writes the first EmpresaRegimeHistorico entry at creation (regime atual, dataInicio = now), keeping regime history coherent from v1
- [Phase 01-04]: Server Actions return { ok: true, id } | { ok: false, error } instead of throwing, simplifying client-side toast handling
- [Phase 01-04]: Edit page uses Next.js notFound() (404) when buscarEmpresaPorId returns null, satisfying 'nao encontrado, never 403' for the IDOR read path
- [Phase 01-05]: RESEARCH.md Pattern 3.5 documented 61/80/50/7=198; verified real total is 61/79/50/7=197 (CNPJ uniqueness check: 197 unique CNPJs, zero duplicates). A merged-cell 'MEI ' sub-header in SIMPLES NACIONAL was miscounted as a company in the prior research. All count references (inspect-planilha.mjs, import.test.ts) corrected to 197/79.
- [Phase 01-05]: parseUploadAction validates ZIP/OOXML magic bytes (PK\x03\x04) before XLSX.read, because SheetJS's CSV/text fallback does not throw on arbitrary non-xlsx bytes -- extension check + try/catch alone was insufficient to reject corrupted .xlsx uploads (T-01-UPLOAD).
- [Phase 01-05]: The 'Marcar todas como Lucro Real' bulk action was removed (not generalized). The parser pre-populates regimeTributario for 190/197 rows via section labels; the per-row Regime Select (3 values) plus the 'Sem regime' filter chip give scoped manual correction for the remaining 7 rows without a bulk-edit footgun.
- [Phase 02-01]: withTarefaScope segue o padrão idêntico a withVisibilityScope — DONO → {}, COLABORADOR → { responsavelId: user.id } retornando Prisma.TarefaWhereInput
- [Phase 02-01]: calcularAlertaPrazo é helper puro sem dependências externas (usa Date.now() diretamente, sem date-fns nesta plan de infraestrutura)
- [Phase 02-01]: Wave 0 stubs usam it.todo sem callbacks para não importar módulos inexistentes nas plans seguintes
- [Phase 02-01]: npx prisma db push usado em vez de prisma migrate dev (ambiente Neon sem shadow database)
- [Phase 02-02]: prazo transformado em Date(year, month-1, day, 23:59:59) local para evitar UTC drift em prazos fiscais (RESEARCH.md Pattern 8)
- [Phase 02-02]: findFirst (não findUnique) em todas queries/mutations com escopo composto — findUnique não aceita filtros além de campos únicos
- [Phase 02-02]: db.$transaction([update, create]) para concluirTarefa — atomicidade garante status CONCLUIDA nunca fica sem TarefaHistorico
- [Phase 02-02]: date-fns ^4.4.0 instalado na Wave 2 para estar disponível nas plans de UI Wave 3
- [Phase ?]: [02-03] novaTarefaFormSchema sem .transform() no cliente — transform exclusivo na action server-side (RESEARCH.md Pattern 8)
- [Phase ?]: [02-03] userId passado como prop para TarefasTable — defense in depth T-02-IDOR-UI (botao Excluir oculto para COLABORADOR em tarefas alheias)
- [Phase ?]: [02-04] await params para id em rotas dinamicas — Next.js 15 App Router params e Promise em Server Components
- [Phase ?]: [02-04] ConcluirButton em arquivo separado com 'use client' — impossivel misturar server/client no mesmo arquivo; router.refresh() para revalidar Server Component apos conclusao

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1] ~~Inspecionar a estrutura real da planilha de importação~~ — RESOLVIDO nesta sessão: a fonte real de EMPR-02 é `Lista de Empresas com CNPJ.xlsx` (não "Controle pis e cofins.xlsx"), inspecionada diretamente. 198 empresas em 3 regimes: Lucro Real=61, Simples Nacional=80, Lucro Presumido=50, 7 sem regime identificável. Ver `01-RESEARCH.md` Pattern 3.5.
- [Phase 3] NOVO — TASK-01 define regras de geração mensal só para Lucro Real e Simples Nacional; ~25% das empresas reais (50/198, Lucro Presumido) ainda não têm regra de obrigação definida. Definir essas regras antes de implementar o motor de geração (ver `01-RESEARCH.md` Pattern 3.5).
- [Phase 3] Validar a regra de antecipação/postergação de prazo (antecipa vs adia) por tipo de obrigação (DAS, ICMS, PIS/COFINS, SPED) contra calendário oficial vigente antes de codificar `regras_obrigacao` (research/PITFALLS.md, Pitfall 4).
- [Phase 3] Decidir explicitamente se Corpus Christi conta como dia não útil para este escritório.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260615-ci1 | Adicionar toggle de modo escuro (dark mode) na interface usando next-themes + shadcn | 2026-06-15 | f70d98c | [260615-ci1-adicionar-toggle-de-modo-escuro-dark-mod](./quick/260615-ci1-adicionar-toggle-de-modo-escuro-dark-mod/) |
| 260615-d0j | Corrigir rota raiz '/' (servia template create-next-app) para redirecionar para /empresas ou /login conforme sessao | 2026-06-15 | 2c61912 | [260615-d0j-corrigir-redirect-pagina-raiz](./quick/260615-d0j-corrigir-redirect-pagina-raiz/) |
| 260615-jyn | Adicionar logo da empresa (logo-branco.png) na sidebar e no header do login, sobre fundo escuro fixo (visivel em light/dark) | 2026-06-15 | 878f089 | [260615-jyn-adicionar-logo-marca](./quick/260615-jyn-adicionar-logo-marca/) |
| 260615-mt3 | Renomear colaborador1-4 para Caio/Jessica/Heitor/Felipe + script de sync responsavelId por CNPJ (atribuicao pendente: empresa table vazia em prod) | 2026-06-16 | b8cf152 | [260615-mt3-atualizar-empresa-responsavelid-197-empr](./quick/260615-mt3-atualizar-empresa-responsavelid-197-empr/) |
| 260616-ie1 | Importar 197 empresas de EMPRESAS RESPONSAVEL.xlsx no banco Neon (responsavelId + EmpresaRegimeHistorico por empresa; 28 MEI→SIMPLES_NACIONAL) | 2026-06-16 | f7ec2c4 | [260616-ie1-importar-197-empresas-planilha-responsavel](./quick/260616-ie1-importar-197-empresas-planilha-responsavel/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-18T13:33:20.924Z
Stopped at: Phase 3 context gathered
Resume file: .planning/phases/03-motor-de-gera-o-autom-tica-mensal/03-CONTEXT.md
