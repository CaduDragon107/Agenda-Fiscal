# Phase 5: Fundação Multi-Setor — Schema, Autorização e Empresas - Research

**Researched:** 2026-06-23
**Domain:** Prisma schema migration (junction table + backfill), sector-aware RBAC extension, Next.js/shadcn form/table UI extension — all grounded in direct reading of this codebase's actual files (not generic advice)
**Confidence:** HIGH

## Summary

This phase has no new technology to evaluate — every library in CLAUDE.md's stack table (Next.js 15.5, Prisma 6.x, Auth.js v5, Zod, React Hook Form, shadcn/ui) is already wired up and working in this codebase. The work is entirely about correctly extending three already-existing, well-understood pieces: `prisma/schema.prisma` (add `Setor` enum, `Usuario.setor`, `EmpresaResponsavelSetor` junction table, keep `Empresa.responsavelId` as deprecated legacy column), `src/lib/visibility-scope.ts` (add an explicit `setor` parameter to `withVisibilityScope`/`withTarefaScope` without changing their existing call-site contract), and the empresa CRUD UI (`empresa-form.tsx`, `empresas-table.tsx`, `src/modules/empresas/queries.ts`/`schema.ts`) to expose 3 responsável selectors plus the CLT checkbox.

The single highest-risk activity in this phase is the backfill: 197 existing `Empresa.responsavelId` values must become exactly 197 `EmpresaResponsavelSetor` rows with `setor = 'FISCAL'`, verified by a count assertion, BEFORE any read path (especially `executarGeracaoMensal`, which reads `Empresa` directly with zero auth scope per its documented design) is repointed to the junction table. This phase explicitly does NOT repoint the generation engine — `gerarTarefasDoMes`/`executarGeracaoMensal` continue reading `Empresa.responsavelId` unchanged in this phase (that repoint belongs to Phase 6 per the roadmap) — but the junction table backfill must still happen now and be verified now, because `withVisibilityScope`/`withTarefaScope` need it to function correctly for DP/Contábil colaboradores from day one of this phase.

**Primary recommendation:** Use a junction table (`EmpresaResponsavelSetor`, unique on `[empresaId, setor]`) — not 3 nullable FK columns — for per-sector responsibility; keep `Empresa.responsavelId` in place untouched as the live source of truth for the Fiscal generation engine until Phase 6 repoints it; extend `withVisibilityScope`/`withTarefaScope` with an explicit `setor` parameter sourced from `Usuario.setor` (never inferred or trusted from client input) while keeping the existing IDOR test suite passing unmodified as a hard regression gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-sector responsável storage (junction table) | Database / Storage | API / Backend (Prisma Client types) | New `EmpresaResponsavelSetor` model; Prisma generates the client types every other tier depends on |
| Backfill of 197 FISCAL rows | Database / Storage | API / Backend (migration script) | One-off script run server-side against Postgres; not a UI concern |
| Sector-aware visibility scoping | API / Backend | — | `withVisibilityScope`/`withTarefaScope` are server-only functions (no `"use client"`), called exclusively from Server Components/Server Actions |
| Session carrying `Usuario.setor` | Frontend Server (SSR) | API / Backend | Auth.js v5 JWT/session callbacks run server-side (`src/auth.config.ts`); `session.user.setor` is read by Server Components to decide which sector's view/columns to render |
| 3 responsável selectors + CLT checkbox UI | Browser / Client | API / Backend (Server Action validation) | `empresa-form.tsx` is a `"use client"` React Hook Form component; Zod validation duplicated server-side in `actions.ts` per existing pattern |
| "Sem responsável" filter badge | Browser / Client | — | Client-side filter state in `empresas-table.tsx`, mirrors existing "Sem regime" pattern — no new backend endpoint needed, filters already-fetched data |
| Placeholder colaborador seeding (7 users) | Database / Storage | API / Backend (seed script) | `prisma/seed.ts` extension; one-off, not part of the runtime request path |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SETOR-01 | Empresa passa a ter 1 responsável por setor, com backfill verificado das 197 empresas para Fiscal | Pattern 1 (junction table schema), Pattern 2 (backfill script + verification query), Pitfall 1 |
| SETOR-02 | Usuário ganha campo Setor; 7 colaboradores placeholder (4 DP + 3 Contábil) | Pattern 3 (Usuario.setor + seed extension), Code Example "Seeding placeholders" |
| SETOR-03 | Seletores de atribuição (responsável de empresa, tarefa avulsa) filtram colaboradores pelo setor relevante | Pattern 4 (`listarResponsaveis(setor?)`), Code Example "Sector-filtered responsável selector" |
| EMPR-03 | Empresa ganha campo "tem funcionários CLT?" (sim/não) | Pattern 1 (schema addition), Code Example "CLT checkbox" |

## Standard Stack

No new libraries are introduced in this phase. All work uses libraries already installed and verified working in this codebase.

