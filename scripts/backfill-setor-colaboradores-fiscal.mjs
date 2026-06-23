#!/usr/bin/env node
/**
 * scripts/backfill-setor-colaboradores-fiscal.mjs
 *
 * Script one-off para definir `setor=FISCAL` nos 4 colaboradores Fiscais
 * JA EXISTENTES (Caio/Jessica/Heitor/Felipe, emails colaborador1-4@...),
 * que predatam a coluna `Usuario.setor` adicionada nesta fase.
 *
 * Este backfill e DISTINTO do seed.ts: o loop `upsert` do seed usa
 * `update: {}`, que NUNCA retroage o campo `setor` em usuarios que ja
 * existem no banco -- por isso este script dedicado e necessario.
 *
 * CRITICO (Pitfall RESEARCH.md): sem este backfill, os 4 colaboradores
 * Fiscais reais (em producao) cairiam no branch fail-safe de
 * withVisibilityScope (Plan 02) e veriam ZERO empresas -- regressao
 * critica do Fiscal em producao.
 *
 * Por padrao roda em modo DRY-RUN (nenhuma escrita no banco). So aplica
 * escritas quando invocado com a flag `--apply`. Verificacao obrigatoria
 * de contagem ao final: nenhum usuario com role=COLABORADOR deve ficar
 * com setor=null; qualquer divergencia define `process.exitCode = 1`.
 *
 * Uso:
 *   node --env-file=.env scripts/backfill-setor-colaboradores-fiscal.mjs            (dry-run)
 *   node --env-file=.env scripts/backfill-setor-colaboradores-fiscal.mjs --apply     (aplica)
 */

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

const EMAILS_FISCAL_EXISTENTES = [
  "colaborador1@escritorio.com.br",
  "colaborador2@escritorio.com.br",
  "colaborador3@escritorio.com.br",
  "colaborador4@escritorio.com.br",
];

async function main() {
  const db = new PrismaClient();

  try {
    const colaboradoresFiscais = await db.usuario.findMany({
      where: { email: { in: EMAILS_FISCAL_EXISTENTES } },
      select: { id: true, nome: true, email: true, setor: true },
    });

    console.log(`Modo: ${APPLY ? "APPLY (escreve no banco)" : "DRY-RUN (nenhuma escrita)"}`);
    console.log(`Colaboradores Fiscais encontrados (de ${EMAILS_FISCAL_EXISTENTES.length} esperados): ${colaboradoresFiscais.length}`);
    for (const c of colaboradoresFiscais) {
      console.log(`  ${c.email}: "${c.nome}" -- setor atual: ${c.setor ?? "null"}`);
    }

    if (!APPLY) {
      console.log("\nDRY-RUN: nenhuma alteracao aplicada. Rode com --apply para aplicar.");
      return;
    }

    console.log("\n===== APLICANDO ALTERACOES =====");

    const resultado = await db.usuario.updateMany({
      where: { email: { in: EMAILS_FISCAL_EXISTENTES } },
      data: { setor: "FISCAL" },
    });

    console.log(`Usuarios atualizados (setor=FISCAL): ${resultado.count}`);

    // Verificacao obrigatoria: nenhum COLABORADOR deve ficar com setor null.
    const semSetor = await db.usuario.count({ where: { role: "COLABORADOR", setor: null } });
    console.log(`Colaboradores sem setor definido (role=COLABORADOR, setor=null): ${semSetor}`);

    if (semSetor !== 0) {
      console.error(`FALHA DE VERIFICAÇÃO: esperado 0 colaboradores sem setor, encontrado ${semSetor}`);
      process.exitCode = 1;
      return;
    }

    console.log("\n-- Resumo da aplicacao --");
    console.log(`  Usuarios atualizados:                       ${resultado.count}`);
    console.log(`  Colaboradores sem setor (verificacao):       ${semSetor}`);
    console.log(`  Verificacao:                                 OK (0 sem setor)`);
  } finally {
    await db.$disconnect();
  }
}

main();
