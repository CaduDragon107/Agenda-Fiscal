"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { criarTarefa } from "./actions";

/**
 * Schema do lado do cliente — sem o transform de string→Date.
 * O transform fica exclusivamente no tarefaSchema server-side (actions.ts).
 * Isso evita o problema de zodResolver tentar serializar Date objects para
 * FormData (RESEARCH.md Pattern 8).
 */
const novaTarefaFormSchema = z.object({
  titulo: z.string().min(1, "Titulo e obrigatorio"),
  descricao: z.string().optional(),
  empresaId: z.string().min(1, "Empresa e obrigatoria"),
  responsavelId: z.string().min(1, "Responsavel e obrigatorio"),
  prazo: z.string().min(1, "Prazo e obrigatorio"),
});

type NovaTarefaFormData = z.infer<typeof novaTarefaFormSchema>;

type NovaTarefaDialogProps = {
  responsaveis: { id: string; nome: string }[];
  empresas: { id: string; nome: string }[];
};

export function NovaTarefaDialog({ responsaveis, empresas }: NovaTarefaDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<NovaTarefaFormData>({
    resolver: zodResolver(novaTarefaFormSchema),
  });

  async function onSubmit(data: NovaTarefaFormData) {
    setIsPending(true);

    const formData = new FormData();
    formData.set("titulo", data.titulo);
    formData.set("empresaId", data.empresaId);
    formData.set("responsavelId", data.responsavelId);
    formData.set("prazo", data.prazo);
    if (data.descricao) formData.set("descricao", data.descricao);

    const result = await criarTarefa(formData);
    setIsPending(false);

    if (!result.ok) {
      toast.error("Nao foi possivel criar a tarefa. Verifique os dados e tente novamente.");
      return;
    }

    toast.success("Tarefa criada com sucesso.");
    setOpen(false);
    reset();
    router.refresh(); // Atualiza o Server Component pai para exibir a nova tarefa
  }

  function handleCancel() {
    setOpen(false);
    reset();
  }

  return (
    <>
      <Button variant="default" onClick={() => setOpen(true)}>
        Nova tarefa
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nova tarefa</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {/* Empresa */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="empresaId">Empresa</Label>
              <Select onValueChange={(val) => setValue("empresaId", val)}>
                <SelectTrigger id="empresaId">
                  <SelectValue placeholder="Selecionar empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.empresaId && (
                <p className="text-xs text-destructive">{errors.empresaId.message}</p>
              )}
            </div>

            {/* Titulo */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="titulo">Titulo</Label>
              <Input
                id="titulo"
                placeholder="Ex: Enviar DCTF de maio"
                {...register("titulo")}
              />
              {errors.titulo && (
                <p className="text-xs text-destructive">{errors.titulo.message}</p>
              )}
            </div>

            {/* Descricao */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="descricao">Descricao (opcional)</Label>
              <textarea
                id="descricao"
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder="Instrucoes ou observacoes sobre a tarefa..."
                {...register("descricao")}
              />
              {errors.descricao && (
                <p className="text-xs text-destructive">{errors.descricao.message}</p>
              )}
            </div>

            {/* Responsavel */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="responsavelId">Responsavel</Label>
              <Select onValueChange={(val) => setValue("responsavelId", val)}>
                <SelectTrigger id="responsavelId">
                  <SelectValue placeholder="Selecionar responsavel..." />
                </SelectTrigger>
                <SelectContent>
                  {responsaveis.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.responsavelId && (
                <p className="text-xs text-destructive">{errors.responsavelId.message}</p>
              )}
            </div>

            {/* Prazo */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prazo">Prazo</Label>
              <Input
                id="prazo"
                type="date"
                {...register("prazo")}
              />
              {errors.prazo && (
                <p className="text-xs text-destructive">{errors.prazo.message}</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="animate-spin size-4 mr-2" />}
                Criar tarefa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
