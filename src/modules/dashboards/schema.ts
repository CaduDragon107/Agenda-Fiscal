/**
 * src/modules/dashboards/schema.ts
 *
 * Valida o parâmetro de janela do dashboard de evolução mensal (DASH-02,
 * `?meses=`) antes que o valor chegue em `subMonths`/Prisma.
 *
 * Pitfall (04-RESEARCH.md, Security Domain — ASVS V5): um valor de `meses`
 * não validado (negativo, não-numérico, ou absurdamente grande) poderia
 * gerar uma janela de tempo inválida ou uma query custosa sobre todo o
 * histórico de `Tarefa`/`DesempenhoMensal`. Por isso:
 *   - mesesSchema valida o formato estritamente via z.coerce.number()
 *     com limites min(1)/max(24)
 *   - o valor default (quando o param está ausente) é tratado no
 *     consumidor, não aqui — este schema só valida o que foi recebido
 */

import { z } from "zod";

export const mesesSchema = z.coerce
  .number()
  .int("Número de meses deve ser um inteiro")
  .min(1, "Número de meses deve ser no mínimo 1")
  .max(24, "Número de meses deve ser no máximo 24");
