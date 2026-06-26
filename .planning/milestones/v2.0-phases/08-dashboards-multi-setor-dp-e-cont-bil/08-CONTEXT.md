# Phase 8: Dashboards Multi-Setor — DP e Contábil - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

O dono visualiza, em páginas próprias por setor, o desempenho comparativo dos colaboradores de DP e de Contábil, a evolução mensal de cumprimento de prazos, e quais empresas geram mais atrasos recorrentes — exatamente os mesmos 3 tipos de dashboard que já existem para o Fiscal (DASH-01/02/03, Phase 4), agora replicados para DP e Contábil. Sem visão unificada entre setores — decisão explícita já travada no ROADMAP.md (Success Criteria desta fase). As consultas devem reaproveitar o mesmo módulo de queries parametrizado por setor já usado no Fiscal, sem duplicar 3 módulos de dashboard, e o código órfão `src/modules/dashboard/` (singular, não rastreado pelo git) deve ser deletado durante esta fase.

</domain>

<decisions>
## Implementation Decisions

### Navegação
- **D-01:** Os dashboards de DP e Contábil ficam em **abas dentro da mesma página `/dashboards`**, junto com o Fiscal — não em itens separados na sidebar. Reforça visualmente que são 3 visões do mesmo conceito, sem misturar dados entre setores, e evita poluir a sidebar com mais entradas.

### Universo de empresas
- **D-02:** No dashboard de DP (desempenho, evolução, ranking), **só entram empresas com `temFuncionariosClt: true`**. Empresas sem funcionários CLT nunca geram tarefa de DP — incluí-las geraria linhas/pontos zerados irrelevantes e poluiria a leitura do dono.
- **D-03:** No dashboard de Contábil, **todas as 197 empresas** entram no universo (sem filtro de CLT) — corolário direto de CONT-01 (Phase 7), que já define escrituração/balancete mensal para todas as empresas, independente do regime ou de ter funcionários CLT.

### Estado vazio por setor
- **D-04:** Quando um setor ainda não tem dados suficientes (ex.: DP recém começou a gerar tarefas), o texto do estado vazio **menciona o setor explicitamente** (ex.: "Ainda não há dados suficientes de DP. Os dashboards são alimentados pelas tarefas de DP concluídas a cada mês.") — não reusa o texto genérico do Fiscal verbatim. Deixa claro pro dono que é só falta de histórico daquele setor específico, não um bug ou dado faltando à toa.

### Claude's Discretion
- Estrutura exata de componentes (extrair `EmpresaRow`-like helpers, nomes de arquivos por setor, como o módulo de queries parametriza por setor — string literal `"DP"`/`"CONTABIL"`/`"FISCAL"` vs enum `Setor` importado do Prisma) é decisão de implementação — pesquisa/planejamento resolvem, não foi discutido aqui.
- Como `Tarefa` não tem coluna `setor` própria (não existe no schema) — o setor de uma tarefa hoje é inferido via `tipoObrigacao` (TipoObrigacao enum já distingue DP-only/Contábil-only/Fiscal-only valores, confirmado em Phase 6/7) e/ou via `responsavel.setor` do colaborador atribuído. Pesquisa deve confirmar qual join é o correto e mais eficiente para os 3 dashboards por setor, sem regressão no Fiscal.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pitfalls e decisões da milestone v2.0
- `.planning/research/PITFALLS.md` Pitfall B4 — citado no ROADMAP.md como referência direta desta fase (reaproveitar módulo de queries parametrizado por setor; deletar `src/modules/dashboard/` órfão).
- `.planning/STATE.md` (Blockers/Concerns, entrada "[Phase 8] NOVO") — mesma instrução do Pitfall B4, registrada no estado do projeto.

### Requisitos e critérios de sucesso
- `.planning/REQUIREMENTS.md` — DP-06, DP-07, DP-08, CONT-07, CONT-08, CONT-09.
- `.planning/ROADMAP.md` (seção "Phase 8") — Goal e os 5 Success Criteria desta fase, incluindo a decisão explícita de não ter visão unificada entre setores.

