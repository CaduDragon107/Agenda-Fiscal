---
phase: quick-260626-dfc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
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
  - src/app/(app)/empresas/[id]/editar/page.tsx
  - scripts/promover-chefes-setor.mjs
autonomous: true
requirements: [CHEFE-SETOR-01]
must_haves:
  truths:
    - "CHEFE_SETOR vê todas as empresas do próprio setor (não só as pessoalmente atribuídas)"
    - "CHEFE_SETOR vê todas as tarefas do próprio setor (recorrentes + avulsas)"
    - "CHEFE_SETOR atribui tarefa avulsa a qualquer colega do mesmo setor, nunca de outro setor"
    - "CHEFE_SETOR cria/edita/exclui empresas dentro do próprio setor e edita o responsável do próprio setor no formulário"
    - "CHEFE_SETOR pode gerar tarefas do mês; excluir tarefas da competência continua DONO-only"
    - "Suite de regressão COLABORADOR/DONO continua verde sem edição das expectativas existentes"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "enum Role com valor CHEFE_SETOR"
      contains: "CHEFE_SETOR"
    - path: "src/lib/visibility-scope.ts"
      provides: "branches CHEFE_SETOR em withVisibilityScope e withTarefaScope"
      contains: "CHEFE_SETOR"
    - path: "scripts/promover-chefes-setor.mjs"
      provides: "script one-off dry-run/--apply que muda SOMENTE role para CHEFE_SETOR"
  key_links:
    - from: "src/app/(app)/tarefas/actions.ts"
      to: "src/lib/tipo-obrigacao-setor.ts"
      via: "import tarefaSetorWhere no branch CHEFE_SETOR de withTarefaScope"
      pattern: "tarefaSetorWhere"
    - from: "src/app/(app)/empresas/empresa-form.tsx"
      to: "src/app/(app)/empresas/novo/page.tsx"
      via: "props podeEditarFiscal/podeEditarDp/podeEditarContabil calculadas server-side"
      pattern: "podeEditar"
---

<objective>
Introduzir o papel `CHEFE_SETOR` (Caio/FISCAL, Elisabete/CONTABIL, Lauany/DP) com permissão
equivalente ao DONO porém restrita ao próprio setor: visão total das empresas e tarefas do setor,
atribuição de tarefa avulsa a colegas do mesmo setor, CRUD de empresas no escopo do setor (incluindo
edição do responsável do próprio setor no formulário) e acesso ao botão "Gerar tarefas do mês".

Purpose: chefes de setor precisam supervisionar e redistribuir o trabalho do próprio setor sem
depender do dono, mantendo o isolamento entre setores e sem afetar o comportamento de COLABORADOR/DONO.

Output: enum Role estendido + tipos de sessão atualizados, branches CHEFE_SETOR nas duas funções
centrais de escopo, guards server-side de atribuição e de formulário, botão de geração liberado,
seed atualizado, script one-off de promoção (não executado) e testes novos para CHEFE_SETOR.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/quick/260626-dfc-criar-role-chefe-setor-caio-fiscal-elisa/260626-dfc-CONTEXT.md
@CLAUDE.md
@src/lib/visibility-scope.ts
@src/lib/tipo-obrigacao-setor.ts
@src/types/next-auth.d.ts
@tests/setup.ts
@scripts/renomear-usuarios-neto-lauany-elisabete.mjs
</context>

<constraints>
- NÃO rodar `npx prisma db push` nem `npx prisma generate` que dependa de DATABASE_URL: o orquestrador
  aplica a migração de enum manualmente depois. Apenas editar `schema.prisma` textualmente.
- NÃO executar o script one-off de promoção (`scripts/promover-chefes-setor.mjs`). Apenas criar e
  validar sintaticamente com `node --check`.
- NÃO editar as expectativas dos testes existentes de COLABORADOR/DONO. Apenas estender com novos
  casos CHEFE_SETOR (em `visibility-scope.test.ts`) e novos helpers (em `setup.ts`).