### Core (already installed, unchanged)
| Library | Installed Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` / `prisma` | 6.19.3 [VERIFIED: package.json] | Schema migration, junction table, backfill script | Already the project's ORM; Prisma 6.x migration syntax confirmed in CLAUDE.md and this codebase's existing migrations |
| `zod` | 3.25.76 [VERIFIED: package.json] | Extend `empresaSchema` with 3 responsável fields + CLT boolean | Already validates `empresaSchema`/`tarefaSchema` in this codebase |
| `react-hook-form` + `@hookform/resolvers` | 7.78.0 / 5.4.0 [VERIFIED: package.json] | Extend `empresa-form.tsx` with 3 selects + checkbox | Already wired into `EmpresaForm` |
| `next-auth` (Auth.js v5) | 5.0.0-beta.31 [VERIFIED: package.json] | Session/JWT carrying `Usuario.setor` | Already configured in `src/auth.ts`/`src/auth.config.ts`; module augmentation pattern already established in `src/types/next-auth.d.ts` |
| `bcryptjs` | 3.0.3 [VERIFIED: package.json] | Hash placeholder passwords for 7 new users | Already used in `prisma/seed.ts:16` |
| `@tanstack/react-table` | 8.21.3 [VERIFIED: package.json] | Add "sem responsável" filter + sector-filtered columns to `empresas-table.tsx` | Already powers `EmpresasTable` |
| `vitest` | 4.1.8 [VERIFIED: package.json] | New multi-sector IDOR fixtures + regression run of existing suite | Already the test runner (`tests/*.test.ts`, `vitest.config.ts`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Junction table (`EmpresaResponsavelSetor`) | 3 nullable FK columns on `Empresa` (`responsavelFiscalId`/`responsavelDpId`/`responsavelContabilId`) | Already rejected in ARCHITECTURE.md Pattern 1 — junction table wins because it matches this codebase's existing convention (`EmpresaRegimeHistorico`, `@@unique` compound constraints) and doesn't require a 4th `ALTER TABLE` if a sector is ever added. This phase's CONTEXT.md leaves exact field/index naming to discretion but the junction-table SHAPE itself is locked by ARCHITECTURE.md, not open for re-debate. |
| `prisma db push` for this migration | `prisma migrate dev` | This codebase has used `npx prisma db push` consistently since Phase 2 ("ambiente Neon sem shadow database" — STATE.md Phase 02-01 decision). Continue this established pattern; do not introduce `migrate dev` now. |

**Installation:** No new packages to install — this phase only requires `npx prisma db push` (or generate a migration if the team has since adopted `migrate dev`; STATE.md indicates `db push` is the established pattern for this Neon environment) after editing `schema.prisma`, plus `npx prisma generate` to regenerate the client.

**Version verification:** `package.json` confirms `@prisma/client`/`prisma` at `^6.19.3` and `next-auth` at `^5.0.0-beta.31` — both already pinned and in active use; no registry check needed since no new package is added.

## Package Legitimacy Audit

**No external packages are installed in this phase.** All work extends existing dependencies already present in `package.json` and already running in production. Package Legitimacy Gate is not applicable — skipping per the "Required whenever this phase installs external packages" condition.

## Architecture Patterns

### System Architecture Diagram

```
[DONO edits empresa via /empresas/[id]/editar]
        |
        v
[empresa-form.tsx ("use client")]
  - 3 Select fields: Responsável Fiscal / DP / Contábil
  - Checkbox: "Tem funcionários CLT?"
  - zodResolver(empresaSchemaV2) client-side validation
        |
        v  (FormData with 3 responsavel*Id fields + temFuncionariosClt)
[editarEmpresa(id, formData) Server Action — actions.ts]
        |
        +--> auth() session guard --> 401 if absent
        |
        +--> db.empresa.findFirst({ where: { id, ...withVisibilityScope(user, user.setor) } })
        |        |
        |        +--> null? --> { ok: false, error: "não encontrado" }  [IDOR-safe, unchanged contract]
        |
        +--> only DONO may change the 3 responsavel*Id fields (D-02) --> validated server-side, not just UI-hidden
        |
        +--> db.$transaction([
        |       empresa.update({ ativo, temFuncionariosClt, ... }),
        |       empresaResponsavelSetor.upsert({ FISCAL, ... }),
        |       empresaResponsavelSetor.upsert({ DP, ... }),
        |       empresaResponsavelSetor.upsert({ CONTABIL, ... }),
        |     ])
        |
        v
[revalidatePath("/empresas")]

---

[Colaborador DP logs in]
        |
        v
[auth.config.ts jwt/session callbacks] --> session.user.setor = "DP" (from Usuario.setor at login time)
        |
        v
[/empresas page.tsx (Server Component)]
        |
        +--> listarEmpresas(session.user)  // withVisibilityScope(user, user.setor) applied inside
        |        |
        |        +--> DONO: {} (sees all 3 sector columns)
        |        +--> COLABORADOR + setor=DP: { responsaveisPorSetor: { some: { setor: "DP", usuarioId: user.id } } }
        |
        v
[EmpresasTable] renders ONLY the "Responsável DP" column for this user (D-10);
  empty-state message branches on user.setor when list is empty (D-09)
```

### Recommended Project Structure (files touched/added in this phase)
```
prisma/
└── schema.prisma                # Setor enum, Usuario.setor, EmpresaResponsavelSetor model,
                                  #   Empresa.temFuncionariosClt, Empresa.responsavelId UNCHANGED
prisma/
└── seed.ts                      # extended: 7 placeholder users with setor + same bcrypt pattern
scripts/
└── backfill-responsavel-setor.mjs   # NEW one-off: 197 Empresa.responsavelId -> 197 FISCAL junction rows
                                      #   (mirrors scripts/atualizar-responsaveis.mjs dry-run/--apply convention)
src/
├── lib/
│   └── visibility-scope.ts      # MODIFIED: withVisibilityScope(user, setor?), withTarefaScope(user, setor?)
│                                 #   optional param preserves existing call-site compatibility
├── types/
│   └── next-auth.d.ts           # MODIFIED: add setor?: Setor to Session.user / User / JWT
├── modules/
│   └── empresas/
│       ├── queries.ts           # MODIFIED: EMPRESA_SELECT includes responsaveisPorSetor relation;
│       │                        #   listarResponsaveis(setor?) gains optional filter
│       └── schema.ts            # MODIFIED: empresaSchema gains responsavelFiscalId/DpId/ContabilId
│                                 #   (or equivalent field names) + temFuncionariosClt boolean
└── app/(app)/
    ├── actions.ts                # MODIFIED: criarEmpresa/editarEmpresa write to junction table,
    │                              #   DONO-only guard on responsavel* fields (D-02)
    └── empresas/
        ├── empresa-form.tsx      # MODIFIED: 3 responsável Selects + CLT Checkbox
        └── empresas-table.tsx    # MODIFIED: "sem responsável" filter badge (D-03),
                                   #   sector-filtered column visibility (D-10)
tests/
├── visibility-scope.test.ts      # UNCHANGED — must still pass as regression gate
├── empresas.idor.test.ts         # UNCHANGED — must still pass as regression gate
├── tarefas.idor.test.ts          # UNCHANGED — must still pass as regression gate
└── visibility-scope.setor.test.ts  # NEW — multi-sector fixtures (3 sectors x shared empresa x
                                      #   different responsável per sector)
```

### Pattern 1: Junction table schema with deprecated legacy column kept in place

**What:** Add `Setor` enum, `Usuario.setor`, `EmpresaResponsavelSetor` junction model (unique on `[empresaId, setor]`), and `Empresa.temFuncionariosClt`. Do NOT remove `Empresa.responsavelId` — it stays exactly as-is, untouched, because `gerarTarefasDoMes`/`executarGeracaoMensal` (Phase 6's responsibility) still read it directly and this phase must not break Fiscal task generation.

**When to use:** This exact migration, this exact phase.

**Example:**
```prisma
// Source: ARCHITECTURE.md Pattern 1, adapted to this schema's existing conventions
// (cuid() ids, @@map snake_case, @updatedAt on every model with createdAt)

enum Setor {
  FISCAL
  DP
  CONTABIL
}

model Usuario {
  id        String   @id @default(cuid())
  nome      String
  email     String   @unique
  senhaHash String
  role      Role     @default(COLABORADOR)
  setor     Setor?   // null for DONO (cross-sector); required for COLABORADOR
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  empresas  Empresa[] @relation("ResponsavelEmpresa") // KEEP — legacy relation, Phase 6 removes

  responsaveisPorSetor EmpresaResponsavelSetor[]       // NEW

  tarefasResponsavel  Tarefa[]          @relation("ResponsavelTarefa")
  tarefasConcluidas   TarefaHistorico[] @relation("ConcluiuTarefa")
  desempenhoMensal    DesempenhoMensal[]

  @@map("usuarios")
}

model Empresa {
  id                  String            @id @default(cuid())
  nome                String
  cnpj                String            @unique
  regimeTributario    RegimeTributario
  responsavelId       String            // KEEP UNCHANGED — Fiscal generation engine still reads this
  responsavel         Usuario           @relation("ResponsavelEmpresa", fields: [responsavelId], references: [id])
  temFuncionariosClt  Boolean           @default(false)  // NEW — EMPR-03, D-04 default false
  contatos            String?
  particularidades    String?
  ativo               Boolean           @default(true)
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  regimeHistorico       EmpresaRegimeHistorico[]
  tarefas               Tarefa[]
  responsaveisPorSetor  EmpresaResponsavelSetor[]  // NEW

  @@index([responsavelId])
  @@index([regimeTributario])
  @@map("empresas")
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

**Migration/db push sequencing (concrete, for this Neon-no-shadow-db environment):**
1. Edit `schema.prisma` as above (additive only — no column drops, no renames).
2. `npx prisma db push` (continuing the established pattern from Phase 02-01/03-01: "ambiente Neon sem shadow database" — `migrate dev` is not used in this project).
3. `npx prisma generate` to regenerate the client (CI/dev already runs this via `postinstall`, but run manually during local dev to get types immediately).
4. Run the backfill script (Pattern 2) — count assertion must pass before continuing.
5. Run the full existing test suite (`npm test`) — must stay green with zero modifications to existing IDOR/visibility test files.

### Pattern 2: Backfill script with verification query, mirroring the existing `atualizar-responsaveis.mjs` dry-run/--apply convention

**What:** A one-off Node script that reads all `Empresa` rows, inserts one `EmpresaResponsavelSetor` row per company with `setor: 'FISCAL'`, `usuarioId: empresa.responsavelId`, then asserts the count.

**When to use:** Once, immediately after the schema migration lands, before any other phase-5 code (UI, scope changes) is considered complete.

**Example:**
```javascript
// Source: this project's own scripts/atualizar-responsaveis.mjs convention
// (dry-run by default, --apply flag required to write; idempotent via upsert)
// scripts/backfill-responsavel-setor.mjs

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const db = new PrismaClient();

async function main() {
  const empresas = await db.empresa.findMany({
    select: { id: true, responsavelId: true },
  });

  console.log(`Modo: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`Empresas encontradas: ${empresas.length}`); // expect 197

  if (!APPLY) {
    console.log("DRY-RUN: nenhuma escrita. Rode com --apply para aplicar.");
    return;
  }

  let criadas = 0;
  for (const empresa of empresas) {
    await db.empresaResponsavelSetor.upsert({
      where: { empresaId_setor: { empresaId: empresa.id, setor: "FISCAL" } },
      update: { usuarioId: empresa.responsavelId },
      create: {
        empresaId: empresa.id,
        setor: "FISCAL",
        usuarioId: empresa.responsavelId,
      },
    });
    criadas++;
  }

  // VERIFICATION QUERY — must equal empresas.length (197) before phase is done
  const totalFiscal = await db.empresaResponsavelSetor.count({
    where: { setor: "FISCAL" },
  });
  console.log(`Linhas FISCAL no junction table: ${totalFiscal}`);
  console.log(`Empresas processadas: ${criadas}`);

  if (totalFiscal !== empresas.length) {
    console.error(
      `FALHA DE VERIFICAÇÃO: esperado ${empresas.length} linhas FISCAL, encontrado ${totalFiscal}`
    );
    process.exitCode = 1;
  }
}

main().finally(() => db.$disconnect());
```

**Cross-check query** (run manually in Prisma Studio or a one-liner) before considering the backfill verified:
```sql
-- Source: PITFALLS.md Pitfall B1 recovery strategy — compares old column to new table
SELECT e.id, e."responsavelId", j."usuarioId"
FROM empresas e
LEFT JOIN empresa_responsavel_setor j
  ON j."empresaId" = e.id AND j.setor = 'FISCAL'
WHERE e."responsavelId" IS DISTINCT FROM j."usuarioId";
-- Must return ZERO rows.
```

### Pattern 3: `Usuario.setor` flowing through NextAuth v5 session/JWT (edge-runtime-safe)

**What:** This codebase has a documented split: `src/auth.config.ts` is edge-safe (no Prisma/bcrypt imports, used by middleware), `src/auth.ts` extends it with the Credentials provider (Node-only). Type augmentation lives in `src/types/next-auth.d.ts` and explicitly augments `@auth/core/types`/`@auth/core/jwt` directly (not just `next-auth`/`next-auth/jwt`) — per the STATE.md note: "next-auth's entrypoints re-export types via `export *`, augmenting the underlying `@auth/core/...` modules directly so the merge applies to interfaces actually used in callback parameter types." Follow this exact same pattern for `setor`.

**When to use:** Adding `setor` to the session/JWT, this phase.

**Example:**
```typescript
// src/types/next-auth.d.ts — ADD setor alongside existing id/role augmentation
// Source: this project's existing pattern, lines 1-49 (read directly)
import type { DefaultSession } from "next-auth";

export type AppRole = "COLABORADOR" | "DONO";
export type AppSetor = "FISCAL" | "DP" | "CONTABIL"; // mirrors Prisma Setor enum

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      setor: AppSetor | null; // null for DONO
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    role: AppRole;
    setor: AppSetor | null;
  }
}

declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      setor: AppSetor | null;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    role: AppRole;
    setor: AppSetor | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    setor: AppSetor | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    setor: AppSetor | null;
  }
}
```

```typescript
// src/auth.ts — authorize() must select+return setor too (mirrors existing role pattern)
const usuario = await db.usuario.findUnique({
  where: { email: credentials.email as string },
  select: { id: true, nome: true, email: true, role: true, setor: true, senhaHash: true },
});
// ...
return {
  id: usuario.id,
  name: usuario.nome,
  email: usuario.email,
  role: usuario.role,
  setor: usuario.setor,
};
```

```typescript
// src/auth.config.ts — jwt/session callbacks, mirrors existing id/role assignment exactly
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

**Why this matters:** `withVisibilityScope`/`withTarefaScope` must source `setor` from `Usuario.setor` (via the session, set server-side at login) — never from a client-supplied parameter — per CONTEXT.md's Claude's Discretion note and PITFALLS.md Pitfall B3's explicit warning against trusting unvalidated sector input.

### Pattern 4: `withVisibilityScope`/`withTarefaScope` gaining an explicit `setor` parameter, preserving existing call-site compatibility

**What:** Per CONTEXT.md's locked discretion guidance and ARCHITECTURE.md Anti-Pattern 2 ("don't fork into 3 sector-specific copies"), extend the SAME two functions with an optional `setor` argument. DONO still gets `{}` regardless of setor. COLABORADOR's where-clause changes from a flat `responsavelId` check to a junction-table relation filter, scoped by BOTH `setor` AND `usuarioId` together (never just one) — this is the exact narrowing/widening bug PITFALLS.md Pitfall B3 calls out.

**When to use:** This phase, before any new sector-aware query is written.

**Example:**
```typescript
// src/lib/visibility-scope.ts — MODIFIED
// Source: this project's existing file (read directly), extended per
// ARCHITECTURE.md Pattern 1 + Anti-Pattern 2 and PITFALLS.md Pitfall B3

import type { Prisma } from "@prisma/client";

export type SessionUser = {
  id: string;
  role: "COLABORADOR" | "DONO";
  setor: "FISCAL" | "DP" | "CONTABIL" | null;
};

/**
 * withVisibilityScope agora aceita um setor explícito (segundo argumento OU
 * lido de user.setor internamente — NUNCA de input de cliente não validado).
 *
 * - DONO: {} sempre, independente de setor (visão geral mantida).
 * - COLABORADOR: filtra por responsaveisPorSetor relacional, exigindo AMBOS
 *   setor E usuarioId na MESMA condição "some" — nunca dois filtros
 *   separados, que permitiriam ver todas as empresas do setor (widening bug).
 *
 * Assinatura aceita `setor` como segundo parâmetro explícito para deixar
 * claro, no call-site, qual visão de setor está sendo pedida — DONO
 * navegando para /dashboards/dp ainda usa user.role==="DONO" (retorna {}),
 * mas um COLABORADOR precisa do seu PRÓPRIO setor (user.setor), nunca de um
 * setor arbitrário vindo de query string/formulário.
 */
