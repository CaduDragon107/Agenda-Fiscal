# Phase 7: Motor de Geração — Contábil (mensal e anual) - Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 8 (5 new, 3 modified) + test files
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/lib/geracao-tarefas-contabil.ts` | utility (pure catalog) | transform | `src/lib/geracao-tarefas.ts` | exact (same shape: `Record<RegimeTributario, Regra[]>`) |
| `src/lib/geracao-tarefas-contabil-anual.ts` | utility (pure catalog) | transform | `src/lib/geracao-tarefas-dp.ts` + `src/lib/dia-util.ts` | role-match (new periodicity, no direct analog for "annual"; closest is the DP flat-catalog pattern + dia-util's prazo helpers) |
| `src/lib/competencia.ts` (extend, add `competenciaAnualSchema`) | utility (validation) | transform | `src/lib/competencia.ts` (itself) | exact (extend existing file in place) |
| `src/modules/tarefas/geracao.ts` (modify) | service (orchestration) | CRUD (transactional) | itself — already contains Fiscal + DP blocks (Phase 6) | exact (third/fourth block, same file) |
| `prisma/schema.prisma` (modify `enum TipoObrigacao`) | model/migration | CRUD | itself — enum already extended once for DP | exact |
| `src/app/(app)/tarefas/actions.ts` (modify `AcaoGeracaoResult`, `gerarTarefasDoMesAction`) | controller (Server Action) | request-response | itself — already extended for `semResponsavelDp` (Phase 6) | exact |
| `tests/geracao-tarefas-contabil.test.ts` (new) | test | transform | `tests/geracao-tarefas-dp.test.ts` | exact |
| `tests/geracao-tarefas-contabil-anual.test.ts` (new) | test | transform | `tests/geracao-tarefas-dp.test.ts` (pure-function shape) + Code Examples in RESEARCH.md (12-month sweep) | role-match |
| `tests/geracao.idempotencia.test.ts` (extend) | test | event-driven/integration | itself | exact |
| `tests/tarefas.contabil.test.ts` (new, optional per setor convention) | test | request-response | `tests/tarefas.dp.test.ts` | exact |

## Pattern Assignments

### `src/lib/geracao-tarefas-contabil.ts` (utility, transform)

**Analog:** `src/lib/geracao-tarefas.ts` (Fiscal catalog — chosen over DP because Contábil mensal varies by `RegimeTributario`, exactly like Fiscal, NOT flat like DP)

**Imports pattern** (geracao-tarefas.ts lines 22-23):
```typescript
import { anticiparParaDiaUtil, calcularPrazoBaseDiaFixo } from "./dia-util";
import type { RegimeTributario } from "@prisma/client";
```

**Core catalog pattern** (geracao-tarefas.ts lines 25-55):
```typescript
export type TipoObrigacao = "ICMS" | "PIS_COFINS" | "SPED_FISCAL" | "SPED_CONTRIBUICOES" | "DAS";

type ObrigacaoRegra = { tipo: TipoObrigacao; diaBase: number };

export const CATALOGO_OBRIGACOES: Record<RegimeTributario, ObrigacaoRegra[]> = {
  LUCRO_REAL: [ { tipo: "ICMS", diaBase: 20 }, /* ... */ ],
  LUCRO_PRESUMIDO: [ /* ... */ ],
  SIMPLES_NACIONAL: [{ tipo: "DAS", diaBase: 20 }],
};

