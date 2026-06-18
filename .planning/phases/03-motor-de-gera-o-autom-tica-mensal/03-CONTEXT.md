# Phase 3: Motor de Geração Automática Mensal - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Job mensal que gera automaticamente as tarefas recorrentes de cada empresa-cliente conforme seu regime tributário, com prazo calculado dinamicamente (ajuste de dia útil/feriado, sem listas fixas por ano), sem duplicar entre execuções, alimentando a interface de `/tarefas` já construída na Fase 2.

**In scope:** enum `TipoObrigacao` no schema de Tarefa; catálogo de obrigações por regime tributário (Lucro Real, Lucro Presumido, Simples Nacional); cálculo de prazo (dia-base + ajuste de dia útil via `date-holidays`); job de geração mensal (cron embutido no processo Railway, via `node-cron`) + botão manual de backup na UI; idempotência por (empresaId + tipoObrigacao + competência); resumo de execução (criadas vs já existentes).

**Out of scope (fases futuras):** histórico cross-task "obrigação X da empresa Y ao longo dos meses" (UI); recálculo retroativo de tarefas já geradas quando o regime tributário de uma empresa muda; notificações por email/WhatsApp (v2); passo a passo estruturado por tipo de obrigação na tela de detalhe (pode ser incremental, mas o `descricao` livre da Fase 2 já cobre o mínimo).

</domain>

<decisions>
## Implementation Decisions

### Catálogo de Obrigações por Regime

- **D-01:** Novo enum `TipoObrigacao` no Prisma: `ICMS`, `PIS_COFINS`, `SPED_FISCAL`, `SPED_CONTRIBUICOES`, `DAS`. PIS e COFINS são tratados como uma única obrigação/tarefa (mesmo vencimento, consistente com a planilha "Controle pis e cofins" já usada no escritório).
- **D-02:** Catálogo de obrigações por `RegimeTributario` (dia-base do mês seguinte à competência, antes do ajuste de dia útil):

  | Regime | Obrigações geradas | Dia-base |
  |---|---|---|
  | `LUCRO_REAL` | ICMS, PIS_COFINS, SPED_FISCAL, SPED_CONTRIBUICOES | 20, 25, 19, 31 |
  | `LUCRO_PRESUMIDO` | SPED_FISCAL, SPED_CONTRIBUICOES **apenas** (sem ICMS, sem PIS/COFINS) | 19, 31 |
  | `SIMPLES_NACIONAL` | DAS | 20 |

  **Gap original do ROADMAP/STATE.md resolvido nesta discussão:** Lucro Presumido (50/198 empresas reais, ~25%) não tinha regra definida — confirmado que só entrega SPEDs, com os mesmos dias-base do Lucro Real.
- **D-03:** Toda obrigação vence sempre no mês seguinte ao da competência apurada (ex: competência janeiro → vencimento em fevereiro). Sem exceções de defasagem maior nesta fase.
- **D-04:** `SPED_CONTRIBUICOES` com dia-base 31 deve usar o último dia do mês de vencimento quando esse mês não tiver 31 dias (ex: fevereiro) — calcular via `date-fns` (`lastDayOfMonth` ou equivalente), não hardcoded.

### Ajuste de Dia Útil

