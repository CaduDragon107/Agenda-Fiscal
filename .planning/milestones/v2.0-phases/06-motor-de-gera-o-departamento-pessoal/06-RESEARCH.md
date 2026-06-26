# Phase 6: Motor de Geração — Departamento Pessoal - Research

**Researched:** 2026-06-24
**Domain:** Extensão do motor de geração mensal de tarefas (TASK-01) para um segundo eixo de obrigações (DP), gatilho `temFuncionariosClt` em vez de `regimeTributario`, contagem de dia útil "para frente" (5º dia útil), e leitura setor-aware via `EmpresaResponsavelSetor`
**Confidence:** HIGH — toda a pesquisa é leitura direta do código existente deste projeto (schema, motor de geração, dia-util, visibility-scope, actions) mais validação executável da lógica de "5º dia útil" contra `date-holidays`. Nenhum pacote novo é necessário nesta fase.

## Summary

Esta fase estende um motor de geração já maduro e testado (Fase 3) para um segundo "eixo" de obrigações que é ortogonal ao primeiro: hoje `gerarTarefasDoMes`/`executarGeracaoMensal` geram obrigações Fiscais (ICMS/PIS-COFINS/SPED/DAS) com base em `Empresa.regimeTributario` e leem `Empresa.responsavelId` (coluna legada) diretamente. A Fase 6 adiciona obrigações de DP (Folha de Pagamento, eSocial, FGTS, INSS) com base em `Empresa.temFuncionariosClt = true` e precisa ler o responsável de DP via a junction table `EmpresaResponsavelSetor` (`setor: "DP"`), que já existe no schema e já é populada/lida em outros módulos (`empresas/queries.ts`, `visibility-scope.ts`) desde a Fase 5 — mas **ainda não** é lida pelo motor de geração.

O catálogo de DP precisa de um arquivo **separado** (`geracao-tarefas-dp.ts`), não uma extensão do `CATALOGO_OBRIGACOES` existente, porque a chave de variação é diferente (DP não varia por regime tributário) e porque a regra de prazo da Folha de Pagamento ("5º dia útil do mês seguinte", contando dias úteis **para frente** a partir do dia 1) é estruturalmente diferente da regra existente ("dia-base fixo do calendário, antecipado para o dia útil anterior se cair em fim de semana/feriado"). As outras 3 obrigações de DP (eSocial dia 07, FGTS dia 15, INSS dia 15) seguem exatamente o padrão `diaBase` + `anticiparParaDiaUtil` já existente e reaproveitável sem mudança.

A decisão mais delicada da fase não é técnica, é de dado: hoje (D-01 do CONTEXT.md) **nenhuma** das ~empresas com `temFuncionariosClt = true` tem responsável de DP atribuído em `EmpresaResponsavelSetor`. Como `Tarefa.responsavelId` é `NOT NULL`, a geração de DP precisa pular essas empresas e **listar explicitamente** quais foram puladas (D-02) — funcionalidade que o motor de geração atual **não tem** (hoje ele simplesmente gera para todas as empresas ativas, porque toda empresa Fiscal sempre tem `responsavelId`). Isso exige estender o tipo de retorno de `executarGeracaoMensal` de `{ criadas, puladas }` para algo como `{ criadas, puladas, semResponsavel: { empresaId, nome }[] }`.

**Primary recommendation:** Criar `src/lib/geracao-tarefas-dp.ts` como catálogo irmão (não filho) de `geracao-tarefas.ts`, com uma função pura nova `calcularQuintoDiaUtil(competencia)` em `dia-util.ts` para a Folha de Pagamento, e estender `executarGeracaoMensal` para também ler `EmpresaResponsavelSetor` (setor DP) e empresas com `temFuncionariosClt=true`, retornando uma lista de empresas puladas por falta de responsável — mantendo a geração Fiscal existente **inalterada** (não migrar o loop Fiscal para a junction table nesta fase — ver Decisão Arquitetural abaixo).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Catálogo de obrigações DP (tipo, dia-base/regra) | Pure Calculation (`src/lib/`) | — | Mesma camada do catálogo Fiscal existente — função pura, sem I/O, testável sem mocks |
| Cálculo do 5º dia útil (Folha) | Pure Calculation (`src/lib/dia-util.ts`) | — | Mesma camada de `anticiparParaDiaUtil` — depende apenas de `date-holidays`, sem Prisma/sessão |
| Leitura de `EmpresaResponsavelSetor` (setor DP) para geração | API/Backend (`src/modules/tarefas/geracao.ts`) | Database/Storage | Orquestração transacional já mora aqui; leitura é uma query Prisma adicional na mesma transação existente |
| Lista de empresas puladas por falta de responsável DP | API/Backend (retorno de `executarGeracaoMensal`) | Browser/Client (toast/alerta na UI de `gerarTarefasDoMesAction`) | Cálculo acontece no backend (mesma função que já decide quem é pulado); exibição é responsabilidade da UI que já consome `AcaoGeracaoResult` |
| Tarefa avulsa de DP (`criarTarefa`) | API/Backend (`src/app/(app)/tarefas/actions.ts`) | — | Sem mudança — `withVisibilityScope`/`withTarefaScope` já são setor-aware (Fase 5); reuso direto |
| Persistência idempotente das novas tarefas | Database/Storage (constraint `@@unique`) | API/Backend (`createMany skipDuplicates`) | Mesmo mecanismo já usado pelo Fiscal — nenhuma mudança de schema alem dos novos enum members |

## Standard Stack

### Core

