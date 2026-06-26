# Quick Task 260626-a8d: Listagem de empresas DP com responsavel (em branco se nao houver) + categoria empregada domestica - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Task Boundary

Na área de Departamento Pessoal (DP), criar uma listagem/tela mostrando o responsável de DP de
cada empresa (em branco quando não houver responsável definido), e adicionar uma categoria/flag
de "empregada doméstica" para empresas que têm esse tipo de vínculo CLT (distinto do CLT
comercial já coberto pelo campo `temFuncionariosClt` existente).

</domain>

<decisions>
## Implementation Decisions

### Localização da listagem
- Nova aba/página dentro de Empresas, filtrada por setor DP (ex: reaproveitar a tabela de
  empresas existente — TanStack Table já usada em `/empresas` — com filtro de setor=DP e coluna
  de responsável DP visível). Não é uma seção dentro do Dashboard DP.

### Categoria "empregada doméstica"
- Apenas marcação informativa por agora — um novo campo/flag booleano na Empresa
  (ex: `temEmpregadaDomestica`), exibido na listagem e no formulário de empresa.
- NÃO deve disparar geração automática de tarefas DP (folha/FGTS/INSS/eSocial doméstico) nesta
  tarefa — isso é explicitamente fora de escopo, para não alterar o motor de geração mensal numa
  quick task. Pode virar requisito futuro do motor de geração se necessário.

### Empresas sem responsável DP
- Devem aparecer na listagem com a coluna de responsável em branco/vazia (não omitir a linha,
  não usar placeholder como "N/A" — vazio mesmo).

### Claude's Discretion
- Exato nome do campo no schema (`temEmpregadaDomestica` é sugestão, ajustar se houver convenção
  melhor no schema atual).
- Onde exatamente inserir a UI (nova rota vs. tab dentro de `/empresas`) — usar o padrão mais
  simples que reaproveite a tabela de empresas já existente.

</decisions>

<specifics>
## Specific Ideas

Reaproveitar `EmpresaResponsavelSetor` (junction table já existente desde o v2.0) para mostrar o
responsável de DP — não criar um novo relacionamento.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
