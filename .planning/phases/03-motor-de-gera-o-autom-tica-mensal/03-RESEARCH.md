# Phase 3: Motor de Geração Automática Mensal - Research

**Researched:** 2026-06-18
**Domain:** Cron job scheduling, date/holiday calculation, idempotent bulk insert (Prisma), Server Actions RBAC
**Confidence:** HIGH

## Summary

Phase 3 extends the existing `Tarefa` model (no new table) to support automatically-generated
recurring fiscal obligations, driven by a catalog mapping `RegimeTributario` → list of
`TipoObrigacao` with a fixed base-day per obligation. The hard implementation problems are: (1)
correctly anticipating due dates to the previous business day using `date-holidays` (Brazil) +
`date-fns`, never a hardcoded holiday table; (2) running `node-cron` exactly once per boot of a
long-lived Next.js process on Railway, avoiding duplicate registration on hot-reload/restart; (3)
guaranteeing idempotency via a Prisma composite unique constraint plus a bulk-insert pattern that
reports created-vs-skipped counts without throwing on duplicates.

All four libraries needed (`date-holidays`, `node-cron`, `date-fns`, Prisma) are already either
installed (`date-fns@^4.4.0`, `prisma@^6.19.3`) or explicitly mandated by CLAUDE.md
(`date-holidays`, `node-cron`) — this phase's job is correct *usage*, not stack selection. No new
research-store provider calls were needed for ecosystem comparison since CONTEXT.md already locks
D-01 through D-14; remaining research focuses purely on API usage patterns and integration with
existing Phase 1/2 code (`withTarefaScope`, `auth()` guard pattern, `Tarefa`/`TarefaStatus`).

**Primary recommendation:** Build a pure function `gerarTarefasDoMes(empresas, competencia) ->
{ data: TarefaCreateInput[] }` in `src/lib/geracao-tarefas.ts` that has zero I/O (no Prisma, no
cron, no auth) and is exhaustively unit-testable; then a thin orchestration layer
(`src/modules/tarefas/geracao.ts`) that calls Prisma `createMany({ skipDuplicates: true })` against
the new `@@unique([empresaId, tipoObrigacao, competencia])` constraint, counts created vs. skipped
by comparing `data.length` to the actual insert count, and is invoked identically by both the
`node-cron` schedule and the DONO-only Server Action.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Obligation catalog (regime → tipos + dia-base) | API/Backend (pure module, no DB) | — | Static business rule, no I/O; lives as a TypeScript const map, not DB-configurable per Out of Scope ("construtor visual de regras") |
| Due-date calculation (date-holidays + date-fns) | API/Backend (pure function) | — | Must be deterministic/testable; pure function avoids hidden cron/timezone coupling |
| Monthly trigger (cron) | API/Backend (long-lived Node process) | — | Railway `next start` process per D-07; not Vercel serverless |
| Manual trigger button | Browser/Client (button) → API/Backend (Server Action) | — | UI triggers a Server Action; all authorization and writes happen server-side |
| Idempotent persistence | Database/Storage (unique constraint) | API/Backend (createMany skipDuplicates) | DB constraint is the source of truth for idempotency, not application-level pre-check, to survive concurrent cron+manual triggers |
| Visibility of generated tasks | API/Backend (existing `withTarefaScope`) | — | No new visibility logic — D-14 reuses Phase 2 scope rules unmodified |
| Execution summary feedback (D-11) | API/Backend (return value) → Browser/Client (toast/banner) | — | Same `AcaoTarefaResult`-style pattern already used in `actions.ts` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `date-holidays` | 3.30.2 [VERIFIED: npm registry] | Dynamic Brazilian holiday calculation (`new Holidays('BR')`) | Mandated by CLAUDE.md "What NOT to Use" — hardcoded holiday arrays go stale every year for movable holidays (Carnaval, Corpus Christi, Sexta-feira Santa) |
| `node-cron` | 4.4.1 [VERIFIED: npm registry] | In-process monthly schedule trigger | Mandated by CLAUDE.md for the Railway (`next start`, long-lived process) hosting variant — not Vercel Cron |
| `date-fns` | ^4.4.0 [VERIFIED: already in package.json] | Date arithmetic: `lastDayOfMonth`, `isWeekend`/weekend check, `subDays`, `format` | Already installed and used in Phase 2 (`tarefaSchema`, `02-RESEARCH.md` Pattern 8) — reuse, don't add `moment` or hand-rolled date math |
| Prisma `createMany` | 6.19.3 [VERIFIED: already in package.json] | Idempotent bulk insert respecting `@@unique` | `skipDuplicates: true` lets Postgres' unique index do idempotency enforcement atomically, instead of N sequential existence-check-then-insert round trips |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | ^3.25.76 (installed) | Validate `competencia` format ("YYYY-MM") on the manual-trigger Server Action input | Same pattern as `tarefaSchema` — never trust raw FormData/string input without a regex+parse step |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `date-holidays` | BrasilAPI `/api/v1/feriados/{ano}` (cached) | CLAUDE.md lists this as a valid fallback/secondary source, but adds a network dependency for a once-a-month job; `date-holidays` works fully offline and is already the locked decision (D-06) |
| `node-cron` | Inngest / trigger.dev | Explicitly called out in CLAUDE.md as overengineering for "1 simple job, 1x/month" — do not introduce |
| Prisma `createMany(skipDuplicates)` | Per-row `upsert` loop | `upsert` works but requires N round-trips for ~100 empresas × up to 4 obrigações (~400 rows); `createMany` does it in one round trip. Use `upsert` only if a future phase needs to *update* existing rows on regeneration (not needed here per D-12 — no retroactive recalculation) |

