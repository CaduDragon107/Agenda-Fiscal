"use server";

import { revalidatePath } from "next/cache";
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
 */

export type AcaoEmpresaResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function dadosFormulario(formData: FormData) {
  return {
    nome: formData.get("nome"),
    cnpj: formData.get("cnpj"),
    regimeTributario: formData.get("regimeTributario"),
    responsavelId: formData.get("responsavelId"),
    contatos: formData.get("contatos"),
    particularidades: formData.get("particularidades"),
  };
}

/**
 * Cria uma nova empresa e grava a primeira entrada de
 * EmpresaRegimeHistorico (regime atual, dataInicio = agora) — mantém o
 * histórico de regime coerente desde o v1.
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

  const empresa = await db.empresa.create({
    data: {
      nome: dados.nome,
      cnpj: dados.cnpj,
      regimeTributario: dados.regimeTributario,
      responsavelId: dados.responsavelId,
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
    select: { id: true },
  });
  if (!existente) {
    return { ok: false, error: "não encontrado" };
  }

  const parsed = empresaSchema.safeParse(dadosFormulario(formData));
  if (!parsed.success) {
    return { ok: false, error: "Não foi possível salvar. Verifique os dados e tente novamente." };
  }

  const dados = parsed.data;

  await db.empresa.update({
    where: { id },
    data: {
      nome: dados.nome,
      cnpj: dados.cnpj,
      regimeTributario: dados.regimeTributario,
      responsavelId: dados.responsavelId,
      contatos: dados.contatos,
      particularidades: dados.particularidades,
    },
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
