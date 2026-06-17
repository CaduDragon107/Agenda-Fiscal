import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/auth"
import { buscarTarefaPorId } from "@/modules/tarefas/queries"
import { calcularAlertaPrazo } from "@/lib/alert-prazo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConcluirButton } from "./concluir-button"

// -------------------------------------------------------------------------
// Helpers de formatação (copiados de empresas-table.tsx — sem criar módulo
// compartilhado, per RESEARCH.md Principal Recommendation)
// -------------------------------------------------------------------------

function formatarCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "")
  if (digits.length !== 14) return cnpj
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  )
}

type RegimeTributario = "LUCRO_REAL" | "LUCRO_PRESUMIDO" | "SIMPLES_NACIONAL"

const REGIME_LABEL: Record<RegimeTributario, string> = {
  LUCRO_REAL: "Lucro Real",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  SIMPLES_NACIONAL: "Simples Nacional",
}

const REGIME_BADGE_CLASS: Record<RegimeTributario, string> = {
  LUCRO_REAL:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  LUCRO_PRESUMIDO:
    "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
  SIMPLES_NACIONAL:
    "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
}

// -------------------------------------------------------------------------
// Page
// -------------------------------------------------------------------------

export default async function TarefaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect("/login")

  const tarefa = await buscarTarefaPorId(session.user, id)
  if (!tarefa) notFound() // anti-IDOR: tarefa inexistente OU fora do escopo = 404

  const alerta = calcularAlertaPrazo(tarefa.prazo, tarefa.status)
  const regime = tarefa.empresa.regimeTributario as RegimeTributario

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Breadcrumb back link */}
      <Link
        href="/tarefas"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ChevronLeft className="size-4" />
        Tarefas
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold">{tarefa.titulo}</h1>
        <div className="flex items-center gap-2 shrink-0">
          {alerta.emoji && (
            <span aria-label={alerta.label}>{alerta.emoji}</span>
          )}
          <Badge
            className={
              alerta.badgeClass !== "variant-outline" &&
              alerta.badgeClass !== "variant-secondary"
                ? alerta.badgeClass
                : undefined
            }
            variant={
              alerta.badgeClass === "variant-secondary"
                ? "secondary"
                : "outline"
            }
          >
            {alerta.label ||
              (tarefa.status === "CONCLUIDA" ? "Concluída" : "Pendente")}
          </Badge>
        </div>
      </div>

      {/* Dois cards em grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card esquerdo: detalhes da tarefa */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhes</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide">
                  Prazo
                </dt>
                <dd className={`text-sm ${alerta.textClass}`}>
                  {alerta.emoji}{" "}
                  {format(tarefa.prazo, "dd/MM/yyyy", { locale: ptBR })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide">
                  Responsável
                </dt>
                <dd className="text-sm">{tarefa.responsavel.nome}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide">
                  Criado em
                </dt>
                <dd className="text-sm text-muted-foreground">
                  {format(tarefa.createdAt, "dd/MM/yyyy", { locale: ptBR })}
                </dd>
              </div>
              {tarefa.descricao && (
                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wide">
                    Descrição
                  </dt>
                  <dd className="text-sm whitespace-pre-wrap">
                    {tarefa.descricao}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Card direito: empresa vinculada (TASK-05) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empresa vinculada</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3">
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide">
                  Nome
                </dt>
                <dd className="text-sm font-semibold">{tarefa.empresa.nome}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide">
                  CNPJ
                </dt>
                <dd className="text-sm">{formatarCnpj(tarefa.empresa.cnpj)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide">
                  Regime
                </dt>
                <dd>
                  <Badge className={REGIME_BADGE_CLASS[regime]}>
                    {REGIME_LABEL[regime]}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide">
                  Responsável
                </dt>
                <dd className="text-sm">{tarefa.empresa.responsavel.nome}</dd>
              </div>
              {tarefa.empresa.particularidades && (
                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wide">
                    Particularidades
                  </dt>
                  <dd className="text-sm text-muted-foreground">
                    {tarefa.empresa.particularidades}
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/empresas/${tarefa.empresa.id}`}>Ver empresa</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botão de conclusão — apenas PENDENTE (per D-05) */}
      {tarefa.status === "PENDENTE" && (
        <div>
          <ConcluirButton tarefaId={tarefa.id} />
        </div>
      )}

      {/* Histórico — se houver conclusões */}
      {tarefa.historico.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-normal text-muted-foreground uppercase tracking-wide">
            Histórico
          </h2>
          <div className="flex flex-col gap-1">
            {tarefa.historico.map((h) => (
              <p key={h.id} className="text-sm">
                Concluída por{" "}
                <span className="font-semibold">{h.concluidoPor.nome}</span>{" "}
                em{" "}
                {format(h.concluidoEm, "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
