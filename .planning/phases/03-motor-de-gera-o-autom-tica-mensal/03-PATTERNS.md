# Phase 3: Motor de Geração Automática Mensal - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 10
**Analogs found:** 9 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `prisma/schema.prisma` (extend `Tarefa`, add `TipoObrigacao` enum) | model | CRUD | `prisma/schema.prisma` (existing `model Tarefa`, `enum RegimeTributario`) | exact |
| `src/lib/geracao-tarefas.ts` (pure catalog + due-date builder) | utility | transform | `src/lib/excel/parse-empresas.ts` (`parseBloco`, pure function, no I/O) | role-match |
| `src/lib/dia-util.ts` (holiday/weekend anticipation) | utility | transform | `src/lib/alert-prazo.ts` (`calcularAlertaPrazo`, pure date logic) | exact |
| `src/lib/scheduler.ts` (node-cron boot registration) | config/event-driven bootstrap | event-driven | none (no scheduler exists yet) | no analog |
| `instrumentation.ts` (Next.js boot hook) | config | event-driven | none (no instrumentation file exists yet) | no analog |
| `src/modules/tarefas/geracao.ts` (orchestration: DB read + pure fn + createMany) | service | CRUD + batch | `src/modules/tarefas/queries.ts` (`listarTarefas`, scoped Prisma reads) | role-match |
| `src/app/(app)/tarefas/actions.ts` (+ `gerarTarefasDoMesAction`) | controller (Server Action) | request-response | same file, existing `criarTarefa`/`concluirTarefa`/`excluirTarefa` | exact |
| `src/app/(app)/tarefas/page.tsx` (+ DONO-only trigger button) | component (server page) | request-response | same file, existing pattern | exact |
| `tests/geracao-tarefas.test.ts`, `tests/dia-util.test.ts` | test | transform | `tests/alert-prazo.test.ts` (pure-function unit test, no mocks) | exact |
| `tests/geracao.actions.test.ts` | test | request-response | `tests/tarefas.idor.test.ts` (Server Action test with `vi.mock` of `db`/`auth`) | exact |

## Pattern Assignments

### `prisma/schema.prisma` (model, CRUD)

**Analog:** `prisma/schema.prisma` itself — existing `model Tarefa` (lines 80-100) and `enum RegimeTributario` (lines 19-23)

**Existing enum pattern** (lines 19-23):
```prisma
enum RegimeTributario {
  LUCRO_REAL
  LUCRO_PRESUMIDO
  SIMPLES_NACIONAL
}
```
Copy this exact shape for the new `enum TipoObrigacao { ICMS, PIS_COFINS, SPED_FISCAL, SPED_CONTRIBUICOES, DAS }`.

**Existing model + index conventions** (lines 80-100):
```prisma
model Tarefa {
  id            String       @id @default(cuid())
  titulo        String
  descricao     String?
  empresaId     String
  empresa       Empresa      @relation(fields: [empresaId], references: [id])
  responsavelId String
  responsavel   Usuario      @relation("ResponsavelTarefa", fields: [responsavelId], references: [id])
  prazo         DateTime
  status        TarefaStatus @default(PENDENTE)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  historico     TarefaHistorico[]

  @@index([responsavelId])
  @@index([empresaId])
  @@index([prazo])
  @@index([status])
  @@map("tarefas")
}
```
Add `tipoObrigacao TipoObrigacao?` and `competencia String?` as nullable fields (avulsa tasks from Phase 2 keep them null), then add `@@unique([empresaId, tipoObrigacao, competencia])` and `@@index([competencia])` following the existing `@@index`/`@@map` convention exactly — do not introduce a different naming style.

---

### `src/lib/geracao-tarefas.ts` (utility, transform)

**Analog:** `src/lib/excel/parse-empresas.ts` (`parseBloco`, lines 51-60+) and RESEARCH.md Pattern 1 (already-drafted full implementation)

