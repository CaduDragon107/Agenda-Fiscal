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
 * direto do guard sem depender de um pipeline de transformação JSX no
 * Vitest (este projeto não tem @vitejs/plugin-react configurado em
 * vitest.config.ts — page.tsx, sendo .tsx com JSX, não pode ser importado
 * diretamente em teste). Ver tests/dashboards.rbac.test.ts.
 *
 * CRÍTICO (T-4-01, estendido em quick task 260626-kn2): o guard
 * `role !== "DONO" && role !== "CHEFE_SETOR" -> notFound()` é a barreira
 * REAL de acesso — vem ANTES de qualquer query, idêntico ao padrão
 * anti-IDOR "não encontrado, never 403" já usado na edição de empresa
 * (Fase 1) e em gerarTarefasDoMesAction (Fase 3).
 *
 * Fan-out por setor (Phase 8, Plan 03; ajustado em 260626-kn2): DONO busca
 * os 3 datasets (desempenho/evolução/ranking) para FISCAL/DP/CONTABIL em
 * paralelo, cada um com seu próprio empresaWhereExtra (D-02: DP só
 * temFuncionariosClt=true; D-03: Contábil é o universo cheio de 197
 * empresas). CHEFE_SETOR busca SOMENTE o próprio setor (lido de
 * `session.user.setor`, nunca de query string/input do client) — mesmo
 * padrão de escopo-por-setor-da-sessão de src/lib/visibility-scope.ts.
 * Quando CHEFE_SETOR tem `setor` null/inválido, aplica-se o mesmo fail-safe
 * "fail seguro = sem dados" do branch CHEFE_SETOR de visibility-scope:
 * retorna um Record vazio, sem disparar nenhuma query — NUNCA amplia para
 * os 3 setores.
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
  if (session.user.role !== "DONO" && session.user.role !== "CHEFE_SETOR") {
    notFound();
  }

  const mesesParsed = meses !== undefined ? mesesSchema.safeParse(meses) : undefined;
  const quantidadeMeses = mesesParsed?.success ? mesesParsed.data : 6;

  const hoje = new Date();
  const inicioRanking = subMonths(hoje, quantidadeMeses);

  // DONO: vê os 3 setores. CHEFE_SETOR: escopado a 1 setor, lido SOMENTE de
  // session.user.setor (nunca de query string/input do client). Fail-safe
  // (T-kn2-03): CHEFE_SETOR com setor null/inválido não dispara nenhuma
  // query e recebe um Record vazio — NUNCA amplia para os 3 setores.
  const setoresParaBuscar: readonly SetorDashboard[] =
    session.user.role === "DONO"
      ? SETORES
      : SETORES.includes(session.user.setor as SetorDashboard)
        ? [session.user.setor as SetorDashboard]
        : [];

  const resultados = await Promise.all(
    setoresParaBuscar.map(async (setor) => {
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
