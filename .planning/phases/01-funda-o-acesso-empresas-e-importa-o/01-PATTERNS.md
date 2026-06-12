# Phase 1: Fundação — Acesso, Empresas e Importação - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 24
**Analogs found:** 0 / 24 (greenfield project — see note below)

## IMPORTANT: Greenfield Project — No Existing Analogs

This repository currently contains **no application source code** — only `.planning/`, `CLAUDE.md`, `.claude/`, and the source spreadsheet `Lista de Empresas com CNPJ.xlsx`. There is no `package.json`, no `src/`, no `components.json`. Confirmed via directory listing.

Because there are zero existing files to compare against, this PATTERNS.md is a **forward-looking "first implementation" reference**, not an analog map. All "patterns" below are extracted verbatim (with line numbers) from `01-RESEARCH.md`'s Code Examples and Pattern sections, plus structure from `01-UI-SPEC.md`. The planner should treat these as the canonical skeletons for Phase 1's first-ever files in each role/category. Once Phase 1 lands, Phase 2+ pattern-mapping will have real analogs (e.g., `modules/empresas/` becomes the analog for `modules/tarefas/`).

**No "Pattern Assignments per analog" section is included** since there is no second file to copy *from* within the codebase — instead, each new file's skeleton is given directly, sourced from RESEARCH.md.

## File Classification

| New File | Role | Data Flow | Source of Pattern (RESEARCH.md) |
|----------|------|-----------|----------------------------------|
| `auth.ts` | config/middleware | request-response | Pattern 1 (lines 214-276) |
| `app/api/auth/[...nextauth]/route.ts` | route | request-response | Pattern 1 (lines 278-283) |
| `middleware.ts` | middleware | request-response | "Proteção de rotas" (lines 670-680) |
| `prisma/schema.prisma` | model/config | CRUD | Pattern 3 (lines 329-391) |
| `prisma/seed.ts` | utility (script) | batch | "Seed dos 5 usuários" (lines 682-710) |
| `lib/db.ts` | utility (singleton) | CRUD | Implied by Pattern 1/2 imports (`@/lib/db`) |
| `lib/visibility-scope.ts` | utility/service | CRUD | Pattern 2 (lines 298-316) |
| `lib/cnpj.ts` | utility | transform | Pattern 4, `lib/cnpj.ts` block (lines 515-538) |
| `lib/excel/parse-empresas.ts` | utility | file-I/O | Pattern 4 (lines 445-512) |
| `scripts/inspect-planilha.mjs` | utility (script) | file-I/O | Pattern 3.5 (lines 395-432), Wave 0 Gaps (line 808) |
| `modules/empresas/schema.ts` | model (Zod) | transform | Implied by Code Example (lines 656-663) + UI-SPEC field list |
| `modules/empresas/queries.ts` | service | CRUD | Pattern 2 usage comment (lines 312-316) |
| `app/login/page.tsx` | component (page) | request-response | UI-SPEC Screen 1 (lines 148-156) |
| `app/(app)/layout.tsx` | component (layout/provider) | request-response | UI-SPEC Screen 2 (lines 158-166) |
| `app/(app)/empresas/page.tsx` | component (page) | CRUD | UI-SPEC Screen 3 (lines 168-178) |
| `app/(app)/empresas/novo/page.tsx` | component (page/form) | CRUD | UI-SPEC Screen 4 (lines 180-196) |
| `app/(app)/empresas/[id]/editar/page.tsx` | component (page/form) | CRUD | UI-SPEC Screen 4 (lines 180-196) |
| `app/(app)/empresas/importar/page.tsx` | component (page, wizard shell) | file-I/O | UI-SPEC Screen 5 (lines 197-217) |
| `app/(app)/empresas/importar/_components/StepUpload.tsx` | component | file-I/O | UI-SPEC Screen 5, Step 1 (lines 200-202) |
| `app/(app)/empresas/importar/_components/StepReview.tsx` | component | event-driven | UI-SPEC Screen 5, Step 2 (lines 204-211) + Pattern 5 (lines 540-571) |
| `app/(app)/empresas/importar/_components/StepConfirm.tsx` | component | request-response | UI-SPEC Screen 5, Step 3 (lines 212-216) |
| `app/(app)/actions.ts` | controller (Server Actions) | CRUD | "Server Action de criação de empresa" (lines 642-668) |
| `vitest.config.ts` | config | — | Validation Architecture (lines 778-783) |
| `tests/visibility-scope.test.ts`, `tests/cnpj.test.ts`, `tests/import.test.ts`, etc. | test | unit/integration | Validation Architecture table (lines 787-797) |

