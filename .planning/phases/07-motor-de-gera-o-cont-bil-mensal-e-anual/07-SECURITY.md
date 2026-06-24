---
phase: 07
slug: motor-de-gera-o-cont-bil-mensal-e-anual
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-24
---

# Phase 07 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| competência (string) → função pura de geração | Entrada textual que vira chave de idempotência; formato não canônico quebra a constraint `@@unique` | Competência mensal/anual (string) |
| schema.prisma → banco Neon | Migração de enum `TipoObrigacao`; valor não aplicado no banco causa falha de runtime na inserção | Enum schema (DDL) |
| cron / botão DONO → `executarGeracaoMensal` | Geração sem sessão (cron) — deliberadamente sem escopo de autorização; o responsável correto vem da query por setor | Disparo de geração mensal |
| `empresa.responsaveisPorSetor` → `tarefa.responsavelId` | Filtro de setor errado atribui tarefa Contábil ao responsável Fiscal/DP | Atribuição de responsável |
| competência → blocos de geração | String que vira chave de idempotência mensal e ano-base anual | Competência mensal/anual |
| COLABORADOR Contábil → `criarTarefa` | Atribuição de tarefa avulsa restrita pelo escopo setor-aware (não pode atribuir fora do seu setor) | Atribuição de tarefa avulsa |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-07-01 | Tampering | `gerarTarefasDoMesContabil` / `obrigacoesAnuaisParaCompetencia` (competência não canônica) | mitigate | `competenciaSchema.safeParse` no topo das funções puras — confirmado em `src/lib/geracao-tarefas-contabil.ts:87` e `src/lib/geracao-tarefas-contabil-anual.ts:94` | closed |
| T-07-02 | Tampering | enum `TipoObrigacao` no banco | mitigate | `prisma db push` aplicado ao Neon — confirmado via `npx prisma db pull --print` (verificado em 07-VERIFICATION.md, todos os 11 valores presentes ao vivo) | closed |
| T-07-03 | Tampering | colisão de competência anual "YYYY" com mensal "YYYY-MM" sob mesmo `tipoObrigacao` | accept | Enum values disjuntos + `@@unique(empresaId, tipoObrigacao, competencia)` já desambigua; formato "YYYY" (4 chars) vs "YYYY-MM" (7 chars) nunca colide | closed |
| T-07-SC | Tampering | npm/pip/cargo installs | accept | Nenhum pacote novo instalado nesta fase | closed |
| T-CONT-01 | Tampering | bloco Contábil (mensal e anual) — atribuição de responsável | mitigate | `where: { setor: "CONTABIL" }` em todas as queries do bloco — confirmado em `src/modules/tarefas/geracao.ts:158,206` | closed |
| T-CONT-02 | Denial of Service | `executarGeracaoMensal` (empresa sem responsável CONTABIL) | mitigate | "Pular e listar" — `semResponsavelContabil` deduplicado por `empresaId`, nunca aborta a transação — confirmado em `src/modules/tarefas/geracao.ts:88,167,194,219` | closed |
| T-CONT-03 | Tampering | bloco anual aplicado ao regime errado (DEFIS a Lucro Real, ECD/ECF a Simples) | mitigate | Filtro dinâmico `regra.regimesElegiveis` — confirmado em `src/modules/tarefas/geracao.ts:201` e catálogo em `src/lib/geracao-tarefas-contabil-anual.ts:62,69,76`; testado explicitamente (SIMPLES_NACIONAL excluída de ECD) | closed |
| T-CONT-04 | Spoofing/Elevation | cron sem autenticação dispara geração | accept | Invariante de design desde a Fase 3 — `executarGeracaoMensal` deliberadamente sem escopo de sessão (cron não tem usuário); gatilho manual mantém guard `role !== "DONO"` — confirmado em `src/app/(app)/tarefas/actions.ts:299` | closed |
| T-CONT-SC | Tampering | npm/pip/cargo installs | accept | Nenhum pacote novo instalado | closed |
| T-CONT-06 | Elevation of Privilege | `criarTarefa` (colaborador Contábil) | mitigate | `withVisibilityScope`/`withTarefaScope` setor-aware desde a Fase 5; teste de regressão trava o comportamento — confirmado em `tests/tarefas.contabil.test.ts` (3/3 passando) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-03 | Enum values disjuntos entre periodicidade mensal/anual + constraint composta já desambiguam — sem mecanismo adicional necessário | Documentado em plan-time (07-01-PLAN.md) | 2026-06-24 |
| AR-07-02 | T-07-SC | Nenhum pacote novo instalado na fase | Documentado em plan-time (07-01/07-02/07-03-PLAN.md) | 2026-06-24 |
| AR-07-03 | T-CONT-04 | Invariante de design pré-existente desde a Fase 3 (cron sem sessão), inalterado nesta fase | Documentado em plan-time (07-02-PLAN.md) | 2026-06-24 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-24 | 10 | 10 | 0 | Claude (orchestrator — short-circuit per register_authored_at_plan_time=true, all mitigations verified directly against source) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-24
