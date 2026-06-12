import type { NextAuthConfig } from "next-auth";

/**
 * Configuração base do Auth.js v5, segura para o edge runtime (middleware).
 *
 * Não importa `@/lib/db` nem `bcryptjs` aqui — esses módulos dependem de
 * APIs Node.js (Prisma, bcrypt) que não funcionam no edge runtime usado pelo
 * middleware. A config completa (com o provider Credentials/authorize) fica
 * em `src/auth.ts`, que estende esta config base.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
