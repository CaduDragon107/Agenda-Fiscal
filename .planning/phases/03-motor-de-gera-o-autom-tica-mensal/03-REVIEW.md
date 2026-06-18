---
phase: 03-motor-de-gera-o-autom-tica-mensal
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - prisma/schema.prisma
  - src/app/(app)/tarefas/actions.ts
  - src/app/(app)/tarefas/gerar-tarefas-button.tsx
  - src/app/(app)/tarefas/page.tsx
  - src/lib/competencia.ts
  - src/lib/dia-util.ts
  - src/lib/geracao-tarefas.ts
  - src/lib/scheduler.ts
  - src/modules/tarefas/geracao.ts
  - tests/dia-util.test.ts
  - tests/geracao-tarefas.test.ts
  - tests/geracao.actions.test.ts
  - tests/geracao.idempotencia.test.ts
  - instrumentation.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the monthly automatic task-generation engine (catalog by tax regime, business-day adjustment, idempotent persistence, cron registration, and the manual trigger Server Action). The pure functions (`gerarTarefasDoMes`, `anticiparParaDiaUtil`, `competenciaAtual`) are well-isolated and the test suite covers the documented pitfalls (D-04 month-end rollover, D-05 holiday/weekend anticipation, D-10 idempotency, T-3-01 RBAC). However, two correctness/availability-risk issues were found in the unique-constraint design and the scheduler's silent swallow-and-continue retry posture, plus several robustness gaps in the manual-trigger action and the cron job that should be addressed before this ships to a 100+ company production schedule.

## Critical Issues

### CR-01: `@@unique([empresaId, tipoObrigacao, competencia])` does not protect ad-hoc tasks from duplicate generation/insertion when `tipoObrigacao`/`competencia` are NULL

**File:** `prisma/schema.prisma:98-99, 105`
**Issue:** `tipoObrigacao` and `competencia` are optional (`String?` / `TipoObrigacao?`) because ad-hoc (avulsa) tasks created via `criarTarefa` don't set them. In PostgreSQL, `NULL` is never equal to `NULL` in a unique index, so `@@unique([empresaId, tipoObrigacao, competencia])` provides **no uniqueness guarantee whatsoever** for any row where either column is NULL — which is every ad-hoc task. This is not itself the immediate generation bug (the cron-generated rows always populate both fields), but it means the idempotency guarantee that `executarGeracaoMensal`/`skipDuplicates` relies on only holds for the auto-generated rows; nothing stops a future code path (or a manual `db.tarefa.create`) from creating duplicate ad-hoc tasks with the exact same empresaId/tipoObrigacao/competencia combination if `tipoObrigacao`/`competencia` happen to be set to the same recurring values by another part of the app (e.g. a future "duplicate avulsa task as recurring" feature). More importantly, this same unique index is the **only** mechanism preventing duplicate task generation across concurrent cron + manual trigger runs (D-10, T-3-04) — if a future change ever needs ad-hoc tasks to also carry a `tipoObrigacao` (e.g., a manually created ICMS follow-up task), the NULL-based exemption silently disables the safety net for those rows precisely when it would matter the most.
**Fix:** Make the idempotency boundary explicit and immune to NULL semantics — e.g. add a generated/default sentinel value for ad-hoc tasks instead of NULL (`competencia: "AVULSA"` or a separate boolean `gerada: Boolean @default(false)` discriminator), or split auto-generated and ad-hoc tasks into a partial unique index:
```prisma
// Postgres partial index via raw SQL migration, since Prisma doesn't support
// partial unique indexes natively pre-7.x:
// CREATE UNIQUE INDEX tarefas_geracao_idempotente
//   ON tarefas (empresa_id, tipo_obrigacao, competencia)
//   WHERE tipo_obrigacao IS NOT NULL AND competencia IS NOT NULL;
```
Document explicitly (code comment) that the unique constraint is a no-op for rows with NULL `tipoObrigacao`/`competencia`, and that ad-hoc tasks must never reuse those two columns for anything that requires deduplication.

### CR-02: `executarGeracaoMensal` is not wrapped in a transaction between read and write — `findMany` (ativo: true) and `createMany` race with empresa deactivation/reassignment

