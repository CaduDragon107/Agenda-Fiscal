"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { excluirTarefasDaCompetenciaAtualAction } from "./actions";

/**
 * Botão DONO-only que exclui em massa todas as tarefas (recorrentes +
 * avulsas, todos os setores) da competência (mês) atual, para uso
 * emergencial quando a geração mensal precisa ser refeita. Protegido por
 * um AlertDialog de confirmação — a action já guarda role DONO
 * server-side; este componente só controla a visibilidade (defesa em
 * profundidade, a gate de fato é o server-side check em actions.ts).
 */
export function ExcluirTarefasCompetenciaButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleExcluir() {
    setIsPending(true);
    try {
      const resultado = await excluirTarefasDaCompetenciaAtualAction();

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }

      toast.success(
        `${resultado.excluidas} tarefa(s) do mês atual excluída(s).`
      );
      router.refresh();
    } catch {
      toast.error("Erro ao excluir tarefas. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin size-4 mr-2" />}
          Excluir tarefas do mês
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Excluir todas as tarefas do mês atual?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Isto exclui todas as tarefas (recorrentes e avulsas, de todos os
            setores) da competência atual. O histórico de meses anteriores é
            preservado. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleExcluir}>
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
