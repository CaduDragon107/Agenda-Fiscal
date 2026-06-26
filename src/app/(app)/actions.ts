"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { empresaSchema } from "@/modules/empresas/schema";
import { withVisibilityScope } from "@/lib/visibility-scope";

/**
 * Server Actions CRUD de Empresa (EMPR-01).
 *
 * CRITICAL (AUTH-02 / T-01-CSRF / T-01-INPUT-CRUD):
 * - Toda action começa com o guard de sessão `auth()` — "Não autenticado" se
 *   ausente.
 * - `editarEmpresa`/`excluirEmpresa` fazem
 *   `db.empresa.findFirst({ where: { id, ...withVisibilityScope(user) } })`
 *   ANTES de qualquer update/delete. Se `null`, retorna "não encontrado"
 *   (nunca "403 proibido" — não vazar existência do registro a colaboradores
 *   sem escopo, ver tests/empresas.idor.test.ts).
 * - `empresaSchema.parse` valida o payload (CNPJ módulo 11 + enum de regime)
 *   antes de qualquer escrita.
 *
 * v2.0 (Plano 05-03, SETOR-01/SETOR-03/EMPR-03):
 * - `criarEmpresa`/`editarEmpresa` agora gravam Empresa + até 3 linhas
 *   `EmpresaResponsavelSetor` (FISCAL sempre; DP/CONTABIL apenas se
 *   informado) numa ÚNICA transação (`db.$transaction`) — nunca como
 *   escritas independentes, evitando partial-write (T-05-12).
 * - Guard DONO-only (D-02, CRÍTICO, server-side — não apenas `disabled` na
 *   UI, ver T-05-10): SOMENTE `session.user.role === "DONO"` pode alterar
 *   os 3 campos de responsável. Um COLABORADOR submetendo
 *   `responsavelFiscalId`/`responsavelDpId`/`responsavelContabilId` via
 *   chamada direta da Server Action tem esses campos silenciosamente
 *   ignorados (substituídos pelos valores atuais do banco em
 *   `editarEmpresa`, ou `null`/rejeitados em `criarEmpresa`) — o resto do
 *   payload (nome/contatos/particularidades/temFuncionariosClt) continua
 *   sendo aplicado normalmente.
 * - Lockstep (T-05-12): `Empresa.responsavelId` (coluna legada, RESEARCH.md
 *   Pitfall B1) é SEMPRE escrito igual a `responsavelFiscalId`, na MESMA
 *   transação que grava a linha FISCAL do junction — garante zero drift
 *   entre a coluna legada e a junction table até a Fase 6 repontar o motor.
 */

export type AcaoEmpresaResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function dadosFormulario(formData: FormData) {
  return {
    nome: formData.get("nome"),
    cnpj: formData.get("cnpj"),
    regimeTributario: formData.get("regimeTributario"),
    responsavelFiscalId: formData.get("responsavelFiscalId"),
    responsavelDpId: formData.get("responsavelDpId") || null,
    responsavelContabilId: formData.get("responsavelContabilId") || null,
    temFuncionariosClt: formData.get("temFuncionariosClt") === "true",
    temEmpregadaDomestica: formData.get("temEmpregadaDomestica") === "true",
    contatos: formData.get("contatos"),
    particularidades: formData.get("particularidades"),
  };
}

/**
 * Upserta (cria ou atualiza) as linhas `EmpresaResponsavelSetor` para uma
 * empresa, dentro de uma transação (`tx`) já aberta pelo chamador.
 *
 * FISCAL é SEMPRE upsertada (responsável Fiscal é obrigatório, D-01/D-02).
 * DP/CONTABIL são upsertadas APENAS se o respectivo id não for null —
 * preserva o comportamento "sem responsável" (D-01: 197 empresas existentes
 * começam sem DP/Contábil atribuído) sem criar uma linha junction vazia.
 *
 * `tx: Prisma.TransactionClient` — mesmo tipo usado por
 * `calcularSnapshotMensal` (src/modules/dashboards/snapshot.ts), consistente
 * com a convenção já estabelecida neste codebase para funções que recebem
 * um client de transação já aberto pelo chamador.
 */
