# Phase 7: Motor de Geração — Contábil (mensal e anual) - Research

**Researched:** 2026-06-24
**Domain:** Extensão do motor de geração mensal (TASK-01/DP-01..05) para um terceiro eixo de obrigações (Contábil, gatilho `regimeTributario` igual ao Fiscal mas excluindo SIMPLES_NACIONAL) + introdução da PRIMEIRA periodicidade anual do sistema (ECD/ECF/DEFIS), que precisa coexistir com a geração mensal sob a mesma constraint `@@unique([empresaId, tipoObrigacao, competencia])` sem colidir nem duplicar ao longo de 12 execuções/ano.
**Confidence:** HIGH — toda a pesquisa central (estrutura de catálogo, idempotência, leitura setor-aware, dia-útil) é leitura direta de código já maduro deste projeto (Fases 3, 5, 6) e validação executável da lógica de "1 mês antes do vencimento anual". O único ponto de incerteza genuína é de modelagem (formato de `competencia` anual), deixado como decisão de discrição no CONTEXT.md (D-09) — esta pesquisa resolve essa discrição com uma recomendação concreta e testável.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** CONT-01 é implementado como múltiplas tarefas mensais distintas (uma por rotina), não uma única tarefa "Escrituração/Balancete" genérica — segue o mesmo padrão de catálogo granular já usado no motor Fiscal (ICMS/PIS_COFINS/SPED_FISCAL/SPED_CONTRIBUICOES) e DP (FOLHA/ESOCIAL/FGTS/INSS).
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
- **D-03:** Essas 8 rotinas mensais valem somente para empresas Lucro Real e Lucro Presumido. Empresas Simples Nacional não recebem nenhuma dessas tarefas — ficam só com DAS (Fiscal) e, se aplicável, Folha/eSocial/FGTS/INSS (DP).
- **D-06:** Mapeamento regime → obrigação anual: ECD e ECF → empresas Lucro Real e Lucro Presumido (ambas obrigações, para os dois regimes). DEFIS → exclusivo de empresas Simples Nacional.
- **D-07:** Vencimentos anuais (competência = ano-base anterior, ajustado para dia útil anterior se cair em fim de semana/feriado nacional): DEFIS — até 31/março do ano seguinte ao ano-base. ECD — até 31/maio do ano seguinte ao ano-base. ECF — até 31/julho do ano seguinte ao ano-base.
- **D-08:** Cada tarefa anual é criada com antecedência curta (1 mês antes do próprio vencimento) — não todas de uma vez em janeiro. Ex: DEFIS é criada em fevereiro, ECD em abril, ECF em junho. O job mensal de geração verifica, a cada execução, se o mês atual é "1 mês antes" do vencimento de alguma obrigação anual e, se sim, cria a tarefa correspondente para as empresas elegíveis pelo regime.
- **D-11:** Empresas sem responsável Contábil atribuído (`EmpresaResponsavelSetor` setor=CONTABIL) são puladas na geração (mensal e anual) — nenhuma tarefa é criada — e listadas explicitamente no relatório/resultado da execução para o dono atribuir manualmente. Demais empresas continuam gerando normalmente (pular é por empresa, não global).

### Claude's Discretion

- **D-04:** A distinção "Grupo A" vs "Grupo B/C e presumido" mencionada na rotina real do escritório (datas diferentes por grupo de cliente) é ignorada nesta fase — todas as 8 rotinas valem para todas as empresas Lucro Real/Presumido, na mesma data, independente de porte/grupo. Não criar campo de classificação de Grupo no schema.
- **D-05:** Nomenclatura dos `TipoObrigacao` para as 8 rotinas fica a critério do planner/executor (ex: `EXTRATO_BANCARIO`, `LANCAMENTO_EXTRATOS`, `FOLHA_CONTABIL`, `FISCAL_CONTABIL`, `BAIXA_IMPOSTOS`, `PERDCOMP`, `FORNECEDORES_CLIENTES`, `BALANCO`) — usar nomes claros e distintos dos `TipoObrigacao` já existentes.
- **D-09:** Formato de `competencia` para tarefas anuais fica a critério do planner/researcher, desde que não colida com o formato mensal "YYYY-MM" já usado (ex: usar "YYYY" simples, ou "YYYY-ANUAL") — a constraint `@@unique([empresaId, tipoObrigacao, competencia])` já garante idempotência entre execuções, bastando formato consistente e distinto do mensal. **Esta pesquisa recomenda "YYYY"** (ver Pattern 2 e Assumption A1).
- **D-10:** Se a geração anual roda dentro do mesmo `executarGeracaoMensal()` (um loop adicional condicional ao mês) ou como função separada chamada pelo mesmo cron mensal — ambos equivalentes em comportamento; decisão de organização de código fica com o planner. **Esta pesquisa recomenda dentro do mesmo `executarGeracaoMensal`** (ver Pattern 3 e Alternatives Considered).
- **D-12:** Reuso direto do mecanismo de tarefa avulsa já existente (`criarTarefa()`) para a equipe de Contábil, sem mudança de fluxo — a autorização setor-aware já filtra corretamente quem um colaborador de Contábil pode atribuir tarefa.

### Deferred Ideas (OUT OF SCOPE)

- **Apuração Trimestral** (rotina real do escritório, dia 25, só Grupo A) — periodicidade trimestral não é suportada nesta fase (CONT-02 só prevê mensal e anual). Fica para fase futura.
- **Classificação "Grupo A/B/C" de empresas** — usada na rotina real para diferenciar datas por porte/complexidade de cliente. Ignorada nesta fase (D-04).
- **Renomeação dos placeholders Contabil1-3** para os nomes reais (Elisabete/Ranielly/Sarah) — mesmo padrão já usado para Fiscal e DP, mas é uma quick task independente desta fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-01 | Geração automática mensal de Escrituração/Balancete Contábil, para todas as empresas (Lucro Real/Presumido) | Pattern 1 (catálogo mensal análogo ao Fiscal), Standard Stack, Code Examples — 8 rotinas distintas, dia-base + `anticiparParaDiaUtil` reusado sem alteração |
| CONT-02 | Motor de geração estendido para suportar periodicidade ANUAL, além da mensal já existente | Pattern 2/3, Summary (resolução das 3 questões D-09/D-10/mecânica "1 mês antes"), Code Examples (`obrigacoesAnuaisParaCompetencia`), Pitfalls 1-2, Validation Architecture (teste de varredura de 12 meses) |
| CONT-03 | Geração automática anual de ECD para empresas Lucro Real (e Presumido, por D-06) | Pattern 2 (catálogo anual), Pitfall 3 (filtro por `regimesElegiveis`), Code Examples |
| CONT-04 | Geração automática anual de ECF | Pattern 2, Pitfall 1-2 (mês de criação junho, vencimento ano seguinte) |
| CONT-05 | Geração automática anual de DEFIS para empresas Simples Nacional | Pattern 2, Pitfall 3 (DEFIS é o caso inverso do filtro de regime usado por ECD/ECF) |
| CONT-06 | Tarefas avulsas atribuíveis aos colaboradores Contábil (reuso do mecanismo existente) | Architecture Patterns (diagrama "criarTarefa avulsa"), Security Domain V4 — `withVisibilityScope`/`withTarefaScope` já setor-aware desde a Fase 5, sem mudança necessária |
</phase_requirements>

## Summary

Esta fase estende o mesmo motor de geração já maduro (Fases 3 e 6) com um terceiro eixo de obrigações mensais — Contábil, 8 rotinas, gatilho `regimeTributario` em `{LUCRO_REAL, LUCRO_PRESUMIDO}` (nunca SIMPLES_NACIONAL) — e introduz, pela primeira vez no sistema, periodicidade **anual** (ECD, ECF, DEFIS). O eixo mensal é trivial: é uma repetição estrutural exata do padrão já usado em DP (Fase 6) — catálogo irmão flat (`geracao-tarefas-contabil.ts`), dia-base fixo + `anticiparParaDiaUtil`, leitura de responsável via `EmpresaResponsavelSetor` filtrado por `setor: "CONTABIL"`. Não há nenhum problema novo de engenharia nesse eixo.

O eixo anual é o desafio genuinamente novo da fase, e a pesquisa resolve as três questões deixadas abertas no CONTEXT.md (D-09, D-10, e a mecânica de "criar 1 mês antes"):

