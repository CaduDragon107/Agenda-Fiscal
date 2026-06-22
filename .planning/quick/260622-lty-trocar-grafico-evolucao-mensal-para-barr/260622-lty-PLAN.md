---
phase: quick-260622-lty
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - src/modules/dashboards/snapshot.ts
  - src/modules/dashboards/queries.ts
  - src/app/(app)/dashboards/evolucao-mensal-chart.tsx
  - tests/dashboards.snapshot.test.ts
  - tests/dashboards.queries.test.ts
autonomous: true
requirements: [DASH-02]
must_haves:
  truths:
    - "O gráfico de Evolução Mensal renderiza 5 barras agrupadas por mês (criadas, concluídas, pendentes sem motivo, pendentes com motivo, vencidas)"
    - "Meses fechados leem os 5 novos valores do snapshot DesempenhoMensal; o mês corrente os calcula live com a mesma lógica de população — sem degrau no boundary live→frozen"
    - "Os campos/cálculos existentes (totalConcluidas, concluidasNoPrazo, percentual, totalEmpresas, totalTarefasPeriodo) permanecem intocados"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "5 novos campos Int @default(0) em model DesempenhoMensal"
      contains: "totalCriadas"
    - path: "src/modules/dashboards/snapshot.ts"
      provides: "Cálculo das 5 novas categorias por colaborador (população 'criadas')"
      contains: "totalCriadas"
    - path: "src/modules/dashboards/queries.ts"
      provides: "listarEvolucaoMensal retornando os 5 valores por mês (frozen + live)"
      contains: "totalCriadas"
    - path: "src/app/(app)/dashboards/evolucao-mensal-chart.tsx"
      provides: "BarChart com 5 <Bar> agrupadas"
      contains: "BarChart"
  key_links:
    - from: "src/modules/dashboards/queries.ts"
      to: "db.desempenhoMensal"
      via: "groupBy _sum dos 5 novos campos para meses fechados"
      pattern: "_sum"
    - from: "src/app/(app)/dashboards/evolucao-mensal-chart.tsx"
      to: "listarEvolucaoMensal"
      via: "props dados[] com os 5 campos por ponto"
      pattern: "dataKey"
---

<objective>
Trocar o gráfico de "Evolução Mensal" (DASH-02) de Area/Line para barras AGRUPADAS, com 5 categorias por mês: total criadas, concluídas no período, pendentes sem motivo, pendentes com motivo, e vencidas.

Esta é uma ADIÇÃO, não substituição: introduz uma população PARALELA nova ("tarefas criadas no mês" = recorrentes por `competencia` + avulsas por `createdAt`), distinta da população existente (`concluidoEm`-no-range usada para % no prazo). Todos os campos/cálculos existentes permanecem intocados.

Purpose: dar ao dono uma visão de volume e composição de status do trabalho gerado por mês, não só o percentual de pontualidade.
Output: 5 novos campos no snapshot `DesempenhoMensal`, cálculo live+frozen em `listarEvolucaoMensal`, e gráfico de barras agrupadas.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

