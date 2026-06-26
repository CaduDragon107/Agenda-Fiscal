---
phase: quick-260626-d1a
plan: 01
subsystem: usuarios
tags: [rbac, server-action, dono-only, usuarios]
dependency-graph:
  requires: []
  provides:
    - "editarNomeUsuarioAction"
    - "/usuarios route"
  affects:
    - "src/app/(app)/app-sidebar.tsx"
tech-stack:
  added: []
  patterns:
    - "Guard role===DONO antes de qualquer acesso ao banco (mirror de gerarTarefasDoMesAction)"
    - "Server Component DONO-only com redirect (não notFound) para gating de rota"
key-files:
  created:
    - "src/app/(app)/usuarios/actions.ts"
    - "src/app/(app)/usuarios/page.tsx"
    - "src/app/(app)/usuarios/usuarios-table.tsx"
    - "tests/usuarios.actions.test.ts"
  modified:
    - "src/app/(app)/app-sidebar.tsx"
decisions:
  - "usuarioSchema.shape.nome (pedido pelo plano) não existe em runtime porque usuarioSchema é envolvido em .superRefine (ZodEffects, sem .shape) — substituído por um z.string().min(1) local com a mesma mensagem de erro, mantendo o comportamento de validação idêntico"
metrics:
  duration: "~25 min"
  completed: "2026-06-26"
---

# Quick Task 260626-d1a: Página /usuarios (DONO) para editar o nome Summary

Server Action `editarNomeUsuarioAction` (DONO-only, atualiza somente `nome`) + página `/usuarios` com tabela e Dialog de edição + item de sidebar condicional, eliminando a necessidade de scripts one-off de renomeação.

## What Was Built

- **`src/app/(app)/usuarios/actions.ts`** — `editarNomeUsuarioAction(usuarioId, novoNome)`:
  1. Rejeita não autenticado (`auth()` null) sem tocar no banco.
  2. Rejeita `COLABORADOR` com `{ ok:false, error:"não autorizado" }` ANTES de qualquer acesso ao banco (T-d1a-01).
  3. Valida `nome` (trim + min(1)) — nome vazio/só-espaços rejeitado sem update.
  4. `db.usuario.update({ where:{id}, data:{ nome } })` — SOMENTE o campo `nome`, nunca email/role/setor/senhaHash (T-d1a-02).
  5. `revalidatePath("/usuarios")`.

- **`src/app/(app)/usuarios/page.tsx`** — Server Component DONO-only:
  - `redirect("/login")` se não autenticado, `redirect("/empresas")` se não-DONO.
  - `findMany` seleciona apenas `id/nome/email/role/setor` — `senhaHash` nunca entra no select nem no payload RSC (T-d1a-03).

- **`src/app/(app)/usuarios/usuarios-table.tsx`** — Tabela client simples (shadcn Table, sem TanStack/paginação — ~12 usuários não justifica):
  - Colunas Nome/Email/Role/Setor/Ações.
  - Botão "Editar nome" abre Dialog com form React Hook Form + Zod (schema mínimo, só `nome`).
  - `onSubmit` chama `editarNomeUsuarioAction`, toast de sucesso/erro, `router.refresh()` para repopular o Server Component.

- **`src/app/(app)/app-sidebar.tsx`** — item "Usuários" (ícone `Users`), visível somente quando `isDono`, mesmo padrão condicional do item "Dashboards".

- **`tests/usuarios.actions.test.ts`** — 4 casos: não-autenticado rejeitado, COLABORADOR rejeitado (sem tocar no banco), DONO+nome válido (update com `data` contendo apenas `{nome}`), DONO+nome vazio rejeitado. Ciclo TDD RED→GREEN seguido (commit `test` antes do `feat`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `usuarioSchema.shape.nome` não existe em runtime**
- **Found during:** Task 1, ao rodar os testes GREEN pela primeira vez.
- **Issue:** O plano pedia `usuarioSchema.shape.nome.safeParse(...)` para validar o nome, reusando o schema existente em `@/modules/usuarios/schema`. Porém `usuarioSchema` é definido como `z.object({...}).superRefine(...)`, o que produz um `ZodEffects`, não um `ZodObject` — `.shape` é `undefined` nesse tipo, causando `TypeError: Cannot read properties of undefined (reading 'nome')`.
- **Fix:** Substituído por um schema local (`const nomeSchema = z.string().min(1, "Nome é obrigatório")`) com a mesma regra/mensagem de erro do campo `nome` original. Comportamento de validação idêntico ao pretendido pelo plano; nenhuma mudança de contrato com o chamador.
- **Files modified:** `src/app/(app)/usuarios/actions.ts`
- **Commit:** 650972c

## Auth Gates

Nenhum — não houve necessidade de autenticação externa/CLI durante a execução.

## Known Stubs

Nenhum.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` do plano — os 3 vetores (T-d1a-01/02/03) foram implementados exatamente como descrito e cobertos por teste.

## Verification

- `npx vitest run tests/usuarios.actions.test.ts` — 4/4 verde
- `npm test` (suite completa) — 186/186 verde (31 arquivos)
- `npx tsc --noEmit` — limpo
- `npm run build` — sucesso; rota `/usuarios` gerada como dinâmica (`ƒ /usuarios 6.46 kB`); nenhum erro novo introduzido (2 warnings de ESLint pré-existentes em arquivos não tocados por esta task: `tarefas-table.tsx` e `scheduler.ts`)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 12f9222 | test | RED — testes de RBAC + update de editarNomeUsuarioAction |
| 650972c | feat | GREEN — editarNomeUsuarioAction (guard DONO + update só-nome) |
| fe252a3 | feat | página /usuarios + tabela com Dialog de editar nome |
| db209c6 | feat | item de sidebar "Usuários" (DONO-only) |

## TDD Gate Compliance

RED commit (12f9222, `test(...)`) presente antes do GREEN commit (650972c, `feat(...)`) — gate sequence respeitado para a Task 1 (única task `tdd="true"` do plano).

## Self-Check: PASSED

- FOUND: src/app/(app)/usuarios/actions.ts
- FOUND: src/app/(app)/usuarios/page.tsx
- FOUND: src/app/(app)/usuarios/usuarios-table.tsx
- FOUND: tests/usuarios.actions.test.ts
- FOUND commit 12f9222
- FOUND commit 650972c
- FOUND commit fe252a3
- FOUND commit db209c6