1. **Formato de `competencia` anual:** usar `"YYYY"` (4 dígitos, sem hífen) para tarefas anuais. Isso nunca colide com o formato mensal `"YYYY-MM"` (7 caracteres, sempre com hífen) sob a constraint `@@unique([empresaId, tipoObrigacao, competencia])`, porque a chave composta já inclui `tipoObrigacao` — e os `TipoObrigacao` anuais (`ECD`, `ECF`, `DEFIS`) são enum values **distintos** dos mensais. Mesmo que o formato de competência colidisse textualmente (não é o caso aqui), a unicidade sobreviveria. `"YYYY"` é preferível a `"YYYY-ANUAL"` por ser mais curto, mais natural para representar "ano-base" e mais fácil de testar/depurar (compatível com `parseInt`, sem necessidade de regex de validação separada se reaproveitar um schema simples).

2. **Mecânica "criar 1 mês antes do vencimento, sem rodar 12x":** a verificação **não precisa de nenhum estado adicional** — é puramente uma função de `(mês atual, ano atual)` decidindo "este é o mês de criação de DEFIS/ECD/ECF deste ano?" (DEFIS cria em fevereiro, ECD em abril, ECF em junho — sempre 1 mês antes do vencimento de março/maio/julho). Combinada com a idempotência já existente (`createMany skipDuplicates` + `@@unique`), o cron pode rodar essa checagem **todo mês, sem guarda condicional defensiva** — nos 11 meses em que a condição é falsa, a função simplesmente retorna um array vazio de tarefas anuais (não é um "skip" especial, é o caminho normal do código). O perigo real não é "rodar 12 vezes" (a constraint já impede duplicação mesmo que rodasse), é a inversão: **nunca criar** a tarefa anual por causa de um erro de off-by-one no mês — daí a recomendação de testar explicitamente as 12 iterações do ano (já anotado em `STATE.md`, Pitfall pendente do Phase 7).

3. **Onde o bloco anual vive:** dentro de `executarGeracaoMensal`, como um terceiro bloco condicional na mesma transação (mesmo padrão que a Fase 6 já usou para adicionar DP ao lado do Fiscal) — não uma função separada chamada por um cron distinto. Isso preserva o invariante "uma execução mensal, uma transação, snapshot+geração sobem ou caem juntos" já estabelecido.

**Primary recommendation:** Criar `src/lib/geracao-tarefas-contabil.ts` (catálogo mensal, 8 rotinas, flat por regime análogo ao Fiscal) e `src/lib/geracao-tarefas-contabil-anual.ts` (catálogo anual, 3 obrigações, com a função pura `obrigacoesAnuaisParaCompetencia(mesAtual, anoAtual)` que decide o que criar em cada execução), e estender `executarGeracaoMensal` com dois novos blocos (mensal Contábil + anual condicional) seguindo exatamente o Pattern 2 já documentado em `06-RESEARCH.md` (segundo loop na mesma `tx`, nunca `throw` por empresa sem responsável).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Catálogo de 8 rotinas mensais Contábil (tipo, dia-base) | Pure Calculation (`src/lib/`) | — | Mesma camada do catálogo Fiscal/DP existente — função pura, sem I/O |
| Catálogo de 3 obrigações anuais (ECD/ECF/DEFIS) + função "é mês de criação?" | Pure Calculation (`src/lib/`) | — | Decisão de "criar ou não este mês" depende só de `(mes, ano)` — não precisa de Prisma/sessão para ser calculada |
| Cálculo de prazo anual (dia útil anterior a 31/mar, 31/mai, 31/jul do ano seguinte) | Pure Calculation (`src/lib/dia-util.ts`) | — | Reusa `anticiparParaDiaUtil` sem alteração — mesma função, datas-base diferentes |
| Leitura de `EmpresaResponsavelSetor` (setor CONTABIL) para geração mensal e anual | API/Backend (`src/modules/tarefas/geracao.ts`) | Database/Storage | Mesma orquestração transacional já usada para DP — query Prisma adicional na mesma `tx` |
| Lista de empresas puladas por falta de responsável Contábil | API/Backend (retorno de `executarGeracaoMensal`) | Browser/Client (toast na UI) | Mesmo padrão D-01/D-02/D-03 já implementado para DP — cálculo no backend, exibição na UI existente |
| Tarefa avulsa de Contábil (`criarTarefa`) | API/Backend (`src/app/(app)/tarefas/actions.ts`) | — | Sem mudança — `withVisibilityScope`/`withTarefaScope` já são setor-aware (Fase 5); reuso direto |
| Persistência idempotente de tarefas mensais E anuais | Database/Storage (constraint `@@unique`) | API/Backend (`createMany skipDuplicates`) | Mesmo mecanismo — a chave composta `(empresaId, tipoObrigacao, competencia)` já garante unicidade entre mensal e anual, pois `tipoObrigacao` é sempre um enum distinto entre os dois eixos |

## Standard Stack

### Core

Nenhuma dependência nova. Esta fase reusa 100% do stack já instalado (idêntico ao confirmado em `06-RESEARCH.md`):

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `date-fns` | 4.4.0 (já instalado, [VERIFIED: npm registry] — `npm view date-fns version` confirma 4.4.0 corrente) | `addMonths`, `addYears`, `setDate`, `setMonth` — usados pelo catálogo mensal Contábil (mesmo padrão Fiscal/DP) e pelo cálculo de vencimento anual (31/mar, 31/mai, 31/jul do ano seguinte) | Já é a dependência usada pelo motor existente |
| `date-holidays` | 3.30.2 (já instalado, [VERIFIED: npm registry]) | Cálculo de feriados nacionais BR via `Holidays("BR")`, encapsulado em `dia-util.ts`, reusado sem alteração para antecipar os vencimentos anuais (31/mar, 31/mai, 31/jul) | Mesma instância singleton já usada por `anticiparParaDiaUtil`/`calcularQuintoDiaUtil` |
| `@prisma/client` / `prisma` | 6.19.3 (já instalado) | Acesso a `EmpresaResponsavelSetor` (setor CONTABIL), novos enum members de `TipoObrigacao` | Stack já fixado pelo projeto (CLAUDE.md — Prisma 6.x) |

### Supporting

Nenhuma biblioteca nova é necessária. A fase é extensão de lógica de domínio sobre infraestrutura já madura — assim como a Fase 6.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `competencia = "YYYY"` para tarefas anuais | `competencia = "YYYY-ANUAL"` (sufixo explícito, sugerido como alternativa no CONTEXT.md D-09) | Ambos resolvem a colisão igualmente bem (a unicidade real vem de `tipoObrigacao` ser um enum distinto, não do formato textual da competência). `"YYYY"` foi preferido por ser mais simples de validar (regex `^\d{4}$`, sem necessidade de checar um sufixo literal) e mais natural como representação de "ano-base" em filtros/dashboards futuros (Phase 8) que precisem agrupar por ano. `"YYYY-ANUAL"` seria preferível apenas se houvesse ambiguidade real entre os dois formatos sob a mesma `tipoObrigacao` — não é o caso. |
| Bloco anual dentro do mesmo `executarGeracaoMensal` (D-10, recomendado) | Função `executarGeracaoAnual()` separada, chamada por outro agendamento (ex.: cron mensal mas job distinto) | Rejeitado pela mesma razão que a Fase 6 manteve DP dentro da mesma transação do Fiscal: criar dois pontos de entrada (`executarGeracaoMensal` + `executarGeracaoAnual`) duplicaria a lógica de snapshot/transação e abriria uma janela onde um dispara e o outro não (ex.: alguém esquece de configurar o segundo cron). Uma função, uma transação, um ponto de entrada — consistente com o padrão já estabelecido. |
| Checagem "é mês de criação anual?" via comparação de string de competência | Guardar um histórico de "últimas obrigações anuais criadas" em tabela separada | Rejeitado — desnecessário. A idempotência já vem de graça da constraint `@@unique`; adicionar uma tabela de controle introduziria um SEGUNDO mecanismo de idempotência paralelo ao já existente, risco de drift entre os dois (mesmo anti-padrão de "duas fontes de verdade" já documentado em PITFALLS.md para outros casos deste projeto). |
| Vencimento anual calculado com `anticiparParaDiaUtil` sobre data fixa (31/mar, 31/mai, 31/jul) | Cálculo customizado de "dia útil anterior" sem reusar `dia-util.ts` | Rejeitado — `anticiparParaDiaUtil` já é genérico (recebe qualquer `Date`, não depende de mês/dia-base específico) e já testado contra feriados móveis; nenhuma razão para não reusá-lo tal como está. |

**Installation:** Nenhuma instalação necessária — todas as dependências já estão em `package.json`.

**Version verification:** `npm view date-fns version` → `4.4.0` (igual ao já fixado); `npm view date-holidays version` → `3.30.2` (igual ao já fixado). Nenhum upgrade necessário ou recomendado nesta fase.

## Package Legitimacy Audit

