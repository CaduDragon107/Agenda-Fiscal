---
phase: quick-260618-kbg
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - src/modules/tarefas/queries.ts
  - src/app/(app)/tarefas/actions.ts
  - src/app/(app)/tarefas/[id]/page.tsx
  - src/app/(app)/tarefas/[id]/motivo-pendencia-form.tsx
autonomous: true
requirements: [QUICK-260618-kbg]
must_haves:
  truths:
    - "Ao abrir o detalhe de uma tarefa PENDENTE (icone de olho), o responsavel ve um campo de texto onde escreve o motivo de a tarefa ainda nao estar finalizada"
    - "O motivo digitado e salvo no banco e persiste apos refresh da pagina"
    - "Quando a tarefa esta CONCLUIDA, o motivo (se existir) aparece somente leitura, sem campo editavel"
    - "Um COLABORADOR nao consegue editar o motivo de uma tarefa fora do seu escopo (anti-IDOR server-side)"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "Campo motivoPendencia String? no model Tarefa"
      contains: "motivoPendencia"
    - path: "src/app/(app)/tarefas/actions.ts"
      provides: "Server Action salvarMotivoPendencia com guard de auth + anti-IDOR"
      contains: "salvarMotivoPendencia"
    - path: "src/app/(app)/tarefas/[id]/motivo-pendencia-form.tsx"
      provides: "Componente client com textarea + botao salvar (toast + router.refresh)"
      contains: "use client"
  key_links:
    - from: "src/app/(app)/tarefas/[id]/motivo-pendencia-form.tsx"
      to: "salvarMotivoPendencia"
      via: "import da action ../actions"
      pattern: "salvarMotivoPendencia"
    - from: "src/app/(app)/tarefas/[id]/page.tsx"
      to: "motivoPendencia"
      via: "buscarTarefaPorId (TAREFA_SELECT) renderiza o valor"
      pattern: "motivoPendencia"
---

<objective>
Adicionar um campo de "motivo de pendencia" na tarefa: um texto livre onde o responsavel registra por que a tarefa ainda nao foi finalizada. O campo e visivel e editavel no detalhe da tarefa (rota /tarefas/[id], acessada pelo icone de olho) enquanto a tarefa esta PENDENTE, e exibido somente-leitura quando CONCLUIDA.

Purpose: A equipe fiscal precisa documentar o motivo de tarefas em aberto (ex.: "aguardando documento do cliente", "sistema da prefeitura fora do ar"), dando contexto para o dono e para os colegas sem precisar de canal externo.

Output: Campo `motivoPendencia` no model Tarefa, Server Action `salvarMotivoPendencia` (com guard de auth + anti-IDOR no mesmo padrao de concluirTarefa/excluirTarefa), e um formulario client no detalhe da tarefa.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

# Schema e fonte de dados da tarefa
@prisma/schema.prisma
@src/modules/tarefas/queries.ts

# Padrao de Server Actions (auth guard, anti-IDOR via withTarefaScope, AcaoTarefaResult, revalidatePath)
@src/app/(app)/tarefas/actions.ts

# Detalhe da tarefa (Server Component) + padrao de componente client separado
@src/app/(app)/tarefas/[id]/page.tsx
@src/app/(app)/tarefas/[id]/concluir-button.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Adicionar campo motivoPendencia ao schema, expor na query e criar a Server Action</name>
  <files>prisma/schema.prisma, src/modules/tarefas/queries.ts, src/app/(app)/tarefas/actions.ts</files>
  <action>
1. Em `prisma/schema.prisma`, no `model Tarefa`, adicionar um campo nullable `motivoPendencia String?` (coloca-lo junto dos demais campos opcionais, ex.: logo apos `competencia String?`). Nao adicionar indice — campo de texto livre nao consultado.

2. Aplicar a mudanca no banco com `npx prisma db push` (NAO usar `prisma migrate dev`): o ambiente Neon nao tem shadow database e o projeto ja decidiu usar `db push` em 02-01/03-01 — ver STATE.md. Em seguida `npx prisma generate` (o db push normalmente ja regenera o client). Como o campo e nullable, nao ha perda de dados e nao e necessario `--accept-data-loss`.

