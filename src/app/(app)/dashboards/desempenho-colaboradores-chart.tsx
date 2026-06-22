"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * src/app/(app)/dashboards/desempenho-colaboradores-chart.tsx
 *
 * DASH-01: bar chart de % no prazo por colaborador. Recebe dados via props
 * serializáveis vindos de page.tsx (Server Component) — nunca busca dados
 * por conta própria (Pattern 4 / RESEARCH.md).
 */

type DesempenhoColaborador = {
  colaboradorId: string;
  nome: string;
  percentualNoPrazo: number;
  totalConcluidas: number;
  totalEmpresas: number;
};

const chartConfig = {
  percentualNoPrazo: { label: "% no prazo", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function DesempenhoColaboradoresChart({
  dados,
}: {
  dados: DesempenhoColaborador[];
}) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
      <BarChart accessibilityLayer data={dados}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="nome" tickLine={false} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => [
                `${value}% no prazo (${item.payload.totalConcluidas} tarefas, ${item.payload.totalEmpresas} empresas)`,
                "",
              ]}
            />
          }
        />
        <Bar
          dataKey="percentualNoPrazo"
          fill="var(--color-percentualNoPrazo)"
          radius={4}
        />
      </BarChart>
    </ChartContainer>
  );
}
