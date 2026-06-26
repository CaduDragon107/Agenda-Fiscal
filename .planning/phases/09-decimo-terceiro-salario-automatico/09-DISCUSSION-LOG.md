# Phase 9: 13º Salário Automático - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 9-13º Salário Automático
**Areas discussed:** Vencimento e parcela de referência, Antecedência de criação, Título e tipo de obrigação

---

## Vencimento e parcela de referência

| Option | Description | Selected |
|--------|-------------|----------|
| 2ª parcela / saldo — 20/dez | Vencimento legal mais tardio e mais crítico (saldo final do 13º). Mesma lógica de "vencimento final" usada em ECD/ECF/DEFIS. | ✓ |
| 1ª parcela — 30/nov | Antecipação obrigatória do 13º — tornaria a tarefa um lembrete de início, não de fechamento. | |
| Outra data/convenção do escritório | Data interna diferente das datas legais oficiais. | |

**User's choice:** 2ª parcela / saldo — 20/dez
**Notes:** O vencimento cai no MESMO ano-base (anoVencimento = anoAtual), diferente do padrão ECD/ECF/DEFIS (anoVencimento = anoAtual + 1) — divergência estrutural anotada em CONTEXT.md D-02 para o researcher/planner avaliarem.

---

## Antecedência de criação

| Option | Description | Selected |
|--------|-------------|----------|
| 1 mês antes — criada em novembro | Mesmo padrão de antecedência do ECD/ECF/DEFIS (mesCriacao = mesVencimento - 1). | ✓ |
| 2 meses antes — criada em outubro | Mais tempo de preparo, dado que o cálculo de 13º costuma ser mais complexo que ECD/ECF/DEFIS. | |
| Outra antecedência | Número diferente de meses. | |

**User's choice:** 1 mês antes — criada em novembro
**Notes:** Usuário priorizou consistência com o motor já validado em vez de uma regra de antecedência especial para esta obrigação.

---

## Título e tipo de obrigação

| Option | Description | Selected |
|--------|-------------|----------|
| "13º Salário - {ano}" (tipoObrigacao: DECIMO_TERCEIRO) | Título simples, sem mencionar parcela específica, consistente com o padrão `${TITULO} - ${competenciaAnual}` do catálogo anual Contábil. | ✓ |
| "13º Salário - 2ª Parcela - {ano}" (tipoObrigacao: DECIMO_TERCEIRO) | Título explícito sobre a parcela coberta. | |
| Outro nome/convenção | Título ou nome de tipoObrigacao diferente. | |

**User's choice:** "13º Salário - {ano}" (tipoObrigacao: DECIMO_TERCEIRO)
**Notes:** Nenhuma.

---

## Claude's Discretion

- Onde o novo catálogo/lógica deve viver no código (novo arquivo, extensão de `geracao-tarefas-dp.ts`, ou generalização do motor anual Contábil para aceitar setor + `vencimentoMesmoAno`).
- Estrutura do teste de sweep de 12 meses verificando exatamente 1 tarefa `DECIMO_TERCEIRO` por empresa por ano.

## Deferred Ideas

Nenhuma — discussão ficou inteiramente dentro do escopo de DP-09.
