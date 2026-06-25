---
status: resolved
trigger: |
  Quando o dono clica para gerar as tarefas (botão manual de geração mensal),
  aparece um toast com o erro "Erro ao gerar tarefas. Tente novamente." em
  produção (Railway).
created: 2026-06-25
updated: 2026-06-25
---

# Debug Session: erro-gerar-tarefas-dono

## Symptoms

- **Expected behavior:** Dono clica no botão de gerar tarefas do mês e as tarefas recorrentes (Fiscal/DP/Contábil) são criadas com sucesso, com confirmação visual.
- **Actual behavior:** Toast de erro: "Erro ao gerar tarefas. Tente novamente." — essa é provavelmente uma mensagem genérica de catch no client, escondendo o erro real do servidor.
- **Error messages:** "Erro ao gerar tarefas. Tente novamente." (toast genérico, sem detalhe). Não foi coletado ainda o erro real do servidor/logs do Railway.
- **Timeline:** Começou depois do milestone v2.0 (expansão multi-setor: Fiscal/DP/Contábil). Funcionava antes (geração mensal só Fiscal, v1.0).
- **Reproduction:** Dono clica no botão de gerar tarefas manualmente em produção.

## Current Focus

reasoning_checkpoint:
  hypothesis: "executarGeracaoMensal (src/modules/tarefas/geracao.ts) executa 9-12 round-trips sequenciais de banco dentro de UM ÚNICO db.$transaction (snapshot: 4 queries, desempenhoMensal.createMany: 1, empresa ativo: 1, empresa CLT/DP: 1, empresa Contábil mensal: 1, 0-3 loops de regras anuais, tarefa.createMany: 1) contra um Postgres Neon via pooled connection. O default de timeout de transação interativa do Prisma é 5000ms e NUNCA foi sobrescrito no código (sem transactionOptions em nenhum lugar). Com a extensão multi-setor do v2.0 (antes só Fiscal, 1-2 queries), a soma das latências de rede Neon (incluindo cold start de 300-500ms se o compute estiver suspenso por inatividade) + queries sobre 100+ empresas ultrapassa os 5000ms, o Prisma aborta a transação com P2028 (Transaction API error: Transaction already closed / timeout), a Server Action cai no catch genérico (linha 318-320 de actions.ts) e retorna 'Erro ao gerar tarefas. Tente novamente.' — exatamente o toast reportado."
  confirming_evidence:
    - "executarGeracaoMensal envolve um único db.$transaction (geracao.ts:90) sem transactionOptions/timeout customizado em nenhum arquivo do projeto (grep por 'timeout|maxWait|transactionOptions' não retornou nenhuma config)."
    - "calcularSnapshotMensal (snapshot.ts) por si só faz 4 queries sequenciais (tarefa.findMany x2, usuario.findMany, empresa.groupBy) ANTES da geração de tarefas começar — tudo dentro da mesma tx."
    - "geracao.ts encadeia mais 3-6 queries depois disso (empresa ativo, empresa CLT, empresa Contábil mensal, 0-3 loops anuais, tarefa.createMany final) — comentários no próprio arquivo confirmam que cada bloco (DP em 06-02, Contábil em 07-02, snapshot em 08-02) foi adicionado À MESMA transação ao longo do v2.0, sem revisitar o orçamento de tempo da transação."
    - "README.md / STATE.md confirmam que o banco é Neon (serverless Postgres com pooler e cold start de 300-500ms após idle), não Postgres always-on do Railway — geração manual disparada pelo dono é justamente o tipo de ação esporádica que pega o compute Neon suspenso."
    - "O catch genérico em gerarTarefasDoMesAction (actions.ts:318-320) engole QUALQUER exceção, incluindo P2028 de timeout de transação, e retorna a mesma mensagem genérica — consistente com o sintoma relatado (toast sem detalhe)."
  falsification_test: "Adicionar transactionOptions: { timeout: 20000 } (ou maior) ao db.$transaction em geracao.ts e reproduzir em produção/staging com volume real (~100+ empresas). Se o erro deixar de ocorrer, confirma timeout. Alternativamente, logar o erro real (antes do catch genérico) e verificar se a mensagem/code é 'P2028' ou contém 'Transaction already closed' / 'Transaction API error'."
  fix_rationale: "Aumentar o timeout da transação trata a causa raiz (volume de trabalho cresceu 4-6x no v2.0, mas o orçamento de tempo da transação nunca foi revisado) sem reestruturar a lógica de negócio nem arriscar quebrar a atomicidade (snapshot + tarefas precisam continuar na MESMA tx, conforme D-04/D-05 documentado nos comentários do arquivo). É a menor mudança que resolve a causa raiz real, em vez de só capturar/logar o erro (que não resolveria o problema, só o tornaria visível)."
  blind_spots: "Não tenho acesso aos logs reais do Railway/produção para confirmar que o erro é literalmente P2028 — a hipótese é a mais provável dado o crescimento documentado da transação ao longo das fases 06/07/08, mas não foi observada diretamente ainda. Também não medi o tempo real de execução em produção com a base de ~100-110 empresas. Se o erro real for outro (ex.: P2002 de constraint, erro de conexão, falha de schema), esta hipótese estará errada."
