"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { editarNomeUsuarioAction } from "./actions";

export type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  role: "COLABORADOR" | "DONO";
  setor: "FISCAL" | "DP" | "CONTABIL" | null;
};

type UsuariosTableProps = {
  usuarios: UsuarioRow[];
};

const ROLE_LABEL: Record<UsuarioRow["role"], string> = {
  DONO: "Dono",
  COLABORADOR: "Colaborador",
};

const SETOR_LABEL: Record<NonNullable<UsuarioRow["setor"]>, string> = {
  FISCAL: "Fiscal",
  DP: "DP",
  CONTABIL: "Contábil",
};

/**
 * Schema mínimo do form de edição — deriva apenas o campo `nome`, mesma
 * regra de tests/usuarios.actions.test.ts e de actions.ts (escopo: só nome).
 */
const editarNomeFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
});

type EditarNomeFormValues = z.infer<typeof editarNomeFormSchema>;

/**
 * Tabela de usuários (quick task 260626-d1a) — DONO-only.
 *
 * Lista simples (sem TanStack Table/paginação/filtro — ~12 usuários, não
 * justifica a complexidade usada em empresas-table.tsx). Cada linha tem um
 * botão "Editar nome" que abre um Dialog com form (React Hook Form + Zod)
 * chamando editarNomeUsuarioAction. NÃO há campos de email/role/setor no
 * form (fora de escopo — T-d1a-02 garante isso também no servidor).
 */
export function UsuariosTable({ usuarios }: UsuariosTableProps) {
  const router = useRouter();
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<UsuarioRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditarNomeFormValues>({
    resolver: zodResolver(editarNomeFormSchema),
    defaultValues: { nome: "" },
  });

  function abrirEdicao(usuario: UsuarioRow) {
    setUsuarioEmEdicao(usuario);
    form.reset({ nome: usuario.nome });
  }

  function fecharDialog() {
    setUsuarioEmEdicao(null);
    form.reset({ nome: "" });
  }

  async function onSubmit(values: EditarNomeFormValues) {
    if (!usuarioEmEdicao) return;

    setIsSubmitting(true);
    const resultado = await editarNomeUsuarioAction(usuarioEmEdicao.id, values.nome);
    setIsSubmitting(false);

    if (!resultado.ok) {
      toast.error("Não foi possível salvar. Tente novamente.");
      return;
    }

    toast.success("Nome atualizado.");
    fecharDialog();
    router.refresh();
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Setor</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((usuario) => (
            <TableRow key={usuario.id}>
              <TableCell>{usuario.nome}</TableCell>
              <TableCell>{usuario.email}</TableCell>
              <TableCell>
                <Badge variant={usuario.role === "DONO" ? "default" : "secondary"}>
                  {ROLE_LABEL[usuario.role]}
                </Badge>
              </TableCell>
              <TableCell>{usuario.setor ? SETOR_LABEL[usuario.setor] : "—"}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Editar nome de ${usuario.nome}`}
                  onClick={() => abrirEdicao(usuario)}
                >
                  <Pencil className="size-4" />
                  Editar nome
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={usuarioEmEdicao !== null}
        onOpenChange={(open) => {
          if (!open) fecharDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar nome</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={fecharDialog}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