Nenhuma dependência nova. Esta fase reusa 100% do stack já instalado:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `date-fns` | 4.4.0 (já instalado, [VERIFIED: npm registry] — `npm view date-fns version` confirma 4.4.0 é a versão atual no registro) | `addMonths`, `lastDayOfMonth`, `setDate`, `subDays` — usados pelo catálogo Fiscal hoje; `geracao-tarefas-dp.ts` reusa as mesmas primitivas para os dia-base fixos (07, 15) | Já é a dependência usada pelo motor existente; manter consistência |
| `date-holidays` | 3.30.2 (já instalado, [VERIFIED: npm registry]) | Cálculo de feriados nacionais BR via `Holidays("BR")`, já encapsulado em `dia-util.ts` | Mesma instância singleton já usada por `anticiparParaDiaUtil` |
| `@prisma/client` / `prisma` | 6.19.3 (já instalado) | Acesso a `EmpresaResponsavelSetor`, `Empresa.temFuncionariosClt`, novos enum members de `TipoObrigacao` | Stack já fixado pelo projeto (ver CLAUDE.md — Prisma 6.x, não 7.x) |

### Supporting

Nenhuma biblioteca de suporte nova é necessária. A fase é puramente extensão de lógica de domínio sobre infraestrutura já madura.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Função pura `calcularQuintoDiaUtil` escrita à mão (loop dia-a-dia) | `date-fns` `addBusinessDays(date, 5)` | **Rejeitado.** `addBusinessDays` do date-fns 4.x conta apenas seg-sex, **sem conhecimento de feriados nacionais** (confirmado lendo `node_modules/date-fns/addBusinessDays.d.ts` — a documentação da própria função não menciona feriados). Usá-la geraria o "5º dia útil" errado em qualquer mês com feriado nos primeiros ~7 dias (ex.: Tiradentes 21/abr não afeta o início do mês, mas Ano Novo 1/jan afeta diretamente o cálculo de janeiro). A função pura já validada nesta pesquisa (ver Code Examples) combina `date-holidays` (feriados) com contagem dia-a-dia, replicando o padrão já usado em `anticiparParaDiaUtil` (mesma lib, direção oposta) |
| Catálogo DP em arquivo separado (`geracao-tarefas-dp.ts`) | Estender `CATALOGO_OBRIGACOES: Record<RegimeTributario, ObrigacaoRegra[]>` existente para incluir uma chave adicional | **Rejeitado.** DP não varia por `RegimeTributario` — forçar DP nessa estrutura duplicaria as mesmas 4 obrigações sob `LUCRO_REAL`, `LUCRO_PRESUMIDO` E `SIMPLES_NACIONAL` sem motivo semântico, e o ARCHITECTURE.md já documenta esse anti-padrão explicitamente (Anti-Pattern 3) |
| Loop Fiscal migrado para `EmpresaResponsavelSetor` nesta mesma fase | Deixar o loop Fiscal lendo `responsavelId` (forma legada) inalterado | Ver "Decisão Arquitetural: migrar ou não o loop Fiscal" abaixo — recomendação é **não migrar** nesta fase |

**Installation:** Nenhuma instalação necessária — todas as dependências já estão em `package.json`.

**Version verification:** `npm view date-fns version` → `4.4.0` (igual ao já fixado); `npm view date-holidays version` → `3.30.2` (igual ao já fixado). Nenhum upgrade necessário ou recomendado nesta fase.

## Package Legitimacy Audit

Não aplicável — nenhum pacote novo é instalado nesta fase. Todas as três dependências usadas (`date-fns`, `date-holidays`, `@prisma/client`) já estão instaladas e em uso produtivo desde fases anteriores deste mesmo projeto.

**Packages removidos por veredito [SLOP]:** nenhum.
**Packages flagged as suspeitos [SUS]:** nenhum.

## Architecture Patterns

### System Architecture Diagram

```
[node-cron boot hook / botão "Gerar tarefas" DONO]
         │
         ▼
executarGeracaoMensal(competencia)              ◄── ENTRY POINT ÚNICO (cron e manual)
         │
         ├─► 1. Congela snapshot do mês ANTERIOR (DesempenhoMensal) — INALTERADO
         │
         ├─► 2. Lê Empresa ativas com regimeTributario  ──► gerarTarefasDoMes()        [FISCAL, INALTERADO]
         │        (responsavelId legado, direto)              │
         │                                                     ▼
         │                                              TarefaParaCriar[] (Fiscal)
         │
         ├─► 3. Lê Empresa ativas com temFuncionariosClt=true        [NOVO — DP]
         │        + EmpresaResponsavelSetor (setor="DP")
         │        ──► separa em:
         │              (a) COM responsável DP → gerarTarefasDoMesDp()
         │              (b) SEM responsável DP → lista "semResponsavel" (D-02)
         │                   │
         │                   ▼
         │            TarefaParaCriar[] (DP, apenas empresas com responsável)
         │
         ├─► 4. Merge: [...tarefasFiscal, ...tarefasDp]
         │
         ├─► 5. tx.tarefa.createMany({ data: merged, skipDuplicates: true })
         │        (mesma constraint @@unique([empresaId, tipoObrigacao, competencia]),
         │         apenas com novos TipoObrigacao: FOLHA, ESOCIAL, FGTS, INSS)
         │
         └─► 6. Retorna { criadas, puladas, semResponsavelDp: [...] }   [TIPO ESTENDIDO]
                                                     │
                                                     ▼
                                    UI (gerarTarefasDoMesAction) exibe resumo,
                                    incluindo lista de empresas sem responsável DP
                                    para o DONO atribuir manualmente (D-02)
```

```
[criarTarefa() — tarefa avulsa de DP]                          ◄── SEM MUDANÇA NESTA FASE
         │
         ▼
withVisibilityScope(user) — já retorna empresas onde user é
responsável DP (setor="DP") se user.setor === "DP" (Fase 5)
         │
         ▼
COLABORADOR de DP só atribui a si mesmo; DONO atribui livremente
         │
         ▼
db.tarefa.create({ ...withTarefaScope já validado na Fase 5 })
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── geracao-tarefas.ts          # INALTERADO — catálogo Fiscal, NÃO migrar para setor-aware
│   ├── geracao-tarefas-dp.ts       # NOVO — catálogo DP (flat, gatilho temFuncionariosClt)
│   └── dia-util.ts                 # MODIFICADO — adiciona calcularQuintoDiaUtil()
├── modules/
│   └── tarefas/
│       ├── geracao.ts              # MODIFICADO — segundo loop DP + lista semResponsavel
│       └── schema.ts               # sem mudança esperada (TipoObrigacao é enum Prisma)
└── app/(app)/tarefas/
    └── actions.ts                  # MODIFICADO — AcaoGeracaoResult ganha campo semResponsavelDp
```

