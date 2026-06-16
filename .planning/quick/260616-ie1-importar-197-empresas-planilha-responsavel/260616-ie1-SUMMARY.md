---
phase: quick-260616-ie1
plan: 01
status: complete
completed: 2026-06-16
commits:
  - f7ec2c4  # Task 1: script + dry-run
tags: [empresas, importacao, cnpj, banco-producao, responsavel]
---

# Quick Task 260616-ie1 Summary

**Importar 197 empresas da planilha EMPRESAS RESPONSÁVEL.xlsx no banco de produção (Neon)**

## Result

Concluído com sucesso. 197 empresas criadas em produção, cada uma com `responsavelId` correto e `EmpresaRegimeHistorico` inicial aninhado.

## Accomplishments

- Criado `scripts/importar-empresas.mjs`: script ESM one-off com suporte a dry-run (padrão) e `--apply`. Idempotente por CNPJ — re-execução pula empresas já existentes.
- Dry-run executado e revisado: 197 linhas válidas, 0 duplicatas, 0 responsáveis não resolvidos, 28 linhas MEI identificadas.
- **`--apply` executado em produção (Neon):**
  - 197 empresas criadas (0 erros)
  - 197 registros `EmpresaRegimeHistorico` criados (nested, atômico por empresa)
  - 0 CNPJs pulados (banco estava vazio pré-import)
- **`atualizar-responsaveis.mjs --apply` rodado pós-import:** 197/197 matches por CNPJ, todos com `responsavelId` já correto (0 updates necessários — a importação já atribuiu corretamente).

## Distribuição final no banco

| Responsável | Empresas |
|-------------|----------|
| Caio        | 40       |
| Jessica     | 35       |
| Heitor      | 12       |
| Felipe      | 110      |
| **Total**   | **197**  |

| Regime           | Empresas |
|------------------|----------|
| LUCRO_REAL       | 68       |
| LUCRO_PRESUMIDO  | 19       |
| SIMPLES_NACIONAL | 110      |
| **Total**        | **197**  |

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | f7ec2c4 | Criar script + rodar dry-run |
| Task 2 | (checkpoint humano — nenhum commit) | |
| Task 3 | (nenhum arquivo novo — --apply é flag CLI) | Execução confirmada, 197 empresas criadas |

## Decisões de Design Aplicadas

- **MEI → SIMPLES_NACIONAL**: 28 empresas com regime "MEI" na planilha foram criadas com `regimeTributario = SIMPLES_NACIONAL` (enum não tem valor MEI) e `particularidades = "MEI"` para rastrear a classificação original.
- **CNPJ formatado**: CNPJs persistidos no formato original da planilha ("00.000.000/0000-00"), consistente com o import da Fase 1.
- **Sem transaction global**: volume pequeno + idempotência por CNPJ + dry-run human-reviewed = recuperação simples por re-run em caso de falha parcial.

## Files Created

- `scripts/importar-empresas.mjs` — script one-off de importação com dry-run + apply (292 linhas)
