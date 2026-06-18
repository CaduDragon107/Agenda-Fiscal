---
phase: 02-gest-o-de-tarefas-avulsas-detalhe-e-alertas
verified: 2026-06-17T13:15:00Z
status: gaps_found
score: 17/19 must-haves verified
overrides_applied: 0
gaps:
  - truth: "npx vitest run completa sem falhas (suite completa verde)"
    status: failed
    reason: "2 testes falham na suite completa: tarefas.crud.test.ts 'cria tarefa com todos os campos obrigatórios' e tarefas.idor.test.ts 'COLABORADOR não pode criar tarefa para empresa de outro colaborador'. Causa raiz: CR-01/WR-04 adicionaram db.empresa.findFirst ao criarTarefa (actions.ts:67) mas o mock de db em tarefas.crud.test.ts não inclui db.empresa. O teste de IDOR usa vi.doMock que não substitui o módulo cacheado; empresaFindFirstMock.mock.calls permanece 0."
    artifacts:
      - path: "tests/tarefas.crud.test.ts"
        issue: "vi.mock('@/lib/db') não inclui db.empresa — TypeError: Cannot read properties of undefined (reading 'findFirst') ao chamar criarTarefa"
      - path: "tests/tarefas.idor.test.ts"
        issue: "vi.doMock não substitui o vi.mock hoisted — empresaFindFirstMock nunca é chamado, assertion falha com 'expected vi.fn() to be called' (0 calls)"
    missing:
      - "Adicionar db.empresa: { findFirst: (...args) => empresaFindFirstMock(...args) } ao vi.mock('@/lib/db') em tarefas.crud.test.ts (dentro do describe 'criarTarefa')"
      - "Substituir vi.doMock por mock inline no beforeEach ou reestruturar o mock inicial em tarefas.idor.test.ts para incluir db.empresa no vi.mock hoisted"
---

# Phase 02: Gestão de Tarefas Avulsas, Detalhe e Alertas — Verification Report

