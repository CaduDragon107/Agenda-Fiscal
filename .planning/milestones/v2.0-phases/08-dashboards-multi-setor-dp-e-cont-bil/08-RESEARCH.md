# Phase 8: Dashboards Multi-Setor — DP e Contábil - Research

**Researched:** 2026-06-25
**Domain:** Next.js 15 App Router Server Components + Prisma aggregation queries, extending an existing single-sector dashboard into a sector-parametrized one (no new external libraries)
**Confidence:** HIGH

## Summary

This phase has no new technology to learn — it is a pure code-reuse/refactor exercise inside an already-working dashboard (Phase 4, Fiscal). The 3 chart/table components, the guard pattern, and the page layout are all proven and must NOT be copied; they must be parametrized. The only real engineering problem is **how to scope `Tarefa` rows by sector**, since `Tarefa` has no `setor` column. Direct inspection of `src/modules/tarefas/geracao.ts` and the four generation catalogs (`geracao-tarefas.ts`, `geracao-tarefas-dp.ts`, `geracao-tarefas-contabil.ts`, `geracao-tarefas-contabil-anual.ts`) confirms `TipoObrigacao` is a **disjoint-by-sector enum** for all recurring tasks, and `Tarefa.responsavelId` is always set, at creation time, to the sector-correct colaborador (read from `EmpresaResponsavelSetor` filtered by `setor`, never from the legacy `Empresa.responsavelId` for DP/Contábil). The one gap: **avulsa (ad-hoc) tasks have `tipoObrigacao = null` and are NOT sector-tagged at creation** (`criarTarefa` in `src/app/(app)/tarefas/actions.ts` accepts any `responsavelId` regardless of setor, confirmed by reading the action — SETOR-03's colaborador-picker filtering is UI-only, not server-enforced). This means the dashboard query layer needs a **two-part filter**: `tipoObrigacao IN [...]` for recurring tasks of that sector, OR (`tipoObrigacao IS NULL` AND `responsavel.setor = X`) for avulsas. This must be a single shared helper, not duplicated 3×.

There is also a critical piece of in-flight, out-of-band work to assess: `src/modules/dashboard/queries.ts` (singular) was committed directly (commit `3c84eee`) outside the plan/execute workflow. Direct inspection shows it is **broken, unusable code that must be deleted, not extended**: it imports `db.desempenhoMensalSnapshot` (a model that does not exist in `schema.prisma` — the real model is `DesempenhoMensal`) and calls `classificarTarefaDesempenho` (which DOES exist, in `src/lib/alert-prazo.ts`, so that part is not hallucinated, but the snapshot model reference makes the whole module fail `tsc`/runtime). Zero files import from `@/modules/dashboard` (singular) anywhere in `src/` — confirmed via grep. This file is 100% dead, broken code and must be deleted in this phase, exactly as Pitfall B4 and the canonical refs already mandate.

**Primary recommendation:** Add a `setor: "FISCAL" | "DP" | "CONTABIL"` parameter to the existing three exported functions in `src/modules/dashboards/queries.ts` (plural — the real, working module), threading it through a new shared sector-filter helper that branches on `tipoObrigacao` for recurring tasks and `responsavel.setor` for avulsas. Reuse all 3 existing chart/table components unchanged. Add tabs to the existing `page.tsx`. Delete `src/modules/dashboard/` (singular) entirely.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sector tab navigation (D-01) | Frontend Server (RSC) | Browser/Client (shadcn `Tabs` is a client component for active-tab state) | `page.tsx` Server Component fetches all 3 sectors' data server-side; `Tabs` client component only switches visibility, no data fetching on tab change |
| Sector-scoped data aggregation (DP-06/07/08, CONT-07/08/09) | API/Backend (`src/modules/dashboards/queries.ts`) | Database (Prisma aggregation) | Same tier that already owns Fiscal's DASH-01/02/03 — this phase extends it, never moves logic to the client |
| DONO-only authorization | API/Backend (`guard.ts`, server-side `notFound()`) | — | Established Phase 4 pattern (T-4-01); must not be re-implemented per sector |
| Closed-month snapshot freezing (D-05 carryover) | Database (`DesempenhoMensal` table) | API/Backend (`snapshot.ts` read-only consumer) | Already sector-agnostic by competência+colaboradorId; this phase must NOT change snapshot semantics, only filter which colaboradores/empresas are shown per sector tab |
| Empty-state copy selection (D-04) | Frontend Server (RSC, `EmptyState` parametrized by setor) | — | Pure presentation logic, no data dependency beyond dataset-empty check already computed server-side |

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Navegação**
- **D-01:** Os dashboards de DP e Contábil ficam em **abas dentro da mesma página `/dashboards`**, junto com o Fiscal — não em itens separados na sidebar.

**Universo de empresas**
- **D-02:** No dashboard de DP (desempenho, evolução, ranking), **só entram empresas com `temFuncionariosClt: true`**.
- **D-03:** No dashboard de Contábil, **todas as 197 empresas** entram no universo (sem filtro de CLT).

**Estado vazio por setor**
- **D-04:** O texto do estado vazio **menciona o setor explicitamente** — não reusa o texto genérico do Fiscal verbatim.

### Claude's Discretion
- Estrutura exata de componentes (extrair helpers, nomes de arquivos por setor, como o módulo de queries parametriza por setor — string literal `"DP"`/`"CONTABIL"`/`"FISCAL"` vs enum `Setor` importado do Prisma) é decisão de implementação.
- Como `Tarefa` não tem coluna `setor` própria — o setor de uma tarefa hoje é inferido via `tipoObrigacao` e/ou via `responsavel.setor` do colaborador atribuído. Pesquisa deve confirmar qual join é o correto e mais eficiente para os 3 dashboards por setor, sem regressão no Fiscal. **(Resolved below — see "Standard Stack" / "Code Examples".)**

### Deferred Ideas (OUT OF SCOPE)
- Renomear os placeholders DP1-4/Contabil1-3 para nomes reais — quick-task separado, fora desta fase.
- Visão unificada de dashboard entre os 3 setores (DASH-10) — explicitamente fora de escopo da v2.0 inteira.
</user_constraints>

## Phase Requirements

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DP-06 | Dashboard de desempenho por colaborador DP (no prazo vs atrasado) | Reuse `listarDesempenhoColaboradoresMesAtual` parametrized by `setor="DP"`, filtered to `temFuncionariosClt: true` empresas (D-02); reuse `DesempenhoColaboradoresChart` unchanged |
| DP-07 | Dashboard de evolução mensal DP | Reuse `listarEvolucaoMensal` parametrized by `setor="DP"`; closed months MUST be persisted per-sector in `DesempenhoMensal` (schema change required — see Common Pitfalls) |
| DP-08 | Dashboard de ranking de empresas problemáticas no DP | Reuse `listarRankingEmpresas` parametrized by `setor="DP"`, filtered to `temFuncionariosClt: true`; reuse `RankingEmpresasTable` unchanged |
| CONT-07 | Dashboard de desempenho por colaborador Contábil | Same query/component reuse, `setor="CONTABIL"`, full 197-empresa universe (D-03) |
| CONT-08 | Dashboard de evolução mensal Contábil | Same, `setor="CONTABIL"` |
| CONT-09 | Dashboard de ranking de empresas problemáticas no Contábil | Same, `setor="CONTABIL"`, full universe |
</phase_requirements>

## Standard Stack

### Core
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.19 [VERIFIED: package.json] | App Router Server Components for `/dashboards` page | Already in use project-wide; Phase 4 precedent. (npm registry currently lists 16.2.9 as latest [VERIFIED: npm registry], but this project deliberately stays on 15.5.x per CLAUDE.md stack decision — no upgrade in scope) |
| Prisma | `@prisma/client` ^6.19.3 installed [VERIFIED: package.json] | Aggregation queries (`groupBy`, `findMany` with `select`) | Already in use; this phase adds no new Prisma features beyond `OR` filters and an `in` filter on an existing enum column, both standard Prisma Client API |
| Recharts via shadcn `chart` wrapper | Already installed, `src/components/ui/chart.tsx` | Bar charts for all 3 dashboard types | Established Phase 4 pattern, traffic-light palette locked by quick-task 260622-r6n — reused verbatim |
| TanStack Table | Already installed (`@tanstack/react-table`) | `RankingEmpresasTable` sortable table | Established Phase 4 pattern, reused verbatim |
| date-fns | ^4.4.0 installed [VERIFIED: package.json] | `startOfMonth`/`endOfMonth`/`subMonths`/`format` in queries.ts | Already in use across the codebase per CLAUDE.md |

### Supporting
No new supporting libraries needed. `shadcn` `Tabs` component (`src/components/ui/tabs.tsx`) is already installed per 08-UI-SPEC.md confirmation — no `npx shadcn add tabs` required.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tipoObrigacao IN [...]` + `responsavel.setor` fallback filter | Add a denormalized `Tarefa.setor` column, backfilled from `tipoObrigacao`/`responsavel.setor` | Would simplify every future query to a single `where: { setor }`, but requires a migration + backfill script touching the highest-volume table in the schema (`Tarefa`) for a phase whose Success Criteria only mention dashboards, not schema changes — out of proportion for this phase. Documented as an Open Question below for a future phase, not adopted here. |
| Per-sector `DesempenhoMensal` rows (schema change, see Pitfall 1) | Keep `DesempenhoMensal` sector-blind and recompute DP/Contábil "closed months" live from `Tarefa` every time | Recomputing live violates D-05 (closed months must be frozen, never recalculated) — not a viable alternative, the schema change is mandatory, not optional |

**Installation:**
No new packages required for this phase — pure reuse of already-installed Next.js/Prisma/Recharts/TanStack Table stack.

**Version verification:** Confirmed via `package.json` (no network calls needed — versions are pinned/ranged in the already-committed lockfile) that `next@15.5.19`, `@prisma/client@^6.19.3`, `date-fns@^4.4.0` are installed and match the versions referenced throughout existing dashboard code comments (Plan 04-02/04-03/04-04 references). `npm view next version` / `npm view prisma version` confirm the npm registry currently offers `16.2.9`/`7.8.0` as latest — both are out of scope per CLAUDE.md's explicit "stay on 15.5.x/6.x" decision; this phase does not touch the stack version.

## Package Legitimacy Audit

**No external packages are installed in this phase.** All dependencies (Next.js, Prisma, Recharts, TanStack Table, date-fns, shadcn Tabs) are already installed and were vetted in prior phases (Phase 4 RESEARCH.md and CLAUDE.md Sources table). No `npm view`/legitimacy-check run is required because zero new `npm install` commands are part of this phase's plan.

**Packages removed due to [SLOP] verdict:** none (no new packages)
**Packages flagged as suspicious [SUS]:** none (no new packages)

## Architecture Patterns

### System Architecture Diagram

```
Browser (DONO only)
   │
   │ GET /dashboards?meses=6  (existing query param, unaffected by tabs)
   ▼
┌─────────────────────────────────────────────────────────────┐
│ page.tsx (Server Component)                                  │
│  1. carregarDadosDashboards(meses) — guard.ts                │
│     ├─ auth() → redirect("/login") if no session             │
│     └─ role !== "DONO" → notFound()  [T-4-01, unchanged]      │
│  2. NEW: fetch all 3 sectors in parallel (Promise.all)        │
│     ├─ listarDesempenhoColaboradoresMesAtual(hoje, "FISCAL")  │
│     ├─ listarDesempenhoColaboradoresMesAtual(hoje, "DP")      │
│     ├─ listarDesempenhoColaboradoresMesAtual(hoje, "CONTABIL")│
│     ├─ ...same fan-out for listarEvolucaoMensal               │
│     └─ ...same fan-out for listarRankingEmpresas               │
│  3. Render <Tabs> (client) wrapping 3x <TabsContent>           │
│     each rendering the SAME 3-Card layout, fed by its slice    │
└─────────────────────────────────────────────────────────────┘
   │
   ▼  (each query call passes setor + sectorScope params)
┌─────────────────────────────────────────────────────────────┐
│ src/modules/dashboards/queries.ts (EXTENDED, not duplicated) │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ NEW shared helper: tarefaSetorWhere(setor)              │  │
│  │   → { OR: [                                            │  │
│  │       { tipoObrigacao: { in: TIPOS_POR_SETOR[setor] } },│  │
│  │       { tipoObrigacao: null, responsavel: { setor } }   │  │
│  │     ] }                                                 │  │
│  └───────────────────────────────────────────────────────┘  │
│  listarDesempenhoColaboradoresMesAtual(mes, setor)            │
│  listarEvolucaoMensal(quantidadeMeses, setor)                 │
│  listarRankingEmpresas(inicio, fim, setor, empresaWhereExtra)  │
│     empresaWhereExtra = { temFuncionariosClt: true } for DP    │
│     empresaWhereExtra = {} for CONTABIL (D-03, full universe)  │
└─────────────────────────────────────────────────────────────┘
   │
   ▼
PostgreSQL (Tarefa, Empresa, Usuario, DesempenhoMensal — extended
            with a `setor` discriminator column, see Pitfall 1)
```

### Recommended Project Structure
```
src/
├── app/(app)/dashboards/
│   ├── page.tsx                          # MODIFIED: adds <Tabs>, fans out 3x per query
│   ├── guard.ts                          # MODIFIED: carregarDadosDashboards fetches 3 sectors
│   ├── empty-state.tsx                   # NEW: extracted, parametrized by setor (was inline in page.tsx)
│   ├── desempenho-colaboradores-chart.tsx # UNCHANGED — reused as-is
│   ├── evolucao-mensal-chart.tsx          # UNCHANGED — reused as-is
│   └── ranking-empresas-table.tsx         # UNCHANGED — reused as-is
├── modules/
│   ├── dashboards/                       # the REAL module — EXTENDED
│   │   ├── queries.ts                    # MODIFIED: setor param + tarefaSetorWhere helper
│   │   ├── snapshot.ts                   # MODIFIED: setor-aware aggregation (see Pitfall 1)
│   │   └── schema.ts                     # UNCHANGED (mesesSchema still sector-agnostic)
│   └── dashboard/                        # ORPHAN — DELETE ENTIRELY this phase
│       └── queries.ts                    # DELETE (broken, zero imports, confirmed dead)
└── lib/
    └── tipo-obrigacao-setor.ts           # NEW: single source of truth, TipoObrigacao -> Setor map
```

### Pattern 1: Sector classification via disjoint `TipoObrigacao` sets, with `responsavel.setor` fallback for avulsas
**What:** A single exported constant maps every `TipoObrigacao` enum value to its owning `Setor`, derived directly from the 4 generation catalogs already in the codebase.
**When to use:** Any query that needs to scope `Tarefa` rows by sector (this phase's 6 dashboard functions, and any future sector-aware `Tarefa` query).
**Example:**
```typescript
// src/lib/tipo-obrigacao-setor.ts (NEW FILE)
// Source: derived from src/lib/geracao-tarefas.ts, geracao-tarefas-dp.ts,
// geracao-tarefas-contabil.ts, geracao-tarefas-contabil-anual.ts — every
// TipoObrigacao value used by each catalog's TITULO_OBRIGACAO_* maps,
// cross-referenced against prisma/schema.prisma `enum TipoObrigacao`.
import type { Setor, TipoObrigacao } from "@prisma/client";

export const TIPOS_OBRIGACAO_POR_SETOR: Record<Setor, TipoObrigacao[]> = {
  FISCAL: ["ICMS", "PIS_COFINS", "SPED_FISCAL", "SPED_CONTRIBUICOES", "DAS"],
  DP: ["FOLHA", "ESOCIAL", "FGTS", "INSS"],
  CONTABIL: [
    "EXTRATO_BANCARIO", "LANCAMENTO_EXTRATOS", "FOLHA_CONTABIL",
    "FISCAL_CONTABIL", "BAIXA_IMPOSTOS", "PERDCOMP",
    "FORNECEDORES_CLIENTES", "BALANCO", "ECD", "ECF", "DEFIS",
  ],
};

// Prisma WhereInput fragment: recurring tasks classified by tipoObrigacao,
// avulsas (tipoObrigacao=null) classified by the assigned colaborador's
// setor — the ONLY signal available for avulsas, since criarTarefa() does
// not stamp a setor at creation time (confirmed: src/app/(app)/tarefas/actions.ts
// accepts any responsavelId regardless of setor).
import type { Prisma } from "@prisma/client";

export function tarefaSetorWhere(setor: Setor): Prisma.TarefaWhereInput {
  return {
    OR: [
      { tipoObrigacao: { in: TIPOS_OBRIGACAO_POR_SETOR[setor] } },
      { tipoObrigacao: null, responsavel: { setor } },
    ],
  };
}
```

### Pattern 2: Parametrize, don't duplicate — sector as a function argument
**What:** Every exported function in `src/modules/dashboards/queries.ts` gains a `setor: Setor` parameter (and, for ranking/desempenho, an optional `empresaWhereExtra: Prisma.EmpresaWhereInput` for D-02's CLT filter), and merges `tarefaSetorWhere(setor)` into its existing `where` clauses via `AND`.
**When to use:** All 6 dashboard query functions this phase touches.
**Example:**
```typescript
// src/modules/dashboards/queries.ts — MODIFIED signature
export async function listarDesempenhoColaboradoresMesAtual(
  mes: Date,
  setor: Setor,
  empresaWhereExtra: Prisma.EmpresaWhereInput = {}
): Promise<DesempenhoColaborador[]> {
  const inicio = startOfMonth(mes);
  const fim = endOfMonth(mes);

  const concluidas = await db.tarefa.findMany({
    where: {
      status: "CONCLUIDA",
      historico: { some: { concluidoEm: { gte: inicio, lte: fim } } },
      ...tarefaSetorWhere(setor), // NEW — merges via implicit AND at top level
    },
    select: { /* unchanged */ },
  });

  const carteiras = await db.empresa.groupBy({
    by: ["responsavelId"],
    where: { ativo: true, ...empresaWhereExtra }, // D-02/D-03
    _count: { id: true },
  });
  // ...rest unchanged
}
```
**Caller (guard.ts) fans out per sector:**
```typescript
const [fiscal, dp, contabil] = await Promise.all([
  listarDesempenhoColaboradoresMesAtual(hoje, "FISCAL"),
  listarDesempenhoColaboradoresMesAtual(hoje, "DP", { temFuncionariosClt: true }),
  listarDesempenhoColaboradoresMesAtual(hoje, "CONTABIL"),
]);
```

### Pattern 3: Tabs as a pure client-side view switch over server-fetched data (no client-side fetching)
**What:** `<Tabs>` switches which of the 3 already-fetched datasets is visible — it never triggers a new request.
**When to use:** D-01's "3 tabs in one page" requirement, while avoiding 3 separate page routes (which would each need their own guard/fetch boilerplate) or a client-fetch-on-tab-switch pattern (which would add loading states/flicker not required by the UI-SPEC).
**Example:**
```typescript
// src/app/(app)/dashboards/page.tsx — MODIFIED
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function DashboardsPage({ searchParams }: Props) {
  const params = await searchParams;
  const dados = await carregarDadosDashboards(params?.meses); // now returns { FISCAL: {...}, DP: {...}, CONTABIL: {...} }

  return (
    <div className="flex flex-col gap-8 p-6">
      <PageHeader />
      <Tabs defaultValue="FISCAL">
        <TabsList>
          <TabsTrigger value="FISCAL">Fiscal</TabsTrigger>
          <TabsTrigger value="DP">DP</TabsTrigger>
          <TabsTrigger value="CONTABIL">Contábil</TabsTrigger>
        </TabsList>
        {(["FISCAL", "DP", "CONTABIL"] as const).map((setor) => (
          <TabsContent key={setor} value={setor}>
            <SectorDashboard setor={setor} dados={dados[setor]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Three independent `dashboards-dp/`, `dashboards-contabil/` directories mirroring `dashboards/` function-by-function:** This is explicitly named as Pitfall B4 in this project's own `.planning/research/PITFALLS.md` and is the exact mistake that produced the orphaned `src/modules/dashboard/` (singular) module already sitting in this codebase. Parametrize the existing module instead.
- **Filtering avulsas tasks by `responsavel.setor` for ALL tasks (including recurring):** A colaborador's `setor` can in principle differ from the sector of a specific recurring task they were assigned to historically if their `Usuario.setor` is later changed (e.g., a DP colaborador reassigned to Contábil) — `tipoObrigacao` is the stable, point-in-time-correct signal for recurring tasks and must take priority. Only fall back to `responsavel.setor` for avulsas (`tipoObrigacao IS NULL`), where no other signal exists.
- **Treating the `EmptyState` per-Card vs per-Tab distinction loosely:** Per 08-UI-SPEC.md's Interaction Contract, EACH of the 3 Cards (desempenho/evolução/ranking) independently shows its own empty state if THAT dataset is empty — there is no single "this whole sector has no data" empty state replacing all 3 cards.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Sector classification of a `Tarefa` row | A new ad-hoc `if/else` chain duplicated in each of 6 query functions | Single `tarefaSetorWhere(setor)` helper in `src/lib/tipo-obrigacao-setor.ts`, imported everywhere | Single source of truth — a future bug fix (e.g., adding a new `TipoObrigacao` value) only needs one map updated, not 6 call sites |
| Per-sector chart/table rendering | 3 visually-identical copies of `DesempenhoColaboradoresChart`/`EvolucaoMensalChart`/`RankingEmpresasTable` | The 3 existing components, unchanged — they already accept data via props and have zero sector-specific logic | They were already written generically (no hardcoded "Fiscal" string anywhere in the chart files, confirmed by direct inspection) — duplicating them gains nothing and immediately creates the exact drift risk Pitfall B4 warns about |
| Tab state persistence across reloads | Custom `localStorage`/cookie logic for "remember last tab" | Nothing — 08-UI-SPEC.md explicitly states "Tab state persistence: None required" for v1 of this phase | Avoids unnecessary client state management the UI contract doesn't call for |

**Key insight:** Every piece of this phase that "looks like new code" is actually a parametrization of existing, working code. The only genuinely new logic is the `tarefaSetorWhere` sector-classification helper and the `DesempenhoMensal` schema extension (Pitfall 1) — everything else is wiring.

## Common Pitfalls

### Pitfall 1: `DesempenhoMensal` snapshot table has no `setor` discriminator — DP-07/CONT-08 cannot satisfy D-05 ("closed months never recalculated") without a schema change
**What goes wrong:** The existing `DesempenhoMensal` model (`@@unique([competencia, colaboradorId])`) stores ONE row per colaborador per month, aggregating ALL of that colaborador's tasks regardless of sector — but in practice today every colaborador belongs to exactly one sector (FISCAL/DP/CONTABIL via `Usuario.setor`), so the existing Fiscal-only rows are implicitly already "FISCAL-only" by virtue of who created them. If the snapshot-writing code (`calcularSnapshotMensal` in `src/modules/dashboards/snapshot.ts`, called from `executarGeracaoMensal`) is left unchanged, it will silently mix DP and Contábil task completions into the SAME unscoped row the moment any colaborador's tasks need to be queried per-sector — because `groupBy(["competencia"])` in `listarEvolucaoMensal` sums across ALL colaboradores' rows for that month, with no way to filter "only DP colaboradores' rows."
**Why it happens:** The snapshot table was designed in Phase 4 (v1.0) when there was exactly one sector (Fiscal) and the schema had no `setor` concept at all. Phase 5-7 added `Setor` to `Usuario`/`Empresa`/`EmpresaResponsavelSetor`, but `DesempenhoMensal` was never revisited because no dashboard read it per-sector until now.
**How to avoid:** Add a `setor: Setor` column to `DesempenhoMensal` (NOT NULL, backfilled `"FISCAL"` for all existing rows — those rows are 100% Fiscal-era data, verified by the fact that DP/Contábil tasks didn't exist before Phase 6/7). Change `@@unique([competencia, colaboradorId])` to `@@unique([competencia, colaboradorId, setor])`. Update `calcularSnapshotMensal` to accept/derive `setor` per colaborador (via `Usuario.setor` join, since a colaborador's tasks belong to exactly one sector at the time of completion) and write 3 independent rows (one per sector with data that month) instead of 1 row per colaborador. Update `listarEvolucaoMensal`'s `db.desempenhoMensal.groupBy` call to add `where: { setor }`.
**Warning signs:** DP's "evolução mensal" chart for a closed month shows numbers that include Fiscal or Contábil task completions, OR shows zero/missing data for a month where DP work clearly happened, OR a migration runs but the existing 197-company Fiscal historical rows lose their `competencia+colaboradorId` uniqueness guarantee (verify backfill count matches pre-migration row count exactly before considering this done).

### Pitfall 2: Avulsas tasks have no reliable sector tag at creation time — `responsavel.setor` fallback can be wrong if `criarTarefa` is later changed to allow cross-sector assignment
**What goes wrong:** Today, `criarTarefa` (in `src/app/(app)/tarefas/actions.ts`) lets ANY authenticated user pick ANY `responsavelId` from the dropdown — the UI (`nova-tarefa-dialog.tsx`) does not filter the colaborador selector by sector in the code inspected this session (SETOR-03's "filtra colaboradores pelo setor relevante" appears to be a UX/empresa-form-side decision per Phase 5, not yet verified as enforced on the avulsa-task creation dialog specifically). If a DONO assigns an avulsa task to, say, a Contábil colaborador for an empresa whose context is actually DP-related, the `responsavel.setor` fallback used by `tarefaSetorWhere` will (correctly, by the only available signal) classify that task as Contábil — which may or may not match the dono's mental model of "which dashboard should this show up in."
**Why it happens:** `Tarefa` was never given a `setor` column (confirmed: not in `prisma/schema.prisma`), so any classification of an avulsa task is necessarily inferred, never authoritative.
**How to avoid:** Document this as an accepted approximation for v2.0 (consistent with the CONTEXT.md note that this exact ambiguity was flagged as "Claude's Discretion" and explicitly deferred to research/planning, not resolved by the user). Do NOT attempt to retrofit a `Tarefa.setor` column in this phase — that is schema scope creep beyond the Success Criteria, which only ask for dashboards. If the dono finds the classification surprising in practice, that is an Open Question for a future quick-task, not a blocker for this phase.
**Warning signs:** A dashboard's "ranking de empresas problemáticas" includes a company that the dono doesn't associate with that sector at all — investigate whether an avulsa task's `responsavel.setor` is the cause before assuming a query bug.

### Pitfall 3: Reusing `EmpresaWhereExtra` incorrectly — applying the DP `temFuncionariosClt` filter to the `Tarefa`-side query instead of the `Empresa`-side carteira/ranking query
**What goes wrong:** D-02 says DP dashboards should only include empresas with `temFuncionariosClt: true`. It is tempting to add this filter directly to the `Tarefa`-level `where` clause (e.g., `tarefa.empresa.temFuncionariosClt: true`) — but this is actually REDUNDANT-BUT-HARMLESS for `tarefaSetorWhere`-scoped queries (a DP-sector task, by construction via `gerarTarefasDoMesDp`, can ONLY exist for an empresa that already had `temFuncionariosClt: true` at generation time — `executarGeracaoMensal` already gates the DP loop on `temFuncionariosClt: true`). The REAL place this filter matters is the `carteiras`/`empresaGroupBy` query (counting "how many empresas in this colaborador's portfolio") and the ranking query's empresa universe — those queries are NOT implicitly scoped by `Tarefa` existing, and must apply `empresaWhereExtra` explicitly, or a DP colaborador's "carteira" count will include non-CLT empresas they're not actually responsible for in DP.
**Why it happens:** It's easy to assume "the Tarefa filter and the Empresa filter need the same `temFuncionariosClt` condition," when in fact one is structurally redundant and the other is load-bearing.
**How to avoid:** Apply `empresaWhereExtra` (`{ temFuncionariosClt: true }` for DP, `{}` for Contábil) specifically to every `db.empresa.findMany`/`db.empresa.groupBy` call inside the 3 dashboard functions — NOT to the `db.tarefa.findMany` calls (which are already correctly scoped via `tarefaSetorWhere`).
**Warning signs:** A DP colaborador's "totalEmpresas" (carteira size) shown on the desempenho chart doesn't match the count of CLT-only empresas assigned to them via `EmpresaResponsavelSetor` — cross-check against `withVisibilityScope`'s DP branch logic in `src/lib/visibility-scope.ts`.

### Pitfall 4: Deleting `src/modules/dashboard/` (singular) without re-checking imports after THIS phase's other edits land
**What goes wrong:** The zero-imports scan was done in a prior session (per 08-CONTEXT.md `code_context`), before this phase's edits to `queries.ts` (plural) and `page.tsx`. If any new code in this phase is accidentally written against `@/modules/dashboard` (singular) instead of `@/modules/dashboards` (plural) — an easy typo given the near-identical names — deleting the singular module would break a brand-new import nobody intended to add.
**Why it happens:** The two module names differ by exactly one letter (`s`), and most editors' autocomplete will happily suggest either.
**How to avoid:** Re-run the import scan (`grep -r "modules/dashboard[\"']" src/` — note the closing quote right after `dashboard`, no `s`, to exclude `dashboards`) as the LAST step before deleting the singular directory, after all other phase 8 code changes are written — not just trusting the pre-phase scan.
**Warning signs:** `tsc --noEmit` fails with "Cannot find module '@/modules/dashboard/queries'" after deletion — if this happens, the new reference was almost certainly meant to be `@/modules/dashboards/queries` (plural).

## Code Examples

### Existing guard pattern (UNCHANGED structure, extended return shape)
```typescript
// Source: src/app/(app)/dashboards/guard.ts (existing, Phase 4)
// EXTENDED in this phase to fan out per sector — guard logic itself (auth +
// notFound) is verbatim unchanged, only the data-fetching body changes.
export async function carregarDadosDashboards(meses?: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DONO") notFound(); // T-4-01, unchanged

  const mesesParsed = meses !== undefined ? mesesSchema.safeParse(meses) : undefined;
  const quantidadeMeses = mesesParsed?.success ? mesesParsed.data : 6;
  const hoje = new Date();
  const inicio3Meses = subMonths(hoje, 3);

  const setores = ["FISCAL", "DP", "CONTABIL"] as const;
  const empresaScopePorSetor = {
    FISCAL: {},
    DP: { temFuncionariosClt: true }, // D-02
    CONTABIL: {}, // D-03 — full 197-empresa universe
  } satisfies Record<typeof setores[number], Prisma.EmpresaWhereInput>;

  const resultados = await Promise.all(
    setores.map(async (setor) => {
      const [desempenhoColaboradores, evolucaoMensal, rankingEmpresas] =
        await Promise.all([
          listarDesempenhoColaboradoresMesAtual(hoje, setor, empresaScopePorSetor[setor]),
          listarEvolucaoMensal(quantidadeMeses, setor),
          listarRankingEmpresas(inicio3Meses, hoje, setor, empresaScopePorSetor[setor]),
        ]);
      return [setor, { desempenhoColaboradores, evolucaoMensal, rankingEmpresas }] as const;
    })
  );

  return Object.fromEntries(resultados) as Record<
    typeof setores[number],
    { desempenhoColaboradores: unknown[]; evolucaoMensal: unknown[]; rankingEmpresas: unknown[] }
  >;
}
```

### Parametrized EmptyState (D-04)
```typescript
// Source: new file src/app/(app)/dashboards/empty-state.tsx, extracted from
// the existing inline function in page.tsx per 08-UI-SPEC.md copy table.
const COPY: Record<"FISCAL" | "DP" | "CONTABIL", { heading: string; body: string }> = {
  FISCAL: {
    heading: "Ainda não há dados suficientes",
    body: "Os dashboards são alimentados pelas tarefas concluídas a cada mês. Volte após o fechamento do primeiro mês de operação.",
  },
  DP: {
    heading: "Ainda não há dados suficientes de DP",
    body: "Os dashboards de DP são alimentados pelas tarefas de DP concluídas a cada mês. Volte após o fechamento do primeiro mês de operação.",
  },
  CONTABIL: {
    heading: "Ainda não há dados suficientes de Contábil",
    body: "Os dashboards de Contábil são alimentados pelas tarefas de Contábil concluídas a cada mês. Volte após o fechamento do primeiro mês de operação.",
  },
};

export function EmptyState({ setor }: { setor: "FISCAL" | "DP" | "CONTABIL" }) {
  const { heading, body } = COPY[setor];
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h2 className="text-xl font-semibold">{heading}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Single unscoped dashboard query module (Fiscal-only) | Sector-parametrized query module (3 sectors, 1 module) | This phase (Phase 8) | Every future sector-aware dashboard requirement reuses the same 6 functions — no new module needed for a hypothetical 4th sector |
| `DesempenhoMensal` snapshot with no sector dimension | `DesempenhoMensal` with `setor` column, `@@unique([competencia, colaboradorId, setor])` | This phase (mandatory per Pitfall 1) | Closed-month evolution charts become correctly sector-scoped; backfill required for existing Fiscal-era rows |

**Deprecated/outdated:**
- `src/modules/dashboard/queries.ts` (singular): broken from the moment it was committed (references non-existent `db.desempenhoMensalSnapshot`) — never functional, must be deleted, not migrated or "fixed."

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Avulsa task creation (`criarTarefa`) does not currently enforce sector-matching between the creator/empresa and the chosen `responsavelId` — confirmed by reading `src/app/(app)/tarefas/actions.ts` in this session, but the broader claim that "SETOR-03's colaborador-filtering is UI-only, not server-enforced" for the AVULSA dialog specifically (`nova-tarefa-dialog.tsx`) was confirmed by absence of a `setor` filter in that file's grep results, not by tracing every code path exhaustively | Common Pitfalls #2, Pattern 1 | If a server-side sector filter is actually applied somewhere not found by this session's greps, the `responsavel.setor` fallback for avulsas is unnecessary defensive code (harmless) rather than load-bearing — low risk either way |
| A2 | All pre-Phase-6 `DesempenhoMensal` rows can be safely backfilled with `setor = "FISCAL"` because DP/Contábil task generation did not exist before Phase 6/7 | Common Pitfalls #1 | If any historical data import or quick-task wrote non-Fiscal rows into `DesempenhoMensal` before Phase 6, the backfill would mis-tag those rows as FISCAL; verify row count and date range against Phase 6/7 ship dates before running the migration |

**If this table is empty:** N/A — see entries above. Both assumptions are LOW risk and narrowly scoped; neither blocks planning, both should be spot-checked during execution (a single `SELECT MIN(competencia) FROM desempenho_mensal` compared against Phase 6's ship date resolves A2 definitively).

## Open Questions

1. **Should `Tarefa` eventually get its own `setor` column instead of inferring it via `tipoObrigacao`/`responsavel.setor`?**
   - What we know: The current inference works correctly for 100% of recurring tasks (disjoint `TipoObrigacao` sets) and approximately-correctly for avulsas (via `responsavel.setor`, which can only be wrong if a colaborador's sector assignment doesn't match the task's actual context).
   - What's unclear: Whether the avulsas edge case (Pitfall 2) will actually surface as a real-world annoyance for the dono, given the small scale (5 colaboradores, avulsas are a minority of tasks per Phase 2 design).
   - Recommendation: Do not add `Tarefa.setor` in this phase (out of Success Criteria scope, would require a migration touching the highest-volume table). Revisit only if a future quick-task reports observed misclassification.

2. **Does the `DesempenhoMensal` schema change (Pitfall 1) belong in THIS phase's plan, or should it have been done earlier (Phase 6/7)?**
   - What we know: PITFALLS.md's own "Pitfall-to-Phase Mapping" table assigns Pitfall B4 (this exact dashboard duplication issue) to "Dashboard phase (last phase, but design decision made earlier)" — implying the underlying data model groundwork was SUPPOSED to happen earlier, but inspection confirms `DesempenhoMensal` was never touched in Phase 6 or 7.
   - What's unclear: Whether this was an intentional deferral or an oversight in the v2.0 roadmap.
   - Recommendation: The migration must happen in THIS phase regardless of origin — DP-07/CONT-08 cannot be implemented correctly (D-05 compliance) without it. Flag for the planner as a required Wave 0/1 task (schema migration + backfill verification), not an optional nice-to-have.

## Environment Availability

No external dependencies beyond the already-configured Neon Postgres (`DATABASE_URL`/`DIRECT_URL`, confirmed working per STATE.md prior phases) and the existing Node/npm toolchain. Skipping detailed table — this phase has no new infrastructure requirements.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.8 [VERIFIED: package.json] |
| Config file | `vitest.config.ts` (existing, no `@vitejs/plugin-react` — confirmed by `guard.ts`/`page.tsx` split pattern, must be preserved for new sector-aware tests) |
| Quick run command | `npx vitest run tests/dashboards.queries.test.ts tests/dashboards.rbac.test.ts tests/dashboards.snapshot.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| DP-06 | `listarDesempenhoColaboradoresMesAtual(mes, "DP", {temFuncionariosClt:true})` returns only DP-sector data, CLT-filtered | unit | `npx vitest run tests/dashboards.queries.test.ts -t "DP"` | ❌ Wave 0 — extend existing file |
| DP-07 | `listarEvolucaoMensal(n, "DP")` reads sector-scoped `DesempenhoMensal` rows for closed months | unit | `npx vitest run tests/dashboards.queries.test.ts -t "evolucao.*DP"` | ❌ Wave 0 |
| DP-08 | `listarRankingEmpresas(inicio, fim, "DP", {temFuncionariosClt:true})` ranks only CLT empresas | unit | `npx vitest run tests/dashboards.queries.test.ts -t "ranking.*DP"` | ❌ Wave 0 |
| CONT-07/08/09 | Same 3 functions parametrized `"CONTABIL"`, full empresa universe | unit | `npx vitest run tests/dashboards.queries.test.ts -t "CONTABIL"` | ❌ Wave 0 |
| All 6 | `tarefaSetorWhere(setor)` correctly classifies recurring + avulsa tasks per sector | unit | `npx vitest run tests/tipo-obrigacao-setor.test.ts` | ❌ Wave 0 — new test file |
| All 6 | `calcularSnapshotMensal` writes sector-scoped rows after schema migration | unit | `npx vitest run tests/dashboards.snapshot.test.ts` | ❌ Wave 0 — extend existing |
| (regression) | Fiscal dashboards unchanged in behavior/output after parametrization | regression | `npx vitest run tests/dashboards.rbac.test.ts tests/dashboards.queries.test.ts` | ✅ exists — must stay green |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/dashboards.*.test.ts tests/tipo-obrigacao-setor.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/tipo-obrigacao-setor.test.ts` — new file, covers `TIPOS_OBRIGACAO_POR_SETOR` completeness (every `TipoObrigacao` enum value appears in exactly one sector array — a test that would have caught a missing/duplicated mapping immediately) and `tarefaSetorWhere` shape
- [ ] Extend `tests/dashboards.queries.test.ts` with DP/CONTABIL parametrized cases for all 3 functions (currently only covers implicit-Fiscal calls)
- [ ] Extend `tests/dashboards.snapshot.test.ts` to cover the post-migration `setor`-aware `calcularSnapshotMensal` signature
- [ ] Migration test/verification script: row-count assertion that `DesempenhoMensal` backfill sets `setor = "FISCAL"` for all pre-existing rows, matching pre-migration row count exactly (mirrors the Phase 5 "197 FISCAL rows" verification pattern already used in this project)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | Unchanged — Auth.js v5 session, no auth logic touched this phase |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | DONO-only guard (`notFound()` pattern, T-4-01) — MUST remain the single entry point even with 3 sectors; do not add a per-tab/per-sector check, the existing top-level guard in `guard.ts` already covers all 3 sectors' data fetch |
| V5 Input Validation | yes | `mesesSchema` (existing `z.coerce.number().min(1).max(24)`) — unchanged, still the only user-controlled input (`?meses=`) on this page; sector selection is NOT a user-controlled query param (tabs are pure client UI state per UI-SPEC, no `?setor=` to validate) |
| V6 Cryptography | no | Not applicable to this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| IDOR via dashboard data leaking COLABORADOR-level detail to a non-DONO user | Information Disclosure | Existing `guard.ts` `notFound()` pre-query gate (T-4-01) — verified unchanged in this phase; `tests/dashboards.rbac.test.ts` regression-tests this and must stay green |
| Sector data cross-contamination (DP numbers bleeding into Contábil dashboard) | Tampering (data integrity, not security boundary, but treated with same rigor per Pitfall 1) | `tarefaSetorWhere` + sector-scoped `DesempenhoMensal` rows — verified via new unit tests in Wave 0 gaps above |

## Sources

### Primary (HIGH confidence)
- Direct inspection of this project's codebase (read in full this session): `prisma/schema.prisma`, `src/modules/dashboards/queries.ts`, `src/modules/dashboards/snapshot.ts`, `src/modules/dashboards/schema.ts`, `src/modules/dashboard/queries.ts` (orphan), `src/app/(app)/dashboards/page.tsx`, `guard.ts`, `desempenho-colaboradores-chart.tsx`, `evolucao-mensal-chart.tsx`, `ranking-empresas-table.tsx`, `src/lib/alert-prazo.ts`, `src/modules/tarefas/geracao.ts`, `src/lib/geracao-tarefas-dp.ts`, `src/lib/geracao-tarefas-contabil.ts`, `src/lib/geracao-tarefas-contabil-anual.ts`, `src/lib/visibility-scope.ts`, `src/app/(app)/tarefas/actions.ts`, `src/app/(app)/tarefas/nova-tarefa-dialog.tsx`, `tests/dashboards.rbac.test.ts`, `tests/dashboards.queries.test.ts`
- `.planning/research/PITFALLS.md` Pitfall B4 — direct first-party project research, already names the exact module-duplication risk and the orphan module
- `package.json` — verified installed versions (`next@15.5.19`, `@prisma/client@^6.19.3`, `date-fns@^4.4.0`, `vitest@^4.1.8`)

### Secondary (MEDIUM confidence)
- `npm view next version` / `npm view prisma version` (registry check, this session) — confirms current registry latest (16.2.9/7.8.0) is intentionally NOT what this project uses, per CLAUDE.md's documented stack decision

### Tertiary (LOW confidence)
- None — this phase required zero external/web research; the entire research surface was internal codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all versions read directly from `package.json`
- Architecture: HIGH — every pattern derived from direct inspection of working, already-shipped code in this exact repo
- Pitfalls: HIGH for Pitfalls 1/3/4 (derived from direct schema/code inspection); MEDIUM for Pitfall 2 (avulsa sector-tagging gap — confirmed via grep absence, not exhaustive trace of every code path)

**Research date:** 2026-06-25
**Valid until:** Stable until the next schema change touching `Tarefa`/`DesempenhoMensal`/`TipoObrigacao` — no external time-based decay (no third-party API/library versions are load-bearing for this phase)
