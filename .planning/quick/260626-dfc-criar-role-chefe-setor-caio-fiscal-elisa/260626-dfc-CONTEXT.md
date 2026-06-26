# Quick Task 260626-dfc: Criar role CHEFE_SETOR (Caio/Elisabete/Lauany) - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Task Boundary

Caio (Fiscal), Elisabete/"Bete" (Contábil) e Lauany (DP) são chefes de setor e devem ganhar
permissão equivalente ao DONO, mas restrita ao próprio setor: ver todas as empresas do setor
(não só as pessoalmente atribuídas), ver/gerenciar todas as tarefas do setor, atribuir tarefas
avulsas a colegas do mesmo setor (não só a si mesmos), e gerenciar (criar/editar/excluir)
empresas dentro do escopo do próprio setor.

</domain>

<decisions>
## Implementation Decisions

### Novo papel: `CHEFE_SETOR`
- Adicionar valor `CHEFE_SETOR` ao enum `Role` em `prisma/schema.prisma` (hoje só
  `COLABORADOR`/`DONO`). Requer `npx prisma db push` em produção (mesmo fluxo manual já usado
  nas tasks anteriores desta sessão — o agente NÃO deve tentar rodar `db push`, só editar o
  schema; o orquestrador roda manualmente).
- `Caio` (colaborador1@escritorio.com.br, setor FISCAL), `Elisabete` (contabil1@escritorio.com.br,
  setor CONTABIL) e `Lauany` (dp1@escritorio.com.br, setor DP) passam de `role: COLABORADOR` para
  `role: CHEFE_SETOR`. `setor` de cada um NÃO muda. Precisa de script one-off (mesmo padrão dos
  scripts de rename já criados nesta sessão, ex. `scripts/renomear-usuarios-neto-lauany-elisabete.mjs`)
  — dry-run por padrão, `--apply` para efetivar, identificado por email, escrevendo SOMENTE o
  campo `role` (nunca nome/email/senhaHash/setor). Atualizar também `prisma/seed.ts` (literal
  `role:` dessas 3 entradas) para consistência em bancos novos.
- Os outros 9 colaboradores (Jessica/Heitor/Felipe, Andre/Mirella/Lorraine, Rany/Sarah) e o Neto
  continuam como estão (COLABORADOR / DONO).

### Visibilidade de empresas (`src/lib/visibility-scope.ts`, `withVisibilityScope`)
- Novo branch ANTES do branch `COLABORADOR`: se `user.role === "CHEFE_SETOR"`, retornar
  `{ responsaveisPorSetor: { some: { setor: user.setor } } }` — TODAS as empresas do setor do
  chefe, SEM restringir por `usuarioId` (diferente do branch COLABORADOR, que é pessoal). Usar
  sempre a junction table (mesmo para FISCAL) — o chefe é um código novo, não precisa preservar o
  shape legado `{ responsavelId: user.id }` exigido pela suite de regressão pré-v2.0 do
  COLABORADOR (essa suite não deve ser tocada).
- Se `user.setor` for `null` para um CHEFE_SETOR (não deveria acontecer, mas por defesa em
  profundidade): mesmo fail-safe do branch COLABORADOR — retornar
  `{ id: "__no_setor_defined__" }`, nunca `{}`.
- Isso automaticamente estende a visão de `editarEmpresa`/`excluirEmpresa` (que já usam
  `withVisibilityScope` no `findFirst` anti-IDOR) e de `listarEmpresas`/`/empresas` para o chefe —
  NÃO precisa de nenhuma mudança adicional nesses arquivos para o "ver/editar/excluir dentro do
  setor" funcionar.

### Visibilidade de tarefas (`withTarefaScope`)
- Novo branch: se `user.role === "CHEFE_SETOR"`, retornar `tarefaSetorWhere(user.setor)`
  (importar de `@/lib/tipo-obrigacao-setor` — já existe, usado hoje só pelos dashboards;
  classifica recorrentes por `tipoObrigacao` e avulsas por `responsavel.setor`). Isso dá ao chefe
  visão de TODAS as tarefas do setor (não só as pessoalmente atribuídas).

### Atribuição de tarefa avulsa (`src/app/(app)/tarefas/actions.ts`, `criarTarefa`)
- Guard atual (linha ~92): `if (role === "COLABORADOR" && responsavelId !== user.id) -> não
  autorizado`. Adicionar guard equivalente para CHEFE_SETOR: se `role === "CHEFE_SETOR"` E
  `responsavelId !== user.id`, buscar o `setor` do usuário-alvo (`db.usuario.findUnique({ where:
  { id: responsavelId }, select: { setor: true } })`) e rejeitar (`não autorizado`) se
  `alvo.setor !== user.setor` ou se o alvo não existir. Chefe pode atribuir a si mesmo OU a
  qualquer colega do MESMO setor; nunca a colega de outro setor.