**Phase Goal:** Equipe consegue criar e acompanhar tarefas avulsas por empresa, marcar como concluída, ver o detalhe com dados da empresa vinculada, e receber alertas visuais de prazo — sem perder nenhuma tarefa urgente.
**Verified:** 2026-06-17T13:15:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | npx prisma validate retorna sem erros após adicionar Tarefa + TarefaHistorico | VERIFIED | `prisma/schema.prisma` contém `model Tarefa` (linhas 80-100), `model TarefaHistorico` (102-112), `enum TarefaStatus` (25-28), relações inversas em Usuario e Empresa confirmadas |
| 2 | calcularAlertaPrazo retorna emoji 🔴 e label 'Atrasada' para prazo passado + PENDENTE | VERIFIED | `src/lib/alert-prazo.ts` linhas 51-58; 5/5 testes passam em `tests/alert-prazo.test.ts` |
| 3 | calcularAlertaPrazo retorna emoji 🟡 e label 'Prazo próximo' para prazo <= now+3d + PENDENTE | VERIFIED | `src/lib/alert-prazo.ts` linhas 61-68; coberto pelo teste de amanhã e pelo caso limite de 3 dias |
| 4 | calcularAlertaPrazo retorna sem emoji para prazo > now+3d ou status CONCLUIDA | VERIFIED | `src/lib/alert-prazo.ts` linhas 39-45 (CONCLUIDA), linha 73 (normal) |
| 5 | withTarefaScope retorna {} para DONO e { responsavelId: user.id } para COLABORADOR | VERIFIED | `src/lib/visibility-scope.ts` linhas 46-51; 4 casos passam em `tests/visibility-scope.test.ts` |
| 6 | listarTarefas(donoUser) retorna todas as tarefas do banco | VERIFIED | `src/modules/tarefas/queries.ts` linha 66-73 usa `...withTarefaScope(user)` que retorna `{}` para DONO |
| 7 | listarTarefas(colaboradorUser) retorna apenas tarefas do colaborador (anti-IDOR) | VERIFIED | Mesmo código; withTarefaScope retorna `{ responsavelId: user.id }` para COLABORADOR |
| 8 | buscarTarefaPorId retorna null para tarefa fora do escopo (anti-IDOR) | VERIFIED | `src/modules/tarefas/queries.ts` linhas 87-95 usa findFirst com escopo composto; 3/3 testes passam em `tests/tarefas.queries.test.ts` |
| 9 | criarTarefa sem título retorna { ok: false } | VERIFIED | `tarefaSchema` linha 24 (`min(1)`); 6/7 testes passam em `tests/tarefas.crud.test.ts` (somente o caso de sucesso falha por problema de mock) |
| 10 | concluirTarefa usa $transaction e é idempotente | VERIFIED | `src/app/(app)/tarefas/actions.ts` linhas 139-151 (transaction); linhas 133-136 (idempotência); 2/2 testes passam |
| 11 | concluirTarefa e excluirTarefa por COLABORADOR em tarefa alheia retornam { ok: false } | VERIFIED | 2/2 testes IDOR passam em `tests/tarefas.idor.test.ts` (describe "IDOR — concluirTarefa" e "IDOR — excluirTarefa") |
| 12 | npx vitest run completa sem falhas (suite completa verde) | FAILED | 2 testes falham — ver seção Gaps. Causa: mock de db.empresa ausente em tarefas.crud.test.ts e vi.doMock não substitui o mock hoisted em tarefas.idor.test.ts |
| 13 | Página /tarefas renderiza lista com sorting prazo ASC, filtros, checkbox e dialog de criação | VERIFIED | `src/app/(app)/tarefas/page.tsx` + `tarefas-table.tsx` + `nova-tarefa-dialog.tsx` existem e são substantivos; TanStack Table com getSortedRowModel e sorting initial `[{ id: "prazo", desc: false }]` |
| 14 | Badge de alertas na sidebar exibe contador correto (per D-09, D-10) | VERIFIED | `src/app/(app)/layout.tsx` linha 27 importa/chama `contarAlertasTarefas`; `app-sidebar.tsx` linhas 96-104 exibem badge condicional |
| 15 | /tarefas/[id] exibe detalhe completo (título, prazo, responsável, card empresa vinculada) | VERIFIED | `src/app/(app)/tarefas/[id]/page.tsx` com dois Cards em grid; campo `empresa` incluído no TAREFA_SELECT com nome, CNPJ, regime, responsavel, particularidades |
| 16 | Tarefa fora do escopo do COLABORADOR em /tarefas/[id] chama notFound() (anti-IDOR 404) | VERIFIED | `/tarefas/[id]/page.tsx` linha 59: `if (!tarefa) notFound()` |
| 17 | Botão Marcar como concluída aparece apenas para status PENDENTE | VERIFIED | `/tarefas/[id]/page.tsx` linha 203: `{tarefa.status === "PENDENTE" && <ConcluirButton>}` |
| 18 | TASK-06: descrição serve como instrução livre para passo a passo | VERIFIED | `/tarefas/[id]/page.tsx` linha 133-141: `{tarefa.descricao && ... whitespace-pre-wrap}`; campo `descricao` está no schema e no TAREFA_SELECT |
| 19 | loading.tsx exibe Skeleton no shape dos dois Cards | VERIFIED | `src/app/(app)/tarefas/[id]/loading.tsx` existe com estrutura de 2 Cards com Skeleton |

