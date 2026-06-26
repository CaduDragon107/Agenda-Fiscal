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
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RegimeTributario } from "@prisma/client";
import { excluirEmpresa } from "../actions";

export type ResponsavelSetor = { id: string; nome: string } | null;

/**
 * v2.0 (Plano 05-04, D-10): os campos `responsavelFiscal*`/`responsavelDp*`/
 * `responsavelContabil*` são preenchidos por `deriveEmpresaRows`
 * (derive-rows.ts) — para um viewer não-DONO, os campos dos setores que NÃO
 * são o do próprio viewer já chegam aqui como `null` (fronteira de
 * segurança no data layer, não apenas na renderização desta tabela).
 */
export type EmpresaRow = {
  id: string;
  nome: string;
  cnpj: string;
  regimeTributario: RegimeTributario;
  responsavelId: string;
  temEmpregadaDomestica: boolean;
  responsavelFiscal: ResponsavelSetor;
  responsavelFiscalId: string | null;
  responsavelDp: ResponsavelSetor;
  responsavelDpId: string | null;
  responsavelContabil: ResponsavelSetor;
  responsavelContabilId: string | null;
};

type EmpresasTableProps = {
  empresas: EmpresaRow[];
  responsaveis: { id: string; nome: string }[];
  isDono: boolean;
  setor: "FISCAL" | "DP" | "CONTABIL" | null;
};

const REGIME_LABEL: Record<RegimeTributario, string> = {
  LUCRO_REAL: "Lucro Real",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  SIMPLES_NACIONAL: "Simples Nacional",
};

const REGIME_BADGE_CLASS: Record<RegimeTributario, string> = {
  LUCRO_REAL: "bg-blue-600 text-white",
  SIMPLES_NACIONAL: "bg-purple-600 text-white",
  LUCRO_PRESUMIDO: "bg-amber-500 text-white",
};

const REGIME_FILTER_OPTIONS: { value: "TODOS" | RegimeTributario; label: string }[] = [
  { value: "TODOS", label: "Todos" },
  { value: "LUCRO_REAL", label: "Lucro Real" },
  { value: "LUCRO_PRESUMIDO", label: "Lucro Presumido" },
  { value: "SIMPLES_NACIONAL", label: "Simples Nacional" },
];

/**
 * Para o setor DP, uma empresa sem responsável de DP atribuído significa que
 * ela não tem movimento de pessoal (sem CLT/sem folha) — não que falta
 * atribuir alguém. Por isso a célula de Responsável DP usa um rótulo neutro
 * em vez do badge âmbar de alerta usado por Fiscal/Contábil.
 */
function SemMovimentoDp() {
  return <span className="text-muted-foreground">Sem movimento</span>;
}

function formatarCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

