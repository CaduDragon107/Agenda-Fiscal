#!/usr/bin/env node
/**
 * scripts/backfill-empresa-responsavel-setor-dp.mjs
 *
 * Script one-off para popular a tabela de juncao `EmpresaResponsavelSetor`
 * com linhas setor=DP, cruzando duas planilhas Excel ja existentes em
 * `data/`:
 *
 *   1. "data/EMPRESAS SEPARADAS Depto Pessoal.xlsx" (sheet "ATUALIZADA ",
 *      com espaco no final do nome) -- define qual colaborador do DP
 *      (ANDRE/LORRAINE/MIRELA/LAUANY) cuida de cada empresa, por CODIGO.
 *      O bloco SEM MOV existe na planilha mas NUNCA gera atribuicao de
 *      responsavel DP (decisao confirmada).
 *   2. "data/Lista de Empresas com CNPJ.xlsx" (primeira sheet) -- traduz
 *      CODIGO -> CNPJ, varrendo os DOIS blocos de colunas da planilha
 *      (Bloco A: cols 0/2: codigo/CNPJ; Bloco B: cols 4/6: codigo/CNPJ).
 *
 * O CNPJ resolvido e usado para localizar a `Empresa` no banco
 * (`Empresa.cnpj`, normalizado removendo nao-digitos antes de comparar).
 *
 * Mapeamento bloco -> email do colaborador DP:
 *   ANDRE    -> dp2@escritorio.com.br
 *   LORRAINE -> dp4@escritorio.com.br
 *   MIRELA   -> dp3@escritorio.com.br
 *   LAUANY   -> dp1@escritorio.com.br
 *   SEM MOV  -> (nao processado -- sem responsavel DP por decisao)
 *
 * Idempotente: usa `upsert` chaveado em `empresaId_setor` (constraint
 * `@@unique([empresaId, setor])`), seguro para re-rodar.
 *
 * Codigos nao resolvidos (ausentes na Lista de Empresas com CNPJ) e
 * empresas nao encontradas (CNPJ sem correspondencia no banco) sao
 * logados de forma informativa e pulados -- NAO sao erros fatais.
 *
 * Por padrao roda em modo DRY-RUN (nenhuma escrita no banco). So aplica
 * escritas quando invocado com a flag `--apply`. Verificacao obrigatoria
 * ao final do modo --apply: o total de linhas DP no junction table NAO
 * pode ser menor que o numero de upserts bem-sucedidos desta execucao
 * (upserts sao idempotentes, entao o total real pode ser maior por causa
 * de execucoes anteriores). Qualquer divergencia define
 * `process.exitCode = 1`.
 *
 * Uso:
 *   node --env-file=.env scripts/backfill-empresa-responsavel-setor-dp.mjs            (dry-run)
 *   node --env-file=.env scripts/backfill-empresa-responsavel-setor-dp.mjs --apply     (aplica)
 */

import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLANILHA_CODIGOS_PATH = path.resolve(__dirname, "..", "data", "Lista de Empresas com CNPJ.xlsx");
const PLANILHA_DP_PATH = path.resolve(__dirname, "..", "data", "EMPRESAS SEPARADAS Depto Pessoal.xlsx");
const SHEET_DP_NOME = "ATUALIZADA ";

const APPLY = process.argv.includes("--apply");

const BLOCOS_DP = [
  { nome: "ANDRE", colCodigo: 0, colNome: 1, email: "dp2@escritorio.com.br" },
  { nome: "LORRAINE", colCodigo: 3, colNome: 4, email: "dp4@escritorio.com.br" },
  { nome: "MIRELA", colCodigo: 6, colNome: 7, email: "dp3@escritorio.com.br" },
  { nome: "LAUANY", colCodigo: 9, colNome: 10, email: "dp1@escritorio.com.br" },
  // SEM MOV (cols 12/13) NAO entra aqui -- sem responsavel DP por decisao confirmada.
];

