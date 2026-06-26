# Quick Task 260626-aim: Botao (so dono) para excluir todas as tarefas da competencia atual - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Task Boundary

Na aba de tarefas, adicionar um botão visível somente para o DONO que permite excluir, em massa,
todas as tarefas criadas — para uso emergencial caso a geração mensal precise ser refeita.

</domain>

<decisions>
## Implementation Decisions

### Escopo da exclusão
- Exclui apenas as tarefas da competência (mês) atual — recorrentes E avulsas, de todos os
  setores (Fiscal/DP/Contábil) — preservando todo o histórico de meses anteriores.
- "Competência atual" usa a mesma função `competenciaAtual()` já usada pelo motor de geração
  mensal (`src/modules/tarefas/geracao.ts`), para consistência com o resto do sistema.

### Confirmação
- Exige um `AlertDialog` de confirmação ("Tem certeza? Esta ação não pode ser desfeita.") antes
  de executar — não é um clique único sem aviso.

### Autorização
- Apenas DONO pode ver/acionar o botão e a Server Action correspondente — checar `role === "DONO"`
  como primeiro guard na Server Action (mesmo padrão de `gerarTarefasDoMesAction`), antes de
  qualquer acesso ao banco. O botão em si só renderiza para DONO (defesa em profundidade, não a
  barreira real).

### Claude's Discretion
- Texto exato do botão/dialog.
- Se a exclusão também deve remover o snapshot de desempenho (`DesempenhoMensal`) da competência
  atual — usar bom senso (provavelmente sim, para manter os dashboards consistentes com a
  ausência de tarefas), mas documentar a decisão tomada no SUMMARY.

</decisions>

<specifics>
## Specific Ideas

Reaproveitar o padrão de Server Action + toast já usado em `gerarTarefasDoMesAction` /
`GerarTarefasButton` para o novo botão de exclusão.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
