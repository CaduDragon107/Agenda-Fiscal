---
phase: 01-funda-o-acesso-empresas-e-importa-o
plan: 02
subsystem: auth
tags: [next-auth, auth.js, jwt, credentials, bcrypt, prisma, middleware, react-hook-form, zod, shadcn]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Next.js 15.5 + shadcn/ui bootstrap, Prisma schema with Usuario/Empresa models, 5 seeded users in live Neon Postgres, Vitest infra with RED stub tests"
provides:
  - "Auth.js v5 Credentials provider with JWT session strategy (no PrismaAdapter)"
  - "Prisma Client singleton (src/lib/db.ts)"
  - "Typed Session/JWT (id + role: COLABORADOR|DONO) with zero 'as any'"
  - "Route protection via edge-safe middleware"
  - "Login screen (/login) per UI-SPEC: Card 400px, react-hook-form + zod, generic error copy"
affects: [01-03, 01-04, 01-05, 01-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "auth.config.ts (edge-safe base config) + auth.ts (full config with db/bcrypt) split for middleware compatibility"
    - "authorize() exported as standalone testable function from src/auth.ts, consumed by Credentials provider"
    - "Type augmentation targets both next-auth/next-auth/jwt AND the underlying @auth/core/types and @auth/core/jwt modules (re-export augmentation workaround)"

key-files:
  created:
    - src/lib/db.ts
    - src/auth.config.ts
    - src/auth.ts
    - src/types/next-auth.d.ts
    - src/app/api/auth/[...nextauth]/route.ts
    - src/middleware.ts
    - src/app/login/page.tsx
    - src/app/login/login-form.tsx
  modified:
    - tests/auth.test.ts
    - vitest.config.ts

key-decisions:
  - "Middleware built as its own NextAuth(authConfig) instance (not re-exported from @/auth) to keep db.ts/bcryptjs out of the edge bundle"
  - "authorize() extracted as a standalone exported function for direct unit testing without invoking the full NextAuth/signIn flow"
  - "vitest.config.ts: aliased bare next/server and next/headers imports to their .js files and inlined next-auth/@auth/core deps — required because Node ESM cannot resolve extensionless subpaths in the next package (no exports map)"

requirements-completed: [AUTH-01]

# Metrics
duration: 18min
completed: 2026-06-12
---

# Phase 01 Plan 02: Auth.js v5 Credentials + Login Screen Summary

**Auth.js v5 Credentials provider with JWT session (role+id typed, no PrismaAdapter), edge-safe middleware route protection, and a login screen matching UI-SPEC Screen 1.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-06-12T18:14:30Z
- **Completed:** 2026-06-12T18:32:30Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Auth.js v5 Credentials Provider configured with JWT session strategy; `authorize()` validates email/senha via `bcrypt.compare` against `db.usuario`, returning a generic `null` for both "email não existe" and "senha errada" (anti-enumeration)
- `src/types/next-auth.d.ts` augments `Session`, `User`, and `JWT` (next-auth + underlying `@auth/core` modules) with `id: string` and `role: "COLABORADOR" | "DONO"` — zero `as any` casts anywhere in `auth.ts`/`auth.config.ts`
- Route protection via `src/middleware.ts`, built as its own edge-safe `NextAuth(authConfig)` instance (no Prisma/bcrypt in the edge bundle), matcher excludes `/login`, `/api`, and static assets
- Login screen (`/login`) per UI-SPEC: centered Card max-width 400px, react-hook-form + zodResolver, autofocus on email, inline Zod errors ("Email inválido", "Senha obrigatória"), generic submit error "Email ou senha incorretos.", loading spinner on "Entrar" CTA, redirect to `/empresas` on success
- `tests/auth.test.ts` is GREEN (4/4), covering valid login, nonexistent email, wrong password, and jwt/session callback propagation of id+role
- `npm run build` succeeds (middleware compiles to 87.1 kB edge bundle with no Prisma/bcrypt leakage)

## Task Commits

Each task was committed atomically (Task 1 followed TDD RED → GREEN):

1. **Task 1: Prisma singleton + Auth.js v5 config (RED)** - `fb04cec` (test) - real assertions replacing `expect.fail` stubs in `tests/auth.test.ts`, plus `vitest.config.ts` fix for `next-auth`'s bare `next/server`/`next/headers` imports
2. **Task 1: Prisma singleton + Auth.js v5 config (GREEN)** - `9e99f0f` (feat) - `src/lib/db.ts`, `src/auth.config.ts`, `src/auth.ts`, `src/types/next-auth.d.ts`
3. **Task 2: Route handler, middleware, login screen** - `7650242` (feat) - `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/login/login-form.tsx`

**Plan metadata:** (this commit) - docs: complete 01-02 plan

## Files Created/Modified
- `src/lib/db.ts` - Prisma Client singleton (global-scoped for dev hot-reload)
- `src/auth.config.ts` - Edge-safe base config: `session.strategy: "jwt"`, `pages.signIn: "/login"`, jwt/session callbacks copying id+role
- `src/auth.ts` - Full NextAuth config; exports `{ handlers, auth, signIn, signOut, authorize }`; `authorize()` queries `db.usuario` with explicit `select` (incl. `senhaHash` only here), `bcrypt.compare`; no `PrismaAdapter`
- `src/types/next-auth.d.ts` - Type augmentation for `Session`/`User`/`JWT` (next-auth + `@auth/core/types` + `@auth/core/jwt`) adding `id: string` and `role: AppRole`
- `src/app/api/auth/[...nextauth]/route.ts` - Re-exports `{ GET, POST }` from `@/auth` handlers
- `src/middleware.ts` - `NextAuth(authConfig).auth` exported as `middleware`, matcher `/((?!api|_next/static|_next/image|login|favicon.ico).*)`
- `src/app/login/page.tsx` - Server Component shell, centered, max-width 400px, 64px top padding
- `src/app/login/login-form.tsx` - Client Component login form (react-hook-form + zod, signIn, redirect to /empresas)
- `tests/auth.test.ts` - Real test coverage for `authorize()` and jwt/session callbacks (mocks `@/lib/db`)
- `vitest.config.ts` - Resolve aliases + `server.deps.inline` for `next-auth`/`@auth/core`

## Decisions Made
- **Middleware as a separate edge-safe NextAuth instance:** `src/middleware.ts` does NOT do `export { auth as middleware } from "@/auth"` (the literal PATTERNS.md skeleton) because `@/auth` imports `@/lib/db` (Prisma) and `bcryptjs`, which are Node-only and would either fail or bloat the edge runtime bundle. Instead it builds `NextAuth(authConfig)` — using only the edge-safe base config — and exports its `auth` as `middleware`. This is the exact split the plan's `<action>` anticipated ("middleware possa importar só a parte edge-safe"). Verified via `npm run build`: no `bcrypt`/`prisma`/`@/lib/db` references in build output, middleware bundle 87.1 kB, build succeeds.
- **`authorize()` extracted as a named export:** rather than testing through the full `signIn()`/NextAuth request flow (which requires HTTP request context), `authorize()` is a standalone exported async function consumed directly by the `Credentials` provider config. This made the TDD RED→GREEN cycle straightforward and keeps the security-critical email/password/bcrypt logic in one unit-testable place.
- **Type augmentation targets `@auth/core/types` and `@auth/core/jwt` directly, in addition to `next-auth`/`next-auth/jwt`:** `next-auth`'s `index.d.ts`/`jwt.d.ts` re-export types via `export * from "@auth/core/..."` and `export type {...} from "@auth/core/types"`. Module augmentation declared only against `"next-auth"`/`"next-auth/jwt"` did not merge into the actual interfaces used by callback parameter types (tsc reported `Type 'unknown' is not assignable to type 'string'` for `token.id`/`token.role` in the session callback). Augmenting `@auth/core/types` and `@auth/core/jwt` directly (alongside the next-auth re-exports, for IDE/import-site resolution) fixed this with zero `as any`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest cannot resolve next-auth's bare `next/server`/`next/headers` imports**
- **Found during:** Task 1, first `npx vitest run tests/auth.test.ts`
- **Issue:** Importing `NextAuth` from `"next-auth"` transitively imports `next-auth/lib/env.js`, which does `import { NextRequest } from "next/server"` (no extension). The `next` package has no `exports` map for these subpaths, so Node ESM resolution fails with `Cannot find module '.../node_modules/next/server'` — reproduced even in plain `node -e "import('next/server')"`, confirming this is an environment/dependency compatibility issue, not a code bug.
- **Fix:** In `vitest.config.ts`, added `resolve.alias` entries mapping `next/server` → `./node_modules/next/server.js` and `next/headers` → `./node_modules/next/headers.js`, plus `test.server.deps.inline: [/next-auth/, /@auth\/core/]` so these packages are processed by Vite's resolver (where the aliases apply) instead of being externalized to plain Node ESM resolution.
- **Files modified:** `vitest.config.ts`
- **Verification:** `npx vitest run tests/auth.test.ts` → 4/4 passed (was failing with module-not-found error before the fix)
- **Committed in:** `fb04cec` (Task 1 RED commit)

**2. [Rule 1 - Bug] Type augmentation for Session/JWT not merging via next-auth re-exports**
- **Found during:** Task 1, `npx tsc --noEmit` after initial implementation
- **Issue:** `src/auth.config.ts`'s `session`/`jwt` callbacks failed to compile: `Type 'unknown' is not assignable to type 'string'` / `'AppRole'` when assigning `token.id`/`token.role` to `session.user.id`/`session.user.role`. The `declare module "next-auth/jwt" { interface JWT {...} }` augmentation did not apply because `next-auth/jwt` is itself `export * from "@auth/core/jwt"`, and TS module augmentation does not always follow through such re-exports for interface merging.
- **Fix:** Added parallel `declare module "@auth/core/types" { interface Session/User {...} }` and `declare module "@auth/core/jwt" { interface JWT {...} }` blocks in `src/types/next-auth.d.ts`, targeting the modules where the interfaces are actually declared.
- **Files modified:** `src/types/next-auth.d.ts`
- **Verification:** `npx tsc --noEmit` → no errors; `npm run build` → succeeds with type checking enabled
- **Committed in:** `9e99f0f` (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency-resolution issue, 1 type-system bug)
**Impact on plan:** Both fixes were necessary to make the plan's own acceptance criteria achievable (`tests/auth.test.ts` GREEN, zero `as any` in `auth.ts`). No scope creep — no new files beyond what the plan specified, and the middleware split was explicitly anticipated by the plan's `<action>` text.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## User Setup Required
None - no external service configuration required. `.env` (AUTH_SECRET, DATABASE_URL, DIRECT_URL) was already populated by Plan 01-01 and used as-is.

## Next Phase Readiness
- Login is functional end-to-end for all 5 seeded users (manual smoke test recommended: sign in with `dono@escritorio.com.br` / `colaborador1@escritorio.com.br` etc., password `trocar-no-primeiro-login`, should redirect to `/empresas` — note `/empresas` does not exist yet, so a 404 is expected until Plan 03; this does not block AUTH-01 verification, which only requires the redirect attempt to occur).
- `session.user.id` and `session.user.role` are available via `await auth()` in any Server Component/Action for the visibility-scope work (AUTH-02) in Plan 03.
- `withVisibilityScope()` (lib/visibility-scope.ts) and `modules/empresas/*` are NOT part of this plan and remain RED stubs (`tests/visibility-scope.test.ts`, `tests/empresas.crud.test.ts`, etc.) — expected, scheduled for Plan 03.
- No blockers identified for Plan 03.

---
*Phase: 01-funda-o-acesso-empresas-e-importa-o*
*Completed: 2026-06-12*

## Self-Check: PASSED

- FOUND: src/lib/db.ts
- FOUND: src/auth.config.ts
- FOUND: src/auth.ts
- FOUND: src/types/next-auth.d.ts
- FOUND: src/app/api/auth/[...nextauth]/route.ts
- FOUND: src/middleware.ts
- FOUND: src/app/login/page.tsx
- FOUND: src/app/login/login-form.tsx
- FOUND: commit fb04cec (test, RED)
- FOUND: commit 9e99f0f (feat, GREEN)
- FOUND: commit 7650242 (feat, Task 2)
