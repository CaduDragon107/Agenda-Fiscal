# Phase 5: Fundação Multi-Setor — Schema, Autorização e Empresas - Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 13
**Analogs found:** 13 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `prisma/schema.prisma` (add `Setor` enum, `Usuario.setor`, `EmpresaResponsavelSetor`, `Empresa.temFuncionariosClt`) | model | CRUD | `prisma/schema.prisma` (existing `EmpresaRegimeHistorico` junction-style model) | exact |
| `scripts/backfill-responsavel-setor.mjs` (NEW) | utility | batch | `scripts/atualizar-responsaveis.mjs` | exact |
| `prisma/seed.ts` (extend with 7 placeholders + `setor`) | utility | batch | `prisma/seed.ts` (itself, extend in place) | exact |
| `src/lib/visibility-scope.ts` (`withVisibilityScope`/`withTarefaScope` gain `setor` param) | middleware | request-response | `src/lib/visibility-scope.ts` (itself, extend in place) | exact |
| `src/types/next-auth.d.ts` (add `setor` to Session/User/JWT) | config | event-driven (auth callback) | `src/types/next-auth.d.ts` (itself, extend in place) | exact |
| `src/auth.ts` (`authorize` selects/returns `setor`) | service | request-response | `src/auth.ts` (itself, extend in place) | exact |
| `src/auth.config.ts` (jwt/session callbacks propagate `setor`) | middleware | event-driven | `src/auth.config.ts` (itself, extend in place) | exact |
| `src/modules/empresas/queries.ts` (`EMPRESA_SELECT` + `listarResponsaveis(setor?)`, new `responsaveisPorSetor` relation) | service | CRUD | `src/modules/empresas/queries.ts` (itself, extend in place) | exact |
| `src/modules/empresas/schema.ts` (3 responsável fields + `temFuncionariosClt`) | model (validation) | CRUD | `src/modules/empresas/schema.ts` (itself, extend in place) | exact |
| `src/app/(app)/actions.ts` (`criarEmpresa`/`editarEmpresa` write junction table, DONO-only guard) | controller (server action) | CRUD | `src/app/(app)/actions.ts` (itself, extend in place) | exact |
| `src/app/(app)/empresas/empresa-form.tsx` (3 Selects + CLT Checkbox) | component | request-response | `src/app/(app)/empresas/empresa-form.tsx` (itself) + `StepReview.tsx` (Checkbox + "Sem regime" badge pattern) | exact |
| `src/app/(app)/empresas/empresas-table.tsx` ("sem responsável" filter/badge, sector-filtered columns, sector-aware empty state) | component | request-response | `src/app/(app)/empresas/empresas-table.tsx` (itself) + `StepReview.tsx` (badge/filter precedent) | exact |
| `tests/visibility-scope.setor.test.ts` (NEW) | test | request-response | `tests/visibility-scope.test.ts` | exact |
| `tests/empresas.idor.test.ts` (extend — DONO-only guard test) | test | request-response | `tests/empresas.idor.test.ts` (itself, extend in place) | exact |

## Pattern Assignments

### `prisma/schema.prisma`

**Analog:** itself — existing `EmpresaRegimeHistorico` model is the established junction/history-table convention to mirror.

**Core pattern** (lines 77-87, `EmpresaRegimeHistorico` as junction-table precedent):
```prisma
model EmpresaRegimeHistorico {
  id               String            @id @default(cuid())
  empresaId        String
  empresa          Empresa           @relation(fields: [empresaId], references: [id])
  regimeTributario RegimeTributario
  dataInicio       DateTime
  dataFim          DateTime?

  @@index([empresaId, dataInicio])
  @@map("empresa_regime_historico")
}
```

