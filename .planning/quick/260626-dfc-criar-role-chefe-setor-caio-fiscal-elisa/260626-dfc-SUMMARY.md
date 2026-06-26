---
phase: quick-260626-dfc
plan: 01
subsystem: auth/visibility-scope/empresas/tarefas
tags: [rbac, chefe-setor, visibility-scope, idor]
requires:
  - src/lib/visibility-scope.ts
  - src/lib/tipo-obrigacao-setor.ts
  - src/types/next-auth.d.ts
provides:
  - "Role.CHEFE_SETOR (enum Prisma)"
  - "AppRole estendido com CHEFE_SETOR"
  - "branches CHEFE_SETOR em withVisibilityScope/withTarefaScope"
affects:
  - src/app/(app)/tarefas/actions.ts
  - src/app/(app)/tarefas/page.tsx
  - src/app/(app)/actions.ts
  - src/app/(app)/empresas/empresa-form.tsx
  - src/app/(app)/empresas/novo/page.tsx
  - "src/app/(app)/empresas/[id]/editar/page.tsx"
tech-stack:
  added: []
  patterns:
    - "Guard por-campo (responsavelFiscalId/DpId/ContabilId) avaliado individualmente por setor, não um único guard DONO-only"
    - "withVisibilityScope/withTarefaScope continuam como única fonte de verdade de escopo — branch novo propaga automaticamente para todos os call-sites existentes"
key-files:
  created:
    - scripts/promover-chefes-setor.mjs
  modified:
    - prisma/schema.prisma
    - prisma/seed.ts
    - src/types/next-auth.d.ts
    - src/lib/visibility-scope.ts
    - tests/setup.ts
    - tests/visibility-scope.test.ts
    - src/app/(app)/tarefas/actions.ts
    - src/app/(app)/tarefas/page.tsx
    - src/app/(app)/actions.ts
    - src/app/(app)/empresas/empresa-form.tsx
    - src/app/(app)/empresas/novo/page.tsx
    - "src/app/(app)/empresas/[id]/editar/page.tsx"
    - src/app/(app)/app-sidebar.tsx
    - src/app/(app)/empresas/derive-rows.ts
    - src/app/(app)/usuarios/usuarios-table.tsx
decisions:
  - "CHEFE_SETOR usa sempre a junction table (responsaveisPorSetor) em withVisibilityScope, inclusive para FISCAL — não reusa o shape legado { responsavelId } reservado ao branch COLABORADOR/FISCAL"
  - "Geração mensal de tarefas continua GLOBAL mesmo quando disparada por um CHEFE_SETOR — não existe uma variante 'só do meu setor'"
  - "Exclusão de tarefas da competência atual permanece exclusiva do DONO (ação destrutiva, fora de escopo desta tarefa)"
metrics:
  duration: "~35min"
  completed: "2026-06-26"
---

# Quick Task 260626-dfc: Criar role CHEFE_SETOR (Caio/Elisabete/Lauany) Summary

Novo papel `CHEFE_SETOR` equivalente ao DONO porém restrito ao próprio setor: visão total de empresas/tarefas do setor via branches dedicados em `withVisibilityScope`/`withTarefaScope`, atribuição de tarefa avulsa limitada a colegas do mesmo setor, edição por-campo do responsável de setor no formulário de empresa, e acesso ao botão "Gerar tarefas do mês" (exclusão de competência continua DONO-only).

## What Was Built