export const TITULO_OBRIGACAO: Record<TipoObrigacao, string> = { /* ... */ };
```
For Contábil: `SIMPLES_NACIONAL: []` (D-03 — zero rotinas). Per RESEARCH.md Pattern 1, extract the 8 identical entries into a shared `ROTINAS_CONTABIL_MENSAL` constant reused by both `LUCRO_REAL` and `LUCRO_PRESUMIDO` keys (DRY, no behavior change).

**Core generator function pattern** (geracao-tarefas.ts lines 66-90):
```typescript
export function gerarTarefasDoMes(
  empresas: { id: string; regimeTributario: RegimeTributario; responsavelId: string }[],
  competencia: string
): TarefaParaCriar[] {
  const [ano, mes] = competencia.split("-").map(Number);
  const nomeMes = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long" });

  return empresas.flatMap((empresa) =>
    CATALOGO_OBRIGACOES[empresa.regimeTributario].map((regra) => {
      const prazoBase = calcularPrazoBaseDiaFixo(competencia, regra.diaBase);
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
Rename to `gerarTarefasDoMesContabil`, parameter name `responsavelId` stays the same shape (caller passes the setor-CONTABIL-scoped value, per `geracao.ts` DP-block pattern, not `empresa.responsavelId` legacy column).

**Validation note (adopt from DP, not Fiscal):** `geracao-tarefas.ts` does NOT validate `competencia` format defensively — `geracao-tarefas-dp.ts` (lines 64-78) does, via `competenciaSchema.safeParse`, throwing `Error` on invalid format. Since Contábil mensal is a *new* axis (not a 1:1 copy of Fiscal), adopt the DP-style defensive validation:
```typescript
import { competenciaSchema } from "./competencia";
// ...
if (!competenciaSchema.safeParse(competencia).success) {
  throw new Error(`competencia inválida: ${competencia}`);
}
```

---

### `src/lib/geracao-tarefas-contabil-anual.ts` (utility, transform — new periodicity)

**Analog:** No direct existing analog (first annual periodicity in the codebase). Closest structural patterns are `src/lib/dia-util.ts` (`anticiparParaDiaUtil`, reused verbatim) and the function-shape convention of `geracao-tarefas-dp.ts` (flat catalog array, pure function, explicit `competenciaSchema`-style validation).

**Prazo helper to reuse without modification** (dia-util.ts lines 51-57):
```typescript
export function anticiparParaDiaUtil(date: Date): Date {
  let atual = date;
  while (!isDiaUtil(atual)) {
    atual = subDays(atual, 1);
  }
  return atual;
}
```

**New validation schema to add** (mirrors `competenciaSchema` in `src/lib/competencia.ts` lines 19-21):
```typescript
export const competenciaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência deve estar no formato YYYY-MM");
```
Add sibling `competenciaAnualSchema` in the same file (`src/lib/competencia.ts`):
```typescript
export const competenciaAnualSchema = z
  .string()
  .regex(/^\d{4}$/, "Competência anual deve estar no formato YYYY");
```

**Core catalog + pure decision function** (verified by RESEARCH.md local execution — use as-is, this is the validated design, not just a suggestion):
```typescript
export type TipoObrigacaoAnual = "DEFIS" | "ECD" | "ECF";

type ObrigacaoAnualRegra = {
  tipo: TipoObrigacaoAnual;
  mesCriacao: number;
  mesVencimento: number;
  diaVencimento: number;
  regimesElegiveis: RegimeTributario[];
};

export const CATALOGO_OBRIGACOES_ANUAIS: ObrigacaoAnualRegra[] = [
  { tipo: "DEFIS", mesCriacao: 2, mesVencimento: 3, diaVencimento: 31, regimesElegiveis: ["SIMPLES_NACIONAL"] },
  { tipo: "ECD", mesCriacao: 4, mesVencimento: 5, diaVencimento: 31, regimesElegiveis: ["LUCRO_REAL", "LUCRO_PRESUMIDO"] },
  { tipo: "ECF", mesCriacao: 6, mesVencimento: 7, diaVencimento: 31, regimesElegiveis: ["LUCRO_REAL", "LUCRO_PRESUMIDO"] },
];

export function obrigacoesAnuaisParaCompetencia(competencia: string) {
  const [anoAtual, mesAtual] = competencia.split("-").map(Number);
  return CATALOGO_OBRIGACOES_ANUAIS
    .filter((regra) => regra.mesCriacao === mesAtual)
    .map((regra) => ({
      regra,
      competenciaAnual: String(anoAtual), // D-09: format "YYYY"
      anoVencimento: anoAtual + 1,        // Pitfall 2 — ALWAYS next year
    }));
}

export function calcularPrazoAnual(anoVencimento: number, mesVencimento: number, diaVencimento: number): Date {
  const dataBase = new Date(anoVencimento, mesVencimento - 1, diaVencimento);
  return anticiparParaDiaUtil(dataBase);
}
```

**Critical implementation note (from RESEARCH.md):** `mesAtual`/`anoAtual` must be parsed from the `competencia: string` argument received by `executarGeracaoMensal`, never from `new Date()`. This is the same determinism invariant already enforced for `calcularPrazoBaseDiaFixo`/`calcularQuintoDiaUtil`.

---

### `src/modules/tarefas/geracao.ts` (modify — service, transactional CRUD)

**Analog:** the file itself — already extended once (Phase 6, DP block). Follow the exact same shape for the third (Contábil mensal) and fourth (Contábil anual) blocks.

**Imports to add** (mirrors lines 43-44):
```typescript
import { gerarTarefasDoMesContabil } from "@/lib/geracao-tarefas-contabil";
import {
  obrigacoesAnuaisParaCompetencia,
  calcularPrazoAnual,
  TITULO_OBRIGACAO_ANUAL,
} from "@/lib/geracao-tarefas-contabil-anual";
```

**DP block to mirror exactly for Contábil mensal** (geracao.ts lines 91-120):
```typescript
const empresasClt = await tx.empresa.findMany({
  where: { ativo: true, temFuncionariosClt: true },
  select: {
    id: true,
    nome: true,
    responsaveisPorSetor: {
      where: { setor: "DP" },          // CRITICAL filter, never omit
      select: { usuarioId: true },
    },
  },
});

const comResponsavelDp = empresasClt.filter((e) => e.responsaveisPorSetor.length > 0);
const semResponsavelDp = empresasClt
  .filter((e) => e.responsaveisPorSetor.length === 0)
  .map((e) => ({ empresaId: e.id, nome: e.nome })); // pular e listar, nunca throw

const tarefasDp = gerarTarefasDoMesDp(
  comResponsavelDp.map((e) => ({ id: e.id, responsavelId: e.responsaveisPorSetor[0].usuarioId })),
  competencia
);
```
For Contábil mensal: same shape, but `where: { ativo: true, regimeTributario: { in: ["LUCRO_REAL", "LUCRO_PRESUMIDO"] } }` (D-03) and `where: { setor: "CONTABIL" }` inside `responsaveisPorSetor`.

**Annual block (new — no direct precedent, follow RESEARCH.md Pattern 3 verbatim):** loop over `obrigacoesAnuaisParaCompetencia(competencia)`, for each triggered rule query empresas filtered dynamically by `regra.regimesElegiveis` (never hardcode the Fiscal/Contábil regime filter — that is Pitfall 3), same "pular e listar" shape as above.

**Merge + persist pattern** (geracao.ts lines 122-141, unchanged shape, just extend the array and the return type):
```typescript
const tarefas = [...tarefasFiscal, ...tarefasDp, ...tarefasContabilMensal, ...tarefasContabilAnual];

if (tarefas.length === 0) {
  return { criadas: 0, puladas: 0, semResponsavelDp, semResponsavelContabil };
}

const resultado = await tx.tarefa.createMany({
  data: tarefas.map((t) => ({ ...t, status: "PENDENTE" as const })),
  skipDuplicates: true, // apoia-se em @@unique([empresaId, tipoObrigacao, competencia])
});

return {
  criadas: resultado.count,
  puladas: tarefas.length - resultado.count,
  semResponsavelDp,
  semResponsavelContabil, // dedupe by empresaId across mensal+anual blocks (Pitfall 4)
};
```

---

### `src/app/(app)/tarefas/actions.ts` (modify — controller/Server Action)

**Analog:** the file itself — `gerarTarefasDoMesAction` and `AcaoGeracaoResult` already carry `semResponsavelDp` end-to-end (Phase 6 pattern).

**Type to extend** (lines 14-21):
```typescript
export type AcaoGeracaoResult =
  | {
      ok: true;
      criadas: number;
      puladas: number;
      semResponsavelDp: { empresaId: string; nome: string }[];
      semResponsavelContabil: { empresaId: string; nome: string }[]; // ADD
    }
  | { ok: false; error: string };
```

**Action body to extend** (lines 313-318):
```typescript
const { criadas, puladas, semResponsavelDp, semResponsavelContabil } =
  await executarGeracaoMensal(competenciaResolvida);
revalidatePath("/tarefas");
return { ok: true, criadas, puladas, semResponsavelDp, semResponsavelContabil };
```

**Auth/role guard pattern (unchanged, reuse as-is)** (lines 293-300):
```typescript
const session = await auth();
if (!session?.user) {
  return { ok: false, error: "Não autenticado" };
}
if (session.user.role !== "DONO") {
  return { ok: false, error: "não autorizado" };
}
```

**Pitfall 5 (RESEARCH.md):** grep every call site of `executarGeracaoMensal(` after this change (today: `gerarTarefasDoMesAction`, `tests/geracao.idempotencia.test.ts`, `tests/geracao.actions.test.ts`) to confirm `semResponsavelContabil` propagates end-to-end — TypeScript will not error on a silently-dropped extra field.

---

### `prisma/schema.prisma` (modify — model/migration)

**Analog:** itself — `enum TipoObrigacao` already grew once for DP (Phase 6, lines 36-46).

**Enum to extend** (lines 36-46):
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
  // ADD 11 new values (D-05, RESEARCH.md A2):
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
}
```
No other schema change needed — `Tarefa.competencia` stays `String?` (already free-form), and `@@unique([empresaId, tipoObrigacao, competencia])` (line 136) already covers the new enum values automatically. Migration is purely additive (`npx prisma db push`), per RESEARCH.md State of the Art table.

---

### Tests

**`tests/geracao-tarefas-contabil.test.ts`** — mirror `tests/geracao-tarefas-dp.test.ts` exactly (pure function, no mocks):
```typescript
import { describe, it, expect } from "vitest";
import { gerarTarefasDoMesContabil } from "@/lib/geracao-tarefas-contabil";

describe("gerarTarefasDoMesContabil", () => {
  it("produz as 8 rotinas para LUCRO_REAL e LUCRO_PRESUMIDO, zero para SIMPLES_NACIONAL", () => {
    // mirrors lines 16-21 of geracao-tarefas-dp.test.ts
  });
});
```

**`tests/geracao-tarefas-contabil-anual.test.ts`** — use the RESEARCH.md "12-month sweep" pattern verbatim (already validated by local execution):
```typescript
describe("obrigacoesAnuaisParaCompetencia — exatamente 1 disparo por obrigação por ano", () => {
  it("rodando as 12 competências de 2026, cada obrigação anual dispara exatamente 1 vez", () => {
    const disparos: Record<string, number> = { DEFIS: 0, ECD: 0, ECF: 0 };
    for (let mes = 1; mes <= 12; mes++) {
      const competencia = `2026-${String(mes).padStart(2, "0")}`;
      const regras = obrigacoesAnuaisParaCompetencia(competencia);
      for (const { regra } of regras) disparos[regra.tipo]++;
    }
    expect(disparos).toEqual({ DEFIS: 1, ECD: 1, ECF: 1 });
  });
});
```

**`tests/tarefas.contabil.test.ts` (optional, per-setor convention)** — mirror `tests/tarefas.dp.test.ts` lines 1-50 exactly, swapping `setor: "DP"` → `setor: "CONTABIL"` and `mockDpColaboradorUser` → an equivalent Contábil fixture from `tests/setup.ts`.

**`tests/geracao.idempotencia.test.ts` (extend)** — read existing DP-related cases in this file as the template for: (a) Contábil mensal normal generation, (b) empresa sem responsável Contábil pulada e listada, (c) annual block firing in the correct month, (d) re-running same competência doesn't duplicate.

## Shared Patterns

### Idempotência via constraint de banco
**Source:** `prisma/schema.prisma` line 136 (`@@unique([empresaId, tipoObrigacao, competencia])`) + `src/modules/tarefas/geracao.ts` lines 128-134 (`createMany({ skipDuplicates: true })`)
**Apply to:** `geracao-tarefas-contabil.ts`, `geracao-tarefas-contabil-anual.ts`, and the new blocks in `geracao.ts` — never add a second idempotency mechanism (no control table, no in-memory cache).

### Setor-aware responsible lookup
**Source:** `src/modules/tarefas/geracao.ts` lines 95-105 (DP block, `responsaveisPorSetor: { where: { setor: "DP" } } }`)
**Apply to:** the new Contábil mensal block and each annual obligation block — filter must be `setor: "CONTABIL"`. Never read `empresa.responsavelId` (legacy Fiscal column) for Contábil.

### Pular e listar (never throw) for empresas sem responsável
**Source:** `src/modules/tarefas/geracao.ts` lines 107-112
**Apply to:** Contábil mensal block AND each annual obligation block. Per RESEARCH.md Pitfall 4, dedupe the combined `semResponsavelContabil` list by `empresaId` before returning from `executarGeracaoMensal`.

### Antecipação para dia útil (never postpone)
**Source:** `src/lib/dia-util.ts` lines 51-57 (`anticiparParaDiaUtil`)
**Apply to:** all 8 monthly Contábil rules and all 3 annual obligations (ECD/ECF/DEFIS) — reuse verbatim, no modification needed (confirmed correct for the annual axis by RESEARCH.md local execution, including the ECF weekend-adjustment case).

### Competência validation (defensive, throw on invalid format)
**Source:** `src/lib/geracao-tarefas-dp.ts` lines 64-78 (`competenciaSchema.safeParse` + `throw new Error`)
**Apply to:** `gerarTarefasDoMesContabil` (monthly, `"YYYY-MM"` via existing `competenciaSchema`) and the annual catalog functions (`"YYYY"` via new `competenciaAnualSchema`).

### Server Action result propagation (extend, don't replace)
**Source:** `src/app/(app)/tarefas/actions.ts` lines 14-21, 289-321 (`AcaoGeracaoResult`, `gerarTarefasDoMesAction`)
**Apply to:** add `semResponsavelContabil` alongside existing `semResponsavelDp`, propagate end-to-end (Pitfall 5) — grep all call sites of `executarGeracaoMensal(`.

### Tarefa avulsa reuse (no change required)
**Source:** `src/app/(app)/tarefas/actions.ts` lines 45-115 (`criarTarefa`) + `src/lib/visibility-scope.ts` (`withVisibilityScope`/`withTarefaScope`, already setor-aware since Phase 5)
**Apply to:** CONT-06 — zero code changes; only add a regression test fixture (`tests/tarefas.contabil.test.ts`) mirroring `tests/tarefas.dp.test.ts`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/geracao-tarefas-contabil-anual.ts` (the annual-periodicity decision function `obrigacoesAnuaisParaCompetencia` specifically) | utility | transform | First annual-periodicity construct in the codebase — no prior file decides "should this fire this month" as a pure function of (mes, ano). RESEARCH.md already designed, coded, and locally validated this function; use the Code Examples from RESEARCH.md verbatim rather than improvising a new shape. |

## Metadata

**Analog search scope:** `src/lib/`, `src/modules/tarefas/`, `src/app/(app)/tarefas/`, `prisma/schema.prisma`, `tests/`
**Files scanned:** `geracao-tarefas.ts`, `geracao-tarefas-dp.ts`, `dia-util.ts`, `competencia.ts`, `modules/tarefas/geracao.ts`, `app/(app)/tarefas/actions.ts`, `prisma/schema.prisma` (enums + Tarefa model), `tests/geracao-tarefas-dp.test.ts`, `tests/tarefas.dp.test.ts`
**Pattern extraction date:** 2026-06-24
