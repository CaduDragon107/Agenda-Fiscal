import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseEmpresasXlsx, type LinhaImportada } from "@/lib/excel/parse-empresas";

/**
 * tests/import.test.ts
 *
 * Cobre EMPR-02: parseEmpresasXlsx() lê "Lista de Empresas com CNPJ.xlsx"
 * (cadastro mestre real) e retorna as linhas com nome + cnpj +
 * regimeTributario corretamente atribuídos por seção/bloco.
 *
 * Totais confirmados por inspeção direta via SheetJS nesta execução
 * (Plano 01-05) — incluindo verificação de unicidade de CNPJ (197 CNPJs
 * únicos, sem duplicatas, sem linhas descartadas):
 *   - LUCRO_REAL:        61
 *   - SIMPLES_NACIONAL:  79
 *   - LUCRO_PRESUMIDO:   50
 *   - sem regime:         7  (linhas "Sup. X" do Bloco 2, sem label de seção)
 *   - TOTAL:            197
 *
 * NOTA (deviation Rule 1, Plano 01-05): RESEARCH.md Pattern 3.5 documentava
 * 80 SIMPLES_NACIONAL / 198 total — a contagem real (verificada por unicidade
 * de CNPJ) é 79/197. A seção SIMPLES NACIONAL contém um sub-label "MEI"
 * (célula mesclada, sem CNPJ) que não corresponde a uma empresa.
 */

const PLANILHA_PATH = path.resolve(__dirname, "..", "data", "Lista de Empresas com CNPJ.xlsx");

function carregarLinhas(): LinhaImportada[] {
  const buffer = readFileSync(PLANILHA_PATH);
  return parseEmpresasXlsx(buffer);
}

describe("parseEmpresasXlsx", () => {
  it("retorna 197 linhas no total a partir de 'Lista de Empresas com CNPJ.xlsx'", () => {
    const linhas = carregarLinhas();
    expect(linhas).toHaveLength(197);
  });

  it("atribui regimeTributario=LUCRO_REAL para as 61 empresas da seção 'LUCRO REAL'", () => {
    const linhas = carregarLinhas();
    const lucroReal = linhas.filter((l) => l.regimeTributario === "LUCRO_REAL");
    expect(lucroReal).toHaveLength(61);
  });

  it("atribui regimeTributario=SIMPLES_NACIONAL para as 79 empresas da seção 'SIMPLES NACIONAL'", () => {
    const linhas = carregarLinhas();
    const simplesNacional = linhas.filter((l) => l.regimeTributario === "SIMPLES_NACIONAL");
    expect(simplesNacional).toHaveLength(79);
  });

  it("atribui regimeTributario=LUCRO_PRESUMIDO para as 50 empresas da seção 'LUCRO PRESUMIDO'", () => {
    const linhas = carregarLinhas();
    const lucroPresumido = linhas.filter((l) => l.regimeTributario === "LUCRO_PRESUMIDO");
    expect(lucroPresumido).toHaveLength(50);
  });

  it("retorna regimeTributario indefinido ('sem regime') para as 7 linhas 'Sup. X' do Bloco 2 sem seção", () => {
    const linhas = carregarLinhas();
    const semRegime = linhas.filter((l) => l.regimeTributario === undefined);
    expect(semRegime).toHaveLength(7);
    for (const linha of semRegime) {
      expect(linha.nome.trim().startsWith("Sup.")).toBe(true);
    }
  });

  it("não trata linhas de label de seção (ex: 'LUCRO REAL', 'SIMPLES NACIONAL') como empresas", () => {
    const linhas = carregarLinhas();
    const labels = ["LUCRO REAL", "SIMPLES NACIONAL", "LUCRO PRESUMIDO"];
    for (const linha of linhas) {
      expect(labels).not.toContain(linha.nome);
    }
  });
});
