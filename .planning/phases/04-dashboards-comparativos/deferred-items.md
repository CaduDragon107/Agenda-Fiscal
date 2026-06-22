# Deferred Items — Phase 04 (dashboards-comparativos)

## tests/auth.test.ts — pre-existing failure, out of scope for Plan 04-03

`tests/auth.test.ts` (3 tests) fails in this worktree with:

```
Error: Cannot find package 'next/server' imported from .../node_modules/next-auth/lib/env.js
```

This is a worktree-local `node_modules` module-resolution issue affecting
`next-auth`'s import of `next/server`, unrelated to Plan 04-03's files
(`src/modules/dashboards/queries.ts`, `tests/dashboards.queries.test.ts`).
The file was created in Phase 01 (`fb04cec`, `c2b606c`) — long before this
plan — and is not in `files_modified` for 04-03. Per the executor's scope
boundary rule, pre-existing failures in unrelated files are logged here, not
fixed inline.

All 7 tests in `tests/dashboards.queries.test.ts` (this plan's target file)
pass. `npx tsc --noEmit` is clean. The full suite (`npm run test`) reports
80 passed / 3 failed (all 3 failures isolated to `auth.test.ts`) / 6 todo.
