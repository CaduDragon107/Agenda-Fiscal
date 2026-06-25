import { DesempenhoColaboradoresChart } from "./desempenho-colaboradores-chart";
import { EvolucaoMensalChart } from "./evolucao-mensal-chart";
import { RankingEmpresasTable } from "./ranking-empresas-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "./empty-state";
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
 *
 * Multi-setor (Phase 8, Plan 03, D-01): 3 abas (Fiscal/DP/Contábil), cada
 * uma renderizando o mesmo layout de 3 Cards (SectorDashboard) alimentado
 * por dados já escopados por setor na camada de queries (Plan 02).
 */
type Setor = "FISCAL" | "DP" | "CONTABIL";

type DadosSetor = Awaited<ReturnType<typeof carregarDadosDashboards>>[Setor];

const SETORES: readonly Setor[] = ["FISCAL", "DP", "CONTABIL"];

const LABEL_POR_SETOR: Record<Setor, string> = {
  FISCAL: "Fiscal",
  DP: "DP",
  CONTABIL: "Contábil",
};

export default async function DashboardsPage({
  searchParams,
}: {
  searchParams?: Promise<{ meses?: string }>;
}) {
  const params = await searchParams;
  const dados = await carregarDadosDashboards(params?.meses);

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboards</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral de desempenho da equipe e das empresas
        </p>
      </div>

      <Tabs defaultValue="FISCAL">
        <TabsList>
          {SETORES.map((setor) => (
            <TabsTrigger key={setor} value={setor}>
              {LABEL_POR_SETOR[setor]}
            </TabsTrigger>
          ))}
        </TabsList>
        {SETORES.map((setor) => (
          <TabsContent key={setor} value={setor}>
            <SectorDashboard setor={setor} dados={dados[setor]} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function SectorDashboard({
  setor,
  dados,
}: {
  setor: Setor;
  dados: DadosSetor;
}) {
  const { desempenhoColaboradores, evolucaoMensal, rankingEmpresas } = dados;

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Desempenho por colaborador</CardTitle>
        </CardHeader>
        <CardContent>
          {desempenhoColaboradores.length === 0 ? (
            <EmptyState setor={setor} />
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
            <EmptyState setor={setor} />
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
            <EmptyState setor={setor} />
          ) : (
            <RankingEmpresasTable dados={rankingEmpresas} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
