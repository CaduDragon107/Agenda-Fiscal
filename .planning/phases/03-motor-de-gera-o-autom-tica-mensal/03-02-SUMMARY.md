---
phase: 03-motor-de-gera-o-autom-tica-mensal
plan: 02
subsystem: backend
tags: [prisma, node-cron, vitest, instrumentation]

# Dependency graph
requires:
  - phase: 03-motor-de-gera-o-autom-tica-mensal
    plan: 01
    provides: gerarTarefasDoMes, competenciaAtual, @@unique([empresaId, tipoObrigacao, competencia])
provides:
  - "executarGeracaoMensal (src/modules/tarefas/geracao.ts) — orquestração I/O: lê empresas ativas com regime atual, persiste idempotente via createMany skipDuplicates, retorna {criadas, puladas}"
  - "iniciarScheduler (src/lib/scheduler.ts) — registro do cron mensal 0 6 1 * * com guard globalThis"
  - "register (instrumentation.ts) — boot hook Next.js que aciona o scheduler no runtime nodejs"
affects: [03-03-ui-gatilho-manual]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Orquestração I/O isolada em src/modules/tarefas/geracao.ts, sem withTarefaScope/withVisibilityScope (leitura unscoped por design, D-12)"
    - "Idempotência via DB unique constraint + createMany skipDuplicates, sem pré-checagem de aplicação (evita TOCTOU entre cron e botão manual)"
    - "globalThis guard + instrumentation.ts register() como duas camadas independentes contra dupla-registração de cron"

key-files:
  created:
    - src/modules/tarefas/geracao.ts
    - src/lib/scheduler.ts
    - instrumentation.ts
    - tests/geracao.idempotencia.test.ts

key-decisions:
  - "executarGeracaoMensal lê Empresa.regimeTributario diretamente (nunca via EmpresaRegimeHistorico) — D-12, sem escopo de visibilidade aplicado (cron não tem usuário autenticado)"
  - "Idempotência testada via mocks de createMany retornando count variável (5 -> 0 na segunda execução), não via banco real — segue exatamente o padrão vi.mock(\"@/lib/db\") de tests/tarefas.crud.test.ts"
  - "instrumentation.ts criado na raiz do projeto (não em src/), conforme contrato oficial do Next.js 15 App Router"

requirements-completed: [TASK-01]

# Metrics
duration: 12min
completed: 2026-06-18
---

# Phase 3 Plan 2: Orquestração do Motor de Geração Summary

**Camada de orquestração I/O que conecta as funções puras do Plano 01 ao banco (createMany idempotente) e ao agendador node-cron via instrumentation.ts, sem nenhuma pré-checagem de aplicação contra a constraint única**

## Performance

- **Duration:** 12 min
- **Tasks:** 2
- **Files modified:** 4 (3 created em src/, 1 teste criado)

## Accomplishments
- `executarGeracaoMensal` lê empresas ativas com regime ATUAL via `db.empresa.findMany({ where: { ativo: true } })`, delega o cálculo a `gerarTarefasDoMes` (Plano 01) e persiste com `createMany({ skipDuplicates: true })`, apoiado no índice único `@@unique([empresaId, tipoObrigacao, competencia])` já aplicado em produção
- Idempotência D-10 comprovada por teste: primeira execução cria N tarefas, segunda execução (mesma competência) reporta `criadas: 0` e `puladas: N`
- Resumo D-11 (`{ criadas, puladas }`) verificado com cenário de criação parcial (3 de 5 tarefas já existiam)
- Cron mensal `0 6 1 * *` (D-07) registrado via `iniciarScheduler`, protegido por guard `globalThis.__agendaFiscalCronStarted` e acionado no boot do processo via `instrumentation.ts` (runtime `nodejs` apenas, evitando carregar `node-cron` sob Edge)
- `npx tsc --noEmit` e suíte completa (73 testes, 16 arquivos) permanecem verdes — nenhuma regressão introduzida pelo boot hook

