# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — Expansão Multi-Setor (DP e Contábil)

**Shipped:** 2026-06-25
**Phases:** 4 (Phases 5-8) | **Plans:** 13 | **Tasks:** 28 | **Commits:** 101

### What Was Built
- Fundação multi-setor: `Setor` enum, `EmpresaResponsavelSetor` junction table, autorização setor-aware (`withVisibilityScope`/`withTarefaScope`), backfill 197/197 verificado, zero regressão IDOR no Fiscal.
- Motor de geração DP: Folha/FGTS/INSS/eSocial mensal para empresas CLT, reaproveitando a transação e o padrão de dia útil do motor Fiscal.
- Motor de geração Contábil: Escrituração/Balancete mensal + ECD/ECF/DEFIS anual — primeira periodicidade não-mensal do sistema, idempotência comprovada por sweep de 12 meses.
- Dashboards multi-setor: desempenho/evolução/ranking replicados para DP e Contábil via um único módulo de queries parametrizado por setor; 3 abas em `/dashboards`; módulo órfão do v1.0 removido.

### What Worked
- Reaproveitar a mesma transação (`executarGeracaoMensal`) para Fiscal+DP+Contábil em vez de motores paralelos evitou duplicação e manteve a idempotência (constraint única) como único mecanismo de proteção contra duplicatas, sem precisar de um segundo controle.
- Parametrizar dashboards por `setor` em vez de triplicar módulos de query manteve o código DRY e tornou a correção de bugs (ex. CR-01, partição por setor no snapshot) automaticamente aplicável aos 3 setores.
- Testes de regressão "prova por composição" (DP-05, CONT-06: tarefa avulsa já funciona via `criarTarefa` + `withVisibilityScope` sem nenhuma mudança de produção) evitaram trabalho desnecessário em 2 dos 17 requisitos.

### What Was Inefficient
- O fechamento do milestone descobriu 2 gaps de processo que deveriam ter sido pegos durante a execução: Fase 8 sem `VERIFICATION.md` e Fase 7 com 2 itens `human_needed` nunca resolvidos pelo dono. Ambos exigiram trabalho adicional no momento do close em vez de durante a fase.
- A ferramenta `audit-open` reportou 6 quick tasks como "incomplete [unknown]" quando na verdade já estavam concluídas e commitadas (rastreadas em `STATE.md`) — falso positivo por falta de um campo `status:` no frontmatter dos PLAN.md de quick task mais antigos.
- O wizard de importação de empresas (`confirmarImportacao`) ainda não foi estendido para gravar a linha `EmpresaResponsavelSetor` (FISCAL) — débito técnico latente identificado na Fase 6, ainda não resolvido.

### Patterns Established
- Toda nova fase com motor de geração que estende um motor existente deve rodar dentro da MESMA transação (`tx`) do motor original, nunca um motor paralelo — garante idempotência e evita janelas de inconsistência entre setores.
- Dashboards/relatórios novos por "dimensão" (setor, regime, etc.) devem ser implementados como um parâmetro em um módulo de query único, nunca como módulo duplicado por dimensão.
- Ao fechar um milestone, rodar `audit-open` ANTES de assumir que o roadmap/requirements estão 100% — gaps de verificação (VERIFICATION.md ausente, status `human_needed` não resolvido) só apareceram nesse momento, não durante a execução das fases.

### Key Lessons
1. Decisões de domínio/regulatórias roteadas para "human_needed" durante a verificação de fase não devem ficar pendentes até o fechamento do milestone — resolver no mesmo dia em que a fase é verificada evita acumular múltiplas decisões para o close.
2. Quando o `audit-open` reporta um item "unknown" que já está documentado como completo em `STATE.md`, é um sinal de convenção de frontmatter desatualizada, não de trabalho real pendente — vale corrigir a convenção (adicionar `status:` aos PLAN.md de quick task) em vez de reinvestigar a cada milestone.
3. Reafirmar (não apenas registrar) decisões de Key Decisions no fechamento do milestone — duas decisões da v1.0 (modelo de autorização "colaborador só autoatribui") seriam mal-entendidas como bugs sem essa reafirmação explícita pelo dono na v2.0.

### Cost Observations
- Sessions: ~1 sessão principal de execução (2026-06-23 a 2026-06-25) + 1 sessão de fechamento de milestone.
- Notable: 101 commits / 107 arquivos / +12.4k LOC em ~2 dias de execução — ritmo alto sustentado por reaproveitamento de padrões já validados no v1.0 (motor de geração, autorização, dashboards) em vez de desenho do zero.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | — | 4 | Primeira versão; estabeleceu motor de geração mensal, tarefas avulsas, dashboards e autorização por papel (COLABORADOR/DONO) |
| v2.0 | ~2 | 4 | Generalizou autorização e motor de geração para multi-setor; introduziu periodicidade anual; fechamento exigiu resolver 2 gaps de verificação não pegos durante a execução |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|---------------------|
| v2.0 | 171 (full suite, all passing) | not measured | 0 (apenas reuso/extensão de stack já adotada no v1.0) |

### Top Lessons (Verified Across Milestones)

1. Reaproveitar a transação e os padrões de geração já validados (em vez de paralelos por setor/dimensão) é o que sustenta o ritmo alto de entrega neste projeto.
2. Itens `human_needed` de uma verificação de fase devem ser resolvidos no momento da verificação, não deixados para o fechamento do milestone.
