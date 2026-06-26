# Phase 9: 13º Salário Automático - Pattern Map

**Mapped:** 2026-06-25
**Files analyzed:** 6 (1 new lib, 1 modified orchestrator, 1 modified setor map, 1 modified Prisma schema, 1 new test, 2 modified tests)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/geracao-tarefas-dp-anual.ts` (NEW) | service (pure catalog/rule engine) | transform (competência → regras → prazo) | `src/lib/geracao-tarefas-contabil-anual.ts` | exact (same role, same data flow, same annual periodicity pattern) |
| `src/modules/tarefas/geracao.ts` (MODIFIED — add 6th block) | service (orchestrator, transactional) | CRUD (batch upsert via createMany) | itself — bloco Contábil anual (linhas 190-241) within the same file | exact (same file, same integration pattern) |
| `src/lib/tipo-obrigacao-setor.ts` (MODIFIED — add DECIMO_TERCEIRO to DP list) | config (static map) | transform | itself — `TIPOS_OBRIGACAO_POR_SETOR.DP` array | exact (single-line addition to existing structure) |
| `prisma/schema.prisma` (MODIFIED — enum TipoObrigacao) | model (schema/migration) | CRUD | itself — enum `TipoObrigacao` block (lines 36-57) | exact |
| `tests/geracao-tarefas-dp-anual.test.ts` (NEW) | test | transform (pure function sweep) | `tests/geracao-tarefas-contabil-anual.test.ts` | exact (same sweep-12-months pattern) |
| `tests/tipo-obrigacao-setor.test.ts` (MODIFIED — counts 20→21, DP 4→5) | test | transform | itself | exact |
| `tests/geracao.idempotencia.test.ts` (MODIFIED — new block + mock chain) | test | event-driven (mocked transaction calls) | itself | exact |

## Pattern Assignments

### `src/lib/geracao-tarefas-dp-anual.ts` (service, transform) — NEW FILE

**Analog:** `src/lib/geracao-tarefas-contabil-anual.ts` (full file, 124 lines — read completely, no analog file is >2000 lines)

**Imports pattern** (lines 35-37 of analog):
```typescript
import { anticiparParaDiaUtil } from "./dia-util";
import { competenciaSchema } from "./competencia";
import type { RegimeTributario } from "@prisma/client";
```
> Adaptation: DP-09's catalog is FLAT (no `RegimeTributario` filter, per `geracao-tarefas-dp.ts` precedent) — drop the `RegimeTributario` import entirely. Only `anticiparParaDiaUtil` and `competenciaSchema` are needed.

**Core type + catalog pattern** (lines 39-78 of analog):
```typescript
export type TipoObrigacaoAnual = "DEFIS" | "ECD" | "ECF";

export type ObrigacaoAnualRegra = {
  tipo: TipoObrigacaoAnual;
  mesCriacao: number;
  mesVencimento: number;
  diaVencimento: number;
  regimesElegiveis: RegimeTributario[]; // DROP for DP-09 — flat catalog, no regime filter
};

export const TITULO_OBRIGACAO_ANUAL: Record<TipoObrigacaoAnual, string> = {
  DEFIS: "DEFIS",
  ECD: "ECD (Escrituração Contábil Digital)",
  ECF: "ECF (Escrituração Contábil Fiscal)",
};

