#!/usr/bin/env node
/**
 * scripts/renomear-usuarios-neto-lauany-elisabete.mjs
 *
 * Script one-off para renomear 3 usuarios JA EXISTENTES em producao,
 * identificados por `email` (campo estavel, nunca alterado):
 *   - dono@escritorio.com.br      "Dono do Escritório" -> "Neto"
 *   - dp1@escritorio.com.br       "DP1"                -> "Lauany"
 *   - contabil1@escritorio.com.br "Contabil1"           -> "Elisabete"
 *
 * Este rename e DISTINTO do seed.ts: o loop `upsert` do seed usa
 * `update: {}`, que NUNCA retroage o campo `nome` em usuarios que ja
 * existem no banco -- por isso este script dedicado e necessario.
 *
 * Altera SOMENTE o campo `nome` -- jamais email/senhaHash/role/setor.
 *
 * Por padrao roda em modo DRY-RUN (nenhuma escrita no banco). So aplica
 * escritas quando invocado com a flag `--apply`. Verificacao obrigatoria
 * de re-consulta ao final: cada `nome` deve bater com o esperado; qualquer
 * divergencia define `process.exitCode = 1`.
 *
 * Uso:
 *   node --env-file=.env.production scripts/renomear-usuarios-neto-lauany-elisabete.mjs            (dry-run)
 *   node --env-file=.env.production scripts/renomear-usuarios-neto-lauany-elisabete.mjs --apply     (aplica)
 */

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

const RENOMEACOES = [
  { email: "dono@escritorio.com.br", nome: "Neto" },
  { email: "dp1@escritorio.com.br", nome: "Lauany" },
  { email: "contabil1@escritorio.com.br", nome: "Elisabete" },
];

async function main() {
  const db = new PrismaClient();

  try {
    const emails = RENOMEACOES.map((r) => r.email);

    const usuariosAtuais = await db.usuario.findMany({
      where: { email: { in: emails } },
      select: { id: true, nome: true, email: true },
    });

    console.log(`Modo: ${APPLY ? "APPLY (escreve no banco)" : "DRY-RUN (nenhuma escrita)"}`);
    console.log(`Usuarios encontrados (de ${RENOMEACOES.length} esperados): ${usuariosAtuais.length}`);

    for (const r of RENOMEACOES) {
      const atual = usuariosAtuais.find((u) => u.email === r.email);
      const nomeAtual = atual ? atual.nome : "(usuario nao encontrado)";
      console.log(`  ${r.email}: "${nomeAtual}" -> "${r.nome}"`);
    }

    if (!APPLY) {
      console.log("\nDRY-RUN: nenhuma alteracao aplicada. Rode com --apply para aplicar.");
      return;
    }

    console.log("\n===== APLICANDO ALTERACOES =====");

    let atualizados = 0;
    for (const r of RENOMEACOES) {
      await db.usuario.update({
        where: { email: r.email },
        data: { nome: r.nome },
      });
      atualizados += 1;
    }

    console.log(`Usuarios atualizados (nome): ${atualizados}`);

    // Verificacao obrigatoria: re-consultar e confirmar que cada nome bate com o esperado.
    const usuariosFinais = await db.usuario.findMany({
      where: { email: { in: emails } },
      select: { id: true, nome: true, email: true },
    });

    let divergencias = 0;
    for (const r of RENOMEACOES) {
      const final = usuariosFinais.find((u) => u.email === r.email);
      const nomeFinal = final ? final.nome : null;
      if (nomeFinal !== r.nome) {
        console.error(`FALHA DE VERIFICAÇÃO: ${r.email} esperado nome="${r.nome}", encontrado nome="${nomeFinal}"`);
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