### Pattern 1: Catálogo DP como arquivo irmão, flat (sem chave de regime)

**What:** `geracao-tarefas-dp.ts` exporta um catálogo flat (`ObrigacaoRegraDp[]`), não um `Record<RegimeTributario, ...>` — porque toda empresa com `temFuncionariosClt=true` recebe as mesmas 4 obrigações, independente do regime tributário.

**When to use:** Sempre que o eixo de variação de um novo conjunto de obrigações for diferente do eixo já modelado (aqui: CLT sim/não, não regime tributário).

**Example:**
```typescript
// Source: padrão observado em src/lib/geracao-tarefas.ts (CATALOGO_OBRIGACOES),
// adaptado para chave flat em vez de Record<RegimeTributario, ...>
import { anticiparParaDiaUtil, calcularQuintoDiaUtil } from "./dia-util";

export type TipoObrigacaoDp = "FOLHA" | "ESOCIAL" | "FGTS" | "INSS";

type ObrigacaoRegraDp =
  | { tipo: "FOLHA"; regra: "QUINTO_DIA_UTIL" }
  | { tipo: TipoObrigacaoDp; regra: "DIA_BASE"; diaBase: number };

export const CATALOGO_OBRIGACOES_DP: ObrigacaoRegraDp[] = [
  { tipo: "FOLHA", regra: "QUINTO_DIA_UTIL" },
  { tipo: "ESOCIAL", regra: "DIA_BASE", diaBase: 7 },
  { tipo: "FGTS", regra: "DIA_BASE", diaBase: 15 },
  { tipo: "INSS", regra: "DIA_BASE", diaBase: 15 },
];

export function calcularPrazoDp(competencia: string, regra: ObrigacaoRegraDp): Date {
  if (regra.regra === "QUINTO_DIA_UTIL") {
    return calcularQuintoDiaUtil(competencia); // já é dia útil por construção, NÃO passa por anticiparParaDiaUtil
  }
  // DIA_BASE segue o MESMO padrão do catálogo Fiscal: dia fixo + antecipa se cair em feriado/fds
  const prazoBase = calcularPrazoBaseDiaFixo(competencia, regra.diaBase); // reaproveita lógica equivalente a calcularPrazoBase do Fiscal
  return anticiparParaDiaUtil(prazoBase);
}
```

**Nota crítica de implementação:** a Folha de Pagamento **não** passa por `anticiparParaDiaUtil` depois de calculada — o próprio algoritmo de contagem de dia útil já garante que o resultado É um dia útil (ele só avança quando o dia atual não é dia útil). Aplicar `anticiparParaDiaUtil` sobre o resultado seria redundante mas inofensivo (a função é idempotente — um dia já útil não muda). Ainda assim, **não compor as duas funções** deixa a intenção do código mais clara e evita um futuro mantenedor assumir que a Folha segue a regra "dia-base + antecipa".

### Pattern 2: Segundo loop dentro da mesma transação, não uma segunda chamada de `$transaction`

**What:** `executarGeracaoMensal` ganha um segundo bloco de leitura (empresas CLT + responsáveis DP) **dentro da mesma `db.$transaction`** já existente, não uma transação separada.

**When to use:** Sempre que duas fontes de tarefas (Fiscal, DP) precisam ser persistidas atomicamente junto com o mesmo snapshot mensal — split em duas transações quebraria a garantia "snapshot e geração sobem ou caem juntos" já documentada no código atual.

**Example:**
```typescript
// Source: extensão direta de src/modules/tarefas/geracao.ts, preservando a
// estrutura já existente (snapshot → leitura → geração → persistência)
export async function executarGeracaoMensal(
  competencia: string
): Promise<{ criadas: number; puladas: number; semResponsavelDp: { empresaId: string; nome: string }[] }> {
  return db.$transaction(async (tx) => {
    // ... snapshot do mes anterior, INALTERADO ...

    // Loop Fiscal — INALTERADO, lê responsavelId legado direto
    const empresasFiscal = await tx.empresa.findMany({
      where: { ativo: true },
      select: { id: true, regimeTributario: true, responsavelId: true },
    });
    const tarefasFiscal = gerarTarefasDoMes(empresasFiscal, competencia);

    // Loop DP — NOVO, lê temFuncionariosClt + junction table setor=DP
    const empresasClt = await tx.empresa.findMany({
      where: { ativo: true, temFuncionariosClt: true },
      select: {
        id: true,
        nome: true,
        responsaveisPorSetor: {
          where: { setor: "DP" },
          select: { usuarioId: true },
        },
      },
    });

    const comResponsavelDp = empresasClt.filter((e) => e.responsaveisPorSetor.length > 0);
    const semResponsavelDp = empresasClt
      .filter((e) => e.responsaveisPorSetor.length === 0)
      .map((e) => ({ empresaId: e.id, nome: e.nome })); // D-02

    const tarefasDp = gerarTarefasDoMesDp(
      comResponsavelDp.map((e) => ({
        id: e.id,
        responsavelId: e.responsaveisPorSetor[0].usuarioId,
      })),
      competencia
    );

    const tarefas = [...tarefasFiscal, ...tarefasDp];
    if (tarefas.length === 0) {
      return { criadas: 0, puladas: 0, semResponsavelDp };
    }

    const resultado = await tx.tarefa.createMany({
      data: tarefas.map((t) => ({ ...t, status: "PENDENTE" as const })),
      skipDuplicates: true,
    });

    return {
      criadas: resultado.count,
      puladas: tarefas.length - resultado.count,
      semResponsavelDp,
    };
  });
}
```

