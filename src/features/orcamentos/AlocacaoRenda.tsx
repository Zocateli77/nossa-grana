import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Pencil, Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Dados } from '@/lib/calc'
import { orcamentoEfetivo } from '@/lib/calc'
import { money, pct } from '@/lib/format'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Card } from '@/components/ui/card'
import { cn, rechartsTooltipProps, themeColors } from '@/lib/utils'

export function AlocacaoRenda({
  dados,
  mesRef,
  renda,
  onEditarRenda,
}: {
  dados: Dados
  mesRef: string
  renda: number
  onEditarRenda: () => void
}) {
  const itens = useMemo(
    () =>
      dados.categorias
        .filter((c) => c.ativo)
        .map((c) => ({ categoria: c, valor: orcamentoEfetivo(dados.orcamentos, c.id, mesRef, renda) }))
        .filter((x) => x.valor > 0)
        .sort((a, b) => b.valor - a.valor),
    [dados, mesRef, renda]
  )

  const total = itens.reduce((s, x) => s + x.valor, 0)
  const totalPct = renda > 0 ? total / renda : total > 0 ? 1.5 : 0
  const naoAlocado = Math.max(0, renda - total)
  const excedente = Math.max(0, total - renda)

  const dataChart = [
    ...itens.map((x) => ({ nome: x.categoria.nome, valor: x.valor, cor: x.categoria.cor ?? themeColors.primary })),
    ...(naoAlocado > 0 ? [{ nome: 'Não alocado', valor: naoAlocado, cor: themeColors.mutedForeground }] : []),
  ]

  const corPct = excedente > 0 ? 'text-destructive' : naoAlocado === 0 ? 'text-success' : 'text-foreground'

  return (
    <Card className="p-4 mb-4">
      <button onClick={onEditarRenda} className="flex w-full items-center justify-between group">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground group-hover:text-primary">
          <Wallet className="h-4 w-4" /> Renda prevista <Pencil className="h-3 w-3" />
        </span>
        <span className="font-bold">{money(renda)}</span>
      </button>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-32 w-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dataChart} dataKey="valor" nameKey="nome" innerRadius={42} outerRadius={62} stroke="none" paddingAngle={1}>
                {dataChart.map((d, i) => (
                  <Cell key={i} fill={d.cor} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, n: string) => [`${money(v)} · ${pct(renda > 0 ? v / renda : 0)}`, n]}
                {...rechartsTooltipProps}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={cn('text-2xl font-extrabold', corPct)}>{Math.round(totalPct * 100)}%</span>
            <span className="text-xs text-muted-foreground -mt-1">alocado</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Total alocado</p>
          <p className="text-xl font-bold">{money(total)}</p>
          {excedente > 0 ? (
            <p className="mt-1 flex items-start gap-1 text-sm text-destructive font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {money(excedente)} acima da renda
            </p>
          ) : naoAlocado > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Faltam <b className="text-foreground">{money(naoAlocado)}</b> ({pct(naoAlocado / Math.max(renda, 1))}) para alocar
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1 text-sm text-success font-medium">
              <CheckCircle2 className="h-4 w-4" /> 100% da renda alocada
            </p>
          )}
        </div>
      </div>

      {/* quanto da renda vai para cada categoria */}
      <div className="mt-4 space-y-2.5">
        {itens.map(({ categoria, valor }) => {
          const p = renda > 0 ? valor / renda : 0
          return (
            <div key={categoria.id} className="flex items-center gap-2.5">
              <CategoriaIcon icone={categoria.icone} cor={categoria.cor} className="h-7 w-7 shrink-0" size={13} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{categoria.nome}</span>
                  <span className="tabular-nums text-muted-foreground shrink-0">
                    <b className="text-foreground">{pct(p)}</b> · {money(valor)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, p * 100)}%`, backgroundColor: categoria.cor ?? themeColors.primary }} />
                </div>
              </div>
            </div>
          )
        })}
        {naoAlocado > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-2">
            <span>Não alocado (sobra)</span>
            <span className="tabular-nums">{pct(naoAlocado / Math.max(renda, 1))} · {money(naoAlocado)}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
