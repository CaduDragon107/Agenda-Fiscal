# Phase 6: Motor de Geração — Departamento Pessoal - Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 8 (3 new, 3 modified, 2 test-extend... see below for full count)
**Analogs found:** 8 / 8 (all files have a strong, same-codebase analog — this phase is pure extension of established patterns, no greenfield design needed)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/lib/geracao-tarefas-dp.ts` (new) | utility (pure calculation catalog) | transform | `src/lib/geracao-tarefas.ts` | exact (same role, same project, sibling not child per RESEARCH.md) |
| `src/lib/dia-util.ts` (extend: `calcularQuintoDiaUtil`) | utility (pure calculation) | transform | `src/lib/dia-util.ts` itself (`anticiparParaDiaUtil`, same file) | exact |
| `src/modules/tarefas/geracao.ts` (extend: DP loop in `executarGeracaoMensal`) | service/orchestrator | CRUD (transactional read+write) | `src/modules/tarefas/geracao.ts` itself (existing Fiscal loop) | exact |
| `prisma/schema.prisma` (extend: `TipoObrigacao` enum) | model/migration | CRUD (schema definition) | `prisma/schema.prisma` itself (`enum TipoObrigacao` block, lines 36-42) | exact |
| `src/app/(app)/tarefas/actions.ts` (extend: `AcaoGeracaoResult` + `gerarTarefasDoMesAction`) | controller (Server Action) | request-response | `src/app/(app)/tarefas/actions.ts` itself (`gerarTarefasDoMesAction`, lines 284-316) | exact |
| `tests/geracao-tarefas-dp.test.ts` (new) | test | transform (unit) | `tests/geracao-tarefas.test.ts` | exact |
| `tests/dia-util.test.ts` (extend) | test | transform (unit) | `tests/dia-util.test.ts` itself (existing `anticiparParaDiaUtil` cases) | exact |
| `tests/geracao.idempotencia.test.ts` (extend) | test | CRUD (integration, mocked Prisma) | `tests/geracao.idempotencia.test.ts` itself | exact |

No "no analog" files — this phase is 100% composition of already-validated patterns in this exact codebase (confirmed by RESEARCH.md "Don't Hand-Roll" and "Key insight" sections).

## Pattern Assignments

### `src/lib/geracao-tarefas-dp.ts` (new) — utility, transform

**Analog:** `src/lib/geracao-tarefas.ts` (full file, 105 lines)

**Imports pattern** (lines 22-24):
```typescript
import { addMonths, lastDayOfMonth, setDate } from "date-fns";
import { anticiparParaDiaUtil } from "./dia-util";
import type { RegimeTributario } from "@prisma/client";
```
For the DP file, swap the Prisma type import for whatever new `TipoObrigacao` DP members are added, and additionally import `calcularQuintoDiaUtil` from `./dia-util`:
```typescript
import { addMonths, lastDayOfMonth, setDate } from "date-fns";
import { anticiparParaDiaUtil, calcularQuintoDiaUtil } from "./dia-util";
```

**Core catalog pattern** (lines 26-48, type + const):
```typescript
export type TipoObrigacao =
  | "ICMS"
  | "PIS_COFINS"
  | "SPED_FISCAL"
  | "SPED_CONTRIBUICOES"
  | "DAS";

type ObrigacaoRegra = { tipo: TipoObrigacao; diaBase: number };