**New models to add** (RESEARCH.md Pattern 1 — already grounded in this schema's conventions: `cuid()` ids, `@@map` snake_case, `@updatedAt`):
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
```
Add to `Usuario`: `setor Setor?` + `responsaveisPorSetor EmpresaResponsavelSetor[]`.
Add to `Empresa`: `temFuncionariosClt Boolean @default(false)` + `responsaveisPorSetor EmpresaResponsavelSetor[]`. **KEEP `responsavelId`/`responsavel` UNCHANGED** — Fiscal generation engine (`src/modules/tarefas/geracao.ts`) still reads it; do not remove or rename in this phase.

**Migration command convention** (RESEARCH.md, confirmed by STATE.md): `npx prisma db push` (NOT `migrate dev` — this Neon environment has no shadow database), followed by `npx prisma generate`.

---

### `scripts/backfill-responsavel-setor.mjs` (NEW)

**Analog:** `scripts/atualizar-responsaveis.mjs`

**Dry-run/--apply convention** (lines 32, 228-231, 233-234 of the analog):
```javascript
const APPLY = process.argv.includes("--apply");
// ...
if (!APPLY) {
  console.log("\nDRY-RUN: nenhuma alteracao aplicada. Rode com --apply para aplicar.");
  return;
}
console.log("\n===== APLICANDO ALTERACOES =====");
```

**Reporting structure to mirror** (lines 84-85, 176-193 — print mode, counts, before any write):
```javascript
console.log(`Modo: ${APPLY ? "APPLY (escreve no banco)" : "DRY-RUN (nenhuma escrita)"}`);
console.log(`Empresas no banco: ${empresas.length}`); // expect 197
```

**Idempotent write pattern to use** (`upsert` keyed on the compound unique, per RESEARCH.md Pattern 2 — NOT `create`, to allow safe re-runs):
```javascript
await db.empresaResponsavelSetor.upsert({
  where: { empresaId_setor: { empresaId: empresa.id, setor: "FISCAL" } },
  update: { usuarioId: empresa.responsavelId },
  create: { empresaId: empresa.id, setor: "FISCAL", usuarioId: empresa.responsavelId },
});
```

**Verification-count gate to add** (not present in the analog script but required by CONTEXT.md D-01/SETOR-01 — exit non-zero on mismatch):
```javascript
const totalFiscal = await db.empresaResponsavelSetor.count({ where: { setor: "FISCAL" } });
if (totalFiscal !== empresas.length) {
  console.error(`FALHA DE VERIFICAÇÃO: esperado ${empresas.length}, encontrado ${totalFiscal}`);
  process.exitCode = 1;
}
```

**Connection lifecycle** (line 264-266, 269 of analog):
```javascript
} finally {
  await db.$disconnect();
}
```

---

### `prisma/seed.ts` (extend)

**Analog:** itself (lines 1-25, full file already read).

**Exact bcrypt + upsert pattern to replicate for 7 new placeholders** (lines 6-22):
```typescript
const usuarios = [
  // ...existing 5 unchanged...
  { nome: "DP1", email: "dp1@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.DP },
  // ...DP2-4, Contabil1-3...
];

for (const u of usuarios) {
  const senhaHash = await bcrypt.hash("trocar-no-primeiro-login", 10); // D-08: literal string unchanged
  await db.usuario.upsert({
    where: { email: u.email },
    update: {},
    create: { ...u, senhaHash },
  });
}
```

**CRITICAL pitfall (RESEARCH.md):** `update: {}` does NOT retroactively set `setor` on the 4 existing Fiscal colaboradores (Caio/Jessica/Heitor/Felipe) — they predate the column. A **separate** one-time statement is required, run alongside Pattern 2's backfill, not inside the seed loop:
```typescript
await db.usuario.updateMany({
  where: { email: { in: [
    "colaborador1@escritorio.com.br", "colaborador2@escritorio.com.br",
    "colaborador3@escritorio.com.br", "colaborador4@escritorio.com.br",
  ] } },
  data: { setor: "FISCAL" },
});
```
Verify with `db.usuario.count({ where: { role: "COLABORADOR", setor: null } })` returning `0`.

---

### `src/lib/visibility-scope.ts` (extend)

**Analog:** itself (full file, lines 1-52, already read in full).

**Current exact pattern to preserve call-site compatibility with:**
```typescript
export type SessionUser = {
  id: string;
  role: "COLABORADOR" | "DONO";
};

export function withVisibilityScope(
  user: SessionUser
): Prisma.EmpresaWhereInput {
  if (user.role === "DONO") {
    return {};
  }
  return { responsavelId: user.id };
}
```

**Required extension** (RESEARCH.md Pattern 4 — optional `setor` param defaulting to `user.setor`, so every existing call site `...withVisibilityScope(user)` keeps compiling/behaving unchanged):
```typescript
export type SessionUser = {
  id: string;
  role: "COLABORADOR" | "DONO";
  setor: "FISCAL" | "DP" | "CONTABIL" | null;
};

export function withVisibilityScope(
  user: SessionUser,
  setor: SessionUser["setor"] = user.setor
): Prisma.EmpresaWhereInput {
  if (user.role === "DONO") {
    return {};
  }
  if (!setor) {
    return { id: "__no_setor_defined__" }; // fail SAFE, never widen
  }
  return {
    responsaveisPorSetor: { some: { setor, usuarioId: user.id } }, // combined filter — never split
  };
}
```
`withTarefaScope` stays unchanged in shape this phase (`Tarefa.setor` doesn't exist yet — Phase 6/7) — only `SessionUser` type widens.

**Security-critical rule (Pitfall B3, do not violate):** `setor` AND `usuarioId` must be in the SAME `some: {...}` object, never two separate `where` clauses — a split filter would let a colaborador see all empresas of their sector regardless of personal assignment.

---

### `src/types/next-auth.d.ts` (extend)

**Analog:** itself (full file, lines 1-49, already read in full).

**Exact 4-module augmentation pattern to replicate for `setor`** (this is the load-bearing convention — next-auth re-exports types via `export *`, so augmenting only `next-auth`/`next-auth/jwt` is insufficient; must ALSO augment `@auth/core/types`/`@auth/core/jwt` directly):
```typescript
export type AppSetor = "FISCAL" | "DP" | "CONTABIL";

declare module "next-auth" {
  interface Session { user: { id: string; role: AppRole; setor: AppSetor | null } & DefaultSession["user"] }
  interface User { id: string; role: AppRole; setor: AppSetor | null }
}
declare module "@auth/core/types" {
  interface Session { user: { id: string; role: AppRole; setor: AppSetor | null } & DefaultSession["user"] }
  interface User { id: string; role: AppRole; setor: AppSetor | null }
}
declare module "next-auth/jwt" { interface JWT { id: string; role: AppRole; setor: AppSetor | null } }
declare module "@auth/core/jwt" { interface JWT { id: string; role: AppRole; setor: AppSetor | null } }
```

---

### `src/auth.ts` (extend `authorize`)

**Analog:** itself (full file, lines 1-58, already read in full).

**Exact select + return shape to extend** (lines 21-30, 39-44 — add `setor` alongside `role`, never select `senhaHash` outside this function):
```typescript
const usuario = await db.usuario.findUnique({
  where: { email: credentials.email as string },
  select: { id: true, nome: true, email: true, role: true, setor: true, senhaHash: true },
});
// ...
return {
  id: usuario.id, name: usuario.nome, email: usuario.email,
  role: usuario.role, setor: usuario.setor,
};
```

---

### `src/auth.config.ts` (extend jwt/session callbacks)

**Analog:** itself (full file, lines 1-36, already read in full).

**Exact callback-extension pattern** (lines 20-33 — same assignment shape, add `setor` line-for-line alongside `role`):
```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.role = user.role;
      token.setor = user.setor;
    }
    return token;
  },
  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.setor = token.setor;
    }
    return session;
  },
},
```
This file stays edge-runtime-safe — do NOT import `@/lib/db`/`bcryptjs` here (that's `src/auth.ts`'s job).

---

### `src/modules/empresas/queries.ts` (extend)

**Analog:** itself (full file, lines 1-85, already read in full).

**`EMPRESA_SELECT` pattern to extend** (lines 12-29 — explicit `select`, NEVER include `senhaHash` via the `responsavel` relation):
```typescript
const EMPRESA_SELECT = {
  id: true, nome: true, cnpj: true, regimeTributario: true,
  responsavelId: true, contatos: true, particularidades: true, ativo: true,
  createdAt: true, updatedAt: true,
  responsavel: { select: { id: true, nome: true } },
  // NEW: responsaveisPorSetor: { select: { setor: true, usuario: { select: { id: true, nome: true } } } },
} as const;
```

**`listarEmpresas`/`buscarEmpresaPorId` IDOR-safe pattern — UNCHANGED call syntax** (lines 39-47, 58-66 — these stay `...withVisibilityScope(user)`, no edit needed thanks to the optional `setor` param):
```typescript
export async function listarEmpresas(user: SessionUser) {
  return db.empresa.findMany({
    where: { ...withVisibilityScope(user) },
    orderBy: { nome: "asc" },
    select: EMPRESA_SELECT,
  });
}
```

**`listarResponsaveis` extension target** (lines 76-84 — add optional `setor` filter per SETOR-03, RESEARCH.md Code Examples):
```typescript
export async function listarResponsaveis(setor?: "FISCAL" | "DP" | "CONTABIL") {
  return db.usuario.findMany({
    where: setor ? { setor } : undefined,
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}
```

---

### `src/modules/empresas/schema.ts` (extend)

**Analog:** itself (full file, lines 1-49, already read in full).

**Current single-field pattern to replace** (lines 14-25):
```typescript
export const empresaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().refine(validarCNPJ, "CNPJ inválido"),
  regimeTributario: z.enum(["LUCRO_REAL", "LUCRO_PRESUMIDO", "SIMPLES_NACIONAL"]),
  responsavelId: z.string().min(1, "Responsável é obrigatório"),
  contatos: z.string().optional(),
  particularidades: z.string().optional(),
});
```

**Required replacement shape (RESEARCH.md Pitfall — 3 distinct fields, distinct optionality, D-01/D-02):**
```typescript
export const empresaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().refine(validarCNPJ, "CNPJ inválido"),
  regimeTributario: z.enum(["LUCRO_REAL", "LUCRO_PRESUMIDO", "SIMPLES_NACIONAL"]),
  responsavelFiscalId: z.string().min(1, "Responsável Fiscal é obrigatório"),
  responsavelDpId: z.string().optional().nullable(),
  responsavelContabilId: z.string().optional().nullable(),
  temFuncionariosClt: z.boolean().default(false),
  contatos: z.string().optional(),
  particularidades: z.string().optional(),
});
```
Verify `linhaImportadaSchema` (lines 38-47) is unaffected — CONTEXT.md does not mention touching the import wizard this phase.

---

### `src/app/(app)/actions.ts` (extend `criarEmpresa`/`editarEmpresa`)

**Analog:** itself (full file, lines 1-153, already read in full).

**Current IDOR-safe guard pattern to preserve exactly** (lines 89-109 — `findFirst` scoped BEFORE any write, "não encontrado" never 403):
```typescript
const existente = await db.empresa.findFirst({
  where: { id, ...withVisibilityScope(session.user) },
  select: { id: true },
});
if (!existente) {
  return { ok: false, error: "não encontrado" };
}
```

**`dadosFormulario` extension target** (lines 28-37 — add 3 responsável fields + CLT boolean parse):
```typescript
function dadosFormulario(formData: FormData) {
  return {
    nome: formData.get("nome"),
    cnpj: formData.get("cnpj"),
    regimeTributario: formData.get("regimeTributario"),
    responsavelFiscalId: formData.get("responsavelFiscalId"),
    responsavelDpId: formData.get("responsavelDpId") || null,
    responsavelContabilId: formData.get("responsavelContabilId") || null,
    temFuncionariosClt: formData.get("temFuncionariosClt") === "true",
    contatos: formData.get("contatos"),
    particularidades: formData.get("particularidades"),
  };
}
```

**CRITICAL new guard required (RESEARCH.md Pitfall, D-02) — server-side, NOT just disabled UI:**
```typescript
// Inside criarEmpresa/editarEmpresa, AFTER parsing, BEFORE writing:
if (session.user.role !== "DONO") {
  // strip responsável-field changes silently; keep existing DB values
  delete dados.responsavelFiscalId; // or re-merge with `existente`'s current values
  delete dados.responsavelDpId;
  delete dados.responsavelContabilId;
}
```

**CRITICAL transaction requirement (RESEARCH.md Pitfall — mirrors existing `regimeHistorico.create` nested-write pattern at lines 67-73):** wrap `empresa.update` + up-to-3 `empresaResponsavelSetor.upsert` calls in `db.$transaction([...])` (array form), never as independent sequential calls — partial-write risk otherwise.

---

### `src/app/(app)/empresas/empresa-form.tsx` (extend)

**Analog:** itself (full file, lines 1-237, already read in full) + `StepReview.tsx` (Checkbox + badge pattern, lines 130-224).

**Current single-Select responsável field to replace with a 3-column grid** (lines 165-188 is the field to remove; lines 124-163 is the existing 2-column grid pattern to mirror for the new 3-column grid):
```typescript
<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  {/* existing cnpj + regimeTributario fields, same shape */}
</div>
```

**New 3-column grid per UI-SPEC** (`grid grid-cols-1 gap-4 md:grid-cols-3`, order: Fiscal, DP, Contábil), each `<Select>` following the exact existing `responsavelId` field shape (lines 165-188), with DP/Contábil adding an explicit "Sem responsável" empty `SelectItem`:
```typescript
<SelectContent>
  <SelectItem value="">Sem responsável</SelectItem>
  {responsaveisDp.map((r) => (
    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
  ))}
