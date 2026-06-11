# Architecture Research

**Domain:** Internal task/deadline management web app for an accounting office (multiusuário, geração recorrente de tarefas, dashboards)
**Researched:** 2026-06-11
**Confidence:** HIGH (these are foundational, stack-agnostic patterns — modular monolith, RBAC, template-driven recurring task generation, business-day calculation — all well-established and stable across years of practice)

## Standard Architecture

### System Overview

For a system at this scale (5 users, ~110 client companies, internet-accessible, single organization), the right shape is a **modular monolith**: one deployable web application with clearly separated internal modules, backed by one relational database. This is deliberately NOT a multi-tenant SaaS or microservices design — those add operational complexity (service discovery, distributed transactions, multi-database tenancy) that this project does not need and would slow down delivery without benefit. The "modules" below are code/schema boundaries inside one app, not separate services.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │ Login/Auth │  │ Task List  │  │ Task Detail│  │ Dashboards      │  │
│  │   Pages    │  │ (My Tasks) │  │  + History │  │ (charts/tables) │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────────┬────────┘  │
│        │ Empresas CRUD │ Avulsas CRUD  │                  │           │
└────────┼───────────────┼───────────────┼──────────────────┼───────────┘
         │               │               │                  │
         ▼               ▼               ▼                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    APPLICATION SERVER (API + Web)                     │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────┐ ┌──────────────┐ │
│  │ Auth Module │ │ Empresas      │ │ Tarefas       │ │ Dashboards   │ │
│  │ (sessions,  │ │ Module (CRUD, │ │ Module (CRUD, │ │ Module       │ │
│  │ RBAC)       │ │ import Excel) │ │ status, hist.)│ │ (aggregation)│ │
│  └─────────────┘ └──────────────┘ └───────┬───────┘ └──────────────┘ │
│                                            │                          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │         Recurring Task Generation Engine (scheduled job)         │ │
│  │  - Reads: regras de obrigação por regime tributário (config/DB)  │ │
│  │  - Reads: cadastro de empresas + regime + particularidades       │ │
│  │  - Calcula: prazo ajustado por dia útil/feriado nacional          │ │
│  │  - Escreve: novas linhas em "tarefas" (1x por empresa/obrigação) │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │   Holiday/Business-Day Service (feriados nacionais + cálculo)   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      DATABASE (PostgreSQL)                            │
│ ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌────────────────────────┐  │
│ │ usuarios │ │ empresas │ │  tarefas    │ │ regras_obrigacao        │  │
│ │          │ │          │ │ (instances) │ │ (templates por regime)  │  │
│ └──────────┘ └──────────┘ └────────────┘ └────────────────────────┘  │
│ ┌──────────────────────┐ ┌─────────────────────────────────────────┐ │
│ │ historico_conclusoes │ │ feriados (cache local opcional)          │ │
│ └──────────────────────┘ └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Auth Module** | Login, sessão, hashing de senha, RBAC (colaborador vs dono) | Auth via biblioteca de sessão/JWT do framework escolhido (ex: NextAuth/Auth.js, Lucia, ou auth nativo do framework); tabela `usuarios` com campo `role` (`colaborador`/`dono`) |
| **Empresas Module** | CRUD de empresas-cliente, importação inicial via planilha Excel | Tabela `empresas` (CNPJ, nome, regime_tributario, responsavel_id, particularidades JSON/texto); endpoint de upload + parser de Excel (ex: `xlsx`/`exceljs`) rodado uma vez na configuração inicial |
| **Tarefas Module** | CRUD de tarefas (recorrentes geradas + avulsas), mudança de status, histórico | Tabela `tarefas` (empresa_id nullable para avulsas, tipo_obrigacao, responsavel_id, prazo, status, mes_referencia); tabela `historico_conclusoes` para auditoria |
| **Regras de Obrigação (regime → tarefas)** | Define, por regime tributário, quais tipos de obrigação existem, periodicidade e regra de prazo (ex: "dia 25 do mês seguinte, ajustar p/ dia útil anterior") | Tabela `regras_obrigacao` (regime_tributario, tipo_obrigacao, regra_prazo, ativo) — dados, não código, para permitir adicionar regimes/obrigações sem deploy |
| **Recurring Task Generation Engine** | Job mensal que lê `empresas` + `regras_obrigacao`, calcula prazos ajustados, e insere instâncias em `tarefas` (idempotente — não duplica se já rodou no mês) | Job agendado (cron interno do framework, ou cron do provedor de hosting, ou serviço externo tipo cron-job.org chamando um endpoint protegido) |
| **Holiday/Business-Day Service** | Determina se uma data é feriado nacional/fim de semana e calcula o próximo/anterior dia útil | Biblioteca `date-holidays` (suporta Brasil, feriados móveis como Carnaval/Corpus Christi) combinada com lógica própria de "ajustar para dia útil anterior/seguinte" |
| **Dashboards Module** | Agregações: desempenho por colaborador (no prazo vs atrasado), evolução mensal, ranking de empresas problemáticas | Queries agregadas (SQL `GROUP BY`/`COUNT`/`AVG`) sobre `tarefas` + `historico_conclusoes`; renderizadas com biblioteca de gráficos (ex: Recharts/Chart.js) |
| **Alertas (in-app)** | Destaca visualmente tarefas próximas do prazo ou atrasadas | Cálculo derivado (não armazenado): comparar `prazo` com `hoje`, sem necessidade de módulo separado — é uma view/filtro sobre `tarefas` |
| **Referência às automações Python** | Passo a passo de tarefas ICMS/PIS-COFINS linka/explica o uso das ferramentas Python existentes | v1 = campo de texto/markdown com instruções + link/caminho para os scripts; NÃO executa os scripts (fora de escopo v1) |

