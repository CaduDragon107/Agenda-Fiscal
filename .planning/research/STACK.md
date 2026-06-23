# Stack Research — v2.0 Expansão Multi-Setor (DP e Contábil)

**Domain:** Extensão de motor de geração de tarefas recorrentes (Next.js/Prisma/Postgres) de periodicidade mensal-only para mensal+anual, e modelagem de obrigações de Departamento Pessoal (folha/FGTS/INSS/eSocial) e Contábil (balancete/escrituração mensal, ECF/DEFIS anual)
**Researched:** 2026-06-22
**Confidence:** HIGH (extensão de código já lido e verificado neste repo; regras de prazo ECF/DEFIS confirmadas em fontes oficiais/contábeis atuais)

## Recommended Stack

### Verdict: No new dependency is needed

A pergunta central desta pesquisa — "precisa de lib nova para periodicidade anual e prazos de DP/Contábil?" — tem resposta direta: **não**. O motor existente (`src/lib/geracao-tarefas.ts` + `src/lib/dia-util.ts` + `src/lib/scheduler.ts`) já resolve os três problemas que a expansão levanta:

1. **Cálculo de "próximo dia útil anterior"** — `date-holidays` + `date-fns` (`src/lib/dia-util.ts`) já implementam exatamente a regra que ECF, DEFIS, FGTS e DAS-DP usam ("antecipa para o último dia útil anterior se a data-base cair em fim de semana/feriado"). Confirmado nesta pesquisa: a Receita Federal aplica essa mesma regra para ECF (último dia útil de julho) e DEFIS (31/03, antecipado se não for dia útil) — não é uma regra fiscal-específica, é a regra geral de vencimento de obrigação federal brasileira.
2. **Disparo mensal único (cron)** — `node-cron` (`src/lib/scheduler.ts`, `0 6 1 * *`) já roda todo dia 1. Obrigações anuais (ECF/DEFIS) não precisam de um *segundo* agendador: elas só devem gerar uma tarefa quando o mês de competência bater com o mês de vencimento daquele tipo de obrigação — isso é um filtro de **dados** (qual regra aplica em qual mês), não um problema de **agendamento**. O mesmo job mensal cobre mensal e anual.
3. **Modelagem de periodicidade** — o `schema.prisma` atual já separa o catálogo de obrigações (`CATALOGO_OBRIGACOES`, hoje hardcoded em TS por regime) da execução (`gerarTarefasDoMes`). Estender para anual é adicionar um campo `periodicidade` e um campo `mesVencimento` (1-12, usado só quando `periodicidade = ANUAL`) à regra — sem schema novo, sem lib nova.

### Core Technologies (extensão, não substituição)

