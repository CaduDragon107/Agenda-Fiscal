import { notFound, redirect } from "next/navigation";
import { subMonths } from "date-fns";
import type { Prisma } from "@prisma/client";
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
 *
 * Fan-out por setor (Phase 8, Plan 03): busca os 3 datasets (desempenho/
 * evolução/ranking) para FISCAL/DP/CONTABIL em paralelo, cada um com seu
 * próprio empresaWhereExtra (D-02: DP só temFuncionariosClt=true; D-03:
 * Contábil é o universo cheio de 197 empresas).
 */
const SETORES = ["FISCAL", "DP", "CONTABIL"] as const;
type SetorDashboard = (typeof SETORES)[number];

const empresaScopePorSetor = {
  FISCAL: {},
  DP: { temFuncionariosClt: true }, // D-02
  CONTABIL: {}, // D-03 — universo cheio de 197 empresas
} satisfies Record<SetorDashboard, Prisma.EmpresaWhereInput>;

export async function carregarDadosDashboards(meses?: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "DONO") notFound();

  const mesesParsed = meses !== undefined ? mesesSchema.safeParse(meses) : undefined;
  const quantidadeMeses = mesesParsed?.success ? mesesParsed.data : 6;

  const hoje = new Date();
  const inicioRanking = subMonths(hoje, quantidadeMeses);

  const resultados = await Promise.all(
    SETORES.map(async (setor) => {
      const [desempenhoColaboradores, evolucaoMensal, rankingEmpresas] =
        await Promise.all([
          listarDesempenhoColaboradoresMesAtual(
            hoje,
            setor,
            empresaScopePorSetor[setor]
          ),
          listarEvolucaoMensal(quantidadeMeses, setor, empresaScopePorSetor[setor]),
          listarRankingEmpresas(
            inicioRanking,
            hoje,
            setor,
            empresaScopePorSetor[setor]
          ),
        ]);
      return [
        setor,
        { desempenhoColaboradores, evolucaoMensal, rankingEmpresas },
      ] as const;
    })
  );

  return Object.fromEntries(resultados) as Record<
    SetorDashboard,
    {
      desempenhoColaboradores: Awaited<
        ReturnType<typeof listarDesempenhoColaboradoresMesAtual>
      >;
      evolucaoMensal: Awaited<ReturnType<typeof listarEvolucaoMensal>>;
      rankingEmpresas: Awaited<ReturnType<typeof listarRankingEmpresas>>;
    }
  >;
}