## Task Commits

Each task was committed atomically:

1. **Task 1: Orquestração executarGeracaoMensal + teste de idempotência** - `000e328` (feat) — `src/modules/tarefas/geracao.ts` criado; `tests/geracao.idempotencia.test.ts` com 3 casos (idempotência, resumo D-11, shape do createMany sem referência a `empresaRegimeHistorico`), todos verdes
2. **Task 2: Scheduler node-cron + instrumentation boot hook** - `33f1630` (feat) — `src/lib/scheduler.ts` e `instrumentation.ts` criados; `npx tsc --noEmit` e `npx vitest run` (suíte completa, 73 testes) verdes

## Files Created/Modified
- `src/modules/tarefas/geracao.ts` - `executarGeracaoMensal(competencia)`: lê `Empresa` ativa (select mínimo `id`/`regimeTributario`/`responsavelId`), chama `gerarTarefasDoMes`, `createMany skipDuplicates`, retorna `{ criadas, puladas }`
- `src/lib/scheduler.ts` - `iniciarScheduler()`: guard `globalThis.__agendaFiscalCronStarted`, `cron.schedule("0 6 1 * *", ...)` chamando `executarGeracaoMensal(competenciaAtual())`, log de resumo via `console.log`, try/catch com `console.error`
- `instrumentation.ts` - `register()` na raiz do projeto: gate `process.env.NEXT_RUNTIME === "nodejs"`, dynamic import de `@/lib/scheduler`, chama `iniciarScheduler()`
- `tests/geracao.idempotencia.test.ts` - 3 testes: 1ª/2ª execução (D-10), resumo parcial criadas/puladas (D-11), shape do `createMany` (skipDuplicates true, status PENDENTE, sem `empresaRegimeHistorico`)

## Decisions Made
- `executarGeracaoMensal` não chama `withTarefaScope`/`withVisibilityScope` — leitura de empresas é deliberadamente unscoped, pois o cron não tem um usuário de sessão; cada tarefa gerada já carrega o `responsavelId` correto via `gerarTarefasDoMes` (D-09)
- Teste de idempotência usa `vi.mock("@/lib/db")` com `createMany` retornando `count` diferente entre chamadas (simula o comportamento real do Postgres `skipDuplicates` sem precisar de banco real), seguindo o convênio já estabelecido em `tests/tarefas.crud.test.ts`
- `instrumentation.ts` colocado na raiz do projeto (não em `src/`) — é o contrato exato exigido pelo Next.js 15 App Router para o boot hook ser descoberto

## Deviations from Plan

None - plan executado exatamente como escrito. Código de `geracao.ts`, `scheduler.ts` e `instrumentation.ts` seguiu literalmente os drafts completos de RESEARCH.md Patterns 3 e 4 referenciados no próprio plano.

## Issues Encountered

None.

## User Setup Required

None - nenhuma configuração externa necessária. `node-cron` já estava instalado desde o Plano 01; nenhuma nova variável de ambiente ou serviço externo é necessário para o scheduler funcionar em produção (Railway, processo `next start` longo-vivo).

## Next Phase Readiness
- Plano 03 (UI gatilho manual) pode agora importar `executarGeracaoMensal` diretamente em uma Server Action DONO-only (`gerarTarefasDoMesAction`), reutilizando a mesma função chamada pelo cron — sem nenhuma lógica de pré-checagem adicional, pois a idempotência já está garantida pela constraint do banco
- `competenciaAtual()` (Plano 01) já está disponível para o botão manual derivar o valor default
- Nenhum bloqueio identificado para o Plano 03

---
*Phase: 03-motor-de-gera-o-autom-tica-mensal*
*Completed: 2026-06-18*

## Self-Check: PASSED

All created files verified present (src/modules/tarefas/geracao.ts, src/lib/scheduler.ts, instrumentation.ts, tests/geracao.idempotencia.test.ts). All task commits (000e328, 33f1630) verified present in git log.