| Technology | Version (já instalada) | Extensão necessária | Por quê é suficiente |
|------------|--------------------------|----------------------|------------------------|
| **date-holidays** | 3.30.2 (instalada) | Nenhuma — reusar `anticiparParaDiaUtil` sem alteração | A regra de antecipação para dia útil é idêntica para ICMS/DAS (mensal) e ECF/DEFIS (anual): "se cair em fim de semana ou feriado nacional, antecipa". Confirmado para ECF (último dia útil de julho) e DEFIS (31/03 "antecipando-se a entrega caso o dia 31 seja dia considerado não útil") nesta pesquisa. |
| **date-fns** | 4.4.0 (instalada) | Trocar `addMonths`/`setDate` por equivalentes anuais quando necessário (`addYears`, ou simplesmente fixar o ano de vencimento = ano da competência + 1, já coberto por aritmética simples) | `date-fns` já cobre todas as operações de data necessárias (soma de meses/anos, último dia do mês, comparação) — biblioteca genérica de datas, não fiscal-específica; nenhuma operação nova introduzida por periodicidade anual exige função que não exista no pacote. |
| **node-cron** | 4.4.1 (instalada) | Nenhuma — o job `0 6 1 * *` continua sendo o único agendador | Obrigações anuais não rodam "uma vez por ano" no cron — rodam **todo mês**, e o catálogo decide se aquele mês gera uma tarefa ANUAL ou não (ex.: regra ECF só "dispara" quando o mês de geração é julho). Isso elimina a necessidade de um segundo cron schedule (`0 6 1 7 *` para julho, etc.) — menos superfície de bugs de agendamento duplicado. |
| **Prisma ORM** | 6.19.3 (instalada) | Migration aditiva: novo enum `Periodicidade { MENSAL ANUAL }`, novos valores de `TipoObrigacao` (DP e Contábil), e — dependendo da decisão de modelagem (ver Pitfall abaixo) — extração do catálogo hardcoded em TS para uma tabela `RegraObrigacao` no banco | Prisma já suporta tudo isso nativamente via `prisma migrate dev` — não há limitação técnica que exija troca de ORM ou ferramenta de migration. |
| **PostgreSQL** | gerenciado (Neon/Railway) | Nenhuma mudança de versão ou de plano — volume de dados cresce de ~1 setor para 3 (mais linhas em `Tarefa`/`TarefaHistorico`), mas ainda é ordem de ~197 empresas × ~5-8 obrigações/mês × 3 setores ≈ <5.000 linhas/mês, irrelevante para qualquer tier gerenciado atual | Não há requisito de escala que justifique reavaliar o banco nesta milestone. |

### Supporting Libraries — nenhuma nova obrigatória

| Library | Avaliada para | Decisão | Motivo |
|---------|----------------|---------|--------|
| Biblioteca de regras fiscais BR (ex.: pacotes npm de "calendário fiscal brasileiro") | Calcular automaticamente prazos de eSocial/FGTS/INSS/ECF/DEFIS | **Não usar** | Não existe um pacote npm maduro, mantido e confiável que modele as ~6-10 regras de prazo de DP/Contábil necessárias aqui (eSocial tem mais de uma "janela" de evento — periódico mensal e eventos não-periódicos —, mas o escopo desta milestone é só os eventos periódicos mensais, que têm prazo fixo por dia do mês, igual ao padrão já implementado). Modelar essas ~6-10 regras como dados (catálogo) é mais simples, mais auditável e mais barato de manter do que adicionar uma dependência externa de baixa confiança para resolver um problema que já é resolvido pelo código existente. |
| BrasilAPI (feriados) | Alternativa/fallback a `date-holidays` | **Não necessário nesta milestone** | Já era uma alternativa considerada no v1.0 (ver STACK.md original) para complementar `date-holidays`; nenhuma obrigação nova introduzida em DP/Contábil exige feriados estaduais/municipais (Out of Scope confirmado em PROJECT.md) — a regra nacional já implementada é suficiente. |
| Job scheduler dedicado (Inngest, trigger.dev, BullMQ) | Rodar geração anual separadamente da mensal | **Não usar** | Avaliado explicitamente nesta pesquisa por pedido do downstream consumer. Overengineering: introduzir um segundo sistema de jobs só para "rodar 1x por ano" cria mais superfície de falha (dois pontos de agendamento para auditar, dois lugares onde a idempotência pode quebrar) do que resolve. O padrão já validado em D-07 a D-13 (geração mensal idempotente via `@@unique` no banco) se estende sem atrito para anual: o job mensal já existente simplesmente também processa regras `periodicidade: ANUAL` cujo `mesVencimento` bate com o mês corrente. |

## Schema Extension Recommendation

Não é apenas "adicionar um campo periodicidade" isoladamente — a extensão mínima e coerente com o padrão já estabelecido no código (catálogo puro em `geracao-tarefas.ts`) é:

