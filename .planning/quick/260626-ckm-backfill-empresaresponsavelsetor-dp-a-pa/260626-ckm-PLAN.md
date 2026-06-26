---
phase: quick-260626-ckm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/backfill-empresa-responsavel-setor-dp.mjs
autonomous: true
requirements: [QUICK-260626-ckm]
must_haves:
  truths:
    - "O script roda em DRY-RUN por padrão e só escreve no banco com --apply."
    - "O script monta o mapa código->CNPJ varrendo AMBOS os blocos (A e B) da Planilha 1, ignorando linhas-label de regime."
    - "O script atribui setor=DP às empresas dos 4 blocos ANDRÉ/LORRAINE/MIRELA/LAUANY, mapeando cada bloco ao email correto."
    - "O script NUNCA atribui responsável para o bloco SEM MOV."
    - "O upsert é idempotente: chaveado em empresaId_setor com setor=DP, seguro para re-rodar."
    - "Códigos não resolvidos e empresas não encontradas são logados informativamente e pulados (não fatais)."
    - "No modo --apply, a verificação final compara a contagem real de linhas DP no banco com o número de upserts bem-sucedidos e define process.exitCode=1 em divergência."
    - "O agente NÃO executa o script — apenas cria e valida sintaticamente via node --check."
  artifacts:
    - path: "scripts/backfill-empresa-responsavel-setor-dp.mjs"
      provides: "Backfill one-off de EmpresaResponsavelSetor setor=DP a partir das duas planilhas"
      min_lines: 80
  key_links:
    - from: "scripts/backfill-empresa-responsavel-setor-dp.mjs"
      to: "db.empresaResponsavelSetor.upsert"
      via: "where empresaId_setor com setor DP"
      pattern: "empresaId_setor"
    - from: "scripts/backfill-empresa-responsavel-setor-dp.mjs"
      to: "xlsx"
      via: "import * as XLSX + sheet_to_json header:1"
      pattern: "sheet_to_json"
---

<objective>
Criar um script one-off `scripts/backfill-empresa-responsavel-setor-dp.mjs` que faz backfill de responsáveis do setor DP na tabela `EmpresaResponsavelSetor`, cruzando duas planilhas Excel já existentes em `data/`.

Purpose: As empresas hoje têm responsável FISCAL (já backfilled), mas nenhum responsável DP. A planilha "EMPRESAS SEPARADAS Depto Pessoal.xlsx" define quem do DP cuida de cada empresa por código; a planilha "Lista de Empresas com CNPJ.xlsx" traduz código->CNPJ; o banco casa CNPJ->Empresa. O script fecha esse cruzamento e popula `setor=DP`.

Output: Um único script `.mjs` idempotente, dry-run por padrão, seguindo exatamente o padrão dos scripts existentes em `scripts/` (PrismaClient, flag `--apply`, verificação final com `process.exitCode`). O agente NÃO executa o script — apenas valida sintaxe com `node --check`. O orchestrator (sessão humana com acesso ao DB) roda depois: dry-run, depois `--apply`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

# Padrões de referência — ESTUDAR antes de implementar
# Import de xlsx (import * as XLSX, readFileSync, XLSX.read buffer, sheet_to_json header:1) + resolução de path via import.meta.url:
@scripts/inspect-planilha.mjs
# Padrão de backfill em EmpresaResponsavelSetor: PrismaClient, --apply, dry-run default, upsert empresaId_setor, verificação final com process.exitCode=1:
@scripts/backfill-responsavel-setor.mjs
# Padrão de resolução de usuários por email + verificação de contagem:
@scripts/backfill-setor-colaboradores-fiscal.mjs

# Schema — confirma @@unique([empresaId, setor]) => chave upsert é empresaId_setor; Setor enum tem DP; Empresa.cnpj é @unique mas formatado (normalizar):
@prisma/schema.prisma
</context>

<tasks>

