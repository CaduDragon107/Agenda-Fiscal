# Phase 3: Motor de Geração Automática Mensal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 3-Motor de Geração Automática Mensal
**Areas discussed:** Catálogo de obrigações por regime, Regras de ajuste de prazo (dia útil), Gatilho e responsável pela geração mensal, Idempotência e regeneração, Lucro Presumido (gap descoberto durante a discussão)

---

## Catálogo de obrigações — Lucro Real (dias-base)

| Option | Description | Selected |
|--------|-------------|----------|
| ICMS dia 9, PIS/COFINS dia 25, SPED dia 14 (padrão fiscal comum) | Sugestão genérica de mercado | |
| Vou informar os dias exatos agora | Usuário digita os dias reais usados no escritório | ✓ |

**User's choice:** Dias reais informados: ICMS 20, PIS/COFINS 24 ou 25, SPED Fiscal 18 ou 19, SPED Contribuições 30 ou 31, DAS 20. Competência janeiro vence em fevereiro.
**Notes:** As variações ("24 ou 25", "18 ou 19", "30 ou 31") são o efeito do ajuste de dia útil ano a ano — não dois valores fixos diferentes.

---

## Dia-base confirmado e direção do ajuste

| Option | Description | Selected |
|--------|-------------|----------|
| ICMS=20, PIS/COFINS=25, SPED Fiscal=19, SPED Contrib.=31, DAS=20 | Maior valor informado como dia-base; ajuste de dia útil recua para os valores menores | ✓ |
| Outro valor — especificar manualmente | | |

**User's choice:** Confirmado dia-base ICMS=20, PIS/COFINS=25, SPED Fiscal=19, SPED Contribuições=31, DAS=20.

| Option | Description | Selected |
|--------|-------------|----------|
| Sempre antecipar para o dia útil anterior | Padrão fiscal brasileiro mais comum | ✓ |
| Depende da obrigação — especificar caso a caso | | |

**User's choice:** Sempre antecipar, sem exceção por tipo de obrigação.

---

## Defasagem competência → vencimento

| Option | Description | Selected |
|--------|-------------|----------|
| Todas vencem no mês seguinte (+1 mês) | Competência janeiro → vencimento fevereiro, para todas as 5 obrigações | ✓ |
| Alguma tem defasagem diferente | | |

**User's choice:** Todas as obrigações (ICMS, PIS/COFINS, SPED Fiscal, SPED Contribuições, DAS) vencem no mês seguinte ao da competência.

---

## Gatilho da geração mensal

| Option | Description | Selected |
|--------|-------------|----------|
| Automático (cron) + botão manual de backup | Cron roda dia 1 + DONO tem botão de fallback | ✓ |
| Só automático (cron), sem botão manual | | |
| Só botão manual, sem cron automático | | |

**User's choice:** Automático (cron) + botão manual de backup para o DONO.

---

## Responsável da tarefa gerada

| Option | Description | Selected |
|--------|-------------|----------|
| Sempre o responsável cadastrado na empresa | Usa o campo `responsavelId` já existente em `Empresa` | ✓ |
| Pode variar por tipo de obrigação | Exigiria campo de responsável por obrigação | |

**User's choice:** Sempre o responsável cadastrado na empresa, para todas as obrigações daquela empresa.

---

## Idempotência

| Option | Description | Selected |
|--------|-------------|----------|
| Pular duplicadas e mostrar resumo | Ex: "Geradas 87 tarefas novas, 18 já existiam (puladas)" | ✓ |
| Pular silenciosamente, sem feedback | | |

**User's choice:** Mostrar resumo de criadas vs. já existentes.

---

## Mudança de regime tributário no meio do mês

| Option | Description | Selected |
|--------|-------------|----------|
| Não afeta tarefas já geradas; só vale a partir da próxima geração | Lê o regime ATUAL no momento de gerar; sem recálculo retroativo | ✓ |
| Recalcular tarefas pendentes da competência atual quando o regime muda | Mais complexo | |

**User's choice:** Sem recálculo retroativo — próxima geração usa o novo regime.

---

## Lucro Presumido (gap descoberto durante a discussão)

> Achado: `STATE.md` já registrava que TASK-01/TASK-02 só definem regras para Lucro Real e Simples Nacional, deixando 50/198 (~25%) empresas reais (Lucro Presumido) sem regra de obrigação. Levantado proativamente nesta sessão antes de fechar o CONTEXT.md.

| Option | Description | Selected |
|--------|-------------|----------|
| Mesmas obrigações do Lucro Real: ICMS + PIS/COFINS + SPED | | |
| Apenas ICMS + PIS/COFINS (sem SPED) | | |
| Nenhuma geração automática ainda — fora da Fase 3 | | |
| Outra combinação — especificar | | ✓ |

**User's choice:** Lucro Presumido entrega apenas SPEDs (Fiscal + Contribuições), com os mesmos dias-base do Lucro Real (19 e 31) — sem ICMS, sem PIS/COFINS.
**Notes:** Confirmado explicitamente: "Os vencimentos são os mesmos do lucro real, e as atividades também, a única coisa que essas empresas entregam é os speds."

---

## Claude's Discretion

- Nome exato dos campos novos no schema Prisma (`tipoObrigacao`, `competencia`) e shape do índice único de idempotência.
- Localização do botão "Gerar tarefas do mês" na UI.
- Texto exato do título automático da tarefa gerada (ex: "ICMS — Outubro/2026").

## Deferred Ideas

- Recálculo retroativo de tarefas ao mudar regime tributário no meio do mês.
- Passo a passo estruturado por tipo de obrigação na tela de detalhe (TASK-06) — já deferido desde a Fase 2.
- Histórico cross-task na UI ("obrigação X da empresa Y ao longo dos meses") — schema sustenta via D-10, mas a UI fica para depois.
- Notificações por email/WhatsApp (NOTF-01) — v2.