export const CATALOGO_OBRIGACOES_ANUAIS: ObrigacaoAnualRegra[] = [
  { tipo: "DEFIS", mesCriacao: 2, mesVencimento: 3, diaVencimento: 31, regimesElegiveis: ["SIMPLES_NACIONAL"] },
  // ...
];
```

**Decision function pattern** (lines 91-107 of analog — the critical divergence point, D-02):
```typescript
export function obrigacoesAnuaisParaCompetencia(
  competencia: string
): { regra: ObrigacaoAnualRegra; competenciaAnual: string; anoVencimento: number }[] {
  if (!competenciaSchema.safeParse(competencia).success) {
    throw new Error(`competencia inválida: ${competencia}`);
  }
  const [anoAtual, mesAtual] = competencia.split("-").map(Number);
  return CATALOGO_OBRIGACOES_ANUAIS.filter((regra) => regra.mesCriacao === mesAtual).map(
    (regra) => ({
      regra,
      competenciaAnual: String(anoAtual),
      anoVencimento: anoAtual + 1, // Pitfall 2 — SEMPRE ano seguinte (Contábil)
    })
  );
}
```
> **CRITICAL ADAPTATION (D-02 / RESEARCH.md Pattern 1):** For `obrigacoesDpAnuaisParaCompetencia`, change `anoVencimento: anoAtual + 1` to `anoVencimento: anoAtual` with an explicit comment documenting the divergence from the Contábil pattern. Do NOT import or reuse `obrigacoesAnuaisParaCompetencia`/`calcularPrazoAnual` from the Contábil module — duplicate the function body into the new file (Pitfall 1).

**Prazo calculation pattern** (lines 116-123 of analog, reuse verbatim with renamed function):
```typescript
export function calcularPrazoAnual(
  anoVencimento: number,
  mesVencimento: number,
  diaVencimento: number
): Date {
  const dataBase = new Date(anoVencimento, mesVencimento - 1, diaVencimento);
  return anticiparParaDiaUtil(dataBase);
}
```
> Rename to `calcularPrazoDpAnual` in the new file; body is byte-identical (D-03: `anticiparParaDiaUtil` reused without modification).

**Flat-catalog precedent (no regime filter)** — from `src/lib/geracao-tarefas-dp.ts` lines 40-46:
```typescript
// Catálogo FLAT — DP não varia por regime tributário (ao contrário do Fiscal)
export const CATALOGO_OBRIGACOES_DP: ObrigacaoRegraDp[] = [
  { tipo: "FOLHA", regra: "QUINTO_DIA_UTIL" },
  { tipo: "ESOCIAL", regra: "DIA_BASE", diaBase: 7 },
  ...
];
```
> Confirms DP-09's catalog entry should have no `regimesElegiveis` field at all (unlike Contábil anual) — the gate is `temFuncionariosClt`, applied by the caller in `geracao.ts`, never inside the catalog.

---

### `src/modules/tarefas/geracao.ts` (orchestrator, MODIFIED — add 6th block)

**Analog:** itself — bloco Contábil anual, lines 190-250 (read in full above)

**Import pattern to add** (mirrors lines 59-64):
```typescript
import {
  obrigacoesDpAnuaisParaCompetencia,
  calcularPrazoDpAnual,
  TITULO_OBRIGACAO_DP_ANUAL,
  type TipoObrigacaoDpAnual,
} from "@/lib/geracao-tarefas-dp-anual";
```

**Eligibility query reuse** — the existing `empresasClt` query (lines 126-136) already has the exact shape needed (`temFuncionariosClt: true`, `responsaveisPorSetor` filtered by `setor: "DP"`):
```typescript
const empresasClt = await tx.empresa.findMany({
  where: { ativo: true, temFuncionariosClt: true },
  select: {
    id: true,
    nome: true,
    responsaveisPorSetor: {
      where: { setor: "DP" },
      select: { usuarioId: true },
    },
  },
});
```
> **Pitfall 4 (mock ordering):** Reuse this SAME variable for the new DP-anual block — do NOT issue a second `findMany`. This avoids shifting the positional mock chain in `tests/geracao.idempotencia.test.ts`. Add the new block as the LAST block in the transaction (after Contábil anual, before `tarefas = [...]`).

**Skip+list pattern** (lines 138-143, reused as-is, filtering the same `empresasClt` array a second time for the DP-anual regras):
```typescript
const comResponsavelDp = empresasClt.filter((e) => e.responsaveisPorSetor.length > 0);
const semResponsavelDp = empresasClt
  .filter((e) => e.responsaveisPorSetor.length === 0)
  .map((e) => ({ empresaId: e.id, nome: e.nome }));
```

**Annual-block loop pattern** (lines 206-241, structurally mirrored):
```typescript
const regrasDpAnuais = obrigacoesDpAnuaisParaCompetencia(competencia);

let tarefasDpAnual: {
  empresaId: string;
  responsavelId: string;
  titulo: string;
  tipoObrigacao: TipoObrigacaoDpAnual;
  competencia: string;
  prazo: Date;
}[] = [];