function normalizarCnpj(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

function construirMapaCodigoCnpj() {
  const buffer = readFileSync(PLANILHA_CODIGOS_PATH);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  const mapa = new Map();

  for (const linha of matriz) {
    // Bloco A: codigo na col 0, CNPJ na col 2.
    const codigoA = linha[0];
    const cnpjA = linha[2];
    if (typeof codigoA === "number" && cnpjA != null && String(cnpjA).trim() !== "") {
      mapa.set(codigoA, normalizarCnpj(cnpjA));
    }

    // Bloco B: codigo na col 4, CNPJ na col 6.
    const codigoB = linha[4];
    const cnpjB = linha[6];
    if (typeof codigoB === "number" && cnpjB != null && String(cnpjB).trim() !== "") {
      mapa.set(codigoB, normalizarCnpj(cnpjB));
    }
  }

  return mapa;
}

function construirAtribuicoesDp() {
  const buffer = readFileSync(PLANILHA_DP_PATH);
  const workbook = XLSX.read(buffer, { type: "buffer" });

  if (!workbook.SheetNames.includes(SHEET_DP_NOME)) {
    throw new Error(
      `Sheet "${SHEET_DP_NOME}" nao encontrada em "${PLANILHA_DP_PATH}". Sheets disponiveis: ${workbook.SheetNames.join(", ")}`
    );
  }

  const sheet = workbook.Sheets[SHEET_DP_NOME];
  const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  const atribuicoes = [];
  const contagemPorBloco = new Map(BLOCOS_DP.map((b) => [b.nome, 0]));

  for (const linha of matriz) {
    for (const bloco of BLOCOS_DP) {
      const codigo = linha[bloco.colCodigo];
      const nomeEmpresa = linha[bloco.colNome];
      if (typeof codigo === "number" && nomeEmpresa != null) {
        atribuicoes.push({ codigo, email: bloco.email, blocoNome: bloco.nome });
        contagemPorBloco.set(bloco.nome, contagemPorBloco.get(bloco.nome) + 1);
      }
    }
  }

  return { atribuicoes, contagemPorBloco };
}

async function main() {
  const db = new PrismaClient();

  try {
    console.log(`Modo: ${APPLY ? "APPLY (escreve no banco)" : "DRY-RUN (nenhuma escrita)"}`);

    // (1) Mapa codigo -> CNPJ a partir da Lista de Empresas com CNPJ.
    const mapaCodigoCnpj = construirMapaCodigoCnpj();
    console.log(`Mapa codigo->CNPJ construido com ${mapaCodigoCnpj.size} entradas.`);

    // (2) Atribuicoes DP a partir da planilha de Depto Pessoal.
    const { atribuicoes, contagemPorBloco } = construirAtribuicoesDp();
    console.log(`Atribuicoes DP encontradas (4 blocos, SEM MOV excluido): ${atribuicoes.length}`);
    for (const [nomeBloco, qtd] of contagemPorBloco) {
      console.log(`  ${nomeBloco}: ${qtd} empresas`);
    }

    // (3) Resolver CNPJ para cada atribuicao.
    let naoResolvidosCodigo = 0;
    const resolvidosPorCnpj = [];
    for (const atrib of atribuicoes) {
      const cnpj = mapaCodigoCnpj.get(atrib.codigo);
      if (!cnpj) {
        naoResolvidosCodigo++;
        console.log(`  Nao resolvido: codigo ${atrib.codigo} (bloco ${atrib.blocoNome}) nao esta na Lista de Empresas com CNPJ.`);
        continue;
      }
      resolvidosPorCnpj.push({ cnpj, email: atrib.email, blocoNome: atrib.blocoNome });
    }

    // (4) Resolver usuarioId dos 4 emails DP.
    const emailsDp = BLOCOS_DP.map((b) => b.email);
    const usuariosDp = await db.usuario.findMany({
      where: { email: { in: emailsDp } },
      select: { id: true, email: true },
    });
    const mapaEmailUsuarioId = new Map(usuariosDp.map((u) => [u.email, u.id]));

    for (const email of emailsDp) {
      if (!mapaEmailUsuarioId.has(email)) {
        console.log(`  AVISO: usuario com email "${email}" nao encontrado no banco. Atribuicoes desse bloco ficarao sem resolucao.`);
      }
    }

    // (5) Resolver Empresa por CNPJ.
    const empresas = await db.empresa.findMany({ select: { id: true, cnpj: true } });
    const mapaCnpjEmpresaId = new Map(empresas.map((e) => [normalizarCnpj(e.cnpj), e.id]));

    let empresasNaoEncontradas = 0;
    let usuariosNaoResolvidos = 0;
    const upsertsParaFazer = [];
    const contagemFinalPorEmail = new Map(emailsDp.map((e) => [e, 0]));

    for (const item of resolvidosPorCnpj) {
      const empresaId = mapaCnpjEmpresaId.get(item.cnpj);
      if (!empresaId) {
        empresasNaoEncontradas++;
        console.log(`  Empresa nao encontrada: CNPJ ${item.cnpj} (bloco ${item.blocoNome})`);
        continue;
      }

      const usuarioId = mapaEmailUsuarioId.get(item.email);
      if (!usuarioId) {
        usuariosNaoResolvidos++;
        continue;
      }

      upsertsParaFazer.push({ empresaId, usuarioId, email: item.email });
      contagemFinalPorEmail.set(item.email, contagemFinalPorEmail.get(item.email) + 1);
    }

    console.log(`\nResumo de resolucao:`);
    console.log(`  Codigos nao resolvidos (ausentes na Lista de Empresas): ${naoResolvidosCodigo}`);
    console.log(`  Empresas nao encontradas (CNPJ sem match no banco):      ${empresasNaoEncontradas}`);
    console.log(`  Atribuicoes sem usuario DP resolvido:                   ${usuariosNaoResolvidos}`);
    console.log(`  Total de upserts a fazer:                               ${upsertsParaFazer.length}`);
    console.log(`\nEmpresas por pessoa (upserts resolvidos):`);
    for (const [email, qtd] of contagemFinalPorEmail) {
      console.log(`  ${email}: ${qtd}`);
    }

    if (!APPLY) {
      console.log("\nDRY-RUN: nenhuma alteracao aplicada. Rode com --apply para aplicar.");
      return;
    }

    console.log("\n===== APLICANDO ALTERACOES =====");

    let upsertsBemSucedidos = 0;
    for (const item of upsertsParaFazer) {
      await db.empresaResponsavelSetor.upsert({
        where: { empresaId_setor: { empresaId: item.empresaId, setor: "DP" } },
        update: { usuarioId: item.usuarioId },
        create: { empresaId: item.empresaId, setor: "DP", usuarioId: item.usuarioId },
      });
      upsertsBemSucedidos++;
    }

    console.log(`Upserts DP bem-sucedidos: ${upsertsBemSucedidos}`);

    // Verificacao final: total de linhas DP no banco NAO pode ser menor
    // que o numero de upserts bem-sucedidos nesta execucao (idempotencia
    // permite total >= upsertsBemSucedidos, nunca <).
    const totalDp = await db.empresaResponsavelSetor.count({ where: { setor: "DP" } });
    console.log(`Total de linhas DP no junction table: ${totalDp}`);

    if (totalDp < upsertsBemSucedidos) {
      console.error(
        `FALHA DE VERIFICAÇÃO: total DP no banco (${totalDp}) e menor que upserts bem-sucedidos (${upsertsBemSucedidos})`
      );
      process.exitCode = 1;
      return;
    }

    console.log("\n-- Resumo da aplicacao --");
    for (const [email, qtd] of contagemFinalPorEmail) {
      console.log(`  ${email}: ${qtd} empresas`);
    }
    console.log(`  Upserts bem-sucedidos:                  ${upsertsBemSucedidos}`);
    console.log(`  Total DP no banco:                      ${totalDp}`);
    console.log(`  Verificacao de contagem:                OK (${totalDp} >= ${upsertsBemSucedidos})`);
  } finally {
    await db.$disconnect();
  }
}

main();
