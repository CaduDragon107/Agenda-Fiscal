---
phase: quick-260626-qxu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(app)/empresas/empresas-table.tsx
  - tests/empresas.derive-rows.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Um viewer com acesso ao setor DP (DONO, CHEFE_SETOR de DP, COLABORADOR de DP) vê 'Sem movimento' na célula de Responsável DP quando a empresa não tem responsável de DP atribuído"
    - "A célula de Responsável DP continua exibindo o nome do responsável quando há um responsável de DP atribuído"
    - "Nenhuma empresa nova passa a aparecer ou some da listagem — o escopo de visibilidade (withVisibilityScope) permanece inalterado"
    - "Colunas de Fiscal e Contábil continuam exibindo 'Sem responsável' (comportamento atual) quando vazias — só a coluna DP muda o rótulo de ausência"
  artifacts:
    - path: "src/app/(app)/empresas/empresas-table.tsx"
      provides: "Renderização da célula de Responsável DP com rótulo 'Sem movimento' quando ausente"
      contains: "Sem movimento"
  key_links:
    - from: "src/app/(app)/empresas/empresas-table.tsx"
      to: "src/app/(app)/empresas/derive-rows.ts"
      via: "lê row.original.responsavelDp (preenchido por deriveEmpresaRows, que só popula DP para viewers com acesso ao setor DP)"
      pattern: "responsavelDp"
---

<objective>
Na listagem de empresas, exibir o rótulo "Sem movimento" no lugar do badge genérico "Sem responsável" na célula de Responsável DP, quando a empresa não tem responsável de DP atribuído — e apenas para viewers que já enxergam o setor DP.

Purpose: Para o setor DP, uma empresa sem responsável de DP atribuído significa que ela não tem movimento de pessoal (sem CLT/sem folha), não que falta atribuir alguém. O rótulo "Sem responsável" (vermelho/âmbar, tom de erro) é enganoso nesse contexto; "Sem movimento" comunica o estado correto.

Output: Ajuste presentacional em empresas-table.tsx + cobertura de teste da regra de derivação/rótulo. Sem mudança de schema, query ou escopo de visibilidade.
</objective>

<execution_context>
@C:/Users/Usuario/Desktop/teste/.claude/gsd-core/workflows/execute-plan.md
@C:/Users/Usuario/Desktop/teste/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

@src/app/(app)/empresas/empresas-table.tsx
@src/app/(app)/empresas/derive-rows.ts
@src/app/(app)/empresas/page.tsx
@src/lib/visibility-scope.ts
@tests/empresas.derive-rows.test.ts
</context>

<key_facts>
A fronteira de segurança já está resolvida pelo data layer e NÃO deve ser alterada por este plano:

- `deriveEmpresaRows` (derive-rows.ts) só popula `responsavelDp`/`responsavelDpId` quando o viewer tem acesso ao setor DP: para DONO sempre; para não-DONO apenas quando `viewerSetor === "DP"` (cobre COLABORADOR de DP e CHEFE_SETOR de DP). Para qualquer outro viewer, `responsavelDp` chega como `null` por construção E a coluna DP nem é renderizada.
- O escopo de QUAIS empresas aparecem vem de `withVisibilityScope` (visibility-scope.ts), aplicado em `listarEmpresas`. Este plano NÃO toca nessas funções.
- Portanto, "exibir só para quem tem acesso ao setor DP" já é garantido pela combinação existente: a coluna "Responsável DP" só existe para (a) DONO e (b) não-DONO com `setor === "DP"`. Basta trocar o rótulo de ausência DESSA célula.

Renderização atual da ausência de responsável DP em empresas-table.tsx (DOIS pontos):
1. Branch DONO: coluna `id: "responsavelDp"` → `row.original.responsavelDp?.nome ?? <Badge>Sem responsável</Badge>`.
2. Branch não-DONO (`id: "responsavelProprioSetor"`): quando `setor === "DP"`, usa `row.original.responsavelDp?.nome`, com fallback compartilhado `<Badge>Sem responsável</Badge>`.

Ambos devem mostrar "Sem movimento" QUANDO a célula é a do setor DP e não há responsável. As colunas Fiscal e Contábil mantêm "Sem responsável".
</key_facts>

<tasks>

<task type="auto">
  <name>Task 1: Renderizar "Sem movimento" na célula de Responsável DP ausente</name>
  <files>src/app/(app)/empresas/empresas-table.tsx</files>
  <action>
Trocar o rótulo de ausência APENAS da célula de Responsável DP, mantendo Fiscal/Contábil com "Sem responsável".

(a) Branch DONO — coluna `id: "responsavelDp"`: quando `row.original.responsavelDp` é null/sem nome, renderizar o texto "Sem movimento" no lugar do `<Badge className="bg-amber-500 text-white">Sem responsável</Badge>`. Use uma aparência discreta/neutra (texto em `text-muted-foreground`), NÃO o badge âmbar de alerta — ausência de movimento de DP é um estado normal, não um erro. As colunas `responsavelFiscal` e `responsavelContabil` permanecem exatamente como estão (badge "Sem responsável").