### Anti-Patterns to Avoid

- **Migrar o loop Fiscal para a junction table nesta fase "enquanto já está tocando no arquivo":** o CONTEXT.md (Integration Points) deixa essa decisão explicitamente aberta para research/planner. A recomendação desta pesquisa é **NÃO migrar** — ver seção dedicada abaixo. Misturar "adicionar DP" com "migrar Fiscal" na mesma fase aumenta o raio de explosão de uma regressão sem necessidade (Fiscal já funciona, lendo a coluna legada verificada 197/197 na Fase 5).
- **Aplicar `anticiparParaDiaUtil` sobre o resultado de `calcularQuintoDiaUtil`:** redundante e confuso — o resultado já é garantidamente um dia útil por construção do algoritmo de contagem.
- **Usar `date-fns addBusinessDays` para a Folha:** ignora feriados nacionais — ver Alternatives Considered.
- **Generalizar `CATALOGO_OBRIGACOES` (Fiscal) para incluir DP via uma chave extra:** anti-padrão já documentado em ARCHITECTURE.md (Anti-Pattern 3) — DP não varia por regime, forçá-lo nessa estrutura duplica dados sem motivo.
- **Bloquear a transação inteira se UMA empresa CLT não tiver responsável DP:** D-03 do CONTEXT.md exige que o "pular e listar" seja por empresa, nunca global — outras empresas (Fiscal ou DP já atribuído) devem gerar normalmente mesmo que haja empresas puladas.

## Decisão Arquitetural: migrar ou não o loop Fiscal para `EmpresaResponsavelSetor` nesta fase

O CONTEXT.md (Integration Points) registra isso como uma pergunta aberta para a pesquisa/planner decidir. Análise:

**Recomendação: NÃO migrar o loop Fiscal nesta fase.** Razões:

1. **Equivalência de dados já comprovada e em vigor:** a coluna legada `Empresa.responsavelId` é mantida em lockstep com a linha FISCAL do junction table desde a Fase 5 (`criarEmpresa`/`editarEmpresa` escrevem ambos atomicamente, `upsertResponsaveisPorSetor`). As duas fontes são idênticas em dado *hoje*, então migrar o loop Fiscal não corrige nenhum bug nem destrava nenhuma funcionalidade desta fase — é puro reposicionamento de leitura sem ganho funcional imediato.
2. **Minimiza raio de explosão:** o motor Fiscal já passa por testes de idempotência (`tests/geracao.idempotencia.test.ts`) e roda em produção. Trocar sua fonte de leitura é uma mudança de risco não-zero (mesmo que teoricamente equivalente) que não é exigida por nenhum requisito DP-01 a DP-05. Misturar essa migração com a entrega de DP dificulta isolar a causa se algo quebrar.
3. **`Empresa.importar` (wizard) ainda não grava `EmpresaResponsavelSetor`** — já documentado como blocker conhecido em `.planning/STATE.md` ("Phase 6 NOVO" entry sobre `confirmarImportacao`). Se o loop Fiscal migrasse para a junction table agora, qualquer empresa importada pelo wizard ficaria **sem nenhuma tarefa Fiscal gerada** (regressão real), porque o wizard não cria a linha FISCAL do junction. Migrar o loop Fiscal exigiria primeiro corrigir o wizard de importação — fora do escopo desta fase (DP-01 a DP-05).
4. **O ganho da migração (eliminar a coluna legada) é adiável sem custo:** ARCHITECTURE.md já recomenda manter `responsavelId` por "1 ciclo de release" como rede de segurança (Pitfall B1) — essa fase pode ser esse próprio ciclo, sem necessidade de já remover a leitura legada.

**Quando migrar:** uma fase futura dedicada (possivelmente junto com a correção do wizard de importação mencionada no STATE.md), não esta. Documentar esta decisão explicitamente no plano para que o planner não tente "aproveitar" a oportunidade.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Contagem de dias úteis "para frente" (5º dia útil) | Uma segunda biblioteca de feriados, ou hardcode de datas | Combinar `date-holidays` (já instalado, mesma instância singleton de `dia-util.ts`) com um loop de contagem dia-a-dia, mesmo padrão estrutural de `anticiparParaDiaUtil` mas na direção oposta (avançar, não retroceder) | Reaproveita a mesma fonte de feriados já validada nesta codebase (Carnaval, Sexta-feira Santa, Corpus Christi calculados dinamicamente via algoritmo de Páscoa embutido no `date-holidays`) — duas fontes de feriados divergentes seria um bug latente |
| Detecção de "empresa sem responsável de qualquer setor" | Query ad-hoc espalhada em múltiplos lugares | Mesmo padrão de filtro já estabelecido na Fase 5 para a UI ("sem responsável" badge/filtro, D-03 da Fase 5) — aqui replicado no motor de geração como um `filter()` em memória sobre o resultado de uma única query `findMany` com `include`/`where` em `responsaveisPorSetor` | Evita duas implementações divergentes da mesma noção de "sem responsável" (uma na tela de empresas, outra no motor) |
| Validação de idempotência para os novos tipos de obrigação | Checagem de aplicação antes do insert (`findFirst` + `if not exists`) | A mesma constraint `@@unique([empresaId, tipoObrigacao, competencia])` + `createMany({ skipDuplicates: true })` já em uso — basta adicionar os 4 novos enum values a `TipoObrigacao` | O design já documentado (D-10 do código) é deliberadamente anti-TOCTOU; replicar checagem de aplicação reintroduziria a race condition que o design atual evita |

**Key insight:** Esta fase não introduz nenhum problema novo de engenharia — é 100% composição de padrões já existentes e validados nesta mesma codebase (catálogo separado por eixo de variação, idempotência via constraint, dia-útil via `date-holidays`). O único código genuinamente novo é a função de contagem "para frente" de dia útil, que é uma inversão trivial de `anticiparParaDiaUtil`.

