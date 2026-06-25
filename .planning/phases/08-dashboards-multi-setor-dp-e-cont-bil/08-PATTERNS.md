# Phase 8: Dashboards Multi-Setor — DP e Contábil - Pattern Map

**Mapped:** 2026-06-25
**Files analyzed:** 9 (3 modified core, 1 new lib, 1 new component, 1 schema migration, 3 test files)
**Analogs found:** 9 / 9 (all are direct self-extensions of Phase 4 Fiscal code — this phase is a parametrization exercise, not a from-scratch build)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|----------------|
| `src/modules/dashboards/queries.ts` (MODIFY) | service | CRUD (read aggregation) | itself (Phase 4, same file) | exact — extend in place |
| `src/modules/dashboards/snapshot.ts` (MODIFY) | service | batch (monthly aggregation, transactional) | itself (Phase 4, same file) | exact — extend in place |
| `src/app/(app)/dashboards/guard.ts` (MODIFY) | controller (server-only data loader) | request-response | itself (Phase 4, same file) | exact — extend in place |
| `src/app/(app)/dashboards/page.tsx` (MODIFY) | component (Server Component) | request-response | itself (Phase 4, same file) | exact — extend in place |
| `src/app/(app)/dashboards/empty-state.tsx` (NEW) | component | request-response (pure presentation) | inline `EmptyState()` function currently in `page.tsx` (lines 81-91) | exact — extraction + parametrization |
| `src/lib/tipo-obrigacao-setor.ts` (NEW) | utility | transform (enum classification → Prisma where clause) | `src/lib/alert-prazo.ts` (`classificarTarefaDesempenho`, pure classification function) and `src/lib/visibility-scope.ts` (`withVisibilityScope`, Prisma where-builder pattern) | role-match |
| `prisma/schema.prisma` (MODIFY — `DesempenhoMensal` model) | migration | batch | itself (existing model, same file) | exact — add column + adjust unique constraint |
| `tests/dashboards.queries.test.ts` (MODIFY) | test | request-response | itself (Phase 4, same file) | exact — extend with DP/CONTABIL cases |
| `tests/tipo-obrigacao-setor.test.ts` (NEW) | test | transform | `tests/dashboards.rbac.test.ts` (structure: describe/it, vi.mock pattern) | role-match |
| `src/modules/dashboard/` (DELETE — singular, orphan) | — | — | n/a — deletion target, NOT a pattern source | n/a |

## Pattern Assignments

### `src/modules/dashboards/queries.ts` (service, CRUD read aggregation) — MODIFY IN PLACE

**Analog:** itself, `src/modules/dashboards/queries.ts` (Phase 4, full file read this session)

**Imports pattern** (lines 1-3):
```typescript
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { db } from "@/lib/db";
import { competenciaAtual } from "@/lib/competencia";
```
Add: `import type { Setor, Prisma } from "@prisma/client";` and `import { tarefaSetorWhere } from "@/lib/tipo-obrigacao-setor";`

**Core pattern — function signature extension** (lines 46-50, `listarDesempenhoColaboradoresMesAtual`):
```typescript
export async function listarDesempenhoColaboradoresMesAtual(
  mes: Date
): Promise<DesempenhoColaborador[]> {
```
becomes (per RESEARCH.md Pattern 2, Code Examples section — already fully specified):
```typescript
export async function listarDesempenhoColaboradoresMesAtual(
  mes: Date,
  setor: Setor,
  empresaWhereExtra: Prisma.EmpresaWhereInput = {}
): Promise<DesempenhoColaborador[]> {
```

**Merging the sector filter into the existing `Tarefa` query** (lines 55-70, the `db.tarefa.findMany` call):
```typescript
const concluidas = await db.tarefa.findMany({
  where: {
    status: "CONCLUIDA",
    historico: { some: { concluidoEm: { gte: inicio, lte: fim } } },
  },
  select: { /* ... */ },
});
```
→ merge via spread: `where: { status: "CONCLUIDA", historico: {...}, ...tarefaSetorWhere(setor) }`

**Empresa-side filter (D-02/D-03 — Pitfall 3, load-bearing, NOT redundant here)** (lines 88-92, `db.empresa.groupBy` "carteiras" query):
```typescript
const carteiras = await db.empresa.groupBy({
  by: ["responsavelId"],
  where: { ativo: true },
  _count: { id: true },
});
```
→ `where: { ativo: true, ...empresaWhereExtra }` — this is the ONE place `empresaWhereExtra` must apply (per RESEARCH.md Pitfall 3); do NOT add `empresaWhereExtra` to the `Tarefa` query above, it is structurally redundant there.