3. Em `src/modules/tarefas/queries.ts`, dentro do objeto `TAREFA_SELECT`, adicionar `motivoPendencia: true` (junto de `descricao`/`status`). Isso expoe o valor tanto em `buscarTarefaPorId` quanto em `listarTarefas` sem nenhuma outra mudanca.

4. Em `src/app/(app)/tarefas/actions.ts`, adicionar uma nova Server Action `salvarMotivoPendencia(id: string, motivo: string): Promise<AcaoTarefaResult>` seguindo EXATAMENTE o padrao de `concluirTarefa`/`excluirTarefa` do mesmo arquivo:
   - Guard de autenticacao como primeira instrucao: `const session = await auth(); if (!session?.user) return { ok: false, error: "Não autenticado" }`.
   - Anti-IDOR (T-02-IDOR): `db.tarefa.findFirst({ where: { id, ...withTarefaScope(session.user) }, select: { id: true, status: true } })`; se `!existente` retornar `{ ok: false, error: "não encontrado" }` (nunca 403). Reusar `withTarefaScope` ja importado no topo do arquivo.
   - Regra de negocio (alinhada a D-05, que so deixa concluir quando PENDENTE): so permitir editar o motivo enquanto a tarefa esta PENDENTE. Se `existente.status === "CONCLUIDA"`, retornar `{ ok: false, error: "Tarefa concluída não pode ter o motivo alterado." }`.
   - Normalizar a entrada: `const valor = motivo.trim()`; gravar `null` quando vazio (`valor.length === 0 ? null : valor`) para manter o campo limpo. Limitar tamanho defensivamente: se `valor.length > 1000`, retornar `{ ok: false, error: "Motivo muito longo (máximo 1000 caracteres)." }`.
   - Update dentro de try/catch: `await db.tarefa.update({ where: { id }, data: { motivoPendencia: valorFinal } })`; no catch retornar `{ ok: false, error: "Erro ao salvar o motivo. Tente novamente." }`.
   - Apos sucesso: `revalidatePath("/tarefas"); revalidatePath(\`/tarefas/${id}\`); return { ok: true }` — mesmo conjunto de paths que `concluirTarefa`.
   - Adicionar um comentario JSDoc curto no mesmo estilo das outras actions citando T-02-IDOR e a regra "so PENDENTE edita".
  </action>
  <verify>
    <automated>cd "c:/Users/Novo/Desktop/criação de planilha modulos/teste" && npx tsc --noEmit</automated>
  </verify>
  <done>O model Tarefa tem `motivoPendencia String?`; `npx prisma db push` aplicado e client regenerado; `TAREFA_SELECT` retorna `motivoPendencia`; `salvarMotivoPendencia` existe em actions.ts com guard de auth, anti-IDOR via withTarefaScope, bloqueio quando CONCLUIDA, trim/limite de 1000, e revalidatePath; `npx tsc --noEmit` passa sem erros.</done>
</task>

<task type="auto">
  <name>Task 2: Formulario client de motivo + integracao no detalhe da tarefa</name>
  <files>src/app/(app)/tarefas/[id]/motivo-pendencia-form.tsx, src/app/(app)/tarefas/[id]/page.tsx</files>
  <action>
