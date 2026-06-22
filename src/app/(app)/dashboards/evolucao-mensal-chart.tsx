"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * src/app/(app)/dashboards/evolucao-mensal-chart.tsx
 *
 * DASH-02: area chart de evolução mensal do % no prazo (agregado da equipe),
 * misturando competências fechadas (snapshot) com 1 ponto live do mês
 * corrente (Pattern 5 / RESEARCH.md). Recebe dados via props serializáveis.
 */

type PontoEvolucao = {
  competencia: string;
  percentual: number;
};

const chartConfig = {
  percentual: { label: "% no prazo", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function EvolucaoMensalChart({ dados }: { dados: PontoEvolucao[] }) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
      <AreaChart accessibilityLayer data={dados}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="competencia" tickLine={false} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [`${value}% no prazo`, ""]}
            />
          }
        />
        <Area
          dataKey="percentual"
          type="monotone"
          fill="var(--color-percentual)"
          stroke="var(--color-percentual)"
          fillOpacity={0.3}
        />
      </AreaChart>
    </ChartContainer>
  );
}
