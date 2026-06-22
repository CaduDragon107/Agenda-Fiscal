"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * src/app/(app)/dashboards/ranking-empresas-table.tsx
 *
 * DASH-03: bar chart horizontal das top-10 empresas com maior % de atraso,
 * mais a tabela TanStack completa (todas as empresas, ordenada desc) — sem
 * paginação manual em ~100-110 linhas (Pattern 7 / RESEARCH.md). Read-only:
 * sem checkbox/excluir/editar, nenhuma mutação sobre Tarefa/Empresa nesta
 * fase. Recebe dados via props serializáveis, nunca busca por conta própria.
 *
 * Limiar de alto % de atraso para o Badge variant="destructive" (defesa em
 * profundidade visual, token padrão shadcn — não as classes bespoke de
 * calcularAlertaPrazo, que são específicas de comparação de data).
 */
const LIMIAR_ALTO_ATRASO = 30;

type RankingEmpresa = {
  empresaId: string;
  nome: string;
  percentualAtraso: number;
  totalTarefas: number;
};

const chartConfig = {
  percentualAtraso: { label: "% de atraso", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function RankingEmpresasTable({ dados }: { dados: RankingEmpresa[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "percentualAtraso", desc: true },
  ]);

  const top10 = useMemo(
    () => dados.slice(0, 10),
    [dados]
  );

  const columns = useMemo<ColumnDef<RankingEmpresa>[]>(
    () => [
      {
        id: "nome",
        accessorFn: (row) => row.nome,
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Empresa
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="size-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="size-3" />
            ) : null}
          </button>
        ),
        cell: ({ row }) => row.original.nome,
      },
      {
        id: "percentualAtraso",
        accessorFn: (row) => row.percentualAtraso,
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            % de atraso
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="size-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="size-3" />
            ) : null}
          </button>
        ),
        cell: ({ row }) =>
          row.original.percentualAtraso >= LIMIAR_ALTO_ATRASO ? (
            <Badge variant="destructive">
              {row.original.percentualAtraso}%
            </Badge>
          ) : (
            <span>{row.original.percentualAtraso}%</span>
          ),
      },
      {
        id: "totalTarefas",
        accessorFn: (row) => row.totalTarefas,
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Total de tarefas
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="size-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="size-3" />
            ) : null}
          </button>
        ),
        cell: ({ row }) => row.original.totalTarefas,
      },
    ],
    []
  );

  const table = useReactTable({
    data: dados,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <ChartContainer config={chartConfig} className="min-h-[260px] w-full">
        <BarChart accessibilityLayer data={top10} layout="vertical">
          <CartesianGrid horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="nome" width={120} tickLine={false} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => [`${value}% de atraso`, ""]}
              />
            }
          />
          <Bar
            dataKey="percentualAtraso"
            fill="var(--color-percentualAtraso)"
            radius={4}
          />
        </BarChart>
      </ChartContainer>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
