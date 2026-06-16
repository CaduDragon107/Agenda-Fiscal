#!/usr/bin/env node
/**
 * scripts/importar-empresas.mjs
 *
 * Importa as 197 empresas de `data/EMPRESAS RESPONSÁVEL.xlsx` diretamente
 * no banco de producao (Neon), criando registros Empresa que ainda nao
 * existem, cada um com seu primeiro EmpresaRegimeHistorico aninhado.
 *
 * Por padrao roda em modo DRY-RUN (nenhuma escrita no banco). So aplica
 * escritas quando invocado com a flag `--apply`.
 *
 * Uso:
 *   node --env-file=.env scripts/importar-empresas.mjs            (dry-run)
 *   node --env-file=.env scripts/importar-empresas.mjs --apply     (aplica)
 *
 * Estrutura da planilha (sheet "Planilha1"):
 *   Linha 0: titulo
 *   Linha 1: cabecalho
 *   Linhas 2-198: dados validos (CNPJ nao vazio)
 *   Linhas 199+: rodape de totais (CNPJ vazio — ignorar)
 *
 * Colunas (0-based): 0=Codigo, 1=Empresa, 2=CNPJ, 3=Regime Tributario, 4=Responsavel
 */

import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLANILHA_PATH = path.resolve(__dirname, "..", "data", "EMPRESAS RESPONSÁVEL.xlsx");

const APPLY = process.argv.includes("--apply");

/** Normaliza CNPJ para apenas digitos (usado na comparacao de existencia). */
function soDigitos(s) {
  return String(s ?? "").replace(/\D/g, "");
}

/**
 * Mapeia rotulo de regime tributario da planilha para o enum do banco.
 * Retorna { regime: RegimeTributario, particularidades: string|null }
 * ou null se o rotulo nao for reconhecido.
 */
function mapearRegime(rotulo) {
  const r = String(rotulo ?? "").trim().toLowerCase();
  if (r === "lucro real") return { regime: "LUCRO_REAL", particularidades: null };
  if (r === "lucro presumido") return { regime: "LUCRO_PRESUMIDO", particularidades: null };
  if (r === "simples nacional") return { regime: "SIMPLES_NACIONAL", particularidades: null };
  if (r === "mei") return { regime: "SIMPLES_NACIONAL", particularidades: "MEI" };
  return null;
}

