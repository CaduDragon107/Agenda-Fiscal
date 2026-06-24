# Phase 6: Motor de Geração — Departamento Pessoal - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega a geração automática mensal das obrigações de DP (Folha de Pagamento, FGTS, INSS, eSocial) para toda empresa com `temFuncionariosClt = true`, atribuída ao responsável de DP correto via `EmpresaResponsavelSetor`, com prazo ajustado por dia útil/feriado e sem duplicação — mais o reuso do mecanismo de tarefa avulsa já existente para a equipe de DP.

Esta fase NÃO inclui: geração Contábil (Phase 7), dashboards de DP (Phase 8, DP-06/07/08), nem adicionar REINF ao motor Fiscal (ideia que surgiu na discussão, ver `<deferred>`).

</domain>

<decisions>
## Implementation Decisions

### Empresas sem responsável de DP atribuído
- **D-01:** Hoje **todas** as empresas com `temFuncionariosClt = true` estão sem responsável de DP atribuído (herança de D-01 da Phase 5 — atribuição começou null para as 197 empresas). Como `Tarefa.responsavelId` é obrigatório no schema, a geração mensal de DP **pula** (não cria nenhuma tarefa) para empresas CLT sem responsável de DP definido em `EmpresaResponsavelSetor`.
- **D-02:** O relatório/resultado da execução da geração mensal deve **listar explicitamente** as empresas puladas por falta de responsável de DP, para o dono atribuir manualmente (ex: à Lauany) — mesmo padrão de visibilidade que já existe para "sem responsável" na tela de empresas (Phase 5, D-03). Assim que a atribuição for feita, a tarefa entra normalmente na próxima execução (mensal ou reexecução manual).
- **D-03 (Claude's Discretion):** Não bloquear a execução inteira por causa de empresas sem responsável de DP — outras empresas (Fiscal, ou DP já atribuído) devem gerar normalmente. O "pular e listar" é por empresa, não global.

### Equipe real de DP (para renomeação futura dos placeholders)
- **D-04:** A equipe real de DP, para referência ao renomear os placeholders `DP1-4` criados na Phase 5 (fora do escopo desta fase, é uma quick task futura como já foi feito para o Fiscal): **Lauany** (responsável pelo setor), **Lorraine**, **Mirela**, **Andre** (colaboradores). Não renomear nesta fase — apenas nota para a próxima quick task de renomeação.

### Catálogo de obrigações de DP e dias-base
- **D-05:** Catálogo de obrigações de DP a adicionar (paralelo ao `CATALOGO_OBRIGACOES` existente, mas gatilho é `temFuncionariosClt = true`, não `regimeTributario`):
  - **Folha de Pagamento** — vencimento no **5º dia útil** do mês seguinte à competência. **Atenção de implementação:** isso é uma contagem de dias úteis a partir do dia 1 do mês seguinte, **diferente** do padrão `diaBase` (dia calendário fixo + antecipação se cair em fim de semana/feriado) usado pelas demais obrigações do catálogo atual (ICMS, PIS/COFINS, SPED, DAS) — `calcularPrazoBase` precisa de uma variante ou função nova para esse caso.
  - **eSocial (genérico)** — uma única tarefa mensal **"Fechamento eSocial"** por empresa, dia-base **07** do mês seguinte, sem detalhamento por tipo de evento (S-1200/S-1210 etc. não são tarefas separadas nesta fase).
  - **Fechamento de Guias (FGTS + INSS)** — uma tarefa por empresa (ou duas, FGTS e INSS separadas — ver Claude's Discretion), dia-base **15** do mês seguinte.
  - Todos os dias-base (exceto Folha) seguem o padrão já existente: antecipar para o dia útil anterior se cair em fim de semana ou feriado nacional (D-05/D-06 da Phase 5, `anticiparParaDiaUtil`), nunca postergar.
- **D-06 (Claude's Discretion):** Se "Fechamento de Guias" deve ser uma tarefa única (FGTS+INSS juntos) ou duas tarefas separadas (`TipoObrigacao` distintos `FGTS` e `INSS`) — o usuário não especificou explicitamente; manter `TipoObrigacao` granular (um enum por obrigação, como já é ICMS/PIS_COFINS/SPED_FISCAL/SPED_CONTRIBUICOES separados) é mais consistente com o padrão existente e permite dashboards futuros (Phase 8) discriminarem FGTS vs INSS.

### Tarefa avulsa para DP
- **D-07:** Reuso direto do mecanismo de tarefa avulsa já existente (`criarTarefa()`) para a equipe de DP — sem mudança de fluxo necessária além de garantir que a autorização setor-aware da Phase 5 (`withVisibilityScope`/`withTarefaScope`) já filtra corretamente quem um colaborador de DP pode atribuir tarefa (a si mesmo ou a outro colega de DP), reaproveitando o que já foi validado na Phase 5.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fundação multi-setor (Phase 5 — pré-requisito direto desta fase)
- `.planning/phases/05-funda-o-multi-setor-schema-autoriza-o-e-empresas/05-CONTEXT.md` — decisões de schema/autorização sobre as quais esta fase se apoia (D-01 herdado, `EmpresaResponsavelSetor`, `temFuncionariosClt`)
- `.planning/research/PITFALLS.md` (Pitfall B1 e B3) — backfill verificado e extensão setor-aware sem regressão, mesmos princípios aplicam-se ao repontar a geração de DP para `EmpresaResponsavelSetor`
- `.planning/research/ARCHITECTURE.md` — decisões arquiteturais multi-setor

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` (DP-01 a DP-05) — requisitos formais desta fase
- `.planning/ROADMAP.md` (Phase 6) — goal, success criteria e dependências

### Motor de geração existente (Fiscal — padrão a estender, não recriar)
- `src/lib/geracao-tarefas.ts` — `gerarTarefasDoMes()`, `CATALOGO_OBRIGACOES`, `calcularPrazoBase()` (diaBase 31 → último dia do mês)
- `src/modules/tarefas/geracao.ts` — `executarGeracaoMensal()`, persistência via `createMany({ skipDuplicates: true })`, idempotência via `@@unique([empresaId, tipoObrigacao, competencia])`
- `src/lib/dia-util.ts` — `anticiparParaDiaUtil()`, `date-holidays` BR, regra `isHoliday(date) === false` (nunca `=== true`)
- `src/app/(app)/tarefas/actions.ts` — `criarTarefa()` (tarefa avulsa), `gerarTarefasDoMesAction()` (trigger manual)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/geracao-tarefas.ts` (`CATALOGO_OBRIGACOES`, `ObrigacaoRegra = { tipo, diaBase }`) — padrão de catálogo a estender com entradas de DP, gatilho trocado de `regimeTributario` para `empresa.temFuncionariosClt`
- `src/lib/dia-util.ts` (`anticiparParaDiaUtil`) — reusar sem alteração para todas as obrigações de DP exceto Folha de Pagamento (5º dia útil — contagem diferente)
- `criarTarefa()` em `src/app/(app)/tarefas/actions.ts` — já aceita atribuição manual e checagem de permissão (COLABORADOR só atribui a si mesmo; DONO atribui livremente) — reusar sem mudança para DP-05

### Established Patterns
- Idempotência via constraint de banco (`@@unique([empresaId, tipoObrigacao, competencia])`) + `skipDuplicates: true`, nunca check-before-insert — seguir o mesmo padrão para os novos `TipoObrigacao` de DP
- `Tarefa.responsavelId` é obrigatório (`String`, não nullable) — não é possível criar tarefa sem responsável definido, daí D-01/D-02 (pular + listar)

### Integration Points
- **Atribuição ainda não é setor-aware na geração:** `gerarTarefasDoMes()`/`executarGeracaoMensal()` hoje leem `empresa.responsavelId` (legado, Fiscal) diretamente — não há lookup de `EmpresaResponsavelSetor` ainda. Esta fase precisa introduzir esse lookup (`setor: "DP"`) para a nova geração de DP, e decidir (planner/pesquisa) se a geração Fiscal existente também migra para o lookup setor-aware nesta fase ou permanece lendo o legado (ambos equivalentes em dados hoje, por lockstep — Phase 5, T-05-12).
- `executarGeracaoMensal()` hoje itera só empresas com `regimeTributario` setado — precisa de um segundo loop (ou loop unificado) sobre empresas com `temFuncionariosClt = true`, independente do regime tributário (os dois eixos são ortogonais: uma empresa Simples Nacional com funcionários CLT recebe DAS (Fiscal) E Folha/FGTS/INSS/eSocial (DP)).

</code_context>

<specifics>
## Specific Ideas

- Dias-base exatos informados pelo usuário (equipe de DP do escritório): Folha de Pagamento = 5º dia útil; Fechamento eSocial = dia 07; Fechamento de Guias (FGTS+INSS) = dia 15.
- Nomes reais da equipe de DP para renomeação futura dos placeholders: Lauany (responsável), Lorraine, Mirela, Andre.

</specifics>

<deferred>
## Deferred Ideas

- **Adicionar REINF ao motor Fiscal** — o usuário mencionou, ao decidir o vencimento de Guias de DP, que a REINF deveria ser cadastrada no motor Fiscal (hoje não existe esse `TipoObrigacao`). Isso é uma nova obrigação Fiscal, fora do escopo desta fase (DP) — anotar para avaliação em fase futura ou backlog do roadmap.
- **Renomeação dos placeholders DP1-4** para os nomes reais (Lauany/Lorraine/Mirela/Andre) — mesmo padrão já usado para o Fiscal (`scripts/atualizar-responsaveis.mjs`), mas é uma quick task independente desta fase, não bloqueia a geração de tarefas.

</deferred>

---

*Phase: 6-motor-de-gera-o-departamento-pessoal*
*Context gathered: 2026-06-24*