Não aplicável — nenhum pacote novo é instalado nesta fase. Todas as dependências usadas (`date-fns`, `date-holidays`, `@prisma/client`) já estão instaladas e em uso produtivo desde fases anteriores deste mesmo projeto (verificado novamente nesta sessão via `npm view`).

**Packages removidos por veredito [SLOP]:** nenhum.
**Packages flagged as suspeitos [SUS]:** nenhum.

## Architecture Patterns

### System Architecture Diagram

```
[node-cron boot hook / botão "Gerar tarefas" DONO]
         │
         ▼
executarGeracaoMensal(competencia)              ◄── ENTRY POINT ÚNICO (cron e manual), INALTERADO na assinatura externa
         │
         ├─► 1. Snapshot do mês ANTERIOR (DesempenhoMensal)               [INALTERADO]
         │
         ├─► 2. Loop Fiscal (regimeTributario, responsavelId legado)      [INALTERADO]
         │
         ├─► 3. Loop DP (temFuncionariosClt, setor="DP")                  [INALTERADO — Fase 6]
         │
         ├─► 4. Loop Contábil MENSAL                                     [NOVO]
         │        empresa.regimeTributario IN (LUCRO_REAL, LUCRO_PRESUMIDO)
         │        + EmpresaResponsavelSetor (setor="CONTABIL")
         │        ──► separa em:
         │              (a) COM responsável CONTABIL → gerarTarefasDoMesContabil()
         │              (b) SEM responsável CONTABIL → lista "semResponsavelContabil"
         │
         ├─► 5. Bloco Contábil ANUAL — condicional ao mês atual           [NOVO]
         │        obrigacoesAnuaisParaCompetencia(mesAtual, anoAtual)
         │        retorna [] em 9 dos 12 meses (caminho normal, NÃO um "skip" especial)
         │        quando não-vazio:
         │           DEFIS (fev) → empresas SIMPLES_NACIONAL com responsável CONTABIL
         │           ECD  (abr) → empresas LUCRO_REAL ou LUCRO_PRESUMIDO com responsável CONTABIL
         │           ECF  (jun) → empresas LUCRO_REAL ou LUCRO_PRESUMIDO com responsável CONTABIL
         │        competencia = "YYYY" (ano-base anterior ao vencimento)
         │
         ├─► 6. Merge: [...fiscal, ...dp, ...contabilMensal, ...contabilAnual]
         │
         ├─► 7. tx.tarefa.createMany({ data: merged, skipDuplicates: true })
         │        (mesma constraint @@unique([empresaId, tipoObrigacao, competencia]),
         │         agora cobrindo TipoObrigacao mensais Contábil + ECD/ECF/DEFIS)
         │
         └─► 8. Retorna { criadas, puladas, semResponsavelDp, semResponsavelContabil }
                                                     │
                                                     ▼
                                    UI (gerarTarefasDoMesAction) exibe resumo,
                                    incluindo lista de empresas sem responsável
                                    Contábil para o DONO atribuir manualmente
```

```
[criarTarefa() — tarefa avulsa de Contábil]                    ◄── SEM MUDANÇA NESTA FASE (D-12)
         │
         ▼
withVisibilityScope(user) — já retorna empresas onde user é
responsável CONTABIL (setor="CONTABIL") se user.setor === "CONTABIL" (Fase 5)
         │
         ▼
COLABORADOR de Contábil só atribui a si mesmo; DONO atribui livremente
         │
         ▼
db.tarefa.create({ ...withTarefaScope já validado nas Fases 5/6 })
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── geracao-tarefas.ts                  # INALTERADO — catálogo Fiscal
│   ├── geracao-tarefas-dp.ts                # INALTERADO — catálogo DP (Fase 6)
│   ├── geracao-tarefas-contabil.ts          # NOVO — catálogo mensal Contábil (8 rotinas, flat por regime)
│   ├── geracao-tarefas-contabil-anual.ts    # NOVO — catálogo anual (ECD/ECF/DEFIS) + obrigacoesAnuaisParaCompetencia
│   └── dia-util.ts                          # INALTERADO — anticiparParaDiaUtil reusado sem modificação
└── modules/
    └── tarefas/
        └── geracao.ts                       # MODIFICADO — quarto e quinto bloco (Contábil mensal + anual)
```

### Pattern 1: Catálogo mensal Contábil — análogo direto ao Fiscal, não ao DP

**What:** Diferente de DP (que é flat porque não varia por regime), o catálogo mensal Contábil **varia por regime** exatamente como o Fiscal (LUCRO_REAL e LUCRO_PRESUMIDO recebem as 8 rotinas; SIMPLES_NACIONAL recebe zero). Por isso, a estrutura correta é um `Record<RegimeTributario, ObrigacaoRegra[]>` análogo a `CATALOGO_OBRIGACOES` do Fiscal — não um array flat como `CATALOGO_OBRIGACOES_DP`.

**When to use:** Sempre que o eixo de variação do novo conjunto de obrigações coincidir com um eixo já modelado (aqui: regime tributário) — reusar a mesma forma de dado evita reinventar o gate no chamador.

**Example:**
```typescript
// Source: padrão direto de src/lib/geracao-tarefas.ts (CATALOGO_OBRIGACOES),
// adaptado para as 8 rotinas Contábil (D-02 do CONTEXT.md)
import { anticiparParaDiaUtil, calcularPrazoBaseDiaFixo } from "./dia-util";
import type { RegimeTributario } from "@prisma/client";

export type TipoObrigacaoContabil =
  | "EXTRATO_BANCARIO"
  | "LANCAMENTO_EXTRATOS"
  | "FOLHA_CONTABIL"
  | "FISCAL_CONTABIL"
  | "BAIXA_IMPOSTOS"
  | "PERDCOMP"
  | "FORNECEDORES_CLIENTES"
  | "BALANCO";

type ObrigacaoRegraContabil = { tipo: TipoObrigacaoContabil; diaBase: number };

// D-03: SIMPLES_NACIONAL recebe array vazio — nenhuma das 8 rotinas se aplica
export const CATALOGO_OBRIGACOES_CONTABIL: Record<RegimeTributario, ObrigacaoRegraContabil[]> = {
  LUCRO_REAL: [
    { tipo: "EXTRATO_BANCARIO", diaBase: 1 },
    { tipo: "LANCAMENTO_EXTRATOS", diaBase: 10 },
    { tipo: "FOLHA_CONTABIL", diaBase: 14 },
    { tipo: "FISCAL_CONTABIL", diaBase: 17 },
    { tipo: "BAIXA_IMPOSTOS", diaBase: 22 },
    { tipo: "PERDCOMP", diaBase: 22 },
    { tipo: "FORNECEDORES_CLIENTES", diaBase: 25 },
    { tipo: "BALANCO", diaBase: 28 },
  ],
  LUCRO_PRESUMIDO: [
    // MESMAS 8 rotinas, mesmos dias-base — D-04: grupo A/B/C ignorado nesta fase
    { tipo: "EXTRATO_BANCARIO", diaBase: 1 },
    { tipo: "LANCAMENTO_EXTRATOS", diaBase: 10 },
    { tipo: "FOLHA_CONTABIL", diaBase: 14 },
    { tipo: "FISCAL_CONTABIL", diaBase: 17 },
    { tipo: "BAIXA_IMPOSTOS", diaBase: 22 },
    { tipo: "PERDCOMP", diaBase: 22 },
    { tipo: "FORNECEDORES_CLIENTES", diaBase: 25 },
    { tipo: "BALANCO", diaBase: 28 },
  ],
  SIMPLES_NACIONAL: [], // D-03: nenhuma rotina Contábil mensal
};
```

**Nota de implementação:** considerar extrair as 8 entradas para uma constante `ROTINAS_CONTABIL_MENSAL` compartilhada entre `LUCRO_REAL` e `LUCRO_PRESUMIDO` (já que são idênticas por D-04), evitando duplicação textual — ex.: `LUCRO_REAL: ROTINAS_CONTABIL_MENSAL, LUCRO_PRESUMIDO: ROTINAS_CONTABIL_MENSAL`. Isso é puramente estético/DRY, não muda o comportamento.

### Pattern 2: Catálogo anual — periodicidade nova, modelado como "que obrigações criar nesta competência mensal de execução"

**What:** O catálogo anual não é "gerado uma vez por ano para todas as empresas elegíveis de uma vez em janeiro" (D-08 explicitamente rejeita isso) — é uma função pura que, dado o mês/ano da execução mensal atual, decide **se** alguma obrigação anual deve ser criada nesta execução, e para quais regimes. A função central é `obrigacoesAnuaisParaCompetencia`.

