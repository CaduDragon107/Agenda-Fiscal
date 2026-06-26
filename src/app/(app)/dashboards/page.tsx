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
 * Server Component DONO/CHEFE_SETOR (T-4-01, estendido em quick task
 * 260626-kn2): o guard `role !== "DONO" && role !== "CHEFE_SETOR" ->
 * notFound()` é a barreira REAL de acesso — vem ANTES de qualquer query,
 * idêntico ao padrão anti-IDOR "não encontrado, never 403" já usado na
 * edição de empresa (Fase 1) e em gerarTarefasDoMesAction (Fase 3). A
 * sidebar gated por podeVerDashboards (app-sidebar.tsx) é só defesa em
 * profundidade, nunca o gate real.
 *
 * Guard + busca dos datasets (DASH-01/02/03) em paralelo vivem em ./guard.ts
 * (arquivo .ts sem JSX) para permitir teste unitário direto sem depender de
 * um pipeline de transformação JSX no Vitest — ver
 * tests/dashboards.rbac.test.ts.
 *
 * Multi-setor (Phase 8, Plan 03, D-01) + CHEFE_SETOR (260626-kn2): `dados`
 * agora pode ter 1 (CHEFE_SETOR), 3 (DONO) ou 0 chaves (CHEFE_SETOR com
 * setor null, fail-safe). A lista de setores presentes é derivada das
 * chaves de `dados`, nunca de um array fixo — com >=2 setores renderiza as
 * abas Tabs/TabsList/TabsTrigger (comportamento DONO inalterado); com
 * exatamente 1 setor renderiza só o card daquele setor, sem seletor de
 * abas; com 0 setores renderiza um estado vazio simples.
 */
type Setor = "FISCAL" | "DP" | "CONTABIL";

type DadosSetor = Awaited<ReturnType<typeof carregarDadosDashboards>>[Setor];

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
  const setoresPresentes = Object.keys(dados) as Setor[];

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboards</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral de desempenho da equipe e das empresas
        </p>
      </div>

      {setoresPresentes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum dado disponível para o seu setor.
        </p>
      ) : setoresPresentes.length === 1 ? (
        <SectorDashboard
          setor={setoresPresentes[0]}
          dados={dados[setoresPresentes[0]]}
        />
      ) : (
        <Tabs defaultValue="FISCAL">
          <TabsList>
            {setoresPresentes.map((setor) => (
              <TabsTrigger key={setor} value={setor}>
                {LABEL_POR_SETOR[setor]}
              </TabsTrigger>
            ))}
          </TabsList>
          {setoresPresentes.map((setor) => (
            <TabsContent key={setor} value={setor}>
              <SectorDashboard setor={setor} dados={dados[setor]} />
            </TabsContent>
          ))}
        </Tabs>
      )}
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
