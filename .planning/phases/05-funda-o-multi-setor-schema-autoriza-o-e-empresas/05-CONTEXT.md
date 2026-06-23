# Phase 5: Fundação Multi-Setor — Schema, Autorização e Empresas - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega a base estrutural da multi-setorialidade: cada empresa passa a ter 1 responsável por setor (Fiscal/DP/Contábil) via uma tabela de junção que substitui `Empresa.responsavelId`, com backfill verificado das 197 empresas existentes para FISCAL; `Usuario` ganha um campo Setor; os 7 colaboradores placeholder (4 DP + 3 Contábil) são criados com login funcional; a autorização (`withVisibilityScope`/`withTarefaScope`) passa a ser setor-aware sem regressão no Fiscal; o cadastro/edição de empresa expõe os 3 seletores de responsável e o novo campo "tem funcionários CLT?" (EMPR-03).

Esta fase NÃO constrói nenhuma lógica de geração de obrigações de DP ou Contábil (isso é Phase 6/7) — apenas a fundação de dados e autorização sobre a qual elas vão se apoiar.

</domain>

<decisions>
## Implementation Decisions

### Atribuição inicial de responsáveis DP/Contábil
- **D-01:** O responsável de DP e o responsável de Contábil ficam **nulos** (sem atribuição) para todas as 197 empresas existentes no momento da migração — diferente do Fiscal, que é backfillado obrigatoriamente a partir do `Empresa.responsavelId` atual (197 → 197 linhas FISCAL, nenhuma null). Não há atribuição automática/round-robin: a atribuição real é desconhecida hoje e atribuir aleatoriamente criaria responsabilidade falsa.
- **D-02:** Somente o usuário **DONO** pode editar os 3 seletores de responsável (Fiscal/DP/Contábil) na tela de cadastro/edição de empresa. Colaboradores (de nenhum setor) podem alterar responsabilidade — mantém o controle centralizado que já existe hoje para o Fiscal.
- **D-03:** A lista de empresas precisa de um filtro/badge "sem responsável" (DP ou Contábil) para o dono localizar rapidamente quais empresas ainda precisam de atribuição manual — mesmo padrão de UX já usado no v1.0 para o filtro "Sem regime" da importação de empresas.

### Campo CLT (EMPR-03)
- **D-04:** O campo "tem funcionários CLT?" é adicionado com valor padrão **`false` (Não)** para todas as 197 empresas existentes na migração — não existe essa informação em nenhuma fonte de dados hoje; `false` evita falsos positivos (gerar obrigação de DP indevida) em troca de exigir revisão manual.
- **D-05:** A revisão/preenchimento desse campo para as 197 empresas será **manual, dentro do próprio sistema** (toggle/checkbox no cadastro de empresa) — não há planilha externa para importar em lote.

### Colaboradores placeholder DP/Contábil
- **D-06:** Convenção de nome/email para os 7 placeholders: **DP1–DP4** e **Contabil1–Contabil3** (ex: `dp1@...`, `contabil1@...`) — mesmo padrão usado para `colaborador1-4` no Fiscal v1.0 (renomeáveis depois via quick task, igual ao que já aconteceu com Caio/Jessica/Heitor/Felipe).
- **D-07:** Os 7 placeholders devem ter **login funcional desde já** (senha definida, não apenas registro no banco) — útil caso a equipe real de DP/Contábil receba acesso em breve.
- **D-08:** A senha inicial dos 7 placeholders reaproveita exatamente o padrão já usado no seed do v1.0: hash bcrypt da senha literal `"trocar-no-primeiro-login"` (ver `prisma/seed.ts:16`) — sem inventar uma convenção nova.

### Tela de empresas para colaboradores de DP/Contábil
- **D-09:** Quando um colaborador de DP/Contábil logar e a lista de empresas estiver vazia (porque ainda não há atribuições — ver D-01), a tela deve mostrar uma **mensagem explicativa no estado vazio** (ex: "Nenhuma empresa atribuída a você ainda no setor DP — fale com o dono"), em vez do estado vazio genérico já existente — evita confusão para a pessoa real que assumir o login depois de renomeado.
- **D-10:** As colunas da tela de empresas são **filtradas por setor do usuário logado**: um colaborador de DP vê apenas a coluna "Responsável DP" daquela empresa (não vê quem é o responsável Fiscal/Contábil da mesma empresa). O DONO continua vendo as 3 colunas (Fiscal/DP/Contábil), consistente com sua visão geral sem restrição.