**When to use:** Sempre que uma nova periodicidade precisar se integrar a um motor que só conhece "competência mensal" sem introduzir um segundo agendador.

**Example:**
```typescript
// Source: novo, derivado da regra D-07/D-08 do CONTEXT.md — vencimentos fixos
// (31/mar, 31/mai, 31/jul do ano seguinte ao ano-base), criados 1 mês antes
import { anticiparParaDiaUtil } from "./dia-util";
import type { RegimeTributario } from "@prisma/client";

export type TipoObrigacaoAnual = "DEFIS" | "ECD" | "ECF";

type ObrigacaoAnualRegra = {
  tipo: TipoObrigacaoAnual;
  mesCriacao: number; // mês (1-12) em que a tarefa é criada (1 mês antes do vencimento)
  mesVencimento: number; // mês (1-12) do vencimento, no ano SEGUINTE ao ano-base
  diaVencimento: number; // dia do mês de vencimento
  regimesElegiveis: RegimeTributario[];
};

// D-06/D-07: mapeamento regime -> obrigação + vencimento
export const CATALOGO_OBRIGACOES_ANUAIS: ObrigacaoAnualRegra[] = [
  {
    tipo: "DEFIS",
    mesCriacao: 2, // fevereiro
    mesVencimento: 3, // 31/marco
    diaVencimento: 31,
    regimesElegiveis: ["SIMPLES_NACIONAL"],
  },
  {
    tipo: "ECD",
    mesCriacao: 4, // abril
    mesVencimento: 5, // 31/maio
    diaVencimento: 31,
    regimesElegiveis: ["LUCRO_REAL", "LUCRO_PRESUMIDO"],
  },
  {
    tipo: "ECF",
    mesCriacao: 6, // junho
    mesVencimento: 7, // 31/julho
    diaVencimento: 31,
    regimesElegiveis: ["LUCRO_REAL", "LUCRO_PRESUMIDO"],
  },
];

/**
 * Dado o mes/ano da execucao mensal ATUAL (nao a competencia apurada — aqui
 * usamos o mes EM QUE o cron roda, que e o mes de CRIACAO da obrigacao
 * anual, nao o mes de apuracao), retorna as regras anuais que devem ser
 * criadas nesta execucao. Retorna [] em 9 dos 12 meses — caminho normal,
 * NAO um caso de erro.
 */
export function obrigacoesAnuaisParaCompetencia(
  mesAtual: number,
  anoAtual: number
): { regra: ObrigacaoAnualRegra; competenciaAnual: string; anoVencimento: number }[] {
  return CATALOGO_OBRIGACOES_ANUAIS
    .filter((regra) => regra.mesCriacao === mesAtual)
    .map((regra) => ({
      regra,
      competenciaAnual: String(anoAtual), // ano-base = ano da execucao (D-09: formato "YYYY")
      anoVencimento: anoAtual + 1, // vencimento e sempre no ano SEGUINTE ao ano-base
    }));
}

export function calcularPrazoAnual(anoVencimento: number, mesVencimento: number, diaVencimento: number): Date {
  const dataBase = new Date(anoVencimento, mesVencimento - 1, diaVencimento);
  return anticiparParaDiaUtil(dataBase); // D-07: antecipa se cair em fim de semana/feriado
}
```

**Nota crítica de implementação:** `mesAtual`/`anoAtual` aqui devem vir da **competência recebida pela própria `executarGeracaoMensal`** (parseada de `"YYYY-MM"`), nunca de `new Date()`/`Date.now()` diretamente — isso preserva o mesmo invariante de testabilidade que todo o resto do motor já tem (toda a lógica de data é determinística a partir do argumento `competencia`, nunca lê o relógio do sistema dentro da função pura). Isso também é o que permite o teste de "rodar as 12 competências de um ano e verificar exatamente 1 criação de cada obrigação anual" mencionado no Pitfall pendente do STATE.md.

### Pattern 3: Terceiro e quarto bloco dentro da mesma transação, mesmo padrão da Fase 6

**What:** `executarGeracaoMensal` ganha um bloco de leitura Contábil mensal (empresas Lucro Real/Presumido + responsável setor CONTABIL) e um bloco anual condicional, ambos **dentro da mesma `db.$transaction`** já existente — exatamente o Pattern 2 documentado em `06-RESEARCH.md` para DP, agora repetido para o terceiro e quarto eixo.

**Example:**
```typescript
// Source: extensão direta de src/modules/tarefas/geracao.ts, seguindo
// literalmente o mesmo molde do bloco DP já implementado na Fase 6
export async function executarGeracaoMensal(competencia: string): Promise<{
  criadas: number;
  puladas: number;
  semResponsavelDp: { empresaId: string; nome: string }[];
  semResponsavelContabil: { empresaId: string; nome: string }[];
}> {
  return db.$transaction(async (tx) => {
    // ... snapshot do mes anterior, loop Fiscal, loop DP — INALTERADOS ...

    // Bloco Contábil MENSAL (NOVO) — mesmo molde do bloco DP (Fase 6),
    // mas filtrando por regimeTributario (Fiscal-like), nao temFuncionariosClt
    const empresasContabil = await tx.empresa.findMany({
      where: {
        ativo: true,
        regimeTributario: { in: ["LUCRO_REAL", "LUCRO_PRESUMIDO"] }, // D-03
      },
      select: {
        id: true,
        nome: true,
        regimeTributario: true,
        responsaveisPorSetor: {
          where: { setor: "CONTABIL" }, // CRITICO — mesmo Pitfall 2 da Fase 6
          select: { usuarioId: true },
        },
      },
    });

    const comResponsavelContabil = empresasContabil.filter(
      (e) => e.responsaveisPorSetor.length > 0
    );
    const semResponsavelContabil = empresasContabil
      .filter((e) => e.responsaveisPorSetor.length === 0)
      .map((e) => ({ empresaId: e.id, nome: e.nome })); // D-11: pular e listar, nunca throw

    const tarefasContabilMensal = gerarTarefasDoMesContabil(
      comResponsavelContabil.map((e) => ({
        id: e.id,
        regimeTributario: e.regimeTributario,
        responsavelId: e.responsaveisPorSetor[0].usuarioId,
      })),
      competencia
    );

    // Bloco Contábil ANUAL (NOVO) — condicional ao mes atual, mas roda TODO mes
    // (a condicional vive DENTRO de obrigacoesAnuaisParaCompetencia, nao aqui)
    const [anoAtual, mesAtual] = competencia.split("-").map(Number);
    const regrasAnuais = obrigacoesAnuaisParaCompetencia(mesAtual, anoAtual);

    let tarefasContabilAnual: TarefaParaCriar[] = [];
    if (regrasAnuais.length > 0) {
      // Para cada regra anual disparada neste mes, busca empresas elegiveis
      // pelo(s) regime(s) daquela obrigacao especifica + responsavel CONTABIL
      for (const { regra, competenciaAnual, anoVencimento } of regrasAnuais) {
        const empresasElegiveis = await tx.empresa.findMany({
          where: {
            ativo: true,
            regimeTributario: { in: regra.regimesElegiveis },
          },
          select: {
            id: true,
            nome: true,
            responsaveisPorSetor: {
              where: { setor: "CONTABIL" },
              select: { usuarioId: true },
            },
          },
        });
        // mesmo padrao: pular + listar quem nao tem responsavel CONTABIL
        // (reaproveita a MESMA lista semResponsavelContabil — empresa que
        // ja apareceu la nao precisa ser duplicada, ver Pitfall 4 abaixo)
        const comResponsavel = empresasElegiveis.filter(
          (e) => e.responsaveisPorSetor.length > 0
        );
        tarefasContabilAnual = tarefasContabilAnual.concat(
          comResponsavel.map((e) => ({
            empresaId: e.id,
            responsavelId: e.responsaveisPorSetor[0].usuarioId,
            titulo: `${TITULO_OBRIGACAO_ANUAL[regra.tipo]} — ${competenciaAnual}`,
            tipoObrigacao: regra.tipo,
            competencia: competenciaAnual, // "YYYY" — D-09
            prazo: calcularPrazoAnual(anoVencimento, regra.mesVencimento, regra.diaVencimento),
          }))
        );
      }
    }

    const tarefas = [
      ...tarefasFiscal,
      ...tarefasDp,
      ...tarefasContabilMensal,
      ...tarefasContabilAnual,
    ];

    // ... createMany skipDuplicates, retorno estendido — INALTERADO em forma ...
  });
}
```

### Anti-Patterns to Avoid

