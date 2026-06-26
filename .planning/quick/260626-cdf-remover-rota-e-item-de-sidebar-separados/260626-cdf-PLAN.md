---
phase: quick-260626-cdf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(app)/empresas/dp/page.tsx
  - src/app/(app)/empresas/dp/empresas-dp-table.tsx
  - src/app/(app)/app-sidebar.tsx
  - src/app/(app)/empresas/derive-rows.ts
  - src/app/(app)/empresas/empresas-table.tsx
  - tests/empresas.derive-rows.test.ts
autonomous: true
requirements: [EMPR-01]
must_haves:
  truths:
    - "A rota /empresas/dp não existe mais (retorna 404)"
    - "O sidebar não mostra mais o item 'Empresas DP'"
    - "A tabela principal /empresas exibe uma coluna 'Empregada doméstica' com Badge 'Sim' quando true e célula vazia quando false"
    - "A fronteira de segurança D-10 permanece intacta: responsáveis cross-setor nunca aparecem para viewer não-DONO"
  artifacts:
    - path: "src/app/(app)/empresas/empresas-table.tsx"
      provides: "Coluna 'Empregada doméstica' + campo temEmpregadaDomestica no tipo EmpresaRow"
      contains: "temEmpregadaDomestica"
    - path: "src/app/(app)/empresas/derive-rows.ts"
      provides: "Passthrough de temEmpregadaDomestica em ambos os branches (DONO e não-DONO)"
      contains: "temEmpregadaDomestica"
  key_links:
    - from: "src/app/(app)/empresas/derive-rows.ts"
      to: "src/app/(app)/empresas/empresas-table.tsx"
      via: "campo temEmpregadaDomestica no objeto EmpresaRow"
      pattern: "temEmpregadaDomestica"
---

<objective>
Consolidar toda a gestão de empresas em UMA única página (/empresas): remover a rota e o
item de sidebar separados de DP (/empresas/dp), e mover o indicador "Empregada doméstica"
(que só existia na tabela DP) para a tabela principal de Empresas.

Purpose: O usuário não quer área de navegação separada para DP — quer tudo em /empresas.
Output: Rota /empresas/dp deletada, item de sidebar removido, coluna "Empregada doméstica"
visível na tabela principal. Sem migração de banco — o campo Empresa.temEmpregadaDomestica
já existe e já é propagado por EMPRESA_SELECT/listarEmpresas.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@src/app/(app)/empresas/page.tsx
@src/app/(app)/empresas/derive-rows.ts
@src/app/(app)/empresas/empresas-table.tsx
@src/app/(app)/empresas/dp/empresas-dp-table.tsx
@src/app/(app)/app-sidebar.tsx
@tests/empresas.derive-rows.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remover rota e item de sidebar de DP</name>
  <files>src/app/(app)/empresas/dp/page.tsx, src/app/(app)/empresas/dp/empresas-dp-table.tsx, src/app/(app)/app-sidebar.tsx</files>
  <action>Deletar os arquivos src/app/(app)/empresas/dp/page.tsx e src/app/(app)/empresas/dp/empresas-dp-table.tsx, e remover a pasta dp/ se ficar vazia. Em app-sidebar.tsx: (1) remover por completo o SidebarMenuItem que contém o Link href="/empresas/dp" (item "Empresas DP", o que usa o ícone Users) — linhas do bloco SidebarMenuItem que envolve o Link de /empresas/dp; (2) simplificar o isActive do item "Empresas" para apenas `pathname?.startsWith("/empresas")`, removendo a cláusula `&& !pathname.startsWith("/empresas/dp")` que não é mais necessária; (3) remover o import `Users` de lucide-react se ele não for mais usado em nenhum outro lugar do arquivo (verificar com grep antes de remover). Não tocar em nenhum outro item de navegação (Tarefas, Dashboards, Empresas).</action>
  <verify>
    <automated>cd "c:/Users/Novo/Desktop/criação de planilha modulos/teste" && test ! -e "src/app/(app)/empresas/dp" && ! grep -rq "empresas/dp" src/ && ! grep -rq "EmpresasDpTable" src/ && echo OK_NO_DP_REFS</automated>
  </verify>
  <done>Pasta dp/ não existe; nenhuma referência a /empresas/dp ou EmpresasDpTable em src/; sidebar não tem mais o item "Empresas DP"; isActive de "Empresas" usa apenas startsWith("/empresas").</done>
</task>