### Claude's Discretion
- Forma exata de implementação da tabela de junção `EmpresaResponsavelSetor` (nomes de campos, índices) — guiada pelo Pitfall B1 do RESEARCH.md (manter `Empresa.responsavelId` como coluna legada por 1 ciclo de release, backfill verificado por contagem antes de qualquer leitura mudar de fonte).
- Assinatura exata de `withVisibilityScope`/`withTarefaScope` ao se tornarem setor-aware — guiada pelo Pitfall B3 (parâmetro `setor` explícito, nunca inferido apenas de `user.setor`; suite de IDOR existente deve passar inalterada como regression gate).
- Texto exato da mensagem de estado vazio (D-09) e do filtro/badge "sem responsável" (D-03) — copy específica fica a critério da implementação, desde que comunique claramente a ausência de atribuição.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pitfalls e decisões de arquitetura para esta fase
- `.planning/research/PITFALLS.md` (seção "Critical Pitfalls (v2.0)", Pitfall B1 e B3) — migração da tabela de junção com backfill verificado (B1) e extensão setor-aware de `withVisibilityScope`/`withTarefaScope` sem regressão no Fiscal (B3); ambos endereçados nesta fase
- `.planning/research/SUMMARY.md` — visão geral da pesquisa v2.0
- `.planning/research/ARCHITECTURE.md` — decisões arquiteturais multi-setor

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` (seção "v2.0 Requirements", SETOR-01 a SETOR-03, EMPR-03) — requisitos formais desta fase
- `.planning/ROADMAP.md` (Phase 5) — goal, success criteria e dependências da fase
- `.planning/PROJECT.md` (seção "Key Decisions") — decisão v2.0 de 1 responsável por setor e 7 colaboradores placeholder

### Padrão de precedente v1.0 (placeholders e migração de responsável)
- `prisma/seed.ts` (linha 16) — senha padrão `"trocar-no-primeiro-login"` usada para colaboradores placeholder, reaproveitada nesta fase (D-08)
- `scripts/atualizar-responsaveis.mjs` — precedente de renomeação de colaboradores placeholder (colaborador1-4 → Caio/Jessica/Heitor/Felipe), mesmo padrão a seguir para os 7 novos quando renomeados

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/visibility-scope.ts` (`withVisibilityScope`, `withTarefaScope`) — funções centrais de autorização que precisam se tornar setor-aware; já documentadas como "NUNCA chamar db sem aplicar este escopo"
- `src/modules/empresas/queries.ts` (`EMPRESA_SELECT`, padrão `findFirst` com escopo) — padrão IDOR-safe a replicar para o novo modelo de 3 responsáveis
- Filtro "Sem regime" da tela de importação v1.0 — padrão de UX a replicar para o filtro "sem responsável" (D-03) e possivelmente para revisão do campo CLT (D-05)

### Established Patterns
- `prisma/schema.prisma`: `model Empresa` tem hoje `responsavelId String` (obrigatório, FK direta para `Usuario`) e `model Usuario` tem `role: Role` (`COLABORADOR`/`DONO`) sem campo de setor — ambos precisam de migração
- Testes de IDOR/visibilidade existentes (`tests/visibility-scope.test.ts`, `tests/tarefas.idor.test.ts`, `tests/empresas.idor.test.ts`) devem passar inalterados como regression gate antes de qualquer fixture multi-setor nova ser considerada (Pitfall B3)

### Integration Points
- `gerarTarefasDoMes`/`executarGeracaoMensal` leem `Empresa.responsavelId` diretamente, sem scope check — precisam ser repontados para a tabela de junção SOMENTE após o backfill estar verificado (Pitfall B1), mas a lógica de geração em si pertence à Phase 6/7, não a esta fase
- `empresa-form.tsx` / `empresas-table.tsx` mostram hoje 1 campo "Responsável" — precisam expor 3 seletores distintos nesta mesma fase (não pode ficar para depois, ou a UI fica incoerente com o modelo de dados)

</code_context>

<specifics>
## Specific Ideas

- Convenção de naming dos placeholders deve espelhar exatamente o padrão fiscal v1.0: `colaborador1-4` → `DP1-4`/`Contabil1-3`, mesma lógica de renomeação posterior via quick task.
- Senha inicial dos placeholders é literalmente a mesma string já usada no seed (`"trocar-no-primeiro-login"`), não uma nova convenção.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma ideia de novo escopo surgiu durante a discussão — manteve-se dentro do domínio da fase (schema, autorização, cadastro de empresas).

</deferred>

---

*Phase: 5-funda-o-multi-setor-schema-autoriza-o-e-empresas*
*Context gathered: 2026-06-23*