- **D-05:** Quando o dia-base cai em fim de semana ou feriado nacional, a regra é **sempre antecipar** (recua para o último dia útil anterior) — para todas as 5 obrigações, sem exceção por tipo.
- **D-06:** Cálculo de feriado deve ser dinâmico (biblioteca `date-holidays` com `new Holidays('BR')`), nunca lista fixa de feriados por ano — requisito explícito do ROADMAP (Success Criteria #2) e do CLAUDE.md ("What NOT to Use").

### Gatilho e Responsável

- **D-07:** Geração automática via cron embutido no processo Node do Railway (`node-cron`, ex: `0 6 1 * *` — todo dia 1 às 6h), consistente com a decisão de hosting já tomada (Railway + Neon, processo `next start` sempre ativo — não é Vercel/serverless). Ver `.planning/STATE.md` linha 76.
- **D-08:** Além do cron, existe um botão manual "Gerar tarefas do mês" na UI (visível só para DONO) que aciona a mesma rotina de geração — serve de fallback se o cron falhar e permite gerar antes do dia 1 se necessário.
- **D-09:** O responsável de cada tarefa gerada é sempre o `responsavelId` já cadastrado na `Empresa` (Fase 1) — nenhuma obrigação tem responsável diferenciado por tipo nesta fase.

### Idempotência e Regeneração

- **D-10:** Idempotência verificada por chave composta `(empresaId, tipoObrigacao, competencia)` na tabela `tarefas` — rodar a geração 2x para a mesma competência não duplica, apenas pula as que já existem.
- **D-11:** O acionamento (manual ou cron) retorna/exibe um resumo: "Geradas {N} tarefas novas, {M} já existiam (puladas)" — nunca um pulo silencioso sem feedback.
- **D-12:** A geração lê o `regimeTributario` ATUAL da empresa no momento de gerar (não o histórico). Se o regime mudar no meio do mês, as tarefas já geradas para a competência vigente NÃO são recalculadas/canceladas — só a próxima geração (mês seguinte) usa o novo regime. Sem recálculo retroativo nesta fase.

### Modelo de Dados (extensão da Tarefa da Fase 2)

- **D-13:** Adicionar à `model Tarefa` (já existente, Fase 2): `tipoObrigacao TipoObrigacao?` (nullable — tarefas avulsas da Fase 2 continuam sem tipo) e `competencia String` (formato `"YYYY-MM"`, nullable para avulsas) ou campos equivalentes que sustentem o índice único de idempotência `@@unique([empresaId, tipoObrigacao, competencia])`. Tarefas avulsas (Fase 2, sem `tipoObrigacao`) não entram nessa constraint de unicidade.
- **D-14:** Tarefas geradas automaticamente usam o mesmo modelo `Tarefa`/`TarefaStatus`/alertas de prazo da Fase 2 — sem tabela separada. Aparecem nas mesmas listas/detalhe/badges já construídos.

### Claude's Discretion

- Nome exato dos campos novos no schema (`tipoObrigacao`, `competencia` vs. alternativas) e exact shape do índice único — pesquisador/planner decidem a melhor modelagem Prisma respeitando D-13.
- Onde o botão "Gerar tarefas do mês" mora na UI (página própria, ou item dentro de uma página de administração existente).
- Geração de `titulo` automático da tarefa por tipo de obrigação (ex: "ICMS — Outubro/2026") — texto exato é decisão de implementação, desde que claro.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos desta fase
- `.planning/REQUIREMENTS.md` — TASK-01, TASK-02
- `.planning/ROADMAP.md` §Phase 3 — Goal, Success Criteria
- `.planning/STATE.md` linha 108 — Blocker original sobre Lucro Presumido sem regra (resolvido nesta discussão, ver D-01/D-02)
- `.planning/STATE.md` linha 76 — Decisão de hosting Railway + Neon (relevante para D-07: cron embutido, não Vercel Cron)

### Padrões estabelecidos nas Fases 1-2 (reutilizar)
- `prisma/schema.prisma` — `model Tarefa`, `enum TarefaStatus`, `enum RegimeTributario` (3 valores: LUCRO_REAL, LUCRO_PRESUMIDO, SIMPLES_NACIONAL), `model Empresa` (campo `responsavelId`)
- `src/lib/visibility-scope.ts` — `withTarefaScope`, reutilizado sem alteração (tarefas geradas seguem a mesma regra de visibilidade)
- `src/modules/tarefas/queries.ts`, `src/modules/tarefas/schema.ts`, `src/app/(app)/tarefas/actions.ts` — padrão de Server Actions/queries da Fase 2, a estender (não substituir)
- `.planning/phases/01-funda-o-acesso-empresas-e-importa-o/01-RESEARCH.md` Pattern 3.5 e linha 445 — distribuição real de regimes (61 LUCRO_REAL / 80 SIMPLES_NACIONAL / 50 LUCRO_PRESUMIDO / 7 sem regime) e o gap de Lucro Presumido agora resolvido

### Stack recomendada (CLAUDE.md)
- `node-cron` — agendamento do job mensal (variante Railway, não Vercel Cron)
- `date-holidays` (`new Holidays('BR')`) — cálculo dinâmico de feriados nacionais, nunca lista fixa por ano
- `date-fns` — já instalado (`^4.4.0`); usar para soma/comparação de datas e último-dia-do-mês (D-04)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `model Tarefa` + `enum TarefaStatus` (`prisma/schema.prisma`) — estender com `tipoObrigacao`/`competencia`, não recriar
- `withTarefaScope(user)` (`src/lib/visibility-scope.ts`) — geração automática não precisa de novo escopo; tarefas geradas já respeitam a regra existente via `responsavelId`
- `calcularAlertaPrazo` (`src/lib/alert-prazo.ts`) — funciona automaticamente para tarefas geradas, sem alteração
- `TAREFA_SELECT`, `listarTarefas`, `buscarTarefaPorId` (`src/modules/tarefas/queries.ts`) — tarefas geradas aparecem nessas queries sem mudança, desde que o novo campo `tipoObrigacao` seja opcional

### Established Patterns
- **Server Actions guard:** toda action começa com `auth()` + checagem de sessão (replicar no botão manual de geração)
- **Anti-IDOR / RBAC:** botão "Gerar tarefas do mês" deve ser restrito a `role === "DONO"` (mesmo padrão de outras ações administrativas)
- **`@@map`/`@@index`:** seguir convenção já usada em `Tarefa`/`TarefaHistorico` para os novos campos/índices

### Integration Points
- `prisma/schema.prisma` — adicionar `enum TipoObrigacao`, estender `model Tarefa` com `tipoObrigacao`/`competencia` + `@@unique`
- Novo módulo de geração (ex: `src/lib/geracao-tarefas.ts` ou `src/modules/tarefas/geracao.ts`) — função pura que recebe lista de empresas + competência e retorna tarefas a criar, testável sem cron/UI
- `lib/scheduler.ts` (citado no CLAUDE.md como padrão Railway) — ponto de entrada do `node-cron`, iniciado no boot do processo Next.js
- `src/app/(app)/tarefas/` — botão manual de geração integra na página existente ou em rota administrativa nova restrita a DONO

</code_context>

<specifics>
## Specific Ideas

- Dias-base confirmados pelo usuário (uso real do escritório, antes do ajuste de dia útil): ICMS=20, PIS/COFINS=25, SPED Fiscal=19, SPED Contribuições=31, DAS=20.
- Ajuste sempre antecipa (nunca posterga) para o último dia útil anterior quando cai em fim de semana/feriado.
- Lucro Presumido entrega só SPEDs (Fiscal + Contribuições), mesmos dias-base do Lucro Real — sem ICMS, sem PIS/COFINS.
- Resumo de execução esperado: algo como "Geradas 87 tarefas novas, 18 já existiam (puladas)".

</specifics>

<deferred>
## Deferred Ideas

- **Recálculo retroativo ao mudar regime tributário no meio do mês:** fora de escopo — só a próxima geração usa o novo regime (D-12). Se o usuário precisar disso no futuro, é uma fase própria.
- **Passo a passo estruturado por tipo de obrigação (TASK-06):** referenciado como deferido desde a Fase 2 (`02-CONTEXT.md`); esta fase só introduz o `tipoObrigacao` no schema, mas não constrói UI de passo a passo estruturado nem referência automática às ferramentas Python de ICMS/PIS-COFINS — pode ser conteúdo de uma fase de UX incremental.
- **Histórico cross-task na tela de detalhe** ("obrigação X da empresa Y ao longo dos meses"): mencionado no ROADMAP original de TASK-05, mas não faz parte do Success Criteria desta fase — a Fase 3 só garante que a constraint de idempotência (D-10) sustenta esse histórico no banco; a UI para exibi-lo fica para depois.
- **Notificações externas (NOTF-01):** email/WhatsApp continuam v2, fora do escopo do v1 (reafirmado, já deferido na Fase 2).

</deferred>

---

*Phase: 3-Motor de Geração Automática Mensal*
*Context gathered: 2026-06-18*