```typescript
// src/lib/geracao-tarefas.ts (ou módulo equivalente por setor)

export type Periodicidade = "MENSAL" | "ANUAL";

type ObrigacaoRegra = {
  tipo: TipoObrigacao;
  periodicidade: Periodicidade;
  diaBase: number;
  // Só relevante quando periodicidade = "ANUAL": mês (1-12) em que a
  // obrigação deve ser gerada. Ex.: ECF = 7 (julho), DEFIS = 3 (março).
  // Para MENSAL, undefined — gera todo mês, como hoje.
  mesGeracao?: number;
};
```

E no `gerarTarefasDoMes` (ou função equivalente para Contábil), filtrar:

```typescript
const regrasDoMes = catalogo.filter(
  (r) => r.periodicidade === "MENSAL" || r.mesGeracao === mesCompetencia
);
```

Isso reaproveita 100% de `calcularPrazoBase` e `anticiparParaDiaUtil` sem alteração — o "anual" só muda **quando** a regra entra no filtro, não **como** o prazo é calculado.

**Decisão de modelagem pendente para a fase de planejamento (não desta pesquisa):** se o catálogo de obrigações para os 3 setores deve continuar hardcoded em TS (como hoje, fiscal) ou migrar para uma tabela `RegraObrigacao` no Postgres. Hardcoded é mais simples e consistente com o padrão atual; tabela no banco facilita edição futura sem deploy (relevante porque DP/Contábil têm campos extra como `mesGeracao` que aumentam a chance de precisar ajuste fino pós-lançamento). Ambas as opções usam só Prisma + Postgres já existentes — nenhuma lib nova nos dois casos.

## DP e Contábil: regras de prazo confirmadas (para o catálogo, não para o stack)

Estas são regras de **dados** a inserir no catálogo, confirmadas por fontes oficiais/contábeis atuais nesta pesquisa — não exigem nenhuma lib além do já existente:

| Obrigação | Setor | Periodicidade | Regra de prazo | Ajuste dia útil |
|-----------|-------|----------------|------------------|-------------------|
| **ECF** (Escrituração Contábil Fiscal) | Contábil | ANUAL | Último dia útil de julho do ano seguinte ao ano-calendário | Já é "último dia útil" por definição — mesma lógica de `anticiparParaDiaUtil` |
| **DEFIS** (Declaração de Informações Socioeconômicas e Fiscais) | Contábil | ANUAL | 31 de março do ano seguinte ao ano-calendário | Antecipa para o último dia útil anterior se 31/03 não for dia útil — usa `anticiparParaDiaUtil` sem modificação |
| **Balancete / Escrituração contábil** (livro diário/razão) | Contábil | MENSAL | Prazo interno do escritório (não há prazo legal rígido tipo Receita; é prazo de rotina) — definir dia-base como decisão de produto, igual ao padrão D-02 já usado para ICMS/DAS | Sim, mesmo padrão |
| **Folha de pagamento** | DP | MENSAL | Prazo de pagamento até o 5º dia útil do mês subsequente (CLT) — dia-base "calculado", não fixo | Antecipação já cobre o caso de cair em fim de semana/feriado; cálculo de "5º dia útil" é uma pequena extensão de `dia-util.ts` (contar dias úteis para frente, não só antecipar) — ver Pitfall abaixo |
| **FGTS** | DP | MENSAL | Vencimento dia 20 do mês subsequente (ou 7º dia útil seguinte ao da liquidação para grandes contribuintes — escopo desta carteira são PMEs, usar regra padrão dia 20) | `anticiparParaDiaUtil` direto, mesmo padrão de ICMS/DAS |
| **INSS (GPS/eSocial)** | DP | MENSAL | Vencimento dia 20 do mês subsequente, unificado ao DAE do eSocial desde a integração FGTS Digital/eSocial | `anticiparParaDiaUtil` direto |
| **eSocial — eventos periódicos** (folha mensal, S-1200/S-1210/S-1299 etc.) | DP | MENSAL | Fechamento da folha até o dia 7 do mês subsequente; envio dos eventos periódicos segue o vencimento do DAE (dia 20, junto com FGTS/INSS) | `anticiparParaDiaUtil` direto |