- **Criar TODAS as obrigações anuais de uma vez em janeiro, com data de vencimento futura:** D-08 rejeita explicitamente esse design — a tarefa só deve existir no banco a partir do mês de criação (1 mês antes do vencimento), não meses antes "esperando" o prazo chegar. Isso também evita poluir a lista de tarefas pendentes do colaborador com itens de vencimento distante.
- **Usar `competencia = "YYYY-MM"` (formato mensal) para tarefas anuais, com mês fixo (ex.: "2026-01" representando o ano inteiro):** quebraria a intenção de "ano-base" e tornaria ambíguo se "2026-01" é Janeiro/2026 (mensal) ou 2026 (anual) só pelo olhar a string — mesmo que `tipoObrigacao` já desambigue para a constraint do banco, um humano lendo um dump de dados ou um dashboard futuro (Phase 8) teria dificuldade de distinguir. `"YYYY"` é inequivocamente diferente em formato.
- **Aplicar `anticiparParaDiaUtil` chamando `new Date()`/`Date.now()` em vez de derivar de `competencia`:** quebraria a determinística/testabilidade pura da função — mesmo princípio já estabelecido para `calcularQuintoDiaUtil` (Fase 6).
- **Bloquear a transação inteira (ou mesmo só o bloco Contábil) por causa de UMA empresa sem responsável Contábil:** D-11 exige "pular e listar" por empresa, nunca abortar — mesmo padrão D-01/D-02/D-03 da Fase 6, agora replicado para Contábil mensal E anual.
- **Tratar o bloco anual como "vai rodar 12 vezes e preciso de um guard manual para não duplicar":** a constraint `@@unique` já garante isso — não introduzir um segundo mecanismo de controle (flag em tabela, cache em memória, etc.) só porque a intuição diz "evitar rodar 12x". O código deve rodar a checagem TODAS as 12 vezes, sem medo, porque ela retorna `[]` em 9 delas e a constraint cobre o resto.
- **Duplicar a lista de "sem responsável Contábil" entre o bloco mensal e cada obrigação anual disparada no mesmo mês:** se uma empresa aparece sem responsável Contábil tanto no bloco mensal quanto em uma obrigação anual que dispara naquele mês, considerar deduplicar por `empresaId` antes de retornar `semResponsavelContabil` (ver Pitfall 4 abaixo) — listar a mesma empresa duas vezes no relatório ao DONO é redundante e pode confundir a ação corretiva esperada (são a mesma causa raiz: falta 1 atribuição de responsável).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Antecipação de vencimento anual para dia útil anterior (31/mar, 31/mai, 31/jul) | Lógica customizada de "se cair em fim de semana, recuar N dias" | `anticiparParaDiaUtil` (já existe, já testado contra feriados móveis e fixos) | Reusar a mesma função pura já validada para o eixo mensal — vencimentos anuais não têm nenhuma regra de antecipação diferente das mensais (mesma regra D-05/D-06/D-07: nunca posterga, sempre antecipa) |
| Verificação de "este é o mês de criar a obrigação anual X?" | Cron secundário, flag em tabela de controle, ou comparação de data "ao vivo" via `new Date()` dentro da função pura | Função pura `obrigacoesAnuaisParaCompetencia(mesAtual, anoAtual)`, derivada exclusivamente do argumento `competencia` já recebido por `executarGeracaoMensal` | Mantém o motor 100% determinístico e testável sem mocks de relógio — mesmo princípio que já rege todo o resto do código de geração deste projeto |
| Idempotência entre execuções anuais sucessivas (rodar 12 vezes ao ano sem duplicar) | Tabela de controle "já criei a obrigação anual deste ano?" | A mesma constraint `@@unique([empresaId, tipoObrigacao, competencia])` + `createMany skipDuplicates` já em uso para Fiscal e DP — basta que `tipoObrigacao` (ECD/ECF/DEFIS) e `competencia` ("YYYY") sejam consistentes entre execuções do mesmo ano | Introduzir uma segunda fonte de verdade para idempotência é o anti-padrão mais arriscado desta fase — a constraint do banco já é suficiente e já está em produção, comprovada para os outros dois eixos |

**Key insight:** A periodicidade anual não exige nenhuma infraestrutura nova de agendamento — é inteiramente resolvida como uma função pura adicional que se encaixa na mesma cadência mensal já existente. O "novo problema" desta fase (anual coexistindo com mensal) tem uma resposta simples porque a chave de idempotência (`tipoObrigacao` + `competencia`) já é suficientemente expressiva para distinguir os dois eixos sem nenhuma mudança de schema.

## Common Pitfalls

### Pitfall 1: Confundir "mês de criação" com "mês de vencimento" ao montar a regra anual

**What goes wrong:** Implementar `obrigacoesAnuaisParaCompetencia` comparando `mesAtual` contra o mês de **vencimento** (3 para DEFIS, 5 para ECD, 7 para ECF) em vez do mês de **criação** (D-08: 1 mês antes — fevereiro, abril, junho respectivamente). Isso criaria a tarefa no mesmo mês em que ela vence, ao invés de com antecedência, violando D-08 diretamente.

**Why it happens:** É fácil copiar mentalmente "DEFIS vence em março" e usar `mesCriacao: 3` por instinto, esquecendo que a regra de negócio explícita é "criada 1 mês ANTES".

**How to avoid:** Nomear o campo explicitamente `mesCriacao` (não `mes` genérico) no tipo, e escrever um teste que verifica a data de **criação esperada** (fevereiro) separadamente da data de **vencimento esperada** (31/março), nunca assumindo que são o mesmo mês.

**Warning signs:** Uma tarefa DEFIS aparece como pendente já vencendo no mesmo mês em que foi criada, sem nenhum tempo de antecedência para a equipe agir.

### Pitfall 2: Esquecer que o vencimento anual cai no ano SEGUINTE ao ano-base da competência

**What goes wrong:** Calcular o vencimento anual usando `anoAtual` (o ano em que a tarefa é criada) em vez de `anoAtual + 1` — produzindo, por exemplo, um vencimento de ECD em 31/05/2026 quando a competência sendo processada é "2026" e a regra real é "ECD do ano-base 2026 vence em 31/05/2027".

**Why it happens:** O padrão mensal existente (Fiscal/DP) sempre vence no mês seguinte **dentro do mesmo ano ou rolando 1 mês** — nunca atravessa uma virada de ano inteiro de defasagem entre apuração e vencimento. A intuição de "+1 mês" não se generaliza automaticamente para "+1 ano" sem atenção deliberada.

**How to avoid:** Testar explicitamente que, para competência anual `"2026"`, o vencimento de ECD cai em 2027 (não 2026) — análogo ao teste já existente em `dia-util.test.ts` que verifica a competência "2026-12" produzindo vencimento em janeiro/2027 (virada de ano mensal). Nomear a variável `anoVencimento` (não reusar `anoAtual`) para deixar o offset visualmente explícito no código.

**Warning signs:** O vencimento de uma obrigação anual aparece no mesmo ano da criação, ou a tarefa parece "já vencida" no momento em que é criada.

### Pitfall 3: Aplicar o catálogo anual a TODOS os regimes em vez de filtrar por `regimesElegiveis`

**What goes wrong:** Implementar o bloco anual lendo a mesma query de empresas usada para o bloco mensal Contábil (`regimeTributario IN (LUCRO_REAL, LUCRO_PRESUMIDO)`) para TODAS as 3 obrigações anuais, esquecendo que DEFIS é exclusiva de SIMPLES_NACIONAL (D-06) — o oposto do filtro usado para ECD/ECF.

**Why it happens:** O bloco mensal Contábil e o bloco anual estão fisicamente próximos no código e compartilham a mesma "vibe" de filtro por regime — é fácil copiar o filtro do bloco mensal (`LUCRO_REAL`/`LUCRO_PRESUMIDO`) para o anual sem notar que DEFIS inverte completamente o critério.

**How to avoid:** A estrutura de dados `ObrigacaoAnualRegra.regimesElegiveis` (Pattern 2 acima) já carrega o filtro correto por obrigação — a query de empresas elegíveis para cada obrigação anual DEVE ler `regra.regimesElegiveis` dinamicamente, nunca um filtro hardcoded compartilhado entre as 3 obrigações. Testar explicitamente: gerar a competência de fevereiro (DEFIS) com uma empresa LUCRO_REAL e uma SIMPLES_NACIONAL na base, e verificar que só a SIMPLES_NACIONAL recebe a tarefa DEFIS.

**Warning signs:** Uma empresa Lucro Real recebe uma tarefa DEFIS, ou uma empresa Simples Nacional recebe ECD/ECF.

### Pitfall 4: Listar a mesma empresa duas vezes em `semResponsavelContabil` quando ela é pulada tanto no bloco mensal quanto no anual do mesmo mês

