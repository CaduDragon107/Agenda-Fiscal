---
phase: quick
plan: 260625-mgd
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/seed.ts
  - scripts/renomear-usuarios-neto-lauany-elisabete.mjs
autonomous: true
requirements: []
must_haves:
  truths:
    - "Novos ambientes (dev/CI) nascem com os 3 nomes corretos via seed.ts"
    - "Existe um script one-off dry-run/--apply para renomear os 3 usuarios em producao por email"
    - "O agente NAO executa o script; o comando exato de execucao fica documentado para o usuario"
  artifacts:
    - path: "prisma/seed.ts"
      provides: "Nomes corretos (Neto/Lauany/Elisabete) nos literais de seed dos 3 usuarios alvo"
      contains: "nome: \"Neto\""
    - path: "scripts/renomear-usuarios-neto-lauany-elisabete.mjs"
      provides: "Script one-off dry-run/--apply para rename em producao por email"
      contains: "--apply"
  key_links:
    - from: "scripts/renomear-usuarios-neto-lauany-elisabete.mjs"
      to: "db.usuario.update (por email)"
      via: "updateMany/update gated por flag --apply"
      pattern: "usuario\\.update"
---

<objective>
Renomear 3 usuarios — alterando APENAS o campo `nome`, nunca email/senhaHash/role/setor:

1. "Dono do Escritório" (dono@escritorio.com.br) -> "Neto"
2. "DP1" (dp1@escritorio.com.br) -> "Lauany"
3. "Contabil1" (contabil1@escritorio.com.br) -> "Elisabete"

Purpose: Substituir os nomes placeholder dos 3 usuarios reais ja em uso. Caio (colaborador1@) ja esta correto; DP2-4 e Contabil2-3 permanecem placeholder (fora de escopo).
Output: (1) seed.ts atualizado para que novos ambientes nasçam corretos; (2) script one-off dry-run/--apply que o usuario rodara manualmente contra o Neon de producao apos o deploy.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@prisma/seed.ts
@scripts/backfill-setor-colaboradores-fiscal.mjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Atualizar literais de nome no seed.ts</name>
  <files>prisma/seed.ts</files>
  <action>No array `usuarios` de prisma/seed.ts, alterar SOMENTE o campo `nome` de tres entradas, identificadas pelo `email` (campo estavel, nunca alterar): a entrada com email "dono@escritorio.com.br" muda `nome` de "Dono do Escritório" para "Neto"; a entrada com email "dp1@escritorio.com.br" muda `nome` de "DP1" para "Lauany"; a entrada com email "contabil1@escritorio.com.br" muda `nome` de "Contabil1" para "Elisabete". NAO alterar `email`, `role` nem `setor` de nenhuma entrada. NAO tocar nas demais 9 entradas (colaborador1-4, dp2-4, contabil2-3 permanecem exatamente como estao). Manter o loop `upsert` intacto — observe que ele usa `update: {}`, entao o seed sozinho NAO retroage nomes em bancos ja populados; por isso a Task 2 (script de producao) e necessaria.</action>
  <verify>grep -c 'nome: "Neto"\|nome: "Lauany"\|nome: "Elisabete"' prisma/seed.ts retorna 3; e grep -c 'nome: "DP1"\|nome: "Contabil1"\|"Dono do Escritório"' prisma/seed.ts retorna 0</verify>
  <done>seed.ts contem nome: "Neto", nome: "Lauany" e nome: "Elisabete" nas entradas dos 3 emails alvo; nenhum dos 3 nomes antigos permanece; email/role/setor inalterados; demais 9 usuarios intactos.</done>
</task>

