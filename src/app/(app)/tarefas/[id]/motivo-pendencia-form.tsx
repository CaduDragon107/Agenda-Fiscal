"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { salvarMotivoPendencia } from "../actions"

export function MotivoPendenciaForm({
  tarefaId,
  motivoInicial,
}: {
  tarefaId: string
  motivoInicial: string | null
}) {
  const [motivo, setMotivo] = useState(motivoInicial ?? "")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const semAlteracao = motivo.trim() === (motivoInicial ?? "").trim()

  function handleSalvar() {
    startTransition(async () => {
      const result = await salvarMotivoPendencia(tarefaId, motivo)
      if (!result.ok) {
        toast.error("Não foi possível salvar o motivo. Tente novamente.")
      } else {
        toast.success("Motivo salvo.")
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        rows={3}
        maxLength={1000}
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        placeholder="Por que esta tarefa ainda nao foi finalizada? (ex.: aguardando documento do cliente)"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        disabled={isPending}
      />
      <div>
        <Button onClick={handleSalvar} disabled={isPending || semAlteracao}>
          {isPending
            ? <Loader2 className="animate-spin size-4 mr-2" />
            : <Save className="size-4 mr-2" />}
          Salvar motivo
        </Button>
      </div>
    </div>
  )
}
