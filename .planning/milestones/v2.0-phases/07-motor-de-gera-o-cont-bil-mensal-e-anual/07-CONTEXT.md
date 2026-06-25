# Phase 7: Motor de Geração — Contábil (mensal e anual) - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega a geração automática mensal das rotinas de Escrituração/Balancete Contábil para empresas Lucro Real e Lucro Presumido, e — pela primeira vez no sistema — a geração automática **anual** de ECD, ECF e DEFIS conforme o regime tributário, sem colidir com a geração mensal. Inclui o reuso do mecanismo de tarefa avulsa já existente para a equipe de Contábil.

Esta fase NÃO inclui: dashboards Contábil (Phase 8, CONT-07/08/09), Apuração Trimestral (periodicidade trimestral não suportada nesta fase — ver `<deferred>`), nem a renomeação dos placeholders `Contabil1-3` para os nomes reais (quick task futura).

</domain>

<decisions>
## Implementation Decisions

### Obrigação mensal Contábil — granularidade e escopo
- **D-01:** CONT-01 é implementado como **múltiplas tarefas mensais distintas** (uma por rotina), não uma única tarefa "Escrituração/Balancete" genérica — segue o mesmo padrão de catálogo granular já usado no motor Fiscal (ICMS/PIS_COFINS/SPED_FISCAL/SPED_CONTRIBUICOES) e DP (FOLHA/ESOCIAL/FGTS/INSS).
- **D-02:** Catálogo de rotinas mensais Contábil (vencimento = dia-base do mês seguinte à competência, antecipado para dia útil anterior se cair em fim de semana/feriado, mesmo padrão de `anticiparParaDiaUtil`):
  | Rotina | Dia-base |
  |---|---|
  | Extrato Bancário (solicitação de envio) | 01 |
  | Lançamento de Extratos | 10 |
  | Folha de Pagamento (integração e conferência) | 14 |
  | Fiscal (integração de notas, depreciação, estoque) | 17 |
  | Baixa de Impostos, Guias e Despesas | 22 |
  | PERDCOMP | 22 |
  | Fornecedores e Clientes (baixa de saldos) | 25 |
  | Balanço (fechamento e salvamento) | 28 |