async function upsertResponsaveisPorSetor(
  tx: Prisma.TransactionClient,
  empresaId: string,
  responsaveis: {
    fiscalId: string;
    dpId: string | null;
    contabilId: string | null;
  }
) {
  await tx.empresaResponsavelSetor.upsert({
    where: { empresaId_setor: { empresaId, setor: "FISCAL" } },
    create: { empresaId, setor: "FISCAL", usuarioId: responsaveis.fiscalId },
    update: { usuarioId: responsaveis.fiscalId },
  });

  if (responsaveis.dpId) {
    await tx.empresaResponsavelSetor.upsert({
      where: { empresaId_setor: { empresaId, setor: "DP" } },
      create: { empresaId, setor: "DP", usuarioId: responsaveis.dpId },
      update: { usuarioId: responsaveis.dpId },
    });
  }

  if (responsaveis.contabilId) {
    await tx.empresaResponsavelSetor.upsert({
      where: { empresaId_setor: { empresaId, setor: "CONTABIL" } },
      create: { empresaId, setor: "CONTABIL", usuarioId: responsaveis.contabilId },
      update: { usuarioId: responsaveis.contabilId },
    });
  }
}

/**
 * Cria uma nova empresa e grava a primeira entrada de
 * EmpresaRegimeHistorico (regime atual, dataInicio = agora) — mantém o
 * histórico de regime coerente desde o v1.
 *
 * v2.0 (D-02, T-05-10): SOMENTE DONO pode definir responsavelDpId/
 * responsavelContabilId na criação. Um COLABORADOR criando uma empresa tem
 * esses 2 campos forçados a `null` (sem responsável DP/Contábil atribuído na
 * criação, consistente com D-01) — não há "valor atual" para re-mesclar
 * numa criação nova. `responsavelFiscalId` permanece obrigatório
 * (empresaSchema) e não é restrito por este guard (toda empresa precisa de
 * um responsável Fiscal desde a criação, igual ao comportamento pré-v2.0).
 *
 * v2.0 (T-05-12): grava Empresa + linha(s) EmpresaResponsavelSetor numa
 * única transação; `responsavelId` legado escrito em lockstep com
 * `responsavelFiscalId`.
 */
export async function criarEmpresa(
  formData: FormData
): Promise<AcaoEmpresaResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Não autenticado" };
  }

  const parsed = empresaSchema.safeParse(dadosFormulario(formData));
  if (!parsed.success) {
    return { ok: false, error: "Não foi possível salvar. Verifique os dados e tente novamente." };
  }

  const dados = parsed.data;

  // Guard DONO-only (D-02, T-05-10): COLABORADOR não pode atribuir
  // responsável DP/Contábil já na criação.
  const responsavelDpId = session.user.role === "DONO" ? dados.responsavelDpId ?? null : null;
  const responsavelContabilId =
    session.user.role === "DONO" ? dados.responsavelContabilId ?? null : null;

  const empresa = await db.$transaction(async (tx) => {
    const criada = await tx.empresa.create({
      data: {
        nome: dados.nome,
        cnpj: dados.cnpj,
        regimeTributario: dados.regimeTributario,
        // Lockstep (T-05-12): responsavelId legado SEMPRE igual a
        // responsavelFiscalId, gravado na mesma transação da linha FISCAL.
        responsavelId: dados.responsavelFiscalId,
        temFuncionariosClt: dados.temFuncionariosClt,
        temEmpregadaDomestica: dados.temEmpregadaDomestica,
        contatos: dados.contatos,
        particularidades: dados.particularidades,
        regimeHistorico: {
          create: {
            regimeTributario: dados.regimeTributario,
            dataInicio: new Date(),
          },
        },
      },
    });

    await upsertResponsaveisPorSetor(tx, criada.id, {
      fiscalId: dados.responsavelFiscalId,
      dpId: responsavelDpId,
      contabilId: responsavelContabilId,
    });

    return criada;
  });

  revalidatePath("/empresas");
  return { ok: true, id: empresa.id };
}