## Common Pitfalls

### Pitfall 1: Aplicar a regra de dia-base errada à Folha de Pagamento

**What goes wrong:** Implementar a Folha de Pagamento reaproveitando `calcularPrazoBase(competencia, diaBase)` + `anticiparParaDiaUtil` com algum `diaBase` "estimado" (ex.: diaBase=5, supondo que o 5º dia do calendário aproxima o 5º dia útil) — isso produz a data errada em qualquer mês onde os primeiros dias incluem fim de semana ou feriado, que é a maioria dos meses.

**Why it happens:** O padrão "dia-base + antecipa para dia útil anterior" é tão dominante no catálogo Fiscal existente (4 de 4 obrigações o usam) que é a primeira ideia que vem à mente para qualquer nova obrigação, mesmo quando a regra de negócio real ("5º dia útil") é estruturalmente diferente (conta dias úteis, não dias de calendário).

**How to avoid:** Implementar e testar `calcularQuintoDiaUtil` isoladamente (função pura, sem depender do resto do catálogo), com casos de teste explícitos cobrindo: (a) um mês cujo dia 1 é fim de semana, (b) um mês cujo dia 1-5 inclui um feriado nacional (ex.: janeiro, por causa do Ano Novo cair perto do início), (c) ao menos 2 anos diferentes para garantir que feriados móveis não quebrem o cálculo no ano seguinte (mesmo princípio do Pitfall 3 do v1.0 — calendário hardcoded de 1 ano só).

**Warning signs:** O prazo gerado da Folha de Pagamento cai em sábado/domingo/feriado (sinal de que a regra de antecipação foi aplicada sobre um dia-base aproximado, em vez de uma contagem real de dias úteis).

### Pitfall 2: Esquecer de filtrar `responsaveisPorSetor` por `setor: "DP"` na query de leitura

**What goes wrong:** A query Prisma para ler o responsável DP de uma empresa esquece o `where: { setor: "DP" }` dentro do `include`/`select` de `responsaveisPorSetor`, retornando potencialmente 3 linhas (FISCAL, DP, CONTABIL) em vez de no máximo 1 — o código que assume `responsaveisPorSetor[0]` pegaria o responsável **errado** (ex.: o Fiscal, se vier primeiro) para a tarefa de DP.

**Why it happens:** `EmpresaResponsavelSetor` é uma relação 1-para-N a partir de `Empresa` (até 3 linhas, uma por setor) — é fácil esquecer o filtro de setor ao escrever a query, especialmente copiando o padrão de `EMPRESA_SELECT` em `empresas/queries.ts` (que intencionalmente retorna TODAS as linhas para a UI escolher qual mostrar) sem adaptar para o caso de uso do motor de geração, que precisa de exatamente uma.

**How to avoid:** Sempre usar `where: { setor: "DP" }` dentro do `select`/`include` de `responsaveisPorSetor` na query do motor de geração (ver Pattern 2 acima) — nunca confiar em `[0]` sobre uma relação não filtrada. Escrever um teste explícito com uma empresa que tem responsável FISCAL **e** DP simultaneamente, garantindo que a tarefa de DP usa o `usuarioId` da linha DP, não da FISCAL.

**Warning signs:** Tarefas de DP aparecem atribuídas a um colaborador que claramente é Fiscal (ex.: Caio/Jessica/Heitor/Felipe, os nomes reais do Fiscal pós-renomeação) em vez de DP1-4/Lauany/Lorraine/Mirela/Andre.

### Pitfall 3: Tratar "empresa sem responsável DP" como erro fatal em vez de skip silencioso + relatório

**What goes wrong:** Implementar a leitura de empresas CLT sem responsável DP como um `throw`/erro que aborta toda a transação, em vez de simplesmente omitir essas empresas do array de tarefas a criar — isso bloquearia a geração de TODAS as obrigações (incluindo Fiscal, que não depende de DP) sempre que houver ao menos uma empresa CLT sem responsável atribuído, o que — por D-01 — é **hoje, no momento desta pesquisa, 100% das empresas CLT**. Isso significaria que a geração mensal inteira do sistema falharia até o dono atribuir manualmente todos os responsáveis de DP.

**Why it happens:** A tentação de "validar e falhar rápido" é um instinto defensivo razoável em outros contextos, mas aqui o requisito explícito (D-03) é o oposto: "pular e listar" por empresa, nunca abortar globalmente.

**How to avoid:** A lógica de filtro (`comResponsavelDp` vs `semResponsavelDp`) deve ser um simples `Array.filter()`/`partition` em memória, nunca um `throw`. O array `semResponsavelDp` é dado de retorno informativo, não uma condição de erro. Testar explicitamente: rodar `executarGeracaoMensal` com 100% das empresas CLT sem responsável DP e verificar que (a) nenhuma tarefa de DP é criada, (b) `semResponsavelDp` lista todas elas, (c) as tarefas Fiscais são criadas normalmente, sem erro.

**Warning signs:** A geração mensal (incluindo Fiscal) para de funcionar completamente depois que `temFuncionariosClt` é ativado em qualquer empresa sem responsável DP atribuído.

### Pitfall 4: Quebrar a assinatura de retorno de `executarGeracaoMensal` sem atualizar todos os chamadores

**What goes wrong:** Adicionar o campo `semResponsavelDp` ao retorno de `executarGeracaoMensal` sem propagar a mudança de tipo para `AcaoGeracaoResult` (em `src/app/(app)/tarefas/actions.ts`) e para o componente de UI que exibe o resumo da geração (`GerarTarefasButton` ou equivalente) — o campo fica calculado no backend mas nunca chega à tela do dono, que é exatamente o requisito D-02.

**Why it happens:** `executarGeracaoMensal` e `AcaoGeracaoResult` são definidos em arquivos diferentes (`modules/tarefas/geracao.ts` vs `app/(app)/tarefas/actions.ts`) — é fácil atualizar um e esquecer o outro, especialmente porque o TypeScript não vai dar erro de compilação se o campo novo simplesmente não for repassado (é um campo extra sendo descartado, não um campo faltante).

