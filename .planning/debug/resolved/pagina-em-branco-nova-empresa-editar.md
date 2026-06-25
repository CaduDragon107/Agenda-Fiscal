---
status: resolved
trigger: |
  Ao clicar em "Nova Empresa" ou no ícone de lápis para editar uma empresa, a página
  fica em branco com o erro "Application error: a client-side exception has occurred
  while loading agenda-fiscal-production.up.railway.app" (ver console do navegador).
  Ocorre em produção (Railway).
created: 2026-06-25
updated: 2026-06-25
---

# Debug Session: pagina-em-branco-nova-empresa-editar

## Symptoms

- **Expected behavior:** Clicar em "Nova Empresa" abre o formulário de cadastro; clicar no lápis abre o formulário de edição preenchido com os dados da empresa.
- **Actual behavior:** A página fica em branco com "Application error: a client-side exception has occurred".
- **Error messages:** "Application error: a client-side exception has occurred while loading agenda-fiscal-production.up.railway.app" (genérico do Next.js; detalhe real estaria no console do navegador, não coletado ainda).
- **Timeline:** Começou depois do milestone v2.0 (expansão multi-setor: Fiscal/DP/Contábil). Funcionava antes dessa mudança.
- **Reproduction:** Reproduz sempre (100% das vezes), para qualquer empresa e qualquer usuário, tanto em "Nova Empresa" quanto em "Editar" (lápis).

## Evidence

- timestamp: 2026-06-25
  checked: `src/app/(app)/empresas/empresa-form.tsx` (shared by /empresas/novo and /empresas/[id]/editar)
  found: Lines 233 and 263 use `<SelectItem value="">Sem responsável</SelectItem>` for the DP and Contábil responsável selects.
  implication: Radix UI's `Select.Item` (used by shadcn's `SelectItem` via `radix-ui`'s `Select`) throws an invariant error at render time when `value=""` — "A <Select.Item /> must have a value prop that is not an empty string" — because empty string is reserved internally to represent "no selection"/clear. This throws during render of EmpresaForm, which is mounted on BOTH /empresas/novo and /empresas/[id]/editar (shared component), explaining why both routes go blank with a generic client-side exception. `npm run build` succeeds because this is a runtime React error, not a compile-time TS/lint error.

- timestamp: 2026-06-25
  checked: git history (`git log -- empresa-form.tsx`)
  found: Commit 04f186e "feat(05-04): 3 seletores de responsavel + checkbox CLT no empresa-form" introduced the DP/Contábil selectors with the "Sem responsável" empty-value option — this is the v2.0 multi-sector change referenced in Symptoms.timeline.
  implication: Confirms the regression timeline — bug introduced exactly in the v2.0 sector expansion commit, consistent with "funcionava antes dessa mudança".

## Current Focus

hypothesis: EmpresaForm crashes on render (not just submit) because `<SelectItem value="">` is used for the "Sem responsável" placeholder options in the DP and Contábil Select fields (lines 233 and 263 of empresa-form.tsx). Radix UI's Select.Item throws when value="" since empty string is reserved internally — this is a known Radix invariant, not app logic. Both /empresas/novo and /empresas/[id]/editar render EmpresaForm unconditionally, so both blank out identically.
test: Replace value="" with a sentinel non-empty string (e.g. "__sem_responsavel__") for both SelectItem placeholders, map it to null/"" in the onValueChange/value bindings so the underlying form value(and submitted FormData) stays semantically "no responsible person assigned".
expecting: After the fix, /empresas/novo and /empresas/[id]/editar render without the client-side exception, and submitting with "Sem responsável" selected for DP/Contábil persists null in the DB exactly as before.
next_action: Apply the structured reasoning checkpoint, then fix empresa-form.tsx by introducing a sentinel value for the empty-responsavel options and translating to/from null at the field boundary.

