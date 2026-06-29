---
phase: quick-260626-lvw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(app)/tarefas/[id]/page.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "O card 'Empresa vinculada' no detalhe da tarefa não exibe mais um campo 'Responsável' duplicado entre 'Regime' e o botão 'Ver empresa'"
    - "O campo 'Responsável' do card 'Detalhes' (responsável pela tarefa) permanece inalterado"
  artifacts:
    - path: "src/app/(app)/tarefas/[id]/page.tsx"
      provides: "Card 'Empresa vinculada' sem o bloco duplicado de Responsável"
  key_links:
    - from: "src/app/(app)/tarefas/[id]/page.tsx"
      to: "tarefa.empresa.responsavel"
      via: "bloco dt/dd removido do card Empresa vinculada"
      pattern: "tarefa\\.empresa\\.responsavel"
---

<objective>
No detalhe da tarefa (`src/app/(app)/tarefas/[id]/page.tsx`), o card "Empresa vinculada" exibe um campo "Responsável" (linhas ~177-182, `tarefa.empresa.responsavel.nome`) entre o campo "Regime" e o botão "Ver empresa". Esse campo é redundante com o "Responsável" já exibido no card "Detalhes" (linhas ~120-125, `tarefa.responsavel.nome`), que é o responsável pela tarefa. Remover o bloco duplicado do card "Empresa vinculada", mantendo intacto o do card "Detalhes".
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@src/app/(app)/tarefas/[id]/page.tsx
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Remover bloco "Responsável" duplicado do card Empresa vinculada</name>
  <files>src/app/(app)/tarefas/[id]/page.tsx</files>
  <action>
    Em `src/app/(app)/tarefas/[id]/page.tsx`, dentro do card "Empresa vinculada" (`<CardTitle>Empresa vinculada</CardTitle>`), remover o bloco `<div>` que contém `<dt>Responsável</dt>` e `<dd>{tarefa.empresa.responsavel.nome}</dd>` (situado entre o bloco "Regime" e o bloco condicional "Particularidades"/botão "Ver empresa"). Não alterar nenhum outro bloco, incluindo o "Responsável" do card "Detalhes" (`tarefa.responsavel.nome`), que deve permanecer.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>O card "Empresa vinculada" não contém mais o dt/dd "Responsável"; o card "Detalhes" continua com seu próprio "Responsável" intacto; `tsc --noEmit` passa sem erros.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|--------------|
| N/A | Mudança puramente de apresentação (remoção de elemento JSX duplicado); nenhum dado novo exposto ou ocultado de forma que afete controle de acesso — `tarefa.empresa.responsavel.nome` já estava sendo renderizado antes; remover a duplicata não altera quem vê o quê. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|------------------|
| T-lvw-01 | None | page.tsx (UI) | accept | Mudança cosmética sem impacto de segurança; nenhuma ameaça aplicável. |
</threat_model>

<verification>
1. `npx tsc --noEmit` passa sem erros.
2. Inspeção visual do diff: apenas o bloco duplicado de Responsável foi removido do card "Empresa vinculada"; nada mais no arquivo foi alterado.
</verification>

<success_criteria>
- Card "Empresa vinculada" no detalhe da tarefa não exibe mais "Responsável" duplicado.
- Card "Detalhes" continua exibindo o "Responsável" da tarefa normalmente.
</success_criteria>

<output>
Create `.planning/quick/260626-lvw-remover-campo-responsavel-duplicado-no-c/260626-lvw-SUMMARY.md` when done
</output>
