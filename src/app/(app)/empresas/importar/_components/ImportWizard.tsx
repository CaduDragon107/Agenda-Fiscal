"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LinhaImportada } from "@/lib/excel/parse-empresas";
import { StepConfirm } from "./StepConfirm";
import { StepReview } from "./StepReview";
import { StepUpload } from "./StepUpload";
import type { LinhaStaged } from "./types";

type ResponsavelOption = { id: string; nome: string };

type ImportWizardProps = {
  responsaveis: ResponsavelOption[];
};

const ETAPAS = [
  { numero: 1, titulo: "Upload" },
  { numero: 2, titulo: "Revisão" },
  { numero: 3, titulo: "Confirmação" },
] as const;

let proximoId = 0;
function gerarId(): string {
  proximoId += 1;
  return `linha-${proximoId}-${Date.now()}`;
}

/**
 * Shell do wizard de importação de 3 etapas (EMPR-02).
 *
 * Mantém o estado das linhas staged em React (`linhas`) — nada toca o banco
 * até a confirmação explícita no Step 3 (Anti-Pattern "persistir as is").
 *
 * Conversão LinhaImportada -> LinhaStaged: cada linha do parser recebe um
 * `id` local estável, `incluida: true` por padrão (todas as linhas vêm
 * pré-selecionadas para importação, mas linhas "Sem regime"/CNPJ inválido
 * continuam bloqueando o avanço para o Step 3 enquanto incluídas).
 */
export function ImportWizard({ responsaveis }: ImportWizardProps) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [linhas, setLinhas] = useState<LinhaStaged[]>([]);
  const [discardOpen, setDiscardOpen] = useState(false);

  function handleParsed(linhasParsed: LinhaImportada[]) {
    const staged: LinhaStaged[] = linhasParsed.map((linha) => ({
      ...linha,
      id: gerarId(),
      responsavelId: undefined,
      contatos: "",
      particularidades: "",
      incluida: true,
    }));
    setLinhas(staged);
    setEtapa(2);
  }

  function descartar() {
    setLinhas([]);
    setEtapa(1);
    setDiscardOpen(false);
    router.push("/empresas");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {ETAPAS.map((item) => (
          <div key={item.numero} className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full border text-sm font-semibold",
                etapa === item.numero
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/25 text-muted-foreground"
              )}
            >
              {item.numero}
            </div>
            <span
              className={cn(
                "text-sm",
                etapa === item.numero ? "font-semibold" : "text-muted-foreground"
              )}
            >
              Etapa {item.numero} de 3 — {item.titulo}
            </span>
          </div>
        ))}
      </div>

      {etapa === 1 ? <StepUpload onParsed={handleParsed} /> : null}

      {etapa === 2 ? (
        <StepReview
          linhas={linhas}
          responsaveis={responsaveis}
          onChange={setLinhas}
          onAvancar={() => setEtapa(3)}
          onVoltar={() => setEtapa(1)}
        />
      ) : null}

      {etapa === 3 ? <StepConfirm linhas={linhas} onVoltar={() => setEtapa(2)} /> : null}

      {etapa > 1 ? (
        <div className="flex justify-start">
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => setDiscardOpen(true)}>
            Descartar importação
          </Button>
        </div>
      ) : null}

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar importação?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dados revisados serão perdidos. Você precisará enviar a
              planilha novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar à revisão</AlertDialogCancel>
            <AlertDialogAction
              onClick={descartar}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