**`listarEvolucaoMensal` — DesempenhoMensal groupBy must add `setor`** (lines 214-241):
```typescript
const snapshots =
  competenciasFechadas.length > 0
    ? await db.desempenhoMensal.groupBy({
        by: ["competencia"],
        where: { competencia: { in: competenciasFechadas } },
        _sum: { /* 7 fields, unchanged */ },
      })
    : [];
```
→ `where: { competencia: { in: competenciasFechadas }, setor }` (requires the schema migration below). Signature gains `setor: Setor` second param; the recursive call to `listarDesempenhoColaboradoresMesAtual` inside this function (line 264) must thread `setor`/`empresaWhereExtra` through too.

**`listarRankingEmpresas` — same merge pattern** (lines 312-318):
```typescript
export async function listarRankingEmpresas(
  periodoInicio: Date,
  periodoFim: Date
): Promise<RankingEmpresa[]> {
  const tarefas = await db.tarefa.findMany({
    where: { prazo: { gte: periodoInicio, lte: periodoFim } },
    select: { /* ... */ },
  });
```
→ add `setor: Setor, empresaWhereExtra: Prisma.EmpresaWhereInput = {}` params; merge `...tarefaSetorWhere(setor)` into the `where`; apply `empresaWhereExtra` to whichever empresa-universe query backs the ranking population (currently implicit via `Tarefa.empresa` relation — verify against D-02/D-03 at implementation time, since this function currently has no separate `db.empresa` query to attach the filter to; the `Tarefa`-level `empresaId`-derived universe may need an added `empresa: { ...empresaWhereExtra }` relation filter, which is the one departure from "never filter Tarefa by empresaWhereExtra" — because ranking's universe IS the empresa universe, unlike desempenho's carteira-count use case).

**Return type stays unchanged** — same flat serializable array pattern (lines 109-120, comment block lines 43-45 documents WHY: "SEMPRE um array de objetos planos e serializáveis — NUNCA um Map").

---

### `src/modules/dashboards/snapshot.ts` (service, batch/transactional) — MODIFY IN PLACE

**Analog:** itself, `src/modules/dashboards/snapshot.ts` (Phase 4, full file read this session)

**Imports** (lines 29-30):
```typescript
import { endOfMonth, startOfMonth } from "date-fns";
import type { Prisma } from "@prisma/client";
```

**Core change — `calcularSnapshotMensal` must derive setor per colaborador and write one row per (colaborador, setor) pair** (lines 62-65, function signature):
```typescript
export async function calcularSnapshotMensal(
  tx: Prisma.TransactionClient,
  competencia: string
): Promise<LinhaSnapshotMensal[]> {
```
Per RESEARCH.md Pitfall 1: must join `Usuario.setor` (already exists on schema, line 65 of schema.prisma: `setor Setor?`) when building `porColaborador`/`categoriasPorColaborador` maps, and the returned `LinhaSnapshotMensal` type (lines 48-60) gains a `setor: Setor` field. The grouping key changes from `colaboradorId` alone to `colaboradorId+setor` composite (in practice: read `Usuario.setor` once via a `db.usuario.findMany({ select: { id: true, setor: true } })` lookup, since `Tarefa.responsavelId` is the join key already used at lines 77, 160 — no new join needed on the `Tarefa` query itself, only a post-aggregation enrichment step).

**Critical comment to preserve verbatim** (lines 8-20): the `concluidoEm`-range-not-`Tarefa.competencia` rule and the `Tarefa.responsavelId`-not-`Empresa.responsavelId` rule (Pitfall 3) both still apply unchanged — only the output shape gains the `setor` dimension.

---

### `src/app/(app)/dashboards/guard.ts` (controller/server-data-loader, request-response) — MODIFY IN PLACE

**Analog:** itself, `src/app/(app)/dashboards/guard.ts` (Phase 4, full file read this session, 45 lines)

