---
phase: quick-260626-a8d
plan: 01
subsystem: empresas
tags: [dp, listagem, empresa, schema]
dependency-graph:
  requires: []
  provides:
    - "/empresas/dp route"
    - "Empresa.temEmpregadaDomestica field"
  affects:
    - src/app/(app)/empresas/empresa-form.tsx
    - src/app/(app)/actions.ts
    - src/modules/empresas/queries.ts
tech-stack:
  added: []
  patterns:
    - "TanStack Table reused from empresas-table.tsx pattern for new dedicated DP listing"
key-files:
  created:
    - "src/app/(app)/empresas/dp/page.tsx"
    - "src/app/(app)/empresas/dp/empresas-dp-table.tsx"
  modified:
    - "prisma/schema.prisma"
    - "src/modules/empresas/schema.ts"
    - "src/modules/empresas/queries.ts"
    - "src/app/(app)/actions.ts"
    - "src/app/(app)/empresas/empresa-form.tsx"
    - "src/app/(app)/empresas/[id]/editar/page.tsx"
    - "src/app/(app)/app-sidebar.tsx"
    - "tests/empresas.derive-rows.test.ts"
decisions:
  - "Não usado `prisma db push`/`migrate` neste ambiente local (sem DATABASE_URL) — apenas edição textual de schema.prisma + `npx prisma generate`. Aplicação no banco fica pendente (ver Manual Step Pending abaixo)."
  - "Rota DP implementada como Server Component dedicado (/empresas/dp), reaproveitando listarEmpresas (withVisibilityScope) e o padrão TanStack Table de empresas-table.tsx, em vez de reusar deriveEmpresaRows — listagem DP só precisa de 1 responsável (DP), não dos 3 setores condicionais por role."
  - "Coluna 'Responsável DP' renderiza string vazia (nunca placeholder/badge) quando não há responsável atribuído, e linhas sem responsável DP nunca são omitidas — conforme CONTEXT.md."
metrics:
  duration: "~25 min"
  completed: "2026-06-26"
---

# Phase quick-260626-a8d Plan 01: Listagem de empresas DP com responsável + empregada doméstica Summary

Nova rota `/empresas/dp` exibindo o responsável de DP de cada empresa (célula vazia quando ausente, nunca placeholder) e um indicador "Empregada doméstica" — adicionando o campo informativo `Empresa.temEmpregadaDomestica` propagado por schema/Server Actions/queries/formulário.

## What Was Built

1. **Campo `temEmpregadaDomestica`** (Boolean, default `false`) adicionado ao model `Empresa` em `prisma/schema.prisma`, ao `empresaSchema` (Zod), à camada de dados (`EMPRESA_SELECT`) e às Server Actions `criarEmpresa`/`editarEmpresa` (sem guard DONO-only — qualquer usuário no escopo de edição pode marcar/desmarcar, conforme CONTEXT.md).
2. **Formulário de empresa** (`empresa-form.tsx`) ganhou um checkbox "Tem empregada doméstica?" no mesmo padrão visual de `temFuncionariosClt`, com texto auxiliar deixando claro que é apenas marcação informativa e não dispara geração automática de tarefas. A página de edição pré-popula o valor atual.
3. **Rota `/empresas/dp`** (Server Component) chama `listarEmpresas(session.user)` (mantendo `withVisibilityScope` — colaborador vê só sua carteira, dono vê todas) e mapeia cada empresa para `{ id, nome, cnpj, responsavelDp, temEmpregadaDomestica }`, derivando `responsavelDp` diretamente de `responsaveisPorSetor.find(setor === "DP")`.
4. **`EmpresasDpTable`** (client component, TanStack Table) com colunas Nome / CNPJ / Responsável DP (vazio quando `null`, nunca omitido) / Empregada doméstica (Badge "Sim" ou vazio) / Ações (editar). Busca por nome/CNPJ e paginação de 20, espelhando `empresas-table.tsx`.
5. **Sidebar** ganhou um novo item "Empresas DP" (ícone `Users`) linkando para `/empresas/dp`; o item "Empresas" existente foi ajustado para não ficar ativo simultaneamente quando a rota é `/empresas/dp`.

## Verification

- `npx prisma validate` — OK.
- `npx prisma generate` — OK (client regenerado a partir do schema editado).
- `npx tsc --noEmit` — sem erros (após Tasks 1, 2 e 3).
- `npm run lint` — 0 erros (4 warnings pré-existentes, não relacionados a esta plan).
- `npm run build` — sucesso; rota `/empresas/dp` presente no manifesto de rotas (`ƒ /empresas/dp 3.19 kB 133 kB`).
- `npm test` (vitest) — 29 arquivos / 171 testes, todos passando (nenhuma regressão).

## Manual Step Pending (IMPORTANT — read before considering this done in produção)

Este ambiente local **não tem `DATABASE_URL`/`DIRECT_URL` configurados** (sem `.env`/`.env.local`), portanto **não foi possível conectar ao banco** para aplicar a migração. O campo `temEmpregadaDomestica` foi adicionado **apenas no arquivo `prisma/schema.prisma`** (edição textual) e `npx prisma generate` foi executado (gera apenas o client TypeScript a partir do schema, sem tocar o banco).

**Ação necessária na máquina com acesso ao banco (Neon/produção):**

```bash
npx prisma db push
```

(Convenção já registrada no projeto — Neon não tem shadow database, por isso `db push` e não `prisma migrate dev`.) Como o campo é `Boolean @default(false)`, todas as linhas existentes de `Empresa` recebem `false` automaticamente, sem perda de dados.

Depois de rodar `db push`, rodar novamente `npx prisma generate` nessa máquina para garantir que o client gerado lá também reflete o schema (normalmente o próprio `db push` já dispara o generate, mas é seguro confirmar).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixture de teste `tests/empresas.derive-rows.test.ts` não tinha o novo campo**
- **Found during:** Task 1, verificação `npx tsc --noEmit`
- **Issue:** O fixture `montarFixtures()` espelha o shape de `EMPRESA_SELECT` (usado como argumento de tipo em `deriveEmpresaRows`); como `temEmpregadaDomestica: true` foi adicionado ao select, o tipo do parâmetro passou a exigir o campo, e o teste não compilava.
- **Fix:** Adicionado `temEmpregadaDomestica: false` ao objeto de fixture (campo não é consumido pela lógica de `deriveEmpresaRows`, apenas precisa satisfazer o tipo).
- **Files modified:** `tests/empresas.derive-rows.test.ts`
- **Commit:** 6b4c9db

Nenhum outro desvio. Plan executado conforme escrito, dentro da constraint de ambiente sem DB.

## Known Stubs

Nenhum stub introduzido. Toda a UI está conectada a dados reais (`listarEmpresas`); não há dados mockados/placeholder.

## Threat Flags

Nenhuma nova superfície de ameaça introduzida. A rota `/empresas/dp` reaproveita `listarEmpresas` (mesma fronteira `withVisibilityScope` já coberta pelo threat model existente de `/empresas`); o campo `temEmpregadaDomestica` é puramente informativo, sem novo endpoint de rede, sem mudança de auth path, sem novo campo sensível.

## Self-Check: PASSED

Arquivos criados/modificados verificados:
- FOUND: src/app/(app)/empresas/dp/page.tsx
- FOUND: src/app/(app)/empresas/dp/empresas-dp-table.tsx
- FOUND: prisma/schema.prisma (campo temEmpregadaDomestica confirmado)

Commits verificados:
- FOUND: 6b4c9db (Task 1)
- FOUND: 4767c95 (Task 2)
- FOUND: 68edf7a (Task 3)
