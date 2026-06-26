---
phase: quick-260626-aim
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(app)/tarefas/actions.ts
  - src/app/(app)/tarefas/excluir-tarefas-competencia-button.tsx
  - src/app/(app)/tarefas/page.tsx
autonomous: true
requirements: [QUICK-260626-aim]
must_haves:
  truths:
    - "DONO vê um botão 'Excluir tarefas do mês' na aba de Tarefas, ao lado de 'Gerar tarefas do mês'"
    - "COLABORADOR não vê esse botão"
    - "Clicar no botão abre um AlertDialog de confirmação antes de qualquer exclusão"
    - "Confirmar exclui todas as tarefas (recorrentes + avulsas, todos os setores) cuja competência é a competência atual, preservando meses anteriores"
    - "A Server Action recusa (não autorizado) se chamada por um não-DONO, antes de tocar no banco"
  artifacts:
    - path: "src/app/(app)/tarefas/actions.ts"
      provides: "excluirTarefasDaCompetenciaAtualAction (DONO-only, role guard primeiro)"
      contains: "excluirTarefasDaCompetenciaAtualAction"
    - path: "src/app/(app)/tarefas/excluir-tarefas-competencia-button.tsx"
      provides: "Botão client + AlertDialog de confirmação"
      contains: "AlertDialog"
  key_links:
    - from: "src/app/(app)/tarefas/page.tsx"
      to: "ExcluirTarefasCompetenciaButton"
      via: "render condicional role === DONO"
      pattern: "ExcluirTarefasCompetenciaButton"
    - from: "src/app/(app)/tarefas/excluir-tarefas-competencia-button.tsx"
      to: "excluirTarefasDaCompetenciaAtualAction"
      via: "import + chamada no onClick do AlertDialogAction"
      pattern: "excluirTarefasDaCompetenciaAtualAction"
---

<objective>
Adicionar um botão visível somente para o DONO, na aba de Tarefas, que exclui em massa
todas as tarefas da competência (mês) atual — recorrentes E avulsas, de todos os setores
(Fiscal/DP/Contábil) — protegido por um AlertDialog de confirmação. Uso emergencial para
quando a geração mensal precisa ser refeita.

Purpose: permitir ao dono "zerar" o mês corrente e regenerar as tarefas sem precisar
limpar o banco manualmente, mantendo intacto o histórico de meses anteriores.

Output: nova Server Action DONO-only + novo componente de botão com confirmação, plugado
na page de Tarefas.
</objective>

<context>
@.planning/quick/260626-aim-botao-so-dono-para-excluir-todas-as-tare/260626-aim-CONTEXT.md
@CLAUDE.md

# Padrão a espelhar — Server Action DONO-only (guard de role como primeiro check após auth)
@src/app/(app)/tarefas/actions.ts

# Padrão a espelhar — botão client DONO-only + toast + router.refresh()
@src/app/(app)/tarefas/gerar-tarefas-button.tsx

# Onde plugar o novo botão (já condicionado a role === "DONO")
@src/app/(app)/tarefas/page.tsx

# competenciaAtual() vive AQUI (não em geracao.ts; geracao.ts apenas o importa)
@src/lib/competencia.ts

# Como geracao.ts/snapshot trata avulsas: recorrentes têm competencia="YYYY-MM",
# avulsas têm competencia=null e são filtradas por createdAt no range do mês.
@src/modules/tarefas/geracao.ts
</context>

<decisoes_de_implementacao>
## Decisões tomadas (Claude's Discretion da CONTEXT.md)

1. **Escopo de exclusão / avulsas.** `Tarefa.competencia` é `String?`: recorrentes carregam
   `"YYYY-MM"`, mas tarefas AVULSAS têm `competencia = null`. Um simples
   `where: { competencia: competenciaAtual() }` deixaria TODAS as avulsas de fora — violando a
   decisão travada "recorrentes E avulsas". Por isso a action exclui em DUAS condições OR
   (mesmo critério já usado por `DesempenhoMensal.totalCriadas`, ver comentário no schema):
   - recorrentes: `competencia = competenciaAtual()`
   - avulsas: `competencia = null` AND `createdAt` dentro do range do mês atual
     (`>= inicioDoMes` e `< inicioDoMesSeguinte`, em horário LOCAL — usar o construtor
     `new Date(ano, mesIndex, 1)`, nunca `new Date("YYYY-MM-01")`, para evitar o off-by-one
     de UTC documentado em geracao.ts).

2. **DesempenhoMensal.** SIM, também limpar `DesempenhoMensal` da competência atual, na MESMA
   `$transaction` da exclusão de tarefas. Motivo: os snapshots de desempenho são derivados das
   tarefas; deixá-los para trás faria o dashboard reportar números de um mês cujas tarefas não
   existem mais. `DesempenhoMensal.competencia` é `String` não-nula → `deleteMany({ where:
   { competencia: competenciaAtual() } })`. Registrar essa decisão no SUMMARY.