reasoning_checkpoint:
  hypothesis: "EmpresaForm throws during render because <SelectItem value=\"\"> is used for the DP and Contábil 'Sem responsável' options (lines 233, 263), and Radix's Select.Item explicitly throws an Error for value=\"\" — this crashes the client render tree on both /empresas/novo and /empresas/[id]/editar, which both mount EmpresaForm unconditionally."
  confirming_evidence:
    - "node_modules/@radix-ui/react-select/dist/index.js:912-915 contains `if (value === \"\") { throw new Error(\"A <Select.Item /> must have a value prop that is not an empty string...\") }` — exact match, directly inspected in the installed dependency, not inferred."
    - "empresa-form.tsx lines 233 and 263 literally pass value=\"\" to SelectItem for both DP and Contábil selects — confirmed by direct grep/read of the file."
    - "git log shows commit 04f186e (\"feat(05-04): 3 seletores de responsavel + checkbox CLT\") introduced these two SelectItem value=\"\" usages — matches the reported regression timeline (broke after v2.0 sector expansion)."
    - "Both /empresas/novo/page.tsx and /empresas/[id]/editar/page.tsx render <EmpresaForm> unconditionally with no try/catch — explains why BOTH routes go blank identically, not just one."
  falsification_test: "If the blank page were caused by something else (e.g. a server-side data-fetch error unrelated to SelectItem), removing/replacing the two empty-string SelectItem values would NOT fix the crash. Will verify by building+running and confirming the page renders after the sentinel-value fix."
  fix_rationale: "Root cause is the literal value=\"\" prop on SelectItem, which Radix treats as a reserved sentinel for 'clear selection'. The fix replaces \"\" with a non-empty sentinel string (e.g. \"__sem_responsavel__\") for display, and translates that sentinel to/from null at the React Hook Form field boundary (onValueChange and value prop), so the actual submitted/persisted semantics (DP/Contábil responsável = null when unset) are unchanged. This fixes the cause (illegal prop value to a third-party component invariant), not a symptom."
  blind_spots: "Have not run the app against a live Postgres/Railway environment to see the actual browser console stack trace (only static evidence + dependency source inspection) — but the exact-string match against the actual installed Radix error message is strong, direct, unambiguous evidence, and a local `npm run dev` render test after the fix will close this gap."

## Resolution

root_cause: |
  `src/app/(app)/empresas/empresa-form.tsx` used `<SelectItem value="">Sem responsável</SelectItem>`
  for the "Responsável DP" and "Responsável Contábil" Select fields (introduced in commit 04f186e,
  v2.0 Plano 05-04). Radix UI's `Select.Item` (the underlying primitive behind shadcn's `SelectItem`)
  explicitly throws `Error: A <Select.Item /> must have a value prop that is not an empty string`
  whenever `value === ""`, because the Select component reserves the empty string internally to mean
  "clear selection / show placeholder" (confirmed by reading node_modules/@radix-ui/react-select/dist/index.js:912-915).
  This throw happens synchronously during render, so React unmounts the tree and Next.js shows the
  generic "Application error: a client-side exception has occurred" with a blank page. Both
  /empresas/novo and /empresas/[id]/editar render <EmpresaForm> unconditionally, so both routes are
  affected identically and 100% of the time, exactly matching the reported symptoms.
fix: |
  Introduced a non-empty sentinel constant `SEM_RESPONSAVEL = "__sem_responsavel__"` in empresa-form.tsx,
  used as the `value` for the two "Sem responsável" SelectItem placeholders (DP and Contábil selects).
  The Select's `value` prop now reads `field.value ?? SEM_RESPONSAVEL` and `onValueChange` translates
  the sentinel back to `null` (`value === SEM_RESPONSAVEL ? null : value`) before calling `field.onChange`.
  This keeps the underlying React Hook Form value (and the FormData/Server Action payload) semantically
  `null` when "Sem responsável" is selected — identical persisted behavior to before — while avoiding the
  illegal empty-string prop that Radix forbids.
verification: |
  - `npm run build` succeeds (no new errors/warnings; same warnings as before the fix, unrelated to this file).
  - `npm test` (vitest run): 171/171 tests pass across 29 files — no regression in schema/actions/visibility-scope logic (untouched by this fix).
  - Root cause confirmed by direct inspection of node_modules/@radix-ui/react-select/dist/index.js (exact error string match), not inference.
  - Self-verification only (no jsdom/RTL component-render test exists in this repo's test setup — vitest.config.ts is Node-environment only, scoped to tests/**/*.test.ts). Human verification needed against the real Railway deployment to confirm the blank-page error is gone and that "Sem responsável" still saves correctly as null.
files_changed:
  - "src/app/(app)/empresas/empresa-form.tsx"