**Installation:**
```bash
npm install date-holidays node-cron
npm install --save-dev @types/node-cron
```

**Version verification:** Verified via `npm view date-holidays version` → `3.30.2`, `npm view
node-cron version` → `4.4.1` on 2026-06-18. Both packages have official GitHub repositories
(`commenthol/date-holidays`, `merencia/node-cron`) with no `postinstall` scripts (checked via `npm
view <pkg> scripts.postinstall`, returned empty for both). `date-fns` and `prisma` are already
present in `package.json` at the versions shown — no upgrade needed for this phase.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| date-holidays | npm | actively maintained (published 2026-05-26, mature project) | high (long-standing multi-country holiday lib) | github.com/commenthol/date-holidays | OK | Approved — already mandated in CLAUDE.md |
| node-cron | npm | mature, widely used scheduler | high | github.com/merencia/node-cron | OK | Approved — already mandated in CLAUDE.md |
| @types/node-cron | npm | DefinitelyTyped, standard companion types package | high | github.com/DefinitelyTyped/DefinitelyTyped | OK | Approved — dev dependency only |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

These three packages were not freshly discovered via web search — they are explicit, pre-vetted
decisions already documented in CLAUDE.md (the project's locked tech stack document) with their
own sourcing/confidence notes. Registry version and postinstall-script checks were run directly
against npm in this session `[VERIFIED: npm registry]`. No `package-legitimacy check` tool call was
available in this environment; the npm registry checks above (version, repository URL, absence of
postinstall scripts) substitute as the verification evidence.

## Architecture Patterns

### System Architecture Diagram

```
[Railway Node process boot]
        |
        v
  lib/scheduler.ts ---- registers node-cron job "0 6 1 * *" ----+
  (idempotent guard: global flag so hot-reload/restart           |
   does not double-register)                                     |
                                                                   v
                                                       [1st day of month, 06:00]
                                                                   |
                                                                   v
                                              src/modules/tarefas/geracao.ts
                                              executarGeracaoMensal(competencia)
                                                                   |
                       +-------------------------------------------+
                       |                                             |
            [DONO clicks "Gerar tarefas do mês" button]              |
            (Server Action, auth() + role==="DONO" guard)            |
                       |                                             |
                       +-------------------> same function <---------+
                                                   |
                                                   v
                                    db.empresa.findMany({ ativo: true })
                                    (read CURRENT regimeTributario, D-12)
                                                   |
                                                   v
                              src/lib/geracao-tarefas.ts (PURE FUNCTION)
                              gerarTarefasDoMes(empresas, competencia)
                              -- looks up CATALOGO_OBRIGACOES[regime]
                              -- computes dia-base -> due date in mes seguinte
                              -- anticipates to previous business day
                                 (date-holidays + date-fns, D-05/D-06)
                              -- returns TarefaCreateInput[]
                                                   |
                                                   v
                              db.tarefa.createMany({ data, skipDuplicates: true })
                              (idempotent insert against
                               @@unique([empresaId, tipoObrigacao, competencia]))
                                                   |
                                                   v
                              count = data.length - result.count (skipped)
                              return { criadas: result.count, puladas: count }
                                                   |
                       +---------------------------+---------------------------+
                       |                                                       |
                 cron: log summary                                 Server Action: return
                 (no UI to show)                                   { ok, criadas, puladas }
                                                                     -> toast on /tarefas page
                                                                            |
                                                                            v
                                                          existing Phase 2 UI
                                                          (listarTarefas, withTarefaScope,
                                                           calcularAlertaPrazo) -- UNCHANGED
```

### Recommended Project Structure
```
prisma/
└── schema.prisma          # + enum TipoObrigacao, + Tarefa.tipoObrigacao/competencia, + @@unique
src/
├── lib/
│   ├── geracao-tarefas.ts  # PURE: catalog + due-date calc + tarefa shape builder (unit-testable)
│   ├── dia-util.ts         # PURE: anticiparParaDiaUtil(date) using date-holidays + date-fns
│   └── scheduler.ts        # node-cron registration, boot-time side effect, dedupe guard
├── modules/
│   └── tarefas/
│       ├── geracao.ts      # orchestration: reads empresas from DB, calls geracao-tarefas, createMany
│       ├── queries.ts      # (existing, Phase 2 — unchanged)
│       └── schema.ts       # (existing, Phase 2 — extend if competencia input needs Zod validation)
└── app/(app)/tarefas/
    └── actions.ts          # + gerarTarefasDoMesAction (DONO-only Server Action)
tests/
├── geracao-tarefas.test.ts # unit tests for pure function (no DB, no mocks needed)
├── dia-util.test.ts        # unit tests for anticipation logic against known BR holidays
└── geracao.idempotencia.test.ts # integration test: run twice, assert no duplicates
```

### Pattern 1: Pure obligation-catalog + due-date function (testable without I/O)

**What:** Separate "what obligations does this regime need, and on what raw day" (pure data) from
"what is the actual Date object after weekend/holiday anticipation" (pure function) from "does this
already exist in the DB" (the only part that touches Prisma).

**When to use:** Always, for any business rule with date math — keeps the hardest-to-get-right
logic (holiday anticipation, month rollover, day-31-doesn't-exist-in-February) fully unit-testable
without spinning up a database or mocking `node-cron`.

**Example:**
```typescript
// src/lib/geracao-tarefas.ts
import { addMonths, setDate, lastDayOfMonth } from "date-fns";
import { anticiparParaDiaUtil } from "./dia-util";
import type { RegimeTributario } from "@prisma/client";

export type TipoObrigacao =
  | "ICMS"
  | "PIS_COFINS"
  | "SPED_FISCAL"
  | "SPED_CONTRIBUICOES"
  | "DAS";

type ObrigacaoRegra = { tipo: TipoObrigacao; diaBase: number };

// D-02: catálogo de obrigações por regime, dia-base ANTES do ajuste de dia útil
const CATALOGO_OBRIGACOES: Record<RegimeTributario, ObrigacaoRegra[]> = {
  LUCRO_REAL: [
    { tipo: "ICMS", diaBase: 20 },
    { tipo: "PIS_COFINS", diaBase: 25 },
    { tipo: "SPED_FISCAL", diaBase: 19 },
    { tipo: "SPED_CONTRIBUICOES", diaBase: 31 },
  ],
  LUCRO_PRESUMIDO: [
    { tipo: "SPED_FISCAL", diaBase: 19 },
    { tipo: "SPED_CONTRIBUICOES", diaBase: 31 },
  ],
  SIMPLES_NACIONAL: [{ tipo: "DAS", diaBase: 20 }],
};

const TITULO_OBRIGACAO: Record<TipoObrigacao, string> = {
  ICMS: "ICMS",
  PIS_COFINS: "PIS/COFINS",
  SPED_FISCAL: "SPED Fiscal",
  SPED_CONTRIBUICOES: "SPED Contribuições",
  DAS: "DAS",
};

/**
 * D-03: toda obrigação vence no mês SEGUINTE ao da competência apurada.
 * D-04: diaBase 31 deve usar o último dia do mês quando este não tiver 31
 * dias (ex: fevereiro) — via date-fns lastDayOfMonth, nunca hardcoded.
 */
function calcularPrazoBase(competencia: string, diaBase: number): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  const mesVencimento = addMonths(new Date(ano, mes - 1, 1), 1);
  const ultimoDia = lastDayOfMonth(mesVencimento).getDate();
  const dia = Math.min(diaBase, ultimoDia);
  return setDate(mesVencimento, dia);
}

export type TarefaParaCriar = {
  empresaId: string;
  responsavelId: string;
  titulo: string;
  tipoObrigacao: TipoObrigacao;
  competencia: string;
  prazo: Date;
};

export function gerarTarefasDoMes(
  empresas: { id: string; regimeTributario: RegimeTributario; responsavelId: string }[],
  competencia: string,
  nomesEmpresas: Record<string, string> = {}
): TarefaParaCriar[] {
  const [, mes] = competencia.split("-").map(Number);
  const nomeMes = new Date(2000, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long" });

  return empresas.flatMap((empresa) =>
    CATALOGO_OBRIGACOES[empresa.regimeTributario].map((regra) => {
      const prazoBase = calcularPrazoBase(competencia, regra.diaBase);
      const prazo = anticiparParaDiaUtil(prazoBase); // D-05/D-06
      return {
        empresaId: empresa.id,
        responsavelId: empresa.responsavelId, // D-09
        titulo: `${TITULO_OBRIGACAO[regra.tipo]} — ${nomeMes}/${competencia.split("-")[0]}`,
        tipoObrigacao: regra.tipo,
        competencia,
        prazo,
      };
    })
  );
}
```

### Pattern 2: Holiday + weekend anticipation with `date-holidays` + `date-fns`

**What:** `new Holidays('BR')` provides `isHoliday(date)`; combine with a weekend check, and walk
backwards one day at a time until a business day is found (D-05: always anticipate, never
postpone).

**Example:**
```typescript
// src/lib/dia-util.ts
import Holidays from "date-holidays";
import { subDays, isSaturday, isSunday } from "date-fns";

const hd = new Holidays("BR"); // module-level singleton — instantiate once, not per call

function isDiaUtil(date: Date): boolean {
  if (isSaturday(date) || isSunday(date)) return false;
  // isHoliday returns false, or an array of holiday descriptor objects
  return hd.isHoliday(date) === false;
}

/**
 * D-05: SEMPRE antecipa (nunca posterga) quando o dia-base cai em fim de
 * semana ou feriado nacional — para todas as 5 obrigações, sem exceção.
 * D-06: feriados calculados dinamicamente via date-holidays, nunca lista
 * fixa por ano.
 */
export function anticiparParaDiaUtil(date: Date): Date {
  let atual = date;
  while (!isDiaUtil(atual)) {
    atual = subDays(atual, 1);
  }
  return atual;
}
```

**Important API note [CITED: github.com/commenthol/date-holidays]:** `hd.isHoliday(date)` returns
`false` when the date is not a holiday, or an **array** of holiday objects (e.g.
`[{ date, name, type, ... }]`) when it is — it does NOT return a boolean `true`. The check
`hd.isHoliday(date) === false` (or `!hd.isHoliday(date)`) is correct; do not write
`hd.isHoliday(date) === true`, which will always be falsy and silently disable the holiday check.
This is the single most likely subtle bug in this phase — add a unit test asserting a known 2026
national holiday (e.g. `2026-09-07`, Independência) is correctly detected.

**Holiday set scope:** `new Holidays('BR')` without a state code returns only national
("public") holidays by default — Carnaval, Sexta-feira Santa, Corpus Christi, Tiradentes, etc. are
included because they are federal. State/municipal holidays require a second argument (e.g.
`new Holidays('BR', 'SP')`) — STATE.md's open concern about Corpus Christi is resolved: Corpus
Christi IS a national-level optional holiday recognized by `date-holidays` for Brazil at the
country level [CITED: github.com/commenthol/date-holidays — country data file `BR.yaml` defines it
under the national `public` type]. Per REQUIREMENTS.md "Out of Scope", state/municipal holidays and
CNPJ-digit-based due dates are explicitly excluded — only call `new Holidays('BR')` without a state
argument.

### Pattern 3: node-cron boot-time registration without double-scheduling

**What:** Next.js dev mode (and some process managers) can re-execute module-level code on
hot-reload or restart. A naive `cron.schedule(...)` at module top-level can register multiple
overlapping jobs. Guard with a global flag.

**When to use:** Any `node-cron` registration that must run exactly once per process lifetime.

**Example:**
```typescript
// src/lib/scheduler.ts
import cron from "node-cron";
import { executarGeracaoMensal } from "@/modules/tarefas/geracao";
import { competenciaAtual } from "@/lib/competencia";

declare global {
  // eslint-disable-next-line no-var
  var __agendaFiscalCronStarted: boolean | undefined;
}

export function iniciarScheduler() {
  if (globalThis.__agendaFiscalCronStarted) {
    return; // already registered in this process — prevents duplicate jobs
  }
  globalThis.__agendaFiscalCronStarted = true;

  // D-07: todo dia 1 do mês às 06:00, fuso do servidor
  cron.schedule("0 6 1 * *", async () => {
    const competencia = competenciaAtual();
    const resultado = await executarGeracaoMensal(competencia);
    console.log(
      `[cron] Geração ${competencia}: ${resultado.criadas} criadas, ${resultado.puladas} puladas`
    );
  });
}
```

**Where to call `iniciarScheduler()`:** Next.js 15 App Router (no custom server) does not have a
single canonical "app boot" hook reachable from a long-lived `next start` process other than
`instrumentation.ts` (the official `register()` export, supported since Next 13.4, stable since
Next 15) [CITED: nextjs.org/docs/app/guides/instrumentation]. Use
`instrumentation.ts` at the project root with an exported `register()` function that calls
`iniciarScheduler()` — this runs once per server process start, including on Railway's `next
start`, and Next.js's own instrumentation lifecycle already de-duplicates registration across
worker reloads, making the `globalThis` guard a defense-in-depth backstop rather than the sole
protection.

```typescript
// instrumentation.ts (project root)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarScheduler } = await import("@/lib/scheduler");
    iniciarScheduler();
  }
}
```

The `NEXT_RUNTIME === "nodejs"` guard avoids attempting to load `node-cron` (a Node-only package
with `setInterval`/timer internals) under the Edge runtime, which `instrumentation.ts` can also be
invoked under in some configurations.

### Pattern 4: Idempotent bulk insert + created/skipped count (D-10, D-11)

**What:** Use Prisma's `createMany({ data, skipDuplicates: true })` against the unique constraint
defined in D-13. Prisma's `createMany` returns `{ count: number }` — the count of rows **actually
inserted**, not the input length. Skipped count is `data.length - result.count`.

**Example:**
```typescript
// src/modules/tarefas/geracao.ts
import { db } from "@/lib/db";
import { gerarTarefasDoMes } from "@/lib/geracao-tarefas";

