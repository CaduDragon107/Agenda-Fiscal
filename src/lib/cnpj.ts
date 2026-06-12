/**
 * Valida um CNPJ usando o algoritmo completo de dígitos verificadores
 * (módulo 11).
 *
 * IMPORTANTE: esta função NUNCA deve ser substituída por um regex de
 * formato (ex.: `/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/`). A planilha real de
 * importação (EMPR-02) pode conter CNPJs com dígitos verificadores
 * digitados incorretamente, que um regex de formato não detectaria.
 *
 * Aceita CNPJ formatado ("11.222.333/0001-81") ou apenas dígitos
 * ("11222333000181"). Rejeita:
 * - strings que não resultam em exatamente 14 dígitos
 * - todos os dígitos iguais (ex.: "00.000.000/0000-00")
 * - dígitos verificadores (d1/d2) incorretos
 */
export function validarCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");

  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false; // todos os dígitos iguais

  const calcDigit = (base: string, weights: number[]): number => {
    const sum = base
      .split("")
      .reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(digits.slice(0, 12), weights1);
  const d2 = calcDigit(digits.slice(0, 12) + d1, weights2);

  return digits.endsWith(`${d1}${d2}`);
}
