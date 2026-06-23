#!/usr/bin/env node
/**
 * scripts/backfill-responsavel-setor.mjs
 *
 * Script one-off para popular a tabela de juncao `EmpresaResponsavelSetor`
 * com 1 linha setor=FISCAL por empresa, a partir do `Empresa.responsavelId`
 * atual (coluna legada, preservada sem alteracao nesta fase).
 *
 * Idempotente: usa `upsert` chaveado em `empresaId_setor` (constraint
 * `@@unique([empresaId, setor])`), seguro para re-rodar.
 *
 * NAO cria nenhuma linha DP/CONTABIL -- responsaveis DP/Contabil comecam
 * null nas 197 empresas existentes (D-01, decisao explicita desta fase:
 * nao ha atribuicao automatica/round-robin).
 *
 * Por padrao roda em modo DRY-RUN (nenhuma escrita no banco). So aplica
 * escritas quando invocado com a flag `--apply`. Verificacao obrigatoria
 * de contagem ao final: total de linhas FISCAL no junction table deve
 * ser exatamente igual ao total de empresas (197 == 197); qualquer
 * divergencia define `process.exitCode = 1`.
 *
 * Uso:
 *   node --env-file=.env scripts/backfill-responsavel-setor.mjs            (dry-run)
 *   node --env-file=.env scripts/backfill-responsavel-setor.mjs --apply     (aplica)
 */

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

async function main() {
  const db = new PrismaClient();

  try {
    const empresas = await db.empresa.findMany({
      select: { id: true, responsavelId: true },
    });

    console.log(`Modo: ${APPLY ? "APPLY (escreve no banco)" : "DRY-RUN (nenhuma escrita)"}`);
    console.log(`Empresas no banco: ${empresas.length}`);

    if (!APPLY) {
      console.log("\nDRY-RUN: nenhuma alteracao aplicada. Rode com --apply para aplicar.");
      console.log(`Seriam criadas/atualizadas ${empresas.length} linhas EmpresaResponsavelSetor (setor=FISCAL).`);
      return;
    }

    console.log("\n===== APLICANDO ALTERACOES =====");

    let processadas = 0;
    for (const empresa of empresas) {
      await db.empresaResponsavelSetor.upsert({
        where: { empresaId_setor: { empresaId: empresa.id, setor: "FISCAL" } },
        update: { usuarioId: empresa.responsavelId },
        create: { empresaId: empresa.id, setor: "FISCAL", usuarioId: empresa.responsavelId },
      });
      processadas++;
    }

    console.log(`Linhas FISCAL processadas (upsert): ${processadas}`);

    // Verificacao obrigatoria: total de linhas FISCAL == total de empresas.
    const totalFiscal = await db.empresaResponsavelSetor.count({ where: { setor: "FISCAL" } });
    console.log(`Linhas FISCAL no junction table: ${totalFiscal}`);

    if (totalFiscal !== empresas.length) {
      console.error(
        `FALHA DE VERIFICAÇÃO: esperado ${empresas.length}, encontrado ${totalFiscal}`
      );
      process.exitCode = 1;
      return;
    }

    console.log("\n-- Resumo da aplicacao --");
    console.log(`  Empresas no banco:                     ${empresas.length}`);
    console.log(`  Linhas FISCAL no junction table:       ${totalFiscal}`);
    console.log(`  Verificacao de contagem:               OK (${totalFiscal} === ${empresas.length})`);
  } finally {
    await db.$disconnect();
  }
}

main();