1. Criar `src/app/(app)/tarefas/[id]/motivo-pendencia-form.tsx` como componente `"use client"`, seguindo o padrao de `concluir-button.tsx` (mesma pasta): `useTransition`, `useRouter`, `toast` de "sonner", import de `Button` de `@/components/ui/button` e de `salvarMotivoPendencia` de `../actions`.
   - Props: `{ tarefaId: string; motivoInicial: string | null }`.
   - Estado local: `const [motivo, setMotivo] = useState(motivoInicial ?? "")`.
   - Renderizar um `<textarea>` com EXATAMENTE as mesmas classes usadas no textarea de descricao em `nova-tarefa-dialog.tsx` (`flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none`), `rows={3}`, `maxLength={1000}`, placeholder "Por que esta tarefa ainda nao foi finalizada? (ex.: aguardando documento do cliente)", `value={motivo}` e `onChange`. O textarea fica `disabled` durante `isPending`.
   - Botao "Salvar motivo" (mesmo estilo do ConcluirButton: `Loader2` animando quando `isPending`, senao um icone tipo `Save` de lucide-react). `disabled` quando `isPending` OU quando o valor nao mudou (`motivo.trim() === (motivoInicial ?? "").trim()`).
   - handler: `startTransition(async () => { const result = await salvarMotivoPendencia(tarefaId, motivo); if (!result.ok) toast.error("Não foi possível salvar o motivo. Tente novamente."); else { toast.success("Motivo salvo."); router.refresh(); } })`.
   - NAO usar fenced code: este texto e o contrato; implementar conforme padrao do arquivo concluir-button.tsx.

2. Em `src/app/(app)/tarefas/[id]/page.tsx`:
   - Importar `MotivoPendenciaForm` de `./motivo-pendencia-form`.
   - Adicionar uma nova secao "Motivo de pendencia" (usar um `<Card>` no mesmo estilo dos cards existentes, OU uma secao abaixo do grid de cards e acima do bloco de Historico — escolher o que fica visualmente coerente; preferir um `Card` proprio de largura total abaixo do grid).
   - Quando `tarefa.status === "PENDENTE"`: renderizar `<MotivoPendenciaForm tarefaId={tarefa.id} motivoInicial={tarefa.motivoPendencia} />`.
   - Quando `tarefa.status === "CONCLUIDA"`: renderizar o motivo somente-leitura — se `tarefa.motivoPendencia` existir, exibir o texto com `whitespace-pre-wrap` (mesmo padrao do bloco "Descrição"); se for null/vazio, nao renderizar nada (ou um discreto "Nenhum motivo registrado." em `text-muted-foreground`). Nao renderizar textarea editavel quando CONCLUIDA.
   - Manter o `ConcluirButton` exatamente onde esta hoje (so PENDENTE).
  </action>
  <verify>
    <automated>cd "c:/Users/Novo/Desktop/criação de planilha modulos/teste" && npx tsc --noEmit && npx next lint --dir src/app/\(app\)/tarefas 2>/dev/null || npx tsc --noEmit</automated>
  </verify>
  <done>Existe `motivo-pendencia-form.tsx` ("use client") com textarea controlado, limite 1000, botao Salvar com loading e desabilitado quando nada mudou, toast + router.refresh no sucesso; `page.tsx` importa e renderiza o form quando PENDENTE e mostra o motivo somente-leitura quando CONCLUIDA; `npx tsc --noEmit` passa.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passa sem erros de tipo (campo motivoPendencia reconhecido no client Prisma e no TAREFA_SELECT).
- Manual (checkpoint de fim de plano, abaixo): abrir uma tarefa PENDENTE pelo icone de olho, digitar um motivo, salvar, recarregar a pagina e confirmar persistencia; concluir a tarefa e confirmar que o motivo aparece somente-leitura.
- Anti-IDOR: a action usa `withTarefaScope`, identico a concluirTarefa — colaborador nao acessa/edita tarefa de outro (retorna "não encontrado").
</verification>

<success_criteria>
- Campo `motivoPendencia String?` no model Tarefa, aplicado no banco via `prisma db push`.
- `salvarMotivoPendencia` segue o padrao de seguranca das demais actions (auth guard + anti-IDOR + revalidatePath), bloqueia edicao quando CONCLUIDA e normaliza/limita a entrada.
- Detalhe da tarefa mostra textarea editavel quando PENDENTE e texto somente-leitura quando CONCLUIDA.
- `npx tsc --noEmit` passa.
</success_criteria>

<output>
Create `.planning/quick/260618-kbg-adicionar-campo-de-motivo-de-pendencia-n/260618-kbg-SUMMARY.md` when done.
</output>
