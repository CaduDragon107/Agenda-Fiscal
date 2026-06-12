import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Instância edge-safe do NextAuth: usa apenas a config base (sem o provider
// Credentials, que depende de @/lib/db e bcryptjs — incompatíveis com o
// edge runtime do middleware). Suficiente para verificar a sessão JWT e
// redirecionar para /login quando ausente.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|login|favicon.ico).*)"],
};
