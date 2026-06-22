"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * src/app/(app)/dashboards/evolucao-mensal-chart.tsx
 *
 * DASH-02: bar chart AGRUPADO de evolução mensal com 5 categorias da
 * população "criadas" (quick task 260622-lty) — total criadas, concluídas no
 * período, pendentes sem motivo, pendentes com motivo, e vencidas — por mês.
 * Substitui o antigo gráfico de área (% no prazo). Mistura competências
 * fechadas (snapshot) com 1 ponto live do mês corrente (Pattern 5 /
 * RESEARCH.md). Recebe dados via props serializáveis.
 */

type PontoEvolucao = {
  competencia: string;
  percentual: number;
  totalCriadas: number;
  totalConcluidasNoPeriodo: number;
  totalPendentesSemMotivo: number;
  totalPendentesComMotivo: number;
  totalVencidas: number;
};

const chartConfig = {
  totalCriadas: { label: "Criadas", color: "var(--chart-1)" },
  totalConcluidasNoPeriodo: { label: "Concluídas", color: "var(--chart-2)" },
  totalPendentesSemMotivo: {
    label: "Pendentes (sem motivo)",
    color: "var(--chart-3)",
  },
  totalPendentesComMotivo: {
    label: "Pendentes (com motivo)",
    color: "var(--chart-4)",
  },
  totalVencidas: { label: "Vencidas", color: "var(--chart-5)" },
} satisfies ChartConfig;

export function EvolucaoMensalChart({ dados }: { dados: PontoEvolucao[] }) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
      <BarChart accessibilityLayer data={dados}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="competencia" tickLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="totalCriadas"
          fill="var(--color-totalCriadas)"
          radius={4}
        />
        <Bar
          dataKey="totalConcluidasNoPeriodo"
          fill="var(--color-totalConcluidasNoPeriodo)"
          radius={4}
        />
        <Bar
          dataKey="totalPendentesSemMotivo"
          fill="var(--color-totalPendentesSemMotivo)"
          radius={4}
        />
        <Bar
          dataKey="totalPendentesComMotivo"
          fill="var(--color-totalPendentesComMotivo)"
          radius={4}
        />
        <Bar
          dataKey="totalVencidas"
          fill="var(--color-totalVencidas)"
          radius={4}
        />
      </BarChart>
    </ChartContainer>
  );
}