- Fora de escopo (não tocar): dashboards/`dashboards/guard.ts`, página `/usuarios`,
  `excluirTarefasDaCompetenciaAtualAction` (continua DONO-only), e as demais suites de regressão IDOR
  (`empresas.idor.test.ts`, `tarefas.idor.test.ts`) que devem permanecer verdes inalteradas.
</constraints>

<tasks>

<task type="auto">
  <name>Task 1: Estender enum Role, tipos de sessão e seed para CHEFE_SETOR</name>
  <files>prisma/schema.prisma, src/types/next-auth.d.ts, prisma/seed.ts</files>
  <action>
    Em `prisma/schema.prisma`, adicionar `CHEFE_SETOR` ao `enum Role` (hoje `COLABORADOR`/`DONO`).
    NÃO rodar `prisma db push`/`generate` — só edição textual (o orquestrador migra depois).

    Em `src/types/next-auth.d.ts`, estender o tipo `AppRole` para
    `"COLABORADOR" | "DONO" | "CHEFE_SETOR"` — isso propaga o novo valor para Session/User/JWT
    em todos os 4 `declare module` (next-auth, @auth/core/types, next-auth/jwt, @auth/core/jwt),
    que já referenciam `AppRole`.

    Em `prisma/seed.ts`, trocar o literal `role:` das 3 entradas — `colaborador1@escritorio.com.br`
    (Caio/FISCAL), `dp1@escritorio.com.br` (Lauany/DP) e `contabil1@escritorio.com.br`
    (Elisabete/CONTABIL) — de `Role.COLABORADOR` para `Role.CHEFE_SETOR`. NÃO mexer em `setor`, nome,
    email ou nas outras 9 entradas + DONO. (Caio é o nome real de `colaborador1`, ainda rotulado
    "Colaborador 1" no array — manter o nome como está, mudar apenas o role.)
  </action>
  <verify>
    <automated>node --check prisma/seed.ts 2>/dev/null || npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '^#' | grep -c "next-auth.d.ts" | grep -qx 0; grep -c "CHEFE_SETOR" prisma/schema.prisma | grep -qvx 0</automated>
  </verify>
  <done>`enum Role` contém CHEFE_SETOR; `AppRole` inclui CHEFE_SETOR; as 3 entradas de seed (colaborador1/dp1/contabil1) têm `Role.CHEFE_SETOR` com setor inalterado; `tsc --noEmit` não reporta novos erros em next-auth.d.ts.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Branches CHEFE_SETOR em withVisibilityScope e withTarefaScope (+ testes)</name>
  <files>src/lib/visibility-scope.ts, tests/setup.ts, tests/visibility-scope.test.ts</files>
  <behavior>
    - withVisibilityScope(chefeFiscal) → { responsaveisPorSetor: { some: { setor: "FISCAL" } } }
    - withVisibilityScope(chefeDp) → { responsaveisPorSetor: { some: { setor: "DP" } } }
    - withVisibilityScope(chefe com setor null) → { id: "__no_setor_defined__" }
    - withTarefaScope(chefeContabil) → tarefaSetorWhere("CONTABIL") (OR de tipoObrigacao + avulsas por responsavel.setor)
    - Casos existentes de DONO ({}) e COLABORADOR ({ responsavelId }) permanecem inalterados
  </behavior>
  <action>
    Em `src/lib/visibility-scope.ts`:
    1. Estender o type `SessionUser.role` para `"COLABORADOR" | "DONO" | "CHEFE_SETOR"`.
    2. Importar `tarefaSetorWhere` de `@/lib/tipo-obrigacao-setor`.
    3. Em `withVisibilityScope`: ANTES do branch FISCAL/COLABORADOR (e depois do branch DONO),
       adicionar `if (user.role === "CHEFE_SETOR")` — se `!setor`, retornar o mesmo fail-safe
       `{ id: "__no_setor_defined__" }`; senão retornar
       `{ responsaveisPorSetor: { some: { setor } } }` (SEM `usuarioId` — todas as empresas do setor,
       sempre via junction table, inclusive FISCAL; NÃO usar o shape legado `{ responsavelId }`).
    4. Em `withTarefaScope`: após o branch DONO, adicionar
       `if (user.role === "CHEFE_SETOR" && user.setor) return tarefaSetorWhere(user.setor);`
       (chefe sem setor cai no fallback COLABORADOR `{ responsavelId: user.id }`, fail-safe restritivo).

    Em `tests/setup.ts`: estender o type `SessionRole` para incluir `"CHEFE_SETOR"` e adicionar
    factories `mockChefeFiscalUser`/`mockChefeDpUser`/`mockChefeContabilUser` (role CHEFE_SETOR,
    setor FISCAL/DP/CONTABIL respectivamente), seguindo o padrão dos mocks existentes. NÃO alterar os
    mocks de COLABORADOR/DONO existentes.

    Em `tests/visibility-scope.test.ts`: ADICIONAR novos `it(...)` para os branches CHEFE_SETOR
    descritos em <behavior>, sem editar os 4 testes existentes de COLABORADOR/DONO.
  </action>
  <verify>
    <automated>npx vitest run tests/visibility-scope.test.ts tests/tipo-obrigacao-setor.test.ts</automated>
  </verify>
  <done>Testes novos de CHEFE_SETOR passam; os 4 testes pré-existentes (DONO/COLABORADOR) continuam verdes inalterados; withVisibilityScope/withTarefaScope retornam exatamente os shapes do <behavior>.</done>
