import * as XLSX from "xlsx";

/**
 * Linha normalizada extraída de "Lista de Empresas com CNPJ.xlsx" (EMPR-02).
 *
 * `regimeTributario` é opcional: vem pré-preenchido a partir da seção do
 * bloco (Pattern 3.5) — `undefined` para as 7 linhas "Sup. X" do Bloco 2 que
 * não pertencem a nenhuma seção ("Sem regime", obrigatório atribuir na
 * revisão do wizard, Step 2).
 */
export type LinhaImportada = {
  nome: string;
  cnpj: string;
  regimeTributario?: "LUCRO_REAL" | "LUCRO_PRESUMIDO" | "SIMPLES_NACIONAL";
};

/**
 * Labels de seção encontrados na coluna "Nome" de cada bloco — marcam o
 * início de uma seção de regime tributário e propagam `regimeAtual` para as
 * linhas seguintes do mesmo bloco até o próximo label (RESEARCH.md
 * Pattern 3.5).
 */
const LABELS_SECAO = ["LUCRO REAL", "SIMPLES NACIONAL", "LUCRO PRESUMIDO"] as const;
type LabelSecao = (typeof LABELS_SECAO)[number];

const REGIME_POR_LABEL: Record<LabelSecao, LinhaImportada["regimeTributario"]> = {
  "LUCRO REAL": "LUCRO_REAL",
  "SIMPLES NACIONAL": "SIMPLES_NACIONAL",
  "LUCRO PRESUMIDO": "LUCRO_PRESUMIDO",
};

function isLabelSecao(nome: string): nome is LabelSecao {
  return (LABELS_SECAO as readonly string[]).includes(nome);
}

/**
 * Lê um bloco de colunas (ex.: A/B/C ou E/F/G) como matriz de linhas,
 * detectando linhas-label de seção ("LUCRO REAL", "SIMPLES NACIONAL",
 * "LUCRO PRESUMIDO") na coluna "Nome" e propagando o regime tributário
 * corrente para as linhas seguintes do mesmo bloco até o próximo label.
 *
 * - Linhas-label (nome ∈ LABELS_SECAO e cnpj sem dígitos — vazio ou texto de
 *   cabeçalho como "CNPJ") NÃO são retornadas como empresas — apenas
 *   atualizam `regimeAtual`. A primeira linha da planilha (linha 1) é, ao
 *   mesmo tempo, o cabeçalho de coluna ("Cod"/"CNPJ") E o label de seção
 *   inicial "LUCRO REAL" do Bloco 1 — `cnpj="CNPJ"` (texto, sem dígitos)
 *   também é tratado como label por este motivo.
 * - Linhas sem nome ou sem cnpj são ignoradas (linhas vazias entre/antes de
 *   seções).
 */
export function parseBloco(
  linhas: unknown[][],
  colCod: number,
  colNome: number,
  colCnpj: number
): LinhaImportada[] {
  const resultado: LinhaImportada[] = [];
  let regimeAtual: LinhaImportada["regimeTributario"] = undefined;

  for (const linha of linhas) {
    const nome = String(linha[colNome] ?? "").trim();
    const cnpj = String(linha[colCnpj] ?? "").trim();

    if (isLabelSecao(nome) && !/\d/.test(cnpj)) {
      regimeAtual = REGIME_POR_LABEL[nome];
      continue; // linha de label de seção — não é empresa
    }
    if (!nome || !cnpj) continue; // linha vazia entre/antes de seções

    resultado.push({ nome, cnpj, regimeTributario: regimeAtual });
  }

  // colCod não é usado na composição da linha retornada (apenas faz parte da
  // assinatura para refletir a estrutura real do bloco A/B/C ou E/F/G), mas
  // mantemos o parâmetro para documentar o mapeamento de colunas.
  void colCod;

  return resultado;
}

/**
 * Lê "Lista de Empresas com CNPJ.xlsx" (1 aba, 2 blocos de colunas lado a
 * lado: Bloco 1 = A/B/C, Bloco 2 = E/F/G) e retorna as 198 linhas
 * normalizadas (RESEARCH.md Pattern 3.5).
 *
 * Mapeamento confirmado por inspeção direta da planilha real:
 * - Bloco 1 (colunas A=Cod, B=Nome, C=CNPJ): a linha 1 é simultaneamente o
 *   cabeçalho de coluna ("Cod"/"CNPJ") E o label de seção inicial
 *   "LUCRO REAL" (B1="LUCRO REAL", C1="CNPJ" — sem dígitos, detectado como
 *   label por parseBloco). Seções LUCRO REAL (61, linhas 3-63) e
 *   SIMPLES NACIONAL (80, label em B71, dados a partir da linha 72).
 * - Bloco 2 (colunas E=Cod, F=Nome, G=CNPJ): 7 linhas "Sup. X" sem seção
 *   (sem regime, linhas 3-9) + label "LUCRO PRESUMIDO" em F19 (G19 vazio) +
 *   seção LUCRO PRESUMIDO (50, linhas 20+).
 *
 * Nenhuma linha é descartada por slice: a linha 1 é necessária (carrega o
 * label de seção inicial do Bloco 1, "LUCRO REAL") e a linha 2 (totalmente
 * vazia) já é naturalmente ignorada por `!nome || !cnpj` dentro de
 * `parseBloco`.
 */
export function parseEmpresasXlsx(buffer: Buffer): LinhaImportada[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  const bloco1 = parseBloco(matriz, 0, 1, 2); // A/B/C
  const bloco2 = parseBloco(matriz, 4, 5, 6); // E/F/G

  return [...bloco1, ...bloco2];
}
