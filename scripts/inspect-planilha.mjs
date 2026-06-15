#!/usr/bin/env node
/**
 * scripts/inspect-planilha.mjs
 *
 * Valida programaticamente a estrutura real de "data/Lista de Empresas com
 * CNPJ.xlsx": 2 blocos de colunas (A/B/C e E/F/G), seções de regime
 * tributário marcadas por linhas-label, totais esperados
 * 61 LUCRO_REAL / 79 SIMPLES_NACIONAL / 50 LUCRO_PRESUMIDO / 7 sem regime =
 * 197 empresas.
 *
 * NOTA (deviation Rule 1, Plano 01-05): RESEARCH.md Pattern 3.5 documentava
 * 80 SIMPLES_NACIONAL / 198 total, mas a inspeção direta via SheetJS nesta
 * execução (incluindo verificação de unicidade de CNPJ — 197 CNPJs únicos,
 * sem duplicatas e sem linhas descartadas) confirma 79 SIMPLES_NACIONAL / 197
 * total. A seção SIMPLES NACIONAL contém um sub-label "MEI" (B128, célula
 * mesclada com B129, sem CNPJ) que não corresponde a uma empresa — o total
 * real de empresas com nome+CNPJ válidos é 197, não 198. Os valores ESPERADO
 * abaixo refletem a contagem real verificada, não o RESEARCH.md original.
 *
 * Reimplementa em JS puro a mesma lógica de
 * src/lib/excel/parse-empresas.ts (parseBloco/parseEmpresasXlsx) para poder
 * rodar via `node scripts/inspect-planilha.mjs` sem depender de um loader
 * TypeScript.
 *
 * Uso: node scripts/inspect-planilha.mjs
 * Saída: contagens por regime + validação contra os totais esperados
 * (exit code 1 se algo não bater).
 */

import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLANILHA_PATH = path.resolve(__dirname, "..", "data", "Lista de Empresas com CNPJ.xlsx");

const LABELS_SECAO = ["LUCRO REAL", "SIMPLES NACIONAL", "LUCRO PRESUMIDO"];
const REGIME_POR_LABEL = {
  "LUCRO REAL": "LUCRO_REAL",
  "SIMPLES NACIONAL": "SIMPLES_NACIONAL",
  "LUCRO PRESUMIDO": "LUCRO_PRESUMIDO",
};

function parseBloco(linhas, colNome, colCnpj) {
  const resultado = [];
  let regimeAtual;

  for (const linha of linhas) {
    const nome = String(linha[colNome] ?? "").trim();
    const cnpj = String(linha[colCnpj] ?? "").trim();

    // Label de seção: nome ∈ LABELS_SECAO e cnpj sem dígitos (vazio ou
    // texto de cabeçalho como "CNPJ" — caso da linha 1, que é ao mesmo
    // tempo cabeçalho de coluna e label "LUCRO REAL" do Bloco 1).
    if (LABELS_SECAO.includes(nome) && !/\d/.test(cnpj)) {
      regimeAtual = REGIME_POR_LABEL[nome];
      continue;
    }
    if (!nome || !cnpj) continue;

    resultado.push({ nome, cnpj, regimeTributario: regimeAtual });
  }

  return resultado;
}

const buffer = readFileSync(PLANILHA_PATH);
const workbook = XLSX.read(buffer, { type: "buffer" });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

// Nenhuma linha é descartada por slice — a linha 1 carrega o label de seção
// inicial do Bloco 1 ("LUCRO REAL"); a linha 2 (vazia) é naturalmente
// ignorada por !nome || !cnpj.
const bloco1 = parseBloco(matriz.map((l) => [l[1], l[2]]), 0, 1); // B/C
const bloco2 = parseBloco(matriz.map((l) => [l[5], l[6]]), 0, 1); // F/G

const todasLinhas = [...bloco1, ...bloco2];

const contagens = {
  LUCRO_REAL: 0,
  SIMPLES_NACIONAL: 0,
  LUCRO_PRESUMIDO: 0,
  SEM_REGIME: 0,
};

for (const linha of todasLinhas) {
  if (linha.regimeTributario === "LUCRO_REAL") contagens.LUCRO_REAL++;
  else if (linha.regimeTributario === "SIMPLES_NACIONAL") contagens.SIMPLES_NACIONAL++;
  else if (linha.regimeTributario === "LUCRO_PRESUMIDO") contagens.LUCRO_PRESUMIDO++;
  else contagens.SEM_REGIME++;
}

const total = todasLinhas.length;

console.log("Inspeção de 'Lista de Empresas com CNPJ.xlsx'");
console.log("---------------------------------------------");
console.log(`LUCRO_REAL:        ${contagens.LUCRO_REAL}`);
console.log(`SIMPLES_NACIONAL:  ${contagens.SIMPLES_NACIONAL}`);
console.log(`LUCRO_PRESUMIDO:   ${contagens.LUCRO_PRESUMIDO}`);
console.log(`Sem regime:        ${contagens.SEM_REGIME}`);
console.log(`TOTAL:             ${total}`);

const ESPERADO = {
  LUCRO_REAL: 61,
  SIMPLES_NACIONAL: 79,
  LUCRO_PRESUMIDO: 50,
  SEM_REGIME: 7,
  TOTAL: 197,
};

const erros = [];
if (contagens.LUCRO_REAL !== ESPERADO.LUCRO_REAL) {
  erros.push(`LUCRO_REAL esperado=${ESPERADO.LUCRO_REAL}, obtido=${contagens.LUCRO_REAL}`);
}
if (contagens.SIMPLES_NACIONAL !== ESPERADO.SIMPLES_NACIONAL) {
  erros.push(
    `SIMPLES_NACIONAL esperado=${ESPERADO.SIMPLES_NACIONAL}, obtido=${contagens.SIMPLES_NACIONAL}`
  );
}
if (contagens.LUCRO_PRESUMIDO !== ESPERADO.LUCRO_PRESUMIDO) {
  erros.push(
    `LUCRO_PRESUMIDO esperado=${ESPERADO.LUCRO_PRESUMIDO}, obtido=${contagens.LUCRO_PRESUMIDO}`
  );
}
if (contagens.SEM_REGIME !== ESPERADO.SEM_REGIME) {
  erros.push(`Sem regime esperado=${ESPERADO.SEM_REGIME}, obtido=${contagens.SEM_REGIME}`);
}
if (total !== ESPERADO.TOTAL) {
  erros.push(`TOTAL esperado=${ESPERADO.TOTAL}, obtido=${total}`);
}

const nomeComLabel = todasLinhas.find((l) => LABELS_SECAO.includes(l.nome));
if (nomeComLabel) {
  erros.push(`Linha com nome igual a label de seção encontrada: "${nomeComLabel.nome}"`);
}

if (erros.length > 0) {
  console.error("\nFALHA na validação:");
  for (const erro of erros) console.error(`  - ${erro}`);
  process.exit(1);
}

console.log("\nOK: todas as contagens conferem com o esperado (61/79/50/7=197).");