</task>

<task type="auto">
  <name>Task 3: Guard de atribuição de tarefa avulsa + liberar botão "Gerar tarefas do mês"</name>
  <files>src/app/(app)/tarefas/actions.ts, src/app/(app)/tarefas/page.tsx</files>
  <action>
    Em `src/app/(app)/tarefas/actions.ts`, função `criarTarefa` (guard atual ~linha 92-97): adicionar
    guard equivalente para CHEFE_SETOR. Quando `session.user.role === "CHEFE_SETOR"` e
    `dados.responsavelId !== session.user.id`, buscar o setor do alvo
    (`db.usuario.findUnique({ where: { id: dados.responsavelId }, select: { setor: true } })`) e
    retornar `{ ok: false, error: "não autorizado" }` se o alvo não existir OU
    `alvo.setor !== session.user.setor`. Chefe pode atribuir a si mesmo ou a colega do MESMO setor;
    nunca a colega de outro setor. A anti-IDOR de empresa (`empresaAutorizada` via `withVisibilityScope`)
    já cobre "chefe só cria tarefa para empresa do próprio setor" — não duplicar.

    Em `gerarTarefasDoMesAction` (guard ~linha 299): trocar `if (session.user.role !== "DONO")` por
    `if (session.user.role !== "DONO" && session.user.role !== "CHEFE_SETOR")`. A geração permanece
    GLOBAL e idempotente (não criar variante "só do meu setor"). NÃO tocar em
    `excluirTarefasDaCompetenciaAtualAction` — continua DONO-only.

    Em `src/app/(app)/tarefas/page.tsx`: o `GerarTarefasButton` está dentro de
    `{session.user.role === "DONO" && (...)}` junto com `ExcluirTarefasCompetenciaButton`. Reestruturar
    para que `GerarTarefasButton` renderize também para CHEFE_SETOR, mas `ExcluirTarefasCompetenciaButton`
    continue SOMENTE para DONO (ex.: condição `role === "DONO" || role === "CHEFE_SETOR"` no Gerar, e
    `role === "DONO"` separado no Excluir).
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "tarefas/(actions|page)" | grep -v '^#' | grep -c . | grep -qx 0</automated>
  </verify>
  <done>criarTarefa rejeita CHEFE_SETOR atribuindo para outro setor (e alvo inexistente) e aceita mesmo-setor/si-mesmo; gerarTarefasDoMesAction aceita DONO e CHEFE_SETOR; botão Gerar aparece para CHEFE_SETOR mas Excluir-competência continua só DONO; tsc limpo nesses arquivos.</done>
