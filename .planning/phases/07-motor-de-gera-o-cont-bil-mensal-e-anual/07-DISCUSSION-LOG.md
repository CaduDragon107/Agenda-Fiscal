# Phase 7: Motor de Geração — Contábil (mensal e anual) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 7-motor-de-gera-o-cont-bil-mensal-e-anual
**Areas discussed:** Obrigação mensal Contábil, Mapeamento regime → obrigação anual, Modelagem técnica da periodicidade anual, Empresas sem responsável Contábil

---

## Obrigação mensal Contábil — escopo de empresas

| Option | Description | Selected |
|--------|-------------|----------|
| Todas as empresas, qualquer regime | Lucro Real, Presumido e Simples Nacional recebem a tarefa mensal, independente do regime | ✓ (resposta inicial) |
| Só Lucro Real e Presumido | Simples Nacional fica de fora da escrituração mensal | |

**User's choice:** Inicialmente "Todas as empresas, qualquer regime" — depois **revertido** ao trazer a planilha real de rotina (ver abaixo), que é específica para "EMPRESAS LUCRO REAL E PRESUMIDO". Reconfirmado que Simples Nacional não recebe nenhuma das 8 rotinas.
**Notes:** A resposta inicial estava desalinhada com a prática real do escritório; corrigida após o usuário compartilhar a planilha "Programação contabilidade para MAIO/2026".

---

## Granularidade da obrigação mensal

| Option | Description | Selected |
|--------|-------------|----------|
| Uma única tarefa por mês — "Balanço" | Só a etapa final vira tarefa; demais etapas ficam fora do app | |
| Uma tarefa por etapa da rotina | Cada rotina (8 no total) vira um TipoObrigacao separado, com dia-base próprio | ✓ |

**User's choice:** Uma tarefa por etapa da rotina.
**Notes:** Usuário trouxe a planilha real "Programação contabilidade para MAIO/2026" com 8 rotinas e datas (01, 10, 14, 17, 22, 22, 25, 28) — capturado como D-01/D-02 em CONTEXT.md.

---

## Classificação "Grupo A/B/C"

| Option | Description | Selected |
|--------|-------------|----------|
| Adicionar campo Grupo na Empresa (A/B/C) | Novo enum classificatório, usado para filtrar rotinas por grupo | |
| Ignorar a distinção por agora, aplicar a todos | V1 simplificado: mesma data pra todo mundo | ✓ |

**User's choice:** Ignorar a distinção por agora.
**Notes:** A planilha real diferenciava datas por "Grupo A" vs "Grupo B/C e presumido" em algumas rotinas (PERDCOMP, Apuração Trimestral, Balanços eram exclusivas de Grupo A). Capturado como D-04 (Claude's Discretion) em CONTEXT.md.

---

## Apuração Trimestral (rotina real, dia 25, só Grupo A)

| Option | Description | Selected |
|--------|-------------|----------|
| Incluir nesta fase como periodicidade trimestral | Estende o motor para suportar trimestral | |
| Tratar como mensal por simplificação (v1) | Gera todo mês mesmo sendo conceitualmente trimestral | |
| Deixar de fora desta fase | Fica para fase futura | ✓ |

**User's choice:** Deixar de fora desta fase.
**Notes:** CONT-02 só prevê mensal e anual; trimestral seria uma terceira periodicidade fora do escopo planejado. Capturado em `<deferred>` no CONTEXT.md.

---

## Simples Nacional recebe rotina mensal contábil?

| Option | Description | Selected |
|--------|-------------|----------|
| Nenhuma — só Lucro Real e Presumido | As 8 rotinas são exclusivas de Lucro Real/Presumido | ✓ |
| Versão reduzida (só Balanço) | Simples Nacional recebe ao menos o fechamento de Balanço | |

**User's choice:** Nenhuma — só Lucro Real e Presumido.
**Notes:** Resolve a contradição com a resposta inicial da primeira pergunta desta sessão. Capturado como D-03 em CONTEXT.md.

---

## Mapeamento regime → obrigação anual

| Option | Description | Selected |
|--------|-------------|----------|
| ECD+ECF → Lucro Real/Presumido; DEFIS → Simples | Mapeamento padrão da legislação brasileira | ✓ |
| Outro mapeamento | Usuário informaria manualmente | |

**User's choice:** ECD+ECF → Lucro Real/Presumido; DEFIS → Simples Nacional.
**Notes:** Capturado como D-06 em CONTEXT.md.

---

## Vencimentos das obrigações anuais

| Option | Description | Selected |
|--------|-------------|----------|
| Padrão legal: ECD maio/31, ECF jul/31, DEFIS mar/31 | Datas oficiais usuais da legislação brasileira | ✓ |
| Outras datas | Usuário informaria datas reais do escritório | |

**User's choice:** Padrão legal (ECD 31/mai, ECF 31/jul, DEFIS 31/mar).
**Notes:** Capturado como D-07 em CONTEXT.md.

---

## Gatilho de criação da tarefa anual

| Option | Description | Selected |
|--------|-------------|----------|
| Criada no início do ano (janeiro) | As 3 tarefas anuais são criadas de uma vez em janeiro | |
| Criada com antecedência curta antes do vencimento | Cada obrigação é criada 1 mês antes do próprio vencimento | ✓ |

**User's choice:** Criada com antecedência curta (1 mês antes).
**Notes:** Capturado como D-08 em CONTEXT.md.

---

## Empresas sem responsável Contábil

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, mesmo padrão (pular + listar) | Consistente com Fase 5/6 | ✓ |
| Outro comportamento | Usuário especificaria algo diferente | |

**User's choice:** Sim, mesmo padrão (pular + listar), confirmado após uma resposta inicial fora de tópico (nomes da equipe).
**Notes:** Capturado como D-11 em CONTEXT.md. Nomes da equipe real (Elisabete responsável, Ranielly e Sarah colaboradoras) capturados em `<specifics>` para renomeação futura dos placeholders.

---

## Claude's Discretion

- Nomenclatura exata dos novos `TipoObrigacao` para as 8 rotinas mensais (D-05).
- Formato de `competencia` para tarefas anuais, desde que distinto do formato mensal `"YYYY-MM"` (D-09).
- Organização de código: bloco adicional dentro de `executarGeracaoMensal()` vs função separada para a geração anual (D-10).
- Reuso de `criarTarefa()` para tarefa avulsa Contábil sem mudança de fluxo (D-12).

## Deferred Ideas

- Apuração Trimestral — periodicidade trimestral fora do escopo desta fase.
- Classificação "Grupo A/B/C" de empresas — ignorada nesta fase, pode virar campo futuro.
- Renomeação dos placeholders `Contabil1-3` para Elisabete/Ranielly/Sarah — quick task futura.
