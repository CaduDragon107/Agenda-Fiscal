"use client";

import { useCallback, useMemo, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { validarCNPJ } from "@/lib/cnpj";
import type { EmpresaInput } from "@/modules/empresas/schema";
import {
  STATUS_BADGE_CLASS,
  STATUS_LABEL,
  type LinhaStaged,
  type StatusLinha,
} from "./types";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData> {
    updateData: (rowId: string, columnId: string, value: unknown) => void;
  }
}

const REGIME_OPTIONS: { value: EmpresaInput["regimeTributario"]; label: string }[] = [
  { value: "LUCRO_REAL", label: "Lucro Real" },
  { value: "LUCRO_PRESUMIDO", label: "Lucro Presumido" },
  { value: "SIMPLES_NACIONAL", label: "Simples Nacional" },
];

type ResponsavelOption = { id: string; nome: string };

type FiltroStatus = StatusLinha | "TODAS";

type StepReviewProps = {
  linhas: LinhaStaged[];
  responsaveis: ResponsavelOption[];
  onChange: (linhas: LinhaStaged[]) => void;
  onAvancar: () => void;
  onVoltar: () => void;
};

/**
 * Calcula o status de uma linha staged (Pronta / CNPJ inválido / Sem regime /
 * Duplicada). Prioridade: CNPJ inválido > Sem regime > Duplicada > Pronta —
 * uma linha pode acumular múltiplos problemas, mas o badge mostra o mais
 * crítico para revisão.
 */
function calcularStatus(linha: LinhaStaged, cnpjsDuplicados: Set<string>): StatusLinha {
  if (!validarCNPJ(linha.cnpj)) return "CNPJ_INVALIDO";
  if (!linha.regimeTributario) return "SEM_REGIME";
  if (cnpjsDuplicados.has(linha.cnpj.replace(/\D/g, ""))) return "DUPLICADA";
  return "PRONTA";
}

/**
 * Step 2 do wizard: revisão editável das linhas staged (TanStack Table,
 * célula editável via meta.updateData — Pattern 5).
 *
 * "Confirmar importação" (navegação para Step 3) fica bloqueado enquanto
 * qualquer linha incluída estiver "Sem regime" ou sem responsável atribuído
 * (revisão humana obrigatória, T-01-IMPORT-INPUT).
 */
