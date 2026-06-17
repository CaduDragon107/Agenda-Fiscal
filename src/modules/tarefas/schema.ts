import { z } from "zod";
import { isValid, parseISO } from "date-fns";

/**
 * Schema de validação de Tarefa (TASK-04).
 *
 * Campos obrigatórios (per D-01, D-02, D-03):
 * - titulo: obrigatório (D-02)
 * - empresaId: obrigatório (D-01)
 * - prazo: obrigatório e deve ser data válida (D-03)
 * - responsavelId: obrigatório
 *
 * prazo (per RESEARCH.md Pattern 8): transforma string YYYY-MM-DD em Date
 * com hora 23:59:59 (fim do dia, local) para evitar problemas de UTC com
 * prazos fiscais — uma data "31/01" salva como meia-noite UTC apareceria
 * como "30/01" em UTC-3.
 *
 * Validação de prazo (WR-05): Date.parse("2026-13-45") retorna um número
 * válido (JS silenciosamente rola o overflow), criando prazos incorretos.
 * Substituído por regex estrita de formato + isValid(parseISO()) do date-fns,
 * que rejeita meses/dias fora de intervalo sem rolamento silencioso.
 */
export const tarefaSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório"),
  descricao: z.string().optional(),
  empresaId: z.string().min(1, "Empresa é obrigatória"),
  responsavelId: z.string().min(1, "Responsável é obrigatório"),
  prazo: z
    .string()
    .min(1, "Prazo é obrigatório")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (esperado YYYY-MM-DD)")
    .refine((val) => isValid(parseISO(val)), "Data inválida")
    .transform((val) => {
      const [year, month, day] = val.split("-").map(Number);
      // Fim do dia local (23:59:59) — evita o problema de UTC com prazos fiscais
      return new Date(year, month - 1, day, 23, 59, 59);
    }),
});

export type TarefaInput = z.infer<typeof tarefaSchema>;
