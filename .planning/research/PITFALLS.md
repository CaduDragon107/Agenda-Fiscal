# Pitfalls Research

**Domain:** Sistema web de gestão de tarefas e prazos fiscais recorrentes (escritório de contabilidade brasileiro) — v1.0 (fiscal) + v2.0 (expansão multi-setor: DP e Contábil)
**Researched:** 2026-06-11 (v1.0) / 2026-06-22 (v2.0 addendum)
**Confidence:** MEDIUM-HIGH overall — v1.0 engineering patterns: HIGH, Brazilian fiscal rules: MEDIUM (dates change yearly); v2.0 architectural/migration pitfalls: HIGH (grounded directly in this project's actual codebase, not generic advice)

> **Reading guide:** This file has two parts. **Part A** (below) is the original v1.0 research — general domain pitfalls for fiscal task-recurrence systems, still fully relevant since v2.0 builds directly on the same engine/schema. **Part B** is the v2.0-specific addendum — pitfalls unique to ADDING the DP/Contábil sectors to this already-built system, grounded in direct inspection of the current Prisma schema, RBAC helpers, generation engine, and dashboard modules. **For v2.0 roadmap planning, prioritize Part B** — it reflects what actually exists today, including one drift pitfall (Part B, Pitfall 4) that has ALREADY happened once in this codebase.

---

# Part A — v1.0 Domain Pitfalls (Original Research, 2026-06-11)

## Critical Pitfalls

### Pitfall 1: Geração recorrente duplicada por execução múltipla do job mensal

**What goes wrong:**
O job que gera as tarefas do mês (ex.: "gerar tarefas de junho/2026 para todas as 110 empresas") roda mais de uma vez — porque o servidor reiniciou, porque alguém clicou "gerar agora" manualmente além do cron, porque o cron disparou duas vezes (deploy + scheduler nativo da plataforma), ou porque o job travou na metade e foi reexecutado. Resultado: tarefas duplicadas para o mesmo mês/empresa/obrigação, poluindo a visão dos colaboradores e inflando os dashboards de "atrasado vs no prazo".

**Why it happens:**
Geração de tarefas recorrentes parece simples ("INSERT para cada empresa x obrigação"), então raramente se pensa em idempotência até o bug aparecer em produção. Plataformas de hosting com cron (Render, Railway, Vercel Cron, etc.) podem disparar jobs em duplicidade durante deploys ou em casos de retry automático.

**How to avoid:**
- Modelar a chave natural da tarefa recorrente como `(empresa_id, tipo_obrigacao, competencia)` — competência = mês/ano de referência (ex.: "2026-05" para a apuração de maio que vence em junho).
- Criar **constraint UNIQUE** no banco sobre essa combinação. A geração deve usar `INSERT ... ON CONFLICT DO NOTHING` (ou equivalente) — nunca `INSERT` simples.
- Job de geração deve ser **seguro para rodar múltiplas vezes no mesmo mês** sem efeito colateral (idempotente por design, não por sorte).
- Adicionar um lock/flag de execução (`tarefas_geradas_competencia` numa tabela de controle, ou advisory lock no Postgres) para evitar duas execuções simultâneas, mas a constraint UNIQUE é a rede de segurança definitiva — mesmo que o lock falhe, o banco impede a duplicata.
- Logar cada execução do job (quando rodou, quantas tarefas criou, quantas foram ignoradas por já existir) para auditoria.

**Warning signs:**
- Mesma empresa aparece duas vezes na lista de tarefas "DAS — Junho/2026".
- Dashboard de "tarefas pendentes" mostra número maior que `110 empresas x obrigações esperadas`.
- Contagem de tarefas geradas no mês não bate com `qtd_empresas x qtd_obrigacoes_do_regime`.

**Phase to address:**
Fase de implementação do motor de geração de tarefas recorrentes (provavelmente Fase 2 ou 3, logo após cadastro de empresas). Deve ser tratado **antes** de qualquer dado real ser gerado, porque limpar duplicatas em produção depois é doloroso (tarefas já marcadas como concluídas por engano em uma das cópias).

---

### Pitfall 2: Bug de fuso horário fazendo o job rodar no dia/mês errado

**What goes wrong:**
O servidor (especialmente em provedores cloud) roda em UTC. Se o job de geração mensal é agendado para "todo dia 1 às 00:05", em UTC isso corresponde a 21:05 do dia 30 (horário de Brasília, UTC-3). Resultado possível: tarefas de "junho" são geradas ainda em 31 de maio, ou — pior — o cálculo de "qual é o mês de competência" usa `new Date()` no momento errado e gera tarefas com a competência anterior por engano. Em ambientes que usam horário de verão de outros países (não o Brasil, que não tem mais DST desde 2019, mas o servidor pode estar configurado para outro fuso), isso piora.

**Why it happens:**
Desenvolvedores testam localmente no fuso de Brasília e tudo funciona; em produção o container roda em UTC e o "dia 1" muda de hora. Bibliotecas de data (JS `Date`, etc.) também variam comportamento dependendo se a string é tratada como UTC ou local.

**How to avoid:**
- Definir explicitamente o fuso horário do sistema como `America/Sao_Paulo` na configuração do servidor/runtime, **e também** passar o fuso explicitamente nas chamadas de cron/scheduler (não confiar no fuso do sistema operacional do host).
- Calcular "qual é o mês de competência hoje" sempre a partir da data em `America/Sao_Paulo`, nunca a partir de `Date.now()` cru em UTC.
- Persistir datas de vencimento como `DATE` (sem componente de hora) no banco — isso elimina toda a classe de bugs de "virou o dia errado por causa de fuso".
- Escrever um teste automatizado que simula a execução do job em horários limítrofes (23:59 e 00:01 no fuso de SP) para garantir que a competência calculada está correta.

**Warning signs:**
- Tarefas do mês aparecem um dia antes ou depois do esperado.
- Datas de vencimento "ajustadas para dia útil" aparecem deslocadas em 1 dia comparado ao calendário real.

**Phase to address:**
Fase de configuração de infraestrutura/scheduler (early — Fase 1 ou 2), e revisitado na fase de geração de tarefas recorrentes.

---

### Pitfall 3: Cálculo de dias úteis/feriados feito como lista hardcoded de datas fixas

**What goes wrong:**
O time implementa uma lista fixa de feriados de 2026 (`["2026-01-01", "2026-04-21", ...]`) hardcoded no código ou numa tabela sem mecanismo de atualização anual. Em janeiro de 2027, todos os ajustes de "próximo dia útil" passam a usar feriados de 2026 (errados) ou simplesmente não encontram feriados para 2027, fazendo prazos como Carnaval, Sexta-feira Santa, Corpus Christi (todos móveis, calculados a partir da Páscoa) caírem em dias normais.

**Why it happens:**
Calcular feriados móveis brasileiros exige o algoritmo de cálculo da Páscoa (algoritmo de Gauss/Meeus) — Carnaval é Páscoa - 47 dias, Sexta-feira Santa é Páscoa - 2 dias, Corpus Christi é Páscoa + 60 dias. Isso não é óbvio, então a tentação é "só copiar a lista do calendário deste ano".

**How to avoid:**
- Implementar **algoritmo** de cálculo da Páscoa (não lista hardcoded) e derivar os feriados móveis nacionais a partir dele. Os feriados nacionais fixos no Brasil são: 1/jan, 21/abr (Tiradentes), 1/mai, 7/set, 12/out, 2/nov, 15/nov, 25/dez. Os móveis relevantes (tratados como ponto facultativo/feriado bancário na prática contábil) são Carnaval (segunda e terça) e Sexta-feira Santa; Corpus Christi é ponto facultativo federal mas frequentemente tratado como feriado bancário — **decidir explicitamente** se entra no cálculo de "dia útil" do escritório.
- Função `proximoDiaUtil(data)` e `diaUtilAnteriorOuIgual(data)` devem consultar essa lista calculada dinamicamente por ano, cobrindo qualquer ano (2025, 2026, 2027... sem manutenção manual).
- Considerar usar uma biblioteca já testada (existem pacotes npm/PyPI para feriados brasileiros que já implementam o cálculo de Páscoa) em vez de reimplementar — mas validar a saída contra o calendário oficial da Receita Federal para o ano corrente antes de confiar.
- **Decisão explícita de produto**: o projeto já define em "Out of Scope" que feriados estaduais/municipais ficam fora do v1 — documentar isso na regra de cálculo para que não vire bug ("por que essa empresa de SP não considerou Revolução Constitucionalista de 32?").

**Warning signs:**
- Em janeiro do ano seguinte, prazos não se ajustam para feriados (porque a tabela só tem o ano anterior).
- Carnaval ou Sexta-feira Santa aparecem como "dia útil normal" no sistema.
- Diferença entre o prazo calculado pelo sistema e o prazo publicado no calendário fiscal oficial da Receita.

**Phase to address:**
Fase dedicada ao motor de cálculo de prazos/dias úteis — deve ser construída e testada (com casos de teste cobrindo múltiplos anos, inclusive anos futuros) **antes** da fase de geração de tarefas recorrentes, pois esta depende daquela.

---

### Pitfall 4: Regra "ajuste de prazo por dia útil" aplicada na direção errada (antecipa vs adia)

**What goes wrong:**
Diferentes obrigações fiscais brasileiras têm regras **diferentes e não-intuitivas** de ajuste quando o vencimento cai em dia não útil:
- **DAS (Simples Nacional)**: se o dia 20 cai em fim de semana/feriado, o vencimento é **adiado** para o próximo dia útil.
- **EFD-Contribuições (PIS/COFINS)**: vence no 10º dia útil do segundo mês subsequente — se o 10º dia útil cair em feriado, é **antecipado** para o dia útil anterior (a regra conta dias úteis, então o "10º dia útil" em si já pula feriados, mas há nuances).
- **Tributos federais em geral (DARF)**: regra geral do art. 5º da Lei 9.317 e normas correlatas costuma **antecipar** para o último dia útil anterior quando a data de vencimento (dia fixo do mês) cai em dia não útil.

Se o sistema aplica uma única regra genérica ("se cair em fim de semana, joga pro próximo dia útil") para **todas** as obrigações, alguns prazos vão ficar **errados** — gerando ou um prazo que não existe (multa por atraso real, mas o sistema mostra "no prazo") ou um alerta falso de atraso para algo que na verdade venceu antes.

**Why it happens:**
A primeira impressão de "regra de dia útil" é genérica e parece universal. A diferença entre "antecipar" e "adiar" e entre "dia útil" vs "dia útil considerando apenas feriados nacionais vs também estaduais/bancários" é um detalhe que só aparece ao ler a legislação específica de cada obrigação.

**How to avoid:**
- Modelar **cada tipo de obrigação** com seu próprio campo `regra_ajuste_prazo`: enum como `ADIA_PARA_PROXIMO_DIA_UTIL`, `ANTECIPA_PARA_DIA_UTIL_ANTERIOR`, `SEM_AJUSTE` (alguns prazos legalmente não mudam mesmo em feriado — raro, mas existe).
- Validar cada regra contra a fonte oficial (calendário tributário da Receita Federal / agenda do Simples Nacional) para o conjunto específico de obrigações do escritório (DAS, ICMS, PIS/COFINS, SPED) antes de codificar — **não assumir por analogia**.
- Como o projeto já decidiu (Key Decision) que "prazo único por tipo de obrigação, ajustado por dia útil/feriado" — essa tabela de regras por tipo de obrigação é exatamente o lugar certo para capturar essa diferença.
- Escrever testes com casos reais conhecidos (ex.: "DAS de competência novembro/2025, vencimento 20/12/2025 caiu em sábado → vence 22/12/2025") para validar contra o calendário oficial publicado.

**Warning signs:**
- Prazos gerados pelo sistema não batem com o calendário do Simples Nacional/Receita Federal publicado para o mês.
- Alertas de "atrasado" disparando para tarefas que na verdade ainda estão no prazo (ou vice-versa).

**Phase to address:**
Mesma fase do motor de cálculo de prazos (Pitfall 3) — esta é a continuação direta. Deve ter **tabela de configuração por tipo de obrigação**, não regra única hardcoded.

---

### Pitfall 5: Modelo de "regras por regime tributário" hardcoded em código, não extensível

**What goes wrong:**
A lógica "se regime == Lucro Real, gerar ICMS + PIS/COFINS + SPED; se regime == Simples Nacional, gerar DAS" é escrita como `if/else` direto no código de geração de tarefas. Funciona para os 2 regimes do v1. Mas no mundo real:
- Empresas mudam de regime (Simples → Lucro Presumido → Lucro Real, geralmente em janeiro, mas às vezes forçadas no meio do ano por desenquadramento).
- Pode surgir um terceiro regime (Lucro Presumido, MEI) que o escritório passa a atender.
- Uma empresa específica pode ter uma obrigação extra "fora do padrão" (ex.: uma empresa de Lucro Real que também precisa de uma declaração estadual específica).
- O conjunto de obrigações de um regime pode mudar por lei (ex.: nova obrigação acessória criada pela Receita).

Se tudo está em `if/else`, cada uma dessas mudanças exige alteração de código + deploy, e pior: **histórico de tarefas geradas antes da mudança de regime fica inconsistente** se a mudança de regime de uma empresa reprocessar competências passadas.

**Why it happens:**
Com apenas 2 regimes no escopo do v1, parece "over-engineering" criar uma tabela de configuração. Mas a extensibilidade é justamente um requisito futuro implícito (o próprio PROJECT.md já reconhece "particularidades" por empresa).

**How to avoid:**
- Modelar como **dados, não código**: tabela `tipos_obrigacao` (ICMS, PIS/COFINS, SPED, DAS, ...) com seus atributos (periodicidade, regra de prazo, regra de ajuste de dia útil, passo a passo).
- Tabela de associação `regime_tributario_obrigacao` (many-to-many: quais obrigações cada regime gera mensalmente).
- Permitir **override por empresa**: tabela `empresa_obrigacao_extra` (adiciona) e/ou `empresa_obrigacao_excecao` (remove uma obrigação que o regime normalmente teria, para casos de empresa inativa/isenta).
- A `data_efetiva_regime` na empresa deve ter histórico (tabela `empresa_regime_historico` com `data_inicio`/`data_fim`), para que a geração de tarefas de uma competência passada use o regime **vigente naquela competência**, não o regime atual — importante porque mudanças de regime no meio do ano podem ocorrer (desenquadramento obrigatório) e o histórico de tarefas geradas antes não deve ser reescrito retroativamente.
- Isso é o pré-requisito direto para o "Key Decision" já registrado no PROJECT.md sobre tarefas geradas conforme regime — vale formalizar a extensibilidade desde o desenho do schema, mesmo que o v1 só popule 2 regimes.

**Warning signs:**
- Adicionar uma nova obrigação ou regime exige tocar em múltiplos arquivos de código de geração.
- Mudança de regime de uma empresa altera retroativamente tarefas de meses já fechados.
- "Particularidades" de empresas específicas (mencionadas no PROJECT.md) não têm onde ser registradas no modelo de dados.

**Phase to address:**
Fase de modelagem de dados / cadastro de empresas (provavelmente Fase 1-2), antes da fase de geração automática de tarefas. Mudar o schema depois que já existem 100+ empresas e meses de histórico é caro.

---

### Pitfall 6: Dashboards de "desempenho" ficam lentos ou enganosos com histórico crescente

**What goes wrong:**
Com 110 empresas x ~4-6 obrigações/mês x 12 meses, em 1-2 anos o sistema acumula dezenas de milhares de linhas de tarefas. Dashboards que calculam "no prazo vs atrasado por colaborador" e "evolução mensal" fazendo `COUNT`/`GROUP BY` direto na tabela de tarefas a cada carregamento de página começam a ficar perceptivelmente lentos, especialmente se houver JOINs com empresas, usuários e histórico de status mudando ao longo do tempo (ex.: tarefa concluída com atraso depois de já ter sido contada como "atrasada" em um snapshot anterior).

Pior: dashboards "enganosos" — por exemplo, um colaborador concentra empresas de Simples Nacional (1 obrigação/mês) enquanto outro concentra empresas de Lucro Real (3-4 obrigações/mês). Comparar "número de tarefas atrasadas" entre eles sem normalizar pelo volume/dificuldade da carteira gera ranking injusto e desmotivador — e pode incentivar comportamento de "gaming" (marcar tarefa como concluída sem realmente concluir, só para não aparecer atrasado).

**Why it happens:**
No MVP, "fazer um SELECT com GROUP BY" funciona perfeitamente com poucos dados de teste. O problema só aparece depois de meses de uso real, quando já é doloroso migrar para tabelas de agregação. E a questão da "comparação injusta" é um problema de **produto/UX**, não só técnico — fácil de não perceber até um colaborador reclamar.

**How to avoid:**
- Desde o início, indexar colunas usadas em filtros de dashboard: `(empresa_id, competencia)`, `(responsavel_id, status, data_vencimento)`.
- Para o "dashboard de evolução mensal", considerar uma tabela/view de **resumo mensal pré-calculada** (snapshot ao fechar o mês: quantas tarefas, quantas no prazo, quantas atrasadas, por colaborador e por empresa) em vez de recalcular sobre a tabela de tarefas viva — isso também resolve o problema de "tarefa concluída com atraso" mudar retroativamente as estatísticas de meses fechados.
- Para comparação entre colaboradores, normalizar métricas: usar **percentual** (% no prazo) em vez de contagem absoluta, e segmentar/anotar o dashboard com o tamanho/composição da carteira de cada colaborador (nº de empresas, regime predominante) para dar contexto — evita comparação "maçã com laranja".
- Definir claramente o que conta como "atrasado": data de conclusão > data de vencimento ajustada. Se a tarefa for concluída hoje mas a "data de referência" for retroativa (ex.: concluindo em julho uma tarefa de maio), o dashboard de "junho" não deve mudar — só o registro daquela tarefa específica.
- Considerar que dashboards de desempenho entre pessoas têm efeito **organizacional** (Goodhart's Law: a métrica vira meta e passa a ser otimizada em vez do objetivo real). Vale incluir, junto com "atrasos", contexto qualitativo (não apenas ranking puro) para não criar incentivo perverso a marcar conclusão prematuramente.

**Warning signs:**
- Página de dashboard demora visivelmente mais de 1-2s para carregar depois de alguns meses de uso.
- Números do "dashboard de evolução mensal" mudam quando se olha o mesmo mês em dias diferentes (sinal de que está sendo recalculado sobre dados mutáveis sem snapshot).
- Colaboradores reclamam que a comparação não reflete a dificuldade real da carteira.

**Phase to address:**
Estrutura de indexação e decisão sobre snapshot mensal devem ser definidas na fase de modelagem de dados (Fase 1-2). A implementação plena dos dashboards comparativos pode ser uma fase posterior, mas o **schema** precisa suportar snapshots desde o início — adicionar isso depois exige reprocessar histórico.

---

### Pitfall 7: Importação da planilha Excel traz dados sujos que quebram o modelo de regras

**What goes wrong:**
A planilha "Controle pis e cofins.xlsx" foi mantida manualmente por anos — é quase certo que contém: CNPJs com formatação inconsistente (com/sem máscara, alguns com erro de dígito), nomes de empresa duplicados ou com pequenas variações de grafia ("Empresa LTDA" vs "Empresa Ltda" vs "EMPRESA LTDA ME"), células mescladas, linhas em branco entre blocos, células com fórmulas em vez de valores, empresas que já encerraram atividade mas continuam na planilha, e — crucialmente — **não tem um campo explícito e padronizado de "regime tributário"** por empresa (porque a planilha foi feita para PIS/COFINS, que é só Lucro Real). Importar isso direto sem validação gera empresas duplicadas, CNPJs inválidos que quebram cálculos posteriores, e — o mais grave — **empresas sem regime tributário definido, que portanto não geram nenhuma tarefa recorrente** (ficam "invisíveis" no sistema, silenciosamente).

**Why it happens:**
A pressão é "importar rápido para não recadastrar 100+ empresas manualmente". Validação de dados é vista como trabalho extra que atrasa a entrega, então é deixada para depois — mas "depois" significa que erros já estão espalhados pelo sistema com tarefas já geradas em cima de dados ruins.

**How to avoid:**
- Tratar a importação como um **processo de duas etapas**: (1) extrair e normalizar para uma tabela de staging/preview, (2) revisão humana (o dono do escritório, que conhece as 110 empresas) confirma/corrige antes da importação definitiva — especialmente o campo **regime tributário**, que provavelmente não existe pronto na planilha e precisa ser preenchido manualmente ou inferido (ex.: toda empresa na planilha de PIS/COFINS é, por definição, Lucro Real — mas as empresas de Simples Nacional do escritório provavelmente **não estão** nessa planilha e precisam ser cadastradas separadamente).
- Validar CNPJ com o algoritmo de dígito verificador (módulo 11) durante a importação — sinalizar CNPJs inválidos para revisão em vez de rejeitar silenciosamente ou aceitar como está.
- Detectar duplicatas por CNPJ (chave única real) em vez de por nome (que varia em grafia).
- Gerar um **relatório de importação**: X empresas importadas, Y com CNPJ inválido/faltante, Z sem regime definido, W duplicadas — para que o dono valide antes de "ir ao ar".
- Manter a importação como um script/processo repetível (não uma operação manual única "que ninguém lembra como foi feita"), porque é provável que seja necessário rodar de novo após correções.

**Warning signs:**
- Número de empresas importadas não bate com a contagem manual esperada (~100-110).
- Empresas aparecem sem nenhuma tarefa gerada no primeiro mês (regime não definido).
- CNPJs duplicados ou com formato inconsistente no banco.

**Phase to address:**
Fase de importação inicial de dados — deve vir **depois** que o modelo de dados de empresa/regime/obrigação já está definido (Pitfall 5), e **antes** da primeira execução do job de geração de tarefas recorrentes (senão gera tarefas em cima de dados não validados).

---

### Pitfall 8: Autorização "by convention" em vez de enforced — colaborador acessa dados de outro

**What goes wrong:**
O requisito é "cada colaborador vê só suas tarefas/empresas; o dono vê tudo". A implementação mais rápida é filtrar **na camada de UI** (esconder o menu/itens) ou no frontend, mas a API/backend continua aceitando requisições para qualquer `empresa_id` ou `tarefa_id` se o usuário souber/adivinhar o ID (ex.: trocando o número na URL `/empresas/47/tarefas`). Com apenas 5 usuários isso parece "baixo risco", mas é uma falha real de autorização (IDOR — Insecure Direct Object Reference) e, num escritório de contabilidade, os dados são sensíveis (CNPJs, situação fiscal de clientes).

**Why it happens:**
Com poucos usuários e "todo mundo se conhece", a tentação é confiar na boa-fé e simplificar: "não vou mostrar o link, então ninguém vai acessar". Mas qualquer um com a URL ou um pouco de curiosidade técnica pode acessar.

**How to avoid:**
- Toda rota/endpoint que retorna ou modifica uma tarefa/empresa deve verificar no **backend**, a cada requisição: o usuário autenticado tem permissão sobre essa empresa/tarefa específica? (Dono = sim sempre; colaborador = sim apenas se a empresa está na carteira dele, ou se a tarefa avulsa foi atribuída a ele).
- Modelar isso como uma checagem centralizada (middleware/policy/guard), não espalhada e duplicada em cada handler — para não esquecer de aplicar em alguma rota nova.
- Tarefas avulsas "atribuíveis a qualquer pessoa" (requisito do PROJECT.md) significa que a regra de "dono da empresa = dono da tarefa" não é suficiente — precisa checar também `responsavel_atual_id` da tarefa avulsa.
- Testar explicitamente: logar como colaborador A e tentar acessar/editar uma tarefa de uma empresa da carteira do colaborador B via API direta (não só pela UI) — deve ser bloqueado com 403/404.

**Warning signs:**
- Existe lógica de "esconder no frontend" sem checagem equivalente no backend.
- IDs sequenciais simples (1, 2, 3...) em URLs de empresas/tarefas, sem checagem de propriedade.
- Nenhum teste cobre "usuário tenta acessar recurso de outro usuário".

**Phase to address:**
Fase de autenticação/autorização (provavelmente Fase 1, junto com login multiusuário) — e revisitado em **toda** fase que adiciona uma nova entidade/endpoint (checklist de "essa rota tem checagem de propriedade?").

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|-----------------|
| Hardcodar lista de feriados de 2026 em vez de calcular dinamicamente | Entrega mais rápida do motor de prazos | Quebra silenciosamente em janeiro/2027; prazos errados não geram erro visível, só decisão errada | Nunca — o cálculo da Páscoa é simples e barato de implementar corretamente desde o início |
| `if/else` por regime tributário no código de geração | Menos tabelas no schema inicial | Re-trabalho ao adicionar Lucro Presumido/MEI ou particularidades por empresa; risco de reescrever histórico | Aceitável apenas se a tabela de configuração existir mas estiver populada só com 2 regimes — não aceitável fazer lógica condicional direto no código de geração |
| Dashboard calculando tudo "ao vivo" via GROUP BY na tabela de tarefas | Sem necessidade de jobs adicionais no MVP | Lentidão progressiva + números retroativos inconsistentes ao longo do tempo | Aceitável para o MVP **se** o schema já suporta adicionar snapshot mensal depois sem migração destrutiva |
| Importar planilha Excel "as is" com um script único, sem etapa de revisão | Importação em poucas horas | Empresas sem regime definido ficam invisíveis; CNPJs inválidos quebram features futuras (ex.: integração com ferramentas Python que dependem do CNPJ) | Nunca — a etapa de revisão humana é rápida (são 100-110 linhas) e evita retrabalho de correção em produção |
| Checagem de permissão só na UI/frontend | Telas mais simples | Falha de segurança real (IDOR) em sistema com dados fiscais sensíveis de clientes | Nunca, mesmo com 5 usuários conhecidos |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|------------------|--------------------|
| Ferramentas Python existentes (leitura de PDF ICMS, preenchimento da planilha PIS/COFINS) | Tentar acoplar/chamar os scripts Python diretamente do backend web no v1, criando dependência operacional frágil | v1 apenas **referencia/explica** o uso (conforme já decidido em Out of Scope) — manter o acoplamento como um link/instrução textual no passo a passo da tarefa, sem dependência de execução |
| Calendário de feriados | Confiar em uma API externa de feriados sem fallback — se a API cair ou mudar contrato, o cálculo de prazos para de funcionar | Calcular feriados nacionais localmente (algoritmo da Páscoa + lista de feriados fixos), sem dependência de serviço externo para uma função tão crítica |
| Hospedagem com cron (Render/Railway/etc.) | Assumir que o cron do provedor sempre roda exatamente uma vez no horário configurado, sem considerar fuso horário do provedor ou duplicidade em redeploys | Configurar fuso explícito no cron, implementar idempotência (Pitfall 1) independentemente da garantia do provedor |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sem índice em `(empresa_id, competencia)` / `(responsavel_id, status)` | Listagem de tarefas do colaborador começa a demorar | Criar índices desde a primeira migration que cria a tabela de tarefas | A partir de ~5.000-10.000 linhas (alguns meses de histórico com 110 empresas) |
| Dashboard "evolução mensal" recalculando agregados sobre toda a tabela de tarefas a cada acesso | Carregamento do dashboard fica perceptivelmente lento; aumenta com cada mês que passa | Snapshot mensal pré-calculado (tabela de resumo) gerado ao "fechar" o mês | A partir de ~12-24 meses de histórico (1.000-2.500+ tarefas/mês acumuladas) |
| Carregar todas as 110 empresas + tarefas do mês numa única tela sem paginação/filtro | Tela principal do colaborador lenta para renderizar | Filtrar por padrão (ex.: "minhas tarefas pendentes deste mês"), paginar listas grandes | Não é crítico em 110 empresas, mas já notável ao listar histórico de meses anteriores junto |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Checagem de visibilidade só no frontend (Pitfall 8) | Colaborador acessa dados fiscais de empresas de outro colaborador (CNPJ, situação, prazos) | Checagem de propriedade/role no backend em toda rota |
| Sessão sem expiração / token de longa duração para acesso remoto via internet | Sessão roubada de um dispositivo (notebook, celular) continua válida indefinidamente | Expiração de sessão razoável + opção de logout em todos os dispositivos |
| Senhas/credenciais simples ou compartilhadas entre os 5 usuários | Acesso indevido difícil de rastrear (não dá pra saber quem fez o quê) | Login individual obrigatório (já é requisito) + política mínima de senha + log de quem concluiu cada tarefa |
| Exposição de dados de CNPJ/empresas em endpoints de API sem autenticação (ex.: rota de "gerar tarefas" acessível sem token, pensada só para uso interno do cron) | Qualquer pessoa na internet com a URL pode disparar geração de tarefas ou ler dados | Toda rota, incluindo endpoints de jobs/cron, exige autenticação (token de serviço separado do login de usuário) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Alertas visuais de "atrasado" tratam todas as obrigações com a mesma urgência | Colaborador não consegue priorizar — uma DAS atrasada (multa imediata) parece igual a uma tarefa avulsa de baixa prioridade | Diferenciar visualmente por severidade/tipo de obrigação (ex.: cores/ícones diferentes para obrigações com multa automática vs tarefas internas) |
| Dashboard comparativo entre colaboradores mostra ranking "cru" sem contexto da carteira | Desmotivação, sensação de injustiça (carteiras com regimes/volumes diferentes) | Mostrar percentuais + contexto da carteira (nº de empresas, regime predominante) ao lado do ranking |
| "Marcar como concluído" sem confirmação ou desfazer | Clique acidental marca dezenas de tarefas como concluídas (ex.: ação em lote) sem volta fácil | Permitir desmarcar facilmente; ações em lote pedem confirmação |
| Tela do dono mostra TUDO sem filtro padrão | Sobrecarga de informação — 110 empresas x várias obrigações é muita coisa para uma visão "geral" sem hierarquia | Visão do dono com drill-down: resumo agregado primeiro (por colaborador/status), detalhe ao clicar |

## "Looks Done But Isn't" Checklist (v1.0)

- [ ] **Geração de tarefas recorrentes:** Parece funcionar ao rodar uma vez — verificar se rodar o job **duas vezes seguidas** para o mesmo mês não duplica nada (constraint UNIQUE testada).
- [ ] **Cálculo de dia útil/feriado:** Parece funcionar para o mês atual — verificar se funciona corretamente para **Carnaval/Páscoa de pelo menos 2 anos diferentes** (datas móveis mudam todo ano) e para o **próximo ano** (ex.: dezembro/janeiro de virada de ano).
- [ ] **Regras por regime tributário:** Parece funcionar para Lucro Real e Simples Nacional — verificar se o schema permite adicionar um terceiro regime ou uma "obrigação extra para uma empresa específica" **sem alterar código**.
- [ ] **Importação da planilha:** Parece importar todas as linhas — verificar se **toda** empresa importada tem regime tributário definido e gera tarefas no primeiro mês (nenhuma empresa "invisível").
- [ ] **Permissões multiusuário:** Parece funcionar pela UI — verificar via chamada direta de API (ex.: Postman/curl) se um colaborador consegue acessar dado de empresa fora da sua carteira.
- [ ] **Dashboard de evolução mensal:** Parece mostrar gráficos corretos hoje — verificar se os números de **meses fechados** permanecem estáveis quando se olha novamente dias depois (não devem "flutuar" por causa de tarefas concluídas com atraso recalculando o passado).
- [ ] **Ajuste de prazo por feriado:** Parece ajustar corretamente para "fim de semana" — verificar se a regra de **antecipar vs adiar** está correta para cada tipo de obrigação (DAS adia, DARF/federais geralmente antecipam) e validada contra o calendário oficial do ano corrente.

## Recovery Strategies (v1.0)

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Tarefas duplicadas já geradas em produção | LOW-MEDIUM | Script de limpeza: identificar duplicatas por `(empresa_id, tipo_obrigacao, competencia)`, manter a mais antiga (ou a concluída, se uma das cópias já foi marcada), deletar as demais; depois aplicar a constraint UNIQUE retroativamente |
| Feriados/prazos calculados errados para um mês já passado | MEDIUM | Recalcular `data_vencimento_ajustada` para tarefas daquele mês com a regra corrigida; reavaliar status "atrasado/no prazo" das tarefas já concluídas (cuidado: pode mudar métricas de dashboard retroativamente — comunicar à equipe) |
| Empresa importada sem regime tributário, descoberta meses depois | LOW | Definir o regime retroativamente no cadastro; rodar manualmente a geração de tarefas para as competências que ficaram sem tarefas (job de "backfill" idempotente, reaproveitando a mesma lógica do job mensal) |
| Falha de autorização descoberta após uso real (colaborador acessou dado de outro) | MEDIUM-HIGH | Corrigir a checagem de propriedade no backend; auditar logs de acesso (se existirem) para entender o que foi exposto; comunicar ao dono do escritório por questão de confidencialidade dos dados de clientes |
| Schema de regime tributário sem suporte a histórico, descoberto quando uma empresa muda de regime | MEDIUM-HIGH | Adicionar tabela de histórico de regime; migrar dado atual como "registro único desde sempre"; tarefas já geradas não são reescritas — só passam a usar o histórico a partir da mudança registrada |

## Pitfall-to-Phase Mapping (v1.0)

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Geração duplicada de tarefas (Pitfall 1) | Fase de geração de tarefas recorrentes | Rodar o job de geração 2x seguidas no mesmo mês em ambiente de teste; contagem de tarefas não muda na 2ª execução |
| Bug de fuso horário no job (Pitfall 2) | Fase de configuração de infraestrutura/scheduler | Teste automatizado simulando execução em horários limítrofes (23:59/00:01 em America/Sao_Paulo) |
| Cálculo de feriados hardcoded (Pitfall 3) | Fase de motor de cálculo de prazos/dias úteis | Testes unitários com Carnaval/Páscoa de pelo menos 2-3 anos diferentes, incluindo anos futuros |
| Regra de ajuste antecipa vs adia incorreta (Pitfall 4) | Mesma fase do Pitfall 3 — tabela de regras por tipo de obrigação | Casos de teste com datas reais validadas contra calendário oficial do Simples Nacional / Receita Federal |
| Modelo de regime tributário não extensível (Pitfall 5) | Fase de modelagem de dados / cadastro de empresas | Revisão de schema: adicionar um regime fictício novo (ex.: "Lucro Presumido") sem alterar código, só dados |
| Dashboards lentos/enganosos (Pitfall 6) | Fase de modelagem de dados (índices + estrutura de snapshot) e fase de implementação dos dashboards | Teste de carga com volume simulado (110 empresas x 12 meses x obrigações); revisão de UX do ranking comparativo com o dono |
| Importação suja da planilha Excel (Pitfall 7) | Fase de importação inicial de dados, após Pitfall 5 estar resolvido | Relatório de importação revisado pelo dono: 0 empresas sem regime, 0 CNPJs inválidos sem sinalização, contagem bate com esperado |
| Autorização não enforced no backend (Pitfall 8) | Fase de autenticação/autorização (early) | Teste de API direta: colaborador A não consegue acessar/modificar recursos de empresas fora da sua carteira |

## Sources (v1.0)

- [Idempotent Cron Jobs are Operable Cron Jobs – Robust Perception](https://www.robustperception.io/idempotent-cron-jobs-are-operable-cron-jobs/)
- [How to prevent duplicate cron jobs from running – Cronitor](https://cronitor.io/guides/how-to-prevent-duplicate-cron-executions)
- [Kubernetes CronJob - How to handle concurrency and duplicates](https://www.middlewareinventory.com/blog/kubernetes-cronjob-best-practices/)
- [Cron Timezones Explained — CodeAva](https://www.codeava.com/blog/cron-timezones-explained-utc-offset)
- [Time Zone Handling in Scheduled Jobs — Medium (Sohail Saifi)](https://medium.com/@sohail_saifi/time-zone-handling-in-scheduled-jobs-why-your-cron-jobs-run-at-the-wrong-time-8c935e7f8762)
- [API de Feriados Brasileiros (feriadosapi.com)](https://feriadosapi.com/)
- [feriados.dev - API de Feriados do Brasil](https://feriados.dev/)
- [Calculadora de Dias Úteis — Com Feriados Nacionais](https://www.calculeonline.com/calculadora-dias-uteis)
- [Vencimento dos tributos federais em feriados, sábados ou domingos — Portal Tributário](https://www.portaltributario.com.br/guia/vencimento-dos-tributos-em-feriados-sabados-ou-domingos.htm)
- [Como é o calendário mensal de apurações do Simples Nacional? — Conube](https://suporte.conube.com.br/como-%C3%A9-o-calend%C3%A1rio-mensal-de-apura%C3%A7%C3%B5es-do-simples-nacional)
- [Prazos EFD Contribuições — e-Auditoria](https://www.e-auditoria.com.br/blog/prazos-efd-contribuicoes-cumpra-os-prazos-sem-expor-seu-escritorio/)
- [PRAZOS PARA ENTREGA DO SPED FISCAL EM TODOS OS ESTADOS — RADINFO](https://home.radinfo.com.br/prazos-para-entrega-do-sped-fiscal-em-todos-os-estados-3/)
- [Migração de regime tributário: Simples Nacional para Lucro Real — SmartOnline](https://smartonline.app/regime-tributario-simples-nacional-lucro-real/)
- [Regime tributário: é possível mudar no 2º semestre? — Contábeis](https://www.contabeis.com.br/noticias/61205/regime-tributario-e-possivel-mudar-no-2o-semestre/)
- [Multi-tenant data isolation with PostgreSQL Row Level Security — AWS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Row-Level Security for Multi-Tenant SaaS Analytics — Querio](https://querio.ai/articles/row-level-security-multi-tenant-saas-analytics)
- [Why Role-Based Access Isn't Enough in Modern BI Environments](https://thereportinghub.com/blog/why-role-based-access-isnt-enough-in-modern-bi-environments)
- [Solving the N+1 Query Problem — DEV Community](https://dev.to/vasughanta09/solving-the-n1-query-problem-a-developers-guide-to-database-performance-321c)
- [Optimizing Query Performance for Large Datasets Powering Dashboards — Harness](https://www.harness.io/blog/optimizing-query-performance-for-large-datasets-powering-dashboards)
- [Why Tableau Dashboards Slow Down With Large Datasets — Perceptive Analytics](https://www.perceptive-analytics.com/why-tableau-dashboards-slow-down-with-large-datasets/)
- [Goodhart's Law: The Danger of Making Metrics into Targets — ILMS Academy](https://www.ilms.academy/blog/goodharts-law-the-danger-of-making-metrics-into-targets)
- [Goodhart's Law and the Death of Honest Metrics — Medium](https://medium.com/@claus.nisslmueller/goodharts-law-and-the-death-of-honest-metrics-e08cc756f93a)
- [Why Migrate from Excel to a Database? — i3 Solutions](https://i3solutions.com/excel-spreadsheet-modernization-services/why-migrate-from-excel-to-database/)
- [What's the Best Way to Handle Data Deduplication in ETL? — Airbyte](https://airbyte.com/data-engineering-resources/the-best-way-to-handle-data-deduplication-in-etl)
- [How to Manage Data Quality in an ERP Migration — WinPure](https://winpure.com/data-quality-erp-migration/)
- [Building a Dynamic Rules Engine in Spring Boot with the Strategy + Registry Pattern — Medium](https://medium.com/@venkatsai0398/building-a-dynamic-rules-engine-in-spring-boot-with-the-strategy-registry-pattern-c8bafacc1031)
- [Rules Engine Pattern – DevIQ](https://deviq.com/design-patterns/rules-engine-pattern/)

---

# Part B — v2.0 Addendum: Multi-Sector Expansion Pitfalls (2026-06-22)

**Scope:** Pitfalls specific to ADDING DP (Departamento Pessoal) and Contábil sectors to this already-built, already-in-production system — grounded in direct inspection of the actual codebase (`prisma/schema.prisma`, `src/lib/visibility-scope.ts`, `src/modules/tarefas/geracao.ts`, `src/lib/geracao-tarefas.ts`, `src/lib/scheduler.ts`, `src/modules/dashboards/queries.ts`, `src/modules/empresas/queries.ts`), not generic multi-tenant advice.

## Context Anchors (what "this system" actually looks like today)

- `prisma/schema.prisma`: `Empresa.responsavelId` is a single required `String` FK to `Usuario`, with `@@index([responsavelId])`. No junction table exists yet.
- `Tarefa` has its own `responsavelId` (copied from `empresa.responsavelId` at generation time, per D-09) — **two places** carry "who is responsible," not one.
- `@@unique([empresaId, tipoObrigacao, competencia])` on `Tarefa` is the idempotency backbone — `executarGeracaoMensal` relies on `skipDuplicates: true` against this constraint, with **no application-level pre-check** (deliberate, documented anti-TOCTOU design in `src/modules/tarefas/geracao.ts`).
- `src/lib/visibility-scope.ts` exposes `withVisibilityScope` (Empresa) and `withTarefaScope` (Tarefa), both keyed on a single `responsavelId === user.id` comparison. `DONO` → `{}`, `COLABORADOR` → `{ responsavelId: user.id }`.
- `gerarTarefasDoMes` (`src/lib/geracao-tarefas.ts`) is a **pure function**, keyed only on `RegimeTributario` → catalog of `TipoObrigacao` with a `diaBase`. It has no concept of sector, periodicity beyond monthly, or which `responsavelId` to use beyond `empresa.responsavelId`.
- `executarGeracaoMensal` reads ALL active `Empresa` rows in one `findMany`, generates ALL obligations for ALL regimes in one pass, and writes them in one `createMany` inside one transaction — with NO sector filter, because sector doesn't exist yet.
- Dashboards: `src/app/(app)/dashboards/guard.ts` is DONO-only (`notFound()` for non-DONO, before any query). Queries live in `src/modules/dashboards/queries.ts` (plural — the live, wired-up module).
- **Live evidence of the exact drift pitfall this addendum warns about**: `src/modules/dashboard/queries.ts` (singular) already exists in this repo as an orphaned/abandoned duplicate of the dashboards module, referencing a different schema shape (`desempenhoMensalSnapshot`, `usuarioId`) that doesn't even match current Prisma models. This is not hypothetical — it is sitting in the tree today as proof that parallel duplicate query modules drift fast and silently in this codebase.

## Critical Pitfalls (v2.0)

### Pitfall B1: Migrating `responsavelId` to per-sector without a backfill plan that accounts for live data semantics, not just schema shape

**What goes wrong:**
The naive migration path is: add a `EmpresaResponsavelSetor` junction table (empresaId, setor, responsavelId), then either (a) drop `Empresa.responsavelId` immediately, or (b) leave it dangling. Both break things. Dropping it immediately breaks every existing query/component that still reads `empresa.responsavelId` (there are several: `empresas/queries.ts` EMPRESA_SELECT, `empresa-form.tsx`, `empresas-table.tsx`, the import wizard, and crucially `gerarTarefasDoMes`/`executarGeracaoMensal` which read it directly with no scope check). Leaving it dangling without a clear migration meaning creates ambiguity: does old `responsavelId` mean "fiscal responsável" now? If the backfill script doesn't explicitly map the 197 existing `responsavelId` values to `setor: FISCAL` rows in the new junction table, fiscal task generation silently loses its responsible-party assignment the moment the engine is refactored to read from the junction table instead of the old column.

**Why it happens:**
The schema migration looks "done" once `prisma migrate dev` succeeds and the junction table exists. But a successful migration only proves the *shape* is right — it says nothing about whether the 197 rows of *existing* data were translated into the new shape correctly. Junction-table migrations are notoriously easy to ship with an empty table (correct schema, zero rows), because Prisma migrations don't auto-populate join tables from a column being dropped.

**How to avoid:**
- Treat this as two separate, sequenced steps, not one migration: (1) ADD the junction table and a data backfill script that inserts one row per existing `Empresa` with `setor: 'FISCAL'`, `responsavelId: empresa.responsavelId` for all 197 companies — verified by a count assertion (197 empresas → 197 fiscal junction rows, no fewer, no more) before any code reads from the new table; (2) only AFTER the backfill is verified, repoint the read paths (`gerarTarefasDoMes`, `withVisibilityScope`, `empresas/queries.ts`, dashboards) to the junction table.
- Keep `Empresa.responsavelId` column in place (deprecated, unread) for at least one full release cycle as a rollback safety net — do not drop it in the same migration that introduces the junction table. Dropping a column and adding a replacement table in the same deploy removes your ability to diff "old value vs new value" if the backfill script has a bug.
- Write a verification query that compares `Empresa.responsavelId` to the FISCAL row in the junction table for all 197 companies and asserts equality before considering the migration phase done.

**Warning signs:**
- Backfill script "succeeds" but row count in junction table doesn't match `197 * 1` (one row each, sector=FISCAL) before DP/Contábil assignment.
- Any remaining code path doing `db.empresa.findMany({ select: { responsavelId: true } })` after the junction table is supposed to be the source of truth — this is a sign the migration is half-done and two sources of truth now disagree.
- DP/Contábil responsável fields silently `null` for all 197 companies post-migration because nobody ran a second backfill pass to assign placeholder DP/Contábil colaboradores per company (this is a separate step from the FISCAL backfill above — the junction table needs 3 rows per company eventually, not 1).

**Phase to address:** Schema migration phase (first phase of v2.0) — must complete and be verified BEFORE the generation-engine phase begins, because the engine phase needs the junction table populated and correct to read sector-specific responsáveis.

---

### Pitfall B2: Extending the generation engine to "annual" periodicity by bolting an `if` onto the monthly cron path instead of generalizing competência semantics

**What goes wrong:**
The existing engine's mental model is baked into multiple places around "month": `competenciaAtual()` returns `"YYYY-MM"`, `calcularPrazoBase` does `addMonths(..., 1)`, the unique constraint is `(empresaId, tipoObrigacao, competencia)` where `competencia` is always a month string, and the cron fires monthly (`0 6 1 * *`) and unconditionally calls `executarGeracaoMensal(competenciaAtual())`. The naive extension is to special-case ECF/DEFIS inside the monthly cron tick — e.g., "if month === 12, also generate annual obligations for competência = current year." This conflates two timelines (calendar month tick vs. annual obligation) and risks: (a) ECF/DEFIS gets generated on whatever arbitrary month the developer picked, with no documented business reason tied to actual deadlines (ECF deadline is typically July of the following year, DEFIS March); (b) the `competencia` string format ambiguity — is annual competência `"2025"` or `"2025-12"`? If it's forced into `"YYYY-MM"` shape to satisfy the existing `String` column and unique constraint without an explicit decision, two different annual tasks for the same year could either collide (false idempotency conflict) or duplicate (e.g., one row with `competencia="2025-12"` and another script run later generating `competencia="2025-01"` for the same fiscal year by mistake).

**Why it happens:**
The existing engine was deliberately built single-purpose (good v1.0 decision — pure function, no premature abstraction). Now that a second periodicity is needed, the temptation is to patch the smallest possible surface area (add an `if` in the cron callback) rather than introduce a `periodicidade` concept into the data model and catalog, because that touches the unique constraint, the catalog type, and `calcularPrazoBase`'s competência-parsing logic (`competencia.split("-")` would throw or misparse on a bare year string like `"2025"`).

**How to avoid:**
- Add an explicit `periodicidade: 'MENSAL' | 'ANUAL'` field to the obligation catalog entries (not inferred from tipoObrigacao name matching) and to `Tarefa` itself (or keep it derivable from `tipoObrigacao` via the catalog, but never inferred from string-parsing the competência value).
- Decide and document the competência format for annual obligations explicitly (e.g., `"2025"` for annual vs `"2025-03"` for monthly) and update `calcularPrazoBase`/`competenciaParaDataLocal` to branch on length/format rather than assuming `split("-")` always yields `[ano, mes]`. Any code that currently does `competencia.split("-").map(Number)` and destructures `[ano, mes]` will silently produce `mes = NaN` or `mes = undefined` on an annual-only string — audit every call site of this pattern (`geracao-tarefas.ts`, `geracao.ts`, `dashboards/queries.ts` `calcularCategoriasCriadas`) before extending.
- Keep the annual generation triggered by the SAME monthly cron tick (don't add a second cron job) but make the engine itself decide, based on `periodicidade` and the current calendar month, which obligations are due for generation — e.g., "generate ECF only when cron runs in March" — as an explicit, testable rule in the catalog, not an inline conditional in `scheduler.ts`.
- Add dedicated unit tests asserting that running the monthly cron 12 times in a simulated year produces exactly one ECF/DEFIS task (not zero, not twelve) and that the unique constraint correctly prevents a second annual task for the same year even if the cron is manually re-triggered mid-year.

**Warning signs:**
- Annual obligation logic lives as an `if (mes === X)` literal inside `scheduler.ts` or `executarGeracaoMensal` rather than as catalog metadata.
- `competencia.split("-")` appears anywhere in new/modified code without a guard for annual-format strings.
- The unique constraint `@@unique([empresaId, tipoObrigacao, competencia])` is reused as-is for annual tasks without verifying that `competencia` values for annual obligations are unique per year (e.g., if someone reuses `"2025-12"` as the annual competência AND a December monthly obligation also exists with `tipoObrigacao` overlapping, you'd want them to be genuinely different rows — verify `tipoObrigacao` enum values for ECF/DEFIS are distinct enough that no monthly obligation could accidentally collide).

**Phase to address:** Generation-engine phase — must be designed before the DP/Contábil catalog is added, since the catalog structure depends on whether periodicidade is a first-class field. Should be validated with idempotency tests mirroring the existing `tests/geracao.idempotencia.test.ts` pattern, extended to cover annual + monthly running in the same transaction without constraint collisions.

---

### Pitfall B3: Adding `setor` to RBAC scoping by modifying `withVisibilityScope`/`withTarefaScope` in place, silently changing v1.0 fiscal behavior

**What goes wrong:**
The instinct is to add a `setor` parameter to the existing scope functions and have COLABORADOR's check become `{ setor: user.setor, responsavelId: user.id }` via the new junction table. Done carelessly, this can go wrong in either direction:
- **Narrowing bug**: if the new junction-table-based scope is implemented as an `every`/`some` Prisma relation filter incorrectly, a fiscal colaborador who used to see "all empresas where `responsavelId === me`" might now see fewer or zero empresas if the join condition requires BOTH `setor` match AND the join to succeed, but the junction table backfill (Pitfall B1) hasn't run correctly for some companies — a regression that looks like "my client list is empty" for real users on day one of v2.0.
- **Widening bug**: if `Usuario.setor` is used to filter, but the query forgets to also filter by `responsavelId` for that sector specifically (e.g., uses `some: { setor: user.setor }` without `responsavelId: user.id` in the same nested filter), a COLABORADOR could see ALL companies in their sector regardless of who's actually responsible — breaking the core "colaborador sees only their own" guarantee that v1.0 explicitly tested (`tests/visibility-scope.test.ts`, `tests/tarefas.idor.test.ts`, `tests/empresas.idor.test.ts`).
- **Tarefa scope drift**: `Tarefa.responsavelId` is currently a flat copy of `empresa.responsavelId` at generation time (D-09). If the generation engine starts writing sector-specific `responsavelId` correctly but `withTarefaScope` isn't updated in lockstep, COLABORADOR users could see tarefas whose `responsavelId` belongs to a different sector's colaborador with the same numeric ID coincidence — unlikely with cuid()s, but the real risk is the inverse: a DP colaborador's tarefas use `Tarefa.responsavelId` set correctly to them, but `withTarefaScope` is never sector-aware at all (since it only checks `responsavelId === user.id`), which is actually FINE for Tarefa scope (a tarefa's responsável is unambiguous per row) — the real risk is at the Empresa level, where one company now has 3 responsáveis and `withVisibilityScope`'s old single-`responsavelId` check becomes meaningless/wrong if not migrated to check the junction table.

**Why it happens:**
`withVisibilityScope` and `withTarefaScope` are small, simple, heavily trusted functions (explicitly documented as "NEVER call db.empresa without this"). Their simplicity is exactly why they're risky to touch: any contributor (human or AI) extending them without re-running the existing IDOR/visibility test suite against ALL sectors, not just fiscal, can introduce a subtle regression that the existing test suite (written for single-responsável fiscal-only) won't catch because it doesn't even have sector-aware test fixtures yet.

**How to avoid:**
- Before changing `withVisibilityScope`, write NEW test fixtures with 3 sectors x multiple colaboradores x shared companies, explicitly asserting: a DP colaborador sees a company if AND ONLY IF they are the DP responsável for it, regardless of who the fiscal/contábil responsável is. Mirror the existing `tests/visibility-scope.test.ts`/`tests/empresas.idor.test.ts` structure but parametrize over setor.
- `withVisibilityScope` should likely change signature to require a `setor` argument explicitly (not infer it from `user.setor` alone, because DONO has no setor and must still see everything, and a colaborador's session should make explicit which sector's view is being requested if sector pages are truly separate per the v2.0 "no unified dashboard" decision) — e.g., `withVisibilityScope(user, setor)` returning `{ responsaveis: { some: { setor, responsavelId: user.id } } }` against the junction relation.
- Run the FULL existing IDOR/visibility test suite (`tests/visibility-scope.test.ts`, `tests/tarefas.idor.test.ts`, `tests/empresas.idor.test.ts`, `tests/empresas.queries.test.ts`) unmodified against the new implementation as a regression gate — if any of these break, the v1.0 fiscal guarantee has regressed, full stop, before sector-specific tests are even considered.
- Do not let `Usuario.setor` alone gate visibility for COLABORADOR — `setor` answers "which sector's pages can this person navigate to," while `responsavelId` (per sector, via junction) answers "which companies can they see within that sector." Conflating the two (e.g., "DP colaboradores see all DP companies") would be the widening bug described above and directly violates the v1.0-validated requirement that colaboradores see only their own assigned companies.

**Warning signs:**
- Any new scope function takes only `user` and infers sector implicitly from `user.setor`, with no explicit `setor` parameter — a sign the function conflates "which sector pages I can access" with "which companies I'm responsible for in that sector."
- Existing IDOR tests fail after the scope change and get "updated" to match new (wider) behavior rather than investigated as a regression — this is the single most dangerous failure mode for this pitfall, because it would make the test suite complicit in masking the security regression.
- A colaborador in DP reports seeing companies they don't actually handle, or a fiscal colaborador reports their client list shrank after the v2.0 deploy.

**Phase to address:** RBAC/scoping phase — should be sequenced AFTER the junction table backfill is verified (Pitfall B1) but BEFORE or concurrently with the dashboard phase, since dashboards also need correct per-sector scoping (the DONO-only dashboards are simpler — gate stays "DONO only," but if any future per-colaborador dashboard view is added, it would inherit this same risk).

---

### Pitfall B4: Duplicating dashboard query modules per sector the same way `src/modules/dashboard/` (singular) already diverged from `src/modules/dashboards/` (plural) in this exact codebase

**What goes wrong:**
This is not a hypothetical risk — it has already happened once in this codebase. `src/modules/dashboard/queries.ts` (singular, untracked in git per the status snapshot) is an abandoned parallel implementation of the same 3 dashboards, written against a DIFFERENT schema shape (`db.desempenhoMensalSnapshot`, `usuarioId`) that doesn't match the current Prisma schema (`DesempenhoMensal`, `colaboradorId`). It is dead code sitting in the tree, presumably from an earlier exploratory pass, never cleaned up. If the same pattern is repeated for DP/Contábil dashboards — i.e., copy `src/modules/dashboards/queries.ts`, rename internals for "DP," paste as a new file — the project will end up with 3 near-identical files (`dashboards-fiscal/`, `dashboards-dp/`, `dashboards-contabil/`) that each independently encode the same subtle business rules (D-01 "no prazo" definition, D-05 frozen-snapshot-vs-live continuity logic, D-06's deliberately-different "atrasada" rule for ranking vs colaborador dashboards). A bug fix or rule change made in one (e.g., correcting the timezone-sensitive `competenciaParaDataLocal` off-by-one already flagged in comments) will not propagate to the other two unless someone remembers to apply it three times by hand.

**Why it happens:**
Copy-paste-and-rename is the fastest way to get a working DP dashboard page when the fiscal one already works and "looks done." It avoids the harder design question (how do you parametrize a query module over `setor` cleanly when `Tarefa`/`Empresa` need a `setor`-aware filter threaded through every query) and produces visible progress quickly. The existing duplicate (singular vs plural module) is itself evidence this has already happened once under time pressure in this exact project.

**How to avoid:**
- Parametrize, don't duplicate: add `setor` as an explicit parameter to every dashboard query function (`listarDesempenhoColaboradoresMesAtual(mes, setor)`, `listarEvolucaoMensal(quantidadeMeses, setor)`, `listarRankingEmpresas(periodoInicio, periodoFim, setor)`), threading a `setor` filter into the underlying `Tarefa`/`Empresa` where clauses (once `Tarefa` or its junction carries sector — note `Tarefa` itself may need a `setor` column or derive it from `tipoObrigacao`'s sector mapping, since `TipoObrigacao` enum values are currently fiscal-only and DP/Contábil will add new enum values like `FOLHA`, `FGTS`, `ECF`, etc.).
- Keep ONE query module (`src/modules/dashboards/queries.ts`), not three. The 3 "separate pages, no unified view" requirement from PROJECT.md is a UI/routing decision (3 distinct page routes, each calling the same parametrized functions with a fixed `setor` value), not a data-layer duplication decision. Conflating "separate pages" with "separate query modules" is the actual root cause of this pitfall.
- Delete the orphaned `src/modules/dashboard/queries.ts` (singular) as part of this milestone's cleanup — it is currently dead code referencing a non-existent schema shape and is exactly the kind of drift this pitfall warns about; leaving it in the tree increases the odds someone edits the wrong file by mistake (the singular/plural naming collision is a footgun on its own).
- Add a `setor` field early to the `TipoObrigacao`-equivalent catalog entries (or a new enum mapping `TipoObrigacao -> Setor`) so every dashboard query can filter `Tarefa` by sector via a single derived join/computed field rather than three independently-maintained sector-specific catalogs.

**Warning signs:**
- A new file or directory named `dashboards-dp`, `dashboards-contabil`, `dp/queries.ts`, etc. appears, mirroring `dashboards/queries.ts` function-by-function instead of adding a `setor` parameter to the existing functions.
- The existing `src/modules/dashboard/` (singular) directory is still present and untouched when v2.0 work begins — it should be deleted, not left to confuse future contributors about which module is canonical.
- A bug fix (e.g., the documented timezone off-by-one in `competenciaParaDataLocal`/snapshot logic) is applied to the fiscal dashboard file but DP/Contábil dashboard files still have the old buggy version, discovered only when DP numbers look subtly wrong around month boundaries.

**Phase to address:** Dashboard phase (last phase of v2.0 per the milestone's listed feature order) — but the DECISION to parametrize-not-duplicate must be made and validated in the generation-engine/schema phases (need `setor` on `Tarefa`/catalog early) so the dashboard phase isn't forced into duplication because the underlying data model has no sector dimension to filter on yet.

---

## Technical Debt Patterns (v2.0)

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Keep old `Empresa.responsavelId` column alongside new junction table indefinitely, never dropped | Safe rollback path, no rush to migrate every read site at once | Two sources of truth for "fiscal responsável" forever; future contributors may read the stale column by mistake | Acceptable for 1 release cycle as a safety net; must be removed once junction table is proven correct and all reads are migrated — track as explicit follow-up, not silent permanence |
| Copy-paste dashboard query file per sector instead of parametrizing | Fastest path to a visibly working DP dashboard page | Triples maintenance burden for every future bug fix/rule change (see Pitfall B4); this project ALREADY has one orphaned duplicate from this exact shortcut | Never acceptable — the cost of parametrizing now is low (functions already take explicit params), the cost of un-duplicating later is high |
| Hardcode annual obligation trigger month as a literal `if (mes === 7)` in the cron callback | Ships ECF generation quickly without touching the catalog/periodicidade model | Business rule (when ECF/DEFIS actually become due) is invisible outside the cron file, untested in isolation, and easy to break when refactoring `scheduler.ts` for unrelated reasons | Only acceptable as a throwaway spike to validate the deadline date, never merged — replace with catalog-driven periodicidade before merging |
| Skip writing sector-aware IDOR test fixtures and just manually click through the DP login to "check it looks right" | Faster to demo | Misses the exact class of widening/narrowing bugs described in Pitfall B3, which are invisible in casual manual testing (you'd need to log in as multiple colaboradores across sectors and compare lists) | Never acceptable for the RBAC scoping phase — this is precisely the kind of bug that silently leaks/hides client data and erodes trust in "the dono always knows the status of everything" |

## Integration Gotchas (v2.0)

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Cron job (`src/lib/scheduler.ts`) + new annual periodicity | Adding a second `cron.schedule(...)` call specifically for annual obligations, duplicating the `globalThis.__agendaFiscalCronStarted` guard pattern incorrectly (e.g., reusing the same flag for both jobs, so registering the annual job accidentally skips if the monthly one already set the flag) | Keep ONE cron registration; let `executarGeracaoMensal` (or its renamed successor) internally decide which periodicities are due this tick, based on catalog metadata — single entry point, single idempotency guard, mirroring the existing documented pattern that "cron and manual trigger call exactly the same function" |
| Prisma unique constraint reuse for annual tasks | Reusing `@@unique([empresaId, tipoObrigacao, competencia])` as-is without validating that annual `competencia` values (e.g., `"2025"`) can't collide with or duplicate against monthly values for an unrelated `tipoObrigacao` in the same year | Explicitly test that annual + monthly task generation in the same calendar year for the same `empresaId` never violates or accidentally satisfies the unique constraint in an unintended way — add a dedicated test fixture mixing both periodicities in one transaction |
| Existing IDOR/visibility test suite vs new sector dimension | Treating the existing `tests/visibility-scope.test.ts` etc. as "passing = done" without adding NEW sector-parametrized fixtures, since the old suite has no concept of `setor` and can pass trivially even with a broken sector implementation | Old suite passing is necessary but not sufficient — must add new multi-sector fixtures (3 sectors x shared companies x different responsáveis per sector) as described in Pitfall B3 |

## Performance Traps (v2.0)

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| `executarGeracaoMensal` reading ALL active empresas in one `findMany` and generating ALL obligations (fiscal + DP + contábil) in one transaction, now 3x the row count and 3x the obligation types per company | Cron job transaction duration increases roughly proportionally to (sectors x obligation types); at 197 companies x 3 sectors x ~3-4 obligations each, still likely well under any practical Postgres transaction timeout, but worth measuring once DP/Contábil catalogs are added | Keep using `createMany({ skipDuplicates: true })` (already batch-efficient); measure actual transaction duration after adding DP+Contábil catalogs before assuming it's fine — don't split into 3 separate transactions per sector unless measurement shows a real problem (splitting loses the current "snapshot + generation atomic together" guarantee) | Unlikely to break at this scale (~197 companies); would only become a real concern at 1000s of companies or dozens of obligation types per sector |
| Dashboard `groupBy`/in-memory aggregation patterns (`porColaborador` Map, `porEmpresa` Map) now needing a `setor` dimension added to every aggregation key | If `setor` is added as a filter rather than threaded into the grouping key, dashboards could silently aggregate across sectors when they shouldn't (a DP dashboard showing fiscal data mixed in) — this is a correctness trap as much as a performance one | Add `setor` to every `where` clause explicitly per dashboard call (parametrized per Pitfall B4), not just to the eventual display layer | Becomes a live bug the moment a second sector's data exists in the `Tarefa` table — i.e., immediately upon DP/Contábil generation going live, not a "scale" threshold |

## Security Mistakes (v2.0)

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating `Usuario.setor` as sufficient for RBAC scoping (colaborador sees all companies in their sector) instead of combining it with per-company per-sector `responsavelId` | A DP colaborador could see/edit ALL ~197 companies' DP data instead of just the ones assigned to them — a direct regression of the v1.0-validated "colaborador sees only their own" guarantee, now scoped per-sector instead of globally, and easy to miss because it "looks like an upgrade" (sector isolation) while actually removing per-person isolation within the sector | See Pitfall B3 — require explicit `setor` + `responsavelId` combination in every scope function, with dedicated regression tests |
| `gerarTarefasDoMes`/`executarGeracaoMensal` cron path has NO auth context by design (documented as deliberate in `geracao.ts`) — extending it to read per-sector responsável from the new junction table without re-verifying this "no scope needed, reads everything" assumption still holds | If a future refactor mistakenly tries to apply `withVisibilityScope`/`withTarefaScope` inside the cron path (e.g., copy-pasting a scoped query pattern from elsewhere), the cron would silently generate tasks for a subset of companies/sectors only, since there's no "DONO" user object in a cron context to satisfy a DONO-only `{}` scope — tasks would simply stop being generated for some companies with no error | Keep the documented invariant explicit in the new code: the generation engine reads ALL active empresas across ALL sectors, unscoped, by design — add a code comment/test asserting this invariant survives the sector-extension refactor |
| Reusing `Tarefa.responsavelId` (flat copy at generation time, per D-09) as the sole authority for Tarefa-level visibility without re-verifying it's populated correctly for DP/Contábil tasks generated from the NEW junction table (not the old single column) | If the generation engine is updated to read sector-specific responsável from the junction table but a code path still falls back to `empresa.responsavelId` (the old single column) for DP/Contábil task creation, ALL DP/Contábil tasks across all 197 companies would get assigned to whoever the FISCAL responsável happens to be — a systemic misassignment, not a one-off bug, and the kind of error that's invisible until colaboradores start asking "why am I seeing tasks for companies I don't handle in DP" | Add an explicit assertion/test that DP and Contábil generated tasks have `responsavelId` values drawn from the DP/Contábil colaborador pool (the 7 new placeholder users), never matching a fiscal-only colaborador's id, as a generation-engine test |

## UX Pitfalls (v2.0)

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| 7 new placeholder colaboradores (4 DP + 3 Contábil) given generic names like "DP1", "Contábil2" indefinitely if the renaming quick-task is forgotten | Dono and colaboradores see confusing generic names in dashboards/task lists for an extended period, undermining trust in "dono always knows who's responsible" | Treat placeholder renaming as a tracked, time-boxed follow-up immediately after the migration phase — mirror exactly how the v1.0 fiscal colaborador1-4 -> real names was handled (per Key Decisions in PROJECT.md), don't let it linger |
| Empresa edit form (`empresa-form.tsx`) still shows a single "Responsável" field after the schema migration, because the UI wasn't updated in the same phase as the data model | Users editing a company can't see or change DP/Contábil responsáveis at all, or worse, editing the visible single field silently only updates the FISCAL responsável while the UI implies it controls "the" responsável | Update `empresa-form.tsx`/`empresas-table.tsx` to show 3 distinct responsável fields (one per sector) in the SAME phase as the schema migration, not deferred to a later UI-polish pass — otherwise there's a window where the data model supports per-sector responsáveis but the UI can't express it |
| Dashboards "duplicated per sector, no unified view" (explicit v2.0 decision) implemented as 3 visually identical pages with only a label change, giving the dono no way to quickly compare sectors without manually switching pages 3 times | Dono loses the "real-time visibility into everything" core value if comparing sectors requires tedious manual page-switching with no shared context (e.g., losing the selected month filter when switching from fiscal to DP dashboard) | Even without a unified dashboard, keep filter state (selected competência/period) consistent and shareable via URL params across the 3 sector pages, so switching sectors doesn't reset the dono's current view context |

## "Looks Done But Isn't" Checklist (v2.0)

- [ ] **Junction table migration:** Often missing a verified row-count assertion proving all 197 companies got a FISCAL row backfilled correctly — verify with `SELECT count(*) FROM empresa_responsavel_setor WHERE setor = 'FISCAL'` equals 197, not just "migration ran without error."
- [ ] **Annual periodicity support:** Often missing a test that runs the monthly cron 12 simulated times across a year boundary and asserts exactly one ECF/DEFIS task is created per company, not zero (never wired up) or twelve (periodicity check missing).
- [ ] **Sector-aware RBAC:** Often missing regression tests proving the OLD fiscal-only IDOR guarantees (`tests/visibility-scope.test.ts`, `tests/tarefas.idor.test.ts`, `tests/empresas.idor.test.ts`) still pass unmodified — and NEW tests proving a DP colaborador can't see another DP colaborador's companies, even within the same sector.
- [ ] **Dashboard parametrization:** Often missing deletion of the orphaned `src/modules/dashboard/` (singular) duplicate module, and often missing a single shared query module parametrized by `setor` rather than 3 independently copy-pasted files.
- [ ] **Tarefa.responsavelId correctness for new sectors:** Often missing verification that DP/Contábil-generated tasks actually carry DP/Contábil colaborador IDs (not a fallback to the fiscal `empresa.responsavelId`) — easy to ship a generation engine that "creates tasks successfully" while silently misassigning all of them to the wrong person.
- [ ] **UI for per-sector responsável:** Often missing updates to `empresa-form.tsx`/`empresas-table.tsx` to expose 3 responsável fields — schema and engine can be "done" while the only UI to assign/view DP and Contábil responsáveis doesn't exist yet, blocking actual usability of the feature.

## Recovery Strategies (v2.0)

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Junction table backfill missed/incorrect for some companies | MEDIUM | Write a one-off reconciliation script comparing `Empresa.responsavelId` (old column, kept as safety net per Pitfall B1) against junction table FISCAL rows; report and fix mismatches before deleting the old column. Cost is medium because it requires careful manual review of any company where the script disagrees, but the old column being preserved (not dropped early) is what makes this recoverable at all. |
| Annual obligation duplicated or never generated due to competência format mismatch | LOW-MEDIUM | Since idempotency relies on the unique constraint, a "never generated" bug is recoverable by simply re-running generation for the correct competência once the format bug is fixed — no data corruption, just a missing row. A "duplicated" bug (different competência strings representing the same year) requires a manual cleanup query to merge/delete duplicate `Tarefa` rows before re-running with the corrected format. |
| RBAC widening bug ships to production (colaborador sees too much) | HIGH | This is a data exposure incident, not just a bug — requires immediate hotfix deploy of the corrected scope function, an audit of what was actually viewed/exported during the exposure window (if logs allow), and likely a direct conversation with the dono about what happened, given the core value proposition is built on trust in correct visibility. Strongly motivates the regression-test-first approach in Pitfall B3 rather than relying on post-hoc detection. |
| Dashboard query drift between sector-duplicated files (Pitfall B4 realized) | MEDIUM-HIGH | Requires diffing the 3 (or more) duplicated query files line-by-line to identify which business rules diverged, deciding which version is "correct," and consolidating into one parametrized module — effectively redoing the work that should have happened in the first design pass, while also auditing historical dashboard data for any periods where the wrong rule was live (e.g., wrong "atrasada" definition in one sector's ranking for months before the fix). |

## Pitfall-to-Phase Mapping (v2.0)

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| Junction table backfill incomplete/incorrect (B1) | Schema migration phase (Phase 1 of v2.0) | Row-count assertion (197 FISCAL rows) + spot-check query comparing old `responsavelId` column to new junction table before any dependent code is written |
| Annual periodicity breaks monthly idempotency or competência parsing (B2) | Generation-engine phase | Extended idempotency test suite (mirroring `tests/geracao.idempotencia.test.ts`) simulating a full year of monthly cron ticks + verifying exactly one annual task per company per year, no constraint violations |
| RBAC scoping widens/narrows COLABORADOR visibility incorrectly (B3) | RBAC/scoping phase (sequenced after schema migration, before/with dashboard phase) | Full existing IDOR/visibility suite passes unmodified AS A REGRESSION GATE, plus new multi-sector fixtures proving per-sector, per-person isolation |
| Dashboard logic duplicated per sector causing drift (B4) | Dashboard phase (last phase, but design decision made earlier) | Single shared query module exists, parametrized by `setor`; orphaned `src/modules/dashboard/` (singular) deleted; no new per-sector directory mirrors the existing `dashboards/queries.ts` function-by-function |

## Sources (v2.0)

- Direct inspection of this project's actual codebase (HIGH confidence — primary source, not inferred):
  - `prisma/schema.prisma` — current `Empresa.responsavelId`, `Tarefa` unique constraint, enums
  - `src/lib/visibility-scope.ts` — `withVisibilityScope`/`withTarefaScope` implementation
  - `src/lib/geracao-tarefas.ts`, `src/modules/tarefas/geracao.ts` — pure catalog function + transactional orchestration, competência parsing, idempotency-via-constraint design
  - `src/lib/scheduler.ts` — cron registration pattern, single-entry-point design (cron and manual trigger call the same function)
  - `src/modules/dashboards/queries.ts` (plural, live) vs `src/modules/dashboard/queries.ts` (singular, orphaned) — live evidence of dashboard module drift already present in this repo
  - `src/app/(app)/dashboards/guard.ts` — DONO-only gate pattern
  - `src/modules/empresas/queries.ts` — EMPRESA_SELECT pattern, IDOR-safe `findFirst`-with-scope pattern
  - `.planning/PROJECT.md` — v2.0 milestone scope, explicit "no unified dashboard" decision, 197-company scale, 7 placeholder colaboradores decision
- Domain reasoning from documented v1.0 design decisions embedded as code comments (D-01 through D-14 references throughout the codebase) — these comments explicitly call out prior pitfalls already avoided once (e.g., `setDate(date, 31)` rolling into next month, timezone off-by-one in date parsing, TOCTOU in idempotency) — treated as HIGH confidence since they are first-party documented decisions, not external speculation.

---
*Pitfalls research for: Sistema de gestão de tarefas e prazos fiscais (escritório de contabilidade brasileiro) — v1.0 fiscal + v2.0 multi-setor*
*Researched: 2026-06-11 (v1.0) / 2026-06-22 (v2.0 addendum)*
