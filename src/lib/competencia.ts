/**
 * src/lib/competencia.ts
 *
 * Formato canônico de competência ("YYYY-MM") usado como componente da
 * chave de idempotência do motor de geração mensal (D-13).
 *
 * Pitfall 4 (03-RESEARCH.md): uma string de competência não canônica
 * (ex.: "2026-1" sem zero-pad) gera uma chave de unicidade DIFERENTE de
 * "2026-01" para o mesmo mês real, quebrando a idempotência entre a
 * geração automática (cron) e o gatilho manual. Por isso:
 *   - competenciaSchema valida o formato estritamente via regex
 *   - competenciaAtual() usa date-fns `format`, nunca concatenação manual
 *     de string (que poderia esquecer o zero-pad do mês)
 */

import { format } from "date-fns";
import { z } from "zod";

export const competenciaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Competência deve estar no formato YYYY-MM");

// Formato canônico de competência ANUAL ("YYYY") usado pelas obrigações
// anuais do motor Contábil (ECD/ECF/DEFIS — Fase 7). Distinto do formato
// mensal acima (4 dígitos sem hífen vs 7 caracteres "YYYY-MM"); a unicidade
// entre os dois eixos é garantida pelo enum TipoObrigacao ser sempre
// distinto entre obrigações mensais e anuais, não pelo formato textual.
export const competenciaAnualSchema = z
  .string()
  .regex(/^\d{4}$/, "Competência anual deve estar no formato YYYY");

export function competenciaAtual(): string {
  return format(new Date(), "yyyy-MM");
}