<task type="auto">
  <name>Task 1: Criar o script de backfill DP cruzando as duas planilhas</name>
  <files>scripts/backfill-empresa-responsavel-setor-dp.mjs</files>
  <action>
Criar `scripts/backfill-empresa-responsavel-setor-dp.mjs` seguindo o estilo EXATO dos scripts de referência (shebang, bloco de comentário de cabeçalho explicando propósito + uso dry-run/--apply, `import { PrismaClient } from "@prisma/client"`, `import * as XLSX from "xlsx"`, `readFileSync` de `node:fs`, `fileURLToPath`/`import.meta.url`/`path` para resolver caminhos de `data/`). Constante `APPLY = process.argv.includes("--apply")`.

NÃO inserir blocos de código cercados aqui — a lógica abaixo é a especificação:

(1) PLANILHA 1 — mapa código->CNPJ. Ler `data/Lista de Empresas com CNPJ.xlsx`, sheet `Planilha1` (primeira sheet — usar `workbook.SheetNames[0]`). Ler como matriz com `XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })`. Construir `Map<number, string>` (codigo -> cnpjNormalizado). Para CADA linha, processar DOIS blocos: Bloco A = (col 0 código, col 2 CNPJ) e Bloco B = (col 4 código, col 6 CNPJ). Para cada bloco, só registrar a entrada quando `typeof codigo === "number"` E o CNPJ correspondente não for null/vazio. Normalizar CNPJ com `String(cnpj).replace(/\D/g, "")`. Ignorar naturalmente linhas-label de regime (LUCRO REAL etc.) — elas não têm número na coluna de código, então a checagem `typeof === "number"` já as descarta. Logar quantas entradas o mapa contém.

(2) PLANILHA 2 — atribuições DP. Ler `data/EMPRESAS SEPARADAS Depto Pessoal.xlsx`, sheet com nome `"ATUALIZADA "` (ATENÇÃO: tem espaço no final — buscar a sheet por esse nome exato; se não encontrar, falhar com mensagem clara listando `workbook.SheetNames`). Ler como matriz com `header: 1, defval: null`. Definir os 4 blocos a processar (NUNCA SEM MOV) como um array de `{ nome, colCodigo, colNome, email }`: ANDRÉ (col 0, col 1, `dp2@escritorio.com.br`), LORRAINE (col 3, col 4, `dp4@escritorio.com.br`), MIRELA (col 6, col 7, `dp3@escritorio.com.br`), LAUANY (col 9, col 10, `dp1@escritorio.com.br`). NÃO incluir SEM MOV (cols 12/13) no array — empresas desse bloco ficam sem responsável DP por decisão confirmada. Iterar TODAS as linhas da matriz (não assumir linha inicial fixa) e, por bloco, processar só quando `typeof linha[colCodigo] === "number"` E `linha[colNome] != null`. Coletar entradas `{ codigo, email }`.

(3) RESOLVER CNPJ. Para cada `{ codigo, email }`, buscar o CNPJ no Map da Planilha 1. Se não encontrar, incrementar contador e logar como "não resolvido (código X não está na Lista de Empresas)" e PULAR — não fatal.

(4) RESOLVER usuarioId dos 4 emails uma vez no início via `db.usuario.findMany({ where: { email: { in: [...4 emails] } }, select: { id, email } })`, montando `Map<email, usuarioId>`. Se algum dos 4 emails não existir no banco, logar aviso por email faltante (mas seguir — entradas desse bloco cairão em "não resolvido por usuário ausente"). Construir `Map<email, usuarioId>`.

(5) RESOLVER Empresa por CNPJ. Carregar todas as empresas com `db.empresa.findMany({ select: { id, cnpj } })` e montar `Map<cnpjNormalizado, empresaId>` usando `empresa.cnpj.replace(/\D/g, "")`. Para cada `{ cnpjNormalizado, email }` resolvido, buscar empresaId nesse mapa. Se não encontrar, incrementar contador e logar "empresa não encontrada (CNPJ X)" e PULAR — não fatal.