## Recommended Project Structure

Estrutura ilustrativa para um framework full-stack tipo Next.js (App Router) + PostgreSQL + ORM (Prisma/Drizzle) — adaptar conforme STACK.md, mas a separação de pastas reflete os limites de módulo acima independentemente do framework escolhido:

```
src/
├── app/                        # Rotas/páginas (UI)
│   ├── (auth)/login/           # Tela de login
│   ├── (dashboard)/            # Área autenticada
│   │   ├── minhas-tarefas/     # Lista de tarefas do usuário logado
│   │   ├── empresas/           # CRUD empresas (cadastro, importação)
│   │   ├── tarefas/[id]/       # Detalhe de tarefa (passo a passo, histórico)
│   │   ├── analytics/          # Dashboards comparativos
│   │   └── admin/              # Telas exclusivas do "dono" (visão geral, regras)
│   └── api/                    # Endpoints (se separados das server actions)
│       ├── tasks/generate/     # Endpoint chamado pelo job mensal (protegido)
│       └── empresas/import/    # Upload/parse de planilha Excel
├── modules/                     # Lógica de domínio (separada da UI)
│   ├── auth/                   # Sessão, hashing, checagem de role
│   ├── empresas/                # CRUD + parser de importação Excel
│   ├── tarefas/                 # CRUD, mudança de status, histórico
│   ├── regras-obrigacao/        # CRUD das regras por regime tributário
│   ├── geracao-tarefas/         # Motor de geração mensal (engine + job runner)
│   ├── feriados/                # Serviço de feriados/dia útil
│   └── dashboards/               # Queries de agregação
├── db/
│   ├── schema/                  # Definições de tabelas (Prisma schema / Drizzle schema)
│   ├── migrations/               # Migrações versionadas
│   └── seed/                     # Dados iniciais: regras_obrigacao padrão (Lucro Real, Simples)
└── lib/
    ├── excel/                    # Helpers de leitura/escrita de planilhas
    └── dates/                     # Wrapper sobre date-holidays + cálculo de dia útil
```

### Structure Rationale

