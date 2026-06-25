/**
 * src/app/(app)/dashboards/empty-state.tsx
 *
 * Extraído da função inline `EmptyState()` que existia em page.tsx (Phase 4)
 * e parametrizado por setor (D-04, Phase 8 Plan 03) — os textos de DP e
 * Contábil mencionam o setor explicitamente, divergindo do texto Fiscal
 * (08-UI-SPEC.md Copywriting Contract).
 */
const COPY: Record<"FISCAL" | "DP" | "CONTABIL", { heading: string; body: string }> = {
  FISCAL: {
    heading: "Ainda não há dados suficientes",
    body: "Os dashboards são alimentados pelas tarefas concluídas a cada mês. Volte após o fechamento do primeiro mês de operação.",
  },
  DP: {
    heading: "Ainda não há dados suficientes de DP",
    body: "Os dashboards de DP são alimentados pelas tarefas de DP concluídas a cada mês. Volte após o fechamento do primeiro mês de operação.",
  },
  CONTABIL: {
    heading: "Ainda não há dados suficientes de Contábil",
    body: "Os dashboards de Contábil são alimentados pelas tarefas de Contábil concluídas a cada mês. Volte após o fechamento do primeiro mês de operação.",
  },
};

export function EmptyState({ setor }: { setor: "FISCAL" | "DP" | "CONTABIL" }) {
  const { heading, body } = COPY[setor];
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h2 className="text-xl font-semibold">{heading}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
