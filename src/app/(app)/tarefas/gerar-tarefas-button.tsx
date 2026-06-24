"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { gerarTarefasDoMesAction } from "./actions";

/**
 * Botão DONO-only que dispara a geração mensal de tarefas da competência
 * atual (D-08, fallback manual ao cron). Mostra o resumo "Geradas N novas,
 * M já existiam" via toast (D-11). A action já guarda role DONO
 * server-side — este componente só controla a visibilidade (defesa em
 * profundidade, a gate de fato é o server-side check em actions.ts).
 */
export function GerarTarefasButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    setIsPending(true);
    try {
      const resultado = await gerarTarefasDoMesAction();

      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }

      toast.success(
        `Geradas ${resultado.criadas} tarefas novas, ${resultado.puladas} já existiam.`
      );

      if (resultado.semResponsavelDp.length > 0) {
        const nomes = resultado.semResponsavelDp.map((e) => e.nome).join(", ");
        toast.warning(
          `${resultado.semResponsavelDp.length} empresa(s) com funcionários CLT sem responsável de DP atribuído: ${nomes}. Atribua um responsável na tela de Empresas.`
        );
      }

      if (resultado.semResponsavelContabil.length > 0) {
        const nomes = resultado.semResponsavelContabil.map((e) => e.nome).join(", ");
        toast.warning(
          `${resultado.semResponsavelContabil.length} empresa(s) Lucro Real/Presumido sem responsável Contábil atribuído: ${nomes}. Atribua um responsável na tela de Empresas.`
        );
      }

      router.refresh();
    } catch {
      toast.error("Erro ao gerar tarefas. Tente novamente.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending}>
      {isPending && <Loader2 className="animate-spin size-4 mr-2" />}
      Gerar tarefas do mês
    </Button>
  );
}
