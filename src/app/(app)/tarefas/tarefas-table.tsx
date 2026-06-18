"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { calcularAlertaPrazo } from "@/lib/alert-prazo";
import { concluirTarefa, excluirTarefa } from "./actions";

export type TarefaRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: Date;
  status: "PENDENTE" | "CONCLUIDA";
  createdAt: Date;
  empresaId: string;
  responsavelId: string;
  empresa: {
    id: string;
    nome: string;
    cnpj: string;
    regimeTributario: string;
    particularidades: string | null;
    responsavel: { id: string; nome: string } | null;
  };
  responsavel: { id: string; nome: string };
  historico: {
    id: string;
    concluidoEm: Date;
    concluidoPor: { id: string; nome: string };
  }[];
};

type TarefasTableProps = {
  tarefas: TarefaRow[];
  responsaveis: { id: string; nome: string }[];
  isDono: boolean;
  userId?: string;
};

function PrazoCell({ tarefa }: { tarefa: TarefaRow }) {
  const alerta = calcularAlertaPrazo(tarefa.prazo, tarefa.status);
  const dataFormatada = format(tarefa.prazo, "dd/MM/yyyy", { locale: ptBR });

  return (
    <span className={`flex items-center gap-1.5 ${alerta.textClass}`}>
      {alerta.emoji && <span aria-hidden="true">{alerta.emoji}</span>}
      {alerta.label && (
        <Badge className={alerta.badgeClass}>{alerta.label}</Badge>
      )}
      <span>{dataFormatada}</span>
    </span>
  );
}

