#!/usr/bin/env node
/**
 * scripts/atualizar-responsaveis.mjs
 *
 * Script one-off para:
 * 1. Renomear os 4 usuarios colaborador1-4@escritorio.com.br para
 *    Caio/Jessica/Heitor/Felipe (email e senhaHash inalterados).
 * 2. Atualizar Empresa.responsavelId de ~197 empresas a partir da planilha
 *    `data/EMPRESAS RESPONSÁVEL.xlsx`, casando por CNPJ normalizado para
 *    digitos (em ambos os lados).
 *
 * Por padrao roda em modo DRY-RUN (nenhuma escrita no banco). So aplica
 * escritas quando invocado com a flag `--apply`.
 *
 * NAO altera regimeTributario de nenhuma empresa -- apenas REPORTA contagem
 * de linhas "MEI" e linhas com regime divergente do ja salvo.
 *
 * Uso:
 *   node --env-file=.env scripts/atualizar-responsaveis.mjs            (dry-run)
 *   node --env-file=.env scripts/atualizar-responsaveis.mjs --apply     (aplica)
 */

import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLANILHA_PATH = path.resolve(__dirname, "..", "data", "EMPRESAS RESPONSÁVEL.xlsx");

const APPLY = process.argv.includes("--apply");

/** Normaliza para apenas digitos (usado em ambos os lados: planilha e banco). */
function soDigitos(s) {
  return String(s ?? "").replace(/\D/g, "");
}

/** Normaliza rotulo de regime tributario da planilha p/ comparacao tolerante. */
function normalizarRegimePlanilha(rotulo) {
  const r = String(rotulo ?? "").trim().toLowerCase();
  if (r === "lucro real") return "LUCRO_REAL";
  if (r === "simples nacional") return "SIMPLES_NACIONAL";
  if (r === "lucro presumido") return "LUCRO_PRESUMIDO";
  // "MEI" ou qualquer outro rotulo desconhecido -- nao existe enum
  // correspondente em RegimeTributario, conta como divergente.
  return null;
}

// Mapeamento de rename (DECISAO JA TOMADA): email -> novo nome.
const RENAME_POR_EMAIL = {
  "colaborador1@escritorio.com.br": "Caio",
  "colaborador2@escritorio.com.br": "Jessica",
  "colaborador3@escritorio.com.br": "Heitor",
  "colaborador4@escritorio.com.br": "Felipe",
};

