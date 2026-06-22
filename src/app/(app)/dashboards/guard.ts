import { notFound, redirect } from "next/navigation";
import { subMonths } from "date-fns";
import { auth } from "@/auth";
import {
  listarDesempenhoColaboradoresMesAtual,
  listarEvolucaoMensal,
  listarRankingEmpresas,
} from "@/modules/dashboards/queries";
import { mesesSchema } from "@/modules/dashboards/schema";

/**
 * src/app/(app)/dashboards/guard.ts
 *
 * Extraído de page.tsx (arquivo .ts, sem JSX) para permitir teste unitário
 * direto do guard DONO-only sem depender de um pipeline de transformação
 * JSX no Vitest (este projeto não tem @vitejs/plugin-react configurado em
 * vitest.config.ts — page.tsx, sendo .tsx com JSX, não pode ser importado
 * diretamente em teste). Ver tests/dashboards.rbac.test.ts.
 *
 * CRÍTICO (T-4-01): o guard `role !== "DONO" -> notFound()` é a barreira
 * REAL de acesso — vem ANTES de qualquer query, idêntico ao padrão
 * anti-IDOR "não encontrado, never 403" já usado na edição de empresa
 * (Fase 1) e em gerarTarefasDoMesAction (Fase 3).
 */
export async function carregarDadosDashboards(meses?: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DONO") notFound();

  const mesesParsed = meses !== undefined ? mesesSchema.safeParse(meses) : undefined;
  const quantidadeMeses = mesesParsed?.success ? mesesParsed.data : 6;

  const hoje = new Date();
  const inicio3Meses = subMonths(hoje, 3);

  const [desempenhoColaboradores, evolucaoMensal, rankingEmpresas] =
    await Promise.all([
      listarDesempenhoColaboradoresMesAtual(hoje),
      listarEvolucaoMensal(quantidadeMeses),
      listarRankingEmpresas(inicio3Meses, hoje),
    ]);

  return { desempenhoColaboradores, evolucaoMensal, rankingEmpresas };
}