export function TarefasTable({ tarefas, responsaveis, isDono, userId }: TarefasTableProps) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<"PENDENTE" | "CONCLUIDA" | "TODOS">("PENDENTE");
  const [responsavelFiltro, setResponsavelFiltro] = useState("TODOS");
  const [sorting, setSorting] = useState<SortingState>([{ id: "prazo", desc: false }]);
  const [pageIndex, setPageIndex] = useState(0);
  const [tarefaParaExcluir, setTarefaParaExcluir] = useState<TarefaRow | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  // Suprimir warning de isPending não utilizado diretamente
  void isPending;

  const dadosFiltrados = useMemo(() => {
    let dados = tarefas;

    // Filtrar por status (per D-08, Pitfall 6: carregar todas do servidor e filtrar client-side)
    if (statusFiltro !== "TODOS") {
      dados = dados.filter((t) => t.status === statusFiltro);
    }

    // Filtrar por responsável (somente DONO vê este filtro)
    if (isDono && responsavelFiltro !== "TODOS") {
      dados = dados.filter((t) => t.responsavelId === responsavelFiltro);
    }

    // Filtrar por busca — título ou nome da empresa
    const termo = busca.trim().toLowerCase();
    if (termo) {
      dados = dados.filter(
        (t) =>
          t.titulo.toLowerCase().includes(termo) ||
          t.empresa.nome.toLowerCase().includes(termo)
      );
    }

    return dados;
  }, [tarefas, statusFiltro, responsavelFiltro, isDono, busca]);

  function handleConcluir(id: string) {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      const result = await concluirTarefa(id);
      setPendingIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      if (!result.ok) {
        toast.error("Nao foi possivel registrar a conclusao. Tente novamente.");
      } else {
        toast.success("Tarefa marcada como concluida.");
        router.refresh();
      }
    });
  }

  async function confirmarExclusao() {
    if (!tarefaParaExcluir) return;
    setIsDeleting(true);
    const result = await excluirTarefa(tarefaParaExcluir.id);
    setIsDeleting(false);
    setTarefaParaExcluir(null);
    if (!result.ok) {
      toast.error("Nao foi possivel excluir a tarefa. Tente novamente.");
    } else {
      toast.success("Tarefa excluida com sucesso.");
      router.refresh();
    }
  }

  const columns = useMemo<ColumnDef<TarefaRow>[]>(
    () => [
      {
        id: "concluir",
        enableSorting: false,
        header: () => <span className="sr-only">Concluir</span>,
        cell: ({ row }) => (
          <Checkbox
            checked={row.original.status === "CONCLUIDA"}
            disabled={
              row.original.status === "CONCLUIDA" ||
              pendingIds.has(row.original.id)
            }
            aria-label={`Marcar tarefa '${row.original.titulo}' como concluida`}
            onCheckedChange={() => handleConcluir(row.original.id)}
          />
        ),
      },
      {
        id: "tarefa",
        enableSorting: true,
        accessorFn: (row) => row.titulo,
        header: "Tarefa",
        cell: ({ row }) => (
          <div className={row.original.status === "CONCLUIDA" ? "opacity-60" : ""}>
            <Link
              href={`/tarefas/${row.original.id}`}
              className="font-medium hover:underline"
            >
              {row.original.titulo}
            </Link>
            <p className="text-xs text-muted-foreground">{row.original.empresa.nome}</p>
          </div>
        ),
      },
      {
        accessorKey: "prazo",
        enableSorting: true,
        sortingFn: "datetime",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Prazo
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="size-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="size-3" />
            ) : null}
          </button>
        ),
        cell: ({ row }) => <PrazoCell tarefa={row.original} />,
      },
      {
        id: "responsavel",
        enableSorting: true,
        accessorFn: (row) => row.responsavel.nome,
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 text-sm font-medium w-36"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Responsavel
            {column.getIsSorted() === "asc" ? (
              <ChevronUp className="size-3" />
            ) : column.getIsSorted() === "desc" ? (
              <ChevronDown className="size-3" />
            ) : null}
          </button>
        ),
        cell: ({ row }) => (
          <span className="w-36 block">{row.original.responsavel.nome}</span>
        ),
      },
      {
        id: "acoes",
        enableSorting: false,
        header: () => <span className="sr-only">Acoes</span>,
        cell: ({ row }) => {
          // Defense in depth (T-02-IDOR-UI): UI oculta botão para COLABORADOR em tarefas alheias.
          // A barreira real é o anti-IDOR server-side em excluirTarefa.
          const podeExcluir =
            isDono || (userId != null && row.original.responsavelId === userId);
          return (
            <div className="flex items-center gap-1">
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label={`Ver detalhes de ${row.original.titulo}`}
              >
                <Link href={`/tarefas/${row.original.id}`}>
                  <Eye className="size-4" />
                </Link>
              </Button>
              {podeExcluir && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-destructive hover:text-destructive"
                  aria-label={`Excluir ${row.original.titulo}`}
                  onClick={() => setTarefaParaExcluir(row.original)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [isDono, pendingIds, userId]
  );

  const table = useReactTable({
    data: dadosFiltrados,
    columns,
    state: {
      sorting,
      pagination: { pageIndex, pageSize: 20 },
    },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      if (typeof updater === "function") {
        const next = updater({ pageIndex, pageSize: 20 });
        setPageIndex(next.pageIndex);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
  });

  if (tarefas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h2 className="text-xl font-semibold">Nenhuma tarefa encontrada</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Crie uma tarefa avulsa para comecar a acompanhar os prazos da equipe.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por titulo ou empresa"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-xs"
        />
        {isDono && (
          <Select value={responsavelFiltro} onValueChange={setResponsavelFiltro}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Responsavel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os responsaveis</SelectItem>
              {responsaveis.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={statusFiltro}
          onValueChange={(v) => setStatusFiltro(v as typeof statusFiltro)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDENTE">Pendentes</SelectItem>
            <SelectItem value="CONCLUIDA">Concluidas</SelectItem>
            <SelectItem value="TODOS">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Estado vazio após filtros */}
      {dadosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <h2 className="text-xl font-semibold">Nenhuma tarefa encontrada</h2>
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

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Pagina {table.getState().pagination.pageIndex + 1} de{" "}
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
                Proxima
              </Button>
            </div>
          </div>
        </>
      )}

      {/* AlertDialog de exclusão */}
      <AlertDialog
        open={tarefaParaExcluir !== null}
        onOpenChange={(open) => {
          if (!open) setTarefaParaExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acao nao pode ser desfeita. O historico de conclusoes associado tambem sera removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir tarefa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
