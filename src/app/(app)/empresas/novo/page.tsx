import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarResponsaveis } from "@/modules/empresas/queries";
import { EmpresaForm } from "../empresa-form";

/**
 * Tela "Nova empresa" (EMPR-01).
 */
export default async function NovaEmpresaPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const responsaveis = await listarResponsaveis();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Nova empresa</h1>
      <EmpresaForm responsaveis={responsaveis} />
    </div>
  );
}
