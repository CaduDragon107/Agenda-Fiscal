---
phase: quick
plan: 260615-jyn
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(app)/app-sidebar.tsx
  - src/app/login/login-form.tsx
autonomous: true
requirements: [QUICK-LOGO]
must_haves:
  truths:
    - "A logo branca da empresa aparece no topo da sidebar, visível em light e dark mode"
    - "A logo branca aparece no header do card de login, visível em light e dark mode"
    - "A logo nunca fica invisível por estar sobre fundo claro (container tem cor escura fixa)"
    - "O layout colapsado da sidebar (collapsible=icon) continua funcionando"
    - "npm run build e lint passam sem erros"
  artifacts:
    - path: "src/app/(app)/app-sidebar.tsx"
      provides: "Sidebar header com logo via next/image"
      contains: "next/image"
    - path: "src/app/login/login-form.tsx"
      provides: "Login card header com logo via next/image"
      contains: "next/image"
  key_links:
    - from: "src/app/(app)/app-sidebar.tsx"
      to: "/logo-branco.png"
      via: "next/image src"
      pattern: "logo-branco"
    - from: "src/app/login/login-form.tsx"
      to: "/logo-branco.png"
      via: "next/image src"
      pattern: "logo-branco"
---

<objective>
Adicionar a logo da empresa (public/logo-branco.png, 169x64px, branca) no topo de dois pontos da interface: o header da sidebar do app e o header do card de login.

Purpose: Branding visual consistente. A logo é branca, então DEVE ficar sobre um container de cor ESCURA FIXA (independente de tema) para ser visível em light e dark mode.
Output: app-sidebar.tsx e login-form.tsx atualizados usando next/image, build e lint verdes.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@src/app/(app)/app-sidebar.tsx
@src/app/login/login-form.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Substituir ícone/texto do SidebarHeader pela logo</name>
  <files>src/app/(app)/app-sidebar.tsx</files>
  <action>
    No `SidebarHeader` (atualmente o `div` com `flex items-center gap-2 px-2 py-1.5`), substituir a caixa `bg-primary` que contém o `Building2` pela logo. Importar `Image` de "next/image" no topo do arquivo. Remover o import de `Building2` APENAS se ele não for mais usado em outro lugar — atenção: `Building2` ainda é usado no item de menu "Empresas" (linha ~75), então MANTER o import de `Building2`.

    Trocar o container `<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">` por um container de FUNDO ESCURO FIXO (ex: `bg-neutral-900`, NÃO usar `bg-primary` nem `bg-sidebar` pois são theme-dependent e a logo branca ficaria invisível no tema dark). Dentro dele, renderizar `<Image src="/logo-branco.png" alt="Agenda Fiscal" width={169} height={64} />` com classe de altura fixa que preserve a proporção 169:64 (~2.64:1), ex: `className="h-8 w-auto"`. Dar padding ao container (ex: `px-2`) e cantos arredondados (`rounded-md`).

    Preservar o comportamento do modo colapsado: o bloco de texto "Agenda Fiscal" / "Visão geral" já usa `group-data-[collapsible=icon]:hidden`. Decisão do executor: como a logo completa (~2.64:1) fica larga demais para o estado `icon` colapsado, esconder o texto-extra como hoje e garantir que o container da logo também se ajuste no modo colapsado (ex: aplicar `group-data-[collapsible=icon]:hidden` no wrapper da logo OU reduzir para um formato compacto — escolher uma abordagem que não estoure a largura colapsada da sidebar). O subtítulo "Visão geral" (quando isDono) pode ser mantido abaixo/ao lado da logo ou removido — preservar a variável `isDono` e o restante do componente intactos.

    Não usar `priority` aqui (não é above-the-fold crítico). Não alterar SidebarContent, SidebarFooter nem a lógica de navegação.
  </action>
  <verify>
    <automated>cd "c:/Users/Novo/Desktop/criação de planilha modulos/teste" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>app-sidebar.tsx usa next/image com src="/logo-branco.png", width=169, height=64, dentro de um container com cor de fundo escura FIXA (não bg-primary/bg-sidebar); Building2 ainda importado para o menu; modo collapsible=icon não quebra; tsc sem erros.</done>
</task>

<task type="auto">
  <name>Task 2: Adicionar logo no CardHeader do login</name>
  <files>src/app/login/login-form.tsx</files>
  <action>
    Importar `Image` de "next/image" no topo. No `CardHeader`, acima do (ou no lugar do) `<CardTitle>Agenda Fiscal</CardTitle>`, adicionar a logo dentro de um container de FUNDO ESCURO FIXO (mesmo tratamento da Task 1, ex: `bg-neutral-900`, NÃO theme-variable), centralizado horizontalmente (ex: wrapper com `flex justify-center` e o container com `rounded-md px-4 py-3` ou similar).

    Renderizar `<Image src="/logo-branco.png" alt="Agenda Fiscal" width={169} height={64} priority className="h-12 w-auto" />` — tamanho maior que na sidebar (h-12 ou h-16) por ser destaque da tela de login, com `priority` (above the fold), preservando proporção 169:64 via `w-auto`.

    Decisão do executor: manter ou remover o `<CardTitle>` textual "Agenda Fiscal". Se a logo já comunica o branding, pode remover o CardTitle; manter o `<CardDescription>` "Entre com seu email e senha para continuar." Não alterar o formulário, validação, onSubmit nem demais imports.
  </action>
  <verify>
    <automated>cd "c:/Users/Novo/Desktop/criação de planilha modulos/teste" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>login-form.tsx usa next/image com src="/logo-branco.png", width=169, height=64, priority, dentro de container escuro fixo centralizado; CardDescription preservada; formulário intacto; tsc sem erros.</done>
</task>

<task type="auto">
  <name>Task 3: Verificar build e lint</name>
  <files>(nenhum — verificação)</files>
  <action>
    Rodar `npm run build` e `npm run lint` (ou o lint configurado pelo create-next-app). Corrigir quaisquer erros que apareçam: tipicamente import não usado (se Building2 ou CardTitle foram removidos), aspas/escapes, ou regras de next/image (alt obrigatório — já incluído). Se aparecer warning de next/image sobre dimensões, confirmar que width/height (169/64) estão presentes.
  </action>
  <verify>
    <automated>cd "c:/Users/Novo/Desktop/criação de planilha modulos/teste" && npm run build 2>&1 | tail -25 && npm run lint 2>&1 | tail -25</automated>
  </verify>
  <done>npm run build conclui com sucesso (Compiled successfully) e npm run lint não reporta erros.</done>
</task>

</tasks>

<verification>
- A logo aparece na sidebar e no login sobre fundo escuro fixo, visível em ambos os temas.
- Nenhum import órfão (Building2 mantido para o menu; CardTitle removido só se não usado).
- Modo collapsible=icon da sidebar continua funcional.
- build e lint verdes.
</verification>

<success_criteria>
- src/app/(app)/app-sidebar.tsx e src/app/login/login-form.tsx usam next/image apontando para /logo-branco.png com width=169 height=64.
- Container de fundo escuro FIXO (não bg-primary/bg-sidebar) em ambos os locais.
- priority apenas no login.
- npm run build e npm run lint passam.
</success_criteria>

<output>
Create `.planning/quick/260615-jyn-adicionar-logo-marca/260615-jyn-SUMMARY.md` when done
</output>
