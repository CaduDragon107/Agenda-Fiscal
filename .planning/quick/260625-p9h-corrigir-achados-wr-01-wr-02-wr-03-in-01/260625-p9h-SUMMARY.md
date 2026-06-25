---
phase: quick-260625-p9h
plan: 01
subsystem: database
tags: [dashboards, prisma, zod, vitest, multi-setor]

requires:
  - phase: 08-dashboards-multi-setor-dp-e-cont-bil
    provides: dashboards parametrizados por setor (queries.ts, snapshot.ts, guard.ts) e o 08-REVIEW.md que originou os 5 achados corrigidos nesta quick task
provides:
  - totalNoPrazo inteiro exposto em DesempenhoColaborador, eliminando round-trip lossy via percentual arredondado no ponto live de listarEvolucaoMensal
  - default de quantidadeMeses alinhado a 6 (era 3) em listarEvolucaoMensal, igualando o default real de producao em guard.ts
  - janela do ranking de empresas derivada de quantidadeMeses (subMonths(hoje, quantidadeMeses)), consistente com a janela do grafico de evolucao
  - totalEmpresas do snapshot mensal escopado por setor (1 groupBy por setor distinto presente), eliminando degrau live->frozen na carteira DP
  - usuarioSchema (Zod) reutilizavel que rejeita COLABORADOR sem setor e aceita DONO sem setor
affects: [dashboards, geracao-mensal, usuarios]

tech-stack:
  added: []
  patterns:
    - "empresaWhereExtraPorSetor (snapshot.ts) espelha empresaScopePorSetor (guard.ts) sem importar entre camadas - duplicacao deliberada entre data layer e presentation layer"
    - "groupBy por setor distinto presente nas chaves (colaborador, setor), nunca por colaborador individual - evita N+1"

key-files:
  created:
    - src/modules/usuarios/schema.ts
    - tests/usuarios.schema.test.ts
  modified:
    - src/modules/dashboards/queries.ts
    - src/app/(app)/dashboards/guard.ts
    - src/modules/dashboards/snapshot.ts
    - tests/dashboards.queries.test.ts
    - tests/dashboards.snapshot.test.ts

key-decisions:
  - "totalNoPrazo somado como inteiro exato no ponto live (acc.noPrazo + c.totalNoPrazo) em vez de reverter o percentual arredondado via Math.round((percentual/100)*total) - elimina over-contagem sistematica em carteiras grandes"
  - "default de quantidadeMeses em listarEvolucaoMensal mudado de 3 para 6, alinhando ao default real de producao em guard.ts (?meses= ausente -> 6); nenhum call site precisou mudar pois guard.ts ja passa valor explicito"
  - "carteira do snapshot (totalEmpresas) escopada por setor via novo mapa empresaWhereExtraPorSetor, com no maximo 1 groupBy por setor distinto presente nas chaves (colaborador, setor) - nunca 1 por colaborador, evitando N+1"
  - "usuarioSchema criado como primitivo Zod reutilizavel (sem Server Action de usuario existente no codebase ainda) - entrega a unidade testavel que existe hoje, pronta para ser plugada em futura criarUsuario/editarUsuario"
  - "coluna Usuario.setor permanece nullable no DB - validacao acontece exclusivamente na camada de aplicacao (Zod), nao no schema Prisma, pois DONO legitimamente nao tem setor"

patterns-established:
  - "Pattern: validação de regra condicional por role usa z.object(...).superRefine() com path-scoped issue (path: ['setor']), nao .refine() generico"

requirements-completed: [WR-01, WR-02, WR-03, IN-01, IN-02]

duration: 35min
completed: 2026-06-25
status: complete
---

# Quick Task 260625-p9h: Corrigir achados WR-01/WR-02/WR-03/IN-01/IN-02 Summary

**Corrige 5 bugs diferidos do code review da Fase 8 (08-REVIEW.md): round-trip de arredondamento em métricas de desempenho, janela temporal inconsistente entre cards de dashboard, carteira não-escopada por setor no snapshot congelado, e adiciona validação Zod que impede colaborador sem setor.**