## Pattern Skeletons (Forward Reference for First Implementation)

### `auth.ts` (config, request-response)

**Source:** RESEARCH.md Pattern 1, lines 219-276

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const usuario = await db.usuario.findUnique({
          where: { email: credentials.email as string },
        });
        if (!usuario) return null;

        const senhaValida = await bcrypt.compare(
          credentials.password as string,
          usuario.senhaHash
        );
        if (!senhaValida) return null;

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          role: usuario.role, // 'colaborador' | 'dono'
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

**CRITICAL — Pitfall 2 (no PrismaAdapter):** Do NOT add `adapter: PrismaAdapter(db)`. JWT strategy + `authorize()` querying Prisma directly is correct and sufficient. (RESEARCH.md lines 602-606)

**CRITICAL — security:** never `select` or return `senhaHash` outside `authorize()`. All other `db.usuario` queries must use explicit `select` omitting `senhaHash`. (RESEARCH.md line 393, Security Domain V5/V6)

---

### `app/api/auth/[...nextauth]/route.ts` (route, request-response)

**Source:** RESEARCH.md lines 278-283

```typescript
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

---

### `middleware.ts` (middleware, request-response)

**Source:** RESEARCH.md "Proteção de rotas", lines 671-680

```typescript
export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|login|favicon.ico).*)"],
};
```

**Note:** Next.js 15.5 still uses `middleware.ts` (NOT `proxy.ts` — that's a Next 16 rename, out of scope per CLAUDE.md).

---

### `prisma/schema.prisma` (model, CRUD)

**Source:** RESEARCH.md Pattern 3, lines 333-391 (already updated for the real 3-regime distribution per Pattern 3.5)

```prisma
enum Role {
  COLABORADOR
  DONO
}

enum RegimeTributario {
  LUCRO_REAL
  LUCRO_PRESUMIDO
  SIMPLES_NACIONAL
}

model Usuario {
  id        String   @id @default(cuid())
  nome      String
  email     String   @unique
  senhaHash String
  role      Role     @default(COLABORADOR)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  empresas  Empresa[] @relation("ResponsavelEmpresa")

  @@map("usuarios")
}

model Empresa {
  id               String            @id @default(cuid())
  nome             String
  cnpj             String            @unique
  regimeTributario RegimeTributario
  responsavelId    String
  responsavel      Usuario           @relation("ResponsavelEmpresa", fields: [responsavelId], references: [id])
  contatos         String?
  particularidades String?
  ativo            Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  regimeHistorico  EmpresaRegimeHistorico[]

  @@index([responsavelId])
  @@index([regimeTributario])
  @@map("empresas")
}

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

**IMPORTANT — RegimeTributario has 3 values, not 2** despite Pattern 1's seed comment and some UI-SPEC text mentioning only "Lucro Real / Simples Nacional" — `LUCRO_PRESUMIDO` (50/198 empresas) MUST be included from the first migration (Pattern 3.5, lines 412-420, 426). UI-SPEC empresa form's regime Select (lines 186, 206) must offer all 3 options.

---

### `prisma/seed.ts` (utility/script, batch)

**Source:** RESEARCH.md "Seed dos 5 usuários", lines 683-710

```typescript
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const usuarios = [
    { nome: "Dono do Escritório", email: "dono@escritorio.com.br", role: Role.DONO },
    { nome: "Colaborador 1", email: "colaborador1@escritorio.com.br", role: Role.COLABORADOR },
    { nome: "Colaborador 2", email: "colaborador2@escritorio.com.br", role: Role.COLABORADOR },
    { nome: "Colaborador 3", email: "colaborador3@escritorio.com.br", role: Role.COLABORADOR },
    { nome: "Colaborador 4", email: "colaborador4@escritorio.com.br", role: Role.COLABORADOR },
  ];

  for (const u of usuarios) {
    const senhaHash = await bcrypt.hash("trocar-no-primeiro-login", 10);
    await db.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, senhaHash },
    });
  }
}

main().finally(() => db.$disconnect());
```

