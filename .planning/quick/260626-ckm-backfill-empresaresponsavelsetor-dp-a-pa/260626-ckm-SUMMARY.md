---
phase: quick-260626-ckm
plan: 01
subsystem: scripts (one-off backfill)
tags: [backfill, dp, empresa-responsavel-setor, xlsx]
dependency-graph:
  requires: [EmpresaResponsavelSetor model, Setor enum, scripts/backfill-responsavel-setor.mjs pattern]
  provides: [scripts/backfill-empresa-responsavel-setor-dp.mjs]
  affects: [EmpresaResponsavelSetor rows with setor=DP]
tech-stack:
  added: []
  patterns: [dry-run-by-default with --apply flag, idempotent upsert on empresaId_setor, xlsx sheet_to_json header:1 matrix parsing]
key-files:
  created:
    - scripts/backfill-empresa-responsavel-setor-dp.mjs

execution-note: |
  Script executado manualmente em produção (Neon) nesta sessão (orquestrador com acesso ao
  banco), fora do escopo do executor. Resultado: dry-run e --apply concordaram em 97 upserts
  pretendidos; 1 código (8894, bloco ANDRE, "Sup Elimar (por fora)") não resolveu CNPJ na
  Lista de Empresas. A verificação final do script reportou
  "FALHA DE VERIFICAÇÃO: total DP no banco (96) e menor que upserts bem-sucedidos (97)" — falso
  alarme: a planilha fonte tem o código 2232 listado duas vezes no bloco ANDRE com nomes
  diferentes ("K Fortalece" / "VLICIT Assessoria"), mas é a MESMA empresa real (K.Fortalece,
  CNPJ 57.914.791/0001-82) — o segundo upsert apenas reafirmou a mesma linha já criada pelo
  primeiro. Confirmado via query direta: 96 linhas EmpresaResponsavelSetor(setor=DP), distribuição
  Andre=21, Lauany=21, Mirella=21, Lorraine=33. Dado correto; o gate de verificação do script é
  apenas estrito demais para esse caso de duplicata na planilha de origem (não é um bug a corrigir
  retroativamente nesta sessão).
  modified: []
decisions:
  - "SEM MOV bloco (cols 12/13 da planilha de DP) nunca gera linha EmpresaResponsavelSetor -- decisao confirmada, intencionalmente fora do array BLOCOS_DP"
  - "Verificacao final usa totalDp >= upsertsBemSucedidos (nao ===), pois upserts sao idempotentes e execucoes anteriores podem ja ter elevado a contagem"
metrics:
  duration: ~10min
  completed: 2026-06-26
---

# Quick Task 260626-ckm: Backfill EmpresaResponsavelSetor setor=DP Summary

Script one-off `scripts/backfill-empresa-responsavel-setor-dp.mjs` que cruza duas planilhas Excel (`Lista de Empresas com CNPJ.xlsx` para código→CNPJ e `EMPRESAS SEPARADAS Depto Pessoal.xlsx` para atribuição de responsável DP) e faz upsert idempotente de `EmpresaResponsavelSetor` com `setor=DP`.

## What Was Built

Um único script `.mjs`, seguindo exatamente o padrão dos scripts de referência (`backfill-responsavel-setor.mjs`, `inspect-planilha.mjs`):

1. **Mapa código→CNPJ**: lê `Lista de Empresas com CNPJ.xlsx` (primeira sheet), varrendo AMBOS os blocos de colunas (Bloco A: cols 0/2; Bloco B: cols 4/6), filtrando por `typeof codigo === "number"` (descarta naturalmente linhas-label de regime).
2. **Atribuições DP**: lê `EMPRESAS SEPARADAS Depto Pessoal.xlsx`, sheet `"ATUALIZADA "` (com espaço no final — falha com mensagem clara listando `workbook.SheetNames` se não encontrar). Processa os 4 blocos ANDRÉ (dp2)/LORRAINE (dp4)/MIRELA (dp3)/LAUANY (dp1), iterando todas as linhas sem assumir posição fixa. **SEM MOV intencionalmente excluído** do array `BLOCOS_DP`.
3. **Resolução em cadeia**: código→CNPJ (via mapa da planilha 1) → empresaId (via `Empresa.cnpj` normalizado no banco) → usuarioId (via 4 emails DP resolvidos uma vez no início). Códigos não resolvidos e empresas não encontradas são logados e pulados, não fatais.
4. **Dry-run por padrão**: imprime mapa de tamanho, contagem por pessoa, total de upserts planejados, contadores de não-resolvidos/não-encontrados. Não escreve nada.
5. **`--apply`**: executa upserts em `empresaId_setor` (idempotente), depois verifica `totalDp >= upsertsBemSucedidos` no banco; define `process.exitCode = 1` em divergência.

O agente **não executou** o script contra nenhum banco — apenas criou e validou com `node --check` (sintaxe OK).

## Deviations from Plan

None — plan executado exatamente como escrito.

## Verification Performed

- `node --check scripts/backfill-empresa-responsavel-setor-dp.mjs` → passou sem erros de sintaxe.
- `grep -c empresaId_setor` → 2 ocorrências (chave de upsert presente).
- Confirmado que `SEM MOV` aparece apenas em comentários/logs, nunca como entrada do array `BLOCOS_DP`.
- Confirmado `setor: "DP"` presente (3 ocorrências) e zero ocorrências de `setor: "FISCAL"` ou `setor: "CONTABIL"` como valor de escrita.
- Confirmado `--apply` controla o branch de escrita via `process.argv.includes("--apply")`.
- Schema (`prisma/schema.prisma`) confirmado: `@@unique([empresaId, setor])` gera a chave composta `empresaId_setor`; `Setor` enum inclui `DP`; emails dos 4 colaboradores DP (dp1=Lauany, dp2=Andre, dp3=Mirella, dp4=Lorraine) confirmados em `prisma/seed.ts`.

## Known Stubs

None.

## Threat Flags

None — script one-off sem superfície de rede/auth nova; opera apenas via Prisma local (mesmo padrão dos scripts de referência já existentes).

## Self-Check: PASSED

- FOUND: scripts/backfill-empresa-responsavel-setor-dp.mjs
- FOUND: aeb4c65 (git log confirms commit exists)