for (const { regra, competenciaAnual, anoVencimento } of regrasDpAnuais) {
  // reuse comResponsavelDp/empresasClt already computed above — no new findMany
  tarefasDpAnual = tarefasDpAnual.concat(
    comResponsavelDp.map((e) => ({
      empresaId: e.id,
      responsavelId: e.responsaveisPorSetor[0].usuarioId,
      titulo: `${TITULO_OBRIGACAO_DP_ANUAL[regra.tipo]} - ${competenciaAnual}`,
      tipoObrigacao: regra.tipo,
      competencia: competenciaAnual,
      prazo: calcularPrazoDpAnual(anoVencimento, regra.mesVencimento, regra.diaVencimento),
    }))
  );
}
```

**Final concat** (line 252-257, append the new array):
```typescript
const tarefas = [
  ...tarefasFiscal,
  ...tarefasDp,
  ...tarefasContabilMensal,
  ...tarefasContabilAnual,
  ...tarefasDpAnual, // NOVO
];
```

**Return shape extension** (lines 84-89, 271-276) — add `semResponsavelDpAnual` to both the function signature's return type and the final `return` statement, deduplicated against `semResponsavelDp` if they can overlap (same pattern as `semResponsavelContabilMap` lines 246-250) — though in this case both come from the SAME `empresasClt` filter, so no separate list/dedup is needed if the eligibility set is identical; only dedupe if a future change diverges the eligibility query.

---

### `src/lib/tipo-obrigacao-setor.ts` (config, MODIFIED)

**Analog:** itself, line 23

**Exact change required:**
```typescript
// Before:
DP: ["FOLHA", "ESOCIAL", "FGTS", "INSS"],
// After:
DP: ["FOLHA", "ESOCIAL", "FGTS", "INSS", "DECIMO_TERCEIRO"],
```
> **Pitfall 2 (HIGH SEVERITY):** This edit must land in the SAME commit/task as the Prisma enum migration. `tests/tipo-obrigacao-setor.test.ts` enforces completeness and will fail with `ocorrenciasPorValor.get('DECIMO_TERCEIRO') is undefined` if forgotten. No compiler error will catch this — TypeScript does not connect the enum to this map automatically.

---

### `prisma/schema.prisma` (model/migration, MODIFIED)

**Analog:** itself, enum `TipoObrigacao` lines 36-57

**Exact change required** (append before closing brace):
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
  EXTRATO_BANCARIO
  LANCAMENTO_EXTRATOS
  FOLHA_CONTABIL
  FISCAL_CONTABIL
  BAIXA_IMPOSTOS
  PERDCOMP
  FORNECEDORES_CLIENTES
  BALANCO
  ECD
  ECF
  DEFIS
  DECIMO_TERCEIRO
}
```
Apply via `npx prisma db push` (Neon, no shadow database — established pattern from STATE.md Phase 02-01), then `npx prisma generate` before any `tsc --noEmit` (STATE.md Phase 05-04).

---

### `tests/geracao-tarefas-dp-anual.test.ts` (test, NEW)

**Analog:** `tests/geracao-tarefas-contabil-anual.test.ts` (full file structure, lines 1-60+ read above)

**Sweep-12-months pattern** (lines 20-33 of analog):
```typescript
describe("obrigacoesDpAnuaisParaCompetencia — exatamente 1 disparo por ano", () => {
  it("rodando as 12 competências de 2026, DECIMO_TERCEIRO dispara exatamente 1 vez", () => {
    const disparos: Record<string, number> = { DECIMO_TERCEIRO: 0 };
    for (let mes = 1; mes <= 12; mes++) {
      const competencia = `2026-${String(mes).padStart(2, "0")}`;
      const regras = obrigacoesDpAnuaisParaCompetencia(competencia);
      for (const { regra } of regras) disparos[regra.tipo]++;
    }
    expect(disparos).toEqual({ DECIMO_TERCEIRO: 1 });
  });
});
```