**What goes wrong:** Concatenar ingenuamente a lista de "sem responsável" do bloco mensal com a lista de "sem responsável" de cada obrigação anual disparada naquele mês, sem deduplicar por `empresaId` — uma empresa Lucro Real sem responsável Contábil, numa execução de abril (mês de criação do ECD), apareceria 2x no relatório (uma vez pelo bloco mensal, outra pelo bloco anual ECD), mesmo sendo a mesma causa raiz (falta 1 atribuição).

**Why it happens:** Os blocos mensal e anual são implementados como queries independentes (Pattern 3) — é natural que cada um produza sua própria sublista sem noção do que o outro bloco já reportou.

**How to avoid:** Deduplicar por `empresaId` (ex.: `Map` ou `Set`) antes de retornar `semResponsavelContabil` no resultado final de `executarGeracaoMensal`, unindo as ocorrências do bloco mensal e de todas as obrigações anuais disparadas naquele mês. Testar explicitamente o caso "mês de abril, empresa Lucro Real sem responsável Contábil" e verificar que ela aparece **uma única vez** na lista final.

**Warning signs:** O DONO vê a mesma empresa repetida no relatório de "empresas sem responsável" após rodar a geração em um mês de virada anual (fevereiro, abril ou junho).

### Pitfall 5: Esquecer de propagar o novo campo `semResponsavelContabil` por toda a cadeia de retorno (mesmo Pitfall 4 do 06-RESEARCH.md, agora para um terceiro campo)

**What goes wrong:** Adicionar `semResponsavelContabil` ao retorno de `executarGeracaoMensal` sem propagar a mudança de tipo para `AcaoGeracaoResult` (`src/app/(app)/tarefas/actions.ts`) — o mesmo erro já documentado e evitado para `semResponsavelDp` na Fase 6, mas que pode se repetir se o terceiro campo for adicionado apressadamente "por analogia" sem seguir a checklist completa.

**Why it happens:** `executarGeracaoMensal` e `AcaoGeracaoResult` continuam definidos em arquivos diferentes; o TypeScript não força erro de compilação se o campo novo for descartado silenciosamente (campo extra, não campo faltante).

**How to avoid:** Grep explícito por todos os usos de `executarGeracaoMensal(` (hoje: `gerarTarefasDoMesAction`, `tests/geracao.idempotencia.test.ts`, `tests/geracao.actions.test.ts`) e confirmar que `semResponsavelContabil` chega ponta a ponta até a UI, replicando exatamente o que já foi feito para `semResponsavelDp`.

**Warning signs:** O dono reclama que não vê informação sobre empresas sem responsável Contábil após gerar tarefas, mesmo sabendo que existem empresas nessa situação (cenário certo, já que hoje nenhuma empresa tem responsável Contábil atribuído — placeholders `Contabil1-3` sem vínculo, mesma situação herdada da Fase 5/6 para DP).

## Code Examples

### Função pura: catálogo anual completo + cálculo de prazo (validado nesta pesquisa)

```typescript
// Source: novo nesta fase, seguindo o molde de geracao-tarefas-dp.ts
// (Fase 6) — combinação de Pattern 1 e Pattern 2 acima
import { anticiparParaDiaUtil } from "./dia-util";
import { competenciaAnualSchema } from "./competencia"; // NOVO — ver nota abaixo
import type { RegimeTributario } from "@prisma/client";

export type TipoObrigacaoAnual = "DEFIS" | "ECD" | "ECF";

export const TITULO_OBRIGACAO_ANUAL: Record<TipoObrigacaoAnual, string> = {
  DEFIS: "DEFIS",
  ECD: "ECD (Escrituração Contábil Digital)",
  ECF: "ECF (Escrituração Contábil Fiscal)",
};

type ObrigacaoAnualRegra = {
  tipo: TipoObrigacaoAnual;
  mesCriacao: number;
  mesVencimento: number;
  diaVencimento: number;
  regimesElegiveis: RegimeTributario[];
};

export const CATALOGO_OBRIGACOES_ANUAIS: ObrigacaoAnualRegra[] = [
  { tipo: "DEFIS", mesCriacao: 2, mesVencimento: 3, diaVencimento: 31, regimesElegiveis: ["SIMPLES_NACIONAL"] },
  { tipo: "ECD", mesCriacao: 4, mesVencimento: 5, diaVencimento: 31, regimesElegiveis: ["LUCRO_REAL", "LUCRO_PRESUMIDO"] },
  { tipo: "ECF", mesCriacao: 6, mesVencimento: 7, diaVencimento: 31, regimesElegiveis: ["LUCRO_REAL", "LUCRO_PRESUMIDO"] },
];

export function obrigacoesAnuaisParaCompetencia(competencia: string) {
  const [anoAtual, mesAtual] = competencia.split("-").map(Number);
  return CATALOGO_OBRIGACOES_ANUAIS
    .filter((regra) => regra.mesCriacao === mesAtual)
    .map((regra) => ({
      regra,
      competenciaAnual: String(anoAtual), // D-09: formato "YYYY"
      anoVencimento: anoAtual + 1, // Pitfall 2 — SEMPRE ano seguinte
    }));
}

export function calcularPrazoAnual(
  anoVencimento: number,
  mesVencimento: number,
  diaVencimento: number
): Date {
  const dataBase = new Date(anoVencimento, mesVencimento - 1, diaVencimento);
  return anticiparParaDiaUtil(dataBase);
}
```

**Verificação executável feita nesta pesquisa** (Node + date-holidays 3.30.2 instalado neste projeto, mesma instância usada pelo resto do código):
- DEFIS, vencimento-base 31/03/2027 (ano-base 2026): 31/03/2027 é quarta-feira, sem feriado nacional — `anticiparParaDiaUtil` retorna a própria data, sem ajuste. [VERIFIED: execução local contra date-holidays instalado]
- ECD, vencimento-base 31/05/2027: 31/05/2027 é segunda-feira, sem feriado — sem ajuste. [VERIFIED: execução local]
- ECF, vencimento-base 31/07/2027: 31/07/2027 é sábado — `anticiparParaDiaUtil` antecipa para sexta-feira 30/07/2027. [VERIFIED: execução local — confirma que a regra de antecipação de fim de semana também se aplica corretamente ao eixo anual, sem nenhuma adaptação na função reusada]

### Extensão recomendada de `competencia.ts` para validar o formato anual

```typescript
// Source: extensão direta de src/lib/competencia.ts, seguindo o mesmo
// padrão de regex estrito já usado por competenciaSchema (mensal)
export const competenciaAnualSchema = z
  .string()
  .regex(/^\d{4}$/, "Competência anual deve estar no formato YYYY");
```

**Nota de implementação:** `gerarTarefasDoMesContabilAnual` (ou função equivalente) deveria validar a competência anual recebida com este schema antes de produzir a tarefa, espelhando exatamente o padrão já estabelecido por `gerarTarefasDoMesDp` (que valida com `competenciaSchema.safeParse` e lança `Error` se inválido) — ver `src/lib/geracao-tarefas-dp.ts` linhas 64-78.

### Padrão de teste para os 12 meses do ano (cobre o Pitfall pendente do STATE.md)