async function main() {
  // 1. Ler planilha "EMPRESAS RESPONSÁVEL.xlsx", primeira aba.
  const buffer = readFileSync(PLANILHA_PATH);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

  // Colunas (0-based): 0=Codigo, 1=Empresa, 2=CNPJ, 3=Regime Tributario, 4=Responsavel.
  // Pular linha 0 (titulo) e linha 1 (cabecalho). Linha VALIDA: CNPJ (indice 2)
  // nao vazio apos trim -- descarta automaticamente as linhas de rodape de
  // totais por regime (CNPJ vazio).
  const linhasValidas = [];
  for (let i = 2; i < matriz.length; i++) {
    const linha = matriz[i];
    const cnpj = String(linha[2] ?? "").trim();
    if (!cnpj) continue;
    linhasValidas.push({
      codigo: String(linha[0] ?? "").trim(),
      empresaNome: String(linha[1] ?? "").trim(),
      cnpj,
      cnpjDigitos: soDigitos(cnpj),
      regimePlanilha: String(linha[3] ?? "").trim(),
      responsavelPlanilha: String(linha[4] ?? "").trim(),
    });
  }

  console.log(`Modo: ${APPLY ? "APPLY (escreve no banco)" : "DRY-RUN (nenhuma escrita)"}`);
  console.log(`Linhas validas na planilha (CNPJ nao vazio): ${linhasValidas.length}`);

  const db = new PrismaClient();

  try {
    // 3. Carregar usuarios e empresas do banco.
    const usuarios = await db.usuario.findMany({
      select: { id: true, nome: true, email: true },
    });
    const empresas = await db.empresa.findMany({
      select: { id: true, nome: true, cnpj: true, regimeTributario: true, responsavelId: true },
    });

    console.log(`Usuarios no banco: ${usuarios.length}`);
    console.log(`Empresas no banco: ${empresas.length}`);

    // 4. Construir mapa de rename pelo EMAIL -> resolver id de cada colaborador.
    const renameAplicar = []; // { usuarioId, emailAtual, nomeAtual, nomeNovo }
    for (const [email, nomeNovo] of Object.entries(RENAME_POR_EMAIL)) {
      const usuario = usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!usuario) {
        console.warn(`AVISO: usuario com email "${email}" nao encontrado no banco -- pulando rename.`);
        continue;
      }
      renameAplicar.push({
        usuarioId: usuario.id,
        emailAtual: usuario.email,
        nomeAtual: usuario.nome,
        nomeNovo,
      });
    }

    // Indice nome-pos-rename -> usuarioId (case-insensitive + trim).
    // Inclui TODOS os usuarios (com o nome JA renomeado para os 4 colaboradores,
    // e o nome atual para os demais, ex.: Dono), para mapear a coluna
    // "Responsavel" da planilha mesmo se ela citar outros nomes.
    const nomeParaUsuarioId = new Map();
    for (const usuario of usuarios) {
      const renameInfo = renameAplicar.find((r) => r.usuarioId === usuario.id);
      const nomeEfetivo = renameInfo ? renameInfo.nomeNovo : usuario.nome;
      nomeParaUsuarioId.set(nomeEfetivo.trim().toLowerCase(), usuario.id);
    }

    // 5. Indexar empresas do banco por CNPJ-digitos.
    const empresaPorCnpjDigitos = new Map();
    for (const empresa of empresas) {
      empresaPorCnpjDigitos.set(soDigitos(empresa.cnpj), empresa);
    }

    const matches = []; // { linha, empresa, usuarioIdAlvo }
    const naoMatches = []; // linhas sem empresa correspondente no banco
    const responsavelNaoResolvido = []; // linhas cujo nome de Responsavel nao bate com nenhum usuario

    for (const linha of linhasValidas) {
      const empresa = empresaPorCnpjDigitos.get(linha.cnpjDigitos);
      if (!empresa) {
        naoMatches.push(linha);
        continue;
      }

      const usuarioIdAlvo = nomeParaUsuarioId.get(linha.responsavelPlanilha.trim().toLowerCase());
      if (!usuarioIdAlvo) {
        responsavelNaoResolvido.push(linha);
        continue;
      }

      matches.push({ linha, empresa, usuarioIdAlvo });
    }

    const aAlterar = matches.filter((m) => m.empresa.responsavelId !== m.usuarioIdAlvo);
    const jaCorretos = matches.filter((m) => m.empresa.responsavelId === m.usuarioIdAlvo);

    // 6. Relatorio de regime (apenas REPORTAR, nunca alterar).
    const linhasMei = linhasValidas.filter(
      (l) => l.regimePlanilha.trim().toLowerCase() === "mei"
    );

    const divergentes = [];
    for (const { linha, empresa } of matches) {
      const regimeNormalizado = normalizarRegimePlanilha(linha.regimePlanilha);
      // "MEI" ou rotulo desconhecido conta como divergente.
      if (regimeNormalizado === null || regimeNormalizado !== empresa.regimeTributario) {
        divergentes.push({ linha, empresa, regimeNormalizado });
      }
    }

    // Empresas no banco nao cobertas pela planilha (CNPJ do banco sem linha
    // correspondente na planilha).
    const cnpjsPlanilha = new Set(linhasValidas.map((l) => l.cnpjDigitos));
    const empresasNaoCobertas = empresas.filter((e) => !cnpjsPlanilha.has(soDigitos(e.cnpj)));

    // 7. Imprimir relatorio completo.
    console.log("\n===== RELATORIO =====");

    console.log("\n-- Rename de usuarios --");
    for (const r of renameAplicar) {
      const status = r.nomeAtual === r.nomeNovo ? "(ja correto)" : `-> "${r.nomeNovo}"`;
      console.log(`  ${r.emailAtual}: "${r.nomeAtual}" ${status}`);
    }

    console.log("\n-- Matches por CNPJ --");
    console.log(`  Total de linhas validas na planilha: ${linhasValidas.length}`);
    console.log(`  Casaram por CNPJ:                    ${matches.length}`);
    console.log(`  Sem empresa correspondente no banco: ${naoMatches.length}`);
    console.log(`  Responsavel nao resolvido p/ usuario: ${responsavelNaoResolvido.length}`);

    console.log("\n-- responsavelId --");
    console.log(`  A alterar:    ${aAlterar.length}`);
    console.log(`  Ja corretos:  ${jaCorretos.length}`);

    if (naoMatches.length > 0) {
      console.log("\n-- CNPJs da planilha sem match no banco --");
      for (const l of naoMatches) {
        console.log(`  ${l.cnpj} (${l.cnpjDigitos}) -- ${l.empresaNome}`);
      }
    }

    if (responsavelNaoResolvido.length > 0) {
      console.log("\n-- Linhas com 'Responsavel' nao resolvido para usuario --");
      for (const l of responsavelNaoResolvido) {
        console.log(`  CNPJ ${l.cnpj} -- responsavel planilha: "${l.responsavelPlanilha}"`);
      }
    }

    console.log("\n-- Empresas no banco NAO cobertas pela planilha --");
    console.log(`  Total: ${empresasNaoCobertas.length}`);
    if (empresasNaoCobertas.length > 0 && empresasNaoCobertas.length <= 20) {
      for (const e of empresasNaoCobertas) {
        console.log(`  ${e.cnpj} -- ${e.nome}`);
      }
    }

    console.log("\n-- Relatorio MEI / regime divergente (apenas informativo) --");
    console.log(`  Linhas com Regime Tributario == "MEI": ${linhasMei.length}`);
    console.log(`  Linhas casadas com regime divergente do salvo: ${divergentes.length}`);
    if (divergentes.length > 0 && divergentes.length <= 20) {
      for (const d of divergentes) {
        console.log(
          `  CNPJ ${d.linha.cnpj} -- planilha="${d.linha.regimePlanilha}" (-> ${d.regimeNormalizado ?? "DESCONHECIDO"}), banco="${d.empresa.regimeTributario}"`
        );
      }
    }

    if (!APPLY) {
      console.log("\nDRY-RUN: nenhuma alteracao aplicada. Rode com --apply para aplicar.");
      return;
    }

    // ---- Modo APPLY: executar as escritas ----
    console.log("\n===== APLICANDO ALTERACOES =====");

    let usuariosRenomeados = 0;
    for (const r of renameAplicar) {
      if (r.nomeAtual === r.nomeNovo) continue;
      await db.usuario.update({
        where: { id: r.usuarioId },
        data: { nome: r.nomeNovo },
      });
      usuariosRenomeados++;
      console.log(`  Usuario ${r.emailAtual}: "${r.nomeAtual}" -> "${r.nomeNovo}"`);
    }

    let empresasAtualizadas = 0;
    for (const m of aAlterar) {
      await db.empresa.update({
        where: { id: m.empresa.id },
        data: { responsavelId: m.usuarioIdAlvo },
      });
      empresasAtualizadas++;
    }

    console.log("\n-- Resumo da aplicacao --");
    console.log(`  Usuarios renomeados:                  ${usuariosRenomeados}`);
    console.log(`  Empresas com responsavelId atualizado: ${empresasAtualizadas}`);
    console.log(`  Empresas ja corretas (sem update):     ${jaCorretos.length}`);
    console.log(`  CNPJs da planilha sem match:           ${naoMatches.length}`);
    console.log(`  Empresas no banco nao cobertas:        ${empresasNaoCobertas.length}`);
    console.log(`  Linhas "MEI" (apenas relatorio):        ${linhasMei.length}`);
    console.log(`  Linhas com regime divergente (relatorio): ${divergentes.length}`);
  } finally {
    await db.$disconnect();
  }
}

main();