export function EmpresasTable({ empresas, responsaveis, isDono, setor }: EmpresasTableProps) {
  const [busca, setBusca] = useState("");
  const [regimeFiltro, setRegimeFiltro] = useState<"TODOS" | RegimeTributario>("TODOS");
  const [responsavelFiltro, setResponsavelFiltro] = useState<string>("TODOS");
  const [semResponsavelFiltro, setSemResponsavelFiltro] = useState<"TODAS" | "DP" | "CONTABIL">(
    "TODAS"
  );
  const [empresaParaExcluir, setEmpresaParaExcluir] = useState<EmpresaRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const dadosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return empresas.filter((empresa) => {
      if (regimeFiltro !== "TODOS" && empresa.regimeTributario !== regimeFiltro) {
        return false;
      }
      if (responsavelFiltro !== "TODOS" && empresa.responsavelId !== responsavelFiltro) {
        return false;
      }
      if (semResponsavelFiltro === "DP" && empresa.responsavelDpId !== null) {
        return false;
      }
      if (semResponsavelFiltro === "CONTABIL" && empresa.responsavelContabilId !== null) {
        return false;
      }
      if (termo) {
        const nomeMatch = empresa.nome.toLowerCase().includes(termo);
        const cnpjMatch = empresa.cnpj.replace(/\D/g, "").includes(termo.replace(/\D/g, ""));
        if (!nomeMatch && !cnpjMatch) return false;
      }
      return true;
    });
  }, [empresas, busca, regimeFiltro, responsavelFiltro, semResponsavelFiltro]);

  const columns = useMemo<ColumnDef<EmpresaRow>[]>(
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
        accessorKey: "regimeTributario",
        header: "Regime",
        cell: ({ row }) => (
          <Badge className={REGIME_BADGE_CLASS[row.original.regimeTributario]}>
            {REGIME_LABEL[row.original.regimeTributario]}
          </Badge>
        ),
      },
      ...(isDono
        ? ([
            {
              id: "responsavelFiscal",
              header: "Responsável Fiscal",
              cell: ({ row }) =>
                row.original.responsavelFiscal?.nome ?? (
                  <Badge className="bg-amber-500 text-white">Sem responsável</Badge>
                ),
            },
            {
              id: "responsavelDp",
              header: "Responsável DP",
              cell: ({ row }) => row.original.responsavelDp?.nome ?? <SemMovimentoDp />,
            },
            {
              id: "responsavelContabil",
              header: "Responsável Contábil",
              cell: ({ row }) =>
                row.original.responsavelContabil?.nome ?? (
                  <Badge className="bg-amber-500 text-white">Sem responsável</Badge>
                ),
            },
          ] as ColumnDef<EmpresaRow>[])
        : ([
            {
              id: "responsavelProprioSetor",
              header: `Responsável ${setor === "DP" ? "DP" : setor === "CONTABIL" ? "Contábil" : "Fiscal"}`,
              cell: ({ row }) => {
                const nome =
                  setor === "DP"
                    ? row.original.responsavelDp?.nome
                    : setor === "CONTABIL"
                      ? row.original.responsavelContabil?.nome
                      : row.original.responsavelFiscal?.nome;
                if (nome) return nome;
                return setor === "DP" ? (
                  <SemMovimentoDp />
                ) : (
                  <Badge className="bg-amber-500 text-white">Sem responsável</Badge>
                );
              },
            },
          ] as ColumnDef<EmpresaRow>[])),
      ...(isDono || setor === "DP"
        ? ([
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
          ] as ColumnDef<EmpresaRow>[])
        : []),
      {
        id: "acoes",
        header: "Ações",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
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
            <Button
              variant="ghost"
              size="icon"
              className="size-11 text-destructive hover:text-destructive"
              aria-label={`Excluir ${row.original.nome}`}
              onClick={() => setEmpresaParaExcluir(row.original)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [isDono, setor]
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

  async function confirmarExclusao() {
    if (!empresaParaExcluir) return;
    setIsDeleting(true);

    const resultado = await excluirEmpresa(empresaParaExcluir.id);

    setIsDeleting(false);
    setEmpresaParaExcluir(null);

    if (!resultado.ok) {
      toast.error("Não foi possível salvar. Verifique os dados e tente novamente.");
      return;
    }

    toast.success("Empresa excluída com sucesso.");
  }

  if (empresas.length === 0) {
    // D-09: colaborador de DP/Contábil sem nenhuma empresa atribuída ainda
    // vê uma mensagem explicativa, não o estado vazio genérico (que é
    // voltado para DONO/Fiscal — sugere importar/cadastrar, ação que um
    // colaborador de DP/Contábil não deveria tomar para resolver "ainda não
    // tenho atribuição").
    if (!isDono && (setor === "DP" || setor === "CONTABIL")) {
      const setorLabel = setor === "DP" ? "DP" : "Contábil";
      return (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <h2 className="text-xl font-semibold">Nenhuma empresa atribuída a você ainda</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Você ainda não é responsável por nenhuma empresa no setor {setorLabel}. Fale
            com o dono do escritório para receber suas atribuições.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h2 className="text-xl font-semibold">Nenhuma empresa cadastrada</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Importe a planilha existente ou cadastre uma empresa manualmente para
          começar.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/empresas/importar">Importar planilha</Link>
          </Button>
          <Button asChild>
            <Link href="/empresas/novo">Nova empresa</Link>
          </Button>
        </div>
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
        <Select
          value={regimeFiltro}
          onValueChange={(value) => setRegimeFiltro(value as "TODOS" | RegimeTributario)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Regime" />
          </SelectTrigger>
          <SelectContent>
            {REGIME_FILTER_OPTIONS.map((opcao) => (
              <SelectItem key={opcao.value} value={opcao.value}>
                {opcao.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isDono ? (
          <Select value={responsavelFiltro} onValueChange={setResponsavelFiltro}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os responsáveis</SelectItem>
              {responsaveis.map((responsavel) => (
                <SelectItem key={responsavel.id} value={responsavel.id}>
                  {responsavel.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {isDono ? (
          <>
            <Button
              type="button"
              size="sm"
              variant={semResponsavelFiltro === "DP" ? "default" : "outline"}
              onClick={() =>
                setSemResponsavelFiltro((atual) => (atual === "DP" ? "TODAS" : "DP"))
              }
            >
              Sem responsável DP
            </Button>
            <Button
              type="button"
              size="sm"
              variant={semResponsavelFiltro === "CONTABIL" ? "default" : "outline"}
              onClick={() =>
                setSemResponsavelFiltro((atual) => (atual === "CONTABIL" ? "TODAS" : "CONTABIL"))
              }
            >
              Sem responsável Contábil
            </Button>
          </>
        ) : null}
      </div>

      {dadosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <h2 className="text-xl font-semibold">Nenhuma empresa encontrada</h2>
          <p className="text-sm text-muted-foreground">
            Tente ajustar os filtros ou o termo de busca.
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

      <AlertDialog
        open={empresaParaExcluir !== null}
        onOpenChange={(open) => {
          if (!open) setEmpresaParaExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as tarefas e o histórico
              associados a esta empresa também podem ser afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