<task type="auto">
  <name>Task 2: Adicionar coluna "Empregada doméstica" na tabela principal</name>
  <files>src/app/(app)/empresas/derive-rows.ts, src/app/(app)/empresas/empresas-table.tsx</files>
  <action>Em derive-rows.ts: adicionar `temEmpregadaDomestica: empresa.temEmpregadaDomestica` ao objeto retornado em AMBOS os branches (o branch viewerRole === "DONO" e o branch não-DONO). Este campo é puramente informativo — NÃO contém identidade de responsável de outro setor — portanto NÃO está sujeito à restrição cross-setor de D-10 e deve ser sempre incluído, independente do viewer. NÃO alterar nenhum dos campos responsavelXxx (a lógica de strip cross-setor permanece exatamente como está).

Em empresas-table.tsx: (1) adicionar `temEmpregadaDomestica: boolean;` ao tipo EmpresaRow; (2) adicionar uma nova coluna na definição de `columns` (useMemo) com `id: "temEmpregadaDomestica"`, `header: "Empregada doméstica"`, e cell que renderiza `<Badge className="bg-blue-600 text-white">Sim</Badge>` quando `row.original.temEmpregadaDomestica` for true, e string vazia ("") caso contrário — mesmo padrão visual da antiga empresas-dp-table.tsx. Posicionar essa coluna depois das colunas de responsável e antes da coluna "acoes". A coluna deve ser SEMPRE visível (não condicionada a isDono/setor), pois é informativa e não expõe identidade. Badge já está importado no arquivo.</action>
  <verify>
    <automated>cd "c:/Users/Novo/Desktop/criação de planilha modulos/teste" && grep -q "temEmpregadaDomestica: empresa.temEmpregadaDomestica" "src/app/(app)/empresas/derive-rows.ts" && grep -q 'temEmpregadaDomestica: boolean' "src/app/(app)/empresas/empresas-table.tsx" && grep -q 'Empregada doméstica' "src/app/(app)/empresas/empresas-table.tsx" && npx tsc --noEmit && echo OK_TYPES</automated>
  </verify>
  <done>derive-rows.ts inclui temEmpregadaDomestica nos dois branches; EmpresaRow tem o campo boolean; tabela principal tem coluna "Empregada doméstica" com Badge "Sim"/vazio; `npx tsc --noEmit` passa sem erros.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Atualizar teste de derive-rows para o novo campo</name>
  <files>tests/empresas.derive-rows.test.ts</files>
  <behavior>
    - O fixture de entrada já contém temEmpregadaDomestica (verificado: linha 37, valor false). Manter.
    - Test 1 (DP colaborador): row.temEmpregadaDomestica === false (espelha o fixture)
    - Test 3 (DONO): row.temEmpregadaDomestica === false (espelha o fixture)
    - O campo informativo deve estar presente em qualquer viewer (DONO e não-DONO)
  </behavior>
  <action>Em tests/empresas.derive-rows.test.ts: adicionar assertivas de que `row.temEmpregadaDomestica` é igual ao valor do fixture (false) tanto no Test 1 (COLABORADOR/DP) quanto no Test 3 (DONO), confirmando que o campo informativo é propagado em ambos os branches. O fixture de entrada já inclui `temEmpregadaDomestica: false` (linha 37) — não é necessário alterá-lo. Não enfraquecer nenhuma assertiva existente de segurança D-10 (Test 4 anti-vazamento permanece intacto — temEmpregadaDomestica é boolean, não vaza nome/id de ninguém).</action>
  <verify>
    <automated>cd "c:/Users/Novo/Desktop/criação de planilha modulos/teste" && npx vitest run tests/empresas.derive-rows.test.ts && echo OK_TESTS</automated>
  </verify>
  <done>Os testes incluem assertivas para temEmpregadaDomestica em Test 1 e Test 3; `npx vitest run tests/empresas.derive-rows.test.ts` passa com todos os testes verdes.</done>
</task>

</tasks>

<verification>
- `test ! -e "src/app/(app)/empresas/dp"` — pasta deletada
- `grep -rq "empresas/dp" src/` retorna vazio — nenhuma referência residual à rota
- `npx tsc --noEmit` — sem erros de tipo (EmpresaRow consistente entre derive-rows e table)
- `npx vitest run tests/empresas.derive-rows.test.ts` — testes verdes, incluindo segurança D-10
</verification>

<success_criteria>
- Rota /empresas/dp não existe (404) e item de sidebar "Empresas DP" removido
- Tabela principal /empresas mostra coluna "Empregada doméstica" (Badge "Sim" / vazio) para qualquer usuário
- Coluna "Responsável DP" do DONO e "Responsável {setor}" do colaborador continuam funcionando sem alteração
- Fronteira D-10 intacta (Test 4 anti-vazamento ainda passa)
- Sem migração de banco
</success_criteria>

<output>
Create `.planning/quick/260626-cdf-remover-rota-e-item-de-sidebar-separados/260626-cdf-SUMMARY.md` when done
</output>
