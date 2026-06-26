---
phase: quick-260626-c8i
plan: 01
subsystem: seed-data
tags: [usuarios, seed, rename, one-off-script]
dependency-graph:
  requires: []
  provides: [renamed-seed-placeholders-dp2-dp3-dp4-contabil2-contabil3]
  affects: [prisma/seed.ts]
tech-stack:
  added: []
  patterns: ["one-off rename script mirroring scripts/renomear-usuarios-neto-lauany-elisabete.mjs"]
key-files:
  created:
    - scripts/renomear-usuarios-andre-mirella-lorraine-rany-sarah.mjs
  modified:
    - prisma/seed.ts
decisions: []
metrics:
  duration: 5min
  completed: 2026-06-26
---

# Quick Task 260626-c8i: Renomear DP2/DP3/DP4/Contabil2/Contabil3 Summary

Atualizados os literais placeholder no seed e criado script one-off dry-run-by-default para aplicar o mesmo rename em producao via email, seguindo exatamente o padrão do script de referência `renomear-usuarios-neto-lauany-elisabete.mjs`.

## What Was Built

1. **`prisma/seed.ts`** — Alterado SOMENTE o campo `nome` de 5 das 12 entradas do array `usuarios`, identificadas por email:
   - `dp2@escritorio.com.br`: `"DP2"` → `"Andre"`
   - `dp3@escritorio.com.br`: `"DP3"` → `"Mirella"`
   - `dp4@escritorio.com.br`: `"DP4"` → `"Lorraine"`
   - `contabil2@escritorio.com.br`: `"Contabil2"` → `"Rany"`
   - `contabil3@escritorio.com.br`: `"Contabil3"` → `"Sarah"`

   Email, role, setor e as demais 7 linhas (Neto, Colaborador 1-4, Lauany, Elisabete) permaneceram inalterados. A lógica do loop `upsert` não foi tocada.

2. **`scripts/renomear-usuarios-andre-mirella-lorraine-rany-sarah.mjs`** (novo) — Script one-off espelhando exatamente o padrão de `scripts/renomear-usuarios-neto-lauany-elisabete.mjs`:
   - Dry-run por padrão (apenas loga "atual -> novo" para os 5 usuários, sem escrever).
   - Modo `--apply` executa `db.usuario.update({ where: { email }, data: { nome } })` para cada um dos 5 pares.
   - Verificação obrigatória pós-apply: re-consulta os 5 usuários e compara `nome` final esperado vs encontrado; define `process.exitCode = 1` em qualquer divergência.
   - **Não foi executado nesta sessão** — apenas criado e verificado sintaticamente (`node --check`).

## Run Command (for the orchestrator)

```bash
# Dry-run (padrão, recomendado primeiro):
node --env-file=.env.production scripts/renomear-usuarios-andre-mirella-lorraine-rany-sarah.mjs

# Aplicar de fato no banco de produção:
node --env-file=.env.production scripts/renomear-usuarios-andre-mirella-lorraine-rany-sarah.mjs --apply
```

## Why Two Change Points

O loop `upsert` do seed usa `update: {}`, que **nunca** retroage o campo `nome` em usuários já existentes no banco — apenas afeta a criação de bancos novos/limpos. Por isso, qualquer rename de usuário existente em produção exige um script one-off dedicado por email, além da correção do literal no seed (para consistência futura). Mesmo padrão exato do quick task anterior 260625-mgd.

## Verification

- `node --check scripts/renomear-usuarios-andre-mirella-lorraine-rany-sarah.mjs` — passou.
- Script contém os 5 pares email/nome, token `--apply`, `RENOMEACOES`, `process.exitCode`.
- Regex de campo proibido (`senhaHash`/`email`/`role`/`setor` dentro de `data: {...}`) — não encontrado; script escreve somente `nome`.
- `prisma/seed.ts`: presença confirmada de `"Andre"`, `"Mirella"`, `"Lorraine"`, `"Rany"`, `"Sarah"`; ausência confirmada de `"DP2"`, `"DP3"`, `"DP4"`, `"Contabil2"`, `"Contabil3"`.

## Deviations from Plan

None - plan executed exactly as written.

## Auth Gates

None encountered.

## Known Stubs

None.

## Threat Flags

None — alterações restritas a renomear placeholders de nome; nenhuma superfície nova de rede, auth, ou schema introduzida.

## Self-Check: PASSED

- FOUND: prisma/seed.ts (modified, verified content)
- FOUND: scripts/renomear-usuarios-andre-mirella-lorraine-rany-sarah.mjs (created, `node --check` passed)
- FOUND: commit 9127797 (fix(quick-260626-c8i): renomear placeholders DP2/DP3/DP4/Contabil2/Contabil3 no seed)
- FOUND: commit 630ec55 (feat(quick-260626-c8i): adicionar script one-off de rename para producao)
