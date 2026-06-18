/**
 * src/lib/dia-util.ts
 *
 * Helper puro para antecipar uma data para o dia útil anterior quando ela
 * cai em fim de semana ou feriado nacional brasileiro.
 *
 * Implementa D-05/D-06 do CONTEXT.md:
 *   - D-05: SEMPRE antecipa (nunca posterga) quando o dia-base cai em fim
 *     de semana ou feriado nacional — para todas as obrigações, sem exceção.
 *   - D-06: feriados calculados dinamicamente via `date-holidays`, nunca
 *     uma lista fixa por ano (feriados móveis como Carnaval, Sexta-feira
 *     Santa e Corpus Christi mudam de data todo ano).
 *
 * Nota crítica de API [03-RESEARCH.md Pitfall 1]: `hd.isHoliday(date)`
 * retorna `false` quando a data NÃO é feriado, ou um ARRAY de objetos de
 * feriado quando É feriado — nunca retorna `true`. A checagem correta de
 * "é dia útil" é `hd.isHoliday(date) === false`; nunca escrever
 * `=== true` (sempre falso, desabilitaria a checagem de feriado em
 * silêncio).
 *
 * Este helper é puro (sem I/O, sem dependências externas além das libs de
 * data) e pode ser testado diretamente com Vitest sem mocks.
 */

import Holidays from "date-holidays";
import { isSaturday, isSunday, subDays } from "date-fns";

// Singleton em escopo de módulo — instanciar UMA vez, nunca por chamada.
// Sem argumento de estado: apenas feriados nacionais (Out of Scope:
// feriados estaduais/municipais).
const hd = new Holidays("BR");

function isDiaUtil(date: Date): boolean {
  if (isSaturday(date) || isSunday(date)) return false;
  return hd.isHoliday(date) === false;
}

/**
 * Antecipa `date` para o dia útil anterior, caminhando um dia por vez para
 * trás até encontrar um dia que não seja fim de semana nem feriado
 * nacional. Não muta a data recebida — sempre retorna um novo Date.
 */
export function anticiparParaDiaUtil(date: Date): Date {
  let atual = date;
  while (!isDiaUtil(atual)) {
    atual = subDays(atual, 1);
  }
  return atual;
}
