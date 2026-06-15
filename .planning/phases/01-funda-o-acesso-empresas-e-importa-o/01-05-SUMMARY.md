---
phase: 01-funda-o-acesso-empresas-e-importa-o
plan: 05
subsystem: import
tags: [sheetjs, xlsx, server-actions, tanstack-table, tdd, empr-02]

# Dependency graph
requires:
  - phase: 01-funda-o-acesso-empresas-e-importa-o
    provides: "withVisibilityScope, validarCNPJ, empresaSchema/linhaImportadaSchema (Plan 03); authenticated shell, listarResponsaveis, criarEmpresa EmpresaRegimeHistorico pattern (Plan 04)"
provides:
  - "parseEmpresasXlsx/parseBloco (src/lib/excel/parse-empresas.ts) -- server-side SheetJS parser for the real 'Lista de Empresas com CNPJ.xlsx' (2 column-blocks, section-label regime detection)"
  - "scripts/inspect-planilha.mjs -- standalone count-validation script (61/79/50/7=197)"
  - "parseUploadAction + confirmarImportacao Server Actions (src/app/(app)/empresas/importar/actions.ts)"
  - "/empresas/importar 3-step wizard (Upload -> Review -> Confirm), staged entirely in React state"
affects: [02-tarefas, dashboards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ZIP/OOXML magic-byte check (PK\\x03\\x04) before XLSX.read -- SheetJS has a permissive CSV/text fallback that does NOT throw on arbitrary bytes, so extension + try/catch alone is insufficient to reject corrupted .xlsx uploads"
    - "Import staging type LinhaStaged = LinhaImportada & { id, responsavelId?, contatos?, particularidades?, incluida } -- lives only in React state until Step 3 confirm"
    - "Section-label detection: isLabelSecao(nome) && !/\\d/.test(cnpj) -- treats both pure label rows and the dual-purpose header/label row (Bloco 1 row 1) as section markers"
    - "TanStack Table meta.updateData(rowId, columnId, value) editable-cell pattern (Pattern 5), using getRowId for stable row identity instead of row index"

key-files:
  created:
    - src/lib/excel/parse-empresas.ts
    - scripts/inspect-planilha.mjs
    - src/app/(app)/empresas/importar/actions.ts
    - src/app/(app)/empresas/importar/page.tsx
    - src/app/(app)/empresas/importar/_components/ImportWizard.tsx
    - src/app/(app)/empresas/importar/_components/StepUpload.tsx
    - src/app/(app)/empresas/importar/_components/StepReview.tsx
    - src/app/(app)/empresas/importar/_components/StepConfirm.tsx
    - src/app/(app)/empresas/importar/_components/types.ts
    - data/Lista de Empresas com CNPJ.xlsx
  modified:
    - tests/import.test.ts
    - tests/import.confirm.test.ts
    - tests/import.upload.test.ts

key-decisions:
  - "RESEARCH.md Pattern 3.5 documented 61/80/50/7=198; direct SheetJS inspection (verified by CNPJ uniqueness: 197 unique CNPJs, zero duplicates, zero dropped rows) shows the real total is 61/79/50/7=197. The SIMPLES NACIONAL section contains a merged-cell sub-header 'MEI ' (B128:B129) with no CNPJ that RESEARCH.md's prior inspection miscounted as a company. All expected-count references (inspect-planilha.mjs, import.test.ts) updated to 197/79."
  - "parseUploadAction adds a ZIP/OOXML magic-byte check (PK\\x03\\x04) before XLSX.read, because SheetJS's CSV/text fallback parses arbitrary bytes as a 1-cell sheet without throwing -- the plan's 'try/catch around XLSX.read' alone does not reject a corrupted/non-xlsx file claiming a .xlsx extension."
  - "confirmarImportacao silently skips (does not persist, does not error) any incluida=true row that fails empresaSchema (missing regime, missing responsavelId, invalid CNPJ) -- the UI-side block on 'Confirmar importacao' is the primary gate, but the server re-validates as defense in depth and returns only the persisted count."
  - "The old 'Marcar todas como Lucro Real' bulk action was removed (not generalized). The parser already assigns regimeTributario to 190/197 real rows via section labels; the per-row Regime Select (3 values) plus the 'Sem regime' filter chip give fast, scoped manual correction for the remaining 7 rows without a separate bulk-edit control."
  - "LinhaStaged rows default to incluida: true on parse -- all 197 rows are pre-selected for import, but rows that are 'Sem regime' or missing responsavelId continue to block 'Confirmar importacao' while included, forcing the reviewer to either fill them in or uncheck them."

patterns-established:
  - "Server-side file-type validation for uploads should check magic bytes, not just extension + library try/catch, when the parsing library has permissive fallback formats."
  - "Import wizards: staging type = parser output type & { id, ...editable fields, incluida } kept in React state; only the final confirm action touches the database."

requirements-completed: [EMPR-02]

# Metrics
duration: 70min
completed: 2026-06-15
---

# Phase 01 Plan 05: Excel Import Wizard (Parser + Server Actions + 3-Step UI) Summary

SheetJS-based server-side parser for the real 197-row "Lista de Empresas com CNPJ.xlsx" (2 column-blocks, section-label regime detection), upload/confirm Server Actions with a ZIP-signature upload guard, and a 3-step React-state-staged import wizard with editable review table.

## What Was Built

### Task 1 — Parser + inspection script (TDD)

- `src/lib/excel/parse-empresas.ts`: `parseEmpresasXlsx(buffer)` reads the workbook via `XLSX.read` + `sheet_to_json({header:1, raw:false, defval:""})`, then runs `parseBloco` over Bloco 1 (columns A/B/C) and Bloco 2 (columns E/F/G). `parseBloco` detects section-label rows (`"LUCRO REAL"`, `"SIMPLES NACIONAL"`, `"LUCRO PRESUMIDO"`) by `isLabelSecao(nome) && !/\d/.test(cnpj)` -- this also catches the Bloco 1 header row (row 1), which doubles as the "LUCRO REAL" section label with `C0="CNPJ"` (no digits, not a real CNPJ). `regimeAtual` propagates to subsequent rows until the next label; label rows and empty rows (`!nome || !cnpj`) are skipped.
- `scripts/inspect-planilha.mjs`: standalone Node script (plain JS, no TS loader) that reimplements the same parsing logic, prints per-regime counts, and exits 1 if they don't match the expected `{LUCRO_REAL:61, SIMPLES_NACIONAL:79, LUCRO_PRESUMIDO:50, SEM_REGIME:7, TOTAL:197}`.
- `data/Lista de Empresas com CNPJ.xlsx`: moved from repo root to `data/` as the parser fixture.
- `tests/import.test.ts`: rewritten with 6 real assertions against the fixture (197 total, 61/79/50/7 per regime, no row name equals a section label).

### Task 2 — Server Actions (TDD)

- `src/app/(app)/empresas/importar/actions.ts` (`"use server"`, `auth()` guard on every export):
  - `parseUploadAction(formData)`: validates `.xlsx` extension, validates the ZIP/OOXML magic bytes (`PK\x03\x04`), then runs `parseEmpresasXlsx` in a try/catch. Any failure at any stage returns `{ ok: false, error: "Arquivo inválido. Envie um arquivo .xlsx válido." }` -- never the SheetJS error or a stack trace. Success returns `{ ok: true, linhas: LinhaImportada[] }` -- nothing persisted.
  - `confirmarImportacao(linhasRevisadas: LinhaRevisada[])`: for each `incluida=true` row, validates against `empresaSchema` (CNPJ módulo 11, regime enum required, responsavelId required); rows that fail validation or have `incluida=false` are skipped. Valid rows are persisted via `db.empresa.create` with a nested `regimeHistorico.create` (first `EmpresaRegimeHistorico` entry, `dataInicio = now`), consistent with `criarEmpresa` (Plan 04). Calls `revalidatePath("/empresas")` and returns `{ ok: true, persistidas: number }`.
- `tests/import.upload.test.ts` and `tests/import.confirm.test.ts` rewritten with 8 real tests (3 upload + 5 confirm), all GREEN.

### Task 3 — 3-step wizard UI

- `src/app/(app)/empresas/importar/page.tsx`: Server Component, `auth()` guard + redirect, fetches `listarResponsaveis()`, renders `<ImportWizard>`.
- `_components/ImportWizard.tsx`: wizard shell holding `LinhaStaged[]` in React state across all 3 steps; stepper header "Etapa X de 3"; "Descartar importação" -> `AlertDialog` ("Descartar importação?" / "Os dados revisados serão perdidos...").
- `_components/StepUpload.tsx`: drag-and-drop + "Selecionar arquivo" (`.xlsx` only), shows filename/size, "Avançar para revisão" calls `parseUploadAction`; on error shows the generic copy.
- `_components/StepReview.tsx`: summary line ("{X} prontas, {Y} CNPJ inválido, {Z} sem regime, {W} duplicadas") + clickable filter chips; editable TanStack Table (`meta.updateData`, `getRowId`) with columns Nome (input), CNPJ (input + inline "CNPJ inválido" badge via `validarCNPJ`), Regime (Select, all 3 enum values + "Sem regime" amber option, helper text when empty), Responsável (Select from `listarResponsaveis`), Contatos, Particularidades, Status badge (Pronta/CNPJ inválido/Sem regime/Duplicada), include checkbox. Duplicate detection by normalized CNPJ digits. "Confirmar importação" disabled while any **included** row is "Sem regime" or missing `responsavelId`.
- `_components/StepConfirm.tsx`: final summary (count of included rows), "Confirmar importação" with loading spinner, success `Alert` "Importação concluída: {N} empresas adicionadas." + link to `/empresas`, error `Alert` + "Tentar novamente" preserving the staged rows.
- `_components/types.ts`: `LinhaStaged`, `StatusLinha`, `STATUS_LABEL`, `STATUS_BADGE_CLASS`.

## Verification

```
node scripts/inspect-planilha.mjs
  -> OK: todas as contagens conferem com o esperado (61/79/50/7=197)

npx vitest run
  -> 9 test files, 40 tests, all PASSED

npm run build
  -> Compiled successfully, /empresas/importar route generated (5.66 kB), no warnings
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/data correction] Real spreadsheet totals are 61/79/50/7=197, not 61/80/50/7=198 (RESEARCH.md Pattern 3.5)**

- **Found during:** Task 1
- **Issue:** The plan's `must_haves`, `<behavior>`, `<acceptance_criteria>`, and `<verification>` all hardcode 61 LUCRO_REAL / 80 SIMPLES_NACIONAL / 50 LUCRO_PRESUMIDO / 7 sem-regime = 198. Direct SheetJS inspection of `data/Lista de Empresas com CNPJ.xlsx` produced 61/79/50/7=197 with the corrected parser.
- **Investigation:** Printed all Bloco 1 rows 70-156 and found a merged cell `B128:B129 = "MEI "` (trailing space) -- a SIMPLES NACIONAL sub-header with an empty CNPJ cell, not a company row. A full scan of every (nome, cnpj) pair across both blocks, plus a CNPJ-uniqueness check, confirmed **197 total rows, 197 unique CNPJs, zero duplicates, zero dropped rows** -- the true total is 197, and the "MEI " row is the source of RESEARCH.md's prior off-by-one.
- **Fix:** Updated `scripts/inspect-planilha.mjs`'s `ESPERADO` object and success message to 61/79/50/7=197 (with an explanatory NOTE docblock citing the CNPJ-uniqueness verification), and rewrote `tests/import.test.ts`'s 6 assertions to match (197/61/79/50/7), with a docstring documenting the deviation from RESEARCH.md Pattern 3.5.
- **Files modified:** `scripts/inspect-planilha.mjs`, `tests/import.test.ts`
- **Commits:** `39b0eeb` (RED), `a48d7e4` (GREEN)

**2. [Rule 1 - Bug] Original label-detection logic and `slice(2)` produced a completely wrong regime distribution**

- **Found during:** Task 1, first run of the inspection script
- **Issue:** With the original `isLabelSecao(nome) && !cnpj` check and `slice(2)`, the parser produced LUCRO_REAL=0, SIMPLES_NACIONAL=79, LUCRO_PRESUMIDO=50, "sem regime"=68, TOTAL=197 -- all 61 LUCRO REAL companies were misclassified as "sem regime".
- **Root cause:** `slice(2)` discarded row 0 (Bloco 1), which is simultaneously the column header AND the "LUCRO REAL" section label (`B0="LUCRO REAL"`, `C0="CNPJ"`). Even without the slice, `!cnpj` would fail for row 0 because `C0="CNPJ"` is a non-empty string (header text), not a real CNPJ.
- **Fix:** Changed label detection to `isLabelSecao(nome) && !/\d/.test(cnpj)` (treats any CNPJ-less-or-non-numeric cell as "not a real CNPJ"), and removed `slice(2)` entirely -- `parseBloco` now runs over the full matrix; the genuinely empty row 1 is filtered out naturally by `!nome || !cnpj`.
- **Files modified:** `src/lib/excel/parse-empresas.ts`, `scripts/inspect-planilha.mjs`
- **Commit:** `a48d7e4`

**3. [Rule 1 - Bug] SheetJS does not throw on non-ZIP "corrupted .xlsx" bytes -- extension + try/catch alone insufficient for T-01-UPLOAD**

- **Found during:** Task 2, GREEN phase (test "rejeita upload de .xlsx corrompido/ilegível com mensagem de erro genérica" failed against the initial implementation)
- **Issue:** `XLSX.read()` has a permissive CSV/text fallback: arbitrary bytes (e.g. `"isto nao e um xlsx valido"`) are parsed as a valid 1-cell, 1-sheet workbook without throwing. The plan's spec ("wrap `XLSX.read` in try/catch, return generic error on any parse failure") does not actually catch this case for a `.xlsx`-extensioned file containing non-spreadsheet bytes.
- **Fix:** Added a ZIP/OOXML magic-byte check (`buffer.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04]))`, i.e. `PK\x03\x04`) before calling `XLSX.read`. Any file not starting with this signature is rejected with the generic `"Arquivo inválido. Envie um arquivo .xlsx válido."` -- regardless of what SheetJS's fallback would have done with it.
- **Files modified:** `src/app/(app)/empresas/importar/actions.ts`
- **Commit:** `c0168ca`

### Design Decision (documented per plan instruction)

**"Marcar todas como Lucro Real" bulk action — removed, not generalized**

The plan asked to "reconsider/generalize" this bulk action since the parser already pre-populates `regimeTributario` for 190/197 rows from section labels. Decision: removed entirely. Rationale:
- Only 7/197 rows ("Sup. X") arrive with `regimeTributario === undefined`.
- The per-row Regime `<Select>` (3 enum values + "Sem regime") already supports fast inline correction.
- The "Sem regime" filter chip in the summary card isolates exactly these 7 rows for review, making a separate bulk-edit control redundant for this dataset size.
- A generic "bulk-set regime for all included rows" action risked silently overwriting correctly-parsed LUCRO_REAL/SIMPLES_NACIONAL/LUCRO_PRESUMIDO assignments for the other 190 rows if misused -- removing it avoids that footgun without losing review speed.

## Known Stubs

None. All wizard steps are fully wired: `StepUpload` -> `parseUploadAction` (real Server Action, real parser), `StepReview` -> live editable state, `StepConfirm` -> `confirmarImportacao` (real Server Action, real persistence + `EmpresaRegimeHistorico`).

## Threat Flags

None. All new surface (file upload, Server Actions, persistence) is covered by the plan's existing threat model (T-01-UPLOAD, T-01-IMPORT-AUTHZ, T-01-IMPORT-INPUT, T-01-IMPORT-CSRF) -- see Deviation 3 above for the additional magic-byte mitigation applied to T-01-UPLOAD.

## TDD Gate Compliance

- Task 1: `test(01-05)` commit `39b0eeb` (RED) -> `feat(01-05)` commit `a48d7e4` (GREEN). Compliant.
- Task 2: `test(01-05)` commit `b0bd326` (RED) -> `feat(01-05)` commit `c0168ca` (GREEN). Compliant.
- Task 3 (`type="auto"`, no `tdd`): single `feat(01-05)` commit `8c8b970`. Compliant (no TDD gate required).

## Self-Check: PASSED

All 10 created files found on disk; all 5 commits (`39b0eeb`, `a48d7e4`, `b0bd326`, `c0168ca`, `8c8b970`) found in git history.