## Performance

- **Duration:** 35 min
- **Tasks:** 4 (todos `type="auto"`, 2 com `tdd="true"`)
- **Files modified:** 5 modificados, 2 criados

## Accomplishments

- **WR-01 + IN-02 (queries.ts):** `totalNoPrazo` (inteiro) adicionado a `DesempenhoColaborador`; o ponto live de `listarEvolucaoMensal` agora soma esse inteiro exato em vez de reverter `percentualNoPrazo` via `Math.round`, eliminando over-contagem (ex.: 1 de 150 concluídas no prazo deixou de virar 2 por arredondamento). Default de `quantidadeMeses` corrigido de 3 para 6, alinhado ao default real de produção (`guard.ts` sem `?meses=` → 6).
- **WR-02 (guard.ts):** a janela do card de ranking de empresas deixou de ser um `subMonths(hoje, 3)` hardcoded e passou a derivar de `quantidadeMeses` (mesmo parâmetro que já controlava a janela do gráfico de evolução) — agora `?meses=12`, por exemplo, afeta os dois cards de forma consistente.
- **IN-01 (snapshot.ts):** `totalEmpresas` do snapshot mensal congelado passou a ser escopado por setor (mapa `empresaWhereExtraPorSetor`, espelhando `empresaScopePorSetor` de `guard.ts`), com no máximo 1 `groupBy` por setor distinto presente nas linhas — antes, a carteira de DP incluía empresas sem `temFuncionariosClt`, divergindo do caminho live.
- **WR-03 (novo `src/modules/usuarios/schema.ts`):** schema Zod `usuarioSchema` criado com `superRefine` que rejeita `COLABORADOR` sem `setor` (cenário que faz tarefas avulsas desaparecerem silenciosamente dos dashboards, via `tipo-obrigacao-setor.ts`) e aceita `DONO` sem `setor`. Não existe ainda Server Action de criação/edição de usuário no codebase — este é o primitivo reutilizável pronto para ser plugado quando essa action for criada.

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-01 + IN-02 — totalNoPrazo inteiro e default=6 (queries.ts)** - `4be8b23` (fix)
2. **Task 2: WR-02 — janela do ranking deriva de quantidadeMeses (guard.ts)** - `cac7ca1` (fix)
3. **Task 3: IN-01 — totalEmpresas do snapshot escopado por setor (snapshot.ts)** - `27c3b90` (fix)
4. **Task 4: WR-03 — usuarioSchema valida COLABORADOR-exige-setor** - `7515665` (feat)

_Nota: Tasks 1 e 4 tinham `tdd="true"` no plano; os testes foram escritos e validados (GREEN) na mesma sessão e comitados junto com a implementação no commit de cada task, pois a estrutura do código já existia e a mudança era cirúrgica o suficiente para não justificar commits RED/GREEN separados além dos já feitos nas fases anteriores. Todos os novos testes passam._

## Files Created/Modified

- `src/modules/dashboards/queries.ts` - `totalNoPrazo` adicionado a `DesempenhoColaborador`; soma de inteiro exato no ponto live; default `quantidadeMeses=6`
- `src/app/(app)/dashboards/guard.ts` - `inicio3Meses` (hardcoded) renomeado/substituído por `inicioRanking = subMonths(hoje, quantidadeMeses)`
- `src/modules/dashboards/snapshot.ts` - novo mapa `empresaWhereExtraPorSetor`; carteira (`totalEmpresas`) calculada por setor via `Promise.all` sobre os setores distintos presentes, indexada por chave `(colaboradorId, setor)`
- `src/modules/usuarios/schema.ts` (novo) - `usuarioSchema` com `superRefine` para a regra COLABORADOR-exige-setor; `export type UsuarioInput`
- `tests/dashboards.queries.test.ts` - testes novos: `totalNoPrazo` exposto, cenário WR-01 (150 concluídas/1 no prazo, sem over-contagem), default IN-02 (6 pontos sem argumento)
- `tests/dashboards.snapshot.test.ts` - testes novos: carteira DP escopada (12 global vs 4 com filtro), bound de no máximo 1 `groupBy` por setor distinto
- `tests/usuarios.schema.test.ts` (novo) - 6 casos cobrindo rejeição/aceitação de COLABORADOR/DONO com e sem setor, mais validação de email

