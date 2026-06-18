/**
 * instrumentation.ts (raiz do projeto)
 *
 * Boot hook oficial do Next.js 15 App Router para processos longos
 * (`next start`, Railway). `register()` é executado uma vez por boot do
 * processo Node — aqui usado para registrar o cron mensal (D-07) via
 * `iniciarScheduler`. O guard `NEXT_RUNTIME === "nodejs"` evita carregar
 * `node-cron` (pacote Node-only) sob o runtime Edge.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarScheduler } = await import("@/lib/scheduler");
    iniciarScheduler();
  }
}
