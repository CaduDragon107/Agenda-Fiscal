# Phase 4: Dashboards Comparativos - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega três dashboards somente leitura, visíveis ao dono (role DONO): (1) desempenho comparativo por colaborador, (2) evolução mensal de cumprimento de prazos com números de meses passados congelados, e (3) comparativo entre empresas por taxa de atraso recorrente. Não inclui novas ações sobre tarefas/empresas — apenas leitura e visualização agregada do que já existe (Tarefa, TarefaHistorico, Empresa).

</domain>

<decisions>
## Implementation Decisions

### Critério de "no prazo" (DASH-01)
- **D-01:** Uma tarefa é considerada "no prazo" quando `TarefaHistorico.concluidoEm <= Tarefa.prazo` (o campo `prazo` já é o resultado do ajuste para próximo dia útil feito pelo motor de geração na Fase 3 — não recalcular feriados/dias úteis aqui).
- **D-02:** Apenas tarefas com `status = CONCLUIDA` entram no cálculo de % no prazo. Tarefas ainda `PENDENTE` (mesmo que já vencidas) não contam nem como "no prazo" nem como "atrasada" até serem concluídas — ficam fora do denominador do dashboard de desempenho por colaborador.

### Normalização entre colaboradores (DASH-01)
- **D-03:** Métrica primária é percentual: tarefas concluídas no prazo / total de tarefas concluídas no período, por colaborador. Mostrar também o volume absoluto (nº de empresas na carteira, nº de tarefas) como contexto secundário ao lado do percentual — não ocultar o tamanho da carteira.

### Congelamento de meses fechados (DASH-02)
- **D-04:** Snapshot automático: quando o cron mensal (Fase 3, `executarGeracaoMensal`, disparado dia 1) gera as tarefas do novo mês, ele também calcula e persiste o snapshot de desempenho do mês anterior (mês que acabou de fechar) numa tabela nova (ex: `DesempenhoMensal` — por colaborador e/ou agregado). Isso roda no mesmo `instrumentation.ts` boot hook já existente, mesmo ponto de entrada do cron de Fase 3.
- **D-05:** O mês corrente (ainda em andamento) é calculado on-the-fly a partir de Tarefa/TarefaHistorico em tempo real — não tem snapshot ainda. Meses já fechados (com snapshot persistido) nunca são recalculados ao acessar o dashboard, mesmo que dados históricos mudem retroativamente (ex: edição manual de uma tarefa antiga).

### Ranking de empresas problemáticas (DASH-03)
- **D-06:** Métrica é percentual: tarefas atrasadas / total de tarefas da empresa no período (mesma lógica de "atrasada" = concluída após o prazo, OU pendente com prazo já vencido — esta segunda condição é específica deste dashboard, diferente do D-02 que exclui pendentes do desempenho por colaborador). Ordenar do maior para o menor percentual de atraso.

### Claude's Discretion
- Definição exata de "atrasada" para uma tarefa ainda `PENDENTE` com prazo vencido no contexto do DASH-03 (D-06) — considerar atrasada a partir do momento em que `prazo < now()`, sem necessidade de confirmação adicional do usuário.
- Período padrão de exibição (mês atual, últimos 6 meses, ano) e estrutura de navegação (página única com 3 seções vs páginas separadas vs tabs) ficam a critério da pesquisa/planejamento, guiados pelos padrões de UI já estabelecidos no projeto (shadcn, Recharts via `chart` component conforme CLAUDE.md).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack e padrões de gráficos
- `CLAUDE.md` — Recharts via shadcn `chart` component é o padrão definido para os 3 dashboards (Area/Bar/Line/Pie já estilizados); não instalar `recharts` manualmente, deixar `npx shadcn add chart` resolver a versão.

### Schema e regras de negócio existentes
- `prisma/schema.prisma` — `Tarefa` (campos `prazo`, `status: TarefaStatus { PENDENTE, CONCLUIDA }`, `responsavelId`), `TarefaHistorico` (`concluidoEm`, `concluidoPorId`), `Empresa` (`responsavelId`, `regimeTributario`). Nenhum status "ATRASADA" existe — atraso é sempre derivado por comparação de datas.
- `.planning/phases/03-motor-de-gera-o-autom-tica-mensal/` — Motor de geração mensal (cron via `instrumentation.ts`, `executarGeracaoMensal`, ajuste de prazo para dia útil via `date-holidays`). O snapshot mensal de desempenho (D-04) deve se acoplar ao mesmo hook de boot, não criar um segundo mecanismo de cron.
- `.planning/REQUIREMENTS.md` — DASH-01, DASH-02, DASH-03.
- `.planning/ROADMAP.md` — Phase 4 goal e success criteria (3 critérios, ver seção Phase Details).

### Controle de acesso
- `src/lib/visibility-scope.ts` (padrão `withVisibilityScope`/`withTarefaScope` de Fases 1-2) — os dashboards são exclusivos do role DONO (visão geral); colaborador não deve ter acesso a estas rotas/páginas.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `withTarefaScope` / `withVisibilityScope` (Fase 2-01): padrão de escopo por role — dashboards usam a variante "sem escopo" (DONO vê tudo), mas a checagem de role DONO deve seguir o mesmo padrão de guard usado em `gerarTarefasDoMesAction` (Fase 03-03): checar `role === 'DONO'` logo após `auth()`, antes de qualquer query.
- `date-fns` (já instalado desde Fase 02-02): útil para agregação por mês nos dashboards de evolução mensal.
- shadcn `chart` component (a instalar nesta fase): wrappers prontos sobre Recharts.

### Established Patterns
- Server Components + Server Actions (sem API routes separadas) para leitura de dados, conforme padrão das Fases 1-3.
- `db.$transaction` usado quando duas escritas precisam ser atômicas (Fase 02-02) — aplicável ao snapshot mensal (D-04) se este escrever em mais de uma tabela/linha agregada.

### Integration Points
- O job de snapshot mensal (D-04) se conecta ao `instrumentation.ts` existente, na mesma execução do cron que já gera as tarefas do novo mês (Fase 3).
- Páginas de dashboard são uma nova área da navegação (sidebar), visível apenas para DONO — integra com o shell de navegação já existente desde Fase 1.

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica fornecida nesta discussão — uso dos componentes de gráfico padrão do shadcn (Area/Bar/Line) é aceitável para os 3 dashboards.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma ideia de novo escopo surgiu durante a discussão — manteve-se dentro do domínio da fase (3 dashboards somente leitura).

</deferred>

---

*Phase: 4-Dashboards Comparativos*
*Context gathered: 2026-06-22*
