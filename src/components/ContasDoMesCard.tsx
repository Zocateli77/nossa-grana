import { useMemo, useState } from 'react'
import { Check, CalendarClock } from 'lucide-react'
import type { Categoria, Lancamento } from '@/types/db'
import { contasDoMes } from '@/lib/calc'
import { useMarcarPago } from '@/hooks/useMutations'
import { money, dataCurta } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { SecaoTitulo } from '@/components/Estados'
import { cn } from '@/lib/utils'

const LIMITE_INICIAL = 5

export function ContasDoMesCard({
  lancamentos,
  mesRef,
  catMap,
}: {
  lancamentos: Lancamento[]
  mesRef: string
  catMap: Map<string, Categoria>
}) {
  const { itens, total, qtdVencida } = useMemo(() => contasDoMes(lancamentos, mesRef), [lancamentos, mesRef])
  const marcarPago = useMarcarPago()
  const [verTodas, setVerTodas] = useState(false)

  if (itens.length === 0) return null
  const visiveis = verTodas ? itens : itens.slice(0, LIMITE_INICIAL)

  return (
    <section>
      <SecaoTitulo acao={qtdVencida > 0 ? <Badge variant="destructive">{qtdVencida} vencida{qtdVencida > 1 ? 's' : ''}</Badge> : undefined}>
        <span className="inline-flex items-center gap-2">
          <CalendarClock className="h-4 w-4" /> Contas do mês
        </span>
      </SecaoTitulo>

      <Card className="divide-y overflow-hidden p-0">
        {visiveis.map(({ lancamento: l, vencida }) => {
          const cat = l.categoria_id ? catMap.get(l.categoria_id) : undefined
          return (
            <div key={l.id} className="flex items-center gap-3 p-3">
              <CategoriaIcon icone={cat?.icone} cor={cat?.cor} className="h-9 w-9" size={16} />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate text-sm">{l.privado ? 'Gasto livre' : l.descricao}</p>
                <p className={cn('text-xs', vencida ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                  {vencida ? 'venceu ' : 'vence '}
                  {dataCurta(l.data)}
                  {l.parcela_total && l.parcela_total > 1 ? ` · ${l.parcela_atual}/${l.parcela_total}` : ''}
                </p>
              </div>
              <span className="font-semibold tabular-nums text-sm">{money(l.valor)}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => marcarPago.mutate(l.id)}
                disabled={marcarPago.isPending}
                aria-label={`Marcar "${l.descricao}" como pago`}
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          )
        })}

        <div className="flex items-center justify-between p-3 bg-muted/30">
          {itens.length > LIMITE_INICIAL ? (
            <button className="text-xs font-medium text-primary" onClick={() => setVerTodas((v) => !v)}>
              {verTodas ? 'Ver menos' : `Ver todas (${itens.length})`}
            </button>
          ) : (
            <span />
          )}
          <span className="text-sm">
            <span className="text-muted-foreground">Total a pagar </span>
            <span className="font-bold tabular-nums">{money(total)}</span>
          </span>
        </div>
      </Card>
    </section>
  )
}
