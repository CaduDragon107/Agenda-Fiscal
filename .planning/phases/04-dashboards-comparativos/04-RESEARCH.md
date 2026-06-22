# Phase 4: Dashboards Comparativos - Research

**Researched:** 2026-06-22
**Domain:** Prisma snapshot/aggregation modeling, Recharts via shadcn `chart` component, boot-time cron hook extension, DONO-only Server Components
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Critério de "no prazo" (DASH-01)**
- D-01: Uma tarefa é considerada "no prazo" quando `TarefaHistorico.concluidoEm <= Tarefa.prazo` (o campo `prazo` já é o resultado do ajuste para próximo dia útil feito pelo motor de geração na Fase 3 — não recalcular feriados/dias úteis aqui).
- D-02: Apenas tarefas com `status = CONCLUIDA` entram no cálculo de % no prazo. Tarefas ainda `PENDENTE` (mesmo que já vencidas) não contam nem como "no prazo" nem como "atrasada" até serem concluídas — ficam fora do denominador do dashboard de desempenho por colaborador.

**Normalização entre colaboradores (DASH-01)**
- D-03: Métrica primária é percentual: tarefas concluídas no prazo / total de tarefas concluídas no período, por colaborador. Mostrar também o volume absoluto (nº de empresas na carteira, nº de tarefas) como contexto secundário ao lado do percentual — não ocultar o tamanho da carteira.

**Congelamento de meses fechados (DASH-02)**
- D-04: Snapshot automático: quando o cron mensal (Fase 3, `executarGeracaoMensal`, disparado dia 1) gera as tarefas do novo mês, ele também calcula e persiste o snapshot de desempenho do mês anterior (mês que acabou de fechar) numa tabela nova (ex: `DesempenhoMensal` — por colaborador e/ou agregado). Isso roda no mesmo `instrumentation.ts` boot hook já existente, mesmo ponto de entrada do cron de Fase 3.
- D-05: O mês corrente (ainda em andamento) é calculado on-the-fly a partir de Tarefa/TarefaHistorico em tempo real — não tem snapshot ainda. Meses já fechados (com snapshot persistido) nunca são recalculados ao acessar o dashboard, mesmo que dados históricos mudem retroativamente (ex: edição manual de uma tarefa antiga).

**Ranking de empresas problemáticas (DASH-03)**
- D-06: Métrica é percentual: tarefas atrasadas / total de tarefas da empresa no período (mesma lógica de "atrasada" = concluída após o prazo, OU pendente com prazo já vencido — esta segunda condição é específica deste dashboard, diferente do D-02 que exclui pendentes do desempenho por colaborador). Ordenar do maior para o menor percentual de atraso.

### Claude's Discretion
- Definição exata de "atrasada" para uma tarefa ainda `PENDENTE` com prazo vencido no contexto do DASH-03 (D-06) — considerar atrasada a partir do momento em que `prazo < now()`, sem necessidade de confirmação adicional do usuário.
- Período padrão de exibição (mês atual, últimos 6 meses, ano) e estrutura de navegação (página única com 3 seções vs páginas separadas vs tabs) ficam a critério da pesquisa/planejamento, guiados pelos padrões de UI já estabelecidos no projeto (shadcn, Recharts via `chart` component conforme CLAUDE.md).

### Deferred Ideas (OUT OF SCOPE)
Nenhuma ideia de novo escopo surgiu durante a discussão — manteve-se dentro do domínio da fase (3 dashboards somente leitura).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Dashboard comparativo de desempenho entre os funcionários (no prazo vs atrasado) | Prisma `groupBy` pattern (Pattern 2) over `Tarefa`/`TarefaHistorico` for current month + `DesempenhoMensal` read for closed months (Pattern 1, 3); bar chart via shadcn `chart` (Pattern 4) |
| DASH-02 | Dashboard de evolução mensal (tendências de cumprimento de prazos ao longo do tempo) | `DesempenhoMensal` snapshot schema (Pattern 1) populated at cron close-out (Pattern 3); area/line chart over N months (Pattern 5) |
| DASH-03 | Dashboard comparativo entre empresas (quais geram mais atraso/problema recorrente) | Per-empresa aggregation query including overdue-PENDENTE (Pattern 6); ranked bar/table (Pattern 7) |
</phase_requirements>

## Summary

Phase 4 is a read-only reporting layer over data structures already fully built (Phases 1-3): `Tarefa`, `TarefaHistorico`, `Empresa`, `Usuario`. No new mutations on these tables are needed — the only new write path is a single new table, `DesempenhoMensal`, written exactly once per month by the existing boot-time cron (`instrumentation.ts` → `iniciarScheduler` → now also a snapshot step), satisfying the "frozen closed months" requirement (D-04/D-05) without introducing a second scheduling mechanism. The current (open) month is always computed live via Prisma `groupBy`/`aggregate` against `Tarefa`/`TarefaHistorico`, scales comfortably at ~100-110 empresas (a handful of aggregate queries, not N+1 per-empresa loops). All three dashboards reuse the exact DONO-only role-check pattern already established in `gerarTarefasDoMesAction` (role check immediately after `auth()`, before any DB access) and the same Server Component + Server Action architecture (no API routes) used throughout the codebase.