**How to avoid:** Ao estender o tipo de retorno do motor de geração, grep explicitamente por todos os usos de `executarGeracaoMensal(` no código (hoje: `gerarTarefasDoMesAction` em `actions.ts`, e os testes em `tests/geracao.idempotencia.test.ts`/`tests/geracao.actions.test.ts`) e confirmar que o novo campo é propagado ponta a ponta até a UI. Escrever (ou estender) um teste de integração que verifica que `gerarTarefasDoMesAction()` retorna `semResponsavelDp` no resultado, não apenas `executarGeracaoMensal` isoladamente.

**Warning signs:** O dono reclama que "sei que tem empresa sem responsável DP mas não vejo essa informação em lugar nenhum depois de gerar as tarefas."

## Code Examples

### Função pura: calcularQuintoDiaUtil (5º dia útil do mês seguinte)

```typescript
// Source: validado nesta pesquisa via execução direta com date-holidays 3.30.2
// (ver verificação executável abaixo) — adicionar a src/lib/dia-util.ts,
// ao lado de anticiparParaDiaUtil, reaproveitando a MESMA instância `hd` e a
// MESMA função interna isDiaUtil já existentes no arquivo (não duplicar).
import { addMonths } from "date-fns";

/**
 * Retorna o 5º dia útil do mês SEGUINTE ao da competência recebida,
 * contando dias úteis PARA FRENTE a partir do dia 1 desse mês (nunca
 * "antecipa" — o resultado JÁ é um dia útil por construção do algoritmo).
 *
 * Diferente de anticiparParaDiaUtil (retrocede a partir de um dia-base
 * fixo): aqui não há dia-base de calendário — a contagem em si É a regra.
 */
export function calcularQuintoDiaUtil(competencia: string): Date {
  const [ano, mes] = competencia.split("-").map(Number);
  const mesVencimento = addMonths(new Date(ano, mes - 1, 1), 1);

  let atual = mesVencimento;
  let contador = 0;
  while (contador < 5) {
    if (isDiaUtil(atual)) {
      contador++;
      if (contador === 5) break;
    }
    atual = addDays(atual, 1); // date-fns addDays, não setDate manual
  }
  return atual;
}
```

**Verificação executável feita nesta pesquisa** (Node + date-holidays 3.30.2 instalado neste projeto):
- 5º dia útil de Julho/2026 (mês seguinte a Junho/2026): **terça-feira, 07/07/2026** [VERIFIED: execução local contra date-holidays instalado]
- 5º dia útil de Janeiro/2027 (mês seguinte a Dezembro/2026, atravessando virada de ano): **sexta-feira, 08/01/2027** [VERIFIED: execução local — confirma que feriados de Ano Novo são corretamente contados como dia não-útil, empurrando o 5º dia útil para depois do esperado em um cálculo puramente de calendário]

### Padrão de teste de idempotência estendido (mirror do existente)