**Nota importante:** "5º dia útil" para folha de pagamento é a única regra acima que **não** é "dia-base fixo + antecipar se cair em dia não-útil" — é "contar N dias úteis a partir do dia 1". Isso é uma pequena função nova (`enesimoDiaUtil(mes, ano, n)`), mas é uma função **pura de data**, implementável com `date-fns` + `date-holidays` exatamente como `anticiparParaDiaUtil` já é — não introduz dependência nova, só mais uma função no mesmo módulo `dia-util.ts`. Avaliar esta regra com mais profundidade na fase de planejamento de DP (pode ser que o escritório use uma convenção interna mais simples, como dia fixo 5 ou 7 + antecipação, já que a CLT permite convenção/acordo coletivo).

## Installation

Nenhuma instalação nova é necessária. Toda a extensão é feita sobre dependências já presentes no `package.json`:

```bash
# Nenhum pacote novo a instalar para esta milestone.
# Confirmar apenas que as versões atuais seguem compatíveis após
# qualquer atualização incidental do lockfile:
npm ls date-fns date-holidays node-cron @prisma/client prisma
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|--------------|-------------|---------------------------|
| Estender o catálogo hardcoded em TS (`CATALOGO_OBRIGACOES`) com `periodicidade` + `mesGeracao` | Mover o catálogo para uma tabela `RegraObrigacao` no Postgres, editável via UI admin | Se o dono do escritório pedir, no futuro, para editar prazos sem precisar de deploy (ex.: a Receita muda uma data, ou o escritório quer ajustar o "dia interno" de balancete). Não é necessário para o lançamento de v2.0 — pode ser uma melhoria de v2.1+. |
| Reusar o cron mensal único (`0 6 1 * *`) também para regras anuais | Criar um segundo `cron.schedule` específico para meses de vencimento anual (ex.: só dispara em julho para ECF) | Nunca, nesta escala — um segundo agendador adicionaria complexidade (dois pontos de falha, dois logs a monitorar) sem benefício real, já que o filtro por `mesGeracao` dentro da mesma execução mensal resolve o problema de forma mais simples e com a mesma garantia de idempotência (`@@unique` constraint) já testada. |
| `anticiparParaDiaUtil` (sempre antecipa) também para folha de pagamento de DP | Implementar `enesimoDiaUtil` (postergação contando dias úteis) | Usar `enesimoDiaUtil` especificamente para a regra de "Nº dia útil do mês" da folha de pagamento, que é estruturalmente diferente (conta dias úteis PARA FRENTE a partir do dia 1, não antecipa uma data-base fixa). As duas funções coexistem no mesmo módulo `dia-util.ts` — não são mutuamente exclusivas, atendem regras diferentes. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Pacote npm de "calendário fiscal brasileiro" / "regras tributárias BR" de terceiros | Nenhum candidato encontrado tem manutenção ativa, cobertura abrangente das ~10 regras específicas (ECF/DEFIS/FGTS/INSS/eSocial) e confiabilidade equivalente ao padrão já estabelecido neste projeto (regras como dados + `date-holidays` para feriados) — introduzir essa dependência troca uma lógica simples, testável e já auditada por uma caixa-preta externa de confiança desconhecida | Catálogo de regras como dados em TS (ou tabela Prisma), reusando `date-holidays`/`date-fns`/`dia-util.ts` já validados em produção |
| Segundo cron job (`node-cron` schedule adicional) só para obrigações anuais | Duplica a superfície de agendamento e de monitoramento sem necessidade — o mesmo job mensal já cobre o caso via filtro de dados | Um único `cron.schedule("0 6 1 * *")` que processa MENSAL e ANUAL na mesma execução, filtrando por `mesGeracao` |
| Modelar `TipoObrigacao` dos 3 setores como um enum Prisma único e cada vez maior sem nenhuma estrutura de "setor" | Funciona em escala pequena, mas dificulta queries de dashboard por setor (ex.: "todas as tarefas do setor DP") sem um campo explícito de setor — gambiarra de manutenção a médio prazo | Adicionar um campo/enum `Setor { FISCAL DP CONTABIL }` explícito na regra de obrigação (e possivelmente em `Tarefa`), permitindo `WHERE setor = 'DP'` direto, sem inferir o setor a partir do `tipoObrigacao` |

## Stack Patterns by Variant

**Se o catálogo de regras permanecer hardcoded em TS (recomendado para v2.0):**
- Um arquivo por setor (`geracao-tarefas-dp.ts`, `geracao-tarefas-contabil.ts`) seguindo exatamente o padrão de `geracao-tarefas.ts` (função pura, sem I/O)
- Orquestração em `geracao.ts` chama os três catálogos (fiscal/DP/contábil) dentro da mesma transação, mantendo a garantia de idempotência única (`@@unique([empresaId, tipoObrigacao, competencia])`, estendido para incluir `setor` se `tipoObrigacao` não for suficiente para diferenciar)
- Porque: mantém o padrão já testado, minimiza risco de regressão no motor fiscal existente

**Se o catálogo migrar para o banco (considerar só se houver pedido explícito de edição via UI):**
- Nova tabela Prisma `RegraObrigacao` (setor, tipo, periodicidade, diaBase, mesGeracao, regimeAplicavel)
- `gerarTarefasDoMes` passa a receber as regras como parâmetro (lidas do banco antes da chamada), preservando a função pura/testável
- Porque: só vale o custo de complexidade extra se houver necessidade real de editar prazos sem deploy

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `date-fns@4.4.0` | `date-holidays@3.30.2` | Já validado em produção no setor Fiscal (`dia-util.ts`); nenhuma mudança de versão necessária para suportar periodicidade anual ou as novas regras de DP/Contábil — ambas as libs são genéricas de data/feriado, não fiscal-específicas |
| `node-cron@4.4.1` | `prisma@6.19.3` (transação única) | A mesma transação Prisma (`db.$transaction`) que hoje gera tarefas mensais do setor Fiscal pode (e deve) ser estendida para também gerar DP/Contábil/anual na mesma chamada — evita múltiplas transações concorrentes tentando o mesmo snapshot mensal |
| `@prisma/client@6.19.3` | Migration aditiva (`npx prisma migrate dev`) | Adicionar enum `Periodicidade`, novos valores de `TipoObrigacao`, e (se aplicável) campo `setorId`/`setor` em `Empresa`-responsável e `Tarefa` é uma migration estritamente aditiva — não quebra dados existentes do setor Fiscal já em produção |

## Sources

- Código-fonte deste repositório — `src/lib/geracao-tarefas.ts`, `src/lib/dia-util.ts`, `src/lib/scheduler.ts`, `src/modules/tarefas/geracao.ts`, `prisma/schema.prisma` — lidos e verificados diretamente nesta pesquisa — **HIGH**
- `.planning/PROJECT.md` (contexto da milestone v2.0) — **HIGH**
- Receita Federal / fontes contábeis sobre prazo ECF 2026 (último dia útil de julho do ano seguinte) — confirmado via busca atual, múltiplas fontes contábeis (IOB, Lopes Machado Auditores, gov.br) — **MEDIUM** (regra de negócio confirmada por múltiplas fontes secundárias consistentes entre si, mas não citação direta de Instrução Normativa)
- Receita Federal / Simples Nacional sobre prazo DEFIS (31/03, antecipado se não-útil) — confirmado via busca atual, incluindo página oficial gov.br/receitafederal e CRCSC — **HIGH** (fonte oficial gov.br confirmada)
- `package.json` deste repositório — versões instaladas confirmadas via `npm ls` — **HIGH**

---
*Stack research for: extensão do motor de geração de tarefas recorrentes (periodicidade anual) e modelagem de obrigações DP/Contábil — Agenda Fiscal v2.0*
*Researched: 2026-06-22*
