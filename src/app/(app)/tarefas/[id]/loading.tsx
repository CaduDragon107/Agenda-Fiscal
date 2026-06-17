import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function TarefaDetalheLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><Skeleton className="h-5 w-20" /></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