**Pure-function-with-typed-input/output convention** (parse-empresas.ts lines 11-15, 51-57):
```typescript
export type LinhaImportada = {
  nome: string;
  cnpj: string;
  regimeTributario?: "LUCRO_REAL" | "LUCRO_PRESUMIDO" | "SIMPLES_NACIONAL";
};

export function parseBloco(
  linhas: unknown[][],
  colCod: number,
  colNome: number,
  colCnpj: number
): LinhaImportada[] {
  const resultado: LinhaImportada[] = [];
  ...
```
This file establishes the codebase convention: pure transform functions take typed plain-data input, return typed plain-data output, no Prisma/DB/auth import. Reuse this shape for `gerarTarefasDoMes(empresas, competencia): TarefaParaCriar[]` — see RESEARCH.md Pattern 1 (full code already drafted, copy directly):
```typescript
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
```

**JSDoc / comment convention** (alert-prazo.ts lines 1-12, parse-empresas.ts lines 36-50): every pure helper in this codebase has a header comment naming the requirement IDs it implements (e.g. `D-02`, `D-04`) and explaining *why*, not just *what*. Follow this exactly — reference D-01 through D-04 in the new file's docblock.

---

### `src/lib/dia-util.ts` (utility, transform)

**Analog:** `src/lib/alert-prazo.ts` (full file, pure date logic, no I/O)

**Pure date-logic pattern** (alert-prazo.ts lines 35-46):
```typescript
export function calcularAlertaPrazo(
  prazo: Date,
  status: "PENDENTE" | "CONCLUIDA"
): AlertaPrazo {
  if (status === "CONCLUIDA") { ... }
  const agora = new Date();
  const em3Dias = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000);
  if (prazo < agora) { ... }
  if (prazo <= em3Dias) { ... }
  return ALERTA_NORMAL;
}
```
Same shape applies to `anticiparParaDiaUtil(date: Date): Date` (RESEARCH.md Pattern 2, already drafted) — single exported pure function, explicit early-return branches, `new Date(...)` math instead of mutation. Module-level singleton (`const hd = new Holidays("BR")`) is the one addition beyond the alert-prazo.ts shape — instantiate once at module scope, never inside the function body.

**Critical correctness note (from RESEARCH.md Pitfall 1):** `hd.isHoliday(date)` returns `false | HolidayResult[]`, never `true`. Always write `hd.isHoliday(date) === false` for "is business day", never `=== true`.

---

### `src/lib/scheduler.ts` + `instrumentation.ts` (config, event-driven)

**No analog found in codebase** — first scheduler/boot-hook file in this project. Use RESEARCH.md Pattern 3 verbatim (`globalThis.__agendaFiscalCronStarted` guard + `instrumentation.ts` `register()` export with `NEXT_RUNTIME === "nodejs"` check). No existing pattern to deviate from; follow the research code exactly.

---

### `src/modules/tarefas/geracao.ts` (service, CRUD + batch)

**Analog:** `src/modules/tarefas/queries.ts` (`listarTarefas`, lines 65-73)

**Scoped-read + select-shape convention** (queries.ts lines 65-73):
```typescript
export async function listarTarefas(user: SessionUser) {
  return db.tarefa.findMany({
    where: {
      ...withTarefaScope(user),
    },
    orderBy: { prazo: "asc" },
    select: TAREFA_SELECT,
  });
}
```
`executarGeracaoMensal` follows the same "thin async function wrapping one or two `db.*` calls, typed by Prisma client types" shape — but reads `Empresa` (not `Tarefa`) with `db.empresa.findMany({ where: { ativo: true }, select: { id, regimeTributario, responsavelId } })`, per RESEARCH.md Pattern 4. **Important deviation from `queries.ts`:** this function must NOT call `withTarefaScope`/`withVisibilityScope` — D-12 requires reading current `Empresa.regimeTributario` directly, unscoped (the cron runs with no "current user"), unlike every other query in this module.

**Idempotent batch-insert pattern** (new to codebase, from RESEARCH.md Pattern 4 — copy verbatim):
```typescript
const resultado = await db.tarefa.createMany({
  data: tarefas.map((t) => ({ ...t, status: "PENDENTE" as const })),
  skipDuplicates: true,
});
return { criadas: resultado.count, puladas: tarefas.length - resultado.count };
```

