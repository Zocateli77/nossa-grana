import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Conta, Categoria, Lancamento } from '@/types/db'
import { faturaDe, mesRefFaturaAberta } from '@/lib/calc'
import { navegarMes } from '@/lib/dates'
import { money, dataCurta } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CategoriaIcon } from '@/components/CategoriaIcon'

const ESTADO_ROTULO = { futura: 'Fatura futura', aberta: 'Fatura aberta', fechada: 'Fatura fechada' } as const

function textoVencimento(dias: number): string {
  if (dias === 0) return 'vence hoje'
  if (dias > 0) return `vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
  const n = Math.abs(dias)
  return `venceu há ${n} ${n === 1 ? 'dia' : 'dias'}`
}

/** Cor da barra de uso do limite. */
function corLimite(uso: number): string {
  if (uso >= 0.9) return 'bg-destructive'
  if (uso >= 0.7) return 'bg-warning'
  return 'bg-success'
}

export function FaturaCartao({
  conta,
  lancamentos,
  catMap,
}: {
  conta: Conta
  lancamentos: Lancamento[]
  catMap: Map<string, Categoria>
}) {
  // offset de ciclos a partir da fatura aberta (0 = aberta, -1 = anterior, +1 = próxima)
  const [offset, setOffset] = useState(0)
  const mesRef = useMemo(() => navegarMes(mesRefFaturaAberta(conta), offset), [conta, offset])
  const fatura = useMemo(() => faturaDe(lancamentos, conta, mesRef), [lancamentos, conta, mesRef])

  if (!fatura) return null
  const { ciclo, itens, total, estado, diasAteVencimento, vencida, limite, usoLimite } = fatura

  return (
    <div>
      <Card className="p-5 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOffset((o) => o - 1)}
              aria-label="Fatura anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Badge variant={estado === 'aberta' ? 'success' : vencida ? 'destructive' : 'muted'}>
              {ESTADO_ROTULO[estado]}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOffset((o) => o + 1)}
              aria-label="Próxima fatura"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="text-3xl font-extrabold mt-2">{money(total)}</p>
        <p className="text-xs text-muted-foreground">
          {dataCurta(ciclo.inicioISO)} a {dataCurta(ciclo.fimISO)}
          {estado === 'aberta' ? ` · fecha dia ${conta.dia_fechamento}` : ''}
        </p>
        <p className={`text-sm mt-1 font-medium ${vencida ? 'text-destructive' : 'text-muted-foreground'}`}>
          Vencimento {dataCurta(ciclo.vencimentoISO)} · {textoVencimento(diasAteVencimento)}
        </p>

        {limite != null && usoLimite != null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Limite usado</span>
              <span className="tabular-nums">
                {money(total)} de {money(limite)}
              </span>
            </div>
            <Progress value={usoLimite * 100} indicatorClassName={corLimite(usoLimite)} />
          </div>
        )}
      </Card>

      <div className="rounded-2xl border bg-card divide-y overflow-hidden">
        {itens
          .slice()
          .sort((a, b) => (a.data < b.data ? 1 : -1))
          .map((l) => {
            const cat = l.categoria_id ? catMap.get(l.categoria_id) : undefined
            return (
              <div key={l.id} className="flex items-center gap-3 p-3">
                <CategoriaIcon icone={cat?.icone} cor={cat?.cor} className="h-9 w-9" size={16} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate text-sm">{l.privado ? 'Gasto livre' : l.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {dataCurta(l.data)}
                    {l.parcela_total && l.parcela_total > 1 ? ` · ${l.parcela_atual}/${l.parcela_total}` : ''}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{money(l.valor)}</span>
              </div>
            )
          })}
        {itens.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma compra nesta fatura.</p>
        )}
      </div>
    </div>
  )
}