- **D-03:** Essas 8 rotinas mensais valem **somente para empresas Lucro Real e Lucro Presumido**. Empresas Simples Nacional **não** recebem nenhuma dessas tarefas — ficam só com DAS (Fiscal) e, se aplicável, Folha/eSocial/FGTS/INSS (DP).
- **D-04 (Claude's Discretion):** A distinção "Grupo A" vs "Grupo B/C e presumido" mencionada na rotina real do escritório (datas diferentes por grupo de cliente) é **ignorada nesta fase** — todas as 8 rotinas valem para todas as empresas Lucro Real/Presumido, na mesma data, independente de porte/grupo. Não criar campo de classificação de Grupo no schema. Pode ser refinado em fase futura se o usuário pedir.
- **D-05:** Nomenclatura dos `TipoObrigacao` para as 8 rotinas fica a critério do planner/executor (ex: `EXTRATO_BANCARIO`, `LANCAMENTO_EXTRATOS`, `FOLHA_CONTABIL`, `FISCAL_CONTABIL`, `BAIXA_IMPOSTOS`, `PERDCOMP`, `FORNECEDORES_CLIENTES`, `BALANCO`) — usar nomes claros e distintos dos `TipoObrigacao` já existentes (note que `FOLHA`/`FISCAL` já têm sentido específico no motor DP/Fiscal; usar sufixo ou nome que não colida).

### Obrigações anuais — mapeamento por regime e vencimento
- **D-06:** Mapeamento regime → obrigação anual:
  - **ECD** e **ECF** → empresas Lucro Real **e** Lucro Presumido (ambas obrigações, para os dois regimes).
  - **DEFIS** → exclusivo de empresas Simples Nacional.
- **D-07:** Vencimentos anuais (competência = ano-base anterior, ajustado para dia útil anterior se cair em fim de semana/feriado nacional):
  - **DEFIS** — até 31/março do ano seguinte ao ano-base.
  - **ECD** — até 31/maio do ano seguinte ao ano-base.
  - **ECF** — até 31/julho do ano seguinte ao ano-base.
- **D-08:** Cada tarefa anual é **criada com antecedência curta** (1 mês antes do próprio vencimento) — não todas de uma vez em janeiro. Ex: DEFIS é criada em fevereiro (mês anterior ao vencimento de março); ECD é criada em abril; ECF é criada em junho. O job mensal de geração (mesmo cron que já roda mensalmente) verifica, a cada execução, se o mês atual é "1 mês antes" do vencimento de alguma obrigação anual e, se sim, cria a tarefa correspondente para as empresas elegíveis pelo regime.

### Modelagem técnica da periodicidade anual
- **D-09 (Claude's Discretion):** Formato de `competencia` para tarefas anuais fica a critério do planner/researcher, desde que não colida com o formato mensal `"YYYY-MM"` já usado (ex: usar `"YYYY"` simples, ou `"YYYY-ANUAL"`) — a constraint `@@unique([empresaId, tipoObrigacao, competencia])` já garante idempotência entre execuções, bastando formato consistente e distinto do mensal.
- **D-10 (Claude's Discretion):** Se a geração anual roda dentro do mesmo `executarGeracaoMensal()` (um loop adicional condicional ao mês) ou como função separada chamada pelo mesmo cron mensal — ambos equivalentes em comportamento; decisão de organização de código fica com o planner, seguindo o padrão já usado para integrar geração Fiscal + DP num único job mensal (Phase 6).

### Empresas sem responsável Contábil
- **D-11:** Mesmo padrão já estabelecido em Fiscal (Phase 5, D-03) e DP (Phase 6, D-01/D-02): empresas sem responsável Contábil atribuído (`EmpresaResponsavelSetor` setor=CONTABIL) são **puladas** na geração (mensal e anual) — nenhuma tarefa é criada — e listadas explicitamente no relatório/resultado da execução para o dono atribuir manualmente. Demais empresas continuam gerando normalmente (pular é por empresa, não global).

### Tarefa avulsa para Contábil
- **D-12 (Claude's Discretion):** Reuso direto do mecanismo de tarefa avulsa já existente (`criarTarefa()`) para a equipe de Contábil, sem mudança de fluxo — a autorização setor-aware já filtra corretamente quem um colaborador de Contábil pode atribuir tarefa, mesmo padrão validado em DP (Phase 6, D-07).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fundação multi-setor (Phase 5 — pré-requisito direto desta fase)
- `.planning/phases/05-funda-o-multi-setor-schema-autoriza-o-e-empresas/05-CONTEXT.md` — decisões de schema/autorização (`EmpresaResponsavelSetor`, setor CONTABIL já existe no enum `Setor` e em `prisma/seed.ts`)
- `.planning/research/PITFALLS.md` (Pitfall B1 e B3) — backfill verificado e extensão setor-aware sem regressão
- `.planning/research/ARCHITECTURE.md` — decisões arquiteturais multi-setor

### Motor de geração DP (Phase 6 — padrão direto a replicar para Contábil)
- `.planning/phases/06-motor-de-gera-o-departamento-pessoal/06-CONTEXT.md` — decisões D-01/D-02 (pular + listar sem responsável) e D-05/D-06 (catálogo de obrigações com gatilho não-regime, `temFuncionariosClt`)
- `src/lib/geracao-tarefas-dp.ts` — catálogo de obrigações DP, padrão a replicar para Contábil (gatilho por `temFuncionariosClt` em vez de `regimeTributario`, análogo ao gatilho por `regimeTributario` que o Contábil também usa)

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` (CONT-01 a CONT-09) — requisitos formais desta fase
- `.planning/ROADMAP.md` (Phase 7) — goal, success criteria e dependências

### Motor de geração existente (Fiscal — padrão a estender, não recriar)
- `src/lib/geracao-tarefas.ts` — `gerarTarefasDoMes()`, `CATALOGO_OBRIGACOES: Record<RegimeTributario, ObrigacaoRegra[]>`, `calcularPrazoBaseDiaFixo()` (diaBase fixo no mês seguinte)
- `src/modules/tarefas/geracao.ts` — `executarGeracaoMensal()`, persistência via `createMany({ skipDuplicates: true })`, idempotência via `@@unique([empresaId, tipoObrigacao, competencia])`
- `src/lib/dia-util.ts` — `anticiparParaDiaUtil()`, `date-holidays` BR
- `src/app/(app)/tarefas/actions.ts` — `criarTarefa()` (tarefa avulsa), `gerarTarefasDoMesAction()` (trigger manual)
- `prisma/schema.prisma` — `enum TipoObrigacao` (linha 36), `enum RegimeTributario` (linha 25), `model Tarefa` (`competencia: String?`, `@@unique([empresaId, tipoObrigacao, competencia])`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/geracao-tarefas.ts` (`CATALOGO_OBRIGACOES`, `ObrigacaoRegra = { tipo, diaBase }`) — padrão de catálogo a estender com as 8 entradas mensais Contábil, gatilho continua sendo `empresa.regimeTributario` (LUCRO_REAL e LUCRO_PRESUMIDO, não SIMPLES_NACIONAL)
- `src/lib/dia-util.ts` (`anticiparParaDiaUtil`) — reusar sem alteração para todas as 8 rotinas mensais e para as 3 obrigações anuais
- `criarTarefa()` em `src/app/(app)/tarefas/actions.ts` — reusar sem mudança para CONT-06

### Established Patterns
- Idempotência via constraint de banco (`@@unique([empresaId, tipoObrigacao, competencia])`) + `skipDuplicates: true`, nunca check-before-insert — seguir o mesmo padrão para os novos `TipoObrigacao` Contábil (mensais e anuais)
- Lookup setor-aware via `EmpresaResponsavelSetor` (setor=CONTABIL) introduzido em DP (Phase 6) — replicar o mesmo padrão para Contábil em vez de usar `empresa.responsavelId` legado

### Integration Points
- `executarGeracaoMensal()` (Phase 6 já estendeu para FISCAL + DP) precisa de um terceiro bloco para Contábil mensal (regime-based, igual Fiscal) e um bloco condicional para as 3 obrigações anuais (dispara só quando o mês atual é "1 mês antes" do vencimento de ECD/ECF/DEFIS)
- `prisma/seed.ts` já cria placeholders `Contabil1` (responsável) — Phase 5 já deixou a infraestrutura de setor CONTABIL pronta (enum `Setor.CONTABIL`, `EmpresaResponsavelSetor`, filtros em `listarResponsaveis("CONTABIL")`, `empresas-table.tsx`)

</code_context>

<specifics>
## Specific Ideas

- Rotina mensal real do escritório (planilha "Programação contabilidade") trazida pelo usuário, com 8 etapas e dias-base exatos — ver D-02.
- Nomes reais da equipe Contábil para renomeação futura dos placeholders `Contabil1-3`: **Elisabete** (responsável pelo setor), **Ranielly**, **Sarah** (colaboradoras).
- Vencimentos anuais usam datas-padrão da legislação brasileira (DEFIS 31/mar, ECD 31/mai, ECF 31/jul) — confirmado pelo usuário como suficiente, sem datas específicas diferentes da prática do escritório.

</specifics>

<deferred>
## Deferred Ideas

- **Apuração Trimestral** (rotina real do escritório, dia 25, só Grupo A) — periodicidade trimestral não é suportada nesta fase (CONT-02 só prevê mensal e anual). Fica para fase futura quando o motor suportar uma terceira periodicidade, ou pode ser tratada como mensal por simplificação numa iteração posterior.
- **Classificação "Grupo A/B/C" de empresas** — usada na rotina real para diferenciar datas por porte/complexidade de cliente. Ignorada nesta fase (D-04); pode virar um campo classificatório futuro se o usuário quiser refinar os dias-base por grupo.
- **Renomeação dos placeholders Contabil1-3** para os nomes reais (Elisabete/Ranielly/Sarah) — mesmo padrão já usado para Fiscal e DP, mas é uma quick task independente desta fase.

</deferred>

---

*Phase: 7-motor-de-gera-o-cont-bil-mensal-e-anual*
*Context gathered: 2026-06-24*