The only new external dependency is the shadcn `chart` component (`npx shadcn add chart`), which installs `recharts` as a transitive dependency and copies `src/components/ui/chart.tsx` into the repo (visible, editable source — consistent with the project's existing shadcn pattern). The project's `globals.css` already defines `--chart-1` through `--chart-5` CSS variables (currently a greyscale palette under the `radix-nova` style), so no new theming work is required before using the chart wrappers.

**Primary recommendation:** Add `DesempenhoMensal` (one row per colaborador per closed competência, with empresa-level rows folded into a second lightweight on-the-fly path for DASH-03 — see Pattern 1 rationale) written transactionally inside `executarGeracaoMensal` right before it generates the new month's tasks; compute the current month for all three dashboards via three small Prisma `groupBy` calls; render all charts with the shadcn `chart` wrappers over `recharts`; gate all three dashboard routes with the same `role !== "DONO"` guard already used in `tarefas/actions.ts`; use a single `/dashboards` page with three stacked sections (not tabs) for the v1 navigation, replacing the disabled sidebar placeholder already present in `app-sidebar.tsx`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Snapshot persistence (closed months) | Database/Storage (`DesempenhoMensal` table + unique constraint) | API/Backend (write inside `executarGeracaoMensal` transaction) | Frozen historical numbers must live in a durable, never-recalculated row — matches the same "DB constraint is source of truth" pattern Phase 3 used for idempotency |
| Current-month aggregation | API/Backend (Prisma `groupBy`/`aggregate`, pure read) | — | No I/O write involved; must be fast and N+1-free at ~100-110 empresas; lives entirely server-side, never sent to client as raw rows |
| Snapshot write trigger | API/Backend (`instrumentation.ts` boot hook → `iniciarScheduler` → cron callback) | — | Reuses the exact Phase 3 entry point; no second cron mechanism (explicit constraint from D-04) |
| Dashboard rendering (charts) | Browser/Client (`"use client"` chart wrapper components) | API/Backend (Server Component fetches data, passes as props) | Recharts requires browser DOM/canvas APIs — charts must be client components, but all data fetching/aggregation/authorization stays server-side per the existing Server Component pattern |
| Role gating (DONO-only) | API/Backend (Server Component `auth()` + role check) | Browser/Client (sidebar nav item hidden for COLABORADOR — defense in depth only) | Identical to the established pattern: the UI hiding the nav link is never the real barrier; the page-level guard is |
| Navigation entry | Browser/Client (sidebar) | — | Pure UI wiring, already has a disabled placeholder in `app-sidebar.tsx` ready to be enabled |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `recharts` | 3.8.1 [VERIFIED: npm registry] | Underlying charting engine for all 3 dashboards | Mandated transitively by CLAUDE.md's "Recharts via shadcn `chart` component" rule; do not install directly — let `npx shadcn add chart` resolve the compatible version |
| `shadcn` chart component (`src/components/ui/chart.tsx`) | latest, via CLI (no fixed npm version — copied source) [CITED: ui.shadcn.com/docs/components/radix/chart] | `ChartContainer`/`ChartConfig`/`ChartTooltip`/`ChartTooltipContent`/`ChartLegend`/`ChartLegendContent` wrappers | CLAUDE.md mandate; consistent with project's existing CLI-copied-source pattern (not a black-box node_modules dependency) |
| Prisma `groupBy`/`aggregate` | 6.19.3 (installed) [VERIFIED: already in package.json] | Server-side aggregation for current-month metrics (colaborador and empresa level) | Already the project's ORM; `groupBy` avoids N+1 loops over ~100-110 empresas in a single round trip |
| `date-fns` | ^4.4.0 (installed) [VERIFIED: already in package.json] | Month-range boundaries (`startOfMonth`, `endOfMonth`, `subMonths`) for both the snapshot write and the on-the-fly current-month query | Already installed and used since Phase 2/3 (`competencia.ts`); reuse, don't hand-roll month boundary math |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | ^3.25.76 (installed) | Validate any user-facing query params (e.g., `?meses=6` range selector) on dashboard pages | Same pattern as `competenciaSchema` — never trust raw search params without parse |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts (via shadcn) | Tremor / Chart.js / Nivo | CLAUDE.md explicitly rejects these (competes with shadcn's component system or requires more manual theming); not researched further per locked decision |
| New `DesempenhoMensal` table per-colaborador-row | Single aggregated-JSON blob column on a "fechamento" table | Per-row (colaboradorId, competencia) is queryable/indexable for DASH-02 trend charts and matches the project's existing relational modeling style (no JSON blobs used elsewhere in schema.prisma) |
| Snapshot written inside `executarGeracaoMensal`'s existing transaction | Separate cron job for snapshot | Explicitly rejected per D-04 — would be a second scheduling mechanism, against the locked decision |

**Installation:**
```bash
npx shadcn@latest add chart
```
This single command installs `recharts` as a dependency (verified: resolves to `3.8.1` on the public npm registry as of this research) and writes `src/components/ui/chart.tsx`. No `npm install recharts` should be run manually — let the CLI pin the compatible version, consistent with how `shadcn` already manages `radix-ui` derived components in this project.

**Version verification:** `npm view recharts version` → `3.8.1`, published 2026-03-25, ~53.3M weekly downloads, official repo `github.com/recharts/recharts`, no `postinstall` script. Verified live during this research session via `npm view`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| recharts | npm | ~10 yrs (first published 2015-08-07) | 53.3M/wk | github.com/recharts/recharts | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Verified via `gsd-tools query package-legitimacy check --ecosystem npm recharts` → `verdict: "OK"`, cross-checked with `npm view recharts time.created` and `npm view recharts repository.url`. No `postinstall` script signal present. This is the only new external package this phase introduces (the shadcn `chart` component itself is copied source via the already-installed `shadcn` CLI, not a separate registry dependency).

## Architecture Patterns

### System Architecture Diagram

```
[Cron boot: instrumentation.ts -> iniciarScheduler (existing, Phase 3)]
        |
        v
  cron.schedule("0 6 1 * *")
        |
        v
  executarGeracaoMensal(competenciaAtual())  <-- EXTENDED this phase
        |
        |-- (existing) gera tarefas do novo mes, createMany skipDuplicates
        |
        +-- (NEW) calcula snapshot do mes ANTERIOR (mes que acabou de fechar)
              |
              v
        db.desempenhoMensal.createMany({ skipDuplicates: true })
              |
              v
        [DesempenhoMensal table -- frozen, never recalculated]

---

[DONO requests GET /dashboards]
        |
        v
  Server Component (auth() -> role check DONO, else redirect/404)
        |
        |-- queryDesempenhoColaboradores(competencias[])
        |     |-- mes corrente -> groupBy live on Tarefa/TarefaHistorico
        |     +-- meses fechados -> SELECT from DesempenhoMensal (no recompute)
        |
        |-- queryEvolucaoMensal(ultimosNMeses)
        |     +-- mistura snapshot (fechados) + live (corrente) na mesma serie temporal
        |
        +-- queryRankingEmpresas(periodo)
              +-- groupBy live on Tarefa (PENDENTE vencida OU CONCLUIDA fora do prazo) por empresaId
        |
        v
  passa dados agregados (numeros, nao linhas crus) como props para
  client components "use client" (DashboardColaboradoresChart, etc.)
        |
        v
  ChartContainer (shadcn) -> Recharts (Bar/Line/Area)
```