</task>

<task type="auto">
  <name>Task 4: Edição por-campo do responsável de setor (form + pages + guards server-side)</name>
  <files>src/app/(app)/empresas/empresa-form.tsx, src/app/(app)/empresas/novo/page.tsx, src/app/(app)/empresas/[id]/editar/page.tsx, src/app/(app)/actions.ts</files>
  <action>
    Em `empresa-form.tsx`: substituir a prop `isDono` por 3 booleans
    `podeEditarFiscal`/`podeEditarDp`/`podeEditarContabil` no `EmpresaFormProps`. Trocar o
    `disabled={!isDono}` de cada um dos 3 `<Select>` por `disabled={!podeEditar<Setor>}` no select
    correspondente (Fiscal/DP/Contábil). Atualizar o comentário de doc que cita `isDono` controlando
    os 3 selects.

    Em `novo/page.tsx` e `[id]/editar/page.tsx`: calcular os 3 booleans server-side a partir de
    `session.user.role`/`session.user.setor` — `isDono = role === "DONO"`;
    `podeEditarFiscal = isDono || (role === "CHEFE_SETOR" && setor === "FISCAL")`, idem DP e CONTABIL.
    Passar os 3 booleans ao `<EmpresaForm>` no lugar de `isDono`. NÃO recalcular dentro do client
    component a partir de dados não confiáveis.

    Em `src/app/(app)/actions.ts`, `criarEmpresa` e `editarEmpresa`: trocar o guard DONO-only por-campo.
    Definir `isChefe = session.user.role === "CHEFE_SETOR"` e
    `setorChefe = session.user.setor`. Para cada campo aceitar o valor submetido quando
    `isDono || (isChefe && setorChefe === "<SETOR>")`, senão manter o fallback EXISTENTE
    (em criarEmpresa: `null` para DP/Contábil; em editarEmpresa: o valor atual via `setorAtual(...)`).
    Aplicar a `responsavelFiscalId` (setor FISCAL — em criarEmpresa Fiscal já é obrigatório do schema,
    o guard só decide se o valor submetido é honrado vs ignorado/recolocado),
    `responsavelDpId` (DP) e `responsavelContabilId` (CONTABIL). A anti-IDOR via `withVisibilityScope`
    no `findFirst` de `editarEmpresa` já limita o chefe às empresas do próprio setor — não duplicar.
    Opcional (discrição): extrair um pequeno helper local compartilhado entre as duas actions se reduzir
    duplicação, sem obrigatoriedade.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "empresas/(empresa-form|novo|\[id\])|\(app\)/actions" | grep -v '^#' | grep -c . | grep -qx 0</automated>
  </verify>
  <done>EmpresaForm recebe 3 booleans por-campo; cada Select fica habilitado para DONO sempre e para CHEFE_SETOR só no select do próprio setor; criarEmpresa/editarEmpresa honram o valor submetido apenas quando autorizado por campo, senão mantêm o fallback existente; tsc limpo nesses arquivos.</done>
</task>