async function main() {
  // 1. Ler planilha "EMPRESAS RESPONSAVEL.xlsx", sheet "Planilha1".
  const buffer = readFileSync(PLANILHA_PATH);
  const workbook = XLSX.read(buffer, { type: "buffer" });

  // Usar explicitamente "Planilha1" se disponivel, caso contrario a primeira aba.
  const sheetName = workbook.SheetNames.includes("Planilha1")
    ? "Planilha1"
    : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

  console.log(`Modo: ${APPLY ? "APPLY (escreve no banco)" : "DRY-RUN (nenhuma escrita)"}`);
  console.log(`Sheet usada: "${sheetName}"`);

  // 2. Filtrar linhas validas: a partir do indice 2, CNPJ nao vazio.
  const linhasValidas = [];
  for (let i = 2; i < matriz.length; i++) {
    const linha = matriz[i];
    const cnpj = String(linha[2] ?? "").trim();
    if (!cnpj) continue;
    linhasValidas.push({
      codigo: String(linha[0] ?? "").trim(),
      nome: String(linha[1] ?? "").trim(),
      cnpj,                               // formato original da planilha
      cnpjDigitos: soDigitos(cnpj),       // apenas digitos, para comparacao
      regimeRotulo: String(linha[3] ?? "").trim(),
      responsavelNome: String(linha[4] ?? "").trim(),
    });
  }

  console.log(`\nLinhas validas na planilha (CNPJ nao vazio): ${linhasValidas.length}`);

  const db = new PrismaClient();

  try {
    // 3. Carregar dados do banco.
    const usuarios = await db.usuario.findMany({ select: { id: true, nome: true } });
    const empresasExistentes = await db.empresa.findMany({ select: { cnpj: true } });

    console.log(`Usuarios no banco: ${usuarios.length}`);
    console.log(`Empresas no banco (pre-import): ${empresasExistentes.length}`);

    // 4. Construir Map de nome de usuario -> id (case-insensitive + trim).
    const nomeParaId = new Map();
    for (const usuario of usuarios) {
      nomeParaId.set(usuario.nome.trim().toLowerCase(), usuario.id);
    }

    // 5. Construir Set de CNPJs ja existentes (comparacao por digitos).
    const cnpjsExistentes = new Set(empresasExistentes.map((e) => soDigitos(e.cnpj)));

    // 6. Classificar cada linha da planilha.
    const aCriar = [];
    const puladas = [];           // CNPJ ja existente no banco
    const semResponsavel = [];    // Responsavel nao resolvido para usuario
    const semRegime = [];         // Regime nao mapeavel

    const linhasMei = [];

    for (const linha of linhasValidas) {
      // 6a. Checar duplicata (by CNPJ-digitos).
      if (cnpjsExistentes.has(linha.cnpjDigitos)) {
        puladas.push(linha);
        continue;
      }

      // 6b. Mapear regime.
      const regimeMapeado = mapearRegime(linha.regimeRotulo);
      if (!regimeMapeado) {
        semRegime.push(linha);
        continue;
      }

      // Rastrear MEI.
      if (linha.regimeRotulo.trim().toLowerCase() === "mei") {
        linhasMei.push(linha);
      }

      // 6c. Resolver responsavel.
      const responsavelId = nomeParaId.get(linha.responsavelNome.trim().toLowerCase());
      if (!responsavelId) {
        semResponsavel.push(linha);
        continue;
      }

      aCriar.push({
        nome: linha.nome,
        cnpj: linha.cnpj,
        regimeTributario: regimeMapeado.regime,
        particularidades: regimeMapeado.particularidades,
        responsavelId,
      });
    }

    // Linhas MEI que passaram (nao puladas, responsavel resolvido).
    // Contar apenas as que estao em aCriar (ja que linhasMei e populado antes
    // da checagem de responsavel — mas na pratica o conteo acima ja e apos
    // a checagem de duplicata, entao linhasMei pode conter linhas depois
    // puladas por responsavel nao resolvido).
    // Recalcular a partir de aCriar para precisao:
    const meiACriar = aCriar.filter((r) => r.particularidades === "MEI");

    // 7. Relatorio DRY-RUN / APPLY.
    console.log("\n===== RELATORIO =====");
    console.log(`\nLinhas validas na planilha: ${linhasValidas.length}`);
    console.log(`A criar (novas):            ${aCriar.length}`);
    console.log(`A pular (CNPJ duplicado):   ${puladas.length}`);
    console.log(`Linhas MEI (a criar):       ${meiACriar.length}`);
    console.log(`Responsaveis nao resolvidos: ${semResponsavel.length}`);
    console.log(`Regimes nao mapeaveis:       ${semRegime.length}`);

    if (meiACriar.length > 0) {
      console.log("\n-- Linhas MEI a criar --");
      for (const r of meiACriar) {
        console.log(`  ${r.cnpj}  ${r.nome}`);
      }
    }

    if (semResponsavel.length > 0) {
      console.log("\n-- Responsaveis NAO resolvidos (empresa NAO sera criada) --");
      for (const l of semResponsavel) {
        console.log(`  CNPJ ${l.cnpj} -- responsavel planilha: "${l.responsavelNome}"`);
      }
    }

    if (semRegime.length > 0) {
      console.log("\n-- Regimes NAO mapeaveis (empresa NAO sera criada) --");
      for (const l of semRegime) {
        console.log(`  CNPJ ${l.cnpj} -- regime planilha: "${l.regimeRotulo}"`);
      }
    }

    if (puladas.length > 0 && puladas.length <= 30) {
      console.log("\n-- CNPJs pulados (ja existem no banco) --");
      for (const l of puladas) {
        console.log(`  ${l.cnpj}  ${l.nome}`);
      }
    }

    if (!APPLY) {
      console.log("\nDRY-RUN: nenhuma empresa criada.");
      return;
    }

    // ---- Modo APPLY ----

    // Falha explicita se algum responsavel nao foi resolvido.
    if (semResponsavel.length > 0) {
      console.error(
        `\nERRO: ${semResponsavel.length} linha(s) com responsavel nao resolvido. ` +
          "Corrija os nomes no banco (ou na planilha) e rode novamente. Nenhuma empresa criada."
      );
      process.exit(1);
    }

    console.log(`\n===== APLICANDO: criando ${aCriar.length} empresa(s) =====`);

    let criadas = 0;
    let erros = 0;

    for (const dados of aCriar) {
      try {
        await db.empresa.create({
          data: {
            nome: dados.nome,
            cnpj: dados.cnpj,
            regimeTributario: dados.regimeTributario,
            responsavelId: dados.responsavelId,
            ativo: true,
            contatos: null,
            particularidades: dados.particularidades,
            regimeHistorico: {
              create: {
                regimeTributario: dados.regimeTributario,
                dataInicio: new Date(),
              },
            },
          },
        });
        criadas++;
      } catch (err) {
        erros++;
        console.error(`  ERRO ao criar ${dados.cnpj} (${dados.nome}): ${err.message}`);
      }
    }

    console.log(`\n-- Resumo da aplicacao --`);
    console.log(`  Empresas criadas:     ${criadas}`);
    console.log(`  Erros de criacao:     ${erros}`);
    console.log(`  Puladas (duplicatas): ${puladas.length}`);

    // 8. Verificacao pos-apply.
    console.log("\n===== VERIFICACAO POS-APPLY =====");

    const totalEmpresasBanco = await db.empresa.count();
    console.log(`empresa.count() total no banco: ${totalEmpresasBanco}`);

    if (totalEmpresasBanco < 197) {
      console.warn(`AVISO: total esperado >= 197, obtido ${totalEmpresasBanco}`);
    } else {
      console.log(`OK: banco tem ${totalEmpresasBanco} empresas (>= 197).`);
    }

    const porResponsavel = await db.empresa.groupBy({
      by: ["responsavelId"],
      _count: { id: true },
    });
    console.log(`\nDistribuicao por responsavel (${porResponsavel.length} responsavel(is)):`);
    // Enriquecer com nomes.
    const usuariosMap = new Map(usuarios.map((u) => [u.id, u.nome]));
    for (const grupo of porResponsavel) {
      const nome = usuariosMap.get(grupo.responsavelId) ?? grupo.responsavelId;
      console.log(`  ${nome}: ${grupo._count.id} empresa(s)`);
    }

    const porRegime = await db.empresa.groupBy({
      by: ["regimeTributario"],
      _count: { id: true },
    });
    console.log(`\nDistribuicao por regime:`);
    for (const grupo of porRegime) {
      console.log(`  ${grupo.regimeTributario}: ${grupo._count.id} empresa(s)`);
    }

    if (erros > 0) {
      console.error(`\nERRO: ${erros} empresa(s) nao foram criadas por erro no banco.`);
      process.exit(1);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