- **`app/` separado de `modules/`:** mantém a UI fina e a lógica de negócio (regras de geração de tarefas, cálculo de prazos) testável sem subir o servidor web inteiro — importante porque o motor de geração é o componente mais arriscado/crítico do sistema.
- **`modules/regras-obrigacao/` como módulo próprio:** isola a "configuração tributária" do "motor de execução" (`geracao-tarefas/`). Isso é o que permite adicionar um terceiro regime tributário (ex: Lucro Presumido) só com dados novos, sem tocar no motor.
- **`modules/feriados/`:** isolado porque é uma dependência transversal (usada tanto na geração mensal quanto possivelmente em validações de UI), e porque pode evoluir (hoje só feriados nacionais; v2 pode adicionar estaduais por empresa).
- **`db/seed/`:** crítico para este projeto — as regras de obrigação por regime (Lucro Real: ICMS dia X, PIS/COFINS dia Y, SPED dia Z; Simples Nacional: DAS dia W) são dados de configuração inicial, não hardcoded, então precisam de um seed versionado e editável.

## Architectural Patterns

### Pattern 1: Regras de Geração como Dados (Rule Table), não Código

**What:** Em vez de hardcodar "se regime == Lucro Real, gerar tarefa de ICMS no dia 10, PIS/COFINS no dia 25...", as regras vivem em uma tabela `regras_obrigacao` com colunas como `regime_tributario`, `tipo_obrigacao`, `dia_base`, `direcao_ajuste` (antecipar/postergar ao bater em fim de semana/feriado), `ativo`.

**When to use:** Sempre que a lista de regimes/obrigações pode crescer (este projeto já prevê isso explicitamente: "hoje 2 regimes, pode crescer"). Também permite ao "dono" eventualmente editar prazos sem pedir alteração de código.

**Trade-offs:**
- (+) Adicionar um regime novo (ex: Lucro Presumido com obrigações próprias) = inserir linhas na tabela, sem deploy.
- (+) Motor de geração fica genérico: "para cada empresa, buscar regras do seu regime, para cada regra calcular prazo ajustado, criar tarefa se ainda não existir".
- (-) Um pouco mais de indireção do que `if/else` direto — mas para 2-4 regimes e ~5 tipos de obrigação, o custo é mínimo e o ganho de extensibilidade é alto.
- (-) Regras complexas (ex: prazo que depende do dígito final do CNPJ — explicitamente fora de escopo v1) não cabem bem num modelo de "dia fixo + ajuste". Se isso entrar em v2, a tabela precisa de um campo extra de "tipo de regra" (fixo vs. baseado em CNPJ).

**Example schema (conceitual):**
```sql
CREATE TABLE regras_obrigacao (
  id SERIAL PRIMARY KEY,
  regime_tributario TEXT NOT NULL,     -- 'lucro_real' | 'simples_nacional' | (futuro: outros)
  tipo_obrigacao TEXT NOT NULL,        -- 'icms' | 'pis_cofins' | 'sped' | 'das'
  dia_base INTEGER NOT NULL,           -- dia do mês (do mês seguinte ao de referência)
  ajuste_dia_nao_util TEXT NOT NULL,   -- 'antecipar' | 'postergar'
  ativo BOOLEAN DEFAULT true,
  UNIQUE (regime_tributario, tipo_obrigacao)
);
```

### Pattern 2: Motor de Geração Mensal Idempotente

**What:** Um job que roda 1x por mês (ou sob demanda/manualmente, com proteção) e, para cada empresa ativa, para cada regra de obrigação do seu regime: calcula o `mes_referencia`, calcula o `prazo` ajustado por dia útil, e faz um `INSERT ... ON CONFLICT DO NOTHING` (ou checagem prévia de existência) na tabela `tarefas` usando uma chave única `(empresa_id, tipo_obrigacao, mes_referencia)`.