**Score:** 17/19 truths verified — 2 failed (test suite not clean)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---------|---------|--------|---------|
| `prisma/schema.prisma` | Tarefa + TarefaHistorico + TarefaStatus | VERIFIED | Todos os modelos, enum, indexes e relações inversas presentes |
| `src/lib/alert-prazo.ts` | calcularAlertaPrazo + AlertaPrazo | VERIFIED | Exporta ambos; helper puro sem dependências externas |
| `src/lib/visibility-scope.ts` | withTarefaScope + withVisibilityScope | VERIFIED | Ambas exportadas e com comportamento correto |
| `src/modules/tarefas/schema.ts` | tarefaSchema + TarefaInput | VERIFIED | tarefaSchema com validação strict (regex + isValid do date-fns) + transform para Date |
| `src/modules/tarefas/queries.ts` | listarTarefas, buscarTarefaPorId, contarAlertasTarefas | VERIFIED | Todas exportadas com TAREFA_SELECT sem senhaHash |
| `src/app/(app)/tarefas/actions.ts` | criarTarefa, concluirTarefa, excluirTarefa | VERIFIED | "use server"; guard sessão; anti-IDOR; Zod parse; try/catch em todas as DB calls |
| `src/app/(app)/tarefas/page.tsx` | Server Component da lista | VERIFIED | auth guard, Promise.all, userId prop passada para TarefasTable |
| `src/app/(app)/tarefas/tarefas-table.tsx` | Client Component com TanStack Table | VERIFIED | getSortedRowModel, sorting prazo ASC, filtros, checkbox, AlertDialog, PrazoCell com calcularAlertaPrazo |
| `src/app/(app)/tarefas/nova-tarefa-dialog.tsx` | Dialog + RHF + criarTarefa | VERIFIED | Schema sem transform no cliente; router.refresh após sucesso |
| `src/app/(app)/layout.tsx` | Importa contarAlertasTarefas | VERIFIED | Linha 10 importa, linha 27 chama, linha 31 passa para AppSidebar |
| `src/app/(app)/app-sidebar.tsx` | Item Tarefas como Link com badge | VERIFIED | SidebarMenuButton asChild com Link href="/tarefas" + badge condicional |
| `src/app/(app)/tarefas/[id]/page.tsx` | Detalhe da tarefa com card empresa | VERIFIED | Dois Cards, anti-IDOR, badge alerta, histórico, ConcluirButton condicional |
| `src/app/(app)/tarefas/[id]/loading.tsx` | Skeleton dos dois Cards | VERIFIED | Estrutura exata com 2 Cards e Skeletons |
| `src/app/(app)/tarefas/[id]/concluir-button.tsx` | Client Component com useTransition | VERIFIED | "use client"; useTransition; toast; router.refresh após sucesso |
| `tests/alert-prazo.test.ts` | 5 testes unitários verdes | VERIFIED | 5/5 passam |
| `tests/visibility-scope.test.ts` | Casos de withTarefaScope | VERIFIED | 4/4 passam (2 para withVisibilityScope + 2 para withTarefaScope) |
| `tests/tarefas.crud.test.ts` | Testes para criarTarefa, concluirTarefa, excluirTarefa | PARTIAL-STUB | 6/7 passam; "cria tarefa com todos os campos obrigatórios" falha — mock ausente de db.empresa |
| `tests/tarefas.idor.test.ts` | Testes IDOR para ações de tarefa | PARTIAL-STUB | 3/4 passam; "COLABORADOR não pode criar tarefa para empresa de outro" falha — vi.doMock não substitui mock hoisted |
| `tests/tarefas.queries.test.ts` | Testes para buscarTarefaPorId escopado | VERIFIED | 3/3 passam |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/lib/visibility-scope.ts` | `src/modules/tarefas/queries.ts` | withTarefaScope import | WIRED | queries.ts linha 2: `import { withTarefaScope } from "@/lib/visibility-scope"` — usado em listarTarefas, buscarTarefaPorId, contarAlertasTarefas |
| `src/lib/alert-prazo.ts` | `src/app/(app)/tarefas/tarefas-table.tsx` | calcularAlertaPrazo import | WIRED | tarefas-table.tsx linha 50: `import { calcularAlertaPrazo } from "@/lib/alert-prazo"` — usado em PrazoCell |
| `src/app/(app)/tarefas/actions.ts` | `src/modules/tarefas/schema.ts` | tarefaSchema.safeParse | WIRED | actions.ts linha 6: `import { tarefaSchema }` — usado na linha 45 |
| `src/app/(app)/tarefas/actions.ts` | `src/lib/visibility-scope.ts` | withTarefaScope import | WIRED | actions.ts linha 7: `import { withTarefaScope, withVisibilityScope }` — ambas usadas |
| `src/modules/tarefas/queries.ts` | `prisma/schema.prisma` | db.tarefa. | WIRED | queries.ts usa `db.tarefa.findMany`, `db.tarefa.findFirst`, `db.tarefa.count` |
| `src/app/(app)/tarefas/page.tsx` | `src/modules/tarefas/queries.ts` | listarTarefas import | WIRED | page.tsx linha 3: import + uso na linha 13 |
| `src/app/(app)/tarefas/nova-tarefa-dialog.tsx` | `src/app/(app)/tarefas/actions.ts` | criarTarefa import | WIRED | nova-tarefa-dialog.tsx linha 28: import + chamada na linha 76 |
| `src/app/(app)/layout.tsx` | `src/modules/tarefas/queries.ts` | contarAlertasTarefas import | WIRED | layout.tsx linha 10: import + chamada na linha 27 |
| `src/app/(app)/tarefas/[id]/page.tsx` | `src/modules/tarefas/queries.ts` | buscarTarefaPorId | WIRED | [id]/page.tsx linha 7: import + uso na linha 58 |
| `src/app/(app)/tarefas/[id]/page.tsx` | `src/lib/alert-prazo.ts` | calcularAlertaPrazo | WIRED | [id]/page.tsx linha 8: import + uso na linha 61 |
| `src/app/(app)/tarefas/[id]/page.tsx` | `src/app/(app)/tarefas/actions.ts` | concluirTarefa via ConcluirButton | WIRED | ConcluirButton em concluir-button.tsx linha 9: `import { concluirTarefa } from "../actions"` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---------|--------------|--------|--------------------|--------|
| `tarefas-table.tsx` | `tarefas: TarefaRow[]` | `listarTarefas(session.user)` em page.tsx | `db.tarefa.findMany` com TAREFA_SELECT (queries.ts linha 66) | FLOWING |
| `nova-tarefa-dialog.tsx` | `empresas`, `responsaveis` | `listarEmpresas(session.user)`, `listarResponsaveis()` em page.tsx | db.empresa.findMany e db.usuario.findMany em empresas/queries.ts | FLOWING |
| `[id]/page.tsx` | `tarefa` | `buscarTarefaPorId(session.user, id)` | `db.tarefa.findFirst` com TAREFA_SELECT incluindo `empresa`, `responsavel`, `historico` (queries.ts linha 87) | FLOWING |
| `app-sidebar.tsx` | `contadorAlertas: number` | `contarAlertasTarefas(session.user)` em layout.tsx | `db.tarefa.count` com filtro PENDENTE + prazo lte now+3d (queries.ts linha 103) | FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| TASK-03 | 02-01, 02-02, 02-03 | Marcar tarefa como concluída (checkbox simples) | SATISFIED | Checkbox em tarefas-table.tsx → concluirTarefa action → $transaction; ConcluirButton em /tarefas/[id] |
| TASK-04 | 02-01, 02-02, 02-03 | Criação de tarefas avulsas atribuíveis a qualquer pessoa | SATISFIED | NovaTarefaDialog + criarTarefa action com Zod validation; DONO pode atribuir a qualquer usuário; COLABORADOR somente a si |
| TASK-05 | 02-01, 02-02, 02-04 | Detalhe de cada tarefa: passo a passo, dados da empresa, histórico | SATISFIED | /tarefas/[id] com card empresa vinculada (nome, CNPJ formatado, regime colorido, responsável, particularidades) e seção histórico |
| TASK-06 | 02-04 | Passo a passo de ICMS/PIS-COFINS referencia ferramentas Python | PARTIALLY SATISFIED (deferred per CONTEXT.md) | campo `descricao` exibido com `whitespace-pre-wrap` serve como instrução livre; passo a passo estruturado com referência às ferramentas Python é Fase 3 — decisão de defer documentada no CONTEXT.md e na plan 02-04 |
| ALRT-01 | 02-01, 02-02, 02-03 | Alertas visuais para tarefas com prazo próximo ou atrasado | SATISFIED | calcularAlertaPrazo retorna emoji+badge por estado; usado em PrazoCell (tarefas-table.tsx) e em /tarefas/[id]/page.tsx; badge numérico na sidebar via contarAlertasTarefas |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/tarefas.crud.test.ts` | 22-33 | vi.mock('@/lib/db') sem db.empresa — criarTarefa agora chama db.empresa.findFirst (adicionado em CR-01 após os testes foram escritos) | Blocker | 1 teste falha: "cria tarefa com todos os campos obrigatórios" — TypeError ao tentar acessar findFirst em undefined |
| `tests/tarefas.idor.test.ts` | 128, 176 | vi.doMock dentro de teste não substitui o vi.mock hoisted — empresaFindFirstMock.mock.calls permanece 0 | Blocker | 1 teste falha: assertion sobre empresaFindFirstMock.toHaveBeenCalledWith não é satisfeita |

