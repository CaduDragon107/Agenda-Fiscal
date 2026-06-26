#!/usr/bin/env node
/**
 * scripts/renomear-usuarios-andre-mirella-lorraine-rany-sarah.mjs
 *
 * Script one-off para renomear 5 usuarios JA EXISTENTES em producao,
 * identificados por `email` (campo estavel, nunca alterado):
 *   - dp2@escritorio.com.br       "DP2"       -> "Andre"
 *   - dp3@escritorio.com.br       "DP3"       -> "Mirella"
 *   - dp4@escritorio.com.br       "DP4"       -> "Lorraine"
 *   - contabil2@escritorio.com.br "Contabil2" -> "Rany"
 *   - contabil3@escritorio.com.br "Contabil3" -> "Sarah"
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
 *   node --env-file=.env.production scripts/renomear-usuarios-andre-mirella-lorraine-rany-sarah.mjs            (dry-run)
 *   node --env-file=.env.production scripts/renomear-usuarios-andre-mirella-lorraine-rany-sarah.mjs --apply     (aplica)
 */

import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

const RENOMEACOES = [
  { email: "dp2@escritorio.com.br", nome: "Andre" },
  { email: "dp3@escritorio.com.br", nome: "Mirella" },
  { email: "dp4@escritorio.com.br", nome: "Lorraine" },
  { email: "contabil2@escritorio.com.br", nome: "Rany" },
  { email: "contabil3@escritorio.com.br", nome: "Sarah" },
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