**When to use:** Sempre — esse é o coração do sistema. Idempotência é essencial porque: (a) o job pode ser re-executado manualmente se falhar, (b) novas empresas podem ser cadastradas no meio do mês e precisam "pegar" tarefas do mês corrente, (c) evita duplicação se o agendador disparar duas vezes.

**Trade-offs:**
- (+) Seguro re-rodar a qualquer momento.
- (+) Fácil adicionar "gerar tarefas retroativas" para uma empresa nova cadastrada no meio do mês — basta rodar o motor filtrando por essa empresa.
- (-) Requer uma constraint única no banco e cuidado para que o cálculo de prazo seja determinístico (mesma entrada → mesma saída), senão re-execuções podem gerar prazos diferentes para a "mesma" tarefa.

**Example (pseudo-code):**
```typescript
async function gerarTarefasDoMes(mesReferencia: string) {
  const empresas = await db.empresas.findMany({ where: { ativo: true } });
  const regras = await db.regrasObrigacao.findMany({ where: { ativo: true } });

  for (const empresa of empresas) {
    const regrasDoRegime = regras.filter(r => r.regimeTributario === empresa.regimeTributario);
    for (const regra of regrasDoRegime) {
      const prazoBruto = calcularDataBase(mesReferencia, regra.diaBase);
      const prazoAjustado = ajustarParaDiaUtil(prazoBruto, regra.ajusteDiaNaoUtil);

      await db.tarefas.upsert({
        where: { empresaId_tipoObrigacao_mesReferencia: { empresaId: empresa.id, tipoObrigacao: regra.tipoObrigacao, mesReferencia } },
        create: { empresaId: empresa.id, tipoObrigacao: regra.tipoObrigacao, mesReferencia, prazo: prazoAjustado, responsavelId: empresa.responsavelId, status: 'pendente' },
        update: {}, // não sobrescreve se já existe
      });
    }
  }
}
```

### Pattern 3: RBAC Simples por Role + Escopo de Dados

**What:** Dois papéis (`colaborador`, `dono`). Toda query de listagem de tarefas/empresas é filtrada no backend: `colaborador` só vê registros onde `responsavel_id == usuario_logado.id`; `dono` não tem filtro (vê tudo). A checagem acontece em uma camada central (middleware ou função de repositório), não espalhada pela UI.

**When to use:** Sempre, neste projeto — só 2 papéis, então não vale a pena um sistema RBAC genérico com tabelas `roles`/`permissions`/`role_permissions` (overkill para 5 usuários). Um enum `role` na tabela `usuarios` + uma função `withVisibilityScope(query, usuario)` é suficiente.

**Trade-offs:**
- (+) Simples de entender e auditar — toda a regra de visibilidade está em um lugar.
- (+) Fácil de testar (dado um usuário colaborador X, a query nunca deve retornar tarefas de empresas de outro responsável).
- (-) Se no futuro surgir um 3º papel (ex: "supervisor de equipe" vendo um subconjunto de colaboradores), o enum simples não basta — mas isso é um problema de v2, não de v1.
- (-) Enforcement deve ser SEMPRE no backend (nunca confiar em esconder botões na UI) — a real-side UI é só conveniência, não segurança.

## Data Flow

### Geração Mensal de Tarefas (fluxo principal)

```
[Agendador (cron)] dispara 1x/mês (ex: dia 1, 00:05)
    ↓
[Endpoint protegido /api/tasks/generate] (ou job interno)
    ↓
[Motor de Geração] lê empresas ativas + regras_obrigacao
    ↓
[Holiday Service] ajusta cada prazo por dia útil/feriado nacional
    ↓
[INSERT idempotente em "tarefas"] (uma linha por empresa × obrigação × mês)
    ↓
[Tarefas aparecem em "Minhas Tarefas" do responsável + visão geral do dono]
```

### Atualização de Status (uso diário)

