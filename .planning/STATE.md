---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: executing
stopped_at: Phase 8 UI-SPEC approved
last_updated: "2026-06-25T10:58:23.849Z"
last_activity: 2026-06-25 -- Phase 08 execution started
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 13
  completed_plans: 10
  percent: 75
current_phase: 07
current_phase_name: motor-de-gera-o-cont-bil-mensal-e-anual
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-23)

**Core value:** A equipe nunca perde um prazo — fiscal, de pessoal ou contábil — de nenhum cliente, e o dono sempre sabe em tempo real o status de tudo, em qualquer setor.
**Current focus:** Phase 08 — dashboards-multi-setor-dp-e-cont-bil

## Current Position

Phase: 08 (dashboards-multi-setor-dp-e-cont-bil) — EXECUTING
Plan: 2 of 3
Status: Executing Phase 08
Last activity: 2026-06-25 -- Plans 08-01 and 08-02 complete

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
| Phase 03 P01 | 18min | 3 tasks | 7 files |
| Phase 03 P02 | 12min | 2 tasks | 4 files |
| Phase 03 P03 | 15min | 2 tasks | 4 files |
| Phase 06 P01 | 13min | 3 tasks | 5 files |
| Phase 06 P03 | 8min | 1 tasks | 1 files |
| Phase 06 P02 | 22min | 3 tasks | 5 files |
| Phase 07 P02 | 20min | - tasks | - files |

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
- [Phase ?]: [03-01] node-cron instalado nesta plan mesmo sem uso de codigo ainda, mandatado junto com date-holidays; uso real e Plan 02
- [Phase ?]: [03-01] prisma db push --accept-data-loss aplicado na Tarefa apos verificar que a tabela tinha 0 linhas - sem perda real de dados
- [Phase ?]: [03-01] hd.isHoliday(date) === false e a checagem de dia util correta (nunca === true) - testado contra Independencia 07/09/2026 e Sexta-feira Santa 03/04/2026
- [Phase 03-02]: executarGeracaoMensal le Empresa.regimeTributario diretamente (nunca EmpresaRegimeHistorico), sem withTarefaScope/withVisibilityScope - D-12, cron nao tem usuario autenticado
- [Phase 03-02]: instrumentation.ts criado na raiz do projeto (nao em src/) - contrato exato do Next.js 15 App Router para o boot hook ser descoberto
- [Phase 03-03]: gerarTarefasDoMesAction guarda role DONO como primeiro check apos auth(), antes de qualquer acesso ao banco (T-3-01) - botao GerarTarefasButton e so defesa em profundidade, nao a barreira real
- [Phase 03-03]: GerarTarefasButton usa router.refresh() (nao revalidatePath client-side) para repopular a lista Server Component apos a geracao
- [Phase 05-04]: useForm tipado com z.input<typeof empresaSchema> (nao EmpresaInput/z.infer) quando o schema tem campo .default() -- zodResolver's Resolver e tipado pelo INPUT (pre-default), nao pelo OUTPUT (pos-default, campo obrigatorio); usar o tipo de output como generic do useForm quebra a compatibilidade estrutural do Resolver/Control sob tsc
- [Phase 05-04]: deriveEmpresaRows (src/app/(app)/empresas/derive-rows.ts) e a fronteira de seguranca real de D-10 -- omite responsaveis cross-setor no data layer (server, antes do payload RSC) para viewer nao-DONO; coluna escondida em empresas-table.tsx e so segunda barreira defensiva, nao o controle primario
- [Phase 05-04]: npx prisma generate necessario antes de qualquer tsc --noEmit nesta sessao -- client gerado estava desatualizado em relacao ao schema.prisma ja migrado (Setor enum + EmpresaResponsavelSetor model dos Plans 01-03), nao e install de pacote novo (fora do escopo da Rule 3 exclusion)
- [Phase ?]: [Phase 06-01] Catalogo de DP mantido flat (array), nao Record<RegimeTributario,...> como o Fiscal -- DP nao varia por regime tributario, apenas pelo gate temFuncionariosClt aplicado no chamador (Plan 06-02)
- [Phase ?]: [Phase 06-01] calcularQuintoDiaUtil nao compoe com anticiparParaDiaUtil -- resultado ja e dia util por construcao da propria contagem para frente
- [Phase ?]: [Phase 06-03]: DP-05 satisfied entirely by composition with Phase 5 foundation (withVisibilityScope/withTarefaScope); no production code touched, only regression test added
- [Phase 06-02]: Loop Fiscal existente permanece 100% inalterado (select id/regimeTributario/responsavelId) -- decisao arquitetural do RESEARCH.md de NAO migrar Fiscal para a junction table nesta fase
- [Phase 06-02]: Tarefas Fiscal e DP mescladas em um unico array antes de um unico tx.tarefa.createMany -- idempotencia continua apoiada exclusivamente na constraint @@unique
- [Phase ?]: [07-02] tarefasContabilAnual tipado inline (nao reusando TarefaParaCriarContabil) pois tipoObrigacao e um union disjunto entre os eixos mensal e anual
- [Phase ?]: [07-02] tests/geracao.actions.test.ts usa competenciaAtual() sem mock de data fixa - mock de empresa.findMany precisa de fallback mockResolvedValue([]) para cobrir a chamada extra do bloco anual em meses de virada (fev/abr/jun)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1] ~~Inspecionar a estrutura real da planilha de importação~~ — RESOLVIDO nesta sessão: a fonte real de EMPR-02 é `Lista de Empresas com CNPJ.xlsx` (não "Controle pis e cofins.xlsx"), inspecionada diretamente. 198 empresas em 3 regimes: Lucro Real=61, Simples Nacional=80, Lucro Presumido=50, 7 sem regime identificável. Ver `01-RESEARCH.md` Pattern 3.5.
- [Phase 3] ~~NOVO — TASK-01 define regras de geração mensal só para Lucro Real e Simples Nacional; ~25% das empresas reais (50/198, Lucro Presumido) ainda não têm regra de obrigação definida.~~ — Tratado em 03-01 (ver 03-RESEARCH.md/03-CONTEXT.md); Lucro Presumido permanece fora do escopo de geração automática do v1 por decisão registrada na fase.
- [Phase 3] ~~Validar a regra de antecipação/postergação de prazo (antecipa vs adia) por tipo de obrigação (DAS, ICMS, PIS/COFINS, SPED) contra calendário oficial vigente antes de codificar `regras_obrigacao`~~ — RESOLVIDO em 03-01 via `date-holidays` + `proximoDiaUtil`, testado contra feriados móveis reais (Independência 07/09/2026, Sexta-feira Santa 03/04/2026).
- [Phase 3] ~~Decidir explicitamente se Corpus Christi conta como dia não útil para este escritório.~~ — RESOLVIDO em 03-01 (date-holidays calcula feriados móveis nacionais dinamicamente, sem lista fixa por ano).
- [Phase 5] ~~Migração de `Empresa.responsavelId` para junction table `EmpresaResponsavelSetor` precisa de backfill verificado (197 empresas → 197 linhas FISCAL) ANTES de qualquer código passar a ler da junction table; coluna antiga deve ser mantida por 1 ciclo de release como rede de segurança~~ — RESOLVIDO em 05-01 (197/197 FISCAL verificado, 0 divergência) e mantido como rede de segurança em 05-02/05-03 (`responsavelId` ainda escrito em lockstep).
- [Phase 5] ~~Autorização setor-aware (`withVisibilityScope`/`withTarefaScope`) precisa de novos fixtures multi-setor E da suite de IDOR existente passando inalterada como regression gate, não substituída~~ — RESOLVIDO em 05-02 (3 novas factories de fixture, 4 arquivos de regressão IDOR/visibilidade intactos, 106→115 testes verdes).
- [Phase 6] NOVO — `confirmarImportacao` (src/app/(app)/empresas/importar/actions.ts) grava `Empresa` direto via `db.empresa.create`, fora de `criarEmpresa`/`editarEmpresa` — desde 05-03 essas duas Server Actions gravam a linha FISCAL do junction em lockstep com `responsavelId`, mas o wizard de importação NÃO foi estendido (fora do escopo de 05-03) e continua criando empresas sem a linha `EmpresaResponsavelSetor`. Hoje é inofensivo (visibilidade FISCAL ainda lê `responsavelId` direto, Plan 05-02). Vira bug real no momento em que `responsavelId` for retirado (Phase 6) ou se alguém reimportar uma planilha antes disso — qualquer empresa importada nesse intervalo terá 0 linhas no junction table. Resolver junto com a retirada de `responsavelId`, ou antes da próxima reimportação em lote.
- [Phase 7] NOVO — Periodicidade anual (ECD/ECF/DEFIS) precisa de formato de competência explícito (ex. "YYYY") e testes simulando 12 ticks mensais do cron ao longo de um ano, verificando exatamente 1 tarefa anual por empresa por ano (ver research/PITFALLS.md Pitfall B2).
- [Phase 8] NOVO — Dashboards de DP/Contábil devem reaproveitar o módulo de queries parametrizado por setor já usado no Fiscal, nunca duplicar em módulos separados; deletar o módulo órfão `src/modules/dashboard/` (singular) durante esta fase (ver research/PITFALLS.md Pitfall B4).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260615-ci1 | Adicionar toggle de modo escuro (dark mode) na interface usando next-themes + shadcn | 2026-06-15 | f70d98c | [260615-ci1-adicionar-toggle-de-modo-escuro-dark-mod](./quick/260615-ci1-adicionar-toggle-de-modo-escuro-dark-mod/) |
| 260615-d0j | Corrigir rota raiz '/' (servia template create-next-app) para redirecionar para /empresas ou /login conforme sessao | 2026-06-15 | 2c61912 | [260615-d0j-corrigir-redirect-pagina-raiz](./quick/260615-d0j-corrigir-redirect-pagina-raiz/) |
| 260615-jyn | Adicionar logo da empresa (logo-branco.png) na sidebar e no header do login, sobre fundo escuro fixo (visivel em light/dark) | 2026-06-15 | 878f089 | [260615-jyn-adicionar-logo-marca](./quick/260615-jyn-adicionar-logo-marca/) |
| 260615-mt3 | Renomear colaborador1-4 para Caio/Jessica/Heitor/Felipe + script de sync responsavelId por CNPJ (atribuicao pendente: empresa table vazia em prod) | 2026-06-16 | b8cf152 | [260615-mt3-atualizar-empresa-responsavelid-197-empr](./quick/260615-mt3-atualizar-empresa-responsavelid-197-empr/) |
| 260616-ie1 | Importar 197 empresas de EMPRESAS RESPONSAVEL.xlsx no banco Neon (responsavelId + EmpresaRegimeHistorico por empresa; 28 MEI→SIMPLES_NACIONAL) | 2026-06-16 | f7ec2c4 | [260616-ie1-importar-197-empresas-planilha-responsavel](./quick/260616-ie1-importar-197-empresas-planilha-responsavel/) |
| 260618-kbg | Adicionar campo de motivo de pendencia na tarefa, visivel/editavel no detalhe da tarefa (acessado pelo icone de olho) | 2026-06-18 | 54970c1 | [260618-kbg-adicionar-campo-de-motivo-de-pendencia-n](./quick/260618-kbg-adicionar-campo-de-motivo-de-pendencia-n/) |
| 260618-kk8 | Adicionar opcao de filtro Pendentes na tela de tarefas | 2026-06-18 | 3bbb2e5 | [260618-kk8-adicionar-opcao-de-filtro-pendentes-na-t](./quick/260618-kk8-adicionar-opcao-de-filtro-pendentes-na-t/) |
| 260622-lty | Trocar grafico Evolucao Mensal de Area/Line para barras agrupadas com 5 categorias (criadas/concluidas/pendentes/pendentes-com-motivo/vencidas) | 2026-06-22 | c393331 | [260622-lty-trocar-grafico-evolucao-mensal-para-barr](./quick/260622-lty-trocar-grafico-evolucao-mensal-para-barr/) |
| 260622-r6n | Mudar paleta de cores dos graficos do dashboard (escala de cinza -> esquema semaforo: azul/verde/amarelo/laranja/vermelho) | 2026-06-22 | 6104e79 | [260622-r6n-mudar-paleta-de-cores-dos-graficos-do-da](./quick/260622-r6n-mudar-paleta-de-cores-dos-graficos-do-da/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-25T10:21:01.021Z
Stopped at: Phase 8 UI-SPEC approved
Resume file: .planning/phases/08-dashboards-multi-setor-dp-e-cont-bil/08-UI-SPEC.md