**Full current file as the literal base to extend** (lines 1-44):
```typescript
import { notFound, redirect } from "next/navigation";
import { subMonths } from "date-fns";
import { auth } from "@/auth";
import {
  listarDesempenhoColaboradoresMesAtual,
  listarEvolucaoMensal,
  listarRankingEmpresas,
} from "@/modules/dashboards/queries";
import { mesesSchema } from "@/modules/dashboards/schema";

export async function carregarDadosDashboards(meses?: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DONO") notFound();

  const mesesParsed = meses !== undefined ? mesesSchema.safeParse(meses) : undefined;
  const quantidadeMeses = mesesParsed?.success ? mesesParsed.data : 6;

  const hoje = new Date();
  const inicio3Meses = subMonths(hoje, 3);

  const [desempenhoColaboradores, evolucaoMensal, rankingEmpresas] =
    await Promise.all([
      listarDesempenhoColaboradoresMesAtual(hoje),
      listarEvolucaoMensal(quantidadeMeses),
      listarRankingEmpresas(inicio3Meses, hoje),
    ]);

  return { desempenhoColaboradores, evolucaoMensal, rankingEmpresas };
}
```

**Guard lines 12-14 are the load-bearing security barrier — MUST remain verbatim, unchanged, and MUST execute before the new per-sector fan-out:**
```typescript
const session = await auth();
if (!session?.user) redirect("/login");
if (session.user.role !== "DONO") notFound();
```

**Extension pattern — already fully specified in RESEARCH.md "Code Examples" section** (the `setores.map(...)` + `Promise.all` fan-out, `empresaScopePorSetor` record with `DP: { temFuncionariosClt: true }` / `CONTABIL: {}` per D-02/D-03) — copy that block verbatim as the new function body, keeping the guard lines above untouched at the top.

---

### `src/app/(app)/dashboards/page.tsx` (component, Server Component, request-response) — MODIFY IN PLACE

**Analog:** itself, `src/app/(app)/dashboards/page.tsx` (Phase 4, full file read this session, 92 lines)

**Current 3-Card layout to replicate inside each `TabsContent`** (lines 39-76, one representative Card):
```typescript
<Card>
  <CardHeader>
    <CardTitle>Desempenho por colaborador</CardTitle>
  </CardHeader>
  <CardContent>
    {desempenhoColaboradores.length === 0 ? (
      <EmptyState />
    ) : (
      <DesempenhoColaboradoresChart dados={desempenhoColaboradores} />
    )}
  </CardContent>
</Card>
```
This exact 3-Card block (Desempenho/Evolução/Ranking, lines 39-76) must be extracted into a `SectorDashboard({ setor, dados })` helper component (per RESEARCH.md "Recommended Project Structure" — not a new file requirement, can live in `page.tsx` itself as a local function) and rendered 3× inside `<TabsContent>`, per RESEARCH.md Pattern 3 (Tabs as pure client-side view switch, full code example already provided in RESEARCH.md lines 248-274 — copy verbatim, only swapping in the `SectorDashboard` helper for the inline Card JSX).