/**
 * Edita uma empresa existente.
 *
 * Anti-IDOR (T-01-IDOR-MUT): faz findFirst escopado por
 * withVisibilityScope(session.user) ANTES do update. Se a empresa não existir
 * OU estiver fora do escopo do usuário, retorna "não encontrado" sem alterar
 * nada — nunca um erro de permissão (403), que vazaria a existência do
 * registro.
 *
 * v2.0 (D-02, T-05-10, CRÍTICO): SOMENTE DONO pode alterar os 3 campos de
 * responsável. Se `session.user.role !== "DONO"`, os 3 valores submetidos
 * (responsavelFiscalId/DpId/ContabilId) são IGNORADOS e re-mesclados com os
 * valores atuais já gravados na junction table (`existente.responsaveisPorSetor`)
 * — o restante do payload (nome/contatos/particularidades/temFuncionariosClt)
 * continua sendo aplicado normalmente. Isto é uma checagem server-side real,
 * não apenas um `disabled` na UI (mirror de T-01-IDOR-MUT) — um COLABORADOR
 * chamando esta action diretamente com um responsavelDpId arbitrário NÃO
 * consegue alterar o responsável DP de uma empresa.
 *
 * v2.0 (T-05-12): Empresa.update + upsert(s) de EmpresaResponsavelSetor numa
 * única transação (sem partial-write); `responsavelId` legado em lockstep
 * com `responsavelFiscalId`.
 */
export async function editarEmpresa(
  id: string,
  formData: FormData
): Promise<AcaoEmpresaResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Não autenticado" };
  }

  const existente = await db.empresa.findFirst({
    where: { id, ...withVisibilityScope(session.user) },
    select: {
      id: true,
      // Fallback de segurança para o guard DONO-only abaixo: responsavelId
      // (coluna legada, NUNCA null) garante que responsavelFiscalId efetivo
      // sempre resolve para um `string`, mesmo no caso defensivo em que a
      // linha FISCAL do junction esteja ausente (não deveria ocorrer dado o
      // backfill 197/197 verificado no Plano 05-01, mas a coluna nunca é
      // null então este fallback nunca degrada para "sem responsável").
      responsavelId: true,
      responsaveisPorSetor: {
        select: { setor: true, usuarioId: true },
      },
    },
  });
  if (!existente) {
    return { ok: false, error: "não encontrado" };
  }

  const parsed = empresaSchema.safeParse(dadosFormulario(formData));
  if (!parsed.success) {
    return { ok: false, error: "Não foi possível salvar. Verifique os dados e tente novamente." };
  }

  const dados = parsed.data;

  const setorAtual = (setor: "FISCAL" | "DP" | "CONTABIL") =>
    existente.responsaveisPorSetor.find((r) => r.setor === setor)?.usuarioId ?? null;

  // Guard DONO-only (D-02, T-05-10, CRÍTICO — server-side, não apenas
  // `disabled` na UI): COLABORADOR não pode alterar os 3 responsáveis;
  // valores submetidos são descartados e substituídos pelos valores atuais.
  const isDono = session.user.role === "DONO";
  const responsavelFiscalId = isDono
    ? dados.responsavelFiscalId
    : setorAtual("FISCAL") ?? existente.responsavelId;
  const responsavelDpId = isDono ? dados.responsavelDpId ?? null : setorAtual("DP");
  const responsavelContabilId = isDono
    ? dados.responsavelContabilId ?? null
    : setorAtual("CONTABIL");

  await db.$transaction(async (tx) => {
    await tx.empresa.update({
      where: { id },
      data: {
        nome: dados.nome,
        cnpj: dados.cnpj,
        regimeTributario: dados.regimeTributario,
        // Lockstep (T-05-12): responsavelId legado SEMPRE igual ao
        // responsavelFiscalId efetivo (já passado pelo guard DONO-only).
        responsavelId: responsavelFiscalId,
        temFuncionariosClt: dados.temFuncionariosClt,
        temEmpregadaDomestica: dados.temEmpregadaDomestica,
        contatos: dados.contatos,
        particularidades: dados.particularidades,
      },
    });

    await upsertResponsaveisPorSetor(tx, id, {
      fiscalId: responsavelFiscalId,
      dpId: responsavelDpId,
      contabilId: responsavelContabilId,
    });
  });

  revalidatePath("/empresas");
  return { ok: true, id };
}

/**
 * Exclui uma empresa existente.
 *
 * Anti-IDOR (T-01-IDOR-MUT): mesmo padrão de `editarEmpresa` — findFirst
 * escopado antes do delete; "não encontrado" (não 403) se fora do escopo.
 */
export async function excluirEmpresa(id: string): Promise<AcaoEmpresaResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Não autenticado" };
  }

  const existente = await db.empresa.findFirst({
    where: { id, ...withVisibilityScope(session.user) },
    select: { id: true },
  });
  if (!existente) {
    return { ok: false, error: "não encontrado" };
  }

  await db.empresa.delete({ where: { id } });

  revalidatePath("/empresas");
  return { ok: true, id };
}