---

### `src/app/(app)/tarefas/actions.ts` (+ `gerarTarefasDoMesAction`)

**Analog:** same file, existing `criarTarefa` (lines 31-101) and `excluirTarefa` (lines 170-193)

**Server Action guard + result-type convention** (actions.ts lines 1-18, 31-37):
```typescript
"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type AcaoTarefaResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export async function criarTarefa(formData: FormData): Promise<AcaoTarefaResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Não autenticado" };
  }
  ...
}
```
`gerarTarefasDoMesAction` must follow this exact shape: `auth()` guard first, then a `role !== "DONO"` check immediately after (no existing action has a role-only guard yet — closest is the COLABORADOR-cannot-assign-others check in `criarTarefa` lines 77-82):
```typescript
if (
  session.user.role === "COLABORADOR" &&
  dados.responsavelId !== session.user.id
) {
  return { ok: false, error: "não autorizado" };
}
```
Adapt this to: `if (session.user.role !== "DONO") return { ok: false, error: "não autorizado" };` — same early-return, same error string convention, no thrown exceptions. Return type should extend `AcaoTarefaResult` or define a sibling type carrying `{ criadas: number; puladas: number }` on success, consistent with the `{ ok: true; id? }` pattern (e.g. `{ ok: true; criadas: number; puladas: number }`).

**Try/catch + revalidatePath convention** (actions.ts lines 84-100):
```typescript
try {
  const tarefa = await db.tarefa.create({ ... });
  revalidatePath("/tarefas");
  return { ok: true, id: tarefa.id };
} catch {
  return { ok: false, error: "Erro ao criar tarefa. Tente novamente." };
}
```
Apply identically around the `executarGeracaoMensal` call.

---

### `src/app/(app)/tarefas/page.tsx` (+ DONO-only trigger button)

**Analog:** same file (full file, 32 lines)

**Conditional-by-role rendering convention** (page.tsx lines 8-31):
```typescript
export default async function TarefasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [tarefas, responsaveis, empresas] = await Promise.all([...]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tarefas</h1>
        <NovaTarefaDialog responsaveis={responsaveis} empresas={empresas} />
      </div>
      <TarefasTable tarefas={tarefas} responsaveis={responsaveis} isDono={session.user.role === "DONO"} userId={session.user.id} />
    </div>
  );
}
```
`TarefasTable` already receives `isDono` as a prop — the new "Gerar tarefas do mês" button should be added next to `NovaTarefaDialog` in the same flex container, gated with `{session.user.role === "DONO" && <GerarTarefasButton />}` (server-side gate via the page, matching how `isDono` is already threaded into `TarefasTable`). Per RESEARCH.md Open Question 2 recommendation: no new route, place directly on this page.

---

### `tests/geracao-tarefas.test.ts`, `tests/dia-util.test.ts` (test, transform)

**Analog:** `tests/alert-prazo.test.ts` (full file, 40+ lines, pure-function test with no mocks)

**No-mock pure-function test convention** (alert-prazo.test.ts lines 1-18):
```typescript
import { describe, it, expect } from "vitest";
import { calcularAlertaPrazo } from "@/lib/alert-prazo";

const MS_PER_DIA = 24 * 60 * 60 * 1000;
function diasAPartirDeHoje(dias: number): Date {
  return new Date(Date.now() + dias * MS_PER_DIA);
}

describe("calcularAlertaPrazo", () => {
  it("retorna emoji 🔴 e label 'Atrasada' quando prazo é ontem e status PENDENTE", () => {
    const prazoOntem = diasAPartirDeHoje(-1);
    const resultado = calcularAlertaPrazo(prazoOntem, "PENDENTE");
    expect(resultado.emoji).toBe("🔴");
    expect(resultado.label).toBe("Atrasada");
  });
  ...
```
Copy this exact `describe`/`it` structure with no `vi.mock` calls for both new test files — `gerarTarefasDoMes` and `anticiparParaDiaUtil` are pure functions just like `calcularAlertaPrazo`. Include the RESEARCH.md-mandated assertion for a known 2026 holiday date and the `diaBase=31`-in-February case (Pitfalls 1 and 2).

