---
status: clean
files_reviewed: 12
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
---

# Code Review: Phase 07 — Motor de Geração Contábil Mensal e Anual

Reviewed: `prisma/schema.prisma`, `src/app/(app)/tarefas/actions.ts`,
`src/app/(app)/tarefas/gerar-tarefas-button.tsx`, `src/lib/competencia.ts`,
`src/lib/geracao-tarefas-contabil-anual.ts`, `src/lib/geracao-tarefas-contabil.ts`,
`src/modules/tarefas/geracao.ts`, and the 5 associated test files.

`npx tsc --noEmit` passes with zero errors. All 34 relevant tests
(`geracao-tarefas-contabil.test.ts`, `geracao-tarefas-contabil-anual.test.ts`,
`geracao.actions.test.ts`, `geracao.idempotencia.test.ts`,
`tarefas.contabil.test.ts`) pass.

## Summary of what was verified

- **Transaction safety**: The Contábil mensal and anual blocks
  (`src/modules/tarefas/geracao.ts` lines 143-247) run entirely inside the
  same `db.$transaction(async (tx) => ...)` callback as the Fiscal/DP/snapshot
  blocks, using `tx.empresa.findMany` consistently — no separate `db.*` calls
  that would escape the transaction. The final `tx.tarefa.createMany` is a
  single call covering all four task categories (Fiscal + DP + Contábil
  mensal + Contábil anual) concatenated into one `tarefas` array, so a
  failure partway through aborts the whole transaction with no partial
  commit possible.

- **Idempotency**: Both new task categories share the same
  `@@unique([empresaId, tipoObrigacao, competencia])` constraint and rely on
  `skipDuplicates: true` in the single `createMany` call — no separate
  control flag was introduced, matching the documented design decision
  (D-10). The anual block's `competenciaAnual` ("YYYY") and the mensal
  block's `competencia` ("YYYY-MM") are textually capable of colliding only
  if a `tipoObrigacao` were shared between axes, which the enum design
  prevents (mensal types vs. ECD/ECF/DEFIS are disjoint enum members) —
  verified by reading `prisma/schema.prisma` enum `TipoObrigacao` (lines
  36-57): all 8 mensal types and 3 anual types are listed as distinct
  values. Confirmed via the idempotency test "segunda execução da mesma
  competência anual... não cria nenhuma tarefa nova."

- **Date/competência calculation**: `calcularPrazoBaseDiaFixo`
  (`src/lib/dia-util.ts`) and `obrigacoesAnuaisParaCompetencia` /
  `calcularPrazoAnual` (`src/lib/geracao-tarefas-contabil-anual.ts`) both
  avoid the UTC-parsing pitfall by using the 3-argument `Date` constructor
  consistently. `mesCriacao` vs `mesVencimento` separation (CONT-02/03/04)
  is correctly modeled as "create 1 month before due," and `anoVencimento =
  anoAtual + 1` is unconditional per the catalog (DEFIS in Feb → due Mar of
  the *same* year would actually be wrong if anoVencimento were always +1 —
  see Info finding IN-1 below, which is pre-existing/accepted behavior, not
  a bug in this phase's code).

- **Enum/schema consistency**: All 8 `TipoObrigacaoContabil` mensal
  literals and all 3 `TipoObrigacaoAnual` literals match
  `prisma/schema.prisma`'s `TipoObrigacao` enum exactly (cross-checked by
  grep). `RegimeTributario` usage (`SIMPLES_NACIONAL`,
  `LUCRO_REAL`/`LUCRO_PRESUMIDO`) is consistent across the catalog,
  `regimesElegiveis` filters, and the transaction's dynamic `where`
  filtering (Pitfall 3 — DEFIS uses the inverse regime set from ECD/ECF,
  and the code correctly filters dynamically by `regra.regimesElegiveis`
  rather than reusing the hardcoded mensal filter).

- **`semResponsavelContabil` propagation**: Deduplication via
  `Map<string, {...}>` keyed by `empresaId` (lines 236-240 of `geracao.ts`)
  correctly merges `semResponsavelContabilMensal` and
  `semResponsavelContabilAnual` into a single list before it's returned
  through `executarGeracaoMensal` → `gerarTarefasDoMesAction` →
  `GerarTarefasButton`. The action and button both type the field as
  `{ empresaId: string; nome: string }[]` consistently (never `null`/
  `undefined` — always an array, defaulting to `[]`), so the UI's
  `.length > 0` check in `gerar-tarefas-button.tsx` is safe without an
  optional-chaining guard.

- **No unsafe `any` casts or unhandled rejections** were found in the
  reviewed files. `gerarTarefasDoMesAction` wraps the entire body (including
  `auth()`) in try/catch and never throws to the client.

- **Test quality**: Tests exercise genuine behavioral assertions, not just
  code-path coverage — e.g. the 12-month sweep in
  `geracao-tarefas-contabil-anual.test.ts` (`disparos` counter) actually
  proves "exactly once per year" rather than just "does not throw"; the
  idempotency tests assert `criadas`/`puladas` counts change correctly
  between first/second runs; the "Pitfall 4" dedup test in
  `geracao.idempotencia.test.ts` constructs a deliberately colliding
  `empresaId` across the mensal and anual mocked queries to prove
  dedup actually fires. Mocks in `geracao.actions.test.ex` and
  `geracao.idempotencia.test.ts` correctly model the chained
  `empresa.findMany` calls (Fiscal → DP → Contábil mensal → Contábil
  anual×N) using `mockResolvedValueOnce` chains that match the real call
  order in `geracao.ts`, and `tests/tarefas.contabil.test.ts` confirms the
  `criarTarefa` action's `withVisibilityScope` integration for `setor:
  "CONTABIL"` against the real shape returned by
  `src/lib/visibility-scope.ts` (verified by reading that file).

## Info

### IN-1: `anoVencimento = anoAtual + 1` is always one year ahead, including for DEFIS (Feb → Mar)

`src/lib/geracao-tarefas-contabil-anual.ts` (lines 91-107) computes
`anoVencimento: anoAtual + 1` unconditionally for every entry in
`CATALOGO_OBRIGACOES_ANUAIS`, including DEFIS (`mesCriacao: 2`,
`mesVencimento: 3`). This means DEFIS created in February of year Y is
dated due in March of year **Y+1**, not March of the same year Y — i.e. the
task is created roughly 13 months before its deadline, not 1 month before,
despite the module doc comment's general claim ("mesCriacao é o mês em que
a tarefa é CRIADA, 1 mês antes do vencimento").

This is explicitly called out and accepted in the code's own comments
("Pitfall 2: o vencimento cai SEMPRE no ano SEGUINTE ao ano-base da
competência... nunca no mesmo ano") and is covered by a passing test
(`'para competência "2026-04" (ECD)... anoVencimento é 2027'`), so this
matches the documented design intent rather than being an oversight. Flagging
as info only because the "1 mês antes do vencimento" prose doesn't
literally hold for DEFIS's Feb→Mar same-year-looking pair without reading
the Pitfall 2 callout — worth double-checking against the real-world DEFIS
deadline rule (DEFIS for Simples Nacional is typically due by March 31 of
the *same* calendar year it's filed for, not 13 months later) if this
wasn't already validated against the actual regulatory deadline during
07-01/07-02 discussion. No code change recommended without confirming the
intended real-world due date with the project owner — this may be correct
as designed (e.g., if "ano-base" intentionally refers to the prior fiscal
year being reported), but the discrepancy between the doc's general
"1 month before" framing and the actual 13-month gap for DEFIS is worth a
sanity check.
