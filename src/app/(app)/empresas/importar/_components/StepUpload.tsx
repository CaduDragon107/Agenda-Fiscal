"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { parseUploadAction } from "../actions";
import type { LinhaImportada } from "@/lib/excel/parse-empresas";

type StepUploadProps = {
  onParsed: (linhas: LinhaImportada[]) => void;
};

/**
 * Step 1 do wizard de importação: dropzone/seleção de arquivo .xlsx.
 *
 * Aceita apenas .xlsx. Ao clicar em "Avançar para revisão", envia o arquivo
 * para parseUploadAction (Server Action) — em caso de erro, exibe a copy
 * genérica "Arquivo inválido. Envie um arquivo .xlsx válido." (nunca detalhe
 * interno do parser, T-01-UPLOAD).
 */
export function StepUpload({ onParsed }: StepUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  function selecionarArquivo(file: File | null) {
    setErro(null);
    setArquivo(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) selecionarArquivo(file);
  }

  async function avancar() {
    if (!arquivo) return;

    setIsLoading(true);
    setErro(null);

    const formData = new FormData();
    formData.set("arquivo", arquivo);

    const resultado = await parseUploadAction(formData);

    setIsLoading(false);

    if (!resultado.ok) {
      setErro("Arquivo inválido. Envie um arquivo .xlsx válido.");
      return;
    }

    onParsed(resultado.linhas);
  }

  function formatarTamanho(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div
          className={`flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-12 text-center transition-colors ${
            isDragOver ? "border-primary bg-muted" : "border-muted-foreground/25"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="size-8 text-muted-foreground" />
          {arquivo ? (
            <div className="text-sm">
              <p className="font-medium">{arquivo.name}</p>
              <p className="text-muted-foreground">{formatarTamanho(arquivo.size)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Arraste a planilha .xlsx aqui ou selecione um arquivo
            </p>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => selecionarArquivo(e.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            Selecionar arquivo
          </Button>
        </div>

        {erro ? (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex justify-end">
          <Button onClick={avancar} disabled={!arquivo || isLoading}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
            Avançar para revisão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
