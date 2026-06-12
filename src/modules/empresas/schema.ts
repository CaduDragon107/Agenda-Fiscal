import { z } from "zod";
import { validarCNPJ } from "@/lib/cnpj";

/**
 * Schema de validação de Empresa (EMPR-01).
 *
 * `regimeTributario` cobre os 3 valores do enum Prisma `RegimeTributario`
 * (LUCRO_REAL, LUCRO_PRESUMIDO, SIMPLES_NACIONAL) — não apenas 2, conforme
 * 01-PATTERNS.md (a UI-SPEC menciona só "Lucro Real"/"Simples Nacional" no
 * texto do select, mas isso está desatualizado em relação ao RESEARCH.md
 * Pattern 3.5, que é a fonte autoritativa: as 198 empresas reais cobrem os
 * 3 regimes).
 */
export const empresaSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().refine(validarCNPJ, "CNPJ inválido"),
  regimeTributario: z.enum([
    "LUCRO_REAL",
    "LUCRO_PRESUMIDO",
    "SIMPLES_NACIONAL",
  ]),
  responsavelId: z.string().min(1, "Responsável é obrigatório"),
  contatos: z.string().optional(),
  particularidades: z.string().optional(),
});

export type EmpresaInput = z.infer<typeof empresaSchema>;

/**
 * Schema de linha importada da planilha (EMPR-02).
 *
 * `regimeTributario` e `responsavelId` são opcionais aqui porque, no
 * momento da importação, o regime pode vir da seção da planilha (ou estar
 * ausente — "Sup. X") e o responsável ainda não foi atribuído. A revisão
 * final/atribuição acontece na tela de confirmação de importação (Plano 05),
 * que então valida contra `empresaSchema` antes de persistir.
 */
export const linhaImportadaSchema = z.object({
  nome: z.string().min(1),
  cnpj: z.string(),
  regimeTributario: z
    .enum(["LUCRO_REAL", "LUCRO_PRESUMIDO", "SIMPLES_NACIONAL"])
    .optional(),
  responsavelId: z.string().optional(),
  contatos: z.string().optional(),
  particularidades: z.string().optional(),
});

export type LinhaImportadaInput = z.infer<typeof linhaImportadaSchema>;