### Recommended Project Structure
```
prisma/
└── schema.prisma                          # + model DesempenhoMensal
src/
├── modules/
│   └── dashboards/
│       ├── queries.ts                     # listarDesempenhoColaboradores, listarEvolucaoMensal, listarRankingEmpresas
│       ├── snapshot.ts                    # calcularESalvarSnapshotMensal (chamado por geracao.ts)
│       └── schema.ts                      # zod para query params (?meses=6 etc.), se necessario
├── modules/tarefas/
│   └── geracao.ts                         # MODIFICADO: chama calcularESalvarSnapshotMensal antes/depois de gerar tarefas
├── components/ui/
│   └── chart.tsx                          # gerado por `npx shadcn add chart`
├── app/(app)/
│   └── dashboards/
│       ├── page.tsx                       # Server Component: auth+role guard, busca os 3 datasets, renderiza 3 secoes
│       ├── desempenho-colaboradores-chart.tsx   # "use client"
│       ├── evolucao-mensal-chart.tsx             # "use client"
│       └── ranking-empresas-chart.tsx            # "use client" (ou tabela, ver Pattern 7)
tests/
├── dashboards.snapshot.test.ts            # cobre congelamento D-05 (snapshot nao recalcula)
├── dashboards.queries.test.ts             # cobre D-01/D-02/D-03/D-06 (regras de calculo)
└── dashboards.rbac.test.ts                # cobre guard DONO-only
```

### Pattern 1: `DesempenhoMensal` Schema Design

**What:** A single snapshot table, one row per `(competencia, colaboradorId)`, storing pre-aggregated counters. Empresa-level data for DASH-03 is **not** snapshotted in v1 — DASH-03's "período" (per Claude's Discretion) defaults to a rolling window computed live, since empresa-level ranking changes are expected to reflect current/recent state more than colaborador trend-over-time does, and D-06's "atrasada" rule (including overdue PENDENTE) makes a frozen-snapshot semantics awkward (a PENDENTE task's overdue status changes every day even for a "closed" month's perspective on an unfinished task). Document this as an explicit scope decision the planner should confirm, not silently assume.

**When to use:** Write once per colaborador, once per month, at cron close-out time. Never updated after creation — D-05 mandates closed months are immutable even if historical `Tarefa`/`TarefaHistorico` rows are edited retroactively.

**Schema:**
```prisma
// Source: derived from existing schema.prisma conventions (cuid ids, @@map snake_case, @@index on FK + filter columns)
model DesempenhoMensal {
  id                 String   @id @default(cuid())
  competencia        String   // "YYYY-MM", mesmo formato canonico de src/lib/competencia.ts
  colaboradorId      String
  colaborador        Usuario  @relation(fields: [colaboradorId], references: [id])

  totalConcluidas    Int      // denominador D-02: so tarefas CONCLUIDA no periodo
  concluidasNoPrazo  Int      // numerador D-01: concluidoEm <= prazo
  totalEmpresas      Int      // contexto D-03: tamanho da carteira no momento do fechamento
  totalTarefasPeriodo Int     // contexto D-03: volume absoluto de tarefas (inclui as que ficaram PENDENTE)

  createdAt          DateTime @default(now())

  @@unique([competencia, colaboradorId])
  @@index([competencia])
  @@index([colaboradorId])
  @@map("desempenho_mensal")
}
```

**Why this shape:**
- `@@unique([competencia, colaboradorId])` mirrors the exact idempotency pattern Phase 3 used (`@@unique([empresaId, tipoObrigacao, competencia])` on `Tarefa`) — `createMany({ skipDuplicates: true })` can be reused identically, so a cron restart or manual re-trigger never double-writes a snapshot.
- Storing `concluidasNoPrazo` and `totalConcluidas` as separate integers (not a pre-computed percentage) lets the read side decide rounding/display and lets DASH-02's trend chart re-derive percentage per month without re-querying `Tarefa`.
- `totalEmpresas` and `totalTarefasPeriodo` satisfy D-03's "show absolute volume as context" requirement directly from the frozen snapshot, without joining back to `Empresa`/`Tarefa` for closed months (which would defeat the purpose of freezing).
- No `empresaId` rows in this table in v1 (see "What" above) — DASH-03 reads live every time.

### Pattern 2: Current-Month Colaborador Aggregation (DASH-01, live)

**What:** A single `groupBy` call computing, per `responsavelId`, counts of concluded-on-time vs concluded-late tasks for the open competência — no N+1 per-colaborador loop.

**When to use:** Whenever the dashboard page renders and the requested month is the current (unclosed) competência.

```typescript
// Source: pattern derived from Prisma groupBy docs + existing project conventions
// (src/modules/tarefas/queries.ts uses db.tarefa.count with date comparisons)
import { startOfMonth, endOfMonth } from "date-fns";
import { db } from "@/lib/db";

export async function listarDesempenhoColaboradoresMesAtual(mes: Date) {
  const inicio = startOfMonth(mes);
  const fim = endOfMonth(mes);

  // 1 query: todas as tarefas CONCLUIDAS no periodo, com o historico de conclusao
  const concluidas = await db.tarefa.findMany({
    where: {
      status: "CONCLUIDA",
      historico: { some: { concluidoEm: { gte: inicio, lte: fim } } },
    },
    select: {
      responsavelId: true,
      prazo: true,
      historico: {
        select: { concluidoEm: true },
        orderBy: { concluidoEm: "desc" },
        take: 1,
      },
    },
  });

  // agregacao em memoria (~poucas centenas de linhas no maximo, seguro)
  const porColaborador = new Map<string, { total: number; noPrazo: number }>();
  for (const t of concluidas) {
    const concluidoEm = t.historico[0]?.concluidoEm;
    if (!concluidoEm) continue; // defensivo: nao deveria ocorrer (CONCLUIDA sempre tem historico)
    const noPrazo = concluidoEm <= t.prazo; // D-01
    const atual = porColaborador.get(t.responsavelId) ?? { total: 0, noPrazo: 0 };
    atual.total += 1;
    if (noPrazo) atual.noPrazo += 1;
    porColaborador.set(t.responsavelId, atual);
  }

  // contexto D-03: tamanho de carteira (numero de empresas) por colaborador
  const carteiras = await db.empresa.groupBy({
    by: ["responsavelId"],
    where: { ativo: true },
    _count: { id: true },
  });

  return { porColaborador, carteiras };
}
```

