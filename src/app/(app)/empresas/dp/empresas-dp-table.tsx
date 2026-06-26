"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type EmpresaDpRow = {
  id: string;
  nome: string;
  cnpj: string;
  responsavelDp: { id: string; nome: string } | null;
  temEmpregadaDomestica: boolean;
};

type EmpresasDpTableProps = {
  empresas: EmpresaDpRow[];
};

function formatarCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Tabela DP (quick task 260626-a8d).
 *
 * Coluna "Responsável DP" renderiza string vazia ("") quando não há
 * responsável atribuído — NUNCA placeholder "N/A"/badge "Sem responsável".
 * Linhas sem responsável DP nunca são omitidas (a fonte já vem completa de
 * listarEmpresas, sem filtro client-side).
 */
export function EmpresasDpTable({ empresas }: EmpresasDpTableProps) {
  const [busca, setBusca] = useState("");

  const dadosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return empresas;
    return empresas.filter((empresa) => {
      const nomeMatch = empresa.nome.toLowerCase().includes(termo);
      const cnpjMatch = empresa.cnpj.replace(/\D/g, "").includes(termo.replace(/\D/g, ""));
      return nomeMatch || cnpjMatch;
    });
  }, [empresas, busca]);

  const columns = useMemo<ColumnDef<EmpresaDpRow>[]>(
    () => [
      {
        accessorKey: "nome",
        header: "Nome",
      },
      {
        accessorKey: "cnpj",
        header: "CNPJ",
        cell: ({ row }) => formatarCnpj(row.original.cnpj),
      },
      {
        id: "responsavelDp",
        header: "Responsável DP",
        cell: ({ row }) => row.original.responsavelDp?.nome ?? "",
      },
      {
        id: "temEmpregadaDomestica",
        header: "Empregada doméstica",
        cell: ({ row }) =>
          row.original.temEmpregadaDomestica ? (
            <Badge className="bg-blue-600 text-white">Sim</Badge>
          ) : (
            ""
          ),
      },
      {
        id: "acoes",
        header: "Ações",
        cell: ({ row }) => (
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={`Editar ${row.original.nome}`}
          >
            <Link href={`/empresas/${row.original.id}/editar`}>
              <Pencil className="size-4" />
            </Link>
          </Button>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: dadosFiltrados,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  if (empresas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <h2 className="text-xl font-semibold">Nenhuma empresa encontrada</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nome ou CNPJ"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {dadosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <h2 className="text-xl font-semibold">Nenhuma empresa encontrada</h2>
          <p className="text-sm text-muted-foreground">
            Tente ajustar o termo de busca.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
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

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Página {table.getState().pagination.pageIndex + 1} de{" "}
              {Math.max(table.getPageCount(), 1)}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
