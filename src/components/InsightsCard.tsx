import { useMemo } from 'react'
import { TrendingUp, Sparkles, Info } from 'lucide-react'
import type { Dados } from '@/lib/calc'
import { insightsDoMes, type SeveridadeInsight } from '@/lib/calc'
import { Card } from '@/components/ui/card'
import { SecaoTitulo } from '@/components/Estados'
import { cn } from '@/lib/utils'

const ICONE: Record<SeveridadeInsight, typeof TrendingUp> = {
  alerta: TrendingUp,
  positivo: Sparkles,
  info: Info,
}
const COR: Record<SeveridadeInsight, string> = {
  alerta: 'text-warning-foreground',
  positivo: 'text-success',
  info: 'text-muted-foreground',
}

export function InsightsCard({ dados, mesRef }: { dados: Dados; mesRef: string }) {
  const insights = useMemo(() => insightsDoMes(dados, mesRef), [dados, mesRef])
  if (insights.length === 0) return null

  return (
    <section>
      <SecaoTitulo>
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Percebi que…
        </span>
      </SecaoTitulo>
      <Card className="divide-y overflow-hidden p-0">
        {insights.map((ins) => {
          const Icon = ICONE[ins.severidade]
          return (
            <div key={ins.id} className="flex items-start gap-3 p-3">
              <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', COR[ins.severidade])} />
              <p className="text-sm">{ins.texto}</p>
            </div>
          )
        })}
      </Card>
    </section>
  )
}
