#!/usr/bin/env node
/**
 * scripts/promover-chefes-setor.mjs
 *
 * Script one-off para promover 3 usuarios JA EXISTENTES em producao,
 * identificados por `email` (campo estavel, nunca alterado), de
 * `role: COLABORADOR` para `role: CHEFE_SETOR`:
 *   - colaborador1@escritorio.com.br (Caio, setor FISCAL)
 *   - dp1@escritorio.com.br          (Lauany, setor DP)
 *   - contabil1@escritorio.com.br    (Elisabete, setor CONTABIL)
 *
 * Altera SOMENTE o campo de papel (role) -- jamais os demais campos do
 * usuario (nome de exibicao, email, hash de senha, setor de atuacao).
 *
 * Por padrao roda em modo DRY-RUN (nenhuma escrita no banco). So aplica
 * escritas quando invocado com a flag `--apply`. Verificacao obrigatoria
 * de re-consulta ao final: cada `role` deve bater com o esperado; qualquer
 * divergencia define `process.exitCode = 1`.
 *
 * Uso:
 *   node --env-file=.env.production scripts/promover-chefes-setor.mjs            (dry-run)
 *   node --env-file=.env.production scripts/promover-chefes-setor.mjs --apply     (aplica)
 */

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

const PROMOCOES = [
  { email: "colaborador1@escritorio.com.br", role: "CHEFE_SETOR" },
  { email: "dp1@escritorio.com.br", role: "CHEFE_SETOR" },
  { email: "contabil1@escritorio.com.br", role: "CHEFE_SETOR" },
];

async function main() {
  const db = new PrismaClient();

  try {
    const emails = PROMOCOES.map((p) => p.email);

    const usuariosAtuais = await db.usuario.findMany({
      where: { email: { in: emails } },
      select: { id: true, role: true, email: true },
    });

    console.log(`Modo: ${APPLY ? "APPLY (escreve no banco)" : "DRY-RUN (nenhuma escrita)"}`);
    console.log(`Usuarios encontrados (de ${PROMOCOES.length} esperados): ${usuariosAtuais.length}`);

    for (const p of PROMOCOES) {
      const atual = usuariosAtuais.find((u) => u.email === p.email);
      const roleAtual = atual ? atual.role : "(usuario nao encontrado)";
      console.log(`  ${p.email}: "${roleAtual}" -> "${p.role}"`);
    }

    if (!APPLY) {
      console.log("\nDRY-RUN: nenhuma alteracao aplicada. Rode com --apply para aplicar.");
      return;
    }

    console.log("\n===== APLICANDO ALTERACOES =====");

    let atualizados = 0;
    for (const p of PROMOCOES) {
      await db.usuario.update({
        where: { email: p.email },
        data: { role: p.role },
      });
      atualizados += 1;
    }

    console.log(`Usuarios atualizados (role): ${atualizados}`);

    // Verificacao obrigatoria: re-consultar e confirmar que cada role bate com o esperado.
    const usuariosFinais = await db.usuario.findMany({
      where: { email: { in: emails } },
      select: { id: true, role: true, email: true },
    });

    let divergencias = 0;
    for (const p of PROMOCOES) {
      const final = usuariosFinais.find((u) => u.email === p.email);
      const roleFinal = final ? final.role : null;
      if (roleFinal !== p.role) {
        console.error(`FALHA DE VERIFICAÇÃO: ${p.email} esperado role="${p.role}", encontrado role="${roleFinal}"`);
        divergencias += 1;
      }
    }

    console.log("\n-- Resumo da aplicacao --");
    console.log(`  Usuarios atualizados:     ${atualizados}`);
    console.log(`  Divergencias (verificacao): ${divergencias}`);
    console.log(`  Verificacao:               ${divergencias === 0 ? "OK" : "FALHOU"}`);

    if (divergencias !== 0) {
      process.exitCode = 1;
    }
  } finally {
    await db.$disconnect();
  }
}

main();
