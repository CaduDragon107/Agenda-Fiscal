---
phase: quick-260615-ci1
plan: 01
subsystem: ui
tags: [next-themes, shadcn, tailwind-v4, dark-mode, dropdown-menu]

requires:
  - phase: 01-funda-o-acesso-empresas-e-importa-o
    provides: app/(app) authenticated shell with AppSidebar (SidebarFooter user dropdown), root layout, globals.css with Tailwind v4 dark variant already configured
provides:
  - ThemeProvider (next-themes, attribute="class") wired into the root layout, covering both /login and all (app) routes
  - Reusable ModeToggle component (light/dark/system) wired into the sidebar user dropdown via DropdownMenuSub + DropdownMenuRadioGroup
affects: [ui, future dashboard/theming work]

tech-stack:
  added: []
  patterns:
    - "Theme toggle implemented as a DropdownMenuSub/DropdownMenuRadioGroup nested inside the existing sidebar user dropdown, not a standalone button"
    - "ModeToggle guards DropdownMenuRadioGroup value with a mounted state to avoid SSR/client theme mismatch"

key-files:
  created:
    - src/components/theme-provider.tsx
    - src/components/mode-toggle.tsx
  modified:
    - src/app/layout.tsx
    - src/app/(app)/app-sidebar.tsx

key-decisions:
  - "ThemeProvider placed in the root layout (not the (app) layout) so /login also respects the chosen theme, per plan requirement"
  - "ModeToggle implemented as a DropdownMenuSub inside the existing SidebarFooter user dropdown rather than a separate top-level button, matching shadcn pattern and avoiding new UI chrome"
  - "globals.css left untouched -- existing @custom-variant dark (&:is(.dark *)) + .dark block already compatible with attribute=\"class\""

patterns-established:
  - "Pattern: next-themes ThemeProvider wraps {children} + <Toaster /> in root layout body, with suppressHydrationWarning on <html>"
  - "Pattern: theme controls live inside DropdownMenuSub/DropdownMenuRadioGroup using value/onValueChange=setTheme, guarded by a mounted flag"

requirements-completed: [QUICK-CI1]

duration: ~15min
completed: 2026-06-15
---

# Quick Task 260615-ci1: Dark Mode Toggle Summary

**Connected next-themes ThemeProvider to the root layout (covering /login and all authenticated routes) and added a light/dark/system toggle to the sidebar user dropdown via a shadcn DropdownMenuSub + RadioGroup.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 of 3 completed (Task 3 is a checkpoint:human-verify; automated checks completed, visual confirmation pending)
- **Files modified:** 2 modified, 2 created