(6) Montar a lista final de upserts `{ empresaId, usuarioId }` (apenas entradas totalmente resolvidas: código->CNPJ->Empresa e email->usuarioId). Contar por pessoa (quantas empresas por email/nome).

(7) DRY-RUN (default): imprimir Modo, tamanho do mapa código->CNPJ, contagem de empresas por pessoa, total de upserts que seriam feitos, e as listas resumidas de não-resolvidos e não-encontrados (contagens). Retornar sem escrever. Mensagem clara "DRY-RUN: nenhuma alteração aplicada. Rode com --apply para aplicar."

(8) APPLY: para cada `{ empresaId, usuarioId }`, `await db.empresaResponsavelSetor.upsert({ where: { empresaId_setor: { empresaId, setor: "DP" } }, update: { usuarioId }, create: { empresaId, setor: "DP", usuarioId } })`. Contar upserts bem-sucedidos. Isso é idempotente.

(9) VERIFICAÇÃO FINAL (apenas --apply): `const totalDp = await db.empresaResponsavelSetor.count({ where: { setor: "DP" } })`. Comparar `totalDp` com o número de upserts bem-sucedidos desta execução. Como upserts são idempotentes e SEM MOV/empresas ausentes não geram linha, `totalDp` deve ser `>= upsertsBemSucedidos`; a verificação obrigatória é que `totalDp` NÃO seja menor que o número de upserts bem-sucedidos. Se `totalDp < upsertsBemSucedidos`, logar FALHA DE VERIFICAÇÃO e `process.exitCode = 1`. Imprimir resumo final (empresas por pessoa, total DP no banco, status da verificação).

Sempre envolver o corpo em `try { ... } finally { await db.$disconnect(); }` e chamar `main()` ao final, como nos scripts de referência. Usar `import` de xlsx exatamente como em scripts/inspect-planilha.mjs (pacote já instalado via CDN tarball).
  </action>
  <verify>
    <automated>node --check scripts/backfill-empresa-responsavel-setor-dp.mjs</automated>
  </verify>
  <done>O arquivo scripts/backfill-empresa-responsavel-setor-dp.mjs existe, passa `node --check` sem erros de sintaxe, importa xlsx e PrismaClient no estilo dos scripts existentes, processa os 4 blocos (não SEM MOV), faz upsert idempotente em empresaId_setor com setor=DP, roda dry-run por padrão e tem verificação final de contagem com process.exitCode=1 em divergência. O agente NÃO executa o script.</done>
</task>

</tasks>

<verification>
- `node --check scripts/backfill-empresa-responsavel-setor-dp.mjs` passa (sintaxe válida).
- Grep confirma a chave de upsert: `grep -c empresaId_setor scripts/backfill-empresa-responsavel-setor-dp.mjs` >= 1.
- Grep confirma que SEM MOV NÃO é um bloco processado (o array de blocos contém apenas ANDRÉ/LORRAINE/MIRELA/LAUANY).
- Grep confirma `setor: "DP"` presente e nenhum uso de FISCAL/CONTABIL como setor de escrita.
- Grep confirma dry-run default: `--apply` controla a escrita (`process.argv.includes("--apply")`).
</verification>

<success_criteria>
- Script one-off criado, idempotente, dry-run por padrão, validado por `node --check`.
- Mapeamento bloco->email correto (ANDRÉ=dp2, LORRAINE=dp4, MIRELA=dp3, LAUANY=dp1; SEM MOV sem atribuição).
- Códigos não resolvidos e empresas não encontradas tratados como log informativo (não fatal).
- Verificação final de contagem no modo --apply com process.exitCode=1 em divergência.
- O agente NÃO executou o script; a execução fica a cargo do orchestrator (sessão com DB).
</success_criteria>

<output>
Create `.planning/quick/260626-ckm-backfill-empresaresponsavelsetor-dp-a-pa/260626-ckm-SUMMARY.md` when done
</output>
