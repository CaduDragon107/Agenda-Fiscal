"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * Schema do campo `nome` isolado para validação aqui.
 *
 * NOTA (Rule 1 - bug fix): `usuarioSchema` (@/modules/usuarios/schema) é
 * envolvido em `.superRefine`, o que produz um `ZodEffects` — esse tipo NÃO
 * expõe `.shape` (somente `z.object(...)` puro expõe). Tentar
 * `usuarioSchema.shape.nome` falha em runtime ("Cannot read properties of
 * undefined"). Como o plano pedia reusar `usuarioSchema.shape.nome` mas o
 * schema real não permite essa propriedade, replicamos aqui a MESMA regra
 * de validação do campo `nome` (`z.string().min(1, "Nome é obrigatório")`),
 * mantendo a mensagem de erro idêntica à de usuarioSchema.
 */
const nomeSchema = z.string().min(1, "Nome é obrigatório");

/**
 * Server Action de edição de usuário (quick task 260626-d1a).
 *
 * Escopo deliberadamente mínimo: edita SOMENTE o campo `nome`. Fora de
 * escopo (não implementado aqui): criar usuário, editar email/senha/role/
 * setor, excluir usuário.
 *
 * CRÍTICO (T-d1a-01, mesmo padrão de gerarTarefasDoMesAction e do guard
 * DONO-only em src/app/(app)/actions.ts): o guard `role === "DONO"` é
 * verificado ANTES de qualquer acesso ao banco — nunca confiar apenas na UI
 * escondida (sidebar/botão). Um COLABORADOR chamando esta action diretamente
 * é rejeitado sem que `db.usuario.update` seja invocado.
 *
 * CRÍTICO (T-d1a-02): `data` do update contém SOMENTE `{ nome }` — mesmo que
 * o cliente envie outros campos, esta action ignora qualquer coisa além de
 * usuarioId+novoNome. email/role/setor/senhaHash nunca são gravados aqui.
 */
export async function editarNomeUsuarioAction(
  usuarioId: string,
  novoNome: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Não autenticado" };
  }

  if (session.user.role !== "DONO") {
    return { ok: false, error: "não autorizado" };
  }

  const parsed = nomeSchema.safeParse(novoNome.trim());
  if (!parsed.success) {
    return { ok: false, error: "Nome inválido" };
  }

  await db.usuario.update({
    where: { id: usuarioId },
    data: { nome: parsed.data },
  });

  revalidatePath("/usuarios");
  return { ok: true };
}