# Funções e schema a estender (lógica existente NÃO pode ser alterada — apenas adicionar)
@src/modules/dashboards/snapshot.ts
@src/modules/dashboards/queries.ts
@src/modules/tarefas/geracao.ts
@prisma/schema.prisma
@src/app/(app)/dashboards/evolucao-mensal-chart.tsx
@src/app/(app)/dashboards/guard.ts
@src/app/(app)/dashboards/page.tsx
@tests/dashboards.snapshot.test.ts
@tests/dashboards.queries.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Schema + snapshot.ts — 5 novas categorias da população "criadas"</name>
  <files>prisma/schema.prisma, src/modules/dashboards/snapshot.ts, tests/dashboards.snapshot.test.ts</files>
  <behavior>
    Em calcularSnapshotMensal, sobre a NOVA população "criadas" do mês-alvo:
    - Test: tarefa recorrente com `competencia = "2026-02"` entra na população do snapshot de "2026-02" (filtro por competencia, independente de createdAt).
    - Test: tarefa avulsa (`competencia = null`) com `createdAt` no range [startOfMonth, endOfMonth] do mês-alvo entra na população; avulsa com createdAt fora do range NÃO entra.
    - Test: `totalCriadas` = total da população; `totalConcluidasNoPeriodo` = dessa população, `status = "CONCLUIDA"`.
    - Test: `totalPendentesSemMotivo` = `status="PENDENTE" AND motivoPendencia=null`; `totalPendentesComMotivo` = `status="PENDENTE" AND motivoPendencia != null`.
    - Test: `totalVencidas` = `status="PENDENTE" AND prazo < agora` (lente de urgência — pode sobrepor com pendentes-sem/com-motivo, não é partição exclusiva).
    - Test: os campos existentes (totalConcluidas, concluidasNoPrazo, totalEmpresas, totalTarefasPeriodo) continuam presentes e com os MESMOS valores que antes (a query `concluidoEm`-no-range existente permanece intocada).
  </behavior>
  <action>
    Em `prisma/schema.prisma`, estender `model DesempenhoMensal` com 5 campos NOVOS: `totalCriadas Int @default(0)`, `totalConcluidasNoPeriodo Int @default(0)`, `totalPendentesSemMotivo Int @default(0)`, `totalPendentesComMotivo Int @default(0)`, `totalVencidas Int @default(0)`. Usar `@default(0)` para não quebrar linhas já existentes (decisão item 5/7). NÃO remover nem renomear nenhum campo existente. Depois rodar `npx prisma db push` (fluxo do projeto, nunca `prisma migrate` — railway.json usa db push; ver STATE.md 02-01) e `npx prisma generate`.

    Em `src/modules/dashboards/snapshot.ts`: adicionar os 5 campos a `LinhaSnapshotMensal` e calculá-los em `calcularSnapshotMensal` SEM tocar na query/agregação existente de `concluidoEm`-no-range. Adicionar uma SEGUNDA query (`tx.tarefa.findMany`) para a nova população "criadas": `where` com `OR: [{ competencia: <mês-alvo "YYYY-MM"> }, { competencia: null, createdAt: { gte: inicio, lte: fim } }]` (decisão item 1 — recorrentes pela competencia + avulsas pelo createdAt no range). `select` explícito apenas dos campos necessários (`responsavelId, status, motivoPendencia, prazo`) — NUNCA `responsavel: true`/`colaborador: true` (T-04-LEAK). Agregar em memória por `responsavelId` (nunca `Empresa.responsavelId` — Pitfall 3), computando os 5 contadores conforme item 3 das decisões; `totalVencidas` usa um único `agora = new Date()` capturado no início (congelado no snapshot, D-05/decisão item 2). Documentar as novas regras com comentários extensos no MESMO estilo D-01..D-06 já presente no arquivo, citando a decisão (população "criadas" paralela, distinta de `concluidoEm`-no-range). Mesclar os 5 valores no objeto de retorno de cada colaborador presente em QUALQUER das duas populações (criadas OU concluídas-no-range), defaultando ausentes a 0.

    Atualizar `tests/dashboards.snapshot.test.ts` cobrindo os comportamentos do bloco <behavior>, no mesmo estilo dos testes existentes (mock de `tx`). Os mocks existentes que retornam apenas a população `concluidoEm` precisarão fornecer também o retorno da nova segunda query — usar `mockResolvedValueOnce` em sequência ou diferenciar pelo `where` recebido.
  </action>
  <verify>
    <automated>npx vitest run tests/dashboards.snapshot.test.ts</automated>
  </verify>
  <done>`npx prisma db push` aplicado; `npx vitest run tests/dashboards.snapshot.test.ts` passa; os 5 novos campos existem no schema com `@default(0)` e são preenchidos por calcularSnapshotMensal; campos existentes inalterados.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: queries.ts — listarEvolucaoMensal retorna os 5 valores (frozen + live)</name>
  <files>src/modules/dashboards/queries.ts, tests/dashboards.queries.test.ts</files>
  <behavior>
    - Test: para competências FECHADAS, `listarEvolucaoMensal` lê os 5 novos valores via `db.desempenhoMensal.groupBy` com `_sum` dos 5 campos novos — NUNCA chama `db.tarefa.findMany` para meses fechados (D-05).
    - Test: o campo `percentual` existente continua sendo retornado por ponto, com o MESMO valor calculado de `_sum.totalConcluidas`/`_sum.concluidasNoPrazo` (lógica intocada).
    - Test: para o mês CORRENTE (live), os 5 valores são calculados com a MESMA nova lógica de população "criadas" da Task 1 (recorrentes por competencia do mês corrente + avulsas por createdAt no range), sem degrau live→frozen.
    - Test: cada ponto do array retornado contém `competencia`, `percentual`, e os 5 novos campos (totalCriadas, totalConcluidasNoPeriodo, totalPendentesSemMotivo, totalPendentesComMotivo, totalVencidas).
  </behavior>
  <action>
    Em `src/modules/dashboards/queries.ts`: estender o type `PontoEvolucao` com os 5 novos campos. Em `listarEvolucaoMensal`, adicionar os 5 campos ao `_sum` do `db.desempenhoMensal.groupBy` existente e propagá-los em `pontosFechados` (default 0 quando snapshot ausente — meses congelados antigos, decisão item 7). NÃO alterar o cálculo de `percentual` existente.

    Para o ponto LIVE do mês corrente: calcular os 5 valores com a MESMA lógica de população "criadas" da Task 1. Preferir reaproveitar a lógica — extrair um helper compartilhado (ex.: `calcularCategoriasCriadas`) ou replicar a query `OR: [{ competencia: <mês corrente> }, { competencia: null, createdAt no range }]` agregando os 5 totais da equipe. O `percentual` live continua vindo de `listarDesempenhoColaboradoresMesAtual` (lógica `concluidoEm`-no-range, intocada). Garantir continuidade live→frozen: a mesma definição usada no snapshot (Task 1). Comentar a paridade no mesmo estilo dos comentários existentes.

    O retorno deve permanecer um array de objetos planos serializáveis (nunca Map — boundary Server→Client).

    Atualizar `tests/dashboards.queries.test.ts` cobrindo o bloco <behavior>, ajustando os mocks de `desempenhoMensalGroupByMock` para incluir os 5 campos em `_sum` e validando que `db.tarefa.findMany` para o ponto live usa o filtro `competencia`/`createdAt` (nova população), não é chamado para meses fechados.
  </action>
  <verify>
    <automated>npx vitest run tests/dashboards.queries.test.ts</automated>
  </verify>
  <done>`npx vitest run tests/dashboards.queries.test.ts` passa; cada ponto de `listarEvolucaoMensal` inclui os 5 novos campos + `percentual` intocado; meses fechados lidos só de `db.desempenhoMensal`.</done>