Nenhum marcador TBD/FIXME/XXX encontrado nos arquivos da fase. Os "placeholder" encontrados são atributos HTML de input (placeholder text de UI), não stubs de implementação.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---------|---------|--------|--------|
| calcularAlertaPrazo — 5 casos unitários passam | `npx vitest run tests/alert-prazo.test.ts` | 5/5 passed | PASS |
| withTarefaScope — DONO e COLABORADOR corretos | `npx vitest run tests/visibility-scope.test.ts` | 4/4 passed | PASS |
| buscarTarefaPorId escopado | `npx vitest run tests/tarefas.queries.test.ts` | 3/3 passed | PASS |
| criarTarefa, concluirTarefa, excluirTarefa | `npx vitest run tests/tarefas.crud.test.ts` | 6/7 passed — 1 falha | FAIL |
| Anti-IDOR concluir/excluir/criar | `npx vitest run tests/tarefas.idor.test.ts` | 3/4 passed — 1 falha | FAIL |
| Suite completa do projeto | `npx vitest run` | 59 passed, 2 failed (61 tests, 13 files) | FAIL |

### Gaps Summary

**Causa raiz única:** a correção CR-01 (commit `33f7725`) adicionou `db.empresa.findFirst` ao fluxo de `criarTarefa` para verificar ownership de empresa pelo colaborador — uma melhoria de segurança legítima. Porém, o mock de `db` em `tests/tarefas.crud.test.ts` não inclui `db.empresa`, causando `TypeError: Cannot read properties of undefined (reading 'findFirst')` no caso de sucesso de `criarTarefa`.

