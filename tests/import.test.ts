import { describe, it, expect } from "vitest";

/**
 * tests/import.test.ts
 *
 * Cobre EMPR-02: parseEmpresasXlsx() lê "Lista de Empresas com CNPJ.xlsx"
 * (cadastro mestre real, 198 empresas) e retorna as linhas com
 * nome + cnpj + regimeTributario corretamente atribuídos por seção/bloco.
 *
 * Totais confirmados por inspeção direta (RESEARCH.md Pattern 3.5):
 *   - LUCRO_REAL:        61
 *   - SIMPLES_NACIONAL:  80
 *   - LUCRO_PRESUMIDO:   50
 *   - sem regime:         7  (linhas "Sup. X" do Bloco 2, sem label de seção)
 *   - TOTAL:            198
 *
 * Implementação real (lib/import/parseEmpresasXlsx.ts) chega no Plano 04.
 */

describe("parseEmpresasXlsx", () => {
  it("retorna 198 linhas no total a partir de 'Lista de Empresas com CNPJ.xlsx'", () => {
    expect.fail("TODO: implementado no Plano 04 (lib/import -> parseEmpresasXlsx, total=198)");
  });

  it("atribui regimeTributario=LUCRO_REAL para as 61 empresas da seção 'LUCRO REAL'", () => {
    expect.fail("TODO: implementado no Plano 04 (lib/import -> parseEmpresasXlsx, LUCRO_REAL=61)");
  });

  it("atribui regimeTributario=SIMPLES_NACIONAL para as 80 empresas da seção 'SIMPLES NACIONAL'", () => {
    expect.fail("TODO: implementado no Plano 04 (lib/import -> parseEmpresasXlsx, SIMPLES_NACIONAL=80)");
  });

  it("atribui regimeTributario=LUCRO_PRESUMIDO para as 50 empresas da seção 'LUCRO PRESUMIDO'", () => {
    expect.fail("TODO: implementado no Plano 04 (lib/import -> parseEmpresasXlsx, LUCRO_PRESUMIDO=50)");
  });

  it("retorna regimeTributario vazio ('sem regime') para as 7 linhas 'Sup. X' do Bloco 2 sem seção", () => {
    expect.fail("TODO: implementado no Plano 04 (lib/import -> parseEmpresasXlsx, sem-regime=7)");
  });

  it("não trata linhas de label de seção (ex: 'LUCRO REAL', 'SIMPLES NACIONAL') como empresas", () => {
    expect.fail("TODO: implementado no Plano 04 (lib/import -> parseEmpresasXlsx, filtro de linha-de-seção)");
  });
});
