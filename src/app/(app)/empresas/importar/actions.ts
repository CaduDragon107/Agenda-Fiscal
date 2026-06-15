"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { empresaSchema } from "@/modules/empresas/schema";
import { parseEmpresasXlsx, type LinhaImportada } from "@/lib/excel/parse-empresas";

/**
 * Server Actions de importação de empresas via planilha (EMPR-02).
 *
 * CRITICAL (T-01-IMPORT-AUTHZ / T-01-UPLOAD / T-01-IMPORT-INPUT / T-01-IMPORT-CSRF):
 * - Toda action começa com o guard de sessão `auth()` — "Não autenticado" se
 *   ausente.
 * - parseUploadAction NUNCA persiste nada — apenas faz parse e devolve as
 *   linhas para staging em estado React (Step 2 do wizard). Qualquer erro de
 *   leitura (arquivo não-.xlsx, .xlsx corrompido/ilegível) retorna a copy
 *   genérica "Arquivo inválido. Envie um arquivo .xlsx válido.", nunca o erro
 *   real do SheetJS (stack trace, mensagem interna, caminho de arquivo).
 * - confirmarImportacao valida cada linha incluída com `empresaSchema`
 *   (CNPJ módulo 11 + regimeTributario enum + responsavelId obrigatório,
 *   Pitfall 5) ANTES de qualquer `db.empresa.create`. Linhas que não passam
 *   (sem regime, sem responsável, CNPJ inválido) ou com `incluida=false` são
 *   ignoradas silenciosamente — a revisão humana no Step 2 é o gate.
 * - Cada empresa persistida grava também a primeira entrada de
 *   EmpresaRegimeHistorico (regime atual, dataInicio = agora), consistente
 *   com `criarEmpresa` (src/app/(app)/actions.ts, Plano 04).
 */

const ERRO_ARQUIVO_INVALIDO = "Arquivo inválido. Envie um arquivo .xlsx válido.";

export type ParseUploadResult =
  | { ok: true; linhas: LinhaImportada[] }
  | { ok: false; error: string };

/**
 * Linha do staging de importação, após revisão humana no Step 2:
 * `LinhaImportada` (nome/cnpj/regimeTributario? do parser) + responsavelId
 * (atribuído pelo usuário) + contatos/particularidades (preenchíveis na
 * revisão, opcionais em empresaSchema) + incluida (checkbox de
 * incluir/excluir).
 */
export type LinhaRevisada = LinhaImportada & {
  responsavelId?: string;
  contatos?: string;
  particularidades?: string;
  incluida: boolean;
};

export type ConfirmarImportacaoResult =
  | { ok: true; persistidas: number }
  | { ok: false; error: string };

/**
 * Recebe o upload do Step 1, valida a extensão do arquivo e roda
 * parseEmpresasXlsx. Não persiste nada — apenas devolve as linhas
 * parseadas para staging em estado React (Step 2).
 *
 * Qualquer falha (extensão inválida, leitura corrompida) retorna o erro
 * genérico ERRO_ARQUIVO_INVALIDO, sem detalhe interno do parser.
 */
export async function parseUploadAction(formData: FormData): Promise<ParseUploadResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Não autenticado" };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File)) {
    return { ok: false, error: ERRO_ARQUIVO_INVALIDO };
  }

  if (!arquivo.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, error: ERRO_ARQUIVO_INVALIDO };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());

  // .xlsx é um arquivo ZIP/OOXML — assinatura "PK\x03\x04". O parser do
  // SheetJS tem um fallback permissivo para CSV/texto que NÃO lança erro
  // para bytes arbitrários (ex.: um .txt renomeado para .xlsx seria lido
  // como uma planilha de 1 célula). Validar a assinatura de arquivo aqui
  // garante que "corrompido/ilegível" seja rejeitado de forma consistente,
  // sem depender apenas do try/catch em XLSX.read.
  const ASSINATURA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(ASSINATURA_ZIP)) {
    return { ok: false, error: ERRO_ARQUIVO_INVALIDO };
  }

  try {
    const linhas = parseEmpresasXlsx(buffer);
    return { ok: true, linhas };
  } catch {
    // NUNCA propagar o erro real do SheetJS (stack trace, mensagem interna).
    return { ok: false, error: ERRO_ARQUIVO_INVALIDO };
  }
}

/**
 * Persiste apenas as linhas incluídas (`incluida=true`) e válidas segundo
 * `empresaSchema` (CNPJ módulo 11, regimeTributario presente, responsavelId
 * presente). Linhas sem regime, sem responsável, com CNPJ inválido ou
 * `incluida=false` são ignoradas — a revisão humana do Step 2 é obrigatória
 * antes de qualquer persistência.
 *
 * Cada empresa válida persistida também grava a primeira entrada de
 * EmpresaRegimeHistorico (regime atual, dataInicio=agora).
 */
export async function confirmarImportacao(
  linhasRevisadas: LinhaRevisada[]
): Promise<ConfirmarImportacaoResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Não autenticado" };
  }

  let persistidas = 0;

  for (const linha of linhasRevisadas) {
    if (!linha.incluida) continue;

    const parsed = empresaSchema.safeParse({
      nome: linha.nome,
      cnpj: linha.cnpj,
      regimeTributario: linha.regimeTributario,
      responsavelId: linha.responsavelId,
      contatos: linha.contatos,
      particularidades: linha.particularidades,
    });
    if (!parsed.success) continue;

    const dados = parsed.data;

    await db.empresa.create({
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

    persistidas += 1;
  }

  revalidatePath("/empresas");
  return { ok: true, persistidas };
}
