import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Instância edge-safe do NextAuth: usa apenas a config base (sem o provider
// Credentials, que depende de @/lib/db e bcryptjs — incompatíveis com o
// edge runtime do middleware). Suficiente para verificar a sessão JWT e
// redirecionar para /login quando ausente.
const { auth } = NextAuth(authConfig);

// Cache-Control: no-store nas páginas autenticadas evita que o
// back-forward cache do navegador reexiba a tela protegida após logout
// (o usuário aperta "voltar" e via dados antigos em vez de cair em
// /login) — o redirect real continua sendo feito pelos layouts/páginas
// via auth(), isso só impede o navegador de servir a versão antiga sem
// passar pelo servidor de novo.
export const middleware = auth(() => {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|login|favicon.ico).*)"],
};
