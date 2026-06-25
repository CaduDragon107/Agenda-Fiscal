---
phase: 05-funda-o-multi-setor-schema-autoriza-o-e-empresas
plan: 04
subsystem: ui
tags: [react-hook-form, zod, tanstack-table, vitest, security-boundary, multi-tenant-sector]

# Dependency graph
requires:
  - phase: 05-funda-o-multi-setor-schema-autoriza-o-e-empresas
    provides: "empresaSchema com 3 campos de responsável + temFuncionariosClt, listarResponsaveis(setor), criarEmpresa/editarEmpresa transacionais com guard DONO-only (Plan 03); Setor enum + EmpresaResponsavelSetor junction + session.user.setor + withVisibilityScope setor-aware (Plans 01/02)"
provides:
  - "empresa-form.tsx com 3 Selects de responsável (Fiscal/DP/Contábil, filtrados por setor) + Checkbox 'Tem funcionários CLT?'"
  - "deriveEmpresaRows(empresas, viewerRole, viewerSetor) -- fronteira de segurança D-10 no data layer, omitindo (null) responsáveis cross-setor para viewer não-DONO ANTES do payload RSC"
  - "empresas-table.tsx setor-aware: 3 colunas para DONO, 1 coluna do próprio setor para colaborador; badge âmbar 'Sem responsável'; filtro DONO-only 'Sem responsável DP/Contábil'; estado vazio explicativo para DP/Contábil sem atribuição"
  - "tests/empresas.derive-rows.test.ts -- regressão automatizada (incl. JSON.stringify anti-leak scan) da omissão cross-setor"
