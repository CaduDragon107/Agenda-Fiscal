"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { concluirTarefa } from "../actions"

export function ConcluirButton({ tarefaId }: { tarefaId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleConcluir() {
    startTransition(async () => {
      const result = await concluirTarefa(tarefaId)
      if (!result.ok) {
        toast.error("Não foi possível registrar a conclusão. Tente novamente.")
      } else {
        toast.success("Tarefa marcada como concluída.")
        router.refresh()
      }
    })
  }

  return (
    <Button onClick={handleConcluir} disabled={isPending}>
      {isPending
        ? <Loader2 className="animate-spin size-4 mr-2" />
        : <Check className="size-4 mr-2" />}
      Marcar como concluída
    </Button>
  )
}