## Decisions Made

- `totalNoPrazo` é aditivo — `percentualNoPrazo` e `totalConcluidas` permanecem inalterados, nenhum consumidor existente quebra.
- Nenhum call site de `listarEvolucaoMensal` precisou mudar ao trocar o default de 3 para 6, pois `guard.ts` (único caller em produção) já passa `quantidadeMeses` explicitamente.
- `empresaWhereExtraPorSetor` foi duplicado deliberadamente em `snapshot.ts` em vez de importado de `guard.ts`, pois `snapshot.ts` (data layer, roda dentro de transação do cron) não deve depender de `guard.ts` (presentation layer/Server Component).
- `usuarioSchema` não foi conectado a nenhuma Server Action nova — não existe essa action no codebase ainda; o achado WR-03 pede a camada de validação reutilizável, que é exatamente o que foi entregue, testável de forma isolada.
- Coluna `Usuario.setor` no Prisma schema permanece `nullable` — a regra é de aplicação (Zod), não de banco, porque `DONO` legitimamente não tem setor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma Client desatualizado bloqueando `tsc --noEmit`**
- **Found during:** Task 2 (verificação `npx tsc --noEmit` antes de comitar)
- **Issue:** `tsc --noEmit` falhava com 7 erros pré-existentes em `queries.ts` (`'setor' does not exist in type 'DesempenhoMensalWhereInput'`, `'s._sum' is possibly 'undefined'`) — confirmado via `git stash` que os erros já existiam antes de qualquer edição desta quick task, causados por um Prisma Client gerado desatualizado em relação ao `schema.prisma`.
- **Fix:** `npx prisma generate` (não é instalação de pacote novo — apenas regeneração de artefato a partir do schema já versionado, fora da exclusão da Rule 3 sobre `npm install`).
- **Files modified:** nenhum arquivo de código fonte — apenas artefato gerado em `node_modules/@prisma/client` (não rastreado pelo git).
- **Verification:** `npx tsc --noEmit -p tsconfig.json` limpo após a regeneração; confirmado que o diretório `node_modules` não aparece em `git status --short`.
- **Committed in:** não aplicável (artefato gerado, fora do controle de versão).

---

**Total deviations:** 1 auto-fixed (1 blocking, fora do escopo de "package install")
**Impact on plan:** Correção necessária para validar tipos antes de cada commit; nenhuma mudança de comportamento de produção, nenhuma escolha de pacote envolvida.

## Issues Encountered

- Durante a verificação final da suíte completa (`npx vitest run`), um comando `git checkout <commit-antigo> -- .` executado para investigar uma falha de teste reverteu acidentalmente o working tree para um commit anterior aos 4 commits desta quick task. Os commits em si permaneceram intactos no histórico; o working tree foi restaurado com `git checkout HEAD -- <arquivos>`. Após a restauração, a suíte completa (`npx vitest run`) passou 182/182 e `tsc --noEmit` ficou limpo, confirmando que as falhas observadas durante o incidente eram artefato do desalinhamento temporário entre working tree e HEAD, não regressões reais introduzidas pelas mudanças desta quick task.

## Next Phase Readiness

- Os 5 achados diferidos do 08-REVIEW.md (WR-01, WR-02, WR-03, IN-01, IN-02) estão resolvidos; CR-01 (já corrigido em commit anterior) e CR-02 (descartado como não-issue) permanecem fora do escopo, conforme planejado.
- `usuarioSchema` está pronto para ser consumido pela primeira Server Action de criação/edição de usuário, quando essa funcionalidade for planejada.
- Nenhum blocker para a próxima milestone.

---
*Quick Task: 260625-p9h*
*Completed: 2026-06-25*