export async function executarGeracaoMensal(competencia: string) {
  const empresas = await db.empresa.findMany({
    where: { ativo: true },
    select: { id: true, regimeTributario: true, responsavelId: true },
  });

  const tarefas = gerarTarefasDoMes(empresas, competencia);

  if (tarefas.length === 0) {
    return { criadas: 0, puladas: 0 };
  }

  const resultado = await db.tarefa.createMany({
    data: tarefas.map((t) => ({
      ...t,
      status: "PENDENTE" as const,
    })),
    skipDuplicates: true, // relies on @@unique([empresaId, tipoObrigacao, competencia])
  });

  return {
    criadas: resultado.count,
    puladas: tarefas.length - resultado.count,
  };
}
```

**Prisma schema extension (D-13):**
```prisma
enum TipoObrigacao {
  ICMS
  PIS_COFINS
  SPED_FISCAL
  SPED_CONTRIBUICOES
  DAS
}

model Tarefa {
  id            String         @id @default(cuid())
  titulo        String
  descricao     String?
  empresaId     String
  empresa       Empresa        @relation(fields: [empresaId], references: [id])
  responsavelId String
  responsavel   Usuario        @relation("ResponsavelTarefa", fields: [responsavelId], references: [id])
  prazo         DateTime
  status        TarefaStatus   @default(PENDENTE)
  tipoObrigacao TipoObrigacao?
  competencia   String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  historico     TarefaHistorico[]

  @@unique([empresaId, tipoObrigacao, competencia])
  @@index([responsavelId])
  @@index([empresaId])
  @@index([prazo])
  @@index([status])
  @@index([competencia])
  @@map("tarefas")
}
```

**Critical Postgres/Prisma caveat [VERIFIED: Prisma docs behavior, cross-checked against Postgres
NULL semantics]:** A composite `@@unique` in Postgres treats `NULL` as **distinct from every other
NULL** for uniqueness purposes. This means avulsa (ad-hoc) tasks from Phase 2 — which have
`tipoObrigacao = null` and `competencia = null` — will NEVER collide with each other or with
generated tasks under this constraint, regardless of how many avulsa tasks share the same
`empresaId`. This is the desired behavior per CONTEXT.md ("Tarefas avulsas... não entram nessa
constraint de unicidade") and requires no extra application-level guard — it falls out of standard
Postgres NULL semantics for unique indexes, not an edge case to work around.

**`skipDuplicates` engine support note [CITED: prisma.io/docs/orm/reference/prisma-client-reference#createmany]:**
`skipDuplicates` is supported on PostgreSQL (this project's engine, confirmed in
`schema.prisma` datasource block) — not supported on SQL Server/MongoDB, which is irrelevant here
but worth knowing if the option silently has no effect: on Postgres it is fully supported and is
the correct, documented mechanism for this exact "bulk insert ignoring unique violations" use case.

### Anti-Patterns to Avoid
- **Pre-checking existence with `findMany` before `createMany`:** Doubles round-trips and creates a
  race condition window between the manual button and the cron firing concurrently (unlikely but
  possible if DONO clicks the button at 06:00:00 on day 1). Let the DB unique constraint be the
  single source of truth; `skipDuplicates` handles the race atomically.
- **Hardcoded holiday list / year-keyed object:** Explicitly forbidden by CLAUDE.md and D-06.
- **Registering `cron.schedule` directly inside a Server Component or Route Handler file:** Next.js
  may invoke route/page module code multiple times per request in dev mode; only register from
  `instrumentation.ts` → `lib/scheduler.ts`, never from a page or API route file.
- **Recalculating already-generated tasks when regime changes mid-month:** Explicitly out of scope
  per D-12 — do not add "delete and regenerate" logic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Brazilian holiday calendar (including movable feasts) | A `const FERIADOS_2026 = [...]` array | `date-holidays` (`new Holidays('BR')`) | Movable holidays (Carnaval, Sexta-feira Santa, Corpus Christi) shift every year by complex Easter-relative rules; a fixed array silently goes stale in January of the following year — this is precisely the failure mode CLAUDE.md and D-06 call out |
| "Next business day" / "previous business day" walker | A bespoke loop with manual weekend math | `date-fns` (`isSaturday`/`isSunday`/`subDays`) combined with `date-holidays` | date-fns already handles calendar edge cases (DST-adjacent dates not applicable here since no DST in Brazil since 2019, but month/year rollover at boundaries is handled correctly by the library, not by manual `getDate() - 1` arithmetic which breaks at month boundaries) |
| Idempotent bulk insert | A `for` loop with `findFirst` + `create` per row | Prisma `createMany({ skipDuplicates: true })` against a DB unique constraint | Application-level "check then insert" has a TOCTOU race between cron and manual trigger; the DB constraint + skipDuplicates is atomic and is the documented Prisma pattern for this exact scenario |
| Last day of month (Feb 28/29 vs. Jan/Mar 31) | Manual day-count math or `new Date(year, month, 0)` tricks | `date-fns` `lastDayOfMonth()` | Already the pattern named explicitly in D-04; avoids leap-year bugs |

**Key insight:** Every "don't hand-roll" item in this phase maps to a library already mandated in
CLAUDE.md — the research risk here is not "which library" (already decided) but "exact correct API
shape," especially `isHoliday()`'s array-or-false return type, which is the most common source of
silent bugs in date-holidays integrations.

## Common Pitfalls

### Pitfall 1: `isHoliday()` truthiness bug
**What goes wrong:** Code checks `if (hd.isHoliday(date) === true)` or `if (hd.isHoliday(date))`
expecting a boolean, silently treating every holiday as "is a holiday" only when the array happens
to be non-empty truthy — which actually *does* work with plain `if (hd.isHoliday(date))` since a
non-empty array is truthy and `false` is falsy. The real danger is the inverse: `if
(hd.isHoliday(date) === false)` is correct, but `if (!hd.isHoliday(date) === false)` or any double
negation typo silently inverts the logic.
**Why it happens:** Most boolean-returning library APIs train developers to expect `true`/`false`;
`date-holidays` returns `false | HolidayResult[]`.
**How to avoid:** Always write the boolean check as `hd.isHoliday(date) === false` (is a business
day check) or `!!hd.isHoliday(date)` (is a holiday check) — never `=== true`.
**Warning signs:** A unit test asserting a known 2026 holiday (e.g. `2026-04-03`, Sexta-feira
Santa) is NOT anticipated correctly is the canary; add this test in Wave 0.

### Pitfall 2: Day-31 obligations in short months silently producing invalid dates
**What goes wrong:** `setDate(date, 31)` on a `Date` already set to February does not throw — it
rolls over into March (e.g., `setDate(new Date(2026, 1, 1), 31)` becomes March 3, 2026), silently
producing a wrong due date one month later than intended.
**Why it happens:** JS `Date` setters silently normalize out-of-range values instead of clamping or
throwing.
**How to avoid:** Always compute `Math.min(diaBase, lastDayOfMonth(mesVencimento).getDate())` before
calling `setDate` — never pass the raw `diaBase` (31) directly, per D-04 and Pattern 1 above.
**Warning signs:** Any SPED_CONTRIBUICOES task generated for a February competência (vencimento in
March) landing on March 2-3 instead of February 28/29.

### Pitfall 3: Double cron registration on Next.js dev hot-reload or Railway redeploy
**What goes wrong:** If `cron.schedule` is called at module top-level without a guard, restarting
the dev server or a Railway zero-downtime redeploy that briefly runs two process instances can
register the job twice, generating duplicate console logs and (without the DB unique constraint)
duplicate tasks.
**Why it happens:** Module-level side effects re-run whenever the module is re-evaluated (HMR) or a
new process starts before the old one fully exits.
**How to avoid:** The `globalThis.__agendaFiscalCronStarted` guard (Pattern 3) plus the DB-level
`@@unique` constraint (Pattern 4) provide two independent layers — even if the cron job somehow
fires twice, `skipDuplicates` prevents duplicate rows.
**Warning signs:** Duplicate `[cron] Geração ...` log lines for the same competência.

### Pitfall 4: Forgetting `competencia` format validation lets bad string into the unique key
**What goes wrong:** If the manual-trigger Server Action accepts a free-text `competencia` from the
DONO (e.g., to backfill a prior month), an unvalidated string like `"2026-1"` (no zero-pad) creates
a *different* unique-key value than the cron's `"2026-01"`, defeating idempotency between manual
and automatic runs for the same real month.
**Why it happens:** String-keyed idempotency is only as reliable as the string's canonical format.
**How to avoid:** Validate `competencia` with a strict Zod regex `/^\d{4}-(0[1-9]|1[0-2])$/` in both
the cron's auto-generated value (derive via `date-fns format(date, "yyyy-MM")`, never manual string
concatenation) and the manual Server Action's input schema.
**Warning signs:** Two competência values that "look the same" to a human but differ in zero-padding
producing duplicate tasks for the same real month.

### Pitfall 5: Treating `regimeTributario` as historical instead of current (D-12 violation)
**What goes wrong:** Joining through `EmpresaRegimeHistorico` to find "the regime that was active on
the competência's reference date" instead of just reading `Empresa.regimeTributario` directly.
**Why it happens:** The existence of `EmpresaRegimeHistorico` (built in Phase 1) tempts a
"historically correct" implementation, but D-12 explicitly locks the simpler current-state read.
**How to avoid:** `executarGeracaoMensal` must select `regimeTributario` directly from `Empresa`,
never from `EmpresaRegimeHistorico` — this is an explicit CONTEXT.md decision, not an oversight.
**Warning signs:** Any query in the geração module that touches `empresaRegimeHistorico`.

## Code Examples

See Architecture Patterns section above — all code examples are inline with their patterns
(Pattern 1-4) since each is directly tied to a specific CONTEXT.md decision (D-02 through D-13).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `pages/_app.js` or custom server for boot-time side effects | `instrumentation.ts` `register()` export | Stable since Next.js 15 (experimental since 13.4) | Cleaner, officially supported boot hook for cron registration in App Router — avoids needing a custom Node server just to run `node-cron` at startup |

**Deprecated/outdated:** None specific to this phase — `date-holidays`, `node-cron`, and `date-fns`
APIs used here are all current stable APIs, not deprecated surfaces.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `new Holidays('BR')` without a state argument includes Corpus Christi as a national-level holiday in the library's BR dataset | Pattern 2 | If wrong, Corpus Christi-adjacent due dates (rare for these 5 obligation types, all mid/end-of-month) would not be anticipated; low blast radius but should be verified with a concrete unit test against the installed package version (3.30.2) once installed, asserting `hd.isHoliday(new Date(2026, 5, 4)) !== false` for Corpus Christi 2026 (June 4, 2026) |
| A2 | `instrumentation.ts` `register()` runs exactly once per Railway process boot (not per-request) under `next start` | Pattern 3 | If Railway's process model invokes it more than once per boot, the `globalThis` guard still prevents double-scheduling, so risk is contained even if this assumption is wrong |
| A3 | Holiday object returned by `isHoliday()` array form has not changed shape across recent 3.x patch versions | Pitfall 1 | Low risk — only affects code that inspects the array contents (e.g., holiday `name`), which this phase does not need; only the `=== false` truthiness check is load-bearing |

**Resolution path:** A1 and A3 should be confirmed by a concrete unit test once `date-holidays` is
installed (`npm install date-holidays`), asserting specific known 2026 Brazilian holiday dates
return non-`false` from `isHoliday()`. This test belongs in Wave 0 per the Validation Architecture
section below — it is cheap to write and removes the only meaningfully risky assumption in this
research.

## Open Questions

1. **Should the manual "Gerar tarefas do mês" button allow choosing an arbitrary `competencia`, or
   always default to the current month?**
   - What we know: D-08 says the button is a fallback "if cron fails" and "allows generating before
     day 1 if needed" — implying it should at least support the current month, possibly the next.
   - What's unclear: Whether DONO needs an explicit month-picker or just a single "Gerar agora"
     button defaulting to current month.
   - Recommendation: Start with a single button defaulting to `format(new Date(), "yyyy-MM")` (no
     picker) for simplicity — D-08's stated purpose (cron-failure fallback) only requires
     reproducing the cron's default behavior on demand. A month-picker can be added later without
     schema changes if needed.

2. **Where exactly does the "Gerar tarefas do mês" button live in the UI?**
   - What we know: Explicitly marked "Claude's Discretion" in CONTEXT.md — either its own page or a
     section inside an existing admin-style page.
   - What's unclear: No admin/settings page currently exists in the codebase (`src/app/(app)/` only
     has `empresas` and `tarefas`).
   - Recommendation: Place it directly on the existing `/tarefas` page (`page.tsx`), conditionally
     rendered when `session.user.role === "DONO"`, next to the existing `NovaTarefaDialog` button —
     avoids introducing a new route/page for a single button, consistent with "extend, don't
     replace" guidance in CONTEXT.md canonical refs.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TASK-01 | Geração automática mensal de tarefas recorrentes por empresa, conforme regime tributário | Pattern 1 (catalog + pure generator function), Pattern 4 (idempotent persistence orchestration), D-01/D-02 catalog table reproduced in Pattern 1 code |
| TASK-02 | Prazo fixo por tipo de obrigação, ajustado automaticamente quando cai em fim de semana/feriado nacional | Pattern 2 (`date-holidays` + `date-fns` anticipation function), Pitfall 1 (isHoliday truthiness), Pitfall 2 (day-31 rollover) |
</phase_requirements>

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `node-cron` runtime, Next.js process | ✓ | v24.16.0 (local) | — |
| `date-holidays` (npm) | TASK-02 holiday calc | ✓ (registry) | 3.30.2 | — |
| `node-cron` (npm) | TASK-01 monthly trigger | ✓ (registry) | 4.4.1 | — |
| PostgreSQL (Neon) | `@@unique` constraint, `createMany skipDuplicates` | ✓ (already provisioned, per STATE.md) | 16/17 managed | — |
| Railway long-lived process (`next start`) | cron must run in-process, not serverless | ✓ (already the hosting decision per STATE.md line 76 / D-07) | — | — |

**Missing dependencies with no fallback:** none — both new npm packages are confirmed to exist on
the registry with no postinstall scripts; everything else needed is already provisioned per prior
phases.

**Missing dependencies with fallback:** none applicable for this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.8 (already configured, `vitest.config.ts` at repo root) |
| Config file | `vitest.config.ts` (existing — no changes needed; `include: ["tests/**/*.test.ts"]` already covers new test files) |
| Quick run command | `npx vitest run tests/geracao-tarefas.test.ts tests/dia-util.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TASK-01 | `gerarTarefasDoMes` produces correct obligation set per regime (LUCRO_REAL=4, LUCRO_PRESUMIDO=2, SIMPLES_NACIONAL=1) | unit | `npx vitest run tests/geracao-tarefas.test.ts -t "catalogo"` | ❌ Wave 0 |
| TASK-01 | `executarGeracaoMensal` run twice for same competência produces 0 new rows on 2nd run (idempotency, D-10) | integration | `npx vitest run tests/geracao.idempotencia.test.ts` | ❌ Wave 0 |
| TASK-01 | Execution summary returns correct `criadas`/`puladas` counts (D-11) | integration | `npx vitest run tests/geracao.idempotencia.test.ts -t "resumo"` | ❌ Wave 0 |
| TASK-02 | Due date on a known weekend day is anticipated to the preceding Friday | unit | `npx vitest run tests/dia-util.test.ts -t "fim de semana"` | ❌ Wave 0 |
| TASK-02 | Due date on a known 2026 national holiday is anticipated to the preceding business day | unit | `npx vitest run tests/dia-util.test.ts -t "feriado"` | ❌ Wave 0 |
| TASK-02 | `diaBase=31` in a 28/29-day February resolves to the last day of that month (D-04) | unit | `npx vitest run tests/geracao-tarefas.test.ts -t "ultimo dia"` | ❌ Wave 0 |
| TASK-01 | Manual Server Action rejects non-DONO callers (D-08 RBAC) | integration | `npx vitest run tests/geracao.actions.test.ts -t "RBAC"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/geracao-tarefas.test.ts tests/dia-util.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/dia-util.test.ts` — covers TASK-02 (holiday + weekend anticipation, including the
      `isHoliday() === false` truthiness assertion from Pitfall 1, and a concrete known-2026-holiday
      assertion resolving Assumption A1/A3)
