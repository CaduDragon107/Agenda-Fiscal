# Pitfalls Research

**Domain:** Sistema web de gestão de tarefas e prazos fiscais recorrentes (escritório de contabilidade brasileiro)
**Researched:** 2026-06-11
**Confidence:** MEDIUM-HIGH (padrões de engenharia: HIGH, regras fiscais brasileiras: MEDIUM — datas mudam ano a ano e variam por convênio/estado, sempre validar contra calendário oficial vigente)

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

## "Looks Done But Isn't" Checklist

- [ ] **Geração de tarefas recorrentes:** Parece funcionar ao rodar uma vez — verificar se rodar o job **duas vezes seguidas** para o mesmo mês não duplica nada (constraint UNIQUE testada).
- [ ] **Cálculo de dia útil/feriado:** Parece funcionar para o mês atual — verificar se funciona corretamente para **Carnaval/Páscoa de pelo menos 2 anos diferentes** (datas móveis mudam todo ano) e para o **próximo ano** (ex.: dezembro/janeiro de virada de ano).
- [ ] **Regras por regime tributário:** Parece funcionar para Lucro Real e Simples Nacional — verificar se o schema permite adicionar um terceiro regime ou uma "obrigação extra para uma empresa específica" **sem alterar código**.
- [ ] **Importação da planilha:** Parece importar todas as linhas — verificar se **toda** empresa importada tem regime tributário definido e gera tarefas no primeiro mês (nenhuma empresa "invisível").
- [ ] **Permissões multiusuário:** Parece funcionar pela UI — verificar via chamada direta de API (ex.: Postman/curl) se um colaborador consegue acessar dado de empresa fora da sua carteira.
- [ ] **Dashboard de evolução mensal:** Parece mostrar gráficos corretos hoje — verificar se os números de **meses fechados** permanecem estáveis quando se olha novamente dias depois (não devem "flutuar" por causa de tarefas concluídas com atraso recalculando o passado).
- [ ] **Ajuste de prazo por feriado:** Parece ajustar corretamente para "fim de semana" — verificar se a regra de **antecipar vs adiar** está correta para cada tipo de obrigação (DAS adia, DARF/federais geralmente antecipam) e validada contra o calendário oficial do ano corrente.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Tarefas duplicadas já geradas em produção | LOW-MEDIUM | Script de limpeza: identificar duplicatas por `(empresa_id, tipo_obrigacao, competencia)`, manter a mais antiga (ou a concluída, se uma das cópias já foi marcada), deletar as demais; depois aplicar a constraint UNIQUE retroativamente |
| Feriados/prazos calculados errados para um mês já passado | MEDIUM | Recalcular `data_vencimento_ajustada` para tarefas daquele mês com a regra corrigida; reavaliar status "atrasado/no prazo" das tarefas já concluídas (cuidado: pode mudar métricas de dashboard retroativamente — comunicar à equipe) |
| Empresa importada sem regime tributário, descoberta meses depois | LOW | Definir o regime retroativamente no cadastro; rodar manualmente a geração de tarefas para as competências que ficaram sem tarefas (job de "backfill" idempotente, reaproveitando a mesma lógica do job mensal) |
| Falha de autorização descoberta após uso real (colaborador acessou dado de outro) | MEDIUM-HIGH | Corrigir a checagem de propriedade no backend; auditar logs de acesso (se existirem) para entender o que foi exposto; comunicar ao dono do escritório por questão de confidencialidade dos dados de clientes |
| Schema de regime tributário sem suporte a histórico, descoberto quando uma empresa muda de regime | MEDIUM-HIGH | Adicionar tabela de histórico de regime; migrar dado atual como "registro único desde sempre"; tarefas já geradas não são reescritas — só passam a usar o histórico a partir da mudança registrada |

## Pitfall-to-Phase Mapping

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

## Sources

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
*Pitfalls research for: Sistema de gestão de tarefas e prazos fiscais (escritório de contabilidade brasileiro)*
*Researched: 2026-06-11*