### Precedente direto (Phase 4, Fiscal)
- `src/app/(app)/dashboards/page.tsx` — estrutura de página com 3 Cards (desempenho/evolução/ranking) + EmptyState genérico, a replicar por setor.
- `src/app/(app)/dashboards/guard.ts` — padrão de guard DONO-only "não encontrado, never 403" (T-4-01) extraído em arquivo `.ts` sem JSX para testabilidade direta — mesmo padrão deve se aplicar aos novos dashboards.
- `src/modules/dashboards/queries.ts` (plural — módulo REAL, não confundir com o órfão singular) — `listarDesempenhoColaboradoresMesAtual`, `listarEvolucaoMensal`, `listarRankingEmpresas`; é este módulo que deve ser parametrizado por setor, não triplicado.
- `tests/dashboards.rbac.test.ts` — teste existente do guard DONO-only, padrão a seguir para os novos dashboards.

### Cores e estilo já decididos (quick-tasks anteriores, fora desta fase mas aplicáveis)
- Esquema de cores semáforo (azul/verde/amarelo/laranja/vermelho) já escolhido para os gráficos do dashboard (quick-task 260622-r6n) — manter consistência visual nos novos dashboards de DP/Contábil.
- Gráfico "Evolução Mensal" usa barras agrupadas com 5 categorias (criadas/concluídas/pendentes/pendentes-com-motivo/vencidas), não área/linha (quick-task 260622-lty) — mesmo padrão se aplica aos novos dashboards de evolução mensal.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/(app)/dashboards/desempenho-colaboradores-chart.tsx`, `evolucao-mensal-chart.tsx`, `ranking-empresas-table.tsx` — os 3 componentes de chart/tabela do Fiscal, candidatos a reuso direto (parametrizados por dataset) em vez de 3 cópias novas por setor.
- `src/components/ui/chart.tsx` — wrapper shadcn/Recharts já configurado e em uso.

### Established Patterns
- Guard DONO-only extraído em arquivo `.ts` separado de `page.tsx` (sem JSX) especificamente para permitir teste unitário direto sem pipeline de transformação JSX no Vitest (este projeto não tem `@vitejs/plugin-react` configurado).
- `EmptyState` como função local dentro de `page.tsx`, renderizada condicionalmente por dataset vazio.
- Tarefa não tem coluna `setor` — DP/Contábil scoping no motor de geração (Phase 6/7) usa `TipoObrigacao` enum (valores disjuntos por setor) e `responsavel.setor` do colaborador, não um campo dedicado em `Tarefa`.

### Integration Points
- `src/app/(app)/dashboards/page.tsx` é o ponto de entrada único — vira o lugar onde as abas por setor (D-01) são adicionadas.
- `src/modules/dashboards/queries.ts` é o módulo a estender/parametrizar — não criar `src/modules/dashboards-dp/` ou `src/modules/dashboards-contabil/` separados.
- Órfão a deletar nesta fase: `src/modules/dashboard/queries.ts` (singular, untracked pelo git, com erros de `tsc` conhecidos — referencia `classificarTarefaDesempenho` inexistente e `desempenhoMensalSnapshot` que não existe no Prisma Client). Confirmar que nada importa deste módulo antes de deletar (scan já feito em sessão anterior: zero imports).

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica adicional — a instrução explícita é replicar exatamente os 3 tipos de dashboard do Fiscal (mesmo layout de Card, mesmo esquema de cores semáforo, mesmo padrão de barras agrupadas na evolução mensal) para DP e Contábil, dentro de abas na mesma página.

</specifics>

<deferred>
## Deferred Ideas

- **Renomear os placeholders DP1-4/Contabil1-3 para nomes reais** — viria de um quick-task de gestão de usuários (mesmo padrão de 260615-mt3, que renomeou colaborador1-4 para Caio/Jessica/Heitor/Felipe), não uma decisão de implementação desta fase de dashboards. Os gráficos vão exibir `Usuario.nome` como está no banco hoje (DP1, DP2, etc.) até que esse quick-task seja feito.

None outras — discussão ficou dentro do escopo da fase.

</deferred>

---

*Phase: 8-Dashboards Multi-Setor — DP e Contábil*
*Context gathered: 2026-06-24*