**Open Question (RESEARCH.md #2, lines 746-749):** placeholder passwords are acceptable for Phase 1, but real emails/names for the 4 colaboradores should be confirmed before production seed.

---

### `lib/db.ts` (utility, singleton)

**Not given verbatim in RESEARCH.md** — standard Prisma singleton pattern is implied by every `import { db } from "@/lib/db"` (e.g., lines 223, 236, 648, 665). Use the canonical Next.js + Prisma singleton (global-scoped client to avoid exhausting connections in dev hot-reload):

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

---

### `lib/visibility-scope.ts` (service, CRUD)

**Source:** RESEARCH.md Pattern 2, lines 298-316

```typescript
import type { Prisma } from "@prisma/client";

type SessionUser = { id: string; role: "colaborador" | "dono" };

export function withVisibilityScope(
  user: SessionUser
): Prisma.EmpresaWhereInput {
  if (user.role === "dono") {
    return {}; // sem restrição — vê tudo
  }
  return { responsavelId: user.id };
}
```

**CRITICAL — applies to ALL files in `modules/empresas/queries.ts`:**
- Every `findMany`/`findFirst` on `Empresa` MUST spread `withVisibilityScope(session.user)` into its `where`.
- Every mutation (update/delete) that takes an `empresaId` MUST first `findFirst({ where: { id: empresaId, ...withVisibilityScope(session.user) } })` and return 404-equivalent ("não encontrado") if null — never 403 (IDOR mitigation, RESEARCH.md lines 318-320, 596-601).
- Never apply this filter only client-side via `.filter()`/`.map()` (Anti-Pattern, line 575).

---

### `lib/cnpj.ts` (utility, transform)

**Source:** RESEARCH.md Pattern 4, lines 515-538 (module-11 algorithm)

```typescript
export function validarCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false; // todos dígitos iguais

  const calcDigit = (base: string, weights: number[]): number => {
    const sum = base
      .split("")
      .reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(digits.slice(0, 12), weights1);
  const d2 = calcDigit(digits.slice(0, 12) + d1, weights2);

  return digits.endsWith(`${d1}${d2}`);
}
```

**Don't Hand-Roll:** never replace this with a format-only regex — real planilha CNPJs may have typo'd check digits (RESEARCH.md Don't Hand-Roll table, line 587).

---

### `lib/excel/parse-empresas.ts` (utility, file-I/O)

**Source:** RESEARCH.md Pattern 4 + 3.5, lines 445-512 (full, already validated against real spreadsheet structure: 2 blocks A/B/C and E/F/G, section labels for regime, 198 total rows)

```typescript
import * as XLSX from "xlsx"; // instalado via CDN tarball, ver Installation

export type LinhaImportada = {
  nome: string;
  cnpj: string;
  regimeTributario?: "LUCRO_REAL" | "LUCRO_PRESUMIDO" | "SIMPLES_NACIONAL";
};

const LABELS_SECAO = ["LUCRO REAL", "SIMPLES NACIONAL", "LUCRO PRESUMIDO"] as const;
type LabelSecao = (typeof LABELS_SECAO)[number];

const REGIME_POR_LABEL: Record<LabelSecao, LinhaImportada["regimeTributario"]> = {
  "LUCRO REAL": "LUCRO_REAL",
  "SIMPLES NACIONAL": "SIMPLES_NACIONAL",
  "LUCRO PRESUMIDO": "LUCRO_PRESUMIDO",
};

function parseBloco(
  linhas: unknown[][],
  colCod: number,
  colNome: number,
  colCnpj: number
): LinhaImportada[] {
  const resultado: LinhaImportada[] = [];
  let regimeAtual: LinhaImportada["regimeTributario"] = undefined;

  for (const linha of linhas) {
    const nome = String(linha[colNome] ?? "").trim();
    const cnpj = String(linha[colCnpj] ?? "").trim();

    if (LABELS_SECAO.includes(nome as LabelSecao) && !cnpj) {
      regimeAtual = REGIME_POR_LABEL[nome as LabelSecao];
      continue; // linha de label de seção — não é empresa
    }
    if (!nome || !cnpj) continue; // linha vazia entre/antes de seções

    resultado.push({ nome, cnpj, regimeTributario: regimeAtual });
  }
  return resultado;
}

// Bloco 1 = colunas A/B/C, Bloco 2 = colunas E/F/G, ambos a partir da linha 3
export function parseEmpresasXlsx(buffer: Buffer): LinhaImportada[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  const linhasDeDados = matriz.slice(2); // pula linha 1 (labels) e linha 2 (vazia)
  const bloco1 = parseBloco(linhasDeDados, 0, 1, 2); // A/B/C
  const bloco2 = parseBloco(linhasDeDados, 4, 5, 6); // E/F/G

  return [...bloco1, ...bloco2];
}
```

**Expected output:** 198 rows total (61 LUCRO_REAL + 80 SIMPLES_NACIONAL + 50 LUCRO_PRESUMIDO + 7 with `regimeTributario: undefined` for the "Sup. X" rows). `tests/import.test.ts` should assert these exact counts (Pitfall 3, lines 608-613).

**Pitfall 4 invalidated:** do not add any "Simples Nacional likely missing" warning — it's the largest group (lines 614-618). This contradicts an older note in UI-SPEC Screen 5 (line 206) which assumes "likely all Lucro Real" — UI-SPEC text is stale on this point; RESEARCH.md Pattern 3.5 is authoritative. The "Marcar todas como Lucro Real" bulk action (UI-SPEC line 210) should be reconsidered/generalized or removed since all 3 regimes are pre-populated by the parser.

---

### `scripts/inspect-planilha.mjs` (utility/script, file-I/O)

**Source:** RESEARCH.md Pattern 3.5 (lines 395-432) + Wave 0 Gaps (line 808)

No verbatim code given — should be a thin Node script using `XLSX.readFile("Lista de Empresas com CNPJ.xlsx")` + the same `parseBloco`/`parseEmpresasXlsx` logic (or import it from `lib/excel/parse-empresas.ts`), printing counts per regime to validate against the known totals: LUCRO_REAL=61, SIMPLES_NACIONAL=80, LUCRO_PRESUMIDO=50, sem-regime=7, total=198.

---

### `modules/empresas/schema.ts` (model/Zod, transform)

**Not given verbatim** — derive from the `criarEmpresa` Server Action's expected fields (lines 656-663) and UI-SPEC form fields (lines 183-189):

```typescript
import { z } from "zod";
import { validarCNPJ } from "@/lib/cnpj";

export const empresaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().refine(validarCNPJ, "CNPJ inválido"),
  regimeTributario: z.enum(["LUCRO_REAL", "LUCRO_PRESUMIDO", "SIMPLES_NACIONAL"]),
  responsavelId: z.string().min(1, "Responsável é obrigatório"),
  contatos: z.string().optional(),
  particularidades: z.string().optional(),
});

export type EmpresaInput = z.infer<typeof empresaSchema>;

// ImportRow schema for staging — regimeTributario optional until reviewed
export const linhaImportadaSchema = z.object({
  nome: z.string().min(1),
  cnpj: z.string(),
  regimeTributario: z.enum(["LUCRO_REAL", "LUCRO_PRESUMIDO", "SIMPLES_NACIONAL"]).optional(),
  responsavelId: z.string().optional(),
  contatos: z.string().optional(),
  particularidades: z.string().optional(),
});
```

---

### `modules/empresas/queries.ts` (service, CRUD)

**Source:** derived from Pattern 2 usage comment, lines 312-316

```typescript
import { db } from "@/lib/db";
import { withVisibilityScope } from "@/lib/visibility-scope";
import type { SessionUser } from "@/lib/visibility-scope"; // or inline type

export async function listarEmpresas(user: SessionUser, filtros?: { /* ... */ }) {
  return db.empresa.findMany({
    where: { ...withVisibilityScope(user) /*, ...filtrosDeUI */ },
    orderBy: { nome: "asc" },
  });
}

export async function buscarEmpresaPorId(user: SessionUser, id: string) {
  return db.empresa.findFirst({
    where: { id, ...withVisibilityScope(user) },
  });
}
```

All Server Components/Server Actions for `/empresas` must call these functions — never `db.empresa.findMany()` directly (Pitfall 1, lines 596-601).

---

### `app/(app)/actions.ts` (controller/Server Actions, CRUD)

**Source:** RESEARCH.md "Server Action de criação de empresa", lines 645-668

```typescript
"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { empresaSchema } from "@/modules/empresas/schema";
import { revalidatePath } from "next/cache";

export async function criarEmpresa(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");

  const dados = empresaSchema.parse({
    nome: formData.get("nome"),
    cnpj: formData.get("cnpj"),
    regimeTributario: formData.get("regimeTributario"),
    responsavelId: formData.get("responsavelId"),
    contatos: formData.get("contatos"),
    particularidades: formData.get("particularidades"),
  });

  await db.empresa.create({ data: dados });
  revalidatePath("/empresas");
}
```

**For `editarEmpresa`/`excluirEmpresa`:** add the `findFirst` ownership check from `lib/visibility-scope.ts` section above BEFORE any `update`/`delete` (IDOR mitigation). For import confirmation (`confirmarImportacao`), loop `db.empresa.create()` (or `createMany` if no per-row error handling needed) over reviewed/included rows from Step 2.

---

### Import wizard components (`app/(app)/empresas/importar/`)

**Source:** UI-SPEC Screen 5 (lines 197-217) + Pattern 5 editable cell (lines 547-569)

**StepUpload.tsx:** file input, `.xlsx`-only accept, drag-and-drop zone, calls a Server Action that runs `parseEmpresasXlsx()` and returns `LinhaImportada[]` as JSON to client state — staging happens in React state, not DB (Anti-Pattern, line 577).

**StepReview.tsx — editable TanStack Table cell pattern (Pattern 5, lines 550-569):**
```typescript
const defaultColumn: Partial<ColumnDef<LinhaStaged>> = {
  cell: ({ getValue, row: { index }, column: { id }, table }) => {
    const initialValue = getValue();
    const [value, setValue] = useState(initialValue);

    const onBlur = () => {
      table.options.meta?.updateData(index, id, value);
    };

    return (
      <input
        value={value as string}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        className="w-full bg-transparent"
      />
    );
  },
};
```
Regime tributário column uses a shadcn `<Select>` instead of `<input>`, offering all 3 enum values (LUCRO_REAL / LUCRO_PRESUMIDO / SIMPLES_NACIONAL) — not just 2 (correcting UI-SPEC's stale 2-option assumption).

**StepConfirm.tsx:** summary card + "Confirmar importação" button calling a Server Action that persists only included/valid rows via `db.empresa.create()`, with `responsavelId` required per row (Pitfall 5, lines 620-624).

---

## Shared Patterns

### Authentication / Session
**Source:** `auth.ts` (Pattern 1) — apply to: `middleware.ts`, all Server Components under `app/(app)/`, all Server Actions in `app/(app)/actions.ts`.
- Always `const session = await auth(); if (!session?.user) throw new Error("Não autenticado");` at the top of every Server Action.
- JWT strategy, no PrismaAdapter.

### Visibility Scope (AUTH-02)
**Source:** `lib/visibility-scope.ts` (Pattern 2) — apply to: `modules/empresas/queries.ts`, every mutation in `app/(app)/actions.ts` that takes an `empresaId`.
- `withVisibilityScope(session.user)` spread into every `where` clause.
- `findFirst` ownership check before update/delete → return "não encontrado" (not 403) if null.

### Validation
**Source:** `modules/empresas/schema.ts` (Zod) — apply to: `app/(app)/empresas/novo/page.tsx`, `app/(app)/empresas/[id]/editar/page.tsx` (via react-hook-form + `@hookform/resolvers/zod`), and server-side `.parse()` in `app/(app)/actions.ts`.
- CNPJ validated via `validarCNPJ()` (module 11), never regex-only.

### Error Handling / Copy
**Source:** UI-SPEC Copywriting Contract (lines 105-129) — apply to all forms/toasts:
- Login failure: "Email ou senha incorretos."
- Generic save failure (toast): "Não foi possível salvar. Verifique os dados e tente novamente."
- Invalid import file: "Arquivo inválido. Envie um arquivo .xlsx válido."
- Session expired: "Sessão expirada. Faça login novamente." → redirect `/login`.

## No Analog Found

All 24 files — this is a greenfield project with zero pre-existing application code. Use the skeletons above as the canonical first-implementation reference. After Phase 1 ships, `modules/empresas/` becomes the structural analog for future modules (e.g., `modules/tarefas/` in Phase 2/3).

## Metadata

**Analog search scope:** entire repository (`Glob("**/*")` equivalent via `ls`) — confirmed only `.planning/`, `CLAUDE.md`, `.claude/`, `Lista de Empresas com CNPJ.xlsx` exist.
**Files scanned:** 0 source files (none exist)
**Pattern extraction date:** 2026-06-12
