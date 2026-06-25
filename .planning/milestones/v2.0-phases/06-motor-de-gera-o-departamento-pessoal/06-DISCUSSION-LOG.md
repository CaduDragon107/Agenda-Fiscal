# Phase 6: Motor de Geração — Departamento Pessoal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 6-motor-de-gera-o-departamento-pessoal
**Areas discussed:** Empresas sem responsável DP, Eventos eSocial, Vencimentos DP, Vencimento Guias (follow-up)

---

## Empresas sem responsável de DP

| Option | Description | Selected |
|--------|-------------|----------|
| Pular e listar | Não cria tarefa; relatório lista empresas puladas para o dono atribuir | ✓ |
| Atribuir ao DONO como fallback | Tarefa criada e atribuída automaticamente ao DONO | |
| Bloquear a execução inteira | Geração de DP não roda para nenhuma empresa até resolver tudo | |

**User's choice:** Inicialmente respondeu fora das opções, com os nomes reais da equipe de DP (Lauany responsável, Lorraine/Mirela/Andre colaboradores). Em follow-up, confirmou explicitamente: "Pular e listar para o dono atribuir".
**Notes:** Os nomes reais (Lauany/Lorraine/Mirela/Andre) foram capturados em CONTEXT.md como nota para a renomeação futura dos placeholders DP1-4 — não fazem parte da política de geração desta fase.

---

## Eventos de eSocial (DP-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Só os periódicos mensais (S-1200/S-1210) | Eventos detalhados por tipo, não-periódicos ficam como tarefa avulsa | |
| Um item genérico "eSocial do mês" | Uma única tarefa mensal genérica "Fechamento eSocial" por empresa | ✓ |

**User's choice:** Um item genérico "eSocial do mês".
**Notes:** Sem detalhamento por tipo de evento nesta fase.

---

## Vencimentos DP (Folha, FGTS, INSS) — primeira rodada

| Option | Description | Selected |
|--------|-------------|----------|
| Convenção legal padrão | FGTS/INSS dia 20, Folha 5º dia útil, eSocial dia 15 | |
| Vou informar as datas exatas agora | Usuário informa o dia-base real usado pelo escritório | ✓ |

**User's choice:** Folha de Pagamento = 5º dia útil; Fechamento eSocial = dia 07; Fechamento de Guias = dia 12, condicionado a "se a REINF do Fiscal for dia 15, usar dia 15 para nós também".

---

## Vencimento de Guias (FGTS+INSS) — follow-up

Como o sistema não tem REINF cadastrada no motor Fiscal hoje, foi necessário um follow-up para resolver a condicional.

| Option | Description | Selected |
|--------|-------------|----------|
| Dia 12 | Dia-base fixo 12 para FGTS+INSS | |
| Dia 15 | Dia-base fixo 15 para FGTS+INSS (alinhado à REINF/eSocial) | ✓ |

**User's choice:** Dia 15, com a observação adicional "colocar o REINF no Fiscal" — capturado como ideia adiada (ver Deferred Ideas).

---

## Claude's Discretion

- Não bloquear a execução inteira da geração mensal por empresas sem responsável DP — pular é por empresa, outras seguem normalmente (D-03).
- Se "Fechamento de Guias" é uma tarefa única (FGTS+INSS) ou duas tarefas separadas por `TipoObrigacao` — optou-se por manter granular (duas), consistente com o padrão existente do catálogo Fiscal (D-06).
- Repontar a geração Fiscal existente para `EmpresaResponsavelSetor` nesta fase ou deixá-la lendo `responsavelId` legado — decisão técnica deixada para research/planner, ambos equivalentes em dados hoje por lockstep (Phase 5, T-05-12).

## Deferred Ideas

- Adicionar REINF ao motor Fiscal (TipoObrigacao novo) — mencionado pelo usuário ao resolver o vencimento de Guias de DP; fora do escopo desta fase.
- Renomeação dos placeholders DP1-4 para os nomes reais (Lauany/Lorraine/Mirela/Andre) — quick task futura, não bloqueia esta fase.