- `enum Role` (Prisma) e `AppRole` (next-auth.d.ts) estendidos com `CHEFE_SETOR`.
- `prisma/seed.ts`: Caio (`colaborador1@escritorio.com.br`), Lauany (`dp1@escritorio.com.br`) e Elisabete (`contabil1@escritorio.com.br`) promovidos de `COLABORADOR` para `CHEFE_SETOR` (setor inalterado).
- `withVisibilityScope`: novo branch `CHEFE_SETOR` retorna `{ responsaveisPorSetor: { some: { setor } } }` — todas as empresas do setor, sem restrição por `usuarioId`; fail-safe `{ id: "__no_setor_defined__" }` se `setor` for null.
- `withTarefaScope`: novo branch `CHEFE_SETOR` retorna `tarefaSetorWhere(setor)` (recorrentes por `tipoObrigacao`, avulsas por `responsavel.setor`); fallback `{ responsavelId: user.id }` se `setor` for null.
- `criarTarefa`: guard server-side rejeita CHEFE_SETOR atribuindo tarefa a alvo de outro setor (ou inexistente), buscando o setor real do alvo no banco — nunca confia em input do client.
- `gerarTarefasDoMesAction`: liberado para CHEFE_SETOR além de DONO; geração permanece global. Botão "Gerar tarefas do mês" visível para CHEFE_SETOR; "Excluir tarefas da competência" continua DONO-only.
- `EmpresaForm`: prop `isDono` substituída por 3 booleans `podeEditarFiscal`/`podeEditarDp`/`podeEditarContabil`, calculados server-side em `novo/page.tsx` e `[id]/editar/page.tsx`.
- `criarEmpresa`/`editarEmpresa`: guard por-campo — cada um dos 3 responsáveis (Fiscal/DP/Contábil) só honra o valor submetido quando `isDono || (isChefe && setorChefe === setorDoCampo)`, senão mantém o fallback já existente (null na criação / valor atual na edição).
- `scripts/promover-chefes-setor.mjs`: script one-off dry-run/--apply para promover os 3 emails para `CHEFE_SETOR` em produção — criado e validado sintaticamente, **não executado** nesta sessão.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npx prisma generate` necessário para `tsc --noEmit` passar**
- **Found during:** Task 3 (verificação tsc após estender `enum Role`)
- **Issue:** O client Prisma gerado estava desatualizado em relação ao `schema.prisma` recém-editado (`Role.CHEFE_SETOR` referenciado em `seed.ts` não existia no client gerado).
- **Fix:** Executado `npx prisma generate` (schema-only, sem `DATABASE_URL`/conexão ao banco) — permitido explicitamente pelas constraints do ambiente desta execução.
- **Files modified:** nenhum arquivo de código (apenas regeneração de `node_modules/@prisma/client`).
- **Commit:** N/A (artefato gerado, não versionado).

**2. [Rule 3 - Blocking] 3 arquivos fora do escopo do plano bloqueavam `tsc --noEmit`**
- **Found during:** Task 3 (full tsc check)
- **Issue:** `src/app/(app)/empresas/derive-rows.ts` (`ViewerRole`), `src/app/(app)/app-sidebar.tsx` (`AppSidebarUser.role`) e `src/app/(app)/usuarios/usuarios-table.tsx` (`UsuarioRow.role`) tinham unions estreitas (`"COLABORADOR" | "DONO"`) que deixaram de aceitar `AppRole`/`Role` agora que `CHEFE_SETOR` foi adicionado — erro de tipo bloqueante, não comportamental.
- **Fix:** União ampliada para incluir `"CHEFE_SETOR"` nos 3 arquivos; adicionado label `"Chefe de Setor"` em `ROLE_LABEL` de `usuarios-table.tsx`. Nenhuma lógica de negócio alterada — `derive-rows.ts` já tratava corretamente qualquer `role !== "DONO"` como "só o próprio setor" (comportamento correto para CHEFE_SETOR, ainda que a tela `/empresas`/`/usuarios` esteja fora do escopo funcional desta tarefa).
- **Files modified:** `src/app/(app)/empresas/derive-rows.ts`, `src/app/(app)/app-sidebar.tsx`, `src/app/(app)/usuarios/usuarios-table.tsx`.
- **Commit:** 39bd379 (agrupado com Task 3, mesmo commit que liberou o botão Gerar tarefas, por serem fixes de tipo necessários para o build compilar limpo).

## TDD Gate Compliance

Task 2 (`tdd="true"`) seguiu o ciclo RED → GREEN corretamente:
- RED: commit `10390fc` (`test(quick-260626-dfc): add failing tests...`) — 3 testes novos falhando antes da implementação, confirmado via `npx vitest run` (3 failed / 10 passed).
- GREEN: commit `338b4e2` (`feat(quick-260626-dfc): branches CHEFE_SETOR...`) — todos os 13 testes de `visibility-scope.test.ts` + `tipo-obrigacao-setor.test.ts` passando.
- REFACTOR: não necessário (implementação já minimalista).

## Verification

- `npx tsc --noEmit -p tsconfig.json` — limpo, sem erros.
- `npx vitest run` — 191/191 testes passando (31 arquivos), incluindo os 4 testes de regressão pré-v2.0 (COLABORADOR/DONO) inalterados e os 6 novos casos CHEFE_SETOR.
- `npm run build` — build de produção concluído com sucesso (`✓ Compiled successfully`); apenas 2 warnings de ESLint pré-existentes e não relacionados (`tarefas-table.tsx` useMemo deps, `scheduler.ts` eslint-disable não usado).
- `node --check scripts/promover-chefes-setor.mjs` — sintaticamente válido; script **não executado**.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma nova superfície de ataque introduzida fora do `<threat_model>` do plano — todas as 5 ameaças registradas (T-dfc-01 a T-dfc-05) foram mitigadas conforme descrito:
- T-dfc-01 (criarTarefa cross-setor): guard server-side busca setor real do alvo no banco.
- T-dfc-02 (criarEmpresa/editarEmpresa campo cross-setor): guard por-campo.
- T-dfc-03 (vazamento de visibilidade): branch CHEFE_SETOR escopado por setor da sessão, fail-safe em setor null.
- T-dfc-04 (exclusão de competência): mantido DONO-only por decisão explícita, não alterado.
- T-dfc-05 (script de promoção): dry-run por padrão, escreve só `role`, não executado.

## Pending Manual Steps (outside this plan's scope)

- Migração de schema (`npx prisma db push`) em produção para adicionar `CHEFE_SETOR` ao enum `Role` — não executada nesta sessão, fica a cargo do orquestrador.
- Execução do script `scripts/promover-chefes-setor.mjs --apply` em produção (após a migração de schema acima) — não executada nesta sessão.

## Self-Check: PASSED

- FOUND: scripts/promover-chefes-setor.mjs
- FOUND: prisma/schema.prisma (CHEFE_SETOR presente)
- FOUND: src/lib/visibility-scope.ts (branches CHEFE_SETOR presentes)
- FOUND commit c90cfba
- FOUND commit 10390fc
- FOUND commit 338b4e2
- FOUND commit 39bd379
- FOUND commit 7c900d7
- FOUND commit acc0d2b