```typescript
// Source: padrão direto de tests/geracao.idempotencia.test.ts, estendido
// para cobrir o segundo loop (DP) e a lista semResponsavelDp
it("empresa CLT sem responsável DP é pulada e listada, sem bloquear geração Fiscal", async () => {
  const empresasFiscal = [
    { id: "e1", regimeTributario: "SIMPLES_NACIONAL", responsavelId: "u1" },
  ];
  const empresasClt = [
    { id: "e2", nome: "Empresa CLT sem DP", responsaveisPorSetor: [] }, // sem responsável DP
  ];
  empresaFindManyMock
    .mockResolvedValueOnce(empresasFiscal) // 1ª chamada: loop Fiscal
    .mockResolvedValueOnce(empresasClt);   // 2ª chamada: loop DP

  createManyMock.mockResolvedValue({ count: 1 }); // só a tarefa Fiscal é criada

  const resultado = await executarGeracaoMensal("2026-07");

  expect(resultado.criadas).toBe(1); // só Fiscal
  expect(resultado.semResponsavelDp).toEqual([{ empresaId: "e2", nome: "Empresa CLT sem DP" }]);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Motor de geração lê só `regimeTributario`, um único catálogo, um único `responsavelId` legado | Motor de geração precisa ler dois gatilhos ortogonais (`regimeTributario` para Fiscal, `temFuncionariosClt` para DP) e duas fontes de responsável (coluna legada para Fiscal, junction table para DP) | Esta fase (Phase 6) | `executarGeracaoMensal` ganha um segundo loop e um tipo de retorno estendido; nenhuma mudança no loop Fiscal existente |
| `TipoObrigacao` enum só tem valores Fiscais | `TipoObrigacao` ganha `FOLHA`, `ESOCIAL`, `FGTS`, `INSS` (D-06: granular, um enum por obrigação, mesmo padrão de ICMS/PIS_COFINS/SPED separados) | Esta fase | Migração de schema aditiva (`npx prisma db push`), sem impacto em dados existentes — mesma constraint `@@unique` cobre os novos valores automaticamente |

**Deprecated/outdated:** Nenhum. Esta fase é puramente aditiva sobre uma arquitetura já estabelecida (Fases 3 e 5).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | "Fechamento de Guias (FGTS+INSS)" deve ser modelado como dois `TipoObrigacao` distintos (`FGTS`, `INSS`), não um único tipo combinado — conforme D-06, marcado como "Claude's Discretion" no CONTEXT.md, e esta pesquisa adota a recomendação já registrada lá (granularidade consistente com ICMS/PIS_COFINS/SPED_FISCAL/SPED_CONTRIBUICOES já separados) | Catálogo de obrigações DP, enum `TipoObrigacao` | Baixo — é uma decisão de discrição explícita do CONTEXT.md, não uma suposição não confirmada; o planner pode confirmar com o usuário se quiser, mas não bloqueia o planejamento |
| A2 | eSocial é representado como uma única tarefa mensal "Fechamento eSocial" por empresa, sem detalhamento por tipo de evento (S-1200/S-1210), conforme D-05 explícito do CONTEXT.md | Catálogo de obrigações DP | Nenhum — é decisão de usuário já registrada, não suposição |
| A3 | `addBusinessDays` do date-fns 4.x NÃO considera feriados nacionais (apenas seg-sex) — confirmado lendo a declaração de tipos/documentação embutida do pacote instalado, não apenas treinamento | Alternatives Considered, Pitfall 1 | Baixo — confirmado via leitura direta do arquivo `.d.ts` instalado neste projeto, não apenas conhecimento de treinamento; mas vale o planner/implementador reconfirmar visualmente ao escrever o código final, já que comportamento de bibliotecas pode variar entre versões menores |

**Risco geral:** todas as claims técnicas centrais desta pesquisa (estrutura do catálogo, padrão de idempotência, leitura de `EmpresaResponsavelSetor`, cálculo de 5º dia útil) foram verificadas por leitura direta de código existente neste projeto ou por execução local — não por suposição de treinamento. As únicas entradas em "Claude's Discretion" (D-06) já vêm com recomendação explícita do próprio CONTEXT.md, não introduzidas por esta pesquisa.

## Open Questions

1. **O wizard de importação (`confirmarImportacao`) ainda não grava `EmpresaResponsavelSetor` — isso afeta a geração de DP?**
   - What we know: o STATE.md já documenta esse gap como afetando o Fiscal (empresas importadas via wizard não recebem linha FISCAL no junction). Para DP, o impacto é estruturalmente idêntico mas com uma diferença: como hoje 100% das empresas CLT já estão sem responsável DP (D-01), uma empresa nova importada sem linha DP no junction simplesmente cai no mesmo bucket "sem responsável DP, pula e lista" — não é um caso especial, é o caso **comum** desta fase.
   - What's unclear: se o dono espera que a importação de uma nova empresa CLT dispare algum fluxo diferente de "sem responsável" do que uma empresa CLT já existente sem responsável.
   - Recommendation: não tratar como bloqueador desta fase — o comportamento "pula e lista" já cobre esse caso corretamente por construção. Mencionar no plano apenas como nota, não como tarefa adicional.

2. **A lista de "empresas puladas por falta de responsável DP" deve persistir entre execuções, ou é só o resultado da última chamada?**
   - What we know: D-02 exige que o relatório/resultado da execução LISTE as empresas puladas. O motor atual (`executarGeracaoMensal`) é stateless — retorna um resultado e não persiste histórico de execuções.
   - What's unclear: se "o dono atribuir manualmente" (D-02) precisa de uma tela persistente (ex.: a mesma listagem "sem responsável" já existente na tela de Empresas da Fase 5, D-03) ou se basta o resultado pontual da última geração aparecer como toast/alerta na hora de clicar "Gerar tarefas".
   - Recommendation: a pesquisa recomenda **reaproveitar a listagem "sem responsável" já existente na tela de Empresas (Fase 5, D-03)** como a fonte canônica e persistente dessa informação — o retorno de `executarGeracaoMensal`/`semResponsavelDp` serve apenas como confirmação imediata pós-clique ("X empresas foram puladas nesta execução, veja a lista de empresas sem responsável DP"), não como um registro histórico novo a ser construído. Isso evita duplicar a noção de "sem responsável" em dois lugares (Pitfall de drift, mesmo princípio do Pitfall B4 do PITFALLS.md). O planner deve confirmar se um link direto entre o resumo de geração e o filtro "sem responsável DP" da tela de Empresas é suficiente, ou se o usuário quer uma tela dedicada.

## Environment Availability

Não aplicável — esta fase não introduz nenhuma dependência de ambiente nova (sem serviços externos, sem CLIs novas, sem bancos adicionais). Toda a infraestrutura (Postgres/Neon, Node 20+, Prisma) já está em uso e funcionando desde fases anteriores.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 (já configurado) |
| Config file | nenhum arquivo `vitest.config.*` dedicado encontrado — usa defaults do Vitest com resolução de path `@/` via `tsconfig.json`/`vite-tsconfig-paths` implícito do Next.js |
| Quick run command | `npx vitest run tests/geracao-tarefas-dp.test.ts tests/dia-util.test.ts` (arquivos novos/modificados desta fase) |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| DP-01 | Geração mensal de Folha de Pagamento para empresa CLT, vencimento no 5º dia útil do mês seguinte | unit | `npx vitest run tests/dia-util.test.ts` (estender) e `tests/geracao-tarefas-dp.test.ts` (novo) | ❌ Wave 0 — criar `tests/geracao-tarefas-dp.test.ts`; estender `tests/dia-util.test.ts` existente com casos de `calcularQuintoDiaUtil` |
| DP-02 | Geração mensal de FGTS, dia-base 15, antecipa para dia útil anterior | unit | `npx vitest run tests/geracao-tarefas-dp.test.ts` | ❌ Wave 0 — mesmo arquivo acima |
| DP-03 | Geração mensal de INSS, dia-base 15, antecipa para dia útil anterior | unit | `npx vitest run tests/geracao-tarefas-dp.test.ts` | ❌ Wave 0 — mesmo arquivo acima |
| DP-04 | Geração mensal de "Fechamento eSocial", dia-base 07, antecipa para dia útil anterior | unit | `npx vitest run tests/geracao-tarefas-dp.test.ts` | ❌ Wave 0 — mesmo arquivo acima |
| DP-05 | Tarefa avulsa atribuível a colaboradores de DP (reuso de `criarTarefa`) | integration/regression | `npx vitest run tests/tarefas.idor.test.ts tests/tarefas.crud.test.ts` | ✅ já existe — apenas confirmar que a suite já cobre setor DP (Fase 5 já adicionou fixtures multi-setor); se não cobrir DP especificamente, estender com 1 fixture DP em vez de criar arquivo novo |
| (implícito D-01/D-02/D-03) | Empresa CLT sem responsável DP é pulada (não cria tarefa) e listada no retorno da geração, sem bloquear geração de outras empresas (Fiscal ou DP já atribuído) | unit/integration | `npx vitest run tests/geracao.idempotencia.test.ts` (estender) | ❌ Wave 0 — estender o arquivo existente com o caso "sem responsável DP" (ver Code Examples acima) |
| (implícito, idempotência) | Rodar a geração 2x na mesma competência não duplica tarefas de DP | integration | `npx vitest run tests/geracao.idempotencia.test.ts` | ❌ Wave 0 — estender o padrão já existente (que já cobre Fiscal) para também cobrir DP no mesmo teste ou em teste irmão |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/geracao-tarefas-dp.test.ts tests/dia-util.test.ts tests/geracao.idempotencia.test.ts`
- **Per wave merge:** `npm test` (suite completa — crítico para confirmar que a suite Fiscal/IDOR existente não regrediu, ver Pitfall B3 do PITFALLS.md)
- **Phase gate:** suite completa verde antes de `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/geracao-tarefas-dp.test.ts` — novo arquivo, cobre o catálogo DP puro (mirror de `tests/geracao-tarefas.test.ts`)
- [ ] `tests/dia-util.test.ts` — estender com casos de `calcularQuintoDiaUtil` (ao menos 2 anos diferentes, incluindo um caso de virada de ano/feriado de Ano Novo)
- [ ] `tests/geracao.idempotencia.test.ts` — estender com casos de DP: (a) geração normal com responsável DP atribuído, (b) empresa sem responsável DP pulada e listada, (c) segunda execução não duplica
- [ ] Nenhuma instalação de framework necessária — Vitest já configurado e em uso

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | não (sem mudança de auth nesta fase) | — |
| V3 Session Management | não | — |
| V4 Access Control | **sim** | `withVisibilityScope`/`withTarefaScope` (Fase 5, já setor-aware) — reuso direto, sem mudança nesta fase para a tarefa avulsa (DP-05); o motor de geração (`executarGeracaoMensal`) continua deliberadamente SEM escopo de autorização (cron não tem sessão), padrão já documentado e válido |
| V5 Input Validation | sim | `competenciaSchema` (zod, já existe) cobre a competência recebida pela action manual; nenhum novo input de usuário é introduzido por esta fase além do que já existe (a geração DP é automática, sem formulário novo) |
| V6 Cryptography | não | — |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Geração de tarefa de DP atribuída ao responsável Fiscal por engano (filtro de setor esquecido na query) | Tampering (integridade do dado, atribuição incorreta) | Filtrar explicitamente `responsaveisPorSetor` por `where: { setor: "DP" }` na query do motor — ver Pitfall 2 acima; teste de regressão dedicado |
| Geração mensal bloqueada globalmente por uma empresa sem responsável DP (negação de serviço auto-infligida) | Denial of Service (sobre o próprio sistema, não um atacante externo) | "Pular e listar" por empresa, nunca abortar a transação inteira — ver Pitfall 3 acima |
| Cron sem autenticação disparando geração de tarefas para qualquer setor | Spoofing/Elevation (já mitigado, documentado em PITFALLS.md Security Mistakes v2.0) | Invariante já documentado: `executarGeracaoMensal` é deliberadamente sem escopo de sessão por design (cron não tem usuário) — nenhuma mudança nesta fase; manter o comentário/teste que afirma esse invariante explicitamente ao estender a função |