**anoVencimento assertion pattern** (lines 56-60 of analog, ADAPTED for D-02 — note the inverted expectation vs Contábil):
```typescript
it('para competência "2026-11", competenciaAnual é "2026" e anoVencimento é 2026 (D-02 — MESMO ano, diverge do padrão Contábil)', () => {
  const regras = obrigacoesDpAnuaisParaCompetencia("2026-11");
  expect(regras).toHaveLength(1);
  expect(regras[0].regra.tipo).toBe("DECIMO_TERCEIRO");
  expect(regras[0].competenciaAnual).toBe("2026");
  expect(regras[0].anoVencimento).toBe(2026); // NOT 2027
});
```

Additionally cover `calcularPrazoDpAnual` with a known weekend/holiday date for 20/Dec (verify actual calendar at implementation time per RESEARCH.md Wave 0 Gaps — do not assume 20/Dec/2026 is a Sunday without checking `date-holidays` output directly).

---

### `tests/tipo-obrigacao-setor.test.ts` (test, MODIFIED)

**Analog:** itself — locate existing assertions for total count (20) and DP count (4), increment both to 21 and 5 respectively, and add `"DECIMO_TERCEIRO"` to the DP `arrayContaining`/list assertion.

---

### `tests/geracao.idempotencia.test.ts` (test, MODIFIED)

**Analog:** itself — existing chained `mockResolvedValueOnce` sequence

**Pitfall 4 guidance:** Since the new DP-anual block reuses the SAME `empresasClt` query (no new `findMany`), the existing mock chain order should NOT shift, provided the implementation follows the reuse pattern above. Add one new `it()` covering idempotency of the DP-anual block specifically (2 executions of competência "2026-11", asserting only 1 `DECIMO_TERCEIRO` tarefa created). If the chosen implementation requires a fresh `findMany` instead of reuse, add `mockResolvedValueOnce([])` (or appropriate fixture) at the END of every existing test's mock chain — never in the middle (per RESEARCH.md Pitfall 4 warning).

---

## Shared Patterns

### Pure catalog function, zero I/O
**Source:** `src/lib/geracao-tarefas-contabil-anual.ts`, `src/lib/geracao-tarefas-dp.ts` (both full files)
**Apply to:** `src/lib/geracao-tarefas-dp-anual.ts`
All catalog/rule functions in this codebase are pure: no Prisma client, no `Date.now()`/`new Date()` without an explicit competência argument, no auth, no cron awareness. Validate input via `competenciaSchema.safeParse` and `throw` on invalid format — never produce `Invalid Date` silently.

### Responsável lookup via `responsaveisPorSetor`, never `empresa.responsavelId`
**Source:** `src/modules/tarefas/geracao.ts` lines 122-136, 153-172
**Apply to:** the new DP-anual block in `geracao.ts`
Every non-Fiscal block filters `responsaveisPorSetor` by the correct `setor` value in the Prisma `select`/`where`, and treats "no responsável" as a skip+list, never a thrown error.

### Idempotency via unique constraint + `skipDuplicates`
**Source:** `src/modules/tarefas/geracao.ts` lines 263-269, schema `@@unique([empresaId, tipoObrigacao, competencia])`
**Apply to:** the final `tx.tarefa.createMany` call (already covers the new DECIMO_TERCEIRO entries automatically — no new mechanism needed)

### Setor visibility via static map
**Source:** `src/lib/tipo-obrigacao-setor.ts`
**Apply to:** mandatory, same commit as the enum migration — this is what makes the new tarefa visible in DP dashboards (`tarefaSetorWhere("DP")`)

## No Analog Found

None. All 7 file changes have an exact, structurally-matching analog already in the codebase (Fase 6 DP catalog + Fase 7 Contábil anual catalog/orchestrator block + their respective tests).

## Metadata

**Analog search scope:** `src/lib/`, `src/modules/tarefas/`, `prisma/schema.prisma`, `tests/` (directories explicitly named in RESEARCH.md canonical_refs and code_context — no broader glob search was necessary since RESEARCH.md already inspected the real source code directly)
**Files scanned:** `src/lib/geracao-tarefas-contabil-anual.ts`, `src/lib/geracao-tarefas-dp.ts`, `src/lib/tipo-obrigacao-setor.ts`, `src/modules/tarefas/geracao.ts`, `prisma/schema.prisma` (enum block), `tests/geracao-tarefas-contabil-anual.test.ts`
**Pattern extraction date:** 2026-06-25