**File:** `src/modules/tarefas/geracao.ts:26-43`
**Issue:** The function reads all active empresas, computes tasks in memory, then bulk-inserts. Between the `findMany` and `createMany` calls there is no transaction or snapshot isolation — if an admin deactivates a company or reassigns its `responsavelId` in the small window between read and write (plausible: cron runs at 06:00, and a DONO could be editing company data concurrently, or the manual button could be clicked while cron is also running at exactly 06:00:00 on the 1st), the generated task's `responsavelId` could already be stale by the time it's persisted, silently assigning a fiscal deadline to the wrong (former) responsible colaborador with no record of the inconsistency. Given the explicit project requirement "a equipe nunca perde um prazo fiscal," a stale-responsavel task is a correctness/business-risk bug, not just a theoretical race.
**Fix:** Wrap the read+write in `db.$transaction` with appropriate isolation, or at minimum re-validate `responsavelId` is still current at write time. Simplest robust fix:
```ts
export async function executarGeracaoMensal(competencia: string) {
  return db.$transaction(async (tx) => {
    const empresas = await tx.empresa.findMany({
      where: { ativo: true },
      select: { id: true, regimeTributario: true, responsavelId: true },
    });
    const tarefas = gerarTarefasDoMes(empresas, competencia);
    if (tarefas.length === 0) return { criadas: 0, puladas: 0 };
    const resultado = await tx.tarefa.createMany({
      data: tarefas.map((t) => ({ ...t, status: "PENDENTE" as const })),
      skipDuplicates: true,
    });
    return { criadas: resultado.count, puladas: tarefas.length - resultado.count };
  });
}
```

## Warnings

### WR-01: Cron job swallows all errors and never retries or alerts — a transient DB outage at 06:00 on day 1 silently skips the entire month's task generation

**File:** `src/lib/scheduler.ts:31-43`
**Issue:** The cron callback catches any error from `executarGeracaoMensal` and only `console.log`s it. The comment acknowledges "T-3-03: sem alerta externo (NOTF-01 deferred)" and relies on the manual button as fallback — but that fallback is only effective if a human DONO notices the cron failed and manually triggers generation. If the Postgres connection is briefly unavailable at exactly 06:00:00 on the 1st (e.g., Railway maintenance window, Neon cold-start hiccup), no tasks get generated for the entire month, no notification fires, and the only signal is a console.error line in server logs that nobody is actively watching. Given the explicit core value "a equipe nunca perde um prazo fiscal," a silent full-month generation failure is a meaningful availability/business risk even though it was knowingly deferred.
**Fix:** At minimum, add a simple retry with backoff (e.g., 3 attempts with delay) before giving up, since most DB blips resolve within seconds:
```ts
cron.schedule("0 6 1 * *", async () => {
  const competencia = competenciaAtual();
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const resultado = await executarGeracaoMensal(competencia);
      console.log(`[cron] Geração ${competencia}: ${resultado.criadas} criadas, ${resultado.puladas} puladas`);
      return;
    } catch (erro) {
      console.error(`[cron] Tentativa ${tentativa}/3 falhou:`, erro);
      if (tentativa < 3) await new Promise((r) => setTimeout(r, 5000 * tentativa));
    }
  }
  console.error(`[cron] Geração ${competencia} falhou após 3 tentativas — acionar manualmente.`);
});
```
This was explicitly deferred per the design doc (NOTF-01), so this is a WARNING rather than a BLOCKER, but it should be tracked as immediate follow-up work given the stated core value.

### WR-02: `gerarTarefasDoMesAction` swallows the real error from `executarGeracaoMensal`, hiding whether failure was partial (some tasks created) or total

**File:** `src/app/(app)/tarefas/actions.ts:250-258`
**Issue:** `createMany` is not atomic across the whole batch in the sense that if it throws partway (e.g., a constraint violation unrelated to the dedup key, or a connection drop mid-batch), the generic catch returns `{ ok: false, error: "Erro ao gerar tarefas. Tente novamente." }` without any indication of whether some tasks were already committed. Because `executarGeracaoMensal` is not transactional (see CR-02), a partial failure here could leave the DONO believing nothing happened and re-clicking the button, when in fact some tasks for that competência already exist — combined with the idempotency design this is probably safe in terms of duplicates, but the UI gives no visibility into the actual partial state, making troubleshooting hard.
**Fix:** Log the actual error server-side (currently fully discarded) for diagnosability:
```ts
} catch (erro) {
  console.error("[gerarTarefasDoMesAction] Falha na geração manual:", erro);
  return { ok: false, error: "Erro ao gerar tarefas. Tente novamente." };
}
```

### WR-03: `calcularPrazoBase` constructs dates with the server's local timezone via `new Date(ano, mes - 1, 1)`, making cron-vs-manual-trigger behavior dependent on server TZ configuration