**Why not `groupBy` directly on `Tarefa`:** Prisma's `groupBy` cannot easily express "compare `concluidoEm` (a related table's field) to `prazo` (this table's field)" as part of the grouping/aggregation itself — that comparison must happen in application code after a `findMany`. At ~100-110 empresas with ~1-4 tasks each per month, this `findMany` returns at most a few hundred rows — well within a single round trip, no pagination needed. This is NOT an N+1 pattern (it is exactly 2 queries total: one `findMany`, one `groupBy` for carteira size), regardless of colaborador count.

**Anti-pattern avoided:** Looping `for (const colaborador of colaboradores) { await db.tarefa.count(...) }` — this is the N+1 trap explicitly to avoid at this scale; the single `findMany` + in-memory `Map` aggregation above replaces it.

### Pattern 3: Snapshot Write Hook (extending `executarGeracaoMensal`)

**What:** Extend the existing `executarGeracaoMensal` transaction (Phase 3, `src/modules/tarefas/geracao.ts`) to also compute and persist the previous month's `DesempenhoMensal` rows, inside the same `db.$transaction`.

**When to use:** Every time the monthly cron fires (or the DONO manual-trigger button is clicked) — both call `executarGeracaoMensal` identically, so the snapshot write inherits the exact same idempotency and dual-trigger guarantees Phase 3 already built.

```typescript
// Source: extends src/modules/tarefas/geracao.ts (Phase 3, read during this research)
import { db } from "@/lib/db";
import { gerarTarefasDoMes } from "@/lib/geracao-tarefas";
import { calcularSnapshotMensal } from "@/modules/dashboards/snapshot"; // NEW, pure function
import { subMonths, format } from "date-fns";

export async function executarGeracaoMensal(
  competencia: string
): Promise<{ criadas: number; puladas: number }> {
  return db.$transaction(async (tx) => {
    // NEW: fecha o snapshot do mes ANTERIOR antes de gerar o novo mes.
    // competencia recebida é a do mes que está abrindo; o mes que fechou
    // é o anterior a ele (mesma logica usada por competenciaAtual()).
    const competenciaAnterior = format(
      subMonths(new Date(`${competencia}-01`), 1),
      "yyyy-MM"
    );
    const snapshots = await calcularSnapshotMensal(tx, competenciaAnterior);
    if (snapshots.length > 0) {
      await tx.desempenhoMensal.createMany({
        data: snapshots,
        skipDuplicates: true, // mesma defesa de D-10 (idempotencia via constraint)
      });
    }

    // (existente, inalterado) geracao das tarefas do novo mes
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

    return {
      criadas: resultado.count,
      puladas: tarefas.length - resultado.count,
    };
  });
}
```

**Why inside the same transaction:** Matches the project's established pattern of using `db.$transaction` when two writes must be atomic (`concluirTarefa` in `tarefas/actions.ts` does the same for status update + historico create). If the snapshot write failed independently of the task-generation write, you could end up with a month where new tasks exist but the prior month's performance was never frozen — silently breaking D-05's guarantee. A single transaction makes both succeed or both roll back together.

**Why `calcularSnapshotMensal` must be a pure-ish function taking `tx`:** Following the project's existing separation of pure calculation (`gerarTarefasDoMes` in `src/lib/geracao-tarefas.ts`, zero I/O, exhaustively unit tested) from I/O orchestration (`executarGeracaoMensal`). The snapshot calculation does need to read `Tarefa`/`TarefaHistorico`/`Empresa` (so it cannot be fully I/O-free like `gerarTarefasDoMes`), but it should accept the Prisma transaction client as a parameter so it can be unit-tested with the same `vi.mock("@/lib/db")` convention already used in `tests/geracao.idempotencia.test.ts`.

**Idempotency for manual re-triggers within the same month:** If the DONO manually clicks "Gerar tarefas do mês" twice in the same month (already possible since Phase 3), `calcularSnapshotMensal` will recompute the SAME previous-competência snapshot both times, but `createMany({ skipDuplicates: true })` against `@@unique([competencia, colaboradorId])` ensures only the first write persists — exactly mirroring how `Tarefa`'s own idempotency already works. No new edge case introduced.

### Pattern 4: DASH-01 Comparative Bar Chart (colaboradores)

**What:** A grouped/stacked bar chart per colaborador showing % no prazo, with absolute volume shown as a secondary label/tooltip (D-03).

```typescript
// Source: shadcn chart docs (ui.shadcn.com/docs/components/radix/chart), adapted
"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type DesempenhoColaborador = {
  nome: string;
  percentualNoPrazo: number; // 0-100
  totalConcluidas: number;
  totalEmpresas: number;
};

const chartConfig = {
  percentualNoPrazo: { label: "% no prazo", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function DesempenhoColaboradoresChart({
  dados,
}: {
  dados: DesempenhoColaborador[];
}) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
      <BarChart accessibilityLayer data={dados}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="nome" tickLine={false} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => [
                `${value}% (${item.payload.totalConcluidas} tarefas, ${item.payload.totalEmpresas} empresas)`,
                "No prazo",
              ]}
            />
          }
        />
        <Bar dataKey="percentualNoPrazo" fill="var(--color-percentualNoPrazo)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
```

**Key requirement:** `ChartContainer` MUST have an explicit height (`min-h-[VALUE]` or `aspect-*`) — Recharts' `ResponsiveContainer` (used internally) cannot size itself from `auto`/unconstrained CSS. [CITED: ui.shadcn.com/docs/components/radix/chart]

### Pattern 5: DASH-02 Evolução Mensal (Trend Line/Area)

**What:** A time series mixing frozen `DesempenhoMensal` rows (closed months) with one live-computed point (current month), rendered as an `AreaChart` or `LineChart`.

```typescript
// Source: pattern combining Pattern 1 (snapshot read) + Pattern 2 (live current month)
// src/modules/dashboards/queries.ts
import { subMonths, format } from "date-fns";
import { db } from "@/lib/db";
import { competenciaAtual } from "@/lib/competencia";
import { listarDesempenhoColaboradoresMesAtual } from "./queries"; // Pattern 2

export async function listarEvolucaoMensal(quantidadeMeses = 6) {
  const mesAtual = competenciaAtual();
  const competenciasFechadas = Array.from({ length: quantidadeMeses - 1 }, (_, i) =>
    format(subMonths(new Date(), i + 1), "yyyy-MM")
  ).reverse();

  // 1 query: todos os meses fechados de uma vez (agregado, ja sem recalculo)
  const snapshots = await db.desempenhoMensal.groupBy({
    by: ["competencia"],
    where: { competencia: { in: competenciasFechadas } },
    _sum: { totalConcluidas: true, concluidasNoPrazo: true },
  });

  const pontosFechados = snapshots.map((s) => ({
    competencia: s.competencia,
    percentual: s._sum.totalConcluidas
      ? Math.round(((s._sum.concluidasNoPrazo ?? 0) / s._sum.totalConcluidas) * 100)
      : 0,
  }));

  // 1 ponto live: mes corrente, NUNCA persistido (D-05)
  const { porColaborador } = await listarDesempenhoColaboradoresMesAtual(new Date());
  const totalAtual = [...porColaborador.values()].reduce(
    (acc, c) => ({ total: acc.total + c.total, noPrazo: acc.noPrazo + c.noPrazo }),
    { total: 0, noPrazo: 0 }
  );
  const pontoAtual = {
    competencia: mesAtual,
    percentual: totalAtual.total ? Math.round((totalAtual.noPrazo / totalAtual.total) * 100) : 0,
  };

  return [...pontosFechados, pontoAtual];
}
```

**Why `groupBy` on `DesempenhoMensal` instead of reading per-colaborador rows:** DASH-02 wants an office-wide trend line, not per-colaborador — summing `_sum` across colaboradores per competência in one query avoids fetching every row and reducing client-side.

### Pattern 6: DASH-03 Ranking de Empresas (live, includes overdue PENDENTE)

**What:** Per-empresa aggregation where "atrasada" = `CONCLUIDA` with `concluidoEm > prazo` OR `PENDENTE` with `prazo < now()` (D-06 — deliberately different rule from D-02's colaborador metric, which excludes PENDENTE entirely).

```typescript
// Source: pattern derived from D-06 (Claude's Discretion: prazo < now() for PENDENTE)
import { db } from "@/lib/db";

export async function listarRankingEmpresas(periodoInicio: Date, periodoFim: Date) {
  const tarefas = await db.tarefa.findMany({
    where: {
      prazo: { gte: periodoInicio, lte: periodoFim },
    },
    select: {
      empresaId: true,
      empresa: { select: { nome: true } },
      status: true,
      prazo: true,
      historico: {
        select: { concluidoEm: true },
        orderBy: { concluidoEm: "desc" },
        take: 1,
      },
    },
  });

  const agora = new Date();
  const porEmpresa = new Map<
    string,
    { nome: string; total: number; atrasadas: number }
  >();

  for (const t of tarefas) {
    const atual = porEmpresa.get(t.empresaId) ?? {
      nome: t.empresa.nome,
      total: 0,
      atrasadas: 0,
    };
    atual.total += 1;

    const concluidoEm = t.historico[0]?.concluidoEm;
    const atrasada =
      (t.status === "CONCLUIDA" && concluidoEm !== undefined && concluidoEm > t.prazo) ||
      (t.status === "PENDENTE" && t.prazo < agora); // D-06

    if (atrasada) atual.atrasadas += 1;
    porEmpresa.set(t.empresaId, atual);
  }

  return [...porEmpresa.entries()]
    .map(([empresaId, v]) => ({
      empresaId,
      nome: v.nome,
      percentualAtraso: v.total ? Math.round((v.atrasadas / v.total) * 100) : 0,
      totalTarefas: v.total,
    }))
    .sort((a, b) => b.percentualAtraso - a.percentualAtraso); // D-06: desc
}
```

**Scale note:** A single `findMany` over all tasks in the period (bounded by `prazo` range, already indexed via `@@index([prazo])` in `schema.prisma`), followed by in-memory grouping by `empresaId` — again exactly one query, not N+1 per empresa.

### Pattern 7: Ranked Display — Bar Chart vs Table

**What:** For DASH-03, a horizontal bar chart works well for the top ~10-15 worst offenders, but with up to ~100-110 empresas, a full bar chart of all companies becomes visually unreadable.

**Recommendation:** Show a `BarChart` (horizontal, via `layout="vertical"` in Recharts) for the top N (e.g., top 10) highest-`percentualAtraso` empresas, paired with a `TanStack Table` (already installed, `@tanstack/react-table`) below it listing all empresas sorted descending — consistent with how `EmpresasTable`/`TarefasTable` already render full lists elsewhere in the app. This avoids introducing pagination logic into the chart itself while still satisfying "the dono visualiza... destacando quais geram mais atrasos" (the chart highlights the worst offenders; the table provides the complete picture).

### Anti-Patterns to Avoid
- **Recomputing closed months on every dashboard page load:** Directly violates D-05. Once a competência's `DesempenhoMensal` rows exist, the read path must never re-derive those numbers from `Tarefa`/`TarefaHistorico` — always read the snapshot table for any competência that is not the current one.
- **Per-colaborador or per-empresa loop calling `db.tarefa.count()` N times:** The N+1 trap. All patterns above use exactly one `findMany`/`groupBy` per dashboard section, aggregating in application memory afterward — safe at this data volume (low hundreds of rows max).
- **Treating PENDENTE consistently across DASH-01 and DASH-03:** D-02 (colaborador) excludes PENDENTE entirely from the denominator; D-06 (empresa) explicitly includes overdue PENDENTE as "atrasada". These are deliberately different rules from CONTEXT.md — do not unify them into one shared "isAtrasada(tarefa)" helper without parameterizing which rule applies.
- **Installing `recharts` directly via `npm install recharts`:** Let `npx shadcn add chart` resolve and pin the compatible version, per CLAUDE.md and the project's existing shadcn-CLI-managed component convention.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive chart container sizing | Custom `ResizeObserver` + manual SVG width/height calc | shadcn `ChartContainer` (wraps Recharts `ResponsiveContainer`) | Recharts already solves this; reinventing it risks subtle resize bugs on sidebar collapse/expand (this app's sidebar is `collapsible="icon"`, which changes available width) |
| Chart color theming (light/dark mode) | Hardcoded hex colors per chart | `var(--chart-1)` through `var(--chart-5)` CSS vars already defined in `globals.css` for both `:root` and `.dark` | The project already has a dark-mode toggle (`next-themes`, per `app-sidebar.tsx`'s `ModeToggle`); hardcoded colors would break in dark mode while the existing CSS vars already handle both themes |
| Month-boundary date math for snapshot windows | Manual `new Date(year, month, 1)` arithmetic | `date-fns` `startOfMonth`/`endOfMonth`/`subMonths` (already installed, already used in Phase 2/3) | Phase 3's own `03-RESEARCH.md` Pitfall 4 documents exactly this risk (non-canonical date string handling); reuse the same library already vetted |
| Tabular display of all ~100-110 empresas ranked | Custom `<table>` with manual sort/pagination | `@tanstack/react-table` (already installed, already used in `EmpresasTable`/`TarefasTable`) | Sorting/filtering logic for 100+ rows is exactly the kind of "deceptively complex" UI problem TanStack Table already solves project-wide |

**Key insight:** Every "don't hand-roll" item in this phase has already been solved once elsewhere in this exact codebase (chart theming via existing CSS vars, date math via existing `date-fns` usage, tabular ranking via existing TanStack Table usage). This phase is almost entirely composition of already-proven patterns, not new library research.

## Common Pitfalls

### Pitfall 1: Recomputing a "closed" month because of an off-by-one competência boundary
**What goes wrong:** The snapshot write inside `executarGeracaoMensal(competencia)` must close out the month BEFORE `competencia`, not `competencia` itself. If the boundary math is wrong (e.g., uses `competencia` instead of `subMonths(competencia, 1)`), the snapshot table ends up one month ahead or behind, and the dashboard either double-counts or never freezes the intended month.
**Why it happens:** `executarGeracaoMensal` is named/used for generating the NEW month's tasks; it's easy to forget the snapshot logically belongs to the PREVIOUS month relative to that same call.
**How to avoid:** Compute `competenciaAnterior = format(subMonths(new Date(`${competencia}-01`), 1), "yyyy-MM")` explicitly (Pattern 3) and unit test it directly against the same fixture style Phase 3 used (`tests/geracao-tarefas.test.ts` tests `diaBase 31` edge cases — apply the same rigor to month-boundary tests here).
**Warning signs:** Dashboard "evolução mensal" shows a gap or a duplicate value for the month right after a cron run; manual DONO trigger button clicked mid-month produces an unexpected extra/missing snapshot point.

### Pitfall 2: Forgetting that `TarefaHistorico.concluidoEm` can be edited/backfilled after the fact
**What goes wrong:** D-05 explicitly anticipates that historical task data MAY be edited retroactively (e.g., correcting a typo in `motivoPendencia`, or a manual DB fix) — but the dashboard must still show the FROZEN number for closed months, even if the underlying `Tarefa`/`TarefaHistorico` rows technically changed.
**Why it happens:** It's tempting to "just re-run the aggregation query" whenever showing a past month, since that always reflects "the truth." But that directly violates the locked decision (D-05) — the dashboard's job is stability of historical reporting, not real-time accuracy of the past.
**How to avoid:** The read path for any competência other than the current one MUST go through `db.desempenhoMensal.findMany`/`groupBy` exclusively — never fall back to live `Tarefa` queries for past months, even "just to double check."
**Warning signs:** A DONO notices last month's dashboard numbers changed between two visits without a new cron run having occurred — this is the bug.

### Pitfall 3: Treating `DesempenhoMensal` rows for colaboradores who left/changed during the month
**What goes wrong:** If a colaborador's `responsavelId` assignments change mid-month (e.g., an empresa is reassigned), the snapshot's `totalEmpresas` and `totalConcluidas` reflect whatever the assignment was AT THE TIME OF THE CRON RUN (start of next month), not historically accurate per-day numbers.
**Why it happens:** The schema doesn't track historical `responsavelId` changes (only `Empresa.responsavelId`, no audit log — confirmed via `schema.prisma`, no `EmpresaResponsavelHistorico` model exists, unlike `EmpresaRegimeHistorico`).
**How to avoid:** Document this as an accepted v1 limitation in the plan rather than attempting to build a responsavel history table (out of scope per phase boundary — "não inclui novas ações sobre tarefas/empresas"). The snapshot calculation should use `Tarefa.responsavelId` (recorded per-task at creation time, per `gerarTarefasDoMes` D-09 from Phase 3), NOT `Empresa.responsavelId` — `Tarefa.responsavelId` is already fixed at task-creation time and does not silently drift if an empresa is reassigned later.
**Warning signs:** A colaborador's snapshot numbers don't match what they remember handling, after an empresa reassignment occurred mid-month.

### Pitfall 4: ChartContainer without explicit height renders a 0px-tall chart
**What goes wrong:** Omitting `className="min-h-[...]"` (or `aspect-*`) on `ChartContainer` causes Recharts' `ResponsiveContainer` to compute 0 height, silently rendering nothing (no error thrown).
**Why it happens:** Easy to forget since most other shadcn components don't require explicit sizing classes.
**How to avoid:** Always include `min-h-[200px]` (or larger) — and test visually with `npm run dev` after wiring each chart, exactly as Phase 3 did its human-verification checkpoint for the manual trigger button.
**Warning signs:** Chart section renders an empty white/transparent box with no console error.

## Code Examples

See Patterns 1-7 above for complete, ready-to-adapt code for: schema (Pattern 1), current-month colaborador aggregation (Pattern 2), snapshot write hook (Pattern 3), bar chart (Pattern 4), trend chart (Pattern 5), empresa ranking query (Pattern 6), and ranked table/chart hybrid (Pattern 7).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| shadcn chart CSS vars as `hsl(var(--chart-1))` | `var(--chart-1)` directly (no `hsl()` wrapper) | Recharts v3 / current shadcn chart docs | This project's `globals.css` already uses bare `oklch(...)` values assigned to `--chart-1` etc. (not `hsl`), so code examples in this research use the current `var(--chart-1)` syntax directly — using the old `hsl(var(...))` wrapper would render incorrectly against `oklch` values |

**Deprecated/outdated:** None directly relevant — this is a small, recently-stable corner of the stack (shadcn chart component + Recharts v3) with no known deprecated APIs affecting this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DASH-03 does not need a frozen snapshot (live-only, unlike DASH-01/02) — based on reasoning about D-06's PENDENTE-inclusive rule being incompatible with "closed month" semantics | Pattern 1 | If the user actually wants empresa rankings frozen per month too, the planner needs to add empresa-level rows to `DesempenhoMensal` (or a second table) — moderate schema rework, not a blocker, but should be confirmed during planning/discuss rather than assumed silently |
| A2 | Default trend window for DASH-02 is 6 months (Claude's Discretion explicitly defers this) | Pattern 5 | Low risk — easy to change a function parameter (`quantidadeMeses`); no schema impact |
| A3 | Single page with 3 stacked sections (not tabs/separate pages) for dashboard navigation (Claude's Discretion explicitly defers this) | Project Structure | Low risk — purely a layout/route decision, easy to restructure into tabs later without touching data layer |
| A4 | Snapshot uses `Tarefa.responsavelId` (not `Empresa.responsavelId`) to attribute closed-month performance, to avoid drift if empresa reassignment happens mid-month | Pitfall 3 | Low-medium risk — if the team's mental model expects "current colaborador for that empresa" instead of "colaborador assigned to the task at creation time," displayed historical numbers could look surprising after a reassignment; worth a one-line confirmation during planning |

## Open Questions

1. **Should DASH-03 (empresa ranking) eventually get a frozen snapshot too, for month-over-month empresa trend comparison?**
   - What we know: CONTEXT.md only requires DASH-03 to be a single-period ranking ("ordenar do maior para o menor"), not an explicit trend-over-time requirement like DASH-02.
   - What's unclear: Whether a future iteration wants "which empresas got worse this month vs last" — not in v1 scope per the phase boundary, but worth flagging.
   - Recommendation: Build DASH-03 live-only for v1 (Pattern 6); if a future phase needs empresa trend-over-time, add an `empresaId`-keyed table mirroring `DesempenhoMensal`'s structure at that point — don't over-build now.

2. **What date range bounds DASH-03's "período"?**
   - What we know: D-06 specifies the ratio (atrasadas / total no período) but CONTEXT.md defers the exact period length to Claude's Discretion.
   - What's unclear: Whether "all-time" or "last N months" is more useful for the dono's recurring-problem-empresa use case.
   - Recommendation: Default to "últimos 3 meses" (rolling window) as a reasonable middle ground between noise (1 month) and staleness (all-time, which dilutes recently-improved empresas) — make it a simple parameter so the planner/dono can adjust easily; this is a UI/query parameter, not a schema decision, so it's cheap to change later.

## Environment Availability

This phase introduces no new infrastructure dependency beyond the `recharts` npm package (already covered in Standard Stack/Package Legitimacy Audit above) and reuses the existing Neon Postgres + Railway `next start` long-lived process already configured in Phases 1-3. No new environment variables, services, or external tools are required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Neon Postgres | `DesempenhoMensal` table (new), all dashboard queries | ✓ (existing, per STATE.md Phase 1) | — | — |
| Node 20+ / `next start` long-lived process | Existing `instrumentation.ts` cron hook, now also running snapshot write | ✓ (existing, per Phase 3) | — | — |
| `npx shadcn add chart` CLI availability | Installing chart component source | ✓ (`shadcn` already in package.json devDependencies-equivalent, `^4.11.0`) | 4.11.0 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.8 (existing, `vitest.config.ts` at repo root) |
| Config file | `vitest.config.ts` — aliases `@/` to `src/`, inlines `next-auth`/`@auth/core` for ESM resolution |
| Quick run command | `npx vitest run tests/dashboards.queries.test.ts` (per-file, once Wave 0 creates it) |
| Full suite command | `npm run test` (= `vitest run`, currently 76+ tests across 17 files per Phase 3 summary) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | % no prazo respects D-01 (concluidoEm <= prazo) and D-02 (excludes PENDENTE from denominator) | unit | `npx vitest run tests/dashboards.queries.test.ts -t "colaboradores"` | ❌ Wave 0 |
| DASH-01 | Absolute volume context (D-03) returned alongside percentage | unit | `npx vitest run tests/dashboards.queries.test.ts -t "volume"` | ❌ Wave 0 |
| DASH-02 | Closed-month snapshot never recalculated on read (D-05) — mock `db.desempenhoMensal.findMany`/`groupBy` and assert `db.tarefa.findMany` is NOT called for closed competências | unit | `npx vitest run tests/dashboards.snapshot.test.ts -t "frozen"` | ❌ Wave 0 |
| DASH-02 | Snapshot write is idempotent (createMany skipDuplicates against @@unique) | unit | `npx vitest run tests/dashboards.snapshot.test.ts -t "idempot"` | ❌ Wave 0 |
| DASH-02 | Snapshot closes the CORRECT prior month relative to the competência passed to `executarGeracaoMensal` (Pitfall 1) | unit | `npx vitest run tests/dashboards.snapshot.test.ts -t "boundary"` | ❌ Wave 0 |
| DASH-03 | "Atrasada" includes PENDENTE with prazo < now() (D-06), distinct from D-02's rule | unit | `npx vitest run tests/dashboards.queries.test.ts -t "ranking"` | ❌ Wave 0 |
| DASH-03 | Ranking sorted descending by % atraso | unit | `npx vitest run tests/dashboards.queries.test.ts -t "ranking"` | ❌ Wave 0 |
| DASH-01/02/03 | DONO-only access — COLABORADOR and unauthenticated rejected before any DB query | unit | `npx vitest run tests/dashboards.rbac.test.ts` | ❌ Wave 0 |
| DASH-01/02/03 | Manual checkpoint: dashboards render visually correct charts for DONO, hidden/blocked for COLABORADOR | manual | `npm run dev` + human verification (same checkpoint style as Phase 3 Plan 03) | n/a |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/dashboards.*.test.ts` (scoped to this phase's new files)
- **Per wave merge:** `npm run test` (full suite, ensures no regression in Phases 1-3's 76+ existing tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the manual visual checkpoint (chart rendering cannot be fully asserted by Vitest alone — DOM/canvas rendering verification needs human eyes, consistent with how Phase 1's import wizard and Phase 3's manual trigger button were checkpointed)

### Wave 0 Gaps
- [ ] `tests/dashboards.queries.test.ts` — covers DASH-01, DASH-03 calculation rules
- [ ] `tests/dashboards.snapshot.test.ts` — covers DASH-02 freeze/idempotency/boundary rules
- [ ] `tests/dashboards.rbac.test.ts` — covers DONO-only guard for all 3 dashboard queries/page
- [ ] Prisma migration for `DesempenhoMensal` — run `npx prisma db push` (same approach Phase 2 used per STATE.md: "ambiente Neon sem shadow database")
- [ ] `npx shadcn@latest add chart` — installs `recharts` + `src/components/ui/chart.tsx` before any chart component can be written

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirect) | Reuses existing `auth()` (Auth.js v5) session check — no new auth surface introduced |
| V3 Session Management | no (new surface) | No change — existing session handling untouched |
| V4 Access Control | yes | DONO-only role check as the FIRST statement after `auth()`, before any DB access — identical pattern to `gerarTarefasDoMesAction` (Phase 3); applies to the dashboard page's Server Component AND any Server Actions/data-fetch functions it calls |
| V5 Input Validation | yes (minor) | Any user-adjustable query param (e.g., `?meses=6` for DASH-02's window) must be validated with Zod (regex/range), same pattern as `competenciaSchema` — reject non-numeric or out-of-range values rather than passing raw strings into `subMonths` |
| V6 Cryptography | no | Not applicable — no new secrets, tokens, or hashing introduced this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| COLABORADOR bypassing UI-hidden dashboard nav link by navigating directly to `/dashboards` | Elevation of Privilege | Server Component-level `role !== "DONO"` guard (redirect/404), never relying on the sidebar nav item being hidden as the only barrier — exact pattern already proven in `tarefas/page.tsx`'s `GerarTarefasButton` gating |
| Information disclosure via aggregate counts leaking colaborador-specific data to a COLABORADOR who somehow reaches a dashboard query function directly | Information Disclosure | Every dashboard query function (`listarDesempenhoColaboradoresMesAtual`, `listarEvolucaoMensal`, `listarRankingEmpresas`) should itself re-check role internally OR only ever be called from the already-role-gated Server Component — prefer defense in depth: have the page guard AND consider a lightweight role parameter check inside the queries module, consistent with `withTarefaScope`/`withVisibilityScope` always being spread into every query rather than trusted to caller discipline alone |
| SQL injection via unvalidated `?meses=` or `?periodo=` query params reaching Prisma `subMonths`/date range construction | Tampering | Zod validation of any URL search param BEFORE it reaches date-fns functions or Prisma `where` clauses (V5) — though Prisma's parameterized queries already prevent classic SQL injection, malformed input could still throw runtime errors or produce nonsensical date ranges without validation |

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` (read directly from repo) — existing `Tarefa`, `TarefaHistorico`, `Empresa`, `Usuario` models, indexes, and naming conventions
- `instrumentation.ts`, `src/lib/scheduler.ts`, `src/modules/tarefas/geracao.ts` (read directly from repo) — exact boot-hook/cron/transaction pattern this phase extends
- `src/app/(app)/tarefas/actions.ts`, `src/lib/visibility-scope.ts` (read directly from repo) — exact DONO-only RBAC guard pattern and `withTarefaScope`/`withVisibilityScope` conventions
- `src/app/(app)/app-sidebar.tsx` (read directly from repo) — existing disabled "Dashboards" nav placeholder, confirming sidebar integration point
- `npm view recharts version/time.created/repository.url` (executed directly this session) — version 3.8.1, age ~10 years, official repo confirmed
- `gsd-tools query package-legitimacy check --ecosystem npm recharts` (executed directly this session) — verdict OK

### Secondary (MEDIUM confidence)
- [Chart - shadcn/ui](https://ui.shadcn.com/docs/components/radix/chart) — `WebFetch`-retrieved official docs: `ChartContainer`/`ChartConfig`/`ChartTooltip`/`ChartTooltipContent` API, installation command, CSS variable theming (`var(--chart-1)` syntax for Recharts v3), explicit height requirement
- `.planning/phases/03-motor-de-gera-o-autom-tica-mensal/03-RESEARCH.md`, `03-02-SUMMARY.md`, `03-03-SUMMARY.md` (read directly from repo) — confirms exact transaction/idempotency/RBAC patterns Phase 3 established, which this research extends rather than reinvents

### Tertiary (LOW confidence)
- [Tutorial: How to create a ReactJS/NextJS Chart component using Shadcn UI](https://dev.to/fredy/tutorial-how-to-create-a-reactjs-nextjs-chart-component-using-shadcn-ui-3o4b), [shadcn.io/charts](https://www.shadcn.io/charts) — general WebSearch results corroborating the official docs' BarChart/ChartConfig shape, used only as secondary confirmation, not as the primary source for any claim in this document

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — recharts version/legitimacy verified live via npm registry and package-legitimacy seam; shadcn chart component API verified via official docs fetch
- Architecture: HIGH — every pattern in this document extends code read directly from this repository (Phase 1-3 actual implementation), not generic framework advice
- Pitfalls: MEDIUM-HIGH — Pitfalls 1, 2, 4 are derived from direct repo inspection (Phase 3's own documented pitfalls + shadcn docs' explicit height warning); Pitfall 3 (responsavel drift) is reasoned from schema inspection (absence of an `EmpresaResponsavelHistorico` model) rather than externally verified

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (30 days — stable stack, no fast-moving dependencies; recharts/shadcn chart component API is mature and unlikely to break within this window)