(b) Branch não-DONO — coluna `id: "responsavelProprioSetor"`: o fallback de ausência hoje é compartilhado entre Fiscal/DP/Contábil. Tornar o fallback condicional ao setor: quando `setor === "DP"`, renderizar "Sem movimento" (mesmo estilo neutro do item a); para `setor === "FISCAL"` ou `setor === "CONTABIL"`, manter o `<Badge>Sem responsável</Badge>` atual.

Para evitar duplicação e manter testabilidade, extraia o rótulo de ausência DP numa constante/elemento reutilizável dentro do arquivo (ex.: um pequeno componente/elemento `<span className="text-muted-foreground">Sem movimento</span>` referenciado nos dois branches). Não introduza nova prop nem altere a assinatura de `EmpresasTable`, `deriveEmpresaRows` ou qualquer função em `queries.ts`/`visibility-scope.ts`.

NÃO alterar: `withVisibilityScope`, `withTarefaScope`, `listarEmpresas`, `EMPRESA_SELECT`, `deriveEmpresaRows`, nem os filtros existentes (`semResponsavelFiltro` etc.). A lógica de "qual empresa aparece" e "qual setor é populado" permanece intacta.
  </action>
  <verify>
    <automated>cd "c:/Users/Usuario/Desktop/teste" && npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
- A célula de Responsável DP exibe "Sem movimento" (estilo neutro, não badge de alerta) quando `responsavelDp` é null, tanto para DONO quanto para viewer não-DONO com `setor === "DP"`.
- Quando há responsável de DP, a célula exibe o nome do responsável (inalterado).
- Colunas Fiscal e Contábil continuam exibindo "Sem responsável" quando vazias.
- `npx tsc --noEmit` passa sem erros novos.
- Nenhuma mudança em visibility-scope.ts, queries.ts, derive-rows.ts ou na assinatura de EmpresasTable.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Teste de regressão — DP populado só com acesso ao setor DP</name>
  <files>tests/empresas.derive-rows.test.ts</files>
  <behavior>
    - Para `viewerRole === "DONO"`, uma empresa SEM linha de DP em `responsaveisPorSetor` produz `responsavelDp === null` e `responsavelDpId === null` (a UI então renderizará "Sem movimento").
    - Para `viewerRole === "COLABORADOR"` / `viewerSetor === "DP"`, uma empresa sem responsável de DP produz `responsavelDp === null` (own-setor populado mas vazio → "Sem movimento" na UI).
    - Para um viewer SEM acesso ao setor DP (ex.: `viewerSetor === "FISCAL"`), `responsavelDp` permanece `null` por construção mesmo que a empresa tenha um responsável de DP no fixture — confirmando que o nome de DP nunca vaza para fora do setor (a coluna DP nem é renderizada para esse viewer).
  </behavior>
  <action>
Adicionar casos de teste a `tests/empresas.derive-rows.test.ts` (mesmo padrão de fixtures já existente no arquivo — `{ setor, usuario: { id, nome } }`) cobrindo o comportamento de `deriveEmpresaRows` para a ausência de responsável de DP e o isolamento cross-setor descritos em <behavior>.

Construa pelo menos um fixture de empresa SEM a linha `{ setor: "DP", ... }` em `responsaveisPorSetor` e asserte `responsavelDp`/`responsavelDpId` resultantes para os viewers DONO e COLABORADOR-DP. Reaproveite/estenda `montarFixtures()` ou crie fixtures locais análogos — não remova nem edite asserts existentes (são regressão de segurança D-10).

Estes testes travam o contrato que a renderização "Sem movimento" depende: a célula DP só recebe `null` (gatilho de "Sem movimento") nos casos corretos, e o nome de DP nunca aparece para quem não tem acesso ao setor.
  </action>
  <verify>
    <automated>cd "c:/Users/Usuario/Desktop/teste" && npx vitest run tests/empresas.derive-rows.test.ts</automated>
  </verify>
  <done>
- Novos casos de teste passam.
- Asserts pré-existentes de regressão D-10 continuam passando (não foram editados).
- Suite confirma: `responsavelDp === null` quando não há responsável de DP (DONO e COLABORADOR-DP), e DP nunca populado para viewer fora do setor DP.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit -p tsconfig.json` passa.
- `npx vitest run tests/empresas.derive-rows.test.ts` passa (incluindo asserts D-10 existentes).
- Smoke manual (opcional): logado como COLABORADOR de DP, a listagem mostra "Sem movimento" nas empresas sem responsável de DP e o nome nas demais; logado como FISCAL, a coluna de Responsável DP não aparece.
</verification>

<success_criteria>
- Viewers com acesso ao setor DP (DONO, CHEFE_SETOR de DP, COLABORADOR de DP) veem "Sem movimento" na célula de Responsável DP quando não há responsável de DP atribuído.
- Nome do responsável de DP continua sendo exibido quando existe.
- Colunas Fiscal/Contábil inalteradas ("Sem responsável" quando vazias).
- Escopo de visibilidade (quais empresas aparecem) inalterado.
- tsc e vitest da suite tocada passam.
</success_criteria>

<output>
Create `.planning/quick/260626-qxu-mostrar-para-usu-rios-do-setor-dp-na-lis/260626-qxu-SUMMARY.md` when done
</output>