**File:** `src/lib/geracao-tarefas.ts:64-69`
**Issue:** `new Date(ano, mes - 1, 1)` and `setDate(mesVencimento, dia)` both operate in the JS runtime's local timezone. The cron in `scheduler.ts` explicitly documents "fuso do servidor" (D-07), so this is a deliberate choice, but it means if the deployment host's `TZ` env var is ever misconfigured (e.g., defaults to UTC instead of America/Sao_Paulo on some PaaS providers), the day-of-month boundary calculations (`anticiparParaDiaUtil`, `lastDayOfMonth`) could shift by a day near midnight boundaries, and this would differ between local dev (likely BRT) and production (unknown unless `TZ` is pinned). No `TZ` pinning is visible in any of the reviewed files.
**Fix:** Explicitly pin `process.env.TZ = "America/Sao_Paulo"` at process boot (e.g., in `instrumentation.ts`) rather than relying on host defaults, and document this requirement in deployment notes.

### WR-04: `competenciaSchema` regex allows any 4-digit year including past/far-future years with no sanity bound, and `gerarTarefasDoMesAction` does not protect against trivial DoS via repeated re-generation requests for arbitrary historical competências

**File:** `src/lib/competencia.ts:19-21`, `src/app/(app)/tarefas/actions.ts:227-259`
**Issue:** `competenciaSchema` validates only the `YYYY-MM` shape, not a sane range. A DONO (the only role permitted to call this action) could pass `competencia: "1900-01"` or `"2999-12"` and the action would happily run `executarGeracaoMensal` against the full ~100+ company table, generating real `Tarefa` rows with deadlines decades in the past or future. This is a low-severity input-validation gap (DONO is a trusted role, not an attacker class per the threat model) but it's also a "fat-finger" data-integrity risk — e.g., a typo like `"2026-13"` is already rejected by the regex's month group, but `"1926-06"` is not, and would silently pollute the tarefas table with a full batch of garbage rows that bypass the dedup constraint for any future legitimate `1926-06` competência (none expected, but illustrates the lack of guardrails).
**Fix:** Add a reasonable bound, e.g.:
```ts
export const competenciaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência deve estar no formato YYYY-MM")
  .refine((val) => {
    const ano = Number(val.slice(0, 4));
    const anoAtual = new Date().getFullYear();
    return ano >= anoAtual - 1 && ano <= anoAtual + 1;
  }, "Competência fora do intervalo permitido");
```

## Info

### IN-01: `nomeMes` computed via `toLocaleDateString` is locale-environment-dependent and untested for non-pt-BR runtime locales

**File:** `src/lib/geracao-tarefas.ts:84-87`
**Issue:** `new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long" })` depends on the Node ICU data being available for `pt-BR` in the deployed runtime. Most modern Node builds include full ICU by default, so this is unlikely to fail in practice, but if the production image uses a stripped-down Node build (`small-icu`), this silently falls back to English month names or throws, and there's no test asserting the actual rendered string (tests only check `titulo.length > 0`, not content).
**Fix:** Add a test asserting the literal expected title (e.g., `"ICMS — março/2026"`) to catch ICU/locale regressions, and/or hardcode a PT-BR month-name lookup table to remove the runtime ICU dependency entirely.

### IN-02: `gerarTarefasDoMesAction`'s `AcaoGeracaoResult` and the generic `AcaoTarefaResult` are structurally similar but separately defined — minor duplication

**File:** `src/app/(app)/tarefas/actions.ts:14-27`
**Issue:** Two near-identical discriminated union result types are declared back-to-back (`AcaoGeracaoResult` and `AcaoTarefaResult`), both with `{ ok: false; error: string }` as the failure branch. Not a bug, but a small duplication that could drift if one is updated and not the other (e.g., adding an `errorCode` field to one but not the other).
**Fix:** Extract a shared base type, e.g. `type AcaoErro = { ok: false; error: string };` and union it with each success shape.

### IN-03: `concluirTarefa`'s idempotency short-circuit returns `{ ok: true }` without `id`, inconsistent with `criarTarefa`'s success shape

**File:** `src/app/(app)/tarefas/actions.ts:143-145`
**Issue:** Not a bug (the type allows `id` to be optional), but worth noting: when a task is already `CONCLUIDA`, the function returns success without confirming to the caller anything about the actual completion timestamp or who completed it originally — the client has no way to distinguish "I just completed it" from "someone already completed it earlier" from the result alone, which could be mildly confusing if the UI ever wants to show "already concluded by X."
**Fix:** Optional — consider returning the existing `concluidoEm`/`concluidoPor` if richer feedback is ever needed; no action required for current UI behavior (toast just confirms success either way).

---

_Reviewed: 2026-06-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