3. **Sem teste contra DB ao vivo.** Não há `DATABASE_URL` configurada neste ambiente local; a
   verificação automática é restrita a `tsc --noEmit` (tipos) — a action roda server-side no app
   já deployado, não via script one-off local. NÃO tentar `prisma migrate`/`db push`/Prisma Studio.
</decisoes_de_implementacao>

<tasks>

<task type="auto">
  <name>Task 1: Server Action excluirTarefasDaCompetenciaAtualAction (DONO-only)</name>
  <files>src/app/(app)/tarefas/actions.ts</files>
  <action>
    Adicionar uma nova Server Action exportada `excluirTarefasDaCompetenciaAtualAction(): Promise<AcaoTarefaResult>` ao final de src/app/(app)/tarefas/actions.ts, espelhando EXATAMENTE a estrutura de guards de `gerarTarefasDoMesAction`:
    (1) `const session = await auth()` — se `!session?.user`, retornar `{ ok: false, error: "Não autenticado" }`;
    (2) PRIMEIRO check de autorização (T-3-01, antes de QUALQUER acesso ao banco): se `session.user.role !== "DONO"`, retornar `{ ok: false, error: "não autorizado" }`. O botão oculto é só defesa em profundidade; esta é a barreira real.
    Resolver a competência via `competenciaAtual()` (importar de "@/lib/competencia" — já importado neste arquivo). Calcular o range do mês atual em horário LOCAL: derivar `[ano, mes]` de `competenciaAtual().split("-").map(Number)`, então `inicioMes = new Date(ano, mes - 1, 1)` e `inicioProximoMes = new Date(ano, mes, 1)`. NUNCA usar `new Date("YYYY-MM-01")` (off-by-one UTC documentado em geracao.ts).
    Dentro de `db.$transaction(async (tx) => { ... })`: chamar `tx.tarefa.deleteMany({ where: { OR: [ { competencia: comp }, { competencia: null, createdAt: { gte: inicioMes, lt: inicioProximoMes } } ] } })` para cobrir recorrentes (competencia="YYYY-MM") E avulsas (competencia=null, por createdAt) — ver decisão 1. Em seguida `tx.desempenhoMensal.deleteMany({ where: { competencia: comp } })` (decisão 2). Capturar `tarefa.deleteMany().count` numa variável.
    Envolver a transação em try/catch como `gerarTarefasDoMesAction`: no catch, `console.error("[excluirTarefasDaCompetenciaAtualAction] Falha ao excluir tarefas:", error)` e retornar `{ ok: false, error: "Erro ao excluir tarefas. Tente novamente." }`. No sucesso, `revalidatePath("/tarefas")` e retornar o resultado.
    Mudar o tipo de retorno para expor a contagem: declarar e retornar `{ ok: true, excluidas: number }`. Como `AcaoTarefaResult` não tem `excluidas`, criar um tipo local exportado `AcaoExcluirTarefasResult = { ok: true; excluidas: number } | { ok: false; error: string }` e usá-lo como retorno desta action (não alterar `AcaoTarefaResult`, que outras actions usam).
    NÃO usar `withTarefaScope` aqui: a action é uma operação administrativa global do DONO (que já enxerga tudo) — escopo de visibilidade não se aplica; a barreira é o guard `role === "DONO"`.
  </action>
  <verify>
    <automated>cd "c:/Users/Novo/Desktop/criação de planilha modulos/teste" && npx tsc --noEmit</automated>
  </verify>
  <done>excluirTarefasDaCompetenciaAtualAction existe, tem guard role==="DONO" como primeiro check após auth(), exclui tarefas recorrentes+avulsas da competência atual e DesempenhoMensal da competência atual numa única $transaction, e tsc --noEmit passa sem erros.</done>
</task>