- A anti-IDOR de empresa já citada (`withVisibilityScope` no `findFirst` de `empresaAutorizada`)
  já cobre "chefe só cria tarefa para empresa do próprio setor" automaticamente.

### Responsável por setor no formulário de empresa (`empresa-form.tsx` + `actions.ts`)
- Hoje os 3 `<Select>` (Fiscal/DP/Contábil) ficam `disabled={!isDono}` — só o DONO edita
  qualquer um dos 3. Trocar por um disabled POR CAMPO: cada select fica habilitado se
  `isDono || (isChefeSetor && campo === setorDoChefe)`. Passar para o componente algo como
  `podeEditarFiscal`/`podeEditarDp`/`podeEditarContabil` (booleans), calculados na page (`/empresas/novo`,
  `/empresas/[id]/editar`) a partir de `session.user.role`/`session.user.setor` — NÃO recalcular
  dentro do client component a partir de dados não confiáveis.
- Guards server-side em `criarEmpresa`/`editarEmpresa` (hoje `isDono ? valor : null/atual` para
  os 3 campos): trocar cada um dos 3 por checagem individual — permite o valor submetido quando
  `isDono` OU quando (`role === "CHEFE_SETOR"` E aquele campo específico corresponde ao setor do
  chefe); senão mantém o comportamento atual (null na criação / valor atual reaproveitado na
  edição). Ex.: `responsavelFiscalId` aceita o valor submetido se `isDono || (isChefeSetor &&
  user.setor === "FISCAL")`, senão cai no fallback já existente.
- Isso é defesa em profundidade igual ao resto do projeto: o `disabled` no client é só a primeira
  camada, o guard real é a Server Action.

### Botões administrativos em `/tarefas` (`src/app/(app)/tarefas/actions.ts` + `page.tsx`)
- **Gerar tarefas do mês** (`gerarTarefasDoMesAction`, guard hoje `role !== "DONO" -> não
  autorizado` na linha ~299): trocar para `role !== "DONO" && role !== "CHEFE_SETOR" -> não
  autorizado`. O botão correspondente em `page.tsx` (hoje dentro de
  `{session.user.role === "DONO" && (...)}`) passa a renderizar também para CHEFE_SETOR. A
  geração em si continua GLOBAL (gera tarefas dos 3 setores na mesma transação, como já é hoje —
  não criar uma geração "só do meu setor"; é idempotente e inofensivo um chefe disparar a geração
  completa do mês).
- **Excluir tarefas da competência atual** (`excluirTarefasDaCompetenciaAtualAction`, guard hoje
  na linha ~371): **NÃO muda** — continua exclusivo do DONO (ação destrutiva, decisão explícita
  do usuário nesta conversa).

### Fora de escopo (não pedido, não implementar)
- Dashboards (`/dashboards`, `dashboards/guard.ts`) continuam DONO-only, sem nenhuma mudança —
  chefe de setor NÃO ganha acesso a dashboards nesta tarefa.
- Página `/usuarios` (editar nome) continua DONO-only, sem mudança.
- Nenhuma mudança na suite de regressão IDOR/visibilidade pré-v2.0 existente
  (`visibility-scope.test.ts`, `empresas.idor.test.ts`, `tarefas.idor.test.ts`) — esses testes
  cobrem COLABORADOR/DONO e devem continuar passando inalterados; testes NOVOS para CHEFE_SETOR
  são adicionados, não substituem os existentes.

### Claude's Discretion
- Nome exato de variáveis/props internas (ex. `isChefeSetor`, `podeEditarFiscal`) — usar bom senso
  seguindo a convenção de nomes já estabelecida no arquivo.
- Onde exatamente calcular o "setor do campo == setor do chefe" — pode ser um pequeno helper
  reutilizado entre `criarEmpresa`/`editarEmpresa` se reduzir duplicação, mas não é obrigatório.

</decisions>

<specifics>
## Specific Ideas

`tarefaSetorWhere(setor)` já existe em `src/lib/tipo-obrigacao-setor.ts` e é exatamente o que
`withTarefaScope` precisa para o branch CHEFE_SETOR — não duplicar essa lógica.

`withVisibilityScope`/`withTarefaScope` já são usados em `editarEmpresa`/`excluirEmpresa`/
`criarTarefa`/`concluirTarefa`/`excluirTarefa`/listagens — adicionar o branch CHEFE_SETOR nessas
duas funções centrais propaga a permissão automaticamente para todos esses call-sites, sem
precisar tocar em cada um.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above, derived from leitura direta
de `src/lib/visibility-scope.ts`, `src/lib/tipo-obrigacao-setor.ts`, `src/app/(app)/actions.ts`,
`src/app/(app)/tarefas/actions.ts`, `src/app/(app)/empresas/empresa-form.tsx`.

</canonical_refs>