```
[Usuário marca tarefa como concluída]
    ↓
[UI → Tarefas Module] valida que o usuário pode editar essa tarefa (RBAC: é o responsável OU é o dono)
    ↓
[UPDATE tarefas SET status='concluida', concluido_em=now(), concluido_por=usuario.id]
    ↓
[INSERT em historico_conclusoes] (registro imutável para auditoria/dashboards)
    ↓
[UI atualiza] (lista re-renderiza, alerta visual desaparece se estava "atrasado")
```

### Agregação para Dashboards

```
[Tabelas "tarefas" + "historico_conclusoes"] (fonte única de verdade)
    ↓
[Queries agregadas sob demanda]
    - Por colaborador: % tarefas concluídas no prazo vs atrasadas (mês corrente / histórico)
    - Por mês: evolução de atrasos ao longo do tempo (GROUP BY mes_referencia)
    - Por empresa: contagem de atrasos recorrentes (GROUP BY empresa_id, ORDER BY atrasos DESC)
    ↓
[Dashboards Module formata resultado] → [UI renderiza com biblioteca de gráficos]
```

**Nota sobre performance de dashboards:** Na escala deste projeto (~110 empresas × ~5 obrigações/mês = ~550 tarefas/mês, crescendo lentamente), queries agregadas diretas no PostgreSQL são suficientes — não há necessidade de tabelas de agregação pré-computadas, data warehouse separado, ou cache. Revisar isso só se o histórico crescer para múltiplos anos E os dashboards ficarem perceptivelmente lentos (improvável antes de centenas de milhares de linhas).

### Importação Inicial de Empresas (fluxo único, configuração)

