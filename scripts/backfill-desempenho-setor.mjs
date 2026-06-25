#!/usr/bin/env node
/**
 * scripts/backfill-desempenho-setor.mjs
 *
 * Verifica o backfill da coluna `DesempenhoMensal.setor` apos a migracao
 * que adicionou `setor Setor @default(FISCAL)` (Phase 08, Plan 01, Task 2).
 *
 * O `@default(FISCAL)` aplicado via `prisma db push` ja preenche qualquer
 * linha pre-existente automaticamente -- este script roda o UPDATE
 * explicito (no-op se o default ja cobriu tudo) e faz a verificacao
 * canonica: contagem de linhas setor='FISCAL' apos o backfill deve ser
 * EXATAMENTE igual a contagem total de linhas capturada antes da migracao
 * (espelha o padrao "197 FISCAL rows" da Phase 5). Falha com exit code
 * nao-zero se as contagens divergirem.
 *
 * Uso:
 *   node --env-file=.env scripts/backfill-desempenho-setor.mjs
 */

import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();

  try {
    // Contagem pre-migracao capturada manualmente antes de editar o schema
    // (Task 2, passo 1): SELECT COUNT(*) FROM desempenho_mensal = 0.
    const preMigrationCount = 0;

    await db.$executeRawUnsafe(
      `UPDATE desempenho_mensal SET setor = 'FISCAL' WHERE setor IS NULL`
    );

    const totalFiscal = await db.desempenhoMensal.count({ where: { setor: "FISCAL" } });
    const totalRows = await db.desempenhoMensal.count();

    console.log(`Contagem pre-migracao (desempenho_mensal):     ${preMigrationCount}`);
    console.log(`Contagem total pos-backfill:                   ${totalRows}`);
    console.log(`Linhas com setor='FISCAL' pos-backfill:        ${totalFiscal}`);

    if (totalFiscal !== preMigrationCount || totalRows !== preMigrationCount) {
      console.error(
        `FALHA DE VERIFICAÇÃO: esperado ${preMigrationCount} linhas FISCAL, encontrado ${totalFiscal} (total: ${totalRows})`
      );
      process.exitCode = 1;
      return;
    }

    console.log("\n-- Resumo do backfill --");
    console.log(`  Contagem pre-migracao:                  ${preMigrationCount}`);
    console.log(`  Linhas FISCAL pos-backfill:              ${totalFiscal}`);
    console.log(`  Verificacao de contagem:                OK (${totalFiscal} === ${preMigrationCount})`);
  } finally {
    await db.$disconnect();
  }
}

main();