```typescript
// Source: padrão de varredura já usado em tests/dia-util.test.ts
// ("varrendo competencias de pelo menos 2 anos") aplicado ao novo eixo anual
import { describe, it, expect } from "vitest";
import { obrigacoesAnuaisParaCompetencia } from "@/lib/geracao-tarefas-contabil-anual";

describe("obrigacoesAnuaisParaCompetencia — exatamente 1 disparo por obrigação por ano", () => {
  it("rodando as 12 competências de 2026, cada obrigação anual dispara exatamente 1 vez", () => {
    const disparos: Record<string, number> = { DEFIS: 0, ECD: 0, ECF: 0 };

    for (let mes = 1; mes <= 12; mes++) {
      const competencia = `2026-${String(mes).padStart(2, "0")}`;
      const regras = obrigacoesAnuaisParaCompetencia(competencia);
      for (const { regra } of regras) {
        disparos[regra.tipo]++;
      }
    }

    expect(disparos).toEqual({ DEFIS: 1, ECD: 1, ECF: 1 });
  });

  it("disparo de DEFIS ocorre em fevereiro, ECD em abril, ECF em junho — nunca em outro mês", () => {
    for (let mes = 1; mes <= 12; mes++) {
      const competencia = `2026-${String(mes).padStart(2, "0")}`;
      const regras = obrigacoesAnuaisParaCompetencia(competencia).map((r) => r.regra.tipo);

      if (mes === 2) expect(regras).toContain("DEFIS");
      else expect(regras).not.toContain("DEFIS");

      if (mes === 4) expect(regras).toContain("ECD");
      else expect(regras).not.toContain("ECD");

      if (mes === 6) expect(regras).toContain("ECF");
      else expect(regras).not.toContain("ECF");
    }
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Motor de geração só conhece periodicidade mensal (`competencia` sempre "YYYY-MM") | Motor de geração ganha um segundo formato de competência ("YYYY") para periodicidade anual, distinguido por `tipoObrigacao` enum distinto, sem necessidade de mudança de schema (campo `competencia` já é `String?` livre) | Esta fase (Phase 7) | `Tarefa.competencia` passa a armazenar dois formatos textuais distintos coexistindo na mesma coluna — qualquer código futuro que faça parsing de `competencia` assumindo sempre "YYYY-MM" (ex.: dashboards Fase 8) precisa primeiro checar `tipoObrigacao` para saber qual formato esperar |
| `TipoObrigacao` enum só tinha valores Fiscais e DP | `TipoObrigacao` ganha as 8 rotinas mensais Contábil + 3 anuais (ECD, ECF, DEFIS) — 11 novos enum values | Esta fase | Migração de schema aditiva (`npx prisma db push`), sem impacto em dados existentes — mesma constraint `@@unique` cobre os novos valores automaticamente |
| `executarGeracaoMensal` tinha 2 eixos (Fiscal + DP), ambos mensais | Ganha um 3º eixo mensal (Contábil) e um 4º eixo, estruturalmente diferente (anual, condicional ao mês) | Esta fase | Primeira vez que o motor precisa de lógica condicional ao mês de execução — todo o resto do motor sempre executa incondicionalmente a cada chamada |

**Deprecated/outdated:** Nenhum. Esta fase é puramente aditiva sobre uma arquitetura já estabelecida (Fases 3, 5, 6).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Formato de `competencia` anual = `"YYYY"` (sem sufixo) — D-09 do CONTEXT.md deixou essa escolha explicitamente a critério desta pesquisa/planner. Esta pesquisa recomenda `"YYYY"` em vez da alternativa sugerida `"YYYY-ANUAL"`. | Modelagem técnica da periodicidade anual, Pattern 2, Code Examples | Baixo-médio — é uma decisão de discrição explícita do CONTEXT.md, não uma suposição não confirmada sobre requisito de negócio; mas é uma decisão de schema/dado que, uma vez tarefas anuais começarem a ser criadas em produção, fica cara de reverter sem migração de dados. O planner deve confirmar esta escolha explicitamente antes da execução (não é uma decisão "livre" — afeta dashboards futuros da Phase 8 que vão precisar parsear competência por tipo). |
| A2 | Nomenclatura dos `TipoObrigacao` mensais Contábil (`EXTRATO_BANCARIO`, `LANCAMENTO_EXTRATOS`, `FOLHA_CONTABIL`, `FISCAL_CONTABIL`, `BAIXA_IMPOSTOS`, `PERDCOMP`, `FORNECEDORES_CLIENTES`, `BALANCO`) — D-05 do CONTEXT.md deixa isso a critério do planner/executor, com sugestão entre parênteses que esta pesquisa adota tal como sugerida. | Pattern 1, Standard Stack | Nenhum — é decisão de discrição explícita já sugerida no CONTEXT.md, esta pesquisa apenas adota a sugestão literal |
| A3 | "Empresa sem responsável Contábil" aparecendo simultaneamente no bloco mensal e em um bloco anual do mesmo mês deve ser deduplicada por `empresaId` antes do retorno final (Pitfall 4) — não há decisão explícita do usuário sobre este caso específico no CONTEXT.md. | Pitfall 4 | Baixo — é uma recomendação de qualidade de relatório (UX para o DONO), não uma regra de negócio que afete a geração de tarefas em si; se não implementada, o pior caso é um relatório com entradas duplicadas, não uma tarefa duplicada ou perdida |
| A4 | Vencimentos anuais (31/mar, 31/mai, 31/jul) usam o ano corrente do calendário gregoriano sem nenhuma regra de exceção/prorrogação legal (ex.: prorrogações pontuais da Receita Federal em anos específicos) — confirmado pelo usuário no CONTEXT.md `<specifics>` como "datas-padrão da legislação, suficiente, sem datas específicas diferentes" | D-07 do CONTEXT.md, Pattern 2 | Nenhum — decisão de usuário já confirmada explicitamente, não suposição desta pesquisa |

**Risco geral:** a única claim desta pesquisa que ainda carece de confirmação explícita do usuário/planner é A1 (formato `"YYYY"` vs `"YYYY-ANUAL"`) — todas as outras claims técnicas centrais (estrutura de catálogo, idempotência, cálculo de prazo, filtro por regime) foram verificadas por leitura direta de código existente ou execução local, replicando o padrão de confiabilidade já estabelecido em `06-RESEARCH.md`.

## Open Questions

1. **O formato `"YYYY"` para competência anual pode colidir visualmente/cognitivamente com alguma feature futura de filtro por ano nos dashboards (Phase 8)?**
   - What we know: a constraint `@@unique` já garante correção técnica independente do formato escolhido (D-09 confirma isso). Dashboards futuros (DASH/CONT-07/08/09) provavelmente vão querer agrupar tarefas por ano de competência em algum momento.
   - What's unclear: se um dashboard que filtra "tarefas de 2026" deveria incluir tanto as mensais ("2026-01".."2026-12") quanto a anual ("2026") sob o mesmo filtro de UI, ou se são conceitualmente períodos diferentes (ano-base da apuração anual vs. ano-calendário das tarefas mensais).
   - Recommendation: não bloquear esta fase por isso — é uma decisão de UI da Phase 8, não desta fase. Documentar a escolha de formato claramente no código (comentário no enum/schema) para que o planner da Phase 8 saiba que precisa tratar os dois formatos distintamente ao construir queries de dashboard.

2. **Empresas sem responsável Contábil hoje (100% delas, mesma situação herdada de DP) — o relatório de "puladas" precisa de alguma ação diferenciada para obrigações anuais vs. mensais?**
   - What we know: D-11 já estabelece "pular e listar" por empresa, sem distinção entre mensal e anual. A pesquisa recomenda (Pitfall 4) deduplicar a lista por empresa, não por tipo de obrigação.
   - What's unclear: se o DONO, ao ver "Empresa X sem responsável Contábil" em fevereiro (mês de criação do DEFIS), precisa de algum contexto adicional indicando "esta empresa também perderia a obrigação anual DEFIS este ano" — ou se a mensagem genérica já é suficiente porque resolver o responsável resolve ambos os eixos retroativamente na próxima execução (mensal ou manual).
   - Recommendation: manter a mensagem genérica (mesmo padrão já usado para DP) — o planner pode considerar adicionar uma nota textual diferenciando "esta competência também inclui uma obrigação anual" apenas se o esforço for trivial, mas não é um requisito bloqueante.

## Environment Availability

Não aplicável — esta fase não introduz nenhuma dependência de ambiente nova (sem serviços externos, sem CLIs novas, sem bancos adicionais). Toda a infraestrutura (Postgres/Neon, Node 20+, Prisma, date-fns, date-holidays) já está em uso e funcionando desde fases anteriores.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (já configurado) |
| Config file | nenhum arquivo `vitest.config.*` dedicado — usa defaults do Vitest, mesma configuração já válida para as fases anteriores |
| Quick run command | `npx vitest run tests/geracao-tarefas-contabil.test.ts tests/geracao-tarefas-contabil-anual.test.ts tests/dia-util.test.ts` (arquivos novos/relevantes desta fase) |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| CONT-01 | Geração mensal das 8 rotinas Contábil para Lucro Real/Presumido, vencimento por dia-base + antecipação | unit | `npx vitest run tests/geracao-tarefas-contabil.test.ts` | ❌ Wave 0 — novo arquivo, mirror de `tests/geracao-tarefas-dp.test.ts` |
| CONT-02 | Motor de geração suporta periodicidade ANUAL coexistindo com mensal, sem colisão de competência | unit/integration | `npx vitest run tests/geracao-tarefas-contabil-anual.test.ts` e `tests/geracao.idempotencia.test.ts` (estender) | ❌ Wave 0 — novo arquivo + extensão do existente |
| CONT-03 | Geração anual de ECD para Lucro Real (e Presumido, por D-06) | unit | `npx vitest run tests/geracao-tarefas-contabil-anual.test.ts` | ❌ Wave 0 — mesmo arquivo acima |
| CONT-04 | Geração anual de ECF | unit | `npx vitest run tests/geracao-tarefas-contabil-anual.test.ts` | ❌ Wave 0 — mesmo arquivo acima |
| CONT-05 | Geração anual de DEFIS para Simples Nacional | unit | `npx vitest run tests/geracao-tarefas-contabil-anual.test.ts` | ❌ Wave 0 — mesmo arquivo acima |
| CONT-06 | Tarefa avulsa atribuível a colaboradores Contábil (reuso de `criarTarefa`) | integration/regression | `npx vitest run tests/tarefas.idor.test.ts tests/tarefas.crud.test.ts` | ✅ já existe — confirmar/estender com 1 fixture CONTABIL análogo ao já feito para DP em `tests/tarefas.dp.test.ts` (considerar `tests/tarefas.contabil.test.ts` se o padrão de arquivo dedicado por setor for mantido) |
| (implícito D-11) | Empresa sem responsável Contábil é pulada (mensal e anual) e listada no retorno, sem bloquear demais eixos | unit/integration | `npx vitest run tests/geracao.idempotencia.test.ts` (estender) | ❌ Wave 0 — estender o arquivo existente, seguindo exatamente o padrão já usado para `semResponsavelDp` |
| (implícito, idempotência anual) | Rodar as 12 competências de um ano gera exatamente 1 tarefa de cada obrigação anual por empresa elegível, sem duplicação em reexecução do mesmo mês | unit/integration | `npx vitest run tests/geracao-tarefas-contabil-anual.test.ts tests/geracao.idempotencia.test.ts` | ❌ Wave 0 — ver Code Examples acima para o padrão de varredura de 12 meses |
| (implícito, Pitfall 2) | Vencimento anual cai no ano SEGUINTE ao ano-base da competência | unit | `npx vitest run tests/geracao-tarefas-contabil-anual.test.ts` | ❌ Wave 0 — mesmo arquivo acima |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/geracao-tarefas-contabil.test.ts tests/geracao-tarefas-contabil-anual.test.ts tests/geracao.idempotencia.test.ts`
- **Per wave merge:** `npm test` (suite completa — crítico para confirmar que as suítes Fiscal/DP/IDOR existentes não regridem)
- **Phase gate:** suite completa verde antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/geracao-tarefas-contabil.test.ts` — novo arquivo, cobre o catálogo mensal Contábil puro (mirror de `tests/geracao-tarefas.test.ts` e `tests/geracao-tarefas-dp.test.ts`)
- [ ] `tests/geracao-tarefas-contabil-anual.test.ts` — novo arquivo, cobre `obrigacoesAnuaisParaCompetencia` e `calcularPrazoAnual`, incluindo a varredura das 12 competências de pelo menos 1 ano completo (ver Code Examples)
- [ ] `tests/geracao.idempotencia.test.ts` — estender com casos: (a) geração mensal Contábil normal, (b) empresa sem responsável Contábil pulada e listada, (c) bloco anual disparando no mês correto, (d) segunda execução não duplica tarefas anuais nem mensais Contábil
- [ ] Nenhuma instalação de framework necessária — Vitest já configurado e em uso

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | não (sem mudança de auth nesta fase) | — |
| V3 Session Management | não | — |
| V4 Access Control | **sim** | `withVisibilityScope`/`withTarefaScope` (Fase 5, já setor-aware para CONTABIL) — reuso direto para CONT-06, sem mudança nesta fase; o motor de geração (`executarGeracaoMensal`) continua deliberadamente SEM escopo de autorização (cron não tem sessão), mesmo invariante já documentado nas Fases 3 e 6 |
| V5 Input Validation | sim | `competenciaSchema` (mensal, já existe) e `competenciaAnualSchema` (NOVO, recomendado nesta pesquisa) cobrem os dois formatos de competência recebidos pelas funções puras; nenhum novo input de usuário é introduzido por esta fase além do que já existe (a geração Contábil é automática) |
| V6 Cryptography | não | — |

### Known Threat Patterns for Next.js/Prisma (mesmo stack das fases anteriores)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Tarefa Contábil atribuída ao responsável Fiscal/DP por engano (filtro de setor esquecido na query) | Tampering (integridade do dado, atribuição incorreta) | Filtrar explicitamente `responsaveisPorSetor` por `where: { setor: "CONTABIL" }` na query do motor — mesmo Pitfall 2 já documentado e testado na Fase 6, agora replicado para o terceiro setor |
| Geração mensal bloqueada globalmente por uma empresa sem responsável Contábil (negação de serviço auto-infligida) | Denial of Service (sobre o próprio sistema) | "Pular e listar" por empresa, nunca abortar a transação inteira — D-11, mesmo padrão D-01/D-02/D-03 da Fase 6 |
| Tarefa anual criada com competência em formato incorreto, colidindo silenciosamente com uma tarefa mensal futura sob o mesmo `tipoObrigacao` (cenário hipotético se um novo `TipoObrigacao` mensal reusasse acidentalmente um nome já usado por uma obrigação anual) | Tampering (corrupção de dado por colisão de chave) | Os 11 novos enum values (8 mensais + 3 anuais) são todos distintos entre si e dos já existentes — nenhuma colisão de nome possível sob o enum atual; reforçar via revisão de nomenclatura ao adicionar ao `prisma/schema.prisma` |
| Cron sem autenticação disparando geração de tarefas para qualquer setor | Spoofing/Elevation (já mitigado, documentado desde a Fase 3) | Invariante já documentado: `executarGeracaoMensal` é deliberadamente sem escopo de sessão por design — nenhuma mudança nesta fase |

## Sources

### Primary (HIGH confidence)
- Leitura direta do código deste projeto: `prisma/schema.prisma`, `src/lib/geracao-tarefas.ts`, `src/lib/geracao-tarefas-dp.ts`, `src/modules/tarefas/geracao.ts`, `src/lib/dia-util.ts`, `src/lib/competencia.ts`, `src/lib/visibility-scope.ts`, `src/app/(app)/tarefas/actions.ts`, `tests/geracao.idempotencia.test.ts`, `tests/dia-util.test.ts`, `package.json`, `prisma/seed.ts`
- Execução local de Node + `date-holidays` 3.30.2 (instalado neste projeto) — validou o cálculo de vencimento anual (31/mar, 31/mai, 31/jul) contra o ano de vencimento de 2027, incluindo um caso de antecipação por fim de semana (ECF)
- `npm view date-fns version` (4.4.0) e `npm view date-holidays version` (3.30.2) — confirmam que as versões já fixadas no `package.json` são as correntes no registro npm
- `.planning/phases/06-motor-de-gera-o-departamento-pessoal/06-RESEARCH.md` — padrão arquitetural direto a replicar (catálogo irmão, segundo/terceiro/quarto loop na mesma transação, "pular e listar")

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Pitfall pendente já anotado para a Phase 7 ("Periodicidade anual precisa de formato de competência explícito e testes simulando 12 ticks mensais") — confirma que esta pesquisa está respondendo a uma lacuna já identificada pelo próprio projeto, não introduzida ad-hoc
- `.planning/phases/07-motor-de-gera-o-cont-bil-mensal-e-anual/07-CONTEXT.md` — decisões D-01 a D-12, fonte primária de requisitos de negócio (datas-base, mapeamento regime→obrigação, antecedência de criação)

### Tertiary (LOW confidence)
- Nenhuma fonte de baixa confiança usada nesta pesquisa — todo o domínio técnico é interno ao projeto e foi verificado por leitura de código ou execução local, não por busca externa genérica. As datas-padrão de vencimento legal (31/mar DEFIS, 31/mai ECD, 31/jul ECF) já foram confirmadas pelo usuário no CONTEXT.md como suficientes, sem necessidade de verificação externa adicional nesta pesquisa.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma dependência nova, versões já fixadas reconfirmadas correntes no registro npm
- Architecture: HIGH — padrão de extensão (catálogo irmão, bloco adicional na mesma transação) é repetição direta e validada do que a Fase 6 já fez; a única peça genuinamente nova (função pura de periodicidade anual) foi desenhada, codificada e validada por execução local nesta própria sessão de pesquisa
- Pitfalls: HIGH — pitfalls 1-3 e 5 derivados de inspeção direta do código existente e decisões explícitas do CONTEXT.md; Pitfall 4 é uma recomendação de qualidade desta pesquisa (marcada como Assumption A3, risco baixo)

**Research date:** 2026-06-24
**Valid until:** 30 dias (domínio estável — sem dependência de calendário fiscal que mude rapidamente; revisitar apenas se o schema ou o motor de geração sofrerem mudança estrutural antes da execução desta fase, ou se a Receita Federal anunciar prorrogação de prazo que o usuário queira refletir no sistema)