export function withVisibilityScope(
  user: SessionUser,
  setor: SessionUser["setor"] = user.setor
): Prisma.EmpresaWhereInput {
  if (user.role === "DONO") {
    return {};
  }
  if (!setor) {
    // COLABORADOR sem setor definido nunca deveria existir, mas falha
    // SEGURO (nenhuma empresa visível) em vez de lançar ou retornar {}.
    return { id: "__no_setor_defined__" };
  }
  return {
    responsaveisPorSetor: {
      some: { setor, usuarioId: user.id },
    },
  };
}

export function withTarefaScope(
  user: SessionUser,
  setor: SessionUser["setor"] = user.setor
): Prisma.TarefaWhereInput {
  if (user.role === "DONO") {
    return {};
  }
  // Tarefa scope stays flat responsavelId — a tarefa's responsável is
  // unambiguous per row (PITFALLS.md B3: "the real risk is at the Empresa
  // level"); Tarefa.setor column doesn't exist yet (Phase 6/7 territory),
  // so this phase keeps withTarefaScope's existing single-column check.
  return { responsavelId: user.id };
}
```

**Critical compatibility note:** Existing call sites that do `...withVisibilityScope(session.user)` (no second argument) continue to compile and behave correctly — the default parameter `setor = user.setor` makes the param optional, satisfying ARCHITECTURE.md's "existing call-site contract... still work since `setor` is optional" requirement. This is why every call in `actions.ts`/`empresas/queries.ts` does NOT need to change its call syntax in this phase, only the function's internals and the `SessionUser` type need to change (and `SessionUser` must gain `setor` — done in Pattern 3).

**Existing call sites that need re-grounding (read directly in this session) — verify behavior after the change, not necessarily edit syntax:**
- `src/modules/empresas/queries.ts:42` (`listarEmpresas`) — `...withVisibilityScope(user)`
- `src/modules/empresas/queries.ts:62` (`buscarEmpresaPorId`) — `...withVisibilityScope(user)`
- `src/app/(app)/actions.ts:99` (`editarEmpresa`) — `...withVisibilityScope(session.user)`
- `src/app/(app)/actions.ts:142` (`excluirEmpresa`) — `...withVisibilityScope(session.user)`
- `src/app/(app)/tarefas/actions.ts:77` (`criarTarefa`, empresa ownership guard) — `...withVisibilityScope(session.user)`

### Pattern 5: Placeholder colaborador seeding, extending `prisma/seed.ts`'s exact bcrypt pattern

**What:** Add 7 new `Usuario` rows (DP1–DP4, Contabil1–Contabil3) with `setor` set, reusing the literal password string and bcrypt cost factor already in `prisma/seed.ts:16`.

**When to use:** This phase, alongside the schema migration (D-06/D-07/D-08 from CONTEXT.md).

**Example:**
```typescript
// prisma/seed.ts — MODIFIED, extending the existing array + loop unchanged
// Source: this project's actual prisma/seed.ts (read directly, lines 1-25)
import { PrismaClient, Role, Setor } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const usuarios = [
    { nome: "Dono do Escritório", email: "dono@escritorio.com.br", role: Role.DONO, setor: null },
    { nome: "Colaborador 1", email: "colaborador1@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.FISCAL },
    { nome: "Colaborador 2", email: "colaborador2@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.FISCAL },
    { nome: "Colaborador 3", email: "colaborador3@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.FISCAL },
    { nome: "Colaborador 4", email: "colaborador4@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.FISCAL },
    // NOVO (D-06/D-07/D-08): 7 placeholders DP/Contábil, mesma senha padrão
    { nome: "DP1", email: "dp1@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.DP },
    { nome: "DP2", email: "dp2@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.DP },
    { nome: "DP3", email: "dp3@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.DP },
    { nome: "DP4", email: "dp4@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.DP },
    { nome: "Contabil1", email: "contabil1@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.CONTABIL },
    { nome: "Contabil2", email: "contabil2@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.CONTABIL },
    { nome: "Contabil3", email: "contabil3@escritorio.com.br", role: Role.COLABORADOR, setor: Setor.CONTABIL },
  ];

  for (const u of usuarios) {
    const senhaHash = await bcrypt.hash("trocar-no-primeiro-login", 10); // UNCHANGED literal (D-08)
    await db.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, senhaHash },
    });
  }
}

main().finally(() => db.$disconnect());
```

**IMPORTANT:** Existing 4 Fiscal colaboradores (Caio/Jessica/Heitor/Felipe in production, still `colaborador1-4@escritorio.com.br` emails per `scripts/atualizar-responsaveis.mjs`) need `setor: 'FISCAL'` backfilled onto their existing `Usuario` rows too — they predate the `setor` column and will be `NULL` after `db push` unless a small follow-up update statement sets `setor = 'FISCAL'` for the 4 existing colaborador emails. This is a SEPARATE backfill from the empresa junction table backfill (Pattern 2) — do not conflate the two. Running `prisma/seed.ts`'s `upsert` with `update: {}` will NOT retroactively set `setor` on existing rows (the `update: {}` object is empty by design, to avoid clobbering already-renamed `nome` values) — a dedicated `UPDATE usuarios SET setor = 'FISCAL' WHERE email IN (...)` (or a Prisma `updateMany`) is required for the 4 existing Fiscal users.

### Anti-Patterns to Avoid

- **Forking `withVisibilityScope` into 3 sector-specific functions:** Already covered exhaustively in ARCHITECTURE.md Anti-Pattern 2 — keep ONE function, add the optional `setor` param.
- **Inferring `setor` from `Empresa.regimeTributario` or any other indirect signal:** `setor` on `Usuario` and the junction table must be explicit stored facts, never derived — mirrors ARCHITECTURE.md Anti-Pattern 1's general principle applied to this phase's narrower scope.
- **Letting the empresa edit form silently update only `Empresa.responsavelId` while implying it updates "the" responsável:** PITFALLS.md's UX Pitfalls (v2.0) table flags this exact risk — the 3-selector UI and the junction-table write MUST land in the same phase/commit, never split (this phase explicitly owns both per CONTEXT.md's `<code_context>` Integration Points section).
- **Trusting a `setor` value submitted via form/query string for scoping decisions:** Always read `user.setor` from the authenticated session, never from request input — this is the load-bearing security property of Pattern 4.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enforcing "exactly one responsável per sector per empresa" | A manual uniqueness check before insert/update | Prisma `@@unique([empresaId, setor])` constraint + `upsert` | Database-level constraint matches this codebase's established idempotency convention (`Tarefa`'s `@@unique([empresaId, tipoObrigacao, competencia])`); application-level pre-checks are explicitly documented elsewhere in this codebase as a deliberately-avoided TOCTOU anti-pattern |
| Hashing the 7 placeholder passwords | A new hashing utility or convention | `bcryptjs.hash(..., 10)`, copy-pasted exactly from `prisma/seed.ts:16` | D-08 explicitly mandates reusing the existing literal string and cost factor — no new convention needed or wanted |
| Detecting "empresa sem responsável de DP/Contábil" for the filter badge | A new backend aggregation endpoint | Client-side filter over the already-fetched `responsaveisPorSetor` relation (same pattern as the existing "Sem regime" filter in `StepReview.tsx`, which filters already-staged in-memory rows) | At 197 rows total, client-side filtering of an already-fetched list is correct and consistent with how this codebase already solves the structurally identical "Sem regime" problem |

**Key insight:** This phase's entire risk surface is migration correctness and authorization correctness, not UI novelty or library selection — every UI pattern needed already has a direct precedent somewhere in this codebase (regime select → responsável select, "Sem regime" badge → "sem responsável" badge, existing checkbox patterns in shadcn `Form` components).

## Runtime State Inventory

> Required for this phase — it is a schema/data migration phase (`Empresa.responsavelId` → `EmpresaResponsavelSetor`), not a pure rename, but the same "what runtime state still has the old shape" discipline applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 197 `Empresa` rows in production Neon Postgres, each with a single `responsavelId` FK value pointing to one of the 4 existing Fiscal `Usuario` rows (Caio/Jessica/Heitor/Felipe per `scripts/atualizar-responsaveis.mjs` rename history) — confirmed live via `src/modules/tarefas/geracao.ts:69` reading `tx.empresa.findMany` directly | Data migration (backfill script, Pattern 2) — code edit alone is insufficient; existing 197 rows must be translated into junction rows |
| Stored data | 4 existing `Usuario` rows (the renamed Fiscal colaboradores) predate the `setor` column and will be `NULL` after `db push` | Data migration — dedicated `UPDATE`/`updateMany` setting `setor = 'FISCAL'` for these 4 emails (cannot rely on `seed.ts`'s `upsert update: {}`, see Pattern 5) |
| Live service config | None found — no n8n/Datadog/Tailscale/Cloudflare equivalents in this project; deployment is a single Next.js process on Railway/Vercel per CLAUDE.md hosting patterns, with config living in env vars (tracked separately below) | None |
| OS-registered state | None found — `node-cron` registration happens inside `instrumentation.ts` at process boot (in-code, not OS-level Task Scheduler/pm2/systemd); confirmed by STATE.md Phase 03-01/03-02 notes describing `instrumentation.ts` as the boot hook location | None |
| Secrets/env vars | None of this phase's changes touch `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, or any other env var — purely additive schema/code changes | None |
| Build artifacts | `prisma/seed.ts` and `scripts/*.mjs` are run manually via `node`/`tsx`, not bundled into the Next.js build — no stale `.egg-info`-equivalent artifact risk in this Node/Prisma stack | None — but regenerate Prisma Client (`npx prisma generate`) after the schema edit, or TypeScript will not see the new `Setor` enum/`EmpresaResponsavelSetor` model types |

**Nothing found in "Live service config" and "OS-registered state" categories** — verified by reading `instrumentation.ts`'s boot-hook pattern and confirming this project has no external workflow/dashboard/ACL services beyond the Postgres database and the Next.js process itself.

## Common Pitfalls

> The two biggest risks of this phase (junction-table backfill correctness, sector-aware RBAC without IDOR regression) are already fully documented in `.planning/research/PITFALLS.md` Pitfall B1 and B3 — read those directly; they are the canonical source and are not re-derived here. The pitfalls below are implementation-level gaps specific to executing THIS phase that are NOT already covered by B1/B3.

### Pitfall: `update: {}` in `seed.ts`'s upsert silently fails to backfill `setor` onto the 4 existing Fiscal colaboradores

**What goes wrong:** Running the extended `prisma/seed.ts` (Pattern 5) against the production database does NOT set `setor = 'FISCAL'` on the 4 existing renamed colaboradores (Caio/Jessica/Heitor/Felipe), because `upsert`'s `update: {}` object is deliberately empty (to avoid clobbering the already-applied name rename from `scripts/atualizar-responsaveis.mjs`). Their `setor` column stays `NULL` after migration. The moment `withVisibilityScope` is extended to require `setor` for COLABORADOR (Pattern 4), these 4 real Fiscal users would fail the "COLABORADOR sem setor" safe-failure branch and see ZERO empresas — a production-breaking regression for the team that is actively using the system today.

**Why it happens:** The seed script's `upsert` pattern was designed for idempotent re-running without clobbering manual edits (a deliberate, correct design for names) — but a brand-new required-for-RBAC column doesn't get that same "preserve existing value" treatment for free; it needs an explicit one-time backfill statement, easily missed because "I extended the seed file" feels like it should cover new users AND existing ones.

**How to avoid:** Add a dedicated one-line backfill (`UPDATE usuarios SET setor = 'FISCAL' WHERE email IN ('colaborador1@escritorio.com.br', ...)` or Prisma `updateMany({ where: { email: { in: [...] } }, data: { setor: 'FISCAL' } })`) as an explicit step in the same migration sequence as Pattern 2's empresa backfill — run it, then verify with `db.usuario.count({ where: { role: 'COLABORADOR', setor: null } })` returning `0` before considering Phase 5 done.

**Warning signs:** Any existing Fiscal colaborador reports an empty empresa list immediately after this phase deploys — this is the single most likely "looks done but isn't" failure mode for this exact phase, more likely in practice than the headline backfill (Pattern 2) because it's easy to forget the OLD users while focused on the NEW junction table.

### Pitfall: Zod schema for the empresa form needs 3 separate optional/required fields, not a single `responsavelId` reused 3 times

**What goes wrong:** A naive extension keeps `empresaSchema`'s single `responsavelId: z.string().min(1, ...)` and tries to "reuse" it three times via `.extend()` or array mapping — Zod field names must be distinct (`responsavelFiscalId`, `responsavelDpId`, `responsavelContabilId`, or similar), and crucially DP/Contábil responsável fields must be OPTIONAL (`z.string().optional()` or `.nullable()`) because D-01 mandates they start `null` for all 197 companies, while `responsavelFiscalId` stays required (mirrors today's required `responsavelId`).

**How to avoid:** Write the new schema as three explicitly different fields with different optionality, matching D-01/D-02 exactly:
```typescript
export const empresaSchema = z.object({
  // ...existing fields unchanged...
  responsavelFiscalId: z.string().min(1, "Responsável Fiscal é obrigatório"),
  responsavelDpId: z.string().optional().nullable(),
  responsavelContabilId: z.string().optional().nullable(),
  temFuncionariosClt: z.boolean().default(false),
});
```
Also update `linhaImportadaSchema` only if the import wizard needs touching — CONTEXT.md/PROJECT.md do not mention re-running the import wizard in this phase, so this is likely unaffected, but verify no current import flow assumes a single `responsavelId` field shape that would break silently.

**Warning signs:** TypeScript compiles fine but the DONO-only edit guard (D-02) is bypassable because a colaborador's form submission for `responsavelDpId`/`responsavelContabilId` isn't separately gated from the existing `responsavelFiscalId` gate.

### Pitfall: DONO-only edit guard (D-02) must be a server-side check, not just a hidden/disabled UI control

**What goes wrong:** CONTEXT.md D-02 states only DONO may edit the 3 responsável selectors. The fastest implementation disables the `<Select>` components in `empresa-form.tsx` when `session.user.role !== "DONO"` — but per this codebase's own established anti-IDOR convention (`T-01-IDOR-MUT` comments throughout `actions.ts`), a disabled client-side control is not a security boundary. A COLABORADOR could still submit a `FormData` with `responsavelFiscalId`/`responsavelDpId`/`responsavelContabilId` set to attacker-chosen values via a direct Server Action call (exactly the attack vector `tests/empresas.idor.test.ts` already exercises for the existing single-responsável field).

**How to avoid:** In `criarEmpresa`/`editarEmpresa` (`actions.ts`), explicitly check `session.user.role === "DONO"` before accepting changes to any of the 3 responsável fields — e.g., if `session.user.role !== "DONO"`, silently ignore/strip those fields from the parsed payload (keep existing DB values) rather than rejecting the whole request, since a COLABORADOR may legitimately still edit `nome`/`contatos`/`temFuncionariosClt` on an empresa within their visibility scope. Add a new test mirroring `tests/empresas.idor.test.ts`'s existing structure: "COLABORADOR submits a different responsavelDpId via direct Server Action call — value is ignored, not applied."

**Warning signs:** No test exists asserting a non-DONO user's attempt to change `responsavelDpId`/`responsavelContabilId`/`responsavelFiscalId` is rejected or ignored at the Server Action level — if planning doesn't include this as an explicit test task, it's the kind of gap that "looks done" (form disables the field) while remaining exploitable via direct API call.

### Pitfall: `EmpresaResponsavelSetor` upsert needs a transaction with `Empresa.update`, not two independent writes

**What goes wrong:** `criarEmpresa`/`editarEmpresa` currently do a single `db.empresa.create`/`update` call. Adding 3 separate `db.empresaResponsavelSetor.upsert` calls AFTER the empresa write, as independent un-transacted statements, risks a partial-write state if one upsert fails (e.g., a constraint violation) after the empresa row itself already changed — leaving `temFuncionariosClt` updated but `responsavelDpId` not yet reflected in the junction table, or vice versa.

**How to avoid:** Wrap the empresa update and the (up to 3) junction-table upserts in a single `db.$transaction([...])` array, mirroring this codebase's existing transaction pattern already used elsewhere (`concluirTarefa`'s `db.$transaction([update, create])` per STATE.md Phase 02-02 decision, and `executarGeracaoMensal`'s `db.$transaction(async (tx) => {...})` pattern in `geracao.ts`). Use the array form (not the interactive callback form) unless conditional upsert logic (e.g., skip DP upsert if `responsavelDpId` is null) requires the callback form — in which case use `db.$transaction(async (tx) => {...})` exactly like `executarGeracaoMensal` already does.

**Warning signs:** Any test or manual QA step where editing only the CLT checkbox (leaving responsável fields unchanged) accidentally clears or duplicates a junction-table row, or where a DP responsável assignment "sometimes doesn't save" under concurrent edits.

## Code Examples

### Sector-filtered responsável selector (`listarResponsaveis`, SETOR-03)

```typescript
// src/modules/empresas/queries.ts — MODIFIED
// Source: this project's existing listarResponsaveis() (read directly, lines 76-84),
// extended with an optional setor filter per SETOR-03

export async function listarResponsaveis(setor?: "FISCAL" | "DP" | "CONTABIL") {
  return db.usuario.findMany({
    where: setor ? { setor } : undefined, // undefined = ALL usuarios (e.g. legacy Fiscal selector during transition)
    select: {
      id: true,
      nome: true,
    },
    orderBy: { nome: "asc" },
  });
}
```

```typescript
// empresa-form.tsx — 3 separate Select components, each calling listarResponsaveis with
// a fixed setor, consistent with ARCHITECTURE.md's "explicit repetition over parametrized
// indirection for security-sensitive gates" preference already established for guard.ts
type EmpresaFormProps = {
  responsaveisFiscal: ResponsavelOption[];
  responsaveisDp: ResponsavelOption[];
  responsaveisContabil: ResponsavelOption[];
  isDono: boolean; // gates whether the 3 Selects are editable (D-02), enforced server-side too
  empresa?: { /* ...existing fields..., responsavelFiscalId, responsavelDpId, responsavelContabilId, temFuncionariosClt */ };
};
```

### "Sem responsável" filter badge (D-03), mirroring "Sem regime" precedent

```typescript
// empresas-table.tsx — extends the EXISTING regimeFiltro/responsavelFiltro pattern
// Source: this project's empresas-table.tsx (read directly, lines 90-113), same
// useMemo-based client-side filter shape as the "Sem regime" filter in StepReview.tsx
const [semResponsavelFiltro, setSemResponsavelFiltro] = useState<"TODAS" | "DP" | "CONTABIL">("TODAS");

const dadosFiltrados = useMemo(() => {
  return empresas.filter((empresa) => {
    // ...existing regimeFiltro/responsavelFiltro checks unchanged...
    if (semResponsavelFiltro === "DP" && empresa.responsavelDpId !== null) return false;
    if (semResponsavelFiltro === "CONTABIL" && empresa.responsavelContabilId !== null) return false;
    return true;
  });
}, [empresas, busca, regimeFiltro, responsavelFiltro, semResponsavelFiltro]);
```

### Multi-sector IDOR fixture (NEW test file, regression-gate-compatible)

```typescript
// tests/visibility-scope.setor.test.ts — NEW
// Source: mirrors tests/visibility-scope.test.ts structure exactly (read directly),
// parametrized over setor per PITFALLS.md Pitfall B3's explicit recommendation
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
    const dono = { id: "user_dono_1", role: "DONO" as const, setor: null };
    expect(withVisibilityScope(dono)).toEqual({});
  });

  it("COLABORADOR sem setor definido falha SEGURO (nenhuma empresa visível)", () => {
    const semSetor = { id: "user_x", role: "COLABORADOR" as const, setor: null };
    const result = withVisibilityScope(semSetor);
    expect(result).not.toEqual({}); // must NOT widen to "see everything"
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `Empresa.responsavelId` single FK | `EmpresaResponsavelSetor` junction, 1 row per sector | This phase (Phase 5 of v2.0) | Every read of "who's responsible" for DP/Contábil must go through the junction; Fiscal reads via the old column are UNCHANGED until Phase 6 |
| `withVisibilityScope(user)` single-arg | `withVisibilityScope(user, setor?)` with default from `user.setor` | This phase | Existing call sites continue to compile without edits; behavior changes only for COLABORADOR once `EmpresaResponsavelSetor` exists |

**Deprecated/outdated (starting this phase, fully removed in a LATER phase per PITFALLS.md B1):**
- `Empresa.responsavelId`: marked deprecated as of this phase's schema change, but MUST remain functional and unread-by-new-code until Phase 6/7 explicitly repoints the generation engine and a full release cycle has passed — do not drop it now.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 4 existing Fiscal `Usuario` rows do not yet have ANY `setor` value and must be explicitly backfilled to `FISCAL` separately from the empresa junction backfill | Common Pitfalls, Pattern 5 | If wrong (e.g., if a prior unlisted migration already set this), the extra backfill step is a no-op — low risk either way, but worth a quick `SELECT setor FROM usuarios` check before running it |
| A2 | This project still uses `npx prisma db push` (not `prisma migrate dev`) for schema changes against Neon, per STATE.md's Phase 02-01/03-01 decisions | Standard Stack, Pattern 1 | If the team has since switched to `migrate dev` (e.g., a shadow DB was provisioned), this phase's migration step needs the corresponding `migrate dev --name add_setor_multi_setor` command instead — low risk, easily corrected at execution time by checking for a `prisma/migrations/` directory |
| A3 | The exact field names `responsavelFiscalId`/`responsavelDpId`/`responsavelContabilId` for the Zod schema (vs. e.g. reading 3 responsável ids directly off the junction relation in the form) are a reasonable naming choice, not yet validated against any other naming convention in this codebase | Pattern 1, Code Examples | Low risk — CONTEXT.md explicitly leaves "forma exata de implementação... nomes de campos" to Claude's Discretion; any consistent naming works as long as it's used uniformly across schema/Zod/form/actions |

## Open Questions (RESOLVED)

Both questions' recommendations were adopted during phase planning — resolutions noted inline below.

1. **Should `Empresa.responsavelId` be made nullable now, to anticipate Phase 6/7 fully retiring it, or must it stay `String` (required) through this phase?**
   - What we know: PITFALLS.md B1 says "keep `Empresa.responsavelId` column in place (deprecated, unread) for at least one full release cycle" but doesn't specify whether it stays required or becomes optional during the deprecation window.
   - What's unclear: Whether any NEW empresa created during this phase still needs `responsavelId` populated (mirroring the FISCAL junction value) for backward compatibility with the still-unmodified `gerarTarefasDoMes`, or whether it's acceptable for `responsavelId` to silently drift out of sync with the FISCAL junction row for empresas created/edited after this phase ships.
   - Recommendation: Keep `responsavelId` required and ALWAYS write it in lockstep with the FISCAL junction row inside the same transaction (Pattern 1's "Migration note" + the transaction pattern in Common Pitfalls) for any empresa created/edited during this phase — this guarantees Phase 6's eventual repoint has zero drift to reconcile, at the cost of one extra write per empresa mutation. Confirm with the user if this extra write is acceptable or if `responsavelId` should simply be derived/ignored going forward.
   - **RESOLVED (adopted):** The lockstep recommendation was adopted — Plan 03 Task 2 keeps `Empresa.responsavelId` required and writes it equal to `responsavelFiscalId` inside the same `db.$transaction` as the junction upserts (see 05-03-PLAN.md Task 2 action "Lockstep responsavelId" + threat T-05-12).

2. **Does the "sem responsável" filter (D-03) need a DONO-only visibility, or should colaboradores also see it (e.g., for their own sector)?**
   - What we know: D-03 says the filter is "para o dono localizar rapidamente quais empresas ainda precisam de atribuição manual."
   - What's unclear: Whether a DP colaborador with zero assigned empresas (D-09's empty state) would ever interact with this filter at all, since by definition they'd see no rows to filter.
   - Recommendation: Scope the "sem responsável" filter control to DONO-only in the UI (mirrors the existing `isDono`-gated responsável filter dropdown already in `empresas-table.tsx`), since colaboradores never see unassigned-to-them empresas anyway — low-risk default, easy to adjust later.
   - **RESOLVED (adopted):** The DONO-only filter recommendation was adopted — Plan 04 Task 2 places the "Sem responsável DP/Contábil" toggles inside the `isDono ? (...) : null` filter bar (D-03 in 05-04-PLAN.md), so colaboradores never see the control.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (Neon) | Schema migration, backfill | ✓ | managed (Neon) | — |
| Node.js | Seed/backfill scripts | ✓ | >=20 (per package.json engines) | — |
| Prisma CLI | `db push`, `generate` | ✓ | 6.19.3 | — |

No missing dependencies — this phase requires nothing beyond what's already installed and running in this project.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/visibility-scope.test.ts tests/visibility-scope.setor.test.ts tests/empresas.idor.test.ts` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SETOR-01 | Backfill produces exactly 197 FISCAL junction rows matching old `responsavelId` | integration (script-level assertion, not vitest) | `node --env-file=.env scripts/backfill-responsavel-setor.mjs --apply` (asserts count, exits 1 on mismatch) | ❌ Wave 0 — script + count assertion to be written this phase |
| SETOR-01 | Existing IDOR/visibility suite passes UNMODIFIED after scope change | unit/integration (regression gate) | `npx vitest run tests/visibility-scope.test.ts tests/empresas.idor.test.ts tests/tarefas.idor.test.ts tests/empresas.queries.test.ts` | ✅ (files exist; must stay green, zero edits) |
| SETOR-02 | `Usuario.setor` correctly flows into session/JWT | unit | new test in `tests/auth.test.ts` or a new `tests/auth.setor.test.ts` asserting jwt/session callbacks propagate `setor` | ❌ Wave 0 |
| SETOR-02 | 7 placeholder users created with correct setor + login works | integration (seed script + manual or scripted login check) | `node --env-file=.env -e "..."` query count by setor, or extend an existing seed-verification test | ❌ Wave 0 |
| SETOR-03 | `listarResponsaveis(setor)` filters correctly | unit | new test in `tests/empresas.queries.test.ts` extension | ❌ Wave 0 (extend existing file) |
| EMPR-03 | `temFuncionariosClt` defaults false, editable via form | unit (schema) + integration (Server Action) | extend `tests/empresas.crud.test.ts` | ❌ Wave 0 (extend existing file) |
| (D-02) | Non-DONO cannot change responsável fields via direct Server Action call | unit (IDOR-style) | new test extending `tests/empresas.idor.test.ts` | ❌ Wave 0 |
| (D-09/D-10) | Sector-filtered empty state + column visibility | manual / component test | manual UAT (no existing component test infra for this UI layer beyond server-side query tests) | n/a — manual-only, justified: no existing React Testing Library setup in this project's test suite |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/visibility-scope.test.ts tests/visibility-scope.setor.test.ts tests/empresas.idor.test.ts`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`, PLUS the backfill script's count assertion exit code `0` against the actual target database

### Wave 0 Gaps
- [ ] `scripts/backfill-responsavel-setor.mjs` — count assertion script (Pattern 2)
- [ ] `tests/visibility-scope.setor.test.ts` — multi-sector RBAC fixtures (Pitfall B3 regression-gate companion)
- [ ] Extension to `tests/empresas.idor.test.ts` — DONO-only responsável-field-change guard (D-02)
- [ ] Extension to `tests/empresas.queries.test.ts` — `listarResponsaveis(setor)` filter test
- [ ] Extension to `tests/empresas.crud.test.ts` — `temFuncionariosClt` default + edit test
- [ ] Framework install: none — Vitest already configured and used by all 20 existing test files

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Auth.js v5 Credentials provider, already implemented; this phase only adds `setor` to the existing session shape |
| V3 Session Management | yes | JWT session strategy already configured (`strategy: "jwt"` in `auth.config.ts`); adding `setor` to the token must not weaken existing session integrity — no new session storage, just an additional signed JWT claim |
| V4 Access Control | yes | `withVisibilityScope`/`withTarefaScope` — this phase's central concern; explicit `setor` + `usuarioId` combined check (never `setor` alone) per Pitfall B3 |
| V5 Input Validation | yes | Zod (`empresaSchema` extended); CLT boolean and 3 responsável id fields validated server-side before any DB write |
| V6 Cryptography | no (unchanged) | bcryptjs already used for password hashing; this phase reuses the existing hash call exactly, no new crypto surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — colaborador reads/edits empresa outside their sector responsibility | Elevation of Privilege / Information Disclosure | `findFirst({ where: { id, ...withVisibilityScope(user) } })` returning `null` (never 403) — exact existing pattern, extended with sector-aware junction filter (Pattern 4) |
| RBAC widening — `setor` filter applied without `usuarioId`, letting a colaborador see ALL empresas in their sector | Elevation of Privilege | Combined `some: { setor, usuarioId }` filter in the SAME relation condition, never two independent `where` clauses (PITFALLS.md Pitfall B3, explicitly tested in the new fixture file) |
| Privilege escalation via direct Server Action call bypassing UI-disabled controls | Elevation of Privilege | Server-side `session.user.role === "DONO"` check before accepting changes to responsável fields (D-02), independent of any client-side disabled state — mirrors this codebase's existing `T-01-IDOR-MUT` convention |
| Trusting client-supplied `setor` value for scoping | Tampering | `withVisibilityScope`/`withTarefaScope` source `setor` exclusively from the authenticated session (`user.setor`), never from form/query input — Pattern 3 + Pattern 4 |

## Sources

### Primary (HIGH confidence)
- Direct reading of this codebase's actual files in this session: `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/visibility-scope.ts`, `src/types/next-auth.d.ts`, `src/auth.ts`, `src/auth.config.ts`, `src/modules/empresas/queries.ts`, `src/modules/empresas/schema.ts`, `src/app/(app)/actions.ts`, `src/app/(app)/empresas/empresa-form.tsx`, `src/app/(app)/empresas/empresas-table.tsx`, `src/app/(app)/empresas/page.tsx`, `src/app/(app)/tarefas/actions.ts`, `src/modules/tarefas/schema.ts`, `src/modules/tarefas/geracao.ts`, `scripts/atualizar-responsaveis.mjs`, `tests/visibility-scope.test.ts`, `tests/setup.ts`, `tests/empresas.idor.test.ts`, `tests/tarefas.idor.test.ts`, `src/app/(app)/empresas/importar/_components/StepReview.tsx`, `package.json`, `.planning/config.json`
- `.planning/research/PITFALLS.md` (Part B, Pitfall B1 and B3) — canonical pitfall reference for this phase, not re-derived
- `.planning/research/ARCHITECTURE.md` — canonical architecture reference for this phase's junction-table/scope-function/UI patterns, not re-derived
- `.planning/research/SUMMARY.md` — milestone-level synthesis confirming phase ordering and risk allocation

### Secondary (MEDIUM confidence)
- `.planning/phases/05-funda-o-multi-setor-schema-autoriza-o-e-empresas/05-CONTEXT.md` — user decisions (D-01 through D-10), treated as locked constraints, not independently re-verified (by design — these are user decisions, not technical claims to verify)

### Tertiary (LOW confidence)
- None — this research relied entirely on direct codebase inspection and the project's own canonical research documents; no external web search was needed since this phase introduces no new external technology.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all versions confirmed directly from `package.json`
- Architecture: HIGH — every pattern grounded in direct reading of the actual files that will be modified, cross-checked against the canonical ARCHITECTURE.md/PITFALLS.md already produced for this milestone
- Pitfalls: HIGH — the two headline pitfalls (B1, B3) are pre-researched at HIGH confidence; the four implementation-level pitfalls added here are derived from direct inspection of this phase's specific touch points (seed.ts upsert semantics, Zod schema shape, DONO-only guard precedent, transaction pattern precedent)

**Research date:** 2026-06-23
**Valid until:** 30 days (stable internal codebase; no external API/library drift risk since no new dependencies are introduced)