</SelectContent>
```
Per UI-SPEC: when `session.user.role !== "DONO"`, all 3 Selects render `disabled` — client-side UX only, real enforcement is server-side (see `actions.ts` guard above).

**Checkbox pattern to copy for CLT field** (`StepReview.tsx` lines 152-159 — the only existing `Checkbox` usage in this codebase):
```typescript
<Checkbox
  checked={field.value}
  onCheckedChange={(checked) => field.onChange(checked === true)}
  aria-label="Tem funcionários CLT?"
/>
```
Helper text per UI-SPEC, placed as its own full-width `FormItem` after `particularidades`:
```typescript
<p className="text-xs text-muted-foreground">
  Define se esta empresa recebe automaticamente as obrigações de Folha de
  Pagamento, FGTS, INSS e eSocial (Fase 6).
</p>
```

---

### `src/app/(app)/empresas/empresas-table.tsx` (extend)

**Analog:** itself (full file, lines 1-355, already read in full) + `StepReview.tsx` ("Sem regime" badge/filter precedent, lines 139-144, 191-224).

**"Sem X" computed-blocking pattern to mirror for the filter badge** (`StepReview.tsx` lines 139-144 — same `.some()`/`.filter()` style):
```typescript
const possuiSemResponsavelIncluida = linhasIncluidas.some((l) => !l.responsavelId);
```

**Existing client-side filter `useMemo` to extend** (lines 97-113 — add `semResponsavelFiltro` check alongside existing `regimeFiltro`/`responsavelFiltro`):
```typescript
const dadosFiltrados = useMemo(() => {
  return empresas.filter((empresa) => {
    if (regimeFiltro !== "TODOS" && empresa.regimeTributario !== regimeFiltro) return false;
    // NEW:
    if (semResponsavelFiltro === "DP" && empresa.responsavelDpId !== null) return false;
    if (semResponsavelFiltro === "CONTABIL" && empresa.responsavelContabilId !== null) return false;
    // ...existing termo/busca checks unchanged...
    return true;
  });
}, [empresas, busca, regimeFiltro, responsavelFiltro, semResponsavelFiltro]);
```

**Badge pattern to reuse verbatim for "Sem responsável"** (lines 68-72, `REGIME_BADGE_CLASS` shows the existing amber convention; `StepReview.tsx` line 211 shows the exact "Sem regime" badge JSX to mirror):
```typescript
<Badge className="bg-amber-500 text-white">Sem responsável</Badge>
```

**`isDono`-gated filter control precedent to mirror for the new filter chips** (lines 244-258 — existing `isDono ? <Select>...</Select> : null` pattern):
```typescript
{isDono ? (
  <Select value={responsavelFiltro} onValueChange={setResponsavelFiltro}>
    {/* ... */}
  </Select>
) : null}
```

**Single "Responsável" column to replace with sector-aware logic** (lines 135-139 is the column to remove/branch):
```typescript
{
  id: "responsavel",
  header: "Responsável",
  cell: ({ row }) => row.original.responsavel?.nome ?? "-",
},
```
Per UI-SPEC D-10: DONO renders 3 columns (Fiscal/DP/Contábil) using this same `cell` shape per sector; non-DONO colaborador renders exactly 1 column labeled `Responsável {Setor}` showing ONLY their own sector's data — never render the other 2 sectors' columns even hidden, this is a data-exposure boundary.

**Generic empty state to branch from** (lines 200-218 — DONO/Fiscal colaborador keep this unchanged; D-09's sector-filtered variant is a NEW conditional branch, not a replacement, using the exact same wrapper classes):
```typescript
<div className="flex flex-col items-center gap-4 py-16 text-center">
  <h2 className="text-xl font-semibold">Nenhuma empresa atribuída a você ainda</h2>
  <p className="max-w-md text-sm text-muted-foreground">
    Você ainda não é responsável por nenhuma empresa no setor {setorLabel}.
    Fale com o dono do escritório para receber suas atribuições.
  </p>