## Sources

### Primary (HIGH confidence)
- Leitura direta do código deste projeto: `prisma/schema.prisma`, `src/lib/geracao-tarefas.ts`, `src/modules/tarefas/geracao.ts`, `src/lib/dia-util.ts`, `src/lib/visibility-scope.ts`, `src/modules/empresas/queries.ts`, `src/app/(app)/actions.ts`, `src/app/(app)/tarefas/actions.ts`, `src/app/(app)/empresas/derive-rows.ts`, `tests/geracao-tarefas.test.ts`, `tests/geracao.idempotencia.test.ts`, `package.json`
- `node_modules/date-fns/addBusinessDays.d.ts` (instalado, versão 4.4.0) — confirma que `addBusinessDays` não tem conhecimento de feriados nacionais
- Execução local de Node + `date-holidays` 3.30.2 (instalado neste projeto) — validou o algoritmo de "5º dia útil" contra dois anos diferentes (2026, 2027), incluindo virada de ano
- `npm view date-fns version` (4.4.0) e `npm view date-holidays version` (3.30.2) — confirmam que as versões já fixadas no `package.json` são as correntes no registro npm

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` (v2.0, 2026-06-22) — decisões arquiteturais multi-setor (catálogo separado por setor, Anti-Pattern 3, build order)
- `.planning/research/PITFALLS.md` (Part B, v2.0 addendum, 2026-06-22) — Pitfall B1 (backfill verificado) e B3 (extensão setor-aware sem regressão), diretamente aplicáveis a esta fase

### Tertiary (LOW confidence)
- Nenhuma fonte de baixa confiança usada nesta pesquisa — todo o domínio técnico é interno ao projeto e foi verificado por leitura de código ou execução, não por busca externa genérica.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhuma dependência nova, versões já fixadas confirmadas correntes no registro npm
- Architecture: HIGH — padrão de extensão (catálogo irmão, segundo loop na mesma transação) é direto de ARCHITECTURE.md (já pesquisado e validado na Fase 5) e da leitura do código atual
- Pitfalls: HIGH — pitfalls 1-4 derivados de inspeção direta do código existente e de decisões explícitas do CONTEXT.md (D-01 a D-03), não de generalização externa

**Research date:** 2026-06-24
**Valid until:** 30 dias (domínio estável — sem dependência de calendário fiscal que mude rapidamente; revisitar apenas se o schema ou o motor de geração sofrerem mudança estrutural antes da execução desta fase)
