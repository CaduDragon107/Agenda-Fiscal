/**
 * src/lib/alert-prazo.ts
 *
 * Helper puro para calcular o estado de alerta de prazo de uma tarefa.
 * Implementa os limites definidos em D-06 e D-07 do CONTEXT.md:
 *   - Atrasada: prazo < agora E status PENDENTE → emoji 🔴
 *   - Prazo próximo: prazo <= agora+3d E status PENDENTE → emoji 🟡
 *   - Normal: prazo > agora+3d ou status CONCLUIDA → sem emoji
 *
 * Este helper é puro (sem I/O, sem dependências externas) e pode ser testado
 * diretamente com Vitest sem mocks.
 */

export type AlertaPrazo = {
  emoji: string;
  label: string;
  badgeClass: string;
  textClass: string;
};

const ALERTA_NORMAL: AlertaPrazo = {
  emoji: "",
  label: "",
  badgeClass: "variant-outline",
  textClass: "text-muted-foreground",
};

/**
 * Calcula o estado de alerta visual de uma tarefa com base no prazo e status.
 *
 * @param prazo - Data limite da tarefa (objeto Date)
 * @param status - Status atual da tarefa ("PENDENTE" | "CONCLUIDA")
 * @returns AlertaPrazo com emoji, label e classes CSS para badge e texto
 */
export function calcularAlertaPrazo(
  prazo: Date,
  status: "PENDENTE" | "CONCLUIDA"
): AlertaPrazo {
  // Tarefas concluídas não participam do sistema de alertas (per D-07)
  if (status === "CONCLUIDA") {
    return {
      ...ALERTA_NORMAL,
      textClass: "text-muted-foreground line-through",
    };
  }

  const agora = new Date();
  const em3Dias = new Date(agora.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Atrasada: prazo já passou (per D-06)
  if (prazo < agora) {
    return {
      emoji: "🔴",
      label: "Atrasada",
      badgeClass:
        "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
      textClass: "text-red-600 dark:text-red-400",
    };
  }

  // Prazo próximo: prazo <= agora + 3 dias (per D-06)
  if (prazo <= em3Dias) {
    return {
      emoji: "🟡",
      label: "Prazo próximo",
      badgeClass:
        "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
      textClass: "text-amber-600 dark:text-amber-400",
    };
  }

  // Normal: prazo > agora + 3 dias
  return ALERTA_NORMAL;
}
