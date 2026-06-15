"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { confirmarImportacao } from "../actions";
import type { LinhaStaged } from "./types";

type StepConfirmProps = {
  linhas: LinhaStaged[];
  onVoltar: () => void;
};

/**
 * Step 3 do wizard: revisão final + confirmação.
 *
 * "Confirmar importação" chama confirmarImportacao (Server Action), que
 * persiste apenas as linhas incluídas e válidas (regime + responsável +
 * CNPJ válido — revalidado no servidor via empresaSchema, T-01-IMPORT-INPUT).
 * Em erro, o staging é preservado e "Tentar novamente" reenvia o mesmo
 * payload.
 */
export function StepConfirm({ linhas, onVoltar }: StepConfirmProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [resultado, setResultado] = useState<
    { status: "sucesso"; persistidas: number } | { status: "erro" } | null
  >(null);

  const linhasIncluidas = linhas.filter((l) => l.incluida);

  async function confirmar() {
    setIsLoading(true);
    setResultado(null);

    const resposta = await confirmarImportacao(linhasIncluidas);

    setIsLoading(false);

    if (!resposta.ok) {
      setResultado({ status: "erro" });
      return;
    }

    setResultado({ status: "sucesso", persistidas: resposta.persistidas });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Resumo da importação</h2>
          <p className="text-sm text-muted-foreground">
            {linhasIncluidas.length} empresa(s) selecionada(s) para importação.
          </p>
        </div>

        {resultado?.status === "sucesso" ? (
          <Alert className="border-green-600 text-green-700">
            <CheckCircle2 className="size-4" />
            <AlertTitle>Importação concluída</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>Importação concluída: {resultado.persistidas} empresas adicionadas.</span>
              <Button asChild size="sm" className="w-fit">
                <Link href="/empresas">Ver empresas</Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {resultado?.status === "erro" ? (
          <Alert variant="destructive">
            <XCircle className="size-4" />
            <AlertTitle>Não foi possível concluir a importação</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>Não foi possível salvar. Verifique os dados e tente novamente.</span>
              <Button
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={confirmar}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Tentar novamente
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {resultado?.status !== "sucesso" ? (
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onVoltar} disabled={isLoading}>
              Voltar à revisão
            </Button>
            <Button onClick={confirmar} disabled={isLoading || linhasIncluidas.length === 0}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirmar importação
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
