/**
 * src/lib/scheduler.ts
 *
 * Registro do job mensal node-cron (D-07: dia 1 do mês às 06:00, fuso do
 * servidor). Guard via `globalThis.__agendaFiscalCronStarted` evita
 * dupla-registração em hot-reload (dev) ou reinício de processo — segunda
 * camada de defesa além do índice único do banco (Pitfall 3 do
 * 03-RESEARCH.md, T-3-04 do threat model).
 *
 * A geração mensal só "no plano" via `executarGeracaoMensal`: o callback do
 * cron e o gatilho manual (Plano 03) chamam exatamente a mesma função, sem
 * pré-checagem de aplicação (a idempotência mora na constraint do banco).
 */

import cron from "node-cron";
import { executarGeracaoMensal } from "@/modules/tarefas/geracao";
import { competenciaAtual } from "@/lib/competencia";

declare global {
  // eslint-disable-next-line no-var
  var __agendaFiscalCronStarted: boolean | undefined;
}

export function iniciarScheduler() {
  if (globalThis.__agendaFiscalCronStarted) {
    return; // já registrado neste processo — evita jobs duplicados
  }
  globalThis.__agendaFiscalCronStarted = true;

  // D-07: todo dia 1 do mês às 06:00, fuso do servidor
  cron.schedule("0 6 1 * *", async () => {
    try {
      const competencia = competenciaAtual();
      const resultado = await executarGeracaoMensal(competencia);
      console.log(
        `[cron] Geração ${competencia}: ${resultado.criadas} criadas, ${resultado.puladas} puladas`
      );
    } catch (erro) {
      // T-3-03: sem alerta externo (NOTF-01 deferred); o botão manual
      // (D-08) é o fallback documentado se o cron falhar silenciosamente.
      console.error("[cron] Falha na geração mensal de tarefas:", erro);
    }
  });
}
