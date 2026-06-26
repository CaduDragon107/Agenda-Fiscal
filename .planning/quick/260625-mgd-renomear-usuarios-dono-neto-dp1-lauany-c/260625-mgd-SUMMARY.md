---
phase: quick
plan: 260625-mgd
subsystem: seed-data
tags: [seed, usuarios, rename, one-off-script]
dependency-graph:
  requires: []
  provides: [nomes-corretos-seed, script-rename-producao]
  affects: [prisma/seed.ts]
tech-stack:
  added: []
  patterns: [dry-run/--apply one-off script seguindo padrao de scripts/backfill-setor-colaboradores-fiscal.mjs]
key-files:
  created:
    - scripts/renomear-usuarios-neto-lauany-elisabete.mjs
  modified:
    - prisma/seed.ts
decisions: []
metrics:
  duration: 5min
  completed: 2026-06-26
---

# Quick Task 260625-mgd: Renomear usuarios Dono/DP1/Contabil1 Summary

Renomeado o campo `nome` de 3 usuarios placeholder (Dono do Escritório, DP1, Contabil1) para os nomes reais (Neto, Lauany, Elisabete) no seed.ts, e criado script one-off dry-run/--apply para retroaplicar o mesmo rename em producao.

## What Was Built

### Task 1 — `prisma/seed.ts`
Atualizados os literais `nome` de 3 das 12 entradas do array `usuarios`, identificadas por `email` (campo estavel):

| Email | Nome antigo | Nome novo |
|---|---|---|
| dono@escritorio.com.br | Dono do Escritório | Neto |
| dp1@escritorio.com.br | DP1 | Lauany |
| contabil1@escritorio.com.br | Contabil1 | Elisabete |

`email`, `role` e `setor` permanecem inalterados nas 3 entradas. As demais 9 entradas (colaborador1-4, dp2-4, contabil2-3) não foram tocadas. O loop `upsert` continua usando `update: {}`, ou seja, o seed por si só **não** retroage nomes em bancos já populados — daí a necessidade da Task 2.

### Task 2 — `scripts/renomear-usuarios-neto-lauany-elisabete.mjs`
Script one-off seguindo o padrão exato de `scripts/backfill-setor-colaboradores-fiscal.mjs`:
- Roda em **dry-run por padrão** (apenas lista as transições nome-atual -> nome-novo).
- Só escreve no banco com a flag `--apply`.
- Faz `update` por `email`, alterando **somente** o campo `nome` (nunca `senhaHash`/`role`/`setor`).
- Verificação obrigatória ao final (modo `--apply`): re-consulta os 3 emails e confirma que cada `nome` bate com o esperado; qualquer divergência seta `process.exitCode = 1`.

O agente **não executou** o script — não há `DATABASE_URL` de produção neste ambiente local.

## Comando para o usuário rodar manualmente (apos deploy)

```
# 1) Conferir (dry-run, nao escreve nada):
node --env-file=.env.production scripts/renomear-usuarios-neto-lauany-elisabete.mjs

# 2) Aplicar de verdade:
node --env-file=.env.production scripts/renomear-usuarios-neto-lauany-elisabete.mjs --apply
```

Ajustar o nome do arquivo de env para o que contiver a `DATABASE_URL` de produção do Neon (ex.: `.env`, `.env.production`, ou export inline da variável).

## Verification

- `grep -c 'nome: "Neto"\|nome: "Lauany"\|nome: "Elisabete"' prisma/seed.ts` → 3
- `grep -c 'nome: "DP1"\|nome: "Contabil1"\|"Dono do Escritório"' prisma/seed.ts` → 0
- `node --check scripts/renomear-usuarios-neto-lauany-elisabete.mjs` → sintaxe válida
- `grep -c '"Neto"\|"Lauany"\|"Elisabete"' scripts/renomear-usuarios-neto-lauany-elisabete.mjs` → 6 (aparecem tanto no comentário de cabeçalho quanto no array `RENOMEACOES`)
- `grep -c -- '--apply' scripts/renomear-usuarios-neto-lauany-elisabete.mjs` → 4

## Deviations from Plan

None - plan executed exactly as written.

## Commits

- `1f3ac91`: fix(quick-260625-mgd): renomear Dono/DP1/Contabil1 para Neto/Lauany/Elisabete no seed
- `cd68e63`: feat(quick-260625-mgd): script one-off dry-run/--apply para renomear 3 usuarios em producao

## Self-Check: PASSED

- FOUND: prisma/seed.ts (modified, contains nome: "Neto", "Lauany", "Elisabete")
- FOUND: scripts/renomear-usuarios-neto-lauany-elisabete.mjs
- FOUND: commit 1f3ac91
- FOUND: commit cd68e63