<task type="auto">
  <name>Task 2: Criar script one-off de rename para producao (dry-run/--apply)</name>
  <files>scripts/renomear-usuarios-neto-lauany-elisabete.mjs</files>
  <action>Criar scripts/renomear-usuarios-neto-lauany-elisabete.mjs seguindo o padrao EXATO de scripts/backfill-setor-colaboradores-fiscal.mjs: shebang `#!/usr/bin/env node`; cabecalho de comentario explicando o proposito (renomear 3 usuarios por email, apenas o campo nome, distinto do seed que usa update:{}); `import { PrismaClient } from "@prisma/client"`; const `APPLY = process.argv.includes("--apply")`; um mapa de renomeacoes como array de objetos `{ email, nome }` com exatamente as 3 entradas (dono@escritorio.com.br -> "Neto", dp1@escritorio.com.br -> "Lauany", contabil1@escritorio.com.br -> "Elisabete"). Em main(): instanciar `new PrismaClient()` dentro de try/finally com `db.$disconnect()`. Primeiro fazer um `findMany` dos 3 emails selecionando `{ id, nome, email }` e logar o modo (APPLY vs DRY-RUN) e, para cada usuario encontrado, a transicao "nome atual -> nome novo". Se nao for APPLY, logar que e dry-run e retornar sem escrever. Se for APPLY, iterar e fazer `db.usuario.update({ where: { email }, data: { nome } })` por entrada (update por email, atualizando SOMENTE `nome` — jamais incluir senhaHash/role/setor no `data`); contar quantos foram atualizados e logar. Verificacao final obrigatoria: re-consultar os 3 emails e confirmar que cada `nome` bate com o esperado; se algum divergir, `console.error` e `process.exitCode = 1`. Chamar `main()` no fim. NAO executar o script — nao ha DATABASE_URL de producao neste ambiente; apenas criar o arquivo.</action>
  <verify>node --check scripts/renomear-usuarios-neto-lauany-elisabete.mjs passa (sintaxe valida); e grep -c '"Neto"\|"Lauany"\|"Elisabete"' scripts/renomear-usuarios-neto-lauany-elisabete.mjs retorna 3; e grep -c -- '--apply' scripts/renomear-usuarios-neto-lauany-elisabete.mjs e maior que 0</verify>
  <done>Script existe, passa node --check, contem as 3 renomeacoes por email, roda em dry-run por padrao e so escreve com --apply, atualiza apenas o campo nome via db.usuario.update, e faz verificacao final de contagem/exitCode. O agente NAO executou o script.</done>
</task>

</tasks>

<verification>
- prisma/seed.ts: 3 nomes novos presentes, 3 nomes antigos ausentes, email/role/setor intactos, 9 demais usuarios inalterados.
- scripts/renomear-usuarios-neto-lauany-elisabete.mjs: passa `node --check`, padrao dry-run/--apply do backfill existente, escreve apenas `nome`.
- Script NAO foi executado pelo agente (sem DATABASE_URL de producao local).
</verification>

<success_criteria>
- Os 3 nomes (Neto/Lauany/Elisabete) aparecem no seed.ts nas entradas corretas por email; nenhum nome antigo remanescente.
- Script one-off criado, valido, dry-run por padrao, --apply para efetivar, alterando exclusivamente o campo `nome`.
- Comando exato de execucao documentado no SUMMARY para o usuario rodar apos o deploy.
</success_criteria>

<output>
Create `.planning/quick/260625-mgd-renomear-usuarios-dono-neto-dp1-lauany-c/260625-mgd-SUMMARY.md` when done.

No SUMMARY incluir, textualmente, o comando que o USUARIO deve rodar manualmente contra o Neon de producao (o agente NAO roda):

```
# 1) Conferir (dry-run, nao escreve nada):
node --env-file=.env.production scripts/renomear-usuarios-neto-lauany-elisabete.mjs

# 2) Aplicar de verdade:
node --env-file=.env.production scripts/renomear-usuarios-neto-lauany-elisabete.mjs --apply
```

(Ajustar o nome do arquivo de env para o que contiver a DATABASE_URL de producao do Neon — ex.: `.env`, `.env.production` ou export inline da DATABASE_URL.)
</output>
