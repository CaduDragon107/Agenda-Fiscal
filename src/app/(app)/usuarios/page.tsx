import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { UsuariosTable } from "./usuarios-table";

/**
 * Página /usuarios (quick task 260626-d1a) — SOMENTE DONO.
 *
 * Server Component: faz o guard de autenticação/autorização ANTES de
 * qualquer busca no banco (mesmo padrão de empresas/page.tsx — redirect, não
 * notFound, para gating de rota). Um COLABORADOR que acessa /usuarios é
 * redirecionado para /empresas, nunca vê a lista de usuários.
 *
 * `senhaHash` NUNCA entra no `select` (T-d1a-03 — Information Disclosure).
 */
export default async function UsuariosPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "DONO") {
    redirect("/empresas");
  }

  const usuarios = await db.usuario.findMany({
    select: { id: true, nome: true, email: true, role: true, setor: true },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Usuários</h1>
      <UsuariosTable usuarios={usuarios} />
    </div>
  );
}
