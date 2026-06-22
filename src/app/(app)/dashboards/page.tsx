import { DesempenhoColaboradoresChart } from "./desempenho-colaboradores-chart";
import { EvolucaoMensalChart } from "./evolucao-mensal-chart";
import { RankingEmpresasTable } from "./ranking-empresas-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { carregarDadosDashboards } from "./guard";

/**
 * src/app/(app)/dashboards/page.tsx
 *
 * Server Component DONO-only (T-4-01): o guard `role !== "DONO" -> notFound()`
 * é a barreira REAL de acesso — vem ANTES de qualquer query, idêntico ao
 * padrão anti-IDOR "não encontrado, never 403" já usado na edição de empresa
 * (Fase 1) e em gerarTarefasDoMesAction (Fase 3). A sidebar gated por isDono
 * (Plan 04-04 Task 3) é só defesa em profundidade, nunca o gate real.
 *
 * Guard + busca dos 3 datasets (DASH-01/02/03) em paralelo vivem em
 * ./guard.ts (arquivo .ts sem JSX) para permitir teste unitário direto sem
 * depender de um pipeline de transformação JSX no Vitest — ver
 * tests/dashboards.rbac.test.ts.
 */
export default async function DashboardsPage({
  searchParams,
}: {
  searchParams?: Promise<{ meses?: string }>;
}) {
  const params = await searchParams;
  const { desempenhoColaboradores, evolucaoMensal, rankingEmpresas } =
    await carregarDadosDashboards(params?.meses);

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboards</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral de desempenho da equipe e das empresas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Desempenho por colaborador</CardTitle>
        </CardHeader>
        <CardContent>
          {desempenhoColaboradores.length === 0 ? (
            <EmptyState />
          ) : (
            <DesempenhoColaboradoresChart dados={desempenhoColaboradores} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evolução mensal</CardTitle>
        </CardHeader>
        <CardContent>
          {evolucaoMensal.length === 0 ? (
            <EmptyState />
          ) : (
            <EvolucaoMensalChart dados={evolucaoMensal} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Empresas com mais atrasos</CardTitle>
        </CardHeader>
        <CardContent>
          {rankingEmpresas.length === 0 ? (
            <EmptyState />
          ) : (
            <RankingEmpresasTable dados={rankingEmpresas} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h2 className="text-xl font-semibold">Ainda não há dados suficientes</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Os dashboards são alimentados pelas tarefas concluídas a cada mês.
        Volte após o fechamento do primeiro mês de operação.
      </p>
    </div>
  );
}