</div>
```

---

### `tests/visibility-scope.setor.test.ts` (NEW)

**Analog:** `tests/visibility-scope.test.ts`

**Exact `describe`/`it` structure to mirror** (lines 19-33 of analog):
```typescript
import { describe, it, expect } from "vitest";
import { withVisibilityScope } from "@/lib/visibility-scope";

describe("withVisibilityScope — setor-aware (v2.0)", () => {
  it("COLABORADOR de DP vê empresa SOMENTE via responsaveisPorSetor.some({setor:'DP', usuarioId})", () => {
    const dpUser = { id: "user_dp_1", role: "COLABORADOR" as const, setor: "DP" as const };
    expect(withVisibilityScope(dpUser)).toEqual({
      responsaveisPorSetor: { some: { setor: "DP", usuarioId: "user_dp_1" } },
    });
  });

  it("DONO continua recebendo {} independente de setor", () => {
    expect(withVisibilityScope({ id: "u1", role: "DONO" as const, setor: null })).toEqual({});
  });

  it("COLABORADOR sem setor definido falha SEGURO (nenhuma empresa visível)", () => {
    const result = withVisibilityScope({ id: "ux", role: "COLABORADOR" as const, setor: null });
    expect(result).not.toEqual({}); // must NOT widen
  });
});
```

**Mock-user helper convention to extend** (`tests/setup.ts` lines 29-50 — `mockDonoUser`/`mockColaboradorUser`/`mockOtherColaboradorUser` all need a `setor` field added to their returned shape; new helpers like `mockDpColaboradorUser`/`mockContabilColaboradorUser` should follow the exact same factory shape):
```typescript
export function mockColaboradorUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "user_colaborador_1", nome: "Colaborador 1",
    email: "colaborador1@escritorio.com.br", role: "COLABORADOR",
    setor: "FISCAL", // NEW field
    ...overrides,
  };
}
```

---

### `tests/empresas.idor.test.ts` (extend — D-02 guard)

**Analog:** itself (full file, lines 1-143, already read in full).

**Mock-and-assert pattern to copy for the new DONO-only-field test** (lines 80-99 — same `vi.mock`/`authMock`/`findFirstMock`/`updateMock` setup already in this file, reused for a new `it` block):
```typescript
it("colaborador NÃO consegue alterar responsavelDpId via Server Action direta (D-02)", async () => {
  const { editarEmpresa } = await import("@/app/(app)/actions");
  const colaborador = mockColaboradorUser();
  authMock.mockResolvedValue({ user: colaborador });
  findFirstMock.mockResolvedValue({ id: "empresa_1", responsavelDpId: null });
  updateMock.mockResolvedValue({ id: "empresa_1" });

  const fd = buildFormData();
  fd.set("responsavelDpId", "attacker_chosen_user_id");

  await editarEmpresa("empresa_1", fd);

  // assert the write payload does NOT include the attacker-chosen value
  const updateArg = updateMock.mock.calls[0][0];
  expect(updateArg.data.responsavelDpId).not.toBe("attacker_chosen_user_id");
});
```

## Shared Patterns

### IDOR-safe scoped lookup before mutation
**Source:** `src/app/(app)/actions.ts` lines 89-109 (`editarEmpresa`), `src/modules/empresas/queries.ts` lines 58-66 (`buscarEmpresaPorId`)
**Apply to:** Every new/modified read or write touching `Empresa`/`EmpresaResponsavelSetor` this phase. Always `findFirst({ where: { id, ...withVisibilityScope(user) } })` before update/delete; return `"não encontrado"` (never 403) on `null`.
```typescript
const existente = await db.empresa.findFirst({
  where: { id, ...withVisibilityScope(session.user) },
  select: { id: true },
});
if (!existente) return { ok: false, error: "não encontrado" };
```

### Auth.js v5 dual-module type augmentation (edge-safe split)
**Source:** `src/types/next-auth.d.ts` (full file), `src/auth.config.ts` (edge-safe) vs `src/auth.ts` (Node-only Credentials provider)
**Apply to:** Any session/JWT shape change (`setor` field this phase). Always augment BOTH `next-auth`/`next-auth/jwt` AND `@auth/core/types`/`@auth/core/jwt` — augmenting only the former silently fails to type callback parameters. Never import `@/lib/db`/`bcryptjs` in `auth.config.ts`.

### Explicit `select` — never expose `senhaHash`
**Source:** `src/auth.ts` lines 21-30 (only place `senhaHash` is selected), `src/modules/empresas/queries.ts` lines 12-29 (`EMPRESA_SELECT`)
**Apply to:** Any new query touching `Usuario` (e.g. `listarResponsaveis`, `EmpresaResponsavelSetor`'s nested `usuario` relation) — always explicit `select: { id: true, nome: true }`, never select/spread the whole `Usuario` row.

### Dry-run/--apply one-off migration scripts
**Source:** `scripts/atualizar-responsaveis.mjs` (full file)
**Apply to:** `scripts/backfill-responsavel-setor.mjs` (NEW) and the `setor` backfill for the 4 existing Fiscal colaboradores — default to dry-run (no writes), require `--apply` flag, print a full report before/after, `finally { await db.$disconnect() }`.

### Transactional multi-table writes
**Source:** `src/app/(app)/actions.ts` lines 59-74 (`criarEmpresa`'s nested `regimeHistorico.create` inside `empresa.create`); RESEARCH.md also cites `concluirTarefa`'s `db.$transaction([update, create])` and `executarGeracaoMensal`'s `db.$transaction(async (tx) => {...})` in `src/modules/tarefas/geracao.ts` as further precedent (not re-read this session, cited per RESEARCH.md Common Pitfalls).
**Apply to:** `editarEmpresa`/`criarEmpresa` writing `Empresa.update`/`create` + up to 3 `EmpresaResponsavelSetor.upsert` calls — wrap in `db.$transaction([...])` (array form, or callback form if conditional skip logic is needed).

### "Sem X" filter badge + blocking computation (client-side, already-fetched data)
**Source:** `src/app/(app)/empresas/importar/_components/StepReview.tsx` lines 139-144 (blocking `.some()` check), line 211 (`Badge` JSX), lines 244-258 of `empresas-table.tsx` (`isDono`-gated filter `<Select>`)
**Apply to:** The new "sem responsável DP/Contábil" filter chips and table-cell badges (D-03) — client-side `useMemo`/`.filter()` over already-fetched `empresas` array, `bg-amber-500 text-white` badge class, DONO-only visibility for the filter control.

## No Analog Found

None — every file in this phase's scope has a direct, exact-match analog already in this codebase (either the same file extended in place, or a structurally identical precedent file). This phase introduces no new architectural pattern; RESEARCH.md's own conclusion ("every UI pattern needed already has a direct precedent... no UI novelty") is confirmed by this pattern search.

## Metadata

**Analog search scope:** `prisma/`, `scripts/`, `src/lib/`, `src/types/`, `src/auth.ts`, `src/auth.config.ts`, `src/modules/empresas/`, `src/app/(app)/actions.ts`, `src/app/(app)/empresas/`, `src/app/(app)/empresas/importar/_components/`, `tests/`
**Files scanned:** 13 (all read in full or targeted sections — no file exceeded 2,000 lines, so no offset/limit chunking was required)
**Pattern extraction date:** 2026-06-23