export function StepReview({ linhas, responsaveis, onChange, onAvancar, onVoltar }: StepReviewProps) {
  const [filtro, setFiltro] = useState<FiltroStatus>("TODAS");

  const cnpjsDuplicados = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const linha of linhas) {
      const digits = linha.cnpj.replace(/\D/g, "");
      contagem.set(digits, (contagem.get(digits) ?? 0) + 1);
    }
    const duplicados = new Set<string>();
    for (const [cnpj, count] of contagem) {
      if (count > 1) duplicados.add(cnpj);
    }
    return duplicados;
  }, [linhas]);

  const statusPorLinha = useMemo(() => {
    const mapa = new Map<string, StatusLinha>();
    for (const linha of linhas) {
      mapa.set(linha.id, calcularStatus(linha, cnpjsDuplicados));
    }
    return mapa;
  }, [linhas, cnpjsDuplicados]);

  const contagens = useMemo(() => {
    const resultado: Record<StatusLinha, number> = {
      PRONTA: 0,
      CNPJ_INVALIDO: 0,
      SEM_REGIME: 0,
      DUPLICADA: 0,
    };
    for (const linha of linhas) {
      resultado[statusPorLinha.get(linha.id) ?? "PRONTA"] += 1;
    }
    return resultado;
  }, [linhas, statusPorLinha]);

  const linhasFiltradas = useMemo(() => {
    if (filtro === "TODAS") return linhas;
    return linhas.filter((linha) => statusPorLinha.get(linha.id) === filtro);
  }, [linhas, filtro, statusPorLinha]);

  const updateData = useCallback(
    (rowId: string, columnId: string, value: unknown) => {
      onChange(
        linhas.map((linha) =>
          linha.id === rowId ? { ...linha, [columnId]: value } : linha
        )
      );
    },
    [linhas, onChange]
  );

  // Bloqueio do "Confirmar importação": qualquer linha INCLUÍDA sem regime
  // ou sem responsável bloqueia o avanço (revisão humana obrigatória).
  const linhasIncluidas = linhas.filter((l) => l.incluida);
  const possuiSemRegimeIncluida = linhasIncluidas.some((l) => !l.regimeTributario);
  const possuiSemResponsavelIncluida = linhasIncluidas.some((l) => !l.responsavelId);
  const bloqueado = possuiSemRegimeIncluida || possuiSemResponsavelIncluida;

  const columns = useMemo<ColumnDef<LinhaStaged>[]>(
    () => [
      {
        id: "incluida",
        header: "Incluir",
        cell: ({ row }) => (
          <Checkbox
            checked={row.original.incluida}
            onCheckedChange={(checked) =>
              updateData(row.original.id, "incluida", checked === true)
            }
            aria-label={`Incluir ${row.original.nome}`}
          />
        ),
      },
      {
        accessorKey: "nome",
        header: "Nome",
        cell: ({ row }) => (
          <Input
            defaultValue={row.original.nome}
            onBlur={(e) => updateData(row.original.id, "nome", e.target.value)}
            className="min-w-[180px]"
          />
        ),
      },
      {
        accessorKey: "cnpj",
        header: "CNPJ",
        cell: ({ row }) => {
          const valido = validarCNPJ(row.original.cnpj);
          return (
            <div className="flex flex-col gap-1">
              <Input
                defaultValue={row.original.cnpj}
                onBlur={(e) => updateData(row.original.id, "cnpj", e.target.value)}
                className="min-w-[160px]"
              />
              {!valido ? (
                <Badge className={STATUS_BADGE_CLASS.CNPJ_INVALIDO}>CNPJ inválido</Badge>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "regimeTributario",
        header: "Regime",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <Select
              value={row.original.regimeTributario ?? "SEM_REGIME"}
              onValueChange={(value) =>
                updateData(
                  row.original.id,
                  "regimeTributario",
                  value === "SEM_REGIME" ? undefined : value
                )
              }
            >
              <SelectTrigger className="min-w-[170px]">
                <SelectValue placeholder="Selecione o regime" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SEM_REGIME">
                  <Badge className={STATUS_BADGE_CLASS.SEM_REGIME}>Sem regime</Badge>
                </SelectItem>
                {REGIME_OPTIONS.map((opcao) => (
                  <SelectItem key={opcao.value} value={opcao.value as string}>
                    {opcao.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!row.original.regimeTributario ? (
              <p className="text-xs text-amber-600">
                Obrigatório — selecione o regime tributário desta empresa para continuar
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: "responsavelId",
        header: "Responsável",
        cell: ({ row }) => (
          <Select
            value={row.original.responsavelId ?? ""}
            onValueChange={(value) => updateData(row.original.id, "responsavelId", value)}
          >
            <SelectTrigger className="min-w-[180px]">
              <SelectValue placeholder="Selecione o responsável" />
            </SelectTrigger>
            <SelectContent>
              {responsaveis.map((responsavel) => (
                <SelectItem key={responsavel.id} value={responsavel.id}>
                  {responsavel.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        accessorKey: "contatos",
        header: "Contatos",
        cell: ({ row }) => (
          <Input
            defaultValue={row.original.contatos ?? ""}
            onBlur={(e) => updateData(row.original.id, "contatos", e.target.value)}
            className="min-w-[160px]"
          />
        ),
      },
      {
        accessorKey: "particularidades",
        header: "Particularidades",
        cell: ({ row }) => (
          <Input
            defaultValue={row.original.particularidades ?? ""}
            onBlur={(e) => updateData(row.original.id, "particularidades", e.target.value)}
            className="min-w-[160px]"
          />
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = statusPorLinha.get(row.original.id) ?? "PRONTA";
          return <Badge className={STATUS_BADGE_CLASS[status]}>{STATUS_LABEL[status]}</Badge>;
        },
      },
    ],
    [responsaveis, statusPorLinha, updateData]
  );

  const table = useReactTable({
    data: linhasFiltradas,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    meta: { updateData },
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-sm">
              <strong>{contagens.PRONTA}</strong> prontas,{" "}
              <strong>{contagens.CNPJ_INVALIDO}</strong> CNPJ inválido,{" "}
              <strong>{contagens.SEM_REGIME}</strong> sem regime,{" "}
              <strong>{contagens.DUPLICADA}</strong> duplicadas
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={filtro === "TODAS" ? "default" : "outline"}
              onClick={() => setFiltro("TODAS")}
            >
              Todas ({linhas.length})
            </Button>
            {(Object.keys(STATUS_LABEL) as StatusLinha[]).map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={filtro === status ? "default" : "outline"}
                onClick={() => setFiltro(status)}
              >
                {STATUS_LABEL[status]} ({contagens[status]})
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                  Nenhuma linha corresponde a este filtro.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2">
        {bloqueado ? (
          <p className="text-sm text-amber-600">
            Obrigatório — selecione o regime tributário desta empresa para continuar
          </p>
        ) : null}
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={onVoltar}>
            Voltar
          </Button>
          <Button onClick={onAvancar} disabled={bloqueado}>
            Confirmar importação
          </Button>
        </div>
      </div>
    </div>
  );
}
