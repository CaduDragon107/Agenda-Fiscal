---
status: testing
phase: 07-motor-de-gera-o-cont-bil-mensal-e-anual
source: [07-VERIFICATION.md]
started: 2026-06-24T19:07:32Z
updated: 2026-06-24T19:07:32Z
---

## Current Test

number: 1
name: Confirm DEFIS due-date semantics against the real Simples Nacional DEFIS deadline rule
expected: |
  Either (a) confirm the 13-month creation-to-deadline gap for DEFIS (created Feb of year Y,
  due March of year Y+1) is the intended real-world behavior, matching how "ano-base" is
  defined for DEFIS reporting; or (b) flag as a defect requiring a same-year due-date fix.
awaiting: user response

## Tests

### 1. Confirm DEFIS due-date semantics against the real Simples Nacional DEFIS deadline rule
expected: Either (a) confirm the 13-month creation-to-deadline gap for DEFIS (created Feb of year Y, due March of year Y+1) is the intended real-world behavior, matching how "ano-base" is defined for DEFIS reporting; or (b) flag as a defect requiring a same-year due-date fix. The code faithfully implements CONTEXT.md D-07/D-08 and RESEARCH.md Pitfall 2 exactly as documented and user-confirmed during context-gathering — this is a domain/regulatory judgment call, not a code defect.
result: [pending]

### 2. Confirm success criterion #4 wording ("atribuí-la a si mesmo ou a outro colega do Contábil") against the actual criarTarefa() authorization rule
expected: Either acknowledge that COLABORADOR role can only self-assign avulsa tasks (cannot assign to a colleague — only DONO can assign to others) as the accepted real behavior, matching the identical pre-existing wording/behavior gap already accepted in Phase 6 for DP-05; or flag as a requirement that needs the criarTarefa() authorization model changed.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