## Accomplishments
- `ThemeProvider` (wrapping `next-themes`) now wraps `{children}` and `<Toaster />` in `src/app/layout.tsx`, with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`, and `suppressHydrationWarning` on `<html>`.
- New `ModeToggle` component renders a "Tema" submenu (Sun/Moon icon) inside the sidebar user dropdown, with three `DropdownMenuRadioItem`s (Claro / Escuro / Sistema) calling `setTheme`.
- Toggle is accessible from every authenticated route (shared `(app)` sidebar) and the theme also applies to `/login` because the provider lives in the root layout.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass with the new code included.

## Task Commits

Each task was committed atomically:

1. **Task 1: Criar ThemeProvider e conectar no root layout** - `4f6cbe5` (feat)
2. **Task 2: Criar componente ModeToggle e integrá-lo na sidebar** - `ab2765f` (feat)
3. **Task 3: Checkpoint (human-verify)** - automated checks only (see below); no code commit (no implementation changes for this task)

## Files Created/Modified
- `src/components/theme-provider.tsx` - Thin client wrapper re-exporting `next-themes` `ThemeProvider`, typed via `React.ComponentProps<typeof NextThemesProvider>`
- `src/components/mode-toggle.tsx` - `ModeToggle` client component using `useTheme()`/`setTheme`, rendered as a `DropdownMenuSub` with a `DropdownMenuRadioGroup` (light/dark/system), guarded by a `mounted` state
- `src/app/layout.tsx` - Added `suppressHydrationWarning` to `<html>`; wrapped body content in `ThemeProvider` (attribute="class", defaultTheme="system", enableSystem, disableTransitionOnChange)
- `src/app/(app)/app-sidebar.tsx` - Imported and rendered `<ModeToggle />` inside the `SidebarFooter` `DropdownMenu`, between the user info label and the "Sair" item, separated by `DropdownMenuSeparator`s

## Decisions Made
- ThemeProvider stays in the root layout (not the `(app)` layout) so `/login` is themed too, per the plan's explicit requirement.
- Reused the existing sidebar user dropdown (`DropdownMenuSub` + `DropdownMenuRadioGroup`) rather than adding a new standalone toggle button, consistent with the shadcn pattern referenced in the plan and the existing `dropdown-menu.tsx` primitives (`DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem` were already exported and unused before this change).
- `globals.css` was not touched — the existing `@custom-variant dark (&:is(.dark *));` and `.dark { ... }` block are already compatible with `attribute="class"`.
- `ModeToggle` passes `value={mounted ? theme : undefined}` to `DropdownMenuRadioGroup` to avoid any SSR/client mismatch on the initially-selected radio item before `next-themes` resolves on the client.

## Deviations from Plan

None - plan executed exactly as written for Tasks 1 and 2.

## Issues Encountered

None for Tasks 1-2. `npm run build` surfaced pre-existing Edge Runtime warnings from `jose`/`@auth/core` (used by `next-auth`) about `CompressionStream`/`DecompressionStream` — these are unrelated to this plan's changes (NextAuth/middleware setup from Phase 01-02), out of scope per the deviation rules' scope boundary, and did not prevent a successful build (`✓ Compiled successfully`, all 9 routes generated including `/login` and `/empresas`).

## Task 3 (checkpoint:human-verify) - Automated Verification Status

Per execution constraints, this is a worktree-isolated subagent run with no interactive browser access. The following automated checks were completed successfully in place of the full manual verification:

- `npx tsc --noEmit` — passes, no type errors.
- `npm run lint` — passes, no lint errors.
- `npm run build` — succeeds; all 9 routes (including `/login`, `/empresas`, and the `(app)` shell) compile and prerender/generate without errors. The `ThemeProvider` and `ModeToggle` components are included in the build with no runtime/build errors.

### Remaining manual verification (pending from user)

The following items from the plan's `<how-to-verify>` require a running browser session and were **not** automatable in this environment:

1. Run `npm run dev`, log in, and on any authenticated page (e.g. `/empresas`) open the sidebar user dropdown and confirm the "Tema" submenu shows Claro/Escuro/Sistema options.
2. Select "Escuro" — confirm the whole UI switches to dark theme immediately, with no visible flash.
3. Select "Claro" then "Sistema" — confirm both work as expected (Sistema follows OS preference).
4. Reload the page (F5) with dark theme active — confirm it stays dark with **no flash of light theme** and **no hydration-mismatch warning** in the browser console.
5. Log out / visit `/login` — confirm the login page also reflects the chosen theme (validates that `ThemeProvider` in the root layout applies outside the authenticated shell).

These steps should be confirmed by the user (or a follow-up session with browser access) before considering the dark mode feature fully verified end-to-end.

## Next Phase Readiness
- Dark mode toggle is wired end-to-end (provider + UI control) and builds/typechecks/lints cleanly.
- No blockers for other quick tasks or Phase 01 plan 06 continuation.
- Manual browser verification of Task 3 is the only open item; if issues are found (flash, hydration warning, login not themed), they can be addressed in a follow-up quick task referencing this one.

---
*Quick task: 260615-ci1*
*Completed: 2026-06-15*

## Self-Check: PASSED

- FOUND: src/components/theme-provider.tsx
- FOUND: src/components/mode-toggle.tsx
- FOUND: .planning/quick/260615-ci1-adicionar-toggle-de-modo-escuro-dark-mod/260615-ci1-SUMMARY.md
- FOUND commit: 4f6cbe5
- FOUND commit: ab2765f
