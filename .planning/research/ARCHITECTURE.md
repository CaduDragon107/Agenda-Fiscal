# Architecture Research

**Domain:** Multi-sector extension of an existing Next.js/Prisma task-management system (Agenda Fiscal v2.0 — adding DP and Contábil sectors alongside the already-shipped Fiscal sector)
**Researched:** 2026-06-22
**Confidence:** HIGH — grounded in direct reading of the actual v1.0 codebase (prisma/schema.prisma, src/modules/tarefas/geracao.ts, src/lib/visibility-scope.ts, src/modules/dashboards/*, src/app/(app)/dashboards/*, src/modules/empresas/queries.ts, src/types/next-auth.d.ts), not generic domain research.

**Note on supersession:** This file replaces the v1.0 generic ecosystem ARCHITECTURE.md (researched 2026-06-11, pre-implementation). The actual v1.0 build diverged from that early research in one notable way: obligation rules ended up hardcoded in `src/lib/geracao-tarefas.ts` (`CATALOGO_OBRIGACOES` constant) rather than living in a data-driven `regras_obrigacao` table as originally recommended. This v2.0 document reflects what was actually built, not what was originally proposed.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  PRESENTATION (src/app/(app)/...)                                    │
│  ┌──────────────┐  ┌──────────────────────┐  ┌────────────────────┐ │
│  │ /empresas     │  │ /dashboards (DONO)    │  │ /tarefas            │ │
│  │ (CRUD)        │  │ guard.ts → queries.ts │  │ (lista escopada)    │ │
│  └──────┬───────┘  └──────────┬───────────┘  └─────────┬───────────┘ │
├─────────┴─────────────────────┴───────────────────────┴──────────────┤
│  AUTHORIZATION (src/lib/visibility-scope.ts)                          │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ withVisibilityScope(user) → Prisma.EmpresaWhereInput          │    │
│  │ withTarefaScope(user)     → Prisma.TarefaWhereInput           │    │
│  │ DONO → {}  |  COLABORADOR → { responsavelId: user.id }        │    │
│  └──────────────────────────────────────────────────────────────┘    │
├────────────────────────────────────────────────────────────────────────┤
│  DOMAIN MODULES (src/modules/*)                                       │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ empresas/  │  │ tarefas/     │  │ dashboards/                  │  │
│  │ queries.ts │  │ geracao.ts   │  │ queries.ts, snapshot.ts,      │  │
│  │ schema.ts  │  │ queries.ts   │  │ schema.ts                     │  │
│  └────────────┘  └──────┬───────┘  └──────────────────────────────┘  │
├──────────────────────────┴─────────────────────────────────────────────┤
│  PURE CALCULATION (src/lib/*, no I/O)                                 │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ geracao-tarefas.ts│  │ dia-util.ts  │  │ competencia.ts        │   │
│  │ CATALOGO_OBRIGACOES│ │ anticiparPara│  │ "YYYY-MM" canonical   │   │
│  │ gerarTarefasDoMes │  │ DiaUtil       │  │ format                │   │
│  └──────────────────┘  └──────────────┘  └──────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  SCHEDULING (instrumentation.ts boot hook, no session)                │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ node-cron → executarGeracaoMensal(competencia)                │    │
│  │   reads Empresa directly, NEVER calls withTarefaScope          │    │
│  └──────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│  PERSISTENCE (Prisma + Postgres/Neon)                                 │
│  ┌──────────┐ ┌─────────┐ ┌────────┐ ┌─────────────────┐ ┌─────────┐ │
│  │ Usuario  │ │ Empresa │ │ Tarefa │ │ TarefaHistorico  │ │Desempenho│ │
│  │          │ │         │ │        │ │                  │ │Mensal   │ │
│  └──────────┘ └─────────┘ └────────┘ └─────────────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (current v1.0 state, before v2.0 changes)

| Component | Responsibility | Current State |
|-----------|----------------|------------------------|
| `prisma/schema.prisma` | Source of truth for data shape | `Empresa.responsavelId` is a single FK; no `setor` concept anywhere; `TipoObrigacao` enum is fiscal-only (`ICMS \| PIS_COFINS \| SPED_FISCAL \| SPED_CONTRIBUICOES \| DAS`) |
| `src/lib/visibility-scope.ts` | Central authorization predicate, spread into every Prisma `where` | Two functions (`withVisibilityScope` for Empresa, `withTarefaScope` for Tarefa), both keyed only on `role` + `responsavelId` — no sector awareness |
| `src/lib/geracao-tarefas.ts` | Pure catalog + calculation of which obligations exist per regime, with day-of-month base + business-day adjustment | `CATALOGO_OBRIGACOES` is a hardcoded `Record<RegimeTributario, ObrigacaoRegra[]>` (code, not a data table); `gerarTarefasDoMes` assumes exactly one obligation set, one responsible person, one month-ahead deadline pattern — no concept of annual periodicity or sector |
| `src/modules/tarefas/geracao.ts` (`executarGeracaoMensal`) | Orchestrates: freeze prior month's snapshot, read active `Empresa`, generate + persist tasks via idempotent `createMany` | Single monthly entrypoint; cron triggers it with only a `competencia` string; explicitly bypasses auth scope (correct, since cron has no session) |
| `src/modules/dashboards/{queries,schema,snapshot}.ts` + `src/app/(app)/dashboards/*` | DONO-only aggregation (desempenho colaboradores, evolução mensal, ranking empresas), frozen via `DesempenhoMensal` for closed months, live for current month | All three dashboard queries implicitly operate over ALL tasks/companies — no sector filter exists; `guard.ts` checks `role !== "DONO"` only |
| `src/modules/empresas/queries.ts` | Scoped CRUD reads | `EMPRESA_SELECT` includes a single `responsavel` relation; `listarResponsaveis()` returns ALL usuarios with no sector filter |
| `src/types/next-auth.d.ts` / session | Carries `id` + `role` only | No `setor` field on session user — needs extension if sector-based UI gating is desired beyond pure DB scoping |

**Stale/orphaned code found:** `src/modules/dashboard/queries.ts` (singular "dashboard", currently untracked in git) references a `db.desempenhoMensalSnapshot` model that **does not exist** in the current `schema.prisma` (the real model is `DesempenhoMensal`). This is leftover/abandoned WIP from an earlier design iteration that does not compile against the current schema. It should be deleted, not extended, when building v2.0 — do not confuse it with the active `src/modules/dashboards/` (plural) module.

## Recommended Project Structure (v2.0 target)

```
prisma/
└── schema.prisma                      # MODIFIED: add Setor enum, Usuario.setor,
                                        #   EmpresaResponsavelSetor junction model,
                                        #   TipoObrigacao additions, Tarefa.setor +
                                        #   Tarefa.periodicidade, DesempenhoMensal
                                        #   unique constraint extended with setor
src/
├── lib/
│   ├── visibility-scope.ts            # MODIFIED: scope functions take an optional
│   │                                   #   `setor` param; Tarefa/Empresa where clauses
│   │                                   #   gain a sector-aware join through the new
│   │                                   #   junction table
│   ├── geracao-tarefas.ts             # UNCHANGED — stays the Fiscal-only catalog;
│   │                                   #   do NOT generalize into one mega-catalog
│   ├── geracao-tarefas-dp.ts          # NEW: DP catalog (folha, FGTS, INSS, eSocial) — monthly
│   ├── geracao-tarefas-contabil.ts    # NEW: Contábil catalog — monthly (balancete/
│   │                                   #   escrituração) + annual (ECF/DEFIS)
│   └── dia-util.ts                    # UNCHANGED — periodicity-agnostic, reused as-is
├── modules/
│   ├── empresas/
│   │   ├── queries.ts                 # MODIFIED: EMPRESA_SELECT includes
│   │   │                               #   responsaveisPorSetor (new relation);
│   │   │                               #   listarResponsaveis(setor?) gains filter
│   │   └── schema.ts                  # MODIFIED: empresa form schema accepts 3
│   │                                   #   responsavel fields instead of 1
│   ├── tarefas/
│   │   ├── geracao.ts                 # MODIFIED: executarGeracaoMensal extended to
│   │   │                               #   also generate DP + Contábil-mensal tasks;
│   │   │                               #   new sibling executarGeracaoAnual(ano)
│   │   ├── queries.ts                 # MODIFIED: list queries gain setor filter
│   │   └── schema.ts                  # MODIFIED: extend enum validation,
│   │                                   #   add competenciaAnualSchema ("YYYY")
│   ├── dashboards/                     # (delete orphaned sibling "dashboard/" dir —
│   │   │                               #   do not extend it, see note above)
│   │   ├── queries.ts                 # MODIFIED: every query gains a `setor` param,
│   │   │                               #   filters Empresa/Tarefa/Usuario by it
│   │   ├── schema.ts                  # MODIFIED: add `setorSchema` (enum validation)
│   │   └── snapshot.ts                # MODIFIED: snapshot keyed by
│   │                                   #   (competencia, colaboradorId, setor)
├── app/(app)/
│   ├── dashboards/fiscal/              # RENAMED from dashboards/ — existing
│   │   │                               #   page.tsx, guard.ts, *chart.tsx move here
│   │   │                               #   unchanged except setor="FISCAL" added
│   ├── dashboards/dp/                  # NEW: same guard.ts pattern, setor="DP" fixed
│   │   └── page.tsx, guard.ts, *chart.tsx
│   └── dashboards/contabil/            # NEW: same guard.ts pattern, setor="CONTABIL" fixed
│       └── page.tsx, guard.ts, *chart.tsx
└── types/
    └── next-auth.d.ts                  # MODIFIED (optional): add `setor` to
                                         #   Session.user / JWT only if sector-gating
                                         #   decisions need to happen client-side;
                                         #   server-side scoping works from a DB
                                         #   lookup of Usuario.setor without this
```

### Structure Rationale

- **`src/lib/geracao-tarefas-dp.ts` / `-contabil.ts` as separate files, not one mega-catalog:** Fiscal's catalog (`CATALOGO_OBRIGACOES`) is keyed purely by `RegimeTributario`. DP obligations don't vary by regime tributário at all (folha/FGTS/INSS apply regardless of Lucro Real vs Simples) — forcing DP into the same `Record<RegimeTributario, ObrigacaoRegra[]>` shape would mean duplicating identical rows across regimes for no reason. Splitting per-sector keeps each catalog's natural key (Fiscal: by regime; DP: flat list; Contábil: by periodicidade) instead of contorting all three into one generic shape.
- **`dashboards/fiscal/`, `dashboards/dp/`, `dashboards/contabil/` as sibling route folders, not one parametrized `dashboards/[setor]/`:** PROJECT.md explicitly states "v2.0 mantém dashboards separados por setor" as a deliberate scoping decision (no unified cross-sector view, see "Out of Scope"). A dynamic `[setor]` route would tempt future merging of logic and risks a setor value leaking into a URL param that bypasses the guard; three static folders with their own `guard.ts` (literally copy-pasted with a hardcoded `setor` value, same pattern as today's single `guard.ts`) keeps each sector's access control trivially auditable in isolation — consistent with this codebase's existing preference for explicit, repeated guards over generic indirection (see the `T-4-01` comment in the current `guard.ts`).
- **`visibility-scope.ts` stays one file, gains a `setor` parameter on existing functions (not 3 new functions):** the file's whole purpose is "this is the ONE place every scoped query must call into." Adding `withVisibilityScope(user, setor?)` preserves the existing call-site contract (`...withVisibilityScope(user)` spreads still work since `setor` is optional) while giving COLABORADOR-scoped queries a way to also filter by sector responsibility once `EmpresaResponsavelSetor` exists.

## Architectural Patterns

### Pattern 1: Junction table for per-sector responsibility (`EmpresaResponsavelSetor`)

**What:** Replace the single `Empresa.responsavelId` FK with a junction model `EmpresaResponsavelSetor { empresaId, setor, usuarioId }`, unique on `(empresaId, setor)`.

**When to use:** Whenever an entity needs exactly-one-owner-per-category and the category set might grow (today 3 sectors, but the shape should not require a schema migration if a 4th sector appears later).

**Trade-offs:**
- **Junction table (recommended)** — pros: adding a 4th sector later is a data change, not a schema change; querying "all empresas where I'm the DP responsible" is one `WHERE setor = 'DP' AND usuarioId = ?` instead of `WHERE responsavelDpId = ?`; `@@unique([empresaId, setor])` naturally enforces "one responsible per sector per company," matching how `@@unique([empresaId, tipoObrigacao, competencia])` already enforces idempotency elsewhere in this codebase — consistent with established project conventions. Cons: requires a join wherever the old direct FK read was a simple field access; existing code that reads `empresa.responsavelId` directly (cron's `executarGeracaoMensal`, `gerarTarefasDoMes`, dashboards' `groupBy(["responsavelId"])`) must be rewritten to read through the junction, scoped by sector.
- **3 nullable FK columns** (`responsavelFiscalId`, `responsavelDpId`, `responsavelContabilId`) — pros: zero joins, trivial Prisma `include`, minimal rewrite of existing direct-field-access code. Cons: adding a 4th sector requires an `ALTER TABLE` plus code changes everywhere sectors are enumerated; cannot enforce "exactly one responsible per sector" via a single constraint as cleanly; the existing `responsavel: Usuario @relation("ResponsavelEmpresa")` naming pattern would need 3 distinct relation names, increasing schema verbosity without a corresponding flexibility gain.

**Recommendation: junction table.** This codebase already uses this exact shape successfully (`EmpresaRegimeHistorico` is a junction-like time-series table off `Empresa`, and `@@unique` compound constraints are the established idempotency mechanism, e.g. `Tarefa`'s `@@unique([empresaId, tipoObrigacao, competencia])`). A `Setor` enum (`FISCAL | DP | CONTABIL`) mirrors the existing `RegimeTributario` enum pattern exactly.

**Example:**
```prisma
enum Setor {
  FISCAL
  DP
  CONTABIL
}

model EmpresaResponsavelSetor {
  id         String   @id @default(cuid())
  empresaId  String
  empresa    Empresa  @relation(fields: [empresaId], references: [id])
  setor      Setor
  usuarioId  String
  usuario    Usuario  @relation(fields: [usuarioId], references: [id])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([empresaId, setor])
  @@index([usuarioId, setor])
  @@map("empresa_responsavel_setor")
}

model Usuario {
  // ...existing fields...
  setor                Setor?            // null for DONO (cross-sector); required for COLABORADOR
  responsavelEmpresas   EmpresaResponsavelSetor[]
}

model Empresa {
  // responsavelId / responsavel REMOVED — replaced by:
  responsaveisPorSetor EmpresaResponsavelSetor[]
}
```

**Migration note:** `Empresa.responsavelId` cannot simply be dropped — existing fiscal data must be migrated into `EmpresaResponsavelSetor` rows with `setor = 'FISCAL'` as part of the same migration that adds the new model, otherwise every fiscal task/dashboard query (which reads `responsavelId`) breaks at once.

### Pattern 2: Sector as a first-class denormalized column on `Tarefa`, not inferred from `tipoObrigacao`

**What:** `Tarefa.tipoObrigacao` is currently fiscal-only. Adding DP/Contábil obligation types to this same enum (e.g. `FOLHA`, `FGTS`, `INSS`, `ESOCIAL`, `BALANCETE`, `ESCRITURACAO`, `ECF`, `DEFIS`) works, but every consumer that currently assumes "a Tarefa belongs to the fiscal world" (all 3 dashboard queries, `withTarefaScope`, the empresa-responsavel lookup) needs an explicit `setor` field on `Tarefa` to filter without maintaining a hardcoded "which `tipoObrigacao` values belong to which setor" mapping scattered across the codebase.

**When to use:** Any time a downstream filter (dashboard, scope function, generation engine) needs "give me only this sector's tasks" — denormalizing `setor` onto `Tarefa` directly avoids every query needing to join through `tipoObrigacao` → sector lookup tables.

**Trade-offs:** Pros: trivial `WHERE setor = 'DP'` filtering everywhere, matches the existing flat-column style of this schema (`competencia`, `status`, `motivoPendencia` are all flat denormalized fields already). Cons: `setor` must be set correctly and consistently at task-creation time in 3 separate generation engines (Fiscal/DP/Contábil) — a missed assignment silently breaks sector dashboards. Mitigate by making `setor` a required (non-nullable) column so Prisma/TypeScript force every `tarefa.create`/`createMany` call site to supply it.

**Example:**
```prisma
enum TipoObrigacao {
  ICMS
  PIS_COFINS
  SPED_FISCAL
  SPED_CONTRIBUICOES
  DAS
  FOLHA
  FGTS
  INSS
  ESOCIAL
  BALANCETE
  ESCRITURACAO
  ECF
  DEFIS
}

enum Periodicidade {
  MENSAL
  ANUAL
}

model Tarefa {
  // ...existing fields...
  setor          Setor           // NEW, required — denormalized for cheap filtering
  periodicidade  Periodicidade?   @default(MENSAL) // NEW — null for avulsas, MENSAL/ANUAL for recorrentes

  @@unique([empresaId, tipoObrigacao, competencia])
  @@index([setor])
}
```

The existing `@@unique([empresaId, tipoObrigacao, competencia])` constraint remains correct as the idempotency key as long as `tipoObrigacao` values stay unique per sector (no overlap between Fiscal/DP/Contábil obligation names) — verify this holds before reusing it for annual tasks (see Pattern 3 on competência format for annual periodicity).

### Pattern 3: Separate generation engine per periodicity, sharing the same persistence/idempotency shell

**What:** `executarGeracaoMensal` currently does 3 things in one function: (1) freeze prior month's snapshot, (2) read active empresas, (3) generate+persist via `gerarTarefasDoMes`. For annual tasks (ECF/DEFIS), step (1) doesn't apply (snapshots are monthly-only, keyed by `DesempenhoMensal.competencia` in format `YYYY-MM`), and step (3) needs a different pure calculator (`gerarTarefasDoAno`) with a different competência format (`YYYY` instead of `YYYY-MM`) and a different responsible-person lookup (`EmpresaResponsavelSetor` filtered by `setor = 'CONTABIL'` instead of the old flat `responsavelId`).

**When to use:** Whenever a new periodicity is introduced into a system whose idempotency design (`@@unique` + `skipDuplicates`) is coupled to a specific competência string shape.

**Trade-offs:** Pros: keeps the proven idempotency pattern (`createMany({ skipDuplicates: true })` riding on a DB constraint, never application-level pre-checks — explicitly called out as D-10 in the existing code comments) intact for both engines without forcing monthly and annual logic to share a competência format that doesn't naturally fit annual data. Cons: two cron schedules to maintain (monthly trigger stays `0 6 1 * *`; annual trigger needs its own, e.g. `0 6 1 1 *` for Jan 1, or whatever lead time Contábil's actual ECF/DEFIS deadlines require) and two `Tarefa.competencia` formats coexisting in the same column (`"2026-03"` for monthly, `"2026"` for annual) — the existing `competenciaSchema` regex (`^\d{4}-(0[1-9]|1[0-2])$`) will reject annual competências and must gain a sibling `competenciaAnualSchema` (`^\d{4}$`), and every place reading `Tarefa.competencia` for monthly aggregation (dashboard queries' date-range math, `calcularSnapshotMensal`) must filter `periodicidade = 'MENSAL'` first or annual rows will corrupt month-range calculations.

**Example:**
```typescript
// src/modules/tarefas/geracao.ts — new sibling function, same shell pattern
export async function executarGeracaoAnual(
  competenciaAno: string // "YYYY", validated by a new competenciaAnualSchema
): Promise<{ criadas: number; puladas: number }> {
  return db.$transaction(async (tx) => {
    // NO snapshot step — DesempenhoMensal is monthly-only; annual tasks feed
    // into the SAME monthly snapshot machinery only via their eventual
    // conclusion date (TarefaHistorico.concluidoEm), not via a parallel
    // annual snapshot table.
    const responsaveis = await tx.empresaResponsavelSetor.findMany({
      where: { setor: "CONTABIL" },
      select: { empresaId: true, usuarioId: true },
    });
    const tarefas = gerarTarefasDoAno(responsaveis, competenciaAno); // new pure fn
    if (tarefas.length === 0) return { criadas: 0, puladas: 0 };
    const resultado = await tx.tarefa.createMany({
      data: tarefas.map((t) => ({ ...t, status: "PENDENTE" as const })),
      skipDuplicates: true, // same @@unique([empresaId, tipoObrigacao, competencia])
    });
    return { criadas: resultado.count, puladas: tarefas.length - resultado.count };
  });
}
```

## Data Flow

### Request Flow (sector-scoped dashboard read, post-migration)

```
[DONO navigates to /dashboards/dp]
    ↓
[dashboards/dp/guard.ts] → auth() session check → role !== "DONO" ? notFound()
    ↓ (setor="DP" hardcoded in this route's guard, mirrors current pattern)
[dashboards/queries.ts: listarDesempenhoColaboradoresMesAtual(mes, setor)]
    ↓
[db.tarefa.findMany({ where: { setor: "DP", status: "CONCLUIDA", ... } })]
    ↓
[db.empresaResponsavelSetor.groupBy(["usuarioId"], where: { setor: "DP" })]
    ↓ (replaces today's db.empresa.groupBy(["responsavelId"]))
[aggregate in memory, same Map-then-array pattern as today]
    ↓
[plain serializable array] → [Server Component renders chart]
```

### Generation Flow (monthly vs annual, side by side post-migration)

```
[node-cron, instrumentation.ts boot hook]
    ├─ monthly trigger (0 6 1 * *) → executarGeracaoMensal(competencia)
    │     ↓
    │   freeze DesempenhoMensal snapshot (mensal-only, setor-aware groupBy)
    │     ↓
    │   read Empresa + EmpresaResponsavelSetor (setor=FISCAL ∪ DP ∪ CONTABIL-mensal)
    │     ↓
    │   gerarTarefasDoMes (fiscal) + gerarTarefasMensaisDp + gerarTarefasMensaisContabil
    │     ↓
    │   tx.tarefa.createMany({ skipDuplicates: true })
    │
    └─ annual trigger (separate cron expression) → executarGeracaoAnual(competenciaAno)
          ↓
        read EmpresaResponsavelSetor (setor=CONTABIL)
          ↓
        gerarTarefasDoAno (ECF, DEFIS)
          ↓
        tx.tarefa.createMany({ skipDuplicates: true }) — SAME idempotency constraint,
          different competência format ("YYYY")
```

### Key Data Flows

1. **Empresa responsibility lookup** moves from a direct field read (`empresa.responsavelId`) to a junction query (`empresaResponsavelSetor.findMany({ where: { setor } })`) everywhere it's used: generation engines, dashboards' carteira-size aggregation, `empresas/queries.ts` listing/detail selects, and the empresa edit form (now needs 3 responsible-person selects instead of 1).
2. **Authorization scoping** (`withVisibilityScope`/`withTarefaScope`) gains sector awareness: a COLABORADOR's visibility today is "empresas where I'm the responsavel"; post-migration it becomes "empresas where I'm the responsavel for MY setor" — requires joining through `EmpresaResponsavelSetor` filtered by both `usuarioId` and the user's own `setor` (read from `Usuario.setor`, NOT passed by the client, to avoid trusting an unvalidated sector parameter).
3. **Snapshot continuity (D-05 in existing code comments)** must be re-derived per sector: `DesempenhoMensal` needs a `setor` column added to its `@@unique([competencia, colaboradorId])` constraint (becomes `@@unique([competencia, colaboradorId, setor])`), and `calcularSnapshotMensal` needs a `setor` parameter threading through every query inside it — otherwise DP/Contábil completions get silently merged into the Fiscal snapshot row for a colaborador, corrupting all 3 sector dashboards' "evolução mensal" charts.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (197 empresas × 3 setores, 12 usuarios) | No architectural change needed beyond what's described above — monolith Next.js process + Postgres handles this volume trivially; junction table adds at most ~600 rows (197 × 3), negligible. |
| Hypothetical 4th sector or 500+ empresas | `EmpresaResponsavelSetor` junction scales linearly and needs no schema change to add a sector — this is the entire point of choosing the junction over nullable FK columns. Add an index on `(setor, usuarioId)` if "my carteira for my sector" queries become a hot path (already included in Pattern 1's example). |
| Cross-sector reporting need emerges later | If a future milestone reverses the "no unified dashboard" decision, the `setor` column on `Tarefa` and `DesempenhoMensal` makes a unified view a `GROUP BY setor` away — the data model proposed here does not foreclose that option even though v2.0 explicitly avoids building it now. |

### Scaling Priorities

1. **First bottleneck (not yet a concern at this scale):** the annual generation engine running once a year touches a tiny fraction of rows (only Contábil empresas × 2 obligation types) — no performance work needed.
2. **Second bottleneck (worth a note, not urgent):** dashboard queries that do in-memory `Map`-based aggregation (existing pattern throughout `dashboards/queries.ts`) will run 3x as often (once per sector route) — at 197 empresas this is still trivially fast, but if sector dashboards are visited very frequently, consider that each sector's `listarDesempenhoColaboradoresMesAtual` could share a single `setor`-parametrized query function rather than tripling the dashboard module's file count.

## Anti-Patterns

### Anti-Pattern 1: Inferring sector from `tipoObrigacao` value at query time instead of storing `setor` directly

**What people do:** Add new `TipoObrigacao` enum values for DP/Contábil and write a `SETOR_POR_TIPO_OBRIGACAO` lookup map used inside every dashboard/scope query (`WHERE tipoObrigacao IN (mapeamento[setor])`).
**Why it's wrong:** Scatters the sector↔obligation-type mapping across every consumer (dashboards, scope, generation engines must all stay in sync with one lookup table); a new obligation type added to the wrong sector's catalog silently shows up in the wrong dashboard with no schema-level error. This codebase's existing convention (`competencia`, `status` as flat columns) favors denormalization for exactly this reason.
**Do this instead:** Add `setor` as its own column on `Tarefa`, set explicitly by each sector's pure generation function (Pattern 2) — sector membership becomes a stored fact, not a derived one.

### Anti-Pattern 2: Forking `withVisibilityScope`/`withTarefaScope` into 3 sector-specific copies

**What people do:** Create `withVisibilityScopeDp`, `withVisibilityScopeContabil` etc. because "DP scoping is different."
**Why it's wrong:** The actual authorization RULE doesn't change per sector (DONO sees all, COLABORADOR sees only their own) — only the DATA SOURCE for "their own" changes (junction table instead of flat FK). Forking the function triples the surface area that needs a security review and risks the 3 copies drifting apart over time (e.g., one of them forgetting the anti-IDOR `findFirst`-returns-null-not-403 pattern already established in `empresas/queries.ts`).
**Do this instead:** Keep one `withVisibilityScope`/`withTarefaScope`, add an optional `setor` parameter threaded from `Usuario.setor` (never from client input), and have it internally branch on whether the `EmpresaResponsavelSetor` join is needed — the authorization shape stays singular and auditable, matching this codebase's existing "one place every query must call into" design.

### Anti-Pattern 3: Generalizing `geracao-tarefas.ts` into one cross-sector catalog function

**What people do:** Extend `CATALOGO_OBRIGACOES: Record<RegimeTributario, ObrigacaoRegra[]>` to also be keyed by `setor`, producing something like `Record<Setor, Record<RegimeTributario, ObrigacaoRegra[]>>`.
**Why it's wrong:** DP and Contábil obligations don't naturally vary by `RegimeTributario` the way Fiscal's do — forcing them through the same nested shape means duplicating identical DP rows under both `LUCRO_REAL` and `SIMPLES_NACIONAL` keys for no semantic reason, and couples 3 independent catalogs (Fiscal, DP, Contábil) into one file that now has 3x the blast radius for any future obligation rule change in any single sector.
**Do this instead:** Keep `geracao-tarefas.ts` (Fiscal) untouched, add sibling pure-calculator files per sector (Pattern 1's structure section) — each sector's catalog uses whatever key structure fits its actual obligation rules, and `executarGeracaoMensal` simply calls all relevant calculators and merges the resulting task arrays before persisting.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| node-cron (instrumentation.ts) | Boot-time scheduled job, in-process | A second cron registration is needed for the annual trigger (`executarGeracaoAnual`) — register both inside the same `instrumentation.ts` boot hook, distinct cron expressions, both calling into `src/modules/tarefas/geracao.ts`. |
| date-holidays / `anticiparParaDiaUtil` | Pure function, periodicity-agnostic | No changes needed — DP and Contábil obligations reuse the exact same business-day adjustment logic as Fiscal; this function has no coupling to `RegimeTributario` or `Setor`. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `prisma/schema.prisma` ↔ everything | Prisma Client generated types | This is the boundary that MUST change first — every other change (scope functions, generation engines, dashboard queries, empresa forms) depends on `Setor` enum, `Usuario.setor`, and `EmpresaResponsavelSetor` existing in the generated client. Build order: schema migration is phase 0, nothing else can be planned/built in parallel with it. |
| `src/lib/visibility-scope.ts` ↔ `src/modules/{empresas,tarefas,dashboards}/queries.ts` | Direct function import, spread into Prisma `where` | Every existing call site that spreads `withVisibilityScope(user)`/`withTarefaScope(user)` continues to compile unchanged if the new `setor` param is optional — but their RESULTS change in behavior once `EmpresaResponsavelSetor` becomes the source of truth, so these call sites need re-verification (not necessarily rewriting) after the scope functions change. |
| `src/lib/geracao-tarefas.ts` ↔ `src/modules/tarefas/geracao.ts` | Pure function returns plain objects, orchestrator persists them | Cleanly separable — DP/Contábil get their OWN pure calculator files (Pattern 1/Anti-Pattern 3) without touching the existing fiscal one, then the orchestrator (`geracao.ts`) is extended to call all three and merge results before `createMany`. Low risk of regressing existing fiscal generation if these stay additive. |
| `src/modules/dashboards/*` ↔ `src/app/(app)/dashboards/*` route folders | Server Component calls module query functions directly (no API layer) | Tripling the route folders (fiscal/dp/contabil) is mechanical once the query functions accept a `setor` parameter — the existing `guard.ts` pattern is copy-paste-and-hardcode-the-setor-value, consistent with how this codebase already favors explicit repetition over parametrized indirection for security-sensitive gates. |
| Orphaned `src/modules/dashboard/queries.ts` (singular, untracked) | None — dead code | Do not wire this into the build. It references `db.desempenhoMensalSnapshot`, which doesn't exist in the current schema. Delete it during v2.0 cleanup, or confirm with the user it isn't meant to replace `dashboards/queries.ts` before touching it. |

### Suggested Build Order (respecting dependencies)

1. **Schema migration** — `Setor` enum, `Usuario.setor`, `EmpresaResponsavelSetor` junction (with data backfill from existing `Empresa.responsavelId` into `setor='FISCAL'` rows), `Tarefa.setor` + `Tarefa.periodicidade` columns, `TipoObrigacao` enum extended, `DesempenhoMensal` unique constraint extended with `setor`. Nothing below can be built or even type-checked until this lands, since Prisma Client types drive everything downstream.
2. **Authorization layer** — `visibility-scope.ts` extended with `setor`-aware branching. Must land before any sector-scoped query is written, since every module is expected to spread its result.
3. **Empresa CRUD updates** — `modules/empresas/queries.ts` + form schema for 3 responsible-person fields. Needed before sector-specific generation engines can read meaningful responsible-person data per sector.
4. **DP monthly generation engine** — new pure calculator (`geracao-tarefas-dp.ts`) + orchestrator extension. Depends on 1-3; can be built in parallel with step 5 since DP and Contábil are independent obligation catalogs.
5. **Contábil generation engine, monthly + annual** — new pure calculator (`geracao-tarefas-contabil.ts`), `executarGeracaoAnual` sibling function, new `competenciaAnualSchema`. Depends on 1-3; introduces the only periodicity fork, so plan extra verification time here specifically (annual cron scheduling, competência format validation, ensuring monthly dashboard date-range math filters out annual rows via `periodicidade`).
6. **Dashboard module sector-parametrization** — `dashboards/queries.ts`, `snapshot.ts` gain `setor` params. Depends on 1, 4, 5 having real DP/Contábil task data to validate against; building this before generation engines exist means testing against empty/fake data only.
7. **Three dashboard route folders** — `dashboards/fiscal/`, `dashboards/dp/`, `dashboards/contabil/`. Purely mechanical once step 6 lands; this is the last step since it's the thinnest layer (route + guard + chart components reusing existing chart component patterns).
8. **Cleanup** — delete the orphaned `src/modules/dashboard/` (singular) directory once confirmed unused.

## Sources

- Direct code reading (HIGH confidence — primary source, not inferred): `prisma/schema.prisma`, `src/lib/visibility-scope.ts`, `src/lib/geracao-tarefas.ts`, `src/modules/tarefas/geracao.ts`, `src/modules/dashboards/queries.ts`, `src/modules/dashboards/schema.ts`, `src/modules/dashboards/snapshot.ts`, `src/app/(app)/dashboards/guard.ts`, `src/modules/empresas/queries.ts`, `src/types/next-auth.d.ts`, `src/lib/competencia.ts`, `src/modules/dashboard/queries.ts` (orphaned), `.planning/PROJECT.md` (v2.0 milestone section)
- Existing in-code design rationale comments (D-01 through D-14, T-04-* labels) embedded throughout the read files — treated as HIGH confidence project-specific conventions, not external research claims

---
*Architecture research for: Multi-sector task management system extension (Next.js/Prisma) — v2.0 milestone*
*Researched: 2026-06-22*
