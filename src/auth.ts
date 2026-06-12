import NextAuth, { type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";

/**
 * Valida email/senha contra a tabela Usuario e retorna o usuário autenticado
 * (sem senhaHash) ou `null` em caso de email inexistente OU senha incorreta —
 * deliberadamente sem distinção entre os dois casos (anti-enumeração,
 * T-01-AUTH-SPOOF).
 *
 * CRITICAL: `senhaHash` é lido aqui via `select` explícito e NUNCA retornado
 * — esta é a única função do sistema que tem acesso a ele.
 */
export async function authorize(
  credentials: Partial<Record<"email" | "password", unknown>> | undefined
): Promise<User | null> {
  if (!credentials?.email || !credentials?.password) return null;

  const usuario = await db.usuario.findUnique({
    where: { email: credentials.email as string },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      senhaHash: true,
    },
  });
  if (!usuario) return null;

  const senhaValida = await bcrypt.compare(
    credentials.password as string,
    usuario.senhaHash
  );
  if (!senhaValida) return null;

  return {
    id: usuario.id,
    name: usuario.nome,
    email: usuario.email,
    role: usuario.role,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize,
    }),
  ],
});
