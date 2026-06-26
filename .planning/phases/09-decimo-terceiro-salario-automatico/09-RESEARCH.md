# Phase 9: 13º Salário Automático - Research

**Researched:** 2026-06-25
**Domain:** Geração automática de tarefa recorrente anual (motor de periodicidade interno, sem chamada externa)
**Confidence:** HIGH

## Summary

DP-09 é uma extensão pura do motor de geração mensal já existente (`src/modules/tarefas/geracao.ts`), reaproveitando dois padrões já validados em produção: o catálogo de periodicidade anual da Fase 7 (`geracao-tarefas-contabil-anual.ts`, ECD/ECF/DEFIS) e o gate de elegibilidade DP da Fase 6 (`geracao-tarefas-dp.ts`, `temFuncionariosClt` + `responsaveisPorSetor` filtrado por `setor: "DP"`). Não há biblioteca nova a instalar, não há API externa, não há UI nova — é 100% lógica de catálogo + um novo bloco na mesma transação Prisma.

A decisão de arquitetura mais importante (D-02 do CONTEXT.md) é que o vencimento do 13º cai no MESMO ano-base da competência (`anoVencimento = anoAtual`), divergindo do padrão Contábil anual onde `anoVencimento = anoAtual + 1`. A pesquisa nesta sessão **inspecionou o código real** de `obrigacoesAnuaisParaCompetencia` e confirma que essa função hardcoda `anoVencimento: anoAtual + 1` (linha 104) com um comentário explícito "Pitfall 2 — SEMPRE ano seguinte" — generalizar essa função para aceitar `vencimentoMesmoAno: boolean` violaria esse invariante documentado e arriscaria quebrar os 3 testes de regressão existentes que fixam `anoVencimento === anoAtual + 1` (ECD: ano 2027 para competência 2026-04). A recomendação é **não tocar** em `geracao-tarefas-contabil-anual.ts` — criar um catálogo paralelo dedicado a obrigações anuais de DP.

Um achado crítico não mencionado no CONTEXT.md: existe um mapa de single-source-of-truth `TIPOS_OBRIGACAO_POR_SETOR` em `src/lib/tipo-obrigacao-setor.ts`, guardado por um teste de completude (`tests/tipo-obrigacao-setor.test.ts`) que falha imediatamente se qualquer valor do enum `TipoObrigacao` não aparecer em exatamente um setor. Adicionar `DECIMO_TERCEIRO` ao enum SEM adicioná-lo à lista `DP` neste mapa quebra esse teste E torna a tarefa invisível nos dashboards de DP (success criterion 4 do phase description) e na visibilidade por setor de `withTarefaScope`-equivalentes baseados em `tarefaSetorWhere`.

