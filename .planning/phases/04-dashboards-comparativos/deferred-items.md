# Deferred Items — Phase 04 (dashboards-comparativos)

Out-of-scope discoveries logged per executor scope-boundary rule. Not fixed
by Plan 04-02 or 04-03 — pre-existing, unrelated to either plan's files.

## tests/auth.test.ts — `next/server` resolution failure in worktree

**Discovered during:** Plan 04-02, full-suite verification run (`npm run test`).
**Independently confirmed during:** Plan 04-03, full-suite verification run — same symptom, same root cause, different worktree.

**Symptom:** 3 of 4 tests in `tests/auth.test.ts` fail with:
```
Error: Cannot find package 'next/server' imported from
node_modules/next-auth/lib/env.js
```

**Root cause (hypothesis):** Worktree-local `node_modules` resolution
artifact — `next-auth`'s `index.js` imports `next/server`, which appears
to resolve incorrectly from each worktree's independent dependency tree
(similar in nature to the `@prisma/client` stale-path issue documented in
`04-01-SUMMARY.md`'s "Issues Encountered" section, though `npx prisma
generate` does not apply here since this is a `next` resolution, not
Prisma).

**Verified pre-existing:** Confirmed via `git stash` that this failure is
present at the Plan 04-02 Task 1 commit (577af18) — i.e. before any
Plan 04-02 source changes. The file was created in Phase 01 (`fb04cec`,
`c2b606c`) — long before either plan — and is not in `files_modified` for
04-02 or 04-03.

**Scope decision:** Out of scope for both plans per the executor's scope
boundary rule (only auto-fix issues directly caused by the current task's
changes). Not fixed; logged here for visibility.

**Suggested next step:** Re-run `npm install` in the main checkout to
confirm whether this is a worktree-only `node_modules` drift (it did not
reproduce after `npm install` was run on the main tree following Wave 1),
or escalate as a real environment blocker if it persists post-merge.
