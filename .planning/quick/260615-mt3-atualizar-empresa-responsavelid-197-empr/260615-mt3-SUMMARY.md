---
phase: quick-260615-mt3
plan: 01
status: complete
completed: 2026-06-16
commits:
  - b8cf152  # Task 1: script + dry-run
tags: [usuarios, responsavel, cnpj, banco-producao]
---

# Quick Task 260615-mt3 Summary

**Atualizar responsavelId das empresas a partir de EMPRESAS RESPONSÁVEL.xlsx + renomear colaboradores**

## Result

Parcialmente concluído: os 4 usuários foram renomeados com sucesso em produção. A atribuição de `responsavelId` por CNPJ ficou pendente porque a tabela `empresa` está vazia em produção (veja "Known Limitation" abaixo).

## Accomplishments

- Criado `scripts/atualizar-responsaveis.mjs`: script ESM one-off com suporte a dry-run (padrão) e `--apply`. Idempotente — segunda execução com `--apply` reporta 0 updates.
- Dry-run executado e revisado: 197 linhas válidas na planilha, 0 matches por CNPJ (empresa table vazia), mapeamento de nomes 100% resolvido, 28 linhas "MEI" reportadas (sem alteração de regime).
- **`--apply` executado em produção (Neon):** 4 usuários renomeados:
  - `colaborador1@escritorio.com.br`: "Colaborador 1" → **Caio**
  - `colaborador2@escritorio.com.br`: "Colaborador 2" → **Jessica**
  - `colaborador3@escritorio.com.br`: "Colaborador 3" → **Heitor**
  - `colaborador4@escritorio.com.br`: "Colaborador 4" → **Felipe**
  - `email` e `senhaHash` de todos os 4 preservados intactos.
  - `dono@escritorio.com.br` não tocado.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | b8cf152 | Criar script + rodar dry-run |
| Task 2 | (checkpoint humano — nenhum commit) | |
| Task 3 | (nenhum arquivo novo — `--apply` é flag CLI) | Execução confirmada pelo usuário |

## Known Limitation — responsavelId Deferred

A tabela `empresa` em produção (Neon) contém **0 registros**. O fluxo de importação EMPR-02 (wizard de 3 etapas, Phase 1 Plan 05) foi implementado mas aparentemente nunca executado/confirmado contra o banco de produção.

**Impacto:** Nenhum `responsavelId` pôde ser atribuído — não existe empresa para atualizar.

**O script já está pronto e idempotente.** Quando as empresas forem cadastradas/importadas em produção (via wizard EMPR-02 ou via novo script de importação a partir desta mesma planilha `data/EMPRESAS RESPONSÁVEL.xlsx`), basta rodar:

```bash
node --env-file=.env scripts/atualizar-responsaveis.mjs
# revisar o dry-run, depois:
node --env-file=.env scripts/atualizar-responsaveis.mjs --apply
```

Isso atribuirá o `responsavelId` correto para as 197 empresas por CNPJ.

**Nota:** A planilha `data/EMPRESAS RESPONSÁVEL.xlsx` contém nome, CNPJ, Regime Tributário e Responsável de 197 empresas — pode servir como fonte de importação direta (um novo quick task separado), eliminando dependência do wizard EMPR-02.

## MEI Report (informativo)

28 das 197 linhas da planilha têm Regime Tributário = "MEI". Este valor não existe no enum `RegimeTributario` atual (`LUCRO_REAL`, `LUCRO_PRESUMIDO`, `SIMPLES_NACIONAL`). Nenhuma alteração de regime foi feita — apenas reportado aqui para futura decisão de modelagem (ex: adicionar valor `MEI` ao enum ou tratar como `SIMPLES_NACIONAL`).

## Files Created/Modified

- `scripts/atualizar-responsaveis.mjs` — script one-off de dry-run + apply (criado)
