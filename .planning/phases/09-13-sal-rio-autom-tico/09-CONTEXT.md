# Phase 9: 13º Salário Automático - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Toda empresa com `temFuncionariosClt = true` recebe, uma vez por ano, uma tarefa de 13º salário gerada automaticamente pelo cron mensal, sem necessidade de criação manual e sem duplicação em execuções repetidas no mesmo ano. Empresa com `temFuncionariosClt = false` nunca recebe a tarefa. Reaproveita o motor de periodicidade anual já validado na Fase 7 (ECD/ECF/DEFIS) — catálogo puro de regras + decisão por mês de execução + idempotência via `@@unique([empresaId, tipoObrigacao, competencia])`. DP-09 é puramente backend/geração — não calcula valores monetários, não introduz cadastro de funcionários individuais.

</domain>

<decisions>
## Implementation Decisions

### Vencimento e parcela de referência
- **D-01:** A tarefa única rastreada pelo sistema representa o vencimento da **2ª parcela / saldo do 13º salário — 20/dezembro**, não a 1ª parcela (30/nov). Mesma lógica das obrigações anuais já implementadas: rastrear a data legal definitiva de fechamento da obrigação do ano, não uma antecipação intermediária.
- **D-02:** O vencimento (20/dez) cai no **MESMO ano-base** da competência — diferente do padrão ECD/ECF/DEFIS em `geracao-tarefas-contabil-anual.ts`, onde `anoVencimento = anoAtual + 1`. Para o 13º salário, `anoVencimento = anoAtual`. Esta é a divergência estrutural mais importante em relação ao catálogo anual Contábil existente — researcher/planner devem decidir se o motor genérico anual precisa de um campo explícito (ex: `vencimentoMesmoAno: boolean`) em vez de assumir sempre "ano seguinte".
- **D-03:** Prazo final ainda passa por `anticiparParaDiaUtil` (antecipa para o dia útil anterior se cair em fim de semana/feriado nacional), igual a todas as demais obrigações anuais e mensais — sem mudança nessa regra.

### Antecedência de criação
- **D-04:** A tarefa é criada **1 mês antes do vencimento** (mesCriacao = mesVencimento - 1 = novembro), mesmo padrão de antecedência usado em ECD/ECF/DEFIS. Não foi adotada antecedência maior (2 meses) apesar do 13º envolver cálculo de folha mais complexo — o usuário optou por manter consistência com o motor já validado em vez de uma regra especial.

### Título e tipo de obrigação
- **D-05:** `tipoObrigacao`: `DECIMO_TERCEIRO` (novo valor no enum `TipoObrigacao`, distinto de todos os tipos mensais/anuais existentes — preserva o invariante de unicidade entre eixos mensal/anual já estabelecido em T-07-03).
- **D-06:** Título exibido: `"13º Salário - {ano}"`, seguindo o padrão `${TITULO_OBRIGACAO_ANUAL[tipo]} - ${competenciaAnual}` já usado em ECD/ECF/DEFIS. Sem menção explícita a "2ª parcela" no título — a tarefa representa o fechamento da obrigação do ano, não uma parcela específica.
- **D-07:** Competência da tarefa no formato `"YYYY"` (mesmo formato `competenciaAnual` do catálogo Contábil), representando o ano-base = ano em que o 13º é devido (não ano de criação, que é o mesmo ano nesta obrigação, ao contrário de DEFIS).

### Elegibilidade e responsável (carregado do padrão já estabelecido, não rediscutido)
- Gate de elegibilidade: somente `temFuncionariosClt = true`, independente de regime tributário (catálogo DP é flat, sem filtro por `RegimeTributario` — mesmo padrão de `geracao-tarefas-dp.ts`).
- Responsável lido via `responsaveisPorSetor` filtrado por `setor: "DP"` (nunca `empresa.responsavelId` legado) — mesmo padrão crítico (Pitfall 2 do Plano 06-02) já aplicado ao bloco DP mensal.
- Empresa elegível sem responsável de DP: pular e listar (`semResponsavelDp`), nunca lançar erro — mesmo padrão D-02/D-11 já usado nos blocos DP mensal e Contábil mensal/anual.