</task>

<task type="auto">
  <name>Task 3: evolucao-mensal-chart.tsx — barras agrupadas com 5 categorias</name>
  <files>src/app/(app)/dashboards/evolucao-mensal-chart.tsx</files>
  <action>
    Reescrever `src/app/(app)/dashboards/evolucao-mensal-chart.tsx` trocando `AreaChart`/`Area` de recharts por `BarChart`/`Bar`. Atualizar o type local `PontoEvolucao` para incluir os 5 novos campos numéricos (totalCriadas, totalConcluidasNoPeriodo, totalPendentesSemMotivo, totalPendentesComMotivo, totalVencidas). Renderizar 5 `<Bar>` AGRUPADAS lado a lado (decisão item 4 — agrupadas, NÃO empilhadas: cada `<Bar>` com seu próprio `dataKey`, sem prop `stackId`).

    Definir `chartConfig` com as 5 categorias, cada uma com `label` em PT-BR ("Criadas", "Concluídas", "Pendentes (sem motivo)", "Pendentes (com motivo)", "Vencidas") e `color: "var(--chart-1)"` .. `"var(--chart-5)"`. Manter `ChartContainer`/`ChartTooltip`/`ChartTooltipContent` do shadcn, `CartesianGrid vertical={false}`, `XAxis dataKey="competencia"`, e dark mode existentes. Remover o `YAxis domain={[0,100]}`/`tickFormatter` de porcentagem (agora é contagem absoluta, não %) e o `formatter` de tooltip que anexava "% no prazo" — o tooltip deve mostrar a contagem por categoria. Manter `accessibilityLayer` e `className="min-h-[260px] w-full"`.

    Nenhuma mudança em page.tsx é necessária se o type de props casar; confirmar que `EvolucaoMensalChart` continua recebendo `dados={evolucaoMensal}` com a forma estendida.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run tests/dashboards.snapshot.test.ts tests/dashboards.queries.test.ts</automated>
  </verify>
  <done>O componente usa BarChart com 5 `<Bar>` agrupadas (sem stackId), tokens var(--chart-1..5), `npx tsc --noEmit` limpo; build do projeto compila.</done>
</task>

</tasks>

<verification>
- `npx prisma db push` aplica os 5 campos novos sem perda de dados existentes (todos `@default(0)`).
- `npx vitest run tests/dashboards.snapshot.test.ts tests/dashboards.queries.test.ts` passa.
- `npx tsc --noEmit` limpo.
- Manualmente (opcional): abrir /dashboards como DONO e confirmar o card "Evolução mensal" renderizando barras agrupadas com 5 categorias por mês.
</verification>

<success_criteria>
- 5 campos novos em `DesempenhoMensal` (`@default(0)`), preenchidos pelo snapshot a partir da população "criadas" (recorrentes por competencia + avulsas por createdAt no range).
- `listarEvolucaoMensal` retorna os 5 valores por mês: frozen do snapshot, live calculado com a mesma lógica, sem degrau no boundary.
- Gráfico de Evolução Mensal = barras agrupadas (5 `<Bar>`), estilo shadcn/dark mode preservado.
- Lógica existente (totalConcluidas, concluidasNoPrazo, percentual, totalEmpresas, totalTarefasPeriodo) totalmente intocada.
- Cada task commitável independentemente (Task 1: schema+snapshot; Task 2: queries; Task 3: chart).
</success_criteria>

<output>
Create `.planning/quick/260622-lty-trocar-grafico-evolucao-mensal-para-barr/260622-lty-SUMMARY.md` when done
</output>