export const CATALOGO_OBRIGACOES: Record<RegimeTributario, ObrigacaoRegra[]> = {
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
**Critical deviation for DP:** the DP catalog must be **flat** (`ObrigacaoRegraDp[]`), not `Record<RegimeTributario, ...>` — DP doesn't vary by regime, it varies by `temFuncionariosClt` (boolean gate applied at the call site in `geracao.ts`, not inside the catalog). RESEARCH.md provides the exact target shape (already validated):
```typescript
export type TipoObrigacaoDp = "FOLHA" | "ESOCIAL" | "FGTS" | "INSS";

type ObrigacaoRegraDp =
  | { tipo: "FOLHA"; regra: "QUINTO_DIA_UTIL" }
  | { tipo: TipoObrigacaoDp; regra: "DIA_BASE"; diaBase: number };

export const CATALOGO_OBRIGACOES_DP: ObrigacaoRegraDp[] = [
  { tipo: "FOLHA", regra: "QUINTO_DIA_UTIL" },
  { tipo: "ESOCIAL", regra: "DIA_BASE", diaBase: 7 },
  { tipo: "FGTS", regra: "DIA_BASE", diaBase: 15 },
  { tipo: "INSS", regra: "DIA_BASE", diaBase: 15 },
];
```

**Title lookup pattern** (lines 50-56):
```typescript
export const TITULO_OBRIGACAO: Record<TipoObrigacao, string> = {
  ICMS: "ICMS",
  PIS_COFINS: "PIS/COFINS",
  SPED_FISCAL: "SPED Fiscal",
  SPED_CONTRIBUICOES: "SPED Contribuições",
  DAS: "DAS",
};
```
DP equivalent: `TITULO_OBRIGACAO_DP: Record<TipoObrigacaoDp, string>` with `{ FOLHA: "Folha de Pagamento", ESOCIAL: "Fechamento eSocial", FGTS: "FGTS", INSS: "INSS" }`.

**Prazo calculation pattern (DIA_BASE branch)** (lines 63-69):
```typescript
function calcularPrazoBase(competencia: string, diaBase: number): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  const mesVencimento = addMonths(new Date(ano, mes - 1, 1), 1);
  const ultimoDia = lastDayOfMonth(mesVencimento).getDate();
  const dia = Math.min(diaBase, ultimoDia);
  return setDate(mesVencimento, dia);
}
```
Reuse this exact function (or an equivalent renamed `calcularPrazoBaseDiaFixo`) unchanged for ESOCIAL/FGTS/INSS — they follow the identical "fixed calendar day, anticipate if weekend/holiday" rule as Fiscal. Only FOLHA diverges (uses `calcularQuintoDiaUtil` instead — see dia-util.ts pattern below). **Do not apply `anticiparParaDiaUtil` on top of `calcularQuintoDiaUtil`'s result** — it's already a business day by construction (RESEARCH.md Pattern 1 nota crítica).

**Generator function pattern** (lines 80-104):
```typescript
export function gerarTarefasDoMes(
  empresas: { id: string; regimeTributario: RegimeTributario; responsavelId: string }[],
  competencia: string
): TarefaParaCriar[] {
  const [ano, mes] = competencia.split("-").map(Number);
  const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long" });

  return empresas.flatMap((empresa) =>
    CATALOGO_OBRIGACOES[empresa.regimeTributario].map((regra) => {
      const prazoBase = calcularPrazoBase(competencia, regra.diaBase);
      const prazo = anticiparParaDiaUtil(prazoBase); // D-05
      return {
        empresaId: empresa.id,
        responsavelId: empresa.responsavelId,
        titulo: `${TITULO_OBRIGACAO[regra.tipo]} — ${nomeMes}/${ano}`,
        tipoObrigacao: regra.tipo,
        competencia,
        prazo,
      };
    })
  );
}
```
DP equivalent `gerarTarefasDoMesDp(empresas: { id: string; responsavelId: string }[], competencia: string)` — note the input shape drops `regimeTributario` entirely (DP doesn't key on it; the caller in `geracao.ts` already filtered/joined the responsible DP user before calling this function — see Pattern 2 in RESEARCH.md). Same `TarefaParaCriar`-shaped return type (reuse/extend the existing exported type, do not duplicate it).

---

### `src/lib/dia-util.ts` (extend) — utility, transform

**Analog:** same file, `anticiparParaDiaUtil` (lines 33-49)

**Imports pattern** (lines 25-26, already present, extend the `date-fns` import):
```typescript
import Holidays from "date-holidays";
import { isSaturday, isSunday, subDays } from "date-fns";
```
Add `addDays, addMonths` to the `date-fns` import for the new function.

**Shared singleton + isDiaUtil helper, reuse without duplication** (lines 31-36):
```typescript
const hd = new Holidays("BR");

function isDiaUtil(date: Date): boolean {
  if (isSaturday(date) || isSunday(date)) return false;
  return hd.isHoliday(date) === false; // NEVER === true, see file header comment
}
```
**Critical:** `calcularQuintoDiaUtil` MUST reuse this exact `hd` singleton and `isDiaUtil` function — do not instantiate a second `Holidays("BR")` or duplicate the weekend/holiday check (RESEARCH.md explicitly warns against divergent holiday sources as a latent bug).

**Existing retreat-direction function (mirror, but reversed direction)** (lines 43-49):
```typescript
export function anticiparParaDiaUtil(date: Date): Date {
  let atual = date;
  while (!isDiaUtil(atual)) {
    atual = subDays(atual, 1);
  }
  return atual;
}
```

**New function to add** (validated in RESEARCH.md Code Examples, counts forward instead of backward):
```typescript
export function calcularQuintoDiaUtil(competencia: string): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  const mesVencimento = addMonths(new Date(ano, mes - 1, 1), 1);

  let atual = mesVencimento;
  let contador = 0;
  while (contador < 5) {
    if (isDiaUtil(atual)) {
      contador++;
      if (contador === 5) break;
    }
    atual = addDays(atual, 1);
  }
  return atual;
}
```
Verified by RESEARCH.md: July/2026 → 07/07/2026 (Tue); Jan/2027 (crossing year boundary) → 08/01/2027 (Fri), correctly pushed by New Year's holiday.

---

### `src/modules/tarefas/geracao.ts` (extend `executarGeracaoMensal`) — service/orchestrator, CRUD

**Analog:** same file (lines 51-93, current Fiscal-only implementation)

**Imports pattern** (lines 30-33, extend):
```typescript
import { db } from "@/lib/db";
import { gerarTarefasDoMes } from "@/lib/geracao-tarefas";
import { calcularSnapshotMensal } from "@/modules/dashboards/snapshot";
import { format, subMonths } from "date-fns";
```
Add: `import { gerarTarefasDoMesDp } from "@/lib/geracao-tarefas-dp";`

**Current single-loop pattern to extend (lines 69-87)** — keep this Fiscal block **completely unchanged**, add a second block alongside it inside the same `tx`:
```typescript
const empresas = await tx.empresa.findMany({
  where: { ativo: true },
  select: { id: true, regimeTributario: true, responsavelId: true },
});

const tarefas = gerarTarefasDoMes(empresas, competencia);
```

**New second loop pattern** (concrete code from RESEARCH.md Pattern 2, validated against schema field names `responsaveisPorSetor` / `Setor.DP`):
```typescript
const empresasClt = await tx.empresa.findMany({
  where: { ativo: true, temFuncionariosClt: true },
  select: {
    id: true,
    nome: true,
    responsaveisPorSetor: {
      where: { setor: "DP" },          // CRITICAL — never omit this filter (Pitfall 2)
      select: { usuarioId: true },
    },
  },
});

const comResponsavelDp = empresasClt.filter((e) => e.responsaveisPorSetor.length > 0);
const semResponsavelDp = empresasClt
  .filter((e) => e.responsaveisPorSetor.length === 0)
  .map((e) => ({ empresaId: e.id, nome: e.nome })); // D-02

const tarefasDp = gerarTarefasDoMesDp(
  comResponsavelDp.map((e) => ({
    id: e.id,
    responsavelId: e.responsaveisPorSetor[0].usuarioId,
  })),
  competencia
);

const tarefas = [...gerarTarefasDoMes(empresas, competencia), ...tarefasDp];
```

**Persistence + return pattern to extend (lines 80-92)** — keep `createMany({ skipDuplicates: true })` identical, only the return shape grows:
```typescript
const resultado = await tx.tarefa.createMany({
  data: tarefas.map((t) => ({ ...t, status: "PENDENTE" as const })),
  skipDuplicates: true,
});

return {
  criadas: resultado.count,
  puladas: tarefas.length - resultado.count,
  semResponsavelDp, // NEW field
};
```
Update the function signature's `Promise<{ criadas: number; puladas: number }>` (line 51-53) to `Promise<{ criadas: number; puladas: number; semResponsavelDp: { empresaId: string; nome: string }[] }>`.

**Snapshot block (lines 55-67) — leave entirely unchanged**, no DP-related modification needed there.

**Anti-pattern explicitly called out by RESEARCH.md:** do NOT migrate the existing Fiscal loop's `responsavelId` read (line 71, `select: { ..., responsavelId: true }`) to also use `responsaveisPorSetor` — keep it reading the legacy column as-is. This is a deliberate non-change documented in CONTEXT.md/RESEARCH.md ("Decisão Arquitetural").

---

### `prisma/schema.prisma` (extend `enum TipoObrigacao`) — model, CRUD

**Analog:** same file, lines 36-42:
```prisma
enum TipoObrigacao {
  ICMS
  PIS_COFINS
  SPED_FISCAL
  SPED_CONTRIBUICOES
  DAS
}
```
**Pattern to apply:** add 4 new members, additively, no removal/rename of existing values (per D-06: granular, one enum member per obligation, consistent with ICMS/PIS_COFINS/SPED_FISCAL/SPED_CONTRIBUICOES already being separate):
```prisma
enum TipoObrigacao {
  ICMS
  PIS_COFINS
  SPED_FISCAL
  SPED_CONTRIBUICOES
  DAS
  FOLHA
  ESOCIAL
  FGTS
  INSS
}
```
No other schema change needed — `Tarefa.tipoObrigacao TipoObrigacao?` (line 124) and the `@@unique([empresaId, tipoObrigacao, competencia])` constraint (line 132) already cover any enum value automatically. Migration is purely additive (`npx prisma db push` / `migrate dev`), no data migration required.

---

### `src/app/(app)/tarefas/actions.ts` (extend) — controller (Server Action), request-response

**Analog:** same file, `AcaoGeracaoResult` type (lines 14-16) and `gerarTarefasDoMesAction` (lines 284-316)

**Type to extend** (lines 14-16):
```typescript
export type AcaoGeracaoResult =
  | { ok: true; criadas: number; puladas: number }
  | { ok: false; error: string };
```
New shape:
```typescript
export type AcaoGeracaoResult =
  | { ok: true; criadas: number; puladas: number; semResponsavelDp: { empresaId: string; nome: string }[] }
  | { ok: false; error: string };
```

**Action body pattern to extend** (lines 307-313) — same auth guard (`DONO`-only, lines 292-294) and competência validation (lines 296-305) stay unchanged; only the destructure/return at the call site grows:
```typescript
try {
  const { criadas, puladas } = await executarGeracaoMensal(competenciaResolvida);
  revalidatePath("/tarefas");
  return { ok: true, criadas, puladas };
} catch {
  return { ok: false, error: "Erro ao gerar tarefas. Tente novamente." };
}
```
New version:
```typescript
try {
  const { criadas, puladas, semResponsavelDp } = await executarGeracaoMensal(competenciaResolvida);
  revalidatePath("/tarefas");
  return { ok: true, criadas, puladas, semResponsavelDp };
} catch {
  return { ok: false, error: "Erro ao gerar tarefas. Tente novamente." };
}
```
**Pitfall 4 (RESEARCH.md):** grep all call sites of `executarGeracaoMensal(` and `AcaoGeracaoResult` after this change — any UI component consuming `gerarTarefasDoMesAction()` (e.g. a `GerarTarefasButton`) must also be updated to read/display `semResponsavelDp`, otherwise the field is silently computed and dropped (TypeScript won't error on an unused/extra field passthrough).

**`criarTarefa` (lines 40-110) — NO CHANGE NEEDED for DP-05.** This is the reuse pattern for the avulsa task feature: `withVisibilityScope`/`withTarefaScope` (imported line 7, applied line 77) are already setor-aware since Phase 5. Verify (don't modify) that a DP `COLABORADOR` hits the same `withVisibilityScope` branch that restricts by `responsaveisPorSetor: { some: { setor, usuarioId: user.id } }` (confirmed present in `src/lib/visibility-scope.ts` lines 81).

---

### `tests/geracao-tarefas-dp.test.ts` (new) — test, transform/unit

**Analog:** `tests/geracao-tarefas.test.ts` (full file, 79 lines) — pure function, no mocks needed.

**Structure to mirror:**
```typescript
import { describe, it, expect } from "vitest";
import { gerarTarefasDoMesDp } from "@/lib/geracao-tarefas-dp";

describe("gerarTarefasDoMesDp", () => {
  it("produz as 4 obrigacoes de DP para toda empresa CLT, independente de regime", () => {
    const empresas = [{ id: "e1", responsavelId: "u1" }];
    const resultado = gerarTarefasDoMesDp(empresas, "2026-06");
    const tipos = resultado.map((t) => t.tipoObrigacao).sort();
    expect(tipos).toEqual(["ESOCIAL", "FGTS", "FOLHA", "INSS"].sort());
  });

  it("FOLHA vence no 5o dia util do mes seguinte, nunca em fim de semana/feriado", () => {
    const empresas = [{ id: "e1", responsavelId: "u1" }];
    const resultado = gerarTarefasDoMesDp(empresas, "2026-06"); // mes seguinte: julho/2026
    const folha = resultado.find((t) => t.tipoObrigacao === "FOLHA")!;
    expect(folha.prazo.getFullYear()).toBe(2026);
    expect(folha.prazo.getMonth()).toBe(6); // julho, indice 6
    expect(folha.prazo.getDate()).toBe(7); // ver verificacao executavel do RESEARCH.md
  });

  it("ESOCIAL vence no dia 7, FGTS e INSS no dia 15, antecipando se cair em fim de semana/feriado", () => {
    // espelha o teste "resolve diaBase 31..." de tests/geracao-tarefas.test.ts linha 47-60
  });

  it("cada tarefa gerada carrega empresaId, responsavelId, competencia e titulo nao vazio", () => {
    // espelha tests/geracao-tarefas.test.ts linhas 62-77
  });
});
```

---

### `tests/dia-util.test.ts` (extend) — test, transform/unit

**Analog:** same file, existing weekend-anticipation tests (lines 24-31), structure to mirror exactly (same `mesmaData` helper already defined at lines 16-22, reuse it — do not redefine):
```typescript
describe("calcularQuintoDiaUtil", () => {
  it("retorna terca-feira 07/07/2026 para competencia junho/2026 (mes seguinte sem feriado nos 5 primeiros dias uteis)", () => {
    const resultado = calcularQuintoDiaUtil("2026-06");
    expect(mesmaData(resultado, new Date(2026, 6, 7))).toBe(true);
  });

  it("retorna sexta-feira 08/01/2027 para competencia dezembro/2026, empurrado pelo feriado de Ano Novo", () => {
    const resultado = calcularQuintoDiaUtil("2026-12");
    expect(mesmaData(resultado, new Date(2027, 0, 8))).toBe(true);
  });

  it("o resultado nunca cai em sabado, domingo ou feriado nacional", () => {
    // assert via isHoliday/isSaturday/isSunday checks across 2+ years, per RESEARCH.md Pitfall 1 guidance
  });
});
```
Add `import { calcularQuintoDiaUtil } from "@/lib/dia-util";` to the existing import line 3.

---

### `tests/geracao.idempotencia.test.ts` (extend) — test, CRUD/integration (mocked Prisma)

**Analog:** same file (full file, 126 lines) — `vi.mock("@/lib/db")` pattern (lines 1-40) stays unchanged; extend mock to also expect a second `empresa.findMany` call (DP loop) using `mockResolvedValueOnce` sequencing already demonstrated at line 65/68/75 (`createManyMock.mockResolvedValueOnce`).

**Pattern to add** (mirrors existing `beforeEach` reset block lines 43-56 and `it` block structure lines 58-80), using the exact RESEARCH.md Code Examples test as the template:
```typescript
it("empresa CLT sem responsável DP é pulada e listada, sem bloquear geração Fiscal", async () => {
  const empresasFiscal = [
    { id: "e1", regimeTributario: "SIMPLES_NACIONAL", responsavelId: "u1" },
  ];
  const empresasClt = [
    { id: "e2", nome: "Empresa CLT sem DP", responsaveisPorSetor: [] },
  ];
  empresaFindManyMock
    .mockResolvedValueOnce(empresasFiscal) // 1a chamada: loop Fiscal
    .mockResolvedValueOnce(empresasClt);   // 2a chamada: loop DP

  createManyMock.mockResolvedValue({ count: 1 }); // so a tarefa Fiscal e criada

  const resultado = await executarGeracaoMensal("2026-07");

  expect(resultado.criadas).toBe(1);
  expect(resultado.semResponsavelDp).toEqual([{ empresaId: "e2", nome: "Empresa CLT sem DP" }]);
});
```
**Also add:** a positive-path DP test (empresa CLT *with* DP responsible assigned creates DP tasks) and a DP-specific re-run idempotency test, mirroring the existing Fiscal idempotency test at lines 58-80 (first run creates N, second run with same competência creates 0 / skips N).

**Critical regression check (per RESEARCH.md Pitfall 2):** add one test with an empresa that has BOTH a FISCAL and a DP responsible assigned in `responsaveisPorSetor`, asserting the resulting DP task's `responsavelId` is the DP user's id, not the FISCAL user's — this guards the `where: { setor: "DP" }` filter inside the Prisma query, which is easy to omit by copy-paste.

## Shared Patterns

### Idempotência via constraint de banco (não check-before-insert)
**Source:** `src/modules/tarefas/geracao.ts` lines 80-86, `prisma/schema.prisma` line 132 (`@@unique([empresaId, tipoObrigacao, competencia])`)
**Apply to:** `geracao.ts` DP loop persistence — merge DP tasks into the same `tarefas` array before the single `createMany({ skipDuplicates: true })` call; never add a second `createMany` or any `findFirst`-before-insert check.

### "Pular e listar" em vez de abortar (D-03)
**Source:** new pattern introduced this phase, no prior analog in the codebase (first time the generation engine needs to skip-and-report rather than always-succeed) — modeled directly on the UI's existing "sem responsável" filter pattern from Phase 5 (`src/app/(app)/empresas/derive-rows.ts`, referenced in RESEARCH.md Open Question 2).
**Apply to:** `geracao.ts` (the `Array.filter`/partition logic), `actions.ts` (`AcaoGeracaoResult` propagation). Never use `throw` for "empresa sem responsável DP" — it's informational return data, not an error condition.

### `hd.isHoliday(date) === false` (never `=== true`)
**Source:** `src/lib/dia-util.ts` lines 33-36, file header comment lines 14-19
**Apply to:** any new dia-util function touching holiday checks — `calcularQuintoDiaUtil` reuses `isDiaUtil` directly rather than re-implementing the holiday check.

### Setor-aware filter on `responsaveisPorSetor` (`where: { setor: "DP" }`)
**Source:** `src/lib/visibility-scope.ts` line 81 (`responsaveisPorSetor: { some: { setor, usuarioId: user.id } }`)
**Apply to:** the new Prisma query inside `executarGeracaoMensal`'s DP loop — always scope by `setor: "DP"` inside the `select`, never rely on `responsaveisPorSetor[0]` over an unfiltered relation (Pitfall 2).

### Server Action result shape (`{ ok: true, ... } | { ok: false, error }`)
**Source:** `src/app/(app)/tarefas/actions.ts` lines 14-16, 25-27
**Apply to:** no new action is introduced this phase, but the extended `AcaoGeracaoResult` must preserve this exact discriminated-union shape — add fields only to the `ok: true` branch.

## No Analog Found

None. Every file in this phase's scope has a same-codebase analog of exact or near-exact match quality, per RESEARCH.md's explicit framing: "Esta fase não introduz nenhum problema novo de engenharia — é 100% composição de padrões já existentes e validados nesta mesma codebase."

## Metadata

**Analog search scope:** `src/lib/`, `src/modules/tarefas/`, `src/app/(app)/tarefas/`, `prisma/schema.prisma`, `tests/`
**Files scanned:** `src/lib/geracao-tarefas.ts`, `src/lib/dia-util.ts`, `src/modules/tarefas/geracao.ts`, `prisma/schema.prisma`, `src/app/(app)/tarefas/actions.ts`, `src/lib/visibility-scope.ts`, `tests/geracao-tarefas.test.ts`, `tests/geracao.idempotencia.test.ts`, `tests/dia-util.test.ts`
**Pattern extraction date:** 2026-06-24
