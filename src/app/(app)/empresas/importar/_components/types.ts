import type { LinhaImportada } from "@/lib/excel/parse-empresas";

/**
 * Linha em staging no wizard de importação (Step 2/3) — vive apenas em
 * estado React, nunca no banco antes da confirmação (Step 3).
 *
 * `id` é um identificador local estável (para keys de tabela e
 * meta.updateData), não um id de banco.
 */
export type LinhaStaged = LinhaImportada & {
  id: string;
  responsavelId?: string;
  contatos?: string;
  particularidades?: string;
  incluida: boolean;
};

export type StatusLinha = "PRONTA" | "CNPJ_INVALIDO" | "SEM_REGIME" | "DUPLICADA";

export const STATUS_LABEL: Record<StatusLinha, string> = {
  PRONTA: "Pronta",
  CNPJ_INVALIDO: "CNPJ inválido",
  SEM_REGIME: "Sem regime",
  DUPLICADA: "Duplicada",
};

export const STATUS_BADGE_CLASS: Record<StatusLinha, string> = {
  PRONTA: "bg-green-600 text-white",
  CNPJ_INVALIDO: "bg-amber-500 text-white",
  SEM_REGIME: "bg-amber-500 text-white",
  DUPLICADA: "bg-amber-500 text-white",
};