### Claude's Discretion
- Onde o novo catálogo/lógica deve viver no código (novo arquivo `geracao-tarefas-dp-anual.ts`, extensão de `geracao-tarefas-dp.ts`, ou generalização do motor anual de `geracao-tarefas-contabil-anual.ts` para aceitar setor + `vencimentoMesmoAno` como parâmetros) — decisão de arquitetura para o researcher/planner, não para o usuário.
- Teste de sweep de 12 meses para verificar exatamente 1 tarefa de `DECIMO_TERCEIRO` por empresa por ano, seguindo o mesmo padrão de teste já estabelecido para ECD/ECF/DEFIS (Pitfall B2 do `07-RESEARCH.md`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Motor de periodicidade anual (Fase 7 — a base que esta fase reaproveita)
- `src/lib/geracao-tarefas-contabil-anual.ts` — catálogo puro de obrigações anuais (DEFIS/ECD/ECF), função `obrigacoesAnuaisParaCompetencia`, `calcularPrazoAnual`. Padrão de referência para DP-09, exceto pela divergência `anoVencimento = anoAtual` (D-02).
- `src/modules/tarefas/geracao.ts` (linhas ~190-257) — bloco Contábil ANUAL dentro da transação mensal: filtro por `regra.regimesElegiveis`, lookup de responsável via `responsaveisPorSetor`, padrão skip+list para empresa sem responsável, dedup por `empresaId` entre blocos mensal/anual.

### Catálogo DP existente (Fase 6 — padrão de elegibilidade/responsável a seguir)
- `src/lib/geracao-tarefas-dp.ts` — catálogo flat de obrigações DP mensais (FOLHA/ESOCIAL/FGTS/INSS), sem filtro por regime tributário.
- `src/modules/tarefas/geracao.ts` (linhas ~122-151) — bloco DP mensal: gate `temFuncionariosClt: true`, lookup de responsável via `responsaveisPorSetor` filtrado por `setor: "DP"` (Pitfall 2 do Plano 06-02).

No external specs/ADRs além do ROADMAP.md e REQUIREMENTS.md já carregados — requisitos fully capturados nas decisões acima.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `anticiparParaDiaUtil` (`src/lib/dia-util.ts`) — ajuste de prazo para dia útil anterior, reusado sem modificação (D-03).
- `competenciaSchema` (`src/lib/competencia.ts`) — validação de formato de competência mensal "YYYY-MM", já usado para validar a competência recebida pelo motor antes de derivar a competência anual.
- Padrão `skipDuplicates: true` sobre `@@unique([empresaId, tipoObrigacao, competencia])` — idempotência entre execuções mensais repetidas, sem necessidade de mecanismo de controle adicional.

### Established Patterns
- Catálogo de regras é função pura, sem I/O/Prisma/auth/cron — testável exaustivamente sem banco nem mocks (mesmo padrão de `geracao-tarefas-dp.ts` e `geracao-tarefas-contabil-anual.ts`).
- Função `obrigacoesAnuaisParaCompetencia(competencia)` decide a partir do mês ATUAL se uma obrigação anual deve ser criada nesta execução — retorna `[]` na maioria dos meses, caminho normal, não erro.
- Responsável por setor sempre lido via `responsaveisPorSetor` filtrado pelo setor correto — nunca via `empresa.responsavelId` legado, que é exclusivo do Fiscal.

### Integration Points
- O novo bloco DP-anual entra na mesma transação `geracao.ts` que já orquestra os blocos Fiscal, DP mensal, Contábil mensal e Contábil anual — concatenado ao array `tarefas` final antes do `tx.tarefa.createMany`.
- Enum `TipoObrigacao` (Prisma schema) precisa do novo valor `DECIMO_TERCEIRO` — migration necessária.

</code_context>

<specifics>
## Specific Ideas

- O usuário confirmou explicitamente que a tarefa rastreada representa o **saldo/2ª parcela (20/dez)**, não a 1ª parcela de antecipação (30/nov) — essa é a data que "fecha" a obrigação do ano.
- O usuário optou por manter a antecedência de criação em 1 mês (mesmo padrão do motor anual já validado), recusando a opção de 2 meses mesmo sabendo que o cálculo de 13º é mais complexo que ECD/ECF/DEFIS.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma ideia fora do escopo surgiu durante a discussão — ficou inteiramente dentro do domínio de DP-09 (geração automática da tarefa única de 13º salário).

[Nenhum todo pendente encontrado para esta fase via `todo.match-phase`.]

</deferred>

---

*Phase: 9-13º Salário Automático*
*Context gathered: 2026-06-25*