**Import line to add:**
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "./empty-state";
```
(remove the now-extracted inline `EmptyState` function from this file, lines 81-91.)

---

### `src/app/(app)/dashboards/empty-state.tsx` (NEW — component, request-response/presentation)

**Analog:** the inline `EmptyState()` function currently in `page.tsx` (lines 81-91, the exact code being extracted)

**Current inline version (extraction source):**
```typescript
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h2 className="text-xl font-semibold">Ainda não há dados suficientes</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Os dashboards são alimentados pelas tarefas concluídas a cada mês.
        Volte após o fechamento do primeiro mês de operação.
      </p>
    </div>
  );
}
```

**Target shape — already fully specified in RESEARCH.md "Code Examples" section** (the `COPY` record keyed by `"FISCAL" | "DP" | "CONTABIL"` with heading/body per D-04, and the parametrized `EmptyState({ setor })` component) — copy that block verbatim; the `className`s (`flex flex-col items-center gap-2 py-16 text-center` / `max-w-md text-sm text-muted-foreground`) are pixel-identical to the original, only the text content varies by `setor`. Copy text values are also locked verbatim in `08-UI-SPEC.md` Copywriting Contract table (lines 108-113).

---

### `src/lib/tipo-obrigacao-setor.ts` (NEW — utility, transform: enum classification → Prisma where clause)

**Analog 1 (classification-function shape):** `src/lib/alert-prazo.ts` — exports `classificarTarefaDesempenho`, a pure function taking a tarefa-shaped object and a reference date, returning a classification. Same "pure function, no I/O, single responsibility" shape to follow for `tarefaSetorWhere`.

**Analog 2 (Prisma where-builder shape):** `src/lib/visibility-scope.ts` — exports `withVisibilityScope`/`withTarefaScope`, functions that take a `SessionUser`-like input and return a `Prisma.*WhereInput` fragment to be merged into a caller's query. This is the closer structural analog for `tarefaSetorWhere(setor): Prisma.TarefaWhereInput` — same "build a where fragment, let caller spread/AND it in" convention already established for sector/visibility scoping in this codebase.

**Target implementation — already fully specified in RESEARCH.md Pattern 1** (the `TIPOS_OBRIGACAO_POR_SETOR` const, derived from the 4 generation catalogs, and the `tarefaSetorWhere(setor)` function with the `OR: [{ tipoObrigacao: { in: [...] } }, { tipoObrigacao: null, responsavel: { setor } }]` shape) — copy verbatim from RESEARCH.md lines 169-202.

---

### `prisma/schema.prisma` — `DesempenhoMensal` model (MIGRATION)

**Analog:** the model itself, current state (lines 168-192, full block read this session):
```prisma
model DesempenhoMensal {
  id                  String   @id @default(cuid())
  competencia         String
  colaboradorId       String
  colaborador         Usuario  @relation(fields: [colaboradorId], references: [id])
  totalConcluidas     Int
  concluidasNoPrazo   Int
  totalEmpresas       Int
  totalTarefasPeriodo Int
  totalCriadas             Int      @default(0)
  totalConcluidasNoPeriodo Int      @default(0)
  totalPendentesSemMotivo  Int      @default(0)
  totalPendentesComMotivo  Int      @default(0)
  totalVencidas            Int      @default(0)
  createdAt           DateTime @default(now())

  @@unique([competencia, colaboradorId])
  @@index([competencia])
  @@index([colaboradorId])
  @@map("desempenho_mensal")
}
```
**Required change (per RESEARCH.md Pitfall 1):** add `setor Setor` field (NOT NULL, backfilled `"FISCAL"` for all pre-existing rows — same backfill-pattern precedent already used for `Empresa`/`Usuario.setor` columns added in Phase 5/6), and change `@@unique([competencia, colaboradorId])` → `@@unique([competencia, colaboradorId, setor])`. The `Setor` enum already exists at lines 19-23 of this file — no new enum needed, just reference it. Follow this project's established pattern for adding a NOT-NULL column to an existing populated table: add as nullable/`@default`, backfill via script, then tighten — same caution as documented in the `DesempenhoMensal` migration history (the existing `totalCriadas`/etc. fields at lines 182-186 already demonstrate the "`@default(0)` preserves existing rows" convention used by this exact model previously — same approach should be used for `setor` but with a literal backfill `UPDATE` to `"FISCAL"` rather than a zero-value default, since `Setor` has no natural default).

---

### `tests/dashboards.queries.test.ts` (MODIFY) and `tests/tipo-obrigacao-setor.test.ts` (NEW)

**Analog:** `tests/dashboards.rbac.test.ts` (full file read this session, 85 lines) — establishes the project's test conventions: `describe`/`it`/`expect` from `vitest`, `vi.mock` for `next/navigation` and `@/auth`, `beforeEach` resetting all mocks, dynamic `await import(...)` of the module under test AFTER mocks are registered (required because `vi.mock` calls are hoisted but the guard module captures its imports at import-time).

**Pattern to reuse for `tests/tipo-obrigacao-setor.test.ts` (pure unit test, no mocking needed since `tarefaSetorWhere` has no I/O):**
```typescript
import { describe, it, expect } from "vitest";
import { tarefaSetorWhere, TIPOS_OBRIGACAO_POR_SETOR } from "@/lib/tipo-obrigacao-setor";

describe("tarefaSetorWhere", () => {
  it("classifica TipoObrigacao FOLHA como DP", () => {
    const where = tarefaSetorWhere("DP");
    expect(where.OR?.[0]).toEqual({ tipoObrigacao: { in: expect.arrayContaining(["FOLHA"]) } });
  });
});

