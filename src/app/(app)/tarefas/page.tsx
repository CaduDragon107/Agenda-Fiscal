import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listarTarefas } from "@/modules/tarefas/queries";
import { listarEmpresas, listarResponsaveis } from "@/modules/empresas/queries";
import { TarefasTable } from "./tarefas-table";
import { NovaTarefaDialog } from "./nova-tarefa-dialog";
import { GerarTarefasButton } from "./gerar-tarefas-button";

export default async function TarefasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [tarefas, responsaveis, empresas] = await Promise.all([
    listarTarefas(session.user),
    listarResponsaveis(),
    listarEmpresas(session.user),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tarefas</h1>
        <div className="flex items-center gap-2">
          {session.user.role === "DONO" && <GerarTarefasButton />}
          <NovaTarefaDialog responsaveis={responsaveis} empresas={empresas} />
        </div>
      </div>
      <TarefasTable
        tarefas={tarefas}
        responsaveis={responsaveis}
        isDono={session.user.role === "DONO"}
        userId={session.user.id}
      />
    </div>
  );
}