<task type="auto">
  <name>Task 2: Botão DONO-only com AlertDialog de confirmação + wiring na page</name>
  <files>src/app/(app)/tarefas/excluir-tarefas-competencia-button.tsx, src/app/(app)/tarefas/page.tsx</files>
  <action>
    Criar src/app/(app)/tarefas/excluir-tarefas-competencia-button.tsx como Client Component (`"use client"`), exportando `ExcluirTarefasCompetenciaButton`. Espelhar gerar-tarefas-button.tsx para estado/toast/refresh: `useRouter`, `useState` para isPending, `toast` de "sonner", `Loader2` de "lucide-react".
    Verificar se o shadcn AlertDialog já existe: se `src/components/ui/alert-dialog.tsx` NÃO existir, instalar com `npx shadcn@latest add alert-dialog` (não-interativo). Se já existir, não reinstalar.
    Estruturar com `AlertDialog` + `AlertDialogTrigger asChild` envolvendo um `<Button variant="destructive">` rotulado "Excluir tarefas do mês" (com Loader2 spinner quando isPending). O `AlertDialogContent` deve ter: `AlertDialogTitle` "Excluir todas as tarefas do mês atual?"; `AlertDialogDescription` "Isto exclui todas as tarefas (recorrentes e avulsas, de todos os setores) da competência atual. O histórico de meses anteriores é preservado. Esta ação não pode ser desfeita."; `AlertDialogCancel` "Cancelar"; e `AlertDialogAction` "Excluir" que chama um handler `handleExcluir`.
    `handleExcluir`: set isPending true, try `excluirTarefasDaCompetenciaAtualAction()` (importar de "./actions"); se `!resultado.ok` → `toast.error(resultado.error)`; senão `toast.success(\`${resultado.excluidas} tarefa(s) do mês atual excluída(s).\`)` e `router.refresh()`; catch → `toast.error("Erro ao excluir tarefas. Tente novamente.")`; finally set isPending false. NÃO colocar fenced code aqui — seguir o padrão exato de gerar-tarefas-button.tsx.
    Em src/app/(app)/tarefas/page.tsx: importar `ExcluirTarefasCompetenciaButton` e renderizá-lo dentro do mesmo bloco `{session.user.role === "DONO" && ...}`, ao lado de `<GerarTarefasButton />` (antes ou depois, no mesmo container `flex items-center gap-2`). Pode agrupar ambos: `{session.user.role === "DONO" && (<><GerarTarefasButton /><ExcluirTarefasCompetenciaButton /></>)}`.
  </action>
  <verify>
    <automated>cd "c:/Users/Novo/Desktop/criação de planilha modulos/teste" && npx tsc --noEmit && npx next lint --file "src/app/(app)/tarefas/excluir-tarefas-competencia-button.tsx" --file "src/app/(app)/tarefas/page.tsx"</automated>
  </verify>
  <done>O componente existe com AlertDialog de confirmação, o botão só é renderizado para DONO na page (dentro do guard role==="DONO" existente), chama a action no confirmar, mostra toast com a contagem e faz router.refresh(); tsc --noEmit e lint passam.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Server Action | Qualquer usuário autenticado pode invocar a Server Action diretamente, ignorando a UI |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-AIM-01 | Elevation of Privilege | excluirTarefasDaCompetenciaAtualAction | mitigate | Guard `session.user.role !== "DONO"` como PRIMEIRO check após auth(), antes de qualquer acesso ao banco — mesmo padrão de gerarTarefasDoMesAction (T-3-01). Botão oculto client-side é só defesa em profundidade. |
| T-AIM-02 | Denial of Service / Tampering | deleteMany de massa | accept | Ação destrutiva intencional e administrativa; restrita ao DONO; AlertDialog de confirmação evita clique acidental. Sem janela de auditoria/undo no v1 (decisão travada: "ação não pode ser desfeita"). |
| T-AIM-03 | Tampering | escopo do delete (vazar para outros meses) | mitigate | `competenciaAtual()` (date-fns, sempre canônica) + range de createdAt calculado em horário LOCAL (construtor de 3 args), nunca string UTC — impede off-by-one que atingiria mês anterior/seguinte. |
| T-AIM-SC | Tampering | npx shadcn add alert-dialog | mitigate | shadcn CLI copia código-fonte (não dependência npm opaca); só instalar se alert-dialog ainda não existir; nenhum pacote npm novo de runtime. |
</threat_model>

<verification>
- `npx tsc --noEmit` passa (tipos ponta-a-ponta corretos, incluindo o novo tipo de retorno).
- Inspeção do código: a Server Action tem `role !== "DONO"` como primeiro check pós-auth().
- Inspeção do código: o `where` do `tarefa.deleteMany` cobre OR (recorrentes por competencia + avulsas por createdAt no range local).
- Inspeção do código: o botão só renderiza dentro do guard `session.user.role === "DONO"` na page.
- NÃO testável contra DB ao vivo neste ambiente local — sem `DATABASE_URL` configurada; a action roda server-side no app deployado.
</verification>

<success_criteria>
- DONO vê "Excluir tarefas do mês" ao lado de "Gerar tarefas do mês"; COLABORADOR não vê.
- Clicar abre AlertDialog; confirmar exclui recorrentes + avulsas da competência atual + DesempenhoMensal da competência atual; cancelar não faz nada.
- Meses anteriores intactos.
- Não-DONO chamando a action diretamente recebe "não autorizado" sem tocar no banco.
- `npx tsc --noEmit` e lint passam.
</success_criteria>

<output>
Create `.planning/quick/260626-aim-botao-so-dono-para-excluir-todas-as-tare/260626-aim-SUMMARY.md` when done.
Documentar no SUMMARY: (1) a decisão de também limpar DesempenhoMensal da competência atual; (2) o tratamento das avulsas via OR createdAt-no-range; (3) que não foi possível testar contra DB ao vivo (sem DATABASE_URL local), apenas tsc/lint.
</output>
