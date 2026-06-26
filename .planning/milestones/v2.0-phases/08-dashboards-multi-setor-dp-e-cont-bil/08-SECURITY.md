---
phase: 08
slug: dashboards-multi-setor-dp-e-cont-bil
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-25
---

# Phase 8 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| script Node → banco Neon | UPDATE em massa de `DesempenhoMensal.setor` (backfill histórico) | linhas de desempenho mensal pré-existentes |
| query layer → DB | agregação cross-setor para os dashboards DP/Contábil/Fiscal | dados de tarefas e desempenho de todos os setores |
| browser → /dashboards (RSC) | acesso a dados agregados de todos os colaboradores | métricas agregadas de equipe, dados de usuário (setor) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-08-01 | Tampering | backfill de `DesempenhoMensal.setor` | mitigate | `scripts/backfill-desempenho-setor.mjs` verifica contagem pré/pós e sai com código não-zero em divergência; execução real confirmou contagens idênticas (08-01-SUMMARY.md) | closed |
| T-08-02 | Tampering | drift do mapa `TipoObrigacao` → Setor | mitigate | `tests/tipo-obrigacao-setor.test.ts:70-92` testa completude/disjunção do mapa `TIPOS_OBRIGACAO_POR_SETOR` contra `Object.values(TipoObrigacao)` — quebra se um valor do enum for adicionado/duplicado | closed |
| T-08-03 | Tampering | contaminação cross-setor (DP vazando em Contábil) | mitigate | `tarefaSetorWhere(setor)` aplicado em todas as queries live (`src/modules/dashboards/queries.ts`); CR-01 do code review (08-REVIEW.md) identificou que o path congelado (`snapshot.ts`) não aplicava o filtro — corrigido no commit `d885854`, partição por `(colaboradorId, setor)`, 2 testes de regressão adicionados | closed |
| T-08-04 | Information Disclosure | snapshot vazando `senhaHash` via relação crua de `Usuario` | mitigate | `src/modules/dashboards/snapshot.ts:185` usa `select: { id, setor }` explícito, nunca `responsavel: true`/`colaborador: true` | closed |
| T-4-01 | Information Disclosure | `guard.ts` gate DONO-only | mitigate (reuso) | `src/app/(app)/dashboards/guard.ts:43` mantém `if (session.user.role !== "DONO") notFound()` pré-query, cobrindo o fan-out por 3 setores; `tests/dashboards.rbac.test.ts` regride o gate | closed |
| T-08-05 | Tampering | deleção do módulo órfão quebrando import por typo | mitigate | Módulo já estava ausente de commit anterior (`c453704`); re-scan de imports + `tsc --noEmit` confirmaram zero referências (08-03-SUMMARY.md, Task 2) | closed |
| T-08-SC | Tampering | npm/pip/cargo installs | accept | Nenhum pacote novo instalado na fase (08-RESEARCH.md Package Legitimacy Audit confirma zero installs) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-SC | Nenhuma dependência nova instalada na Fase 8 — auditoria de legitimidade de pacotes (08-RESEARCH.md) não se aplica, risco de supply-chain nulo nesta fase | plan-time (08-01/02/03-PLAN.md) | 2026-06-25 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-25 | 7 | 7 | 0 | /gsd-secure-phase (orchestrator, plan-time register short-circuit — verified directly against implementation/tests/08-REVIEW.md) |

**Note:** T-08-01's mitigation script (`backfill-desempenho-setor.mjs`) has a known reusability defect (CR-02, 08-REVIEW.md) — its pass/fail check hardcodes the pre-migration count to `0` rather than comparing dynamically, so reruns against a populated table would report false failures. This does not reopen T-08-01: the original backfill run executed once and its verification passed with counts confirmed identical (08-01-SUMMARY.md). The team assessed CR-02 as a non-issue since the script is one-time/non-idempotent by design (08-REVIEW.md resolution log). Flagged here for visibility only.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-25