---

### `tests/geracao.actions.test.ts` (test, request-response)

**Analog:** `tests/tarefas.idor.test.ts` (lines 1-60, full mock setup pattern)

**Server Action mock convention** (tarefas.idor.test.ts lines 1-50):
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockColaboradorUser } from "./setup";

const findFirstMock = vi.fn();
const authMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    tarefa: {
      create: (...args: unknown[]) => tarefaCreateMock(...args),
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      ...
    },
  },
}));

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("IDOR — concluirTarefa", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    authMock.mockReset();
  });
  ...
```
For `gerarTarefasDoMesAction`, mock `db.empresa.findMany`, `db.tarefa.createMany`, and `auth`, then assert: (1) unauthenticated → `{ ok: false }`; (2) COLABORADOR role → `{ ok: false, error: "não autorizado" }` without calling `createMany`; (3) DONO role → calls through and returns `{ ok: true, criadas, puladas }`. Use `tests/setup.ts`'s existing `mockColaboradorUser`/equivalent DONO helper if present — check `tests/setup.ts` for a `mockDonoUser` export before writing a new one.

## Shared Patterns

### Server Action auth + RBAC guard
**Source:** `src/app/(app)/tarefas/actions.ts` lines 31-37 (auth guard), lines 77-82 (role check)
**Apply to:** `gerarTarefasDoMesAction` — `auth()` check first, then `role !== "DONO"` check, both as early returns with `{ ok: false, error: "..." }`, never throwing.

### Error handling / result type
**Source:** `src/app/(app)/tarefas/actions.ts` `AcaoTarefaResult` type (lines 16-18) and try/catch shape (lines 84-100)
**Apply to:** All new Server Action and orchestration code — no thrown exceptions across the action boundary, only `{ ok: true, ... } | { ok: false, error: string }`.

### Pure-function-first architecture
**Source:** `src/lib/alert-prazo.ts`, `src/lib/excel/parse-empresas.ts`
**Apply to:** `src/lib/geracao-tarefas.ts`, `src/lib/dia-util.ts` — keep all date/catalog logic free of Prisma/auth/cron imports so it is unit-testable with zero mocks, matching the established codebase split between pure `lib/` helpers and I/O-performing `modules/*/queries.ts` or `actions.ts`.

### Visibility scope reuse (explicit non-application)
**Source:** `src/lib/visibility-scope.ts` (`withTarefaScope`, `withVisibilityScope`)
**Apply to:** Generated tasks automatically respect scope once written (no change needed in `listarTarefas`/`buscarTarefaPorId`); but `executarGeracaoMensal` itself must NOT call these functions — it operates on all active empresas unscoped, per D-12.

### Prisma schema conventions (`@@index`, `@@map`, enum style)
**Source:** `prisma/schema.prisma` (full file)
**Apply to:** New `enum TipoObrigacao` and extended `model Tarefa` fields — match existing indentation, `@@map("tarefas")` snake_case table convention, and one `@@index([field])` per filterable column.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/scheduler.ts` | config | event-driven | No cron/scheduler infrastructure exists yet in this codebase — first occurrence. Use RESEARCH.md Pattern 3 code verbatim. |
| `instrumentation.ts` | config | event-driven | No Next.js instrumentation boot hook exists yet — first occurrence. Use RESEARCH.md Pattern 3 code verbatim. |

## Metadata

**Analog search scope:** `prisma/`, `src/lib/`, `src/modules/tarefas/`, `src/app/(app)/tarefas/`, `tests/`
**Files scanned:** prisma/schema.prisma, src/lib/alert-prazo.ts, src/lib/visibility-scope.ts, src/lib/excel/parse-empresas.ts, src/modules/tarefas/queries.ts, src/modules/tarefas/schema.ts, src/app/(app)/tarefas/actions.ts, src/app/(app)/tarefas/page.tsx, tests/alert-prazo.test.ts, tests/tarefas.idor.test.ts
**Pattern extraction date:** 2026-06-18