**Primary recommendation:** Criar um novo arquivo `src/lib/geracao-tarefas-dp-anual.ts` (catálogo paralelo, dedicado, com `anoVencimento = anoAtual` hardcoded e comentário explícito da divergência), sem tocar em `geracao-tarefas-contabil-anual.ts`. Adicionar `DECIMO_TERCEIRO` ao enum `TipoObrigacao` (migration) E à lista `DP` em `TIPOS_OBRIGACAO_POR_SETOR`. Integrar como um quinto bloco em `executarGeracaoMensal`, seguindo o padrão exato do bloco Contábil anual (mesma transação, mesmo padrão skip+list, mesmo `responsaveisPorSetor` filtrado por `setor: "DP"`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Catálogo de regra "13º vence 20/dez do mesmo ano" | API/Backend (lib pura) | — | Função pura sem I/O, mesmo padrão dos 3 catálogos existentes (`geracao-tarefas*.ts`) |
| Decisão "criar em novembro" por competência mensal | API/Backend (lib pura) | — | Mesma função `obrigacoesXParaCompetencia(competencia)` — decisão determinística sem `Date.now()` |
| Persistência idempotente da tarefa | API/Backend + Database | — | `tx.tarefa.createMany({ skipDuplicates: true })` apoiado em `@@unique([empresaId, tipoObrigacao, competencia])` — sem mudança de schema alem do enum |
| Elegibilidade (`temFuncionariosClt`) + lookup de responsável DP | API/Backend (orquestração em `geracao.ts`) | Database (`EmpresaResponsavelSetor`) | Mesmo padrão do bloco DP mensal e Contábil anual já existentes |
| Visibilidade da tarefa nos dashboards/listas de DP | Database (mapa `TIPOS_OBRIGACAO_POR_SETOR`) | API/Backend | Setor é derivado do `tipoObrigacao` via mapa estático — não há lógica nova de dashboard, só o registro do novo enum value no mapa existente |
| Ajuste de prazo para dia útil anterior | API/Backend (lib pura `dia-util.ts`) | — | Reuso direto de `anticiparParaDiaUtil`, zero modificação |

Nenhuma capacidade desta fase toca o tier Browser/Client ou CDN/Static — fase é 100% backend/geração, confirmando a descrição do phase scope ("puramente backend/geração — não calcula valores monetários, não introduz cadastro de funcionários individuais").

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DP-09 | Geração automática anual de tarefa de 13º salário, por empresa com funcionários CLT, reaproveitando o motor de periodicidade anual já validado no Contábil (ECD/ECF/DEFIS) | Ver Architecture Patterns (novo catálogo `geracao-tarefas-dp-anual.ts`) + Don't Hand-Roll (reuso de `anticiparParaDiaUtil`, `competenciaSchema`, `skipDuplicates`) + Common Pitfalls (P1: `anoVencimento` hardcoded vs ano-base; P2: mapa `TIPOS_OBRIGACAO_POR_SETOR` desatualizado) |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

Este projeto (Agenda Fiscal) tem um CLAUDE.md detalhado com stack recomendada para o projeto inteiro (Next.js 15.5, Prisma 6.x, Auth.js v5, etc.) — nenhuma dessas diretivas é diretamente acionável para DP-09, que não introduz nenhuma dependência nova, UI nova, nem rota nova. Os únicos pontos relevantes desta fase:

- **Prisma**: schema declarativo, migrations versionadas — DP-09 precisa de uma migration para adicionar `DECIMO_TERCEIRO` ao enum `TipoObrigacao`. Mesmo padrão de migrations já usado nas fases 6/7 (`npx prisma db push`, ambiente Neon sem shadow database — ver STATE.md Phase 02-01).
- **date-fns / date-holidays**: já instalados e em uso por `dia-util.ts` — DP-09 não precisa instalar nada novo, apenas reusar `anticiparParaDiaUtil`.
- **Sem cálculo de valores monetários** (explícito no "What NOT to Use" do CLAUDE.md e no phase scope) — confirma que DP-09 é só geração/rastreamento da tarefa, nunca cálculo de folha.
- Nenhuma diretiva de CLAUDE.md é violada pela recomendação desta pesquisa.

## Standard Stack

Nenhuma biblioteca nova é necessária para esta fase. Todas as dependências já estão instaladas e em uso pelo motor de geração existente:

### Core (já instalado, reuso direto)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `date-fns` | ^4.4.0 [VERIFIED: package.json] | `addMonths`, `setDate`, `lastDayOfMonth` (se necessário para o catálogo) | Já em uso por `dia-util.ts`/`competencia.ts`; nenhuma chamada nova de API é necessária |
| `date-holidays` | ^3.30.2 [VERIFIED: package.json] | Cálculo de feriados nacionais via singleton `hd` em `dia-util.ts` | Reuso indireto via `anticiparParaDiaUtil` — DP-09 nunca instancia `Holidays` diretamente |
| `zod` | já instalado (ver schema existente) | `competenciaSchema`/`competenciaAnualSchema` para validar formato de entrada | Reuso direto, sem novo schema necessário (a competência anual já usa o formato "YYYY" existente) |
| `@prisma/client` (Prisma 6.x) | já instalado | Geração de tipos para o novo enum value após migration | Exige `npx prisma generate` após a migration, mesma sequência já documentada em STATE.md (Phase 05-04) |

### Supporting
Nenhuma.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Novo catálogo paralelo `geracao-tarefas-dp-anual.ts` | Generalizar `geracao-tarefas-contabil-anual.ts` com `vencimentoMesmoAno: boolean` | Rejeitado — ver Architecture Patterns / Pattern 1 abaixo, risco de regressão nos 3 testes existentes de ECD/ECF/DEFIS que fixam `anoVencimento = anoAtual + 1` |
| Novo catálogo paralelo dedicado | Estender `geracao-tarefas-dp.ts` (catálogo mensal) com um campo `periodicidade` | Rejeitado — misturaria duas formas de competência ("YYYY-MM" mensal vs "YYYY" anual) no mesmo arquivo/tipo, quebrando a separação de formato já estabelecida entre os dois eixos |

**Installation:** Nenhuma — zero pacotes novos nesta fase.

**Version verification:** Confirmado via leitura direta de `package.json` no repositório — `date-fns@^4.4.0`, `date-holidays@^3.30.2`, ambos já instalados e em uso ativo por `src/lib/dia-util.ts` e `src/lib/competencia.ts`. Nenhuma versão nova precisa ser instalada ou verificada contra registro externo.

## Package Legitimacy Audit

**Não aplicável** — esta fase não instala nenhum pacote novo. Todas as dependências usadas (`date-fns`, `date-holidays`, `zod`, `@prisma/client`) já estão instaladas e em produção desde fases anteriores (03, 06, 07), já auditadas nos respectivos RESEARCH.md.

**Packages removed due to [SLOP] verdict:** nenhum (nenhum pacote novo)
**Packages flagged as suspicious [SUS]:** nenhum (nenhum pacote novo)

## Architecture Patterns

### System Architecture Diagram

```
Cron mensal (instrumentation.ts)
        │
        ▼
executarGeracaoMensal(competencia: "YYYY-MM")
        │
        ▼
   db.$transaction
        │
        ├─► [1] Snapshot do mês anterior (DesempenhoMensal)
        │
        ├─► [2] Bloco Fiscal mensal      (Empresa.responsavelId legado)
        │
        ├─► [3] Bloco DP mensal          (responsaveisPorSetor: setor="DP")
        │         └─ gerarTarefasDoMesDp()
        │
        ├─► [4] Bloco Contábil mensal    (responsaveisPorSetor: setor="CONTABIL")
        │
        ├─► [5] Bloco Contábil anual     (ECD/ECF/DEFIS, anoVencimento = anoAtual+1)
        │         └─ obrigacoesAnuaisParaCompetencia()
        │
        ├─► [6] NOVO: Bloco DP anual (13º Salário)
        │         │
        │         ├─ obrigacoesDpAnuaisParaCompetencia(competencia)
        │         │     └─ filtra CATALOGO_OBRIGACOES_DP_ANUAIS por mesCriacao === mesAtual
        │         │     └─ retorna anoVencimento = anoAtual (D-02, DIVERGE do bloco [5])
        │         │
        │         ├─ tx.empresa.findMany({ temFuncionariosClt: true })
        │         │     com responsaveisPorSetor: { where: { setor: "DP" } }
        │         │
        │         ├─ filtra comResponsavel / semResponsavelDpAnual (skip+list, nunca throw)
        │         │
        │         └─ calcularPrazoAnual(anoVencimento, mesVencimento=12, diaVencimento=20)
        │               └─ anticiparParaDiaUtil() [reuso direto, sem mudança]
        │
        ▼
   tarefas = [...Fiscal, ...DP, ...ContabilMensal, ...ContabilAnual, ...DpAnual]
        │
        ▼
   tx.tarefa.createMany({ skipDuplicates: true })
        │   apoiado em @@unique([empresaId, tipoObrigacao, competencia])
        ▼
   { criadas, puladas, semResponsavelDp, semResponsavelContabil, semResponsavelDpAnual }
```

A tarefa criada flui depois para:
```
Tarefa (DECIMO_TERCEIRO, competencia="2026")
        │
        ├─► Lista de tarefas do responsável DP (withTarefaScope)
        │
        └─► Dashboards de DP (tarefaSetorWhere("DP"))
                  └─ depende de TIPOS_OBRIGACAO_POR_SETOR.DP incluir "DECIMO_TERCEIRO"
                     (ver Pitfall 2 abaixo — gate obrigatório, não automático)
```

### Recommended Project Structure
```
src/lib/
├── geracao-tarefas-dp.ts              # existente, mensal — NÃO modificar
├── geracao-tarefas-contabil-anual.ts  # existente, anual Contábil — NÃO modificar
├── geracao-tarefas-dp-anual.ts        # NOVO — catálogo anual de DP (13º Salário)
└── tipo-obrigacao-setor.ts            # existente — ADICIONAR "DECIMO_TERCEIRO" à lista DP

src/modules/tarefas/
└── geracao.ts                         # ADICIONAR 6º bloco (DP anual), após o bloco Contábil anual

prisma/
└── schema.prisma                      # ADICIONAR "DECIMO_TERCEIRO" ao enum TipoObrigacao

tests/
├── geracao-tarefas-dp-anual.test.ts   # NOVO — sweep de 12 meses (padrão Pitfall B2)
├── tipo-obrigacao-setor.test.ts       # existente — ajustar contagem esperada (20→21, DP 4→5)
└── geracao.idempotencia.test.ts       # existente — adicionar 1 mock extra por teste (novo bloco)
```

### Pattern 1: Catálogo anual paralelo (NÃO generalizar o motor Contábil anual)

**What:** Em vez de adicionar um parâmetro `vencimentoMesmoAno: boolean` a `obrigacoesAnuaisParaCompetencia`/`calcularPrazoAnual` (que hoje hardcodam `anoAtual + 1`), criar uma função e um catálogo paralelos, estruturalmente idênticos mas com a lógica de ano-base correta para DP-09.

**When to use:** Sempre que a divergência estrutural é só "qual ano usar no vencimento" mas o resto do fluxo (decisão por `mesCriacao`, ajuste de dia útil, formato "YYYY") é idêntico — duplicar uma função pequena e pura é mais seguro que ramificar um comportamento já testado e documentado como invariante ("Pitfall 2 — SEMPRE ano seguinte").

**Por que generalizar é mais arriscado aqui:**
- `obrigacoesAnuaisParaCompetencia` e `calcularPrazoAnual` (em `geracao-tarefas-contabil-anual.ts`) são consumidas por 5+ testes de regressão (`tests/geracao-tarefas-contabil-anual.test.ts`, `tests/geracao.idempotencia.test.ts`) que fixam o comportamento atual (`anoVencimento === anoAtual + 1`) como contrato.
- Adicionar um parâmetro boolean exigiria atualizar TODOS os call sites existentes (mesmo que com default `true`), tocando código já em produção sem necessidade.
- O comentário de cabeçalho do arquivo já documenta a regra como "Pitfall 2" — alterar a assinatura da função quebra a clareza desse contrato para o próximo desenvolvedor/IA que ler o arquivo.

**Example:**
```typescript
// Source: padrão extraído de src/lib/geracao-tarefas-contabil-anual.ts,
// adaptado para D-02 (anoVencimento = anoAtual, não anoAtual + 1)

import { anticiparParaDiaUtil } from "./dia-util";
import { competenciaSchema } from "./competencia";

export type TipoObrigacaoDpAnual = "DECIMO_TERCEIRO";

export type ObrigacaoDpAnualRegra = {
  tipo: TipoObrigacaoDpAnual;
  mesCriacao: number;    // 11 (novembro) — D-04: 1 mês antes do vencimento
  mesVencimento: number; // 12 (dezembro)
  diaVencimento: number; // 20 — D-01: 2ª parcela/saldo, não a 1ª parcela (30/nov)
};

export const TITULO_OBRIGACAO_DP_ANUAL: Record<TipoObrigacaoDpAnual, string> = {
  DECIMO_TERCEIRO: "13º Salário",
};

export const CATALOGO_OBRIGACOES_DP_ANUAIS: ObrigacaoDpAnualRegra[] = [
  { tipo: "DECIMO_TERCEIRO", mesCriacao: 11, mesVencimento: 12, diaVencimento: 20 },
];

export function obrigacoesDpAnuaisParaCompetencia(
  competencia: string
): { regra: ObrigacaoDpAnualRegra; competenciaAnual: string; anoVencimento: number }[] {
  if (!competenciaSchema.safeParse(competencia).success) {
    throw new Error(`competencia inválida: ${competencia}`);
  }

  const [anoAtual, mesAtual] = competencia.split("-").map(Number);

  return CATALOGO_OBRIGACOES_DP_ANUAIS.filter(
    (regra) => regra.mesCriacao === mesAtual
  ).map((regra) => ({
    regra,
    competenciaAnual: String(anoAtual),
    anoVencimento: anoAtual, // D-02: DIVERGE do padrão Contábil — mesmo ano, não ano+1
  }));
}

export function calcularPrazoDpAnual(
  anoVencimento: number,
  mesVencimento: number,
  diaVencimento: number
): Date {
  const dataBase = new Date(anoVencimento, mesVencimento - 1, diaVencimento);
  return anticiparParaDiaUtil(dataBase); // D-03, reuso direto
}
```

### Pattern 2: Integração no bloco de orquestração (`geracao.ts`)

**What:** Adicionar um 6º bloco em `executarGeracaoMensal`, espelhando exatamente a estrutura do bloco Contábil anual (linhas ~190-257), mas usando o gate `temFuncionariosClt: true` (igual ao bloco DP mensal) e `setor: "DP"` no lookup de responsável.

**When to use:** Esta é a única integração necessária — não criar uma nova transação, não criar uma nova Server Action, não duplicar a query de empresas elegíveis (pode até reusar a mesma query `empresasClt` já feita para o bloco DP mensal, se a ordem de execução permitir, evitando um round-trip extra ao banco).

**Example:**
```typescript
// Source: adaptado de src/modules/tarefas/geracao.ts linhas 190-241
// (bloco Contábil anual), aplicando o gate temFuncionariosClt do bloco DP mensal

import {
  obrigacoesDpAnuaisParaCompetencia,
  calcularPrazoDpAnual,
  TITULO_OBRIGACAO_DP_ANUAL,
  type TipoObrigacaoDpAnual,
} from "@/lib/geracao-tarefas-dp-anual";

// ... dentro da mesma transação, após o bloco Contábil anual:

const regrasDpAnuais = obrigacoesDpAnuaisParaCompetencia(competencia);

let tarefasDpAnual: {
  empresaId: string;
  responsavelId: string;
  titulo: string;
  tipoObrigacao: TipoObrigacaoDpAnual;
  competencia: string;
  prazo: Date;
}[] = [];
const semResponsavelDpAnual: { empresaId: string; nome: string }[] = [];

for (const { regra, competenciaAnual, anoVencimento } of regrasDpAnuais) {
  // Pode reusar empresasClt já buscado para o bloco DP mensal (mesmo filtro
  // temFuncionariosClt: true, setor: "DP") — evita um findMany redundante.
  // Caso a ordem de blocos não permita reuso direto da variável, repetir a
  // mesma query (where: { ativo: true, temFuncionariosClt: true }, select
  // com responsaveisPorSetor filtrado por setor: "DP") é aceitável e mantém
  // o padrão de isolamento entre blocos já usado pelo Contábil anual.
  const comResponsavel = empresasClt.filter((e) => e.responsaveisPorSetor.length > 0);
  const semResponsavel = empresasClt
    .filter((e) => e.responsaveisPorSetor.length === 0)
    .map((e) => ({ empresaId: e.id, nome: e.nome }));

  semResponsavelDpAnual.push(...semResponsavel);

  tarefasDpAnual = tarefasDpAnual.concat(
    comResponsavel.map((e) => ({
      empresaId: e.id,
      responsavelId: e.responsaveisPorSetor[0].usuarioId,
      titulo: `${TITULO_OBRIGACAO_DP_ANUAL[regra.tipo]} - ${competenciaAnual}`, // D-06
      tipoObrigacao: regra.tipo,
      competencia: competenciaAnual, // "YYYY" — D-07
      prazo: calcularPrazoDpAnual(anoVencimento, regra.mesVencimento, regra.diaVencimento),
    }))
  );
}

// dedup com semResponsavelDp (bloco DP mensal) por empresaId, mesmo padrão
// do Pitfall 4 já aplicado entre Contábil mensal/anual.

const tarefas = [
  ...tarefasFiscal,
  ...tarefasDp,
  ...tarefasContabilMensal,
  ...tarefasContabilAnual,
  ...tarefasDpAnual, // NOVO
];
```

### Anti-Patterns to Avoid
- **Generalizar `geracao-tarefas-contabil-anual.ts` com um parâmetro `vencimentoMesmoAno`:** arrisca regressão nos testes ECD/ECF/DEFIS já em produção e mistura dois domínios de negócio (Contábil vs DP) num único arquivo de catálogo — ver Pattern 1.
- **Esquecer de adicionar `DECIMO_TERCEIRO` ao mapa `TIPOS_OBRIGACAO_POR_SETOR`:** a tarefa seria criada e persistida corretamente, mas ficaria invisível em qualquer query que use `tarefaSetorWhere("DP")` (dashboards, possivelmente listas filtradas por setor) — violaria diretamente o success criterion 4 do phase description, sem erro visível no momento da criação.
- **Usar `empresa.responsavelId` legado em vez de `responsaveisPorSetor` filtrado por `setor: "DP"`:** mesmo Pitfall 2 já documentado no Plano 06-02 — pegaria o responsável FISCAL por engano para empresas que não migraram a junction table para DP.
- **Adicionar `vencimentoMesmoAno` inline sem dedicar uma função:** mesmo risco do Pattern 1 acima, mesmo que dentro do MESMO arquivo `geracao-tarefas-dp-anual.ts` — preferir hardcoded `anoVencimento: anoAtual` com comentário explícito, igual ao padrão `anoAtual + 1` já hardcoded no Contábil anual.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ajustar prazo para dia útil anterior | Lógica nova de feriados/fim de semana | `anticiparParaDiaUtil` (`src/lib/dia-util.ts`) | Já testado contra feriados móveis reais (Independência, Sexta-feira Santa); D-03 confirma reuso sem modificação |
| Validar formato de competência | Regex inline | `competenciaSchema` (mensal "YYYY-MM") já usado pelo motor; competência anual "YYYY" não precisa de novo schema — basta `String(anoAtual)` igual ao padrão Contábil anual | `competenciaAnualSchema` já existe em `lib/competencia.ts` se for necessário validar a saída |
| Controle de idempotência entre execuções mensais repetidas | Tabela de controle / flag "já gerado este ano" | `@@unique([empresaId, tipoObrigacao, competencia])` + `skipDuplicates: true` | Mesmo mecanismo que já garante idempotência para ECD/ECF/DEFIS — D-13, nenhum mecanismo adicional necessário |
| Determinar quais empresas são elegíveis a uma obrigação de DP | Query ad-hoc nova | Reusar a mesma query `empresasClt` (`where: { ativo: true, temFuncionariosClt: true }`, `select` com `responsaveisPorSetor` filtrado por `setor: "DP"`) já feita para o bloco DP mensal | Evita um round-trip de banco redundante na mesma transação já sob orçamento de tempo apertado (30s timeout documentado em `geracao.ts`) |

**Key insight:** Esta fase não tem NENHUM problema novo de domínio — é 100% composição de padrões já existentes e testados. O único risco real é arquitetural (onde colocar o código) e de completude de mapa (`TIPOS_OBRIGACAO_POR_SETOR`), não de lógica nova.

## Common Pitfalls

### Pitfall 1: Reusar `geracao-tarefas-contabil-anual.ts` sem adaptar `anoVencimento`
**What goes wrong:** Se o plano decidir, por engano ou por pressão de "reuso máximo", chamar `obrigacoesAnuaisParaCompetencia`/`calcularPrazoAnual` diretamente para o 13º salário, o vencimento sai no ano ERRADO (`anoAtual + 1` em vez de `anoAtual`) — a tarefa de 13º de 2026 venceria em 2027.
**Why it happens:** O nome da função genérica ("anual") sugere reuso direto; o comentário "Pitfall 2 — SEMPRE ano seguinte" só é visível para quem lê o arquivo fonte, não para quem só vê a assinatura da função.
**How to avoid:** Criar o catálogo paralelo `geracao-tarefas-dp-anual.ts` (Pattern 1) com `anoVencimento: anoAtual` explícito e comentado. Nunca importar `calcularPrazoAnual`/`obrigacoesAnuaisParaCompetencia` do módulo Contábil para o bloco DP-09.
**Warning signs:** Teste de sweep de 12 meses (Claude's Discretion do CONTEXT.md) mostrando `anoVencimento` um ano adiante do esperado para a competência "2026-11".

### Pitfall 2: Esquecer de atualizar `TIPOS_OBRIGACAO_POR_SETOR`
**What goes wrong:** A tarefa `DECIMO_TERCEIRO` é criada e persistida normalmente, mas fica invisível em qualquer dashboard/lista que filtre por setor via `tarefaSetorWhere("DP")` — o teste de completude `tests/tipo-obrigacao-setor.test.ts` falha imediatamente (`ocorrenciasPorValor.get("DECIMO_TERCEIRO")` será `undefined`, não `1`), mas SÓ se o teste for executado — se o plano esquecer de rodar a suite completa antes de considerar a fase pronta, o bug passa para produção silenciosamente.
**Why it happens:** A migration do enum Prisma e a atualização do mapa TypeScript são duas edições em dois arquivos completamente diferentes (`prisma/schema.prisma` vs `src/lib/tipo-obrigacao-setor.ts`), sem nenhuma dependência de compilação entre eles — TypeScript não erra se você esquecer de atualizar o mapa.
**How to avoid:** Tratar a edição de `TIPOS_OBRIGACAO_POR_SETOR.DP` (adicionar `"DECIMO_TERCEIRO"`) como parte do MESMO commit/task que adiciona o enum value — nunca como um passo separado/opcional. Rodar `tests/tipo-obrigacao-setor.test.ts` explicitamente como critério de verificação da fase.
**Warning signs:** `tests/tipo-obrigacao-setor.test.ts` falhando com "soma total != 21" ou "ocorrenciasPorValor.get('DECIMO_TERCEIRO') is undefined".

### Pitfall 3: Usar `mesVencimento`/`diaVencimento` errados para a 2ª parcela
**What goes wrong:** Codificar o vencimento da 1ª parcela (30/novembro) em vez da 2ª parcela/saldo (20/dezembro), invertendo D-01.
**Why it happens:** A regra legal real do 13º tem duas datas (1ª parcela até 30/nov, 2ª parcela/saldo até 20/dez) — é fácil confundir qual delas o sistema deve rastrear sem reler o CONTEXT.md.
**How to avoid:** `mesVencimento: 12, diaVencimento: 20` (não 11/30) — D-01 já fixa essa decisão explicitamente no CONTEXT.md, sem ambiguidade a resolver.
**Warning signs:** Teste unitário do catálogo mostrando `mesVencimento !== 12` ou `diaVencimento !== 20`.

### Pitfall 4: Reordenar blocos e quebrar os testes de mock existentes
**What goes wrong:** `tests/geracao.idempotencia.test.ts` usa `mockResolvedValueOnce`/`mockResolvedValueOnce` ENCADEADOS, na ordem exata em que `tx.empresa.findMany` é chamado dentro de `executarGeracaoMensal`. Inserir o novo bloco DP-anual no MEIO da sequência de blocos (em vez de no final, ou reusando a query já feita) desloca a ordem dos mocks em TODOS os testes existentes, fazendo-os falhar mesmo sem nenhum bug real introduzido.
**Why it happens:** Os testes fazem asserção posicional (`toHaveBeenNthCalledWith(N, ...)`) sobre a ordem das chamadas `findMany`, não sobre o conteúdo lógico.
**How to avoid:** Adicionar o bloco DP-anual como o ÚLTIMO bloco da transação (após o Contábil anual), ou — preferencialmente — reusar a MESMA variável `empresasClt` já buscada para o bloco DP mensal, sem nenhuma chamada `findMany` adicional. Se reuso direto não for possível (ex.: a estrutura `select` precisa ser diferente), adicionar uma chamada NOVA ao final da sequência e atualizar cada teste existente com um `mockResolvedValueOnce([])` extra ao final da cadeia (mesmo padrão já usado quando o bloco Contábil anual foi adicionado em Plano 07-02, ver linhas 83-87 e 306-318 de `tests/geracao.idempotencia.test.ts`).
**Warning signs:** Testes de regressão de Fiscal/DP/Contábil (não relacionados a DP-09) começando a falhar após a integração do novo bloco.

## Code Examples

Ver Pattern 1 e Pattern 2 acima (Architecture Patterns) — código completo e pronto para adaptação, extraído por leitura direta de `src/lib/geracao-tarefas-contabil-anual.ts` e `src/modules/tarefas/geracao.ts` deste repositório.

### Migration do enum Prisma
```prisma
// Source: prisma/schema.prisma, enum TipoObrigacao (linha 36-56)
enum TipoObrigacao {
  ICMS
  PIS_COFINS
  SPED_FISCAL
  SPED_CONTRIBUICOES
  DAS
  FOLHA
  ESOCIAL
  FGTS
  INSS
  EXTRATO_BANCARIO
  LANCAMENTO_EXTRATOS
  FOLHA_CONTABIL
  FISCAL_CONTABIL
  BAIXA_IMPOSTOS
  PERDCOMP
  FORNECEDORES_CLIENTES
  BALANCO
  ECD
  ECF
  DEFIS
  DECIMO_TERCEIRO  // NOVO — DP-09
}
```
Aplicar via `npx prisma db push` (mesmo padrão das fases anteriores, ambiente Neon sem shadow database — STATE.md Phase 02-01), seguido de `npx prisma generate` antes de qualquer `tsc --noEmit` (STATE.md Phase 05-04).

### Atualização do mapa de setor
```typescript
// Source: src/lib/tipo-obrigacao-setor.ts, TIPOS_OBRIGACAO_POR_SETOR
export const TIPOS_OBRIGACAO_POR_SETOR: Record<Setor, TipoObrigacao[]> = {
  FISCAL: ["ICMS", "PIS_COFINS", "SPED_FISCAL", "SPED_CONTRIBUICOES", "DAS"],
  DP: ["FOLHA", "ESOCIAL", "FGTS", "INSS", "DECIMO_TERCEIRO"], // NOVO
  CONTABIL: [ /* ... 11 valores, inalterado ... */ ],
};
```
A soma total esperada no teste de completude passa de 20 para 21; a contagem de DP passa de 4 para 5 — atualizar as expectativas explícitas em `tests/tipo-obrigacao-setor.test.ts` (`expect(somaTotal).toBe(20)` → `21`, `expect(recorrentesClause.tipoObrigacao.in).toHaveLength(4)` → `5` no bloco DP).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A | N/A | — | Nenhuma mudança de "estado da arte" externo — esta fase é puramente de composição interna de padrões já estabelecidos no próprio repositório (Fases 6 e 7) |

**Deprecated/outdated:** Nenhum.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | O bloco DP-anual pode reusar a mesma query `empresasClt` já feita para o bloco DP mensal, sem round-trip extra ao banco | Pattern 2 / Don't Hand-Roll | Baixo — se o `select` precisar de um shape diferente, basta fazer uma query nova ao final da sequência (mesmo padrão dos blocos Contábil); não bloqueia a fase, só adiciona 1 round-trip |
| A2 | O dedup entre `semResponsavelDp` (bloco mensal) e `semResponsavelDpAnual` (bloco novo) deve seguir o mesmo padrão Map-by-empresaId do Pitfall 4 já usado entre os blocos Contábil mensal/anual | Pattern 2 | Baixo — se não deduplicado, o pior caso é uma empresa aparecer 2x na lista de "sem responsável", um problema cosmético de relatório, não de correção funcional |

**Se esta tabela estiver vazia:** não está — as duas entradas acima são de baixo risco e não bloqueiam o planejamento; nenhuma claim de domínio fiscal/trabalhista foi assumida sem verificação (D-01/D-02/D-03/D-04 já vieram travados do CONTEXT.md, verificados contra o código real desta sessão).

## Open Questions

Nenhuma pergunta aberta relevante — as duas questões arquiteturais explicitamente deferidas pelo CONTEXT.md (D-02 sobre `vencimentoMesmoAno` e a localização do novo catálogo) foram resolvidas nesta pesquisa por leitura direta do código-fonte real (ver Summary e Pattern 1).

## Environment Availability

Não aplicável — esta fase não introduz nenhuma dependência externa nova (sem CLI, sem serviço, sem runtime adicional). Todas as dependências (`date-fns`, `date-holidays`, Prisma, PostgreSQL via Neon) já estão em uso e disponíveis desde fases anteriores.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest [VERIFIED: tests/*.test.ts existentes usam `describe`/`it`/`expect` de `vitest`] |
| Config file | `vitest.config.ts` (raiz do projeto, já configurado desde Fase 1) |
| Quick run command | `npx vitest run tests/geracao-tarefas-dp-anual.test.ts tests/tipo-obrigacao-setor.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DP-09 (success criterion 1) | Empresa CLT recebe exatamente 1 tarefa de 13º por ano, sem duplicar em execuções repetidas | unit + sweep 12 meses | `npx vitest run tests/geracao-tarefas-dp-anual.test.ts` | ❌ Wave 0 — criar seguindo o padrão de `tests/geracao-tarefas-contabil-anual.test.ts` |
| DP-09 (success criterion 2) | Empresa sem `temFuncionariosClt` nunca recebe a tarefa | unit | `npx vitest run tests/geracao-tarefas-dp-anual.test.ts` | ❌ Wave 0 — mesmo arquivo acima |
| DP-09 (success criterion 3) | Prazo (20/dez) ajustado para dia útil anterior quando cai em fim de semana/feriado | unit | `npx vitest run tests/geracao-tarefas-dp-anual.test.ts` | ❌ Wave 0 — testar `calcularPrazoDpAnual` com data conhecida de fim de semana/feriado em dezembro (verificar calendário 2026/2027 real) |
| DP-09 (success criterion 4) | Tarefa aparece nas listas/dashboards de DP do responsável correto | integration | `npx vitest run tests/tipo-obrigacao-setor.test.ts tests/geracao.idempotencia.test.ts` | ⚠️ Parcial — `tipo-obrigacao-setor.test.ts` existe mas precisa de atualização de contagem (20→21); `geracao.idempotencia.test.ts` precisa de um novo `it()` cobrindo o bloco DP-anual |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/geracao-tarefas-dp-anual.test.ts` (ou o arquivo de teste tocado pela task)
- **Per wave merge:** `npx vitest run` (suite completa — crítico para pegar a quebra do teste de completude de `tipo-obrigacao-setor.test.ts` e qualquer deslocamento posicional de mock em `geracao.idempotencia.test.ts`, ver Pitfall 4)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/geracao-tarefas-dp-anual.test.ts` — cobre o catálogo novo, sweep de 12 meses (1 disparo de DECIMO_TERCEIRO em novembro, 0 em todos os outros meses), `calcularPrazoDpAnual` com dia útil normal e com ajuste de fim de semana/feriado real (verificar 20/dez/2026 = domingo; 20/dez/2026 antecipado para sexta 18/dez/2026 — ou outra data, validar com `date-holidays` em tempo de implementação, não assumir aqui)
- [ ] Atualizar `tests/tipo-obrigacao-setor.test.ts` — contagem DP de 4→5, soma total 20→21, `arrayContaining` do bloco DP incluindo `"DECIMO_TERCEIRO"`
- [ ] Atualizar `tests/geracao.idempotencia.test.ts` — novo `it()` cobrindo o bloco DP-anual (idempotência entre 2 execuções da mesma competência "2026-11") + ajuste posicional de mocks nos testes existentes se o novo bloco inserir uma chamada `findMany` extra antes do final da sequência (ver Pitfall 4)
- [ ] Framework install: nenhum — Vitest já configurado e em uso

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | não | Esta fase não toca rotas/autenticação — o cron já roda sem usuário autenticado (D-09 do Plano 03-02, documentado em STATE.md), padrão inalterado |
| V3 Session Management | não | Idem |
| V4 Access Control | sim | Visibilidade da tarefa criada por DP-09 deve respeitar `withTarefaScope`/`tarefaSetorWhere` já existentes — nenhum controle de acesso NOVO é necessário, mas o registro correto no mapa `TIPOS_OBRIGACAO_POR_SETOR` é o que garante que o controle de acesso existente funcione (ver Pitfall 2) |
| V5 Input Validation | sim | `competenciaSchema` (reuso direto) valida o formato da competência mensal recebida antes de derivar a competência anual — mesmo padrão já aplicado a todos os catálogos existentes |
| V6 Cryptography | não | Não aplicável — sem dados sensíveis novos, sem segredo novo |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tarefa de 13º vazando para o setor errado (visível para responsável FISCAL/CONTABIL em vez de DP) | Information Disclosure | Garantir `DECIMO_TERCEIRO` registrado em `TIPOS_OBRIGACAO_POR_SETOR.DP` (Pitfall 2) — o teste de completude já existente é a mitigação automática |
| Duplicação de tarefa de 13º em re-execuções do cron no mesmo ano | Repudiation (perda de rastreabilidade / ruído operacional) | `@@unique([empresaId, tipoObrigacao, competencia])` + `skipDuplicates: true` — mesmo mecanismo já validado para ECD/ECF/DEFIS, sem necessidade de controle adicional |
| IDOR sobre a tarefa de 13º (responsável de outra empresa acessando) | Tampering / Information Disclosure | Já coberto pelos controles de acesso genéricos de `Tarefa` (`withTarefaScope`) estabelecidos desde a Fase 2 — nenhuma exceção nova introduzida por DP-09 |

## Sources

### Primary (HIGH confidence)
- `src/lib/geracao-tarefas-contabil-anual.ts` (leitura direta do código-fonte, repositório atual) — confirma hardcode de `anoVencimento = anoAtual + 1` e o comentário "Pitfall 2"
- `src/lib/geracao-tarefas-dp.ts` (leitura direta) — confirma padrão flat de catálogo DP sem filtro por regime tributário
- `src/modules/tarefas/geracao.ts` (leitura direta, linhas 1-284) — confirma estrutura exata da transação, ordem dos blocos, padrão skip+list
- `prisma/schema.prisma` (leitura direta) — confirma enum `TipoObrigacao` atual (20 valores), `@@unique([empresaId, tipoObrigacao, competencia])`, enum `Setor`
- `src/lib/tipo-obrigacao-setor.ts` + `tests/tipo-obrigacao-setor.test.ts` (leitura direta) — confirma mapa de setor e teste de completude que vai falhar se `DECIMO_TERCEIRO` não for registrado
- `src/lib/dia-util.ts`, `src/lib/competencia.ts` (leitura direta) — confirma assinatura exata de `anticiparParaDiaUtil`, `competenciaSchema`, `competenciaAnualSchema`
- `tests/geracao-tarefas-contabil-anual.test.ts`, `tests/geracao.idempotencia.test.ts` (leitura direta) — confirma padrão de teste sweep de 12 meses e estrutura de mocks encadeados que deve ser preservada
- `package.json` (leitura direta via `node -e`) — confirma `date-fns@^4.4.0`, `date-holidays@^3.30.2` já instalados

### Secondary (MEDIUM confidence)
Nenhuma — toda a pesquisa desta fase foi feita por leitura direta do código-fonte do próprio repositório (fonte primária/autoritativa para decisões de arquitetura interna), sem necessidade de busca externa (sem biblioteca nova, sem API externa).

### Tertiary (LOW confidence)
Nenhuma.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — nenhuma dependência nova, todas já verificadas em uso real no repositório
- Architecture: HIGH — padrão extraído diretamente do código-fonte de duas fases anteriores já em produção (Fase 6 DP, Fase 7 Contábil anual), com os dois pontos de divergência (D-02, localização do código) resolvidos por inspeção direta do comportamento atual
- Pitfalls: HIGH — Pitfall 1, 3 derivados diretamente de comentários/invariantes já documentados no código-fonte; Pitfall 2 descoberto nesta sessão por leitura do mapa `tipo-obrigacao-setor.ts` e seu teste de completude (não mencionado no CONTEXT.md); Pitfall 4 derivado da inspeção da estrutura de mocks em `tests/geracao.idempotencia.test.ts`

**Research date:** 2026-06-25
**Valid until:** Estável — esta pesquisa não depende de nenhuma API externa nem versão de biblioteca sujeita a mudança; válida até a próxima refatoração do motor de geração mensal (`geracao.ts`) ou do mapa de setor.