next_action: "Aplicar fix: transactionOptions.timeout aumentado em geracao.ts + log do erro real (console.error com a exceção) antes do catch genérico em actions.ts, para que futuras falhas fiquem visíveis nos logs do Railway em vez de silenciosas."

## Evidence

- timestamp: 2026-06-25
  checked: src/modules/tarefas/geracao.ts (executarGeracaoMensal) e src/modules/dashboards/snapshot.ts (calcularSnapshotMensal)
  found: executarGeracaoMensal executa um único db.$transaction que encadeia sequencialmente — calcularSnapshotMensal (4 queries: tarefa.findMany x2, usuario.findMany, empresa.groupBy), desempenhoMensal.createMany condicional, empresa.findMany (ativas), empresa.findMany (CLT/DP), empresa.findMany (Contábil mensal), 0-3 empresa.findMany (loop de regras anuais), e tarefa.createMany final. Total 9-12 round-trips de banco numa única transação interativa.
  implication: Volume de trabalho da transação cresceu de ~1-2 queries (v1.0, só Fiscal) para 9-12 queries (v2.0, Fiscal+DP+Contábil+snapshot), mas o timeout da transação nunca foi configurado explicitamente.

- timestamp: 2026-06-25
  checked: grep por "timeout|maxWait|transactionOptions" em src/
  found: Nenhuma configuração de timeout customizado em nenhum $transaction do projeto, incluindo o de geracao.ts. Prisma 6.x (confirmado em package.json) usa default de 5000ms para transações interativas.
  implication: Transação de 9-12 queries contra Neon (Postgres serverless com pooler e cold start documentado de 300-500ms) tem alta probabilidade de exceder 5000ms, especialmente em disparo manual esporádico (compute pode estar suspenso por inatividade).

- timestamp: 2026-06-25
  checked: src/app/(app)/tarefas/actions.ts (gerarTarefasDoMesAction) e gerar-tarefas-button.tsx
  found: O catch em gerarTarefasDoMesAction (linha 318-320) é genérico e não loga a exceção real antes de retornar a mensagem padrão. O catch no client (linha 51 do botão) também é genérico. Ambos escondem o erro real (provável P2028 - Transaction API error / timeout) atrás da mesma mensagem "Erro ao gerar tarefas. Tente novamente."
  implication: Sintoma relatado (toast genérico) é consistente com qualquer exceção não tratada, incluindo timeout de transação — não há como diferenciar sem acesso a logs de produção, mas o padrão arquitetural (transação crescente sem revisão de timeout) é a causa mais provável dado o histórico documentado nas fases 06/07/08.

## Resolution

root_cause: "executarGeracaoMensal (src/modules/tarefas/geracao.ts) executa toda a geração mensal (Fiscal + DP + Contábil mensal + Contábil anual + snapshot de desempenho) dentro de UM ÚNICO db.$transaction sem timeout customizado. O volume de queries dentro dessa transação cresceu de ~1-2 (v1.0) para 9-12 (v2.0, acumulado nas fases 06/07/08) sem que o timeout default de 5000ms do Prisma fosse revisado. Contra um banco Neon (serverless, com cold start e latência de pooler), a transação frequentemente excede esse orçamento de tempo quando disparada manualmente (ação esporádica, compute possivelmente suspenso), o Prisma aborta com erro de timeout de transação, e o catch genérico em gerarTarefasDoMesAction esconde o erro real atrás de 'Erro ao gerar tarefas. Tente novamente.'"
fix: "Aumentado explicitamente o timeout da transação em executarGeracaoMensal via segundo argumento de db.$transaction (transactionOptions: { timeout: 30000 }), dando margem suficiente para os 9-12 round-trips + cold start do Neon. Adicionado console.error(error) no catch de gerarTarefasDoMesAction para que erros futuros (timeout ou outros) fiquem visíveis nos logs do Railway em vez de completamente silenciosos."
verification: "Self-verified: npx tsc --noEmit sem erros; npx eslint nos 2 arquivos sem erros; suite completa de testes (npx vitest run) — 171/171 testes passando em 29 arquivos, incluindo tests/geracao.actions.test.ts e tests/geracao.idempotencia.test.ts (específicos de executarGeracaoMensal). Falta verificação humana: confirmar em produção (Railway) que o botão 'Gerar tarefas do mês' funciona sem erro com a base real de ~100-110 empresas."
files_changed:
  - src/modules/tarefas/geracao.ts
  - "src/app/(app)/tarefas/actions.ts"