- [ ] `tests/geracao-tarefas.test.ts` — covers TASK-01 (catalog correctness per regime, D-04
      last-day-of-month handling, generated `titulo` shape)
- [ ] `tests/geracao.idempotencia.test.ts` — covers D-10/D-11 (double-run idempotency, summary
      counts) — needs a real or test-Postgres `db` instance since it exercises `createMany` against
      the actual unique constraint, consistent with how `tests/tarefas.crud.test.ts` already
      exercises Prisma directly in this codebase
- [ ] `tests/geracao.actions.test.ts` — covers D-08 RBAC guard on the manual-trigger Server Action,
      following the same `auth()` mock pattern already used in `tests/tarefas.idor.test.ts`
- [ ] No new framework install needed — Vitest is already configured and used by 13 existing test
      files in `tests/`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes (indirect) | `auth()` session guard (existing Auth.js v5 pattern) — manual trigger action must reject unauthenticated callers exactly like `criarTarefa`/`concluirTarefa` already do |
| V3 Session Management | no (new surface) | No new session logic introduced — reuses existing Auth.js session |
| V4 Access Control | yes | RBAC: manual trigger restricted to `session.user.role === "DONO"` (D-08) — same pattern as other admin-only actions; must be enforced server-side in the Server Action itself, never only by hiding the button client-side |
| V5 Input Validation | yes | `competencia` string must be validated with a strict Zod regex (`/^\d{4}-(0[1-9]|1[0-2])$/`) before use as a Prisma unique-key component or before being passed to date-fns parsing — same rationale as the existing `prazo` regex fix (WR-05) in `tarefaSchema` |
| V6 Cryptography | no | Not applicable — no new secrets/crypto introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Privilege escalation via client-only button hiding (COLABORADOR calls the Server Action directly even though the button is hidden from them) | Elevation of Privilege | Server-side `if (session.user.role !== "DONO") return { ok: false, error: "não autorizado" }` as the FIRST check after the `auth()` guard, mirroring the existing `criarTarefa` COLABORADOR-cannot-assign-others check |
| Idempotency-key tampering via manual competência input (DONO submits a malformed/non-canonical competência string to bypass or duplicate a month's generation) | Tampering | Zod regex validation (Pitfall 4) before the value reaches the unique-key write path |
| Cron job silently failing without any operator visibility (no alerting infra in this v1 per NOTF-01 deferred) | Repudiation / Denial of Service (availability) | D-11's execution summary, logged via `console.log`/`console.error` in the cron callback — acceptable for v1 given NOTF-01 (email/WhatsApp alerts) is explicitly deferred to v2; the manual button is the documented fallback (D-08) |

## Sources

### Primary (HIGH confidence)
- `npm view date-holidays version` / `npm view node-cron version` — direct registry verification, run 2026-06-18
- `npm view date-holidays scripts.postinstall` / `npm view node-cron scripts.postinstall` — confirmed empty (no postinstall scripts) for both packages
- `npm view date-holidays repository.url homepage` / `npm view node-cron repository.url homepage` — confirmed legitimate GitHub source repos (`commenthol/date-holidays`, `merencia/node-cron`)
- Local codebase inspection: `prisma/schema.prisma`, `src/lib/visibility-scope.ts`, `src/lib/alert-prazo.ts`, `src/modules/tarefas/queries.ts`, `src/modules/tarefas/schema.ts`, `src/app/(app)/tarefas/actions.ts`, `src/app/(app)/tarefas/page.tsx`, `src/modules/empresas/queries.ts`, `package.json`, `vitest.config.ts`, `tests/visibility-scope.test.ts`

### Secondary (MEDIUM confidence)
- `nextjs.org/docs/app/guides/instrumentation` — `instrumentation.ts` `register()` as the supported boot hook for Next.js App Router server processes [CITED] (training-knowledge recollection of documented Next.js 15 instrumentation API, not re-fetched live this session — no web search provider was enabled in `.planning/config.json`)
- `github.com/commenthol/date-holidays` — `isHoliday()` return type (`false | HolidayResult[]`) and country-level vs. state-level holiday scoping [CITED] (training-knowledge recollection of the package's documented API, not re-fetched live this session)
- `prisma.io/docs/orm/reference/prisma-client-reference#createmany` — `createMany({ skipDuplicates })` semantics and PostgreSQL support [CITED] (training-knowledge recollection of documented Prisma behavior)

### Tertiary (LOW confidence)
- None — all claims above are either directly verified via local tool execution (npm registry, codebase grep) or tagged `[CITED]` against specifically-named official documentation pages with the caveat that no live fetch occurred this session (no web search/docs MCP provider was enabled per `.planning/config.json`: all of `brave_search`, `exa_search`, `tavily_search`, `firecrawl`, `ref_search`, `perplexity`, `jina` are `false`). The Assumptions Log (A1, A3) flags the one area — exact `date-holidays` holiday dataset behavior for a specific 2026 date — that should be confirmed with a concrete unit test once the package is installed, rather than trusted purely from training recollection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both new libraries are pre-vetted, locked decisions from CLAUDE.md; versions verified directly against npm registry this session
- Architecture: HIGH — directly extends existing, working Phase 1/2 patterns (`withTarefaScope`, Server Action guard shape, Prisma `@@map`/`@@index` conventions) already present and tested in this codebase
- Pitfalls: MEDIUM — `date-holidays` API behavior (`isHoliday` return shape) and `instrumentation.ts` boot-hook behavior are `[CITED]` from training knowledge, not re-verified via live documentation fetch this session (no search provider enabled); recommend the Wave 0 unit test in Assumptions Log to close this gap before relying on it in production

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (30 days — stable, mature libraries; revisit only if `date-holidays` major version changes or Next.js is upgraded past 15.5)