describe("TIPOS_OBRIGACAO_POR_SETOR completeness", () => {
  it("cada valor do enum TipoObrigacao aparece em exatamente um setor", () => {
    // enumerate prisma's TipoObrigacao values, assert union covers all with no overlap
  });
});
```

**Pattern to reuse for extending `tests/dashboards.queries.test.ts`:** read the existing file structure before editing (not read this session — Wave 0 task per RESEARCH.md Validation Architecture table) and add parametrized `it.each`-style or duplicated `it(...)` blocks per the existing file's convention, covering `setor="DP"` with `temFuncionariosClt: true` and `setor="CONTABIL"` with full universe, per the Phase Requirements → Test Map table in RESEARCH.md.

---

## Shared Patterns

### DONO-only Authorization Guard (T-4-01)
**Source:** `src/app/(app)/dashboards/guard.ts` lines 12-14
```typescript
const session = await auth();
if (!session?.user) redirect("/login");
if (session.user.role !== "DONO") notFound();
```
**Apply to:** `guard.ts` only (single entry point for all 3 sectors) — per RESEARCH.md Security Domain table, do NOT add a per-tab/per-sector re-check; the existing top-level guard already covers all 3 sectors' fan-out.

### Sector Classification Helper (cross-cutting, new this phase)
**Source:** `src/lib/tipo-obrigacao-setor.ts` (new) — `tarefaSetorWhere(setor)`
**Apply to:** All 3 functions in `src/modules/dashboards/queries.ts`, and `src/modules/dashboards/snapshot.ts`'s setor-derivation logic (via `Usuario.setor` join, not `tarefaSetorWhere` directly — snapshot derives setor from the colaborador's `Usuario.setor`, not from `tipoObrigacao`, since the snapshot already groups by colaborador).

### Empresa-side universe filter (D-02/D-03)
**Source:** `empresaWhereExtra: Prisma.EmpresaWhereInput` parameter pattern, RESEARCH.md Pattern 2
**Apply to:** Every `db.empresa.findMany`/`db.empresa.groupBy` call inside the 3 dashboard query functions — `{ temFuncionariosClt: true }` for DP, `{}` for CONTABIL/FISCAL. Per Pitfall 3, do NOT apply to `Tarefa`-level queries (already correctly scoped via `tarefaSetorWhere`), except for `listarRankingEmpresas` where the empresa universe IS the ranking universe (see note in that section above).

### Serializable return shape (Server → Client boundary)
**Source:** `src/modules/dashboards/queries.ts` lines 43-45 (comment), enforced by every return statement in the file (e.g. lines 109-120)
```
RETORNO: SEMPRE um array de objetos planos e serializáveis — NUNCA um Map.
```
**Apply to:** All 3 query functions, unchanged by this phase — `setor`-parametrization does not change the return shape, only the population filtered into it.

### Chart/Table component reuse (binding, per UI-SPEC)
**Source:** `desempenho-colaboradores-chart.tsx`, `evolucao-mensal-chart.tsx`, `ranking-empresas-table.tsx` — all read this session, confirmed zero hardcoded "Fiscal" strings, all accept `dados` via props only (e.g. `desempenho-colaboradores-chart.tsx` line 31-35: `export function DesempenhoColaboradoresChart({ dados }: { dados: DesempenhoColaborador[] })`)
**Apply to:** All 3 sector tabs — these 3 files are NOT modified this phase, only fed different `dados` per tab.

## No Analog Found

None — every file in this phase's scope is either a direct in-place extension of an existing, fully-read Phase 4 file, or a new utility/component whose shape is already fully specified in RESEARCH.md's "Code Examples" section (copy-paste ready). The orphan `src/modules/dashboard/` (singular) is explicitly excluded as a pattern source per task instructions — it is a deletion target only (confirmed broken: references non-existent `db.desempenhoMensalSnapshot`, zero imports anywhere in `src/`).

## Metadata

**Analog search scope:** `src/modules/dashboards/`, `src/modules/dashboard/` (orphan, deletion-only), `src/app/(app)/dashboards/`, `src/lib/alert-prazo.ts`, `src/lib/visibility-scope.ts`, `tests/dashboards.rbac.test.ts`, `prisma/schema.prisma`
**Files scanned:** 11 (queries.ts, snapshot.ts, guard.ts, page.tsx, schema.ts, desempenho-colaboradores-chart.tsx, ranking-empresas-table.tsx, dashboard/queries.ts orphan, dashboards.rbac.test.ts, schema.prisma enum/model sections)
**Pattern extraction date:** 2026-06-25