<task type="auto">
  <name>Task 5: Script one-off de promoção de role para CHEFE_SETOR (criar, não executar)</name>
  <files>scripts/promover-chefes-setor.mjs</files>
  <action>
    Criar `scripts/promover-chefes-setor.mjs` seguindo EXATAMENTE o padrão de
    `scripts/renomear-usuarios-neto-lauany-elisabete.mjs`: dry-run por padrão, `--apply` para efetivar,
    identifica usuários por `email`, log do estado atual→esperado, verificação obrigatória por
    re-consulta ao final (`process.exitCode = 1` em divergência), `db.$disconnect()` no finally.

    Diferenças: a lista de alvos contém os 3 emails — `colaborador1@escritorio.com.br`,
    `dp1@escritorio.com.br`, `contabil1@escritorio.com.br` — e a escrita é
    `data: { role: "CHEFE_SETOR" }` (SOMENTE o campo `role`; jamais nome/email/senhaHash/setor).
    Selecionar `role` (e email) nas consultas de antes/depois para o log e a verificação.
    NÃO executar o script — apenas criar e validar a sintaxe.
  </action>
  <verify>
    <automated>node --check scripts/promover-chefes-setor.mjs && grep -v '^#' scripts/promover-chefes-setor.mjs | grep -c "senhaHash\|nome:\|setor:" | grep -qx 0</automated>
  </verify>
  <done>`node --check` passa; o script roda dry-run por padrão, aceita --apply, escreve SOMENTE `role: "CHEFE_SETOR"` para os 3 emails, verifica por re-consulta, e NÃO foi executado.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Server Action | role/setor do alvo e ids de responsável chegam de input potencialmente forjado |
| sessão → escopo de dados | role/setor da sessão decidem o `where` Prisma (visibilidade) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-dfc-01 | Elevation of Privilege | criarTarefa (atribuição cross-setor) | mitigate | Guard server-side busca `alvo.setor` no banco e rejeita `alvo.setor !== user.setor` ou alvo inexistente — nunca confia no client |
| T-dfc-02 | Elevation of Privilege | criarEmpresa/editarEmpresa (campo responsável de outro setor) | mitigate | Guard por-campo aceita valor só quando `isDono || (isChefe && setorChefe === setorDoCampo)`; `disabled` no form é só 1ª camada |
| T-dfc-03 | Information Disclosure | withVisibilityScope/withTarefaScope (vazar empresas/tarefas de outro setor) | mitigate | Branch CHEFE_SETOR escopa por `setor` da sessão; `setor` null → fail-safe `{ id: "__no_setor_defined__" }`, nunca `{}` |
| T-dfc-04 | Elevation of Privilege | excluirTarefasDaCompetenciaAtual (destrutivo) | accept | Mantido DONO-only por decisão explícita do usuário; CHEFE_SETOR não recebe a permissão |
| T-dfc-05 | Tampering | script one-off de promoção | mitigate | Dry-run por padrão, escreve só `role`, verifica por re-consulta; não executado pelo agente |
</threat_model>

<verification>
- `npx vitest run` — toda a suite verde, incluindo os 4 arquivos de regressão IDOR/visibilidade
  inalterados e os novos casos CHEFE_SETOR.
- `npx tsc --noEmit -p tsconfig.json` — sem novos erros de tipo (AppRole/SessionUser estendidos).
- `node --check scripts/promover-chefes-setor.mjs` — script sintaticamente válido.
- Migração de schema (`db push`) e execução do script: manuais, pelo orquestrador, fora deste plano.
</verification>

<success_criteria>
- enum Role + AppRole + SessionUser + SessionRole incluem CHEFE_SETOR.
- withVisibilityScope/withTarefaScope têm branch CHEFE_SETOR com fail-safe de setor null.
- criarTarefa bloqueia atribuição cross-setor de chefe; gerarTarefasDoMesAction liberado a CHEFE_SETOR;
  excluir-competência continua DONO-only.
- Formulário de empresa e guards de criar/editar respeitam edição por-campo do setor do chefe.
- seed atualizado e script one-off criado (não executado).
- Suíte de testes inteira verde; regressões pré-v2.0 intactas.
</success_criteria>

<output>
Create `.planning/quick/260626-dfc-criar-role-chefe-setor-caio-fiscal-elisa/260626-dfc-SUMMARY.md` when done.
</output>
</content>
</invoke>