```
[Usuário faz upload de "Controle pis e cofins.xlsx"]
    ↓
[Empresas Module → parser Excel] lê linhas, mapeia colunas → campos de "empresas"
    ↓
[Validação] (CNPJ válido, regime_tributario reconhecido, responsável existe)
    ↓
[INSERT em lote em "empresas"]
    ↓
[Tela de revisão] (usuário confirma/corrige antes de persistir definitivamente — recomendado para evitar reimportação)
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 5 usuários, ~110 empresas (estado atual e previsto) | Monolito modular + PostgreSQL gerenciado (ex: Supabase, Neon, Railway) é mais que suficiente. Sem necessidade de cache, fila de jobs externa, ou múltiplas instâncias. |
| Crescimento moderado (até ~20 usuários, ~500 empresas) | Mesma arquitetura. Adicionar índices em `tarefas(responsavel_id, mes_referencia)` e `tarefas(empresa_id, tipo_obrigacao, mes_referencia)`. Considerar paginação nas listagens se "Minhas Tarefas" crescer muito. |
| Hipotético crescimento grande (centenas de usuários/empresas, múltiplos escritórios) | Reavaliar para multi-tenancy real (separação por `escritorio_id` em todas as tabelas) e mover o motor de geração para um worker separado com fila (ex: BullMQ + Redis) para não competir com requisições web. **Não é necessário para este projeto** — incluído apenas para registro caso o produto vire SaaS no futuro. |

### Scaling Priorities

1. **Primeiro "gargalo" provável:** Não é performance — é **corretude do motor de geração** (datas erradas, duplicação de tarefas, regras de regime mal configuradas). Mitigar com idempotência (Pattern 2), testes automatizados do cálculo de prazos, e um modo "dry-run" que mostra o que seria gerado antes de persistir.
2. **Segundo ponto de atenção:** Hospedagem com acesso pela internet implica necessidade de HTTPS, backups do banco, e variável de ambiente para segredos (senha de DB, chave de sessão) — tratar isso desde a Fase 1 (auth), não depois.

## Anti-Patterns

### Anti-Pattern 1: Hardcodar Regras de Obrigação no Código do Motor

**What people do:** Escrever `if (empresa.regime === 'lucro_real') { criarTarefa('ICMS', dia10); criarTarefa('PIS_COFINS', dia25); ... }` diretamente na função de geração.

**Why it's wrong:** Cada novo regime tributário ou mudança de prazo exige alteração de código + deploy. O projeto já sinaliza que "hoje 2 regimes, pode crescer" — hardcoding vira dívida técnica imediata.

**Do this instead:** Tabela `regras_obrigacao` (Pattern 1) + motor genérico que itera sobre regras. Adicionar regime = inserir dados.

### Anti-Pattern 2: Calcular "Atrasado" em Tempo de Escrita (campo armazenado)

**What people do:** Ter uma coluna `status = 'atrasado'` que é setada por algum job/trigger quando o prazo passa.

**Why it's wrong:** Cria a necessidade de um job adicional rodando diariamente só para "atualizar status", e esse status pode ficar dessincronizado (ex: usuário olha a tarefa às 23h59 do dia do prazo vs 00h01).

**Do this instead:** "Atrasado" é um valor **derivado**, calculado na hora de exibir: `status === 'pendente' && prazo < hoje` → exibir como atrasado. Armazenar apenas `status` (`pendente`/`concluida`) e `prazo`; tudo o mais é cálculo na consulta/UI.

### Anti-Pattern 3: Construir RBAC Genérico (roles/permissions/role_permissions) para 2 Papéis

**What people do:** Seguir tutoriais de RBAC "enterprise" com tabelas `roles`, `permissions`, `role_permissions`, `user_roles` desde o início.

**Why it's wrong:** Para 2 papéis fixos (colaborador/dono) e 5 usuários, isso é complexidade sem benefício — mais tabelas, mais joins, mais código para manter, sem nenhum caso de uso que precise dessa flexibilidade no v1.

**Do this instead:** Enum `role` na tabela `usuarios` (Pattern 3) + função central de escopo de visibilidade. Migrar para RBAC genérico só se/quando surgir um 3º papel com necessidades distintas.

### Anti-Pattern 4: Job de Geração Acoplado ao Processo Web Sem Proteção

**What people do:** Expor um endpoint `/gerar-tarefas` chamável por qualquer requisição, ou rodar o job só "quando alguém acessa o dashboard nesse dia".

**Why it's wrong:** Sem proteção, qualquer usuário (ou bot) pode disparar gerações repetidas; sem agendamento confiável, a geração pode simplesmente não acontecer se ninguém acessar o sistema no dia certo.

**Do this instead:** Endpoint protegido por chave secreta (header) chamado por um agendador externo (cron do provedor de hosting, ou serviço gratuito tipo cron-job.org/GitHub Actions scheduled workflow), combinado com idempotência (Pattern 2) para tornar seguro re-disparos manuais.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Feriados nacionais (Brasil) | Biblioteca local `date-holidays` (dados embutidos, sem chamada de rede) — preferível a uma API externa para evitar dependência de disponibilidade externa em um cálculo crítico | Suporta feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi); v1 usa apenas o calendário nacional, conforme escopo definido |
| Agendador externo (disparo do job mensal) | Endpoint HTTP protegido por token, chamado por cron-job.org, GitHub Actions (`schedule`), ou cron nativo do provedor de hospedagem | Escolha depende do STACK.md / provedor de hospedagem; manter simples (1 chamada HTTP por dia/mês) |
| Ferramentas Python de automação (ICMS PDF, PIS/COFINS) | v1: referência textual/link no passo a passo da tarefa — **não há integração de runtime** | Fora de escopo v1 executar; arquitetura deve deixar um "gancho" claro (campo de instruções estruturado) para que v2 possa evoluir para chamada de API/serviço |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI ↔ Auth Module | Sessão/cookie + checagem de role em cada rota protegida | Toda rota de dados deve verificar sessão antes de qualquer query |
| Tarefas Module ↔ Empresas Module | Leitura direta via FK (`tarefas.empresa_id → empresas.id`) — mesmo banco, sem API intermediária | Acoplamento aceitável dentro de um monolito modular |
| Motor de Geração ↔ Regras de Obrigação + Empresas + Holiday Service | Leitura no início do job; nenhuma escrita nessas tabelas pelo motor | Motor é "consumidor" de configuração, nunca "dono" dela — separa quem define regras (admin/dono) de quem as executa |
| Dashboards Module ↔ Tarefas/Histórico | Apenas leitura (queries agregadas) | Nenhuma lógica de negócio nova aqui — só leitura e formatação |
| Importação Excel ↔ Empresas Module | Parser roda no servidor, popula `empresas` via mesma camada de validação usada pelo CRUD manual | Evita "dois caminhos" de criação de empresa com regras diferentes |

## Build Order Implications (for Roadmap)

A ordem de construção segue as dependências de dados, não as de "valor percebido isoladamente":

1. **Auth + Cadastro de Empresas (fundação):** Sem usuários e sem empresas cadastradas (mesmo que via importação), nada mais tem sentido — o motor de geração precisa de `empresas` + `usuarios.responsavel_id`; os dashboards precisam de `tarefas` que dependem de `empresas`.
2. **Modelo de Tarefas + Regras de Obrigação + Tarefas Avulsas:** Antes do motor automático, vale construir o modelo de dados de `tarefas` e a criação manual (avulsas) — isso testa o CRUD de tarefas, status, e detalhe/histórico com dados reais, sem depender do motor ainda.
3. **Motor de Geração Mensal + Holiday Service:** Depende de (1) e (2) existirem e estarem corretos. É o componente de maior risco — vale isolar como fase própria com testes de cálculo de datas.
4. **Detalhe de Tarefa (passo a passo + referência às automações Python) + Alertas visuais:** Camada de UX sobre o modelo já existente; pode evoluir em paralelo com (3) já que não depende do motor, só do modelo de `tarefas`.
5. **Dashboards/Analytics:** Por último — depende de haver `tarefas` + `historico_conclusoes` reais (gerados pelas fases anteriores) para ter dados significativos para agregar e para validar visualmente.

**Resumo da dependência:** `Auth + Empresas` → `Tarefas (modelo + avulsas)` → `Motor de Geração + Feriados` → `Detalhe/Alertas` (paralelo a 3) → `Dashboards`.

## Sources

- [Multi-Tenancy with Node.js AsyncLocalStorage (Medium)](https://medium.com/@jfelipevalr/multi-tenancy-with-node-js-asynclocalstorage-4c771a3d06ed) — confirma que multi-tenancy real só compensa em escala maior; usado para justificar a recomendação de monolito modular single-tenant.
- [Role-Based Access Control (RBAC) in Next.js Apps Backed by PostgreSQL](https://medium.com/@nikitinal.nal/next-js-with-postgresql-role-based-access-control-implementation-ca024fd6d471) — padrão de RBAC com PostgreSQL e enforcement no servidor.
- [date-holidays (npm)](https://www.npmjs.com/package/date-holidays) — biblioteca para feriados nacionais (incluindo Brasil e feriados móveis), usada como base do Holiday Service.
- [eh-dia-util (GitHub)](https://github.com/lfreneda/eh-dia-util) — referência de lógica de "dia útil" considerando feriados móveis brasileiros (Carnaval, Corpus Christi, Sexta-feira Santa).
- [business-days-js (npm)](https://www.npmjs.com/package/business-days-js) — padrão de "adicionar/ajustar dias úteis" combinando calendário de feriados com cálculo de data.
- [Design a Distributed Job Scheduler (Hello Interview)](https://www.hellointerview.com/learn/system-design/problem-breakdowns/job-scheduler) — usado por contraste: confirma que o padrão "schedules table + next_run_time + idempotência" é a base correta, mas a versão distribuída/escala-massiva é desnecessária aqui (informa o que NÃO construir).
- [Template Systems For Recurring Tasks](https://www.automateed.com/template-systems-for-recurring-tasks) — confirma o padrão "template/regra de recorrência separado da instância gerada", base do Pattern 1 e Pattern 2.

---
*Architecture research for: Sistema de gestão de tarefas fiscais recorrentes (Agenda Fiscal)*
*Researched: 2026-06-11*