O fix WR-04 (commit `c17f075`) adicionou testes IDOR para `criarTarefa` em `tarefas.idor.test.ts` usando `vi.doMock`, mas `vi.doMock` não substitui um `vi.mock` hoisted anteriormente no mesmo arquivo — a instância de `db` na action já foi importada com o mock original (sem `empresa`), portanto o `empresaFindFirstMock` nunca é chamado.

**Impacto no goal:** baixo. A funcionalidade em si está corretamente implementada (actions.ts, queries.ts, UI). Os 2 testes que falham são de infraestrutura de teste (mocks incompletos), não indicam bugs de comportamento. O anti-IDOR para criarTarefa funciona corretamente — apenas o teste de verificação está quebrado.

**Correção mínima necessária:**
1. Em `tests/tarefas.crud.test.ts`: adicionar `empresa: { findFirst: (...args) => empresaFindFirstMock(...args) }` ao `vi.mock('@/lib/db')` e declarar/resetar `empresaFindFirstMock` no setup — mock deve retornar `{ id: "empresa_abc" }` no caso de sucesso (mockColaboradorUser cria tarefas para a própria empresa).
2. Em `tests/tarefas.idor.test.ts`: reestruturar para incluir `db.empresa` no vi.mock hoisted inicial (assim como os outros models), em vez de usar `vi.doMock` por suite.

### Human Verification Required

Todos os checks críticos de comportamento (fluxo de conclusão, badges de alerta, dialog de criação, filtros client-side) requerem verificação manual em browser pois dependem de estado de sessão real, banco Neon e interação de UI.

#### 1. Fluxo de criação e alerta de tarefa

**Test:** Fazer login como COLABORADOR. Clicar "Nova tarefa". Preencher com empresa própria, título "Teste Alerta", prazo = amanhã. Submeter.
**Expected:** Tarefa aparece na lista com badge amarelo 🟡 "Prazo próximo". Badge numérico aparece na sidebar.
**Why human:** Estado de sessão real + banco Neon + interação de UI com dialog

#### 2. Filtro "Responsável" visível somente para DONO

**Test:** Logar como COLABORADOR — verificar que a toolbar de /tarefas NÃO exibe o Select de responsável. Logar como DONO — verificar que o Select aparece com todos os usuários.
**Expected:** COLABORADOR vê apenas busca + toggle "Mostrar concluídas". DONO vê também o Select de responsável.
**Why human:** Depende de sessão real com role diferenciada

#### 3. Conclusão via checkbox e ocultação da lista

**Test:** Criar tarefa com prazo próximo. Clicar no checkbox ao lado dela. Verificar que desaparece da lista (filtro padrão oculta concluídas). Ativar "Mostrar concluídas" — verificar que reaparece com texto tachado.
**Expected:** Checkbox desabilita durante transição, desaparece da lista, reaparece com estilo de concluída ao exibir concluídas.
**Why human:** startTransition + estado de UI + render condicional com router.refresh

#### 4. Detalhe /tarefas/[id] com card empresa vinculada

**Test:** Clicar ícone Eye em uma tarefa. Verificar que /tarefas/[id] exibe: título, prazo com badge colorido, card "Empresa vinculada" com nome/CNPJ formatado/regime colorido/responsável/particularidades, botão "Marcar como concluída".
**Expected:** Todos os campos preenchidos com dados reais do banco. CNPJ no formato XX.XXX.XXX/XXXX-XX. Badge de regime colorido (azul/roxo/verde).
**Why human:** Renderização de dados reais do banco; formatação de CNPJ e regime verificável apenas visualmente

#### 5. Anti-IDOR em /tarefas/[id] para tarefa de outro colaborador

**Test:** Logar como COLABORADOR A. Tentar acessar URL /tarefas/[id] de uma tarefa pertencente ao COLABORADOR B.
**Expected:** Página 404 (not found), não 403 ou erro de servidor.
**Why human:** Requer dois usuários diferentes e URL real de tarefa alheia no banco

---

_Verified: 2026-06-17T13:15:00Z_
_Verifier: Claude (gsd-verifier)_