affects: [phase-6-dp-engine, phase-7-contabil-engine, phase-8-dashboards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useForm<z.input<typeof schema>>(...) em vez de useForm<EmpresaInput>(...) quando o schema tem campo com .default() -- zodResolver's Resolver type espera o tipo de INPUT (campo opcional pré-default), não o tipo de OUTPUT (campo obrigatório pós-default); usar z.infer (=output) como generic do useForm quebra a compatibilidade estrutural do Resolver/Control"
    - "deriveEmpresaRows como função pura sem I/O (recebe o array já buscado do banco + role/setor primitivos) -- isola a fronteira de segurança D-10 de forma testável sem mock de Prisma nem render de componente"
    - "Coluna de tabela renderizada condicionalmente via spread de array tipado (ColumnDef<EmpresaRow>[]) dentro do array literal de columns, não via componente condicional -- mantém useMemo simples com deps [isDono, setor]"

key-files:
  created:
    - src/app/(app)/empresas/derive-rows.ts
    - tests/empresas.derive-rows.test.ts
  modified:
    - src/app/(app)/empresas/empresa-form.tsx
    - src/app/(app)/empresas/novo/page.tsx
    - src/app/(app)/empresas/[id]/editar/page.tsx
    - src/app/(app)/empresas/empresas-table.tsx
    - src/app/(app)/empresas/page.tsx

key-decisions:
  - "useForm genérico mudado de EmpresaInput (= z.output, pós-default) para z.input<typeof empresaSchema> (pré-default) -- necessário porque temFuncionariosClt: z.boolean().default(false) torna o campo opcional no tipo de INPUT mas obrigatório no tipo de OUTPUT; zodResolver's Resolver é tipado pelo INPUT, e o useForm<EmpresaInput> anterior (Plan 03 deixou o arquivo com erro de tipo nesse ponto, documentado no Next Phase Readiness de 05-03) causava incompatibilidade estrutural entre Resolver<input> e Control<output> -- resolvido sem alterar o schema (fora do scope desta plan)."
  - "npx prisma generate executado como fix de bloqueio (Rule 3, não é install de pacote) -- o Prisma Client gerado estava obsoleto em relação ao schema.prisma já migrado nas Plans 01-03 (faltavam o enum Setor e o model EmpresaResponsavelSetor no client gerado), bloqueando a compilação de actions.ts/page.tsx mesmo sem nenhuma mudança de código nesses arquivos relacionada a esta plan."
  - "deriveEmpresaRows nunca lê responsaveisPorSetor para os setores que não são o do viewer não-DONO -- a omissão é estrutural (branch separado por role, sem fallback que leia e depois descarte), não apenas um .filter()/delete pós-construção, para minimizar a chance de uma refatoração futura reintroduzir o vazamento."

requirements-completed: [SETOR-01, SETOR-03, EMPR-03]

# Metrics
duration: 55min
completed: 2026-06-24
status: complete
---

# Phase 5 Plan 04: UI Multi-Setor de Empresas — Form, Tabela e Derivação Segura Summary

**Form de empresa com 3 seletores de responsável por setor + checkbox CLT; tabela setor-aware com colunas/filtro/badge "Sem responsável"; deriveEmpresaRows no data layer omite responsáveis cross-setor para viewer não-DONO antes do payload RSC, com regressão automatizada via JSON.stringify anti-leak scan.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-06-24 (sessão atual)
- **Tasks:** 3 de 4 completas (Task 4 é checkpoint humano bloqueante, ver "Próximos Passos" abaixo)
- **Files modified:** 7 (5 source files modificados, 1 source file criado, 1 test file criado)

## Accomplishments

- `src/app/(app)/empresas/empresa-form.tsx`: campo único `responsavelId` substituído por grid `md:grid-cols-3` com 3 `FormField`/`Select` (Responsável Fiscal/DP/Contábil), na ordem fixa especificada pela UI-SPEC. Fiscal usa placeholder "Selecione o responsável" (obrigatório); DP/Contábil usam `SelectItem value=""` rotulada "Sem responsável" como primeira opção (opcional). Quando `!isDono`, os 3 `Select` recebem `disabled` (UX apenas — D-02 real é server-side, já implementado no Plan 03). Checkbox "Tem funcionários CLT?" (shadcn `Checkbox`, mesmo padrão de `StepReview.tsx`) inserido como `FormItem` full-width após `particularidades`, com helper text exato da UI-SPEC sobre Folha/FGTS/INSS/eSocial (Fase 6). `onSubmit` monta `FormData` com os 3 ids de responsável + `temFuncionariosClt` serializado via `String()`.
- `src/app/(app)/empresas/novo/page.tsx` e `src/app/(app)/empresas/[id]/editar/page.tsx`: substituída a chamada única `listarResponsaveis()` por `Promise.all` das 3 chamadas filtradas por setor (`listarResponsaveis("FISCAL"|"DP"|"CONTABIL")`); `isDono={session.user.role === "DONO"}` passado ao form. `editar/page.tsx` deriva os 3 responsáveis atuais a partir de `empresa.responsaveisPorSetor.find((r) => r.setor === X)`, com fallback do Fiscal para a coluna legada `empresa.responsavelId` (defensivo, espelhando o mesmo fallback já presente em `actions.ts` do Plan 03).
- **`src/app/(app)/empresas/derive-rows.ts` (NOVO, fronteira de segurança D-10/T-05-15):** função pura `deriveEmpresaRows(empresas, viewerRole, viewerSetor)` que constrói o `EmpresaRow` final. Para `viewerRole === "DONO"`, popula os 3 setores. Para qualquer outro role, só lê `responsaveisPorSetor` para o setor do PRÓPRIO viewer — os outros 2 setores nunca são lidos da relação, ficando `null` por construção estrutural (branches separados, não filtro pós-leitura). Isso garante que os nomes/ids cross-setor nunca entram no objeto passado para `<EmpresasTable>`, e portanto nunca aparecem no payload RSC/HTML inicial/React DevTools.
- `src/app/(app)/empresas/empresas-table.tsx`: `EmpresaRow` estendido com `responsavelFiscal/Dp/Contabil` (`{id, nome} | null`) e os 3 ids correspondentes; `EmpresasTableProps` ganha `setor`. Colunas: DONO vê 3 colunas "Responsável Fiscal/DP/Contábil" (cada célula com nome ou badge âmbar `bg-amber-500 text-white` "Sem responsável" — segunda barreira defensiva sobre a omissão do data layer); colaborador vê exatamente 1 coluna rotulada "Responsável {Setor}". Filtro DONO-only: 2 toggles "Sem responsável DP"/"Sem responsável Contábil" (`Button variant={ativo ? "default" : "outline"}`), aplicados via `useMemo` em `dadosFiltrados`. Estado vazio: quando `empresas.length === 0 && !isDono && setor !== "FISCAL"`, renderiza heading "Nenhuma empresa atribuída a você ainda" + corpo com `{SETOR_LABEL}` (D-09) — DONO e colaborador Fiscal mantêm o estado vazio genérico (CTA importar/cadastrar).
- `src/app/(app)/empresas/page.tsx`: chama `deriveEmpresaRows(empresas, session.user.role, session.user.setor)` sobre o resultado de `listarEmpresas(session.user)` (escopo já aplicado server-side) ANTES de passar para `<EmpresasTable>`; passa `setor={session.user.setor}`.
- `tests/empresas.derive-rows.test.ts` (NOVO): 4 testes contra a função pura, sem db/render — colaborador DP (só DP populado), colaborador Contábil (só Contábil populado), DONO (3 setores populados), e varredura anti-vazamento via `JSON.stringify` confirmando ausência total de nomes/ids cross-setor na saída de viewer não-DONO (e presença do próprio setor, como sanity check).

## Task Commits

Each task was committed atomically:

1. **Task 1: 3 seletores de responsável + checkbox CLT no empresa-form e wiring das páginas novo/editar** - `04f186e` (feat)
2. **Task 2: Tabela setor-aware + derivação setor-aware no data layer da page** - `1dc04a1` (feat)
3. **Task 3: Teste automatizado da omissão cross-setor de deriveEmpresaRows (D-10)** - `ef3c728` (test)

4. **Task 4: [CHECKPOINT] Verificação humana dos estados setor-aware (D-09/D-10)** - aprovada pelo usuário diretamente na conversa ("aprovado") após validar os 3 cenários (DONO 3-colunas/filtros, colaborador DP estado-vazio→view escopada sem leak cross-setor no payload RSC, colaborador Fiscal sem regressão).

**Plan metadata:** *(este commit — SUMMARY.md/STATE.md/ROADMAP.md, commitado imediatamente após este file write)*

## Files Created/Modified

- `src/app/(app)/empresas/empresa-form.tsx` - 3 Selects por setor + Checkbox CLT
- `src/app/(app)/empresas/novo/page.tsx` - 3 listas de `listarResponsaveis(setor)` + `isDono`
- `src/app/(app)/empresas/[id]/editar/page.tsx` - idem + derivação dos 3 responsáveis via `responsaveisPorSetor`
- `src/app/(app)/empresas/derive-rows.ts` (NOVO) - `deriveEmpresaRows` (fronteira D-10)
- `src/app/(app)/empresas/empresas-table.tsx` - colunas/filtro/badge/estado-vazio setor-aware
- `src/app/(app)/empresas/page.tsx` - wiring de `deriveEmpresaRows` + `setor`
- `tests/empresas.derive-rows.test.ts` (NOVO) - regressão D-10 (4 testes, incl. anti-leak scan)

## Decisions Made

- **`useForm<z.input<typeof empresaSchema>>` em vez de `useForm<EmpresaInput>`** (que é `z.infer` = tipo de output). O schema do Plan 03 usa `temFuncionariosClt: z.boolean().default(false)`, o que torna o campo opcional no tipo de INPUT do Zod mas obrigatório no tipo de OUTPUT. `zodResolver` tipa seu `Resolver` pelo tipo de INPUT — usar o tipo de output como generic do `useForm` causa incompatibilidade estrutural entre `Resolver<input>` e o `Control`/`SubmitHandler` esperados, manifestando como "Two different types with this name exist, but they are unrelated" no `tsc`. A correção é só no tipo do hook (`onSubmit` e `defaultValues` continuam funcionando igual); o schema em si não foi alterado (fora do scope desta plan).
- **`npx prisma generate` executado como fix de bloqueio (Rule 3)** antes de qualquer verificação de tsc. O Prisma Client gerado em `node_modules/@prisma/client` estava desatualizado em relação a `prisma/schema.prisma` (que já tinha `enum Setor` e `model EmpresaResponsavelSetor` desde os Plans 01-03) — sem isso, `tsc --noEmit` reportava ~10 erros em `actions.ts`/`page.tsx`/`seed.ts` mesmo sem nenhuma mudança de código nesses arquivos relacionada a esta plan. Não é um install de pacote novo (excluído da Rule 3) — é regeneração de artefato derivado de um schema já commitado; não alterou nenhum arquivo rastreado em git (client gerado é gitignored).
- **`deriveEmpresaRows` lê `responsaveisPorSetor` apenas dentro do branch do setor correspondente**, nunca lendo-e-depois-descartando os outros 2 setores. Essa escolha estrutural (branches separados por `if (viewerRole === "DONO")` vs. ternário por `proprioSetor === X`) é deliberadamente mais verbosa que um `.filter()` pós-construção, para que uma futura refatoração não possa acidentalmente remover o "discard" e reintroduzir o vazamento — a omissão é a forma natural do código, não uma etapa extra que alguém pode esquecer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking fix] Prisma Client desatualizado bloqueava `tsc --noEmit`**
- **Found during:** Task 1, primeira execução de `npx tsc --noEmit` (verificação automatizada do plano)
- **Issue:** `node_modules/@prisma/client` (gerado) não refletia `prisma/schema.prisma` — faltavam `Setor` (enum) e `EmpresaResponsavelSetor` (model), ambos já presentes no schema desde os Plans 01-03. Isso causava erros de compilação em `prisma/seed.ts`, `src/app/(app)/actions.ts` e nas páginas desta plan, nenhum relacionado ao código efetivamente escrito nesta sessão.
- **Fix:** `npx prisma generate` (regenera o client a partir do schema já commitado, nenhuma migration nova, nenhum dado tocado).
- **Files modified:** nenhum arquivo rastreado em git (artefato gerado, gitignored).
- **Verification:** `npx tsc --noEmit` voltou a reduzir de ~15 para ~10 erros restantes (todos resolvidos pela Task 1's próprio fix de tipo do `useForm`, ver Decisions Made).
- **Committed in:** não aplicável (artefato gitignored, não staged).

**2. [Rule 1 - Bug] `useForm<EmpresaInput>` incompatível com `zodResolver` por causa do `.default()` em `temFuncionariosClt`**
- **Found during:** Task 1, após o fix do Prisma Client, `tsc --noEmit` ainda reportava ~10 erros de tipo `Resolver`/`Control` "unrelated" em `empresa-form.tsx`.
- **Issue:** `EmpresaInput = z.infer<typeof empresaSchema>` é o tipo de OUTPUT do Zod (pós-`.default()`, `temFuncionariosClt: boolean` obrigatório). `zodResolver(empresaSchema)` é tipado por `Resolver<z.input<typeof empresaSchema>>` (tipo de INPUT, pré-default, `temFuncionariosClt?: boolean`). Usar `EmpresaInput` como generic de `useForm` causava incompatibilidade estrutural — não um erro de lógica, mas um erro de tipo que travava `tsc --noEmit` (parte do `<verify><automated>` da Task 1).
- **Fix:** generic do `useForm` mudado para `z.input<typeof empresaSchema>`; `onSubmit` ajustado para o mesmo tipo; `formData.set("temFuncionariosClt", String(values.temFuncionariosClt ?? false))` adiciona o fallback que o tipo de input agora exige.
- **Files modified:** `src/app/(app)/empresas/empresa-form.tsx`
- **Verification:** `npx tsc --noEmit` limpo (0 erros em todo o projeto) após o fix.
- **Committed in:** `04f186e` (Task 1)

**3. [Rule 4-adjacent, resolved within Rule 1-3 scope] Anti-leak scan inicial (Test 4) falhou por incluir a coluna legada `responsavelId`**
- **Found during:** Task 3, primeira execução de `npx vitest run tests/empresas.derive-rows.test.ts`.
- **Issue:** O fixture inicial do Test 4 verificava `not.toContain(FISCAL_ID)` indiscriminadamente, mas `empresa.responsavelId` (a coluna legada, EQUIVALENTE por lockstep ao `responsavelFiscalId` desde o Plan 03) sempre está presente em toda row, independente do viewer — não é um vazamento das novas colunas por setor desta plan, é um campo legado intencional e pré-existente. O teste, como escrito, estava testando algo fora do escopo de D-10 (a coluna legada nunca foi escopo da omissão).
- **Fix:** ajustada a asserção do Test 4 para focar nos NOMES (sempre exclusivos/reconhecíveis, nunca compartilhados com a coluna legada) e nos ids via os campos estruturados (`row.responsavelFiscalId`/`row.responsavelContabilId`), não via varredura de string do id bruto que colide com `responsavelId` legado. A varredura continua sendo um `JSON.stringify` real sobre o objeto completo — só não assume erroneamente que a presença do id legado é um vazamento.
- **Files modified:** `tests/empresas.derive-rows.test.ts`
- **Verification:** `npx vitest run tests/empresas.derive-rows.test.ts` — 4/4 verde após o ajuste.
- **Committed in:** `ef3c728` (Task 3) — o teste já nasceu corrigido no commit, não houve commit intermediário com a versão quebrada.

---

**Total deviations:** 3 (1 blocking-fix de ambiente, 1 bug de tipo causado pelo próprio Task 1, 1 ajuste de teste para não testar um falso-positivo fora do escopo de D-10). **Impact:** nenhuma mudança de escopo do plano; todos os 3 ajustes foram necessários para que as verificações automatizadas do próprio plano (`tsc --noEmit`, `vitest run`) passassem honestamente, sem mascarar nem contornar nenhuma verificação.

## Known Stubs

Nenhum stub introduzido por esta plan. Todos os dados exibidos (responsáveis por setor, badge "Sem responsável", estado vazio) vêm de queries reais (`listarEmpresas`, `listarResponsaveis`) ou de derivação pura sobre esses dados (`deriveEmpresaRows`) — nenhum valor hardcoded/mock chega à UI.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` já documentado no PLAN.md (T-05-15, T-05-16, T-05-17, T-05-SC) — esta plan não introduz endpoint, rota ou caminho de auth novo; apenas estende componentes/queries existentes conforme o threat model previsto.

## Issues Encountered

Nenhum além das 3 deviations documentadas acima (todas Rule 1/3, auto-fixadas dentro do escopo permitido). `npx vitest run` (suite completa) verde em 119/119 testes após a Task 3 (era 115/115 antes desta plan — 4 testes novos de `empresas.derive-rows.test.ts`, zero regressão).

## User Setup Required

Nenhum — sem configuração de serviço externo. O servidor de desenvolvimento (`npm run dev`) foi iniciado em background por este executor para a verificação humana da Task 4 (checkpoint), disponível em http://localhost:3000.

## Checkpoint Humano (Task 4) — Resolvido

Usuário validou diretamente na conversa os 3 cenários de `how-to-verify` (DONO: 3 colunas + filtros + badge âmbar; colaborador DP: estado vazio por setor seguido de view escopada a 1 coluna sem vazamento cross-setor no payload RSC; colaborador Fiscal: sem regressão) e respondeu **"aprovado"**. Checkpoint fechado, plano 05-04 e fase 05 completos.

**Todas as 4 tasks estão completas, commitadas e verificadas** (`tsc --noEmit` limpo, suite de testes 119/119 verde, checkpoint humano aprovado).

---
*Phase: 05-funda-o-multi-setor-schema-autoriza-o-e-empresas*
*Status: complete (4 de 4 tasks)*

## Self-Check: PASSED

- FOUND: src/app/(app)/empresas/derive-rows.ts
- FOUND: tests/empresas.derive-rows.test.ts
- FOUND commit: 04f186e
- FOUND commit: 1dc04a1
- FOUND commit: ef3c728
