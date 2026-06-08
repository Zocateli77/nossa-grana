import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Loader2, RotateCcw, Save, SlidersHorizontal } from 'lucide-react'
import type { Dados } from '@/lib/calc'
import { orcamentoEfetivo, orcamentoRow } from '@/lib/calc'
import { useSalvarOrcamentosPercentuais } from '@/hooks/useMutations'
import { money } from '@/lib/format'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const ORDEM_TIPO: Record<string, number> = {
  gasto: 0,
  mesada: 1,
  investimento: 2,
  imposto: 3,
}

const clampPct = (value: number) => Math.max(0, Math.min(100, Math.round(value)))
const pctText = (value: number) => `${Math.round(value)}%`
const roundMoney = (value: number) => Math.round(value * 100) / 100

export function DistribuicaoPercentual({ dados, mesRef, renda }: { dados: Dados; mesRef: string; renda: number }) {
  const salvar = useSalvarOrcamentosPercentuais()
  const [percentuais, setPercentuais] = useState<Record<string, number>>({})
  const [ok, setOk] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const categorias = useMemo(
    () =>
      dados.categorias
        .filter((c) => c.ativo)
        .sort((a, b) => {
          const tipo = (ORDEM_TIPO[a.tipo_reserva] ?? 99) - (ORDEM_TIPO[b.tipo_reserva] ?? 99)
          return tipo || a.nome.localeCompare(b.nome, 'pt-BR')
        }),
    [dados.categorias]
  )

  const iniciais = useMemo(() => {
    const out: Record<string, number> = {}
    for (const c of categorias) {
      const row = orcamentoRow(dados.orcamentos, c.id, mesRef)
      const valor = orcamentoEfetivo(dados.orcamentos, c.id, mesRef, renda)
      const percentual = row?.tipo_valor === 'percentual' ? Number(row.percentual ?? 0) : renda > 0 ? (valor / renda) * 100 : 0
      out[c.id] = clampPct(percentual)
    }
    return out
  }, [categorias, dados.orcamentos, mesRef, renda])

  useEffect(() => {
    setPercentuais(iniciais)
    setErro(null)
    setOk(false)
  }, [iniciais])

  const total = categorias.reduce((s, c) => s + (percentuais[c.id] ?? 0), 0)
  const sobra = Math.max(0, 100 - total)
  const acima = Math.max(0, total - 100)
  const sujo = categorias.some((c) => (percentuais[c.id] ?? 0) !== (iniciais[c.id] ?? 0))

  const chartData = [
    ...categorias
      .map((c) => ({ nome: c.nome, valor: percentuais[c.id] ?? 0, cor: c.cor ?? '#0f766e' }))
      .filter((x) => x.valor > 0),
    ...(sobra > 0 ? [{ nome: 'Nao alocado', valor: sobra, cor: '#cbd5e1' }] : []),
  ]

  const legenda = categorias
    .map((c) => ({ categoria: c, valor: percentuais[c.id] ?? 0 }))
    .filter((x) => x.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  function alterar(categoriaId: string, value: number) {
    setOk(false)
    setErro(null)
    setPercentuais((atual) => ({ ...atual, [categoriaId]: clampPct(value) }))
  }

  function resetar() {
    setPercentuais(iniciais)
    setErro(null)
    setOk(false)
  }

  async function salvarTudo() {
    if (acima > 0) {
      setErro('O total precisa ficar em ate 100%.')
      return
    }
    setErro(null)
    setOk(false)
    try {
      await salvar.mutateAsync(
        categorias.map((c) => {
          const percentual = percentuais[c.id] ?? 0
          return {
            categoria_id: c.id,
            mes_referencia: mesRef,
            valor_estabelecido: roundMoney((percentual / 100) * renda),
            tipo_valor: 'percentual',
            percentual,
            recorrente: true,
          }
        })
      )
      setOk(true)
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao salvar a distribuicao.')
    }
  }

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="border-b p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h2 className="font-extrabold tracking-tight">Distribuicao por %</h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Renda prevista: {money(renda)}</p>
          </div>
          <Badge variant={acima > 0 ? 'destructive' : total === 100 ? 'success' : 'muted'} className="text-sm">
            Total: {pctText(total)}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[230px_1fr]">
        <div className="md:border-r md:pr-4">
          <div className="mx-auto h-44 w-full max-w-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData.length ? chartData : [{ nome: 'Nao alocado', valor: 100, cor: '#cbd5e1' }]} dataKey="valor" nameKey="nome" innerRadius={54} outerRadius={78} stroke="hsl(var(--card))" strokeWidth={2}>
                  {(chartData.length ? chartData : [{ nome: 'Nao alocado', valor: 100, cor: '#cbd5e1' }]).map((d) => (
                    <Cell key={d.nome} fill={d.cor} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, n: string) => [`${pctText(v)} - ${money((Number(v) / 100) * renda)}`, n]}
                  contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 space-y-2">
            {legenda.slice(0, 8).map(({ categoria, valor }) => (
              <div key={categoria.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoria.cor ?? '#0f766e' }} />
                  <span className="truncate">{categoria.nome}</span>
                </span>
                <span className="font-semibold tabular-nums">{pctText(valor)}</span>
              </div>
            ))}
            {sobra > 0 && (
              <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground">
                <span>Nao alocado</span>
                <span className="font-semibold tabular-nums">{pctText(sobra)}</span>
              </div>
            )}
            {legenda.length > 8 && <p className="text-xs text-muted-foreground">+{legenda.length - 8} envelopes com percentual</p>}
          </div>
        </div>

        <div>
          <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {categorias.map((c) => {
              const value = percentuais[c.id] ?? 0
              return (
                <div key={c.id} className="rounded-xl border p-3">
                  <div className="flex items-center gap-3">
                    <CategoriaIcon icone={c.icone} cor={c.cor} className="h-9 w-9 shrink-0" size={17} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold">{c.nome}</span>
                        <label className="flex shrink-0 items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={value}
                            onChange={(e) => alterar(c.id, Number(e.target.value))}
                            className="h-8 w-16 rounded-lg border bg-background px-2 text-right text-sm font-bold tabular-nums"
                          />
                          <span className="text-sm font-semibold text-muted-foreground">%</span>
                        </label>
                      </div>
                      <div className="mt-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={value}
                          onChange={(e) => alterar(c.id, Number(e.target.value))}
                          className="h-2 w-full cursor-pointer"
                          style={{ accentColor: c.cor ?? '#0f766e' }}
                          aria-label={`${c.nome} em percentual da renda`}
                        />
                        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                          <span>0%</span>
                          <span className={cn('font-semibold tabular-nums', value > 0 && 'text-foreground')}>
                            {money((value / 100) * renda)}
                          </span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" className="sm:flex-1" onClick={resetar} disabled={!sujo || salvar.isPending}>
              <RotateCcw className="h-4 w-4" />
              Resetar valores
            </Button>
            <Button className="sm:flex-1" onClick={salvarTudo} disabled={!sujo || acima > 0 || salvar.isPending || renda <= 0}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
          <div className="mt-2 min-h-5 text-xs">
            {acima > 0 && <span className="font-medium text-destructive">Acima de 100% em {pctText(acima)}.</span>}
            {!acima && sobra > 0 && <span className="text-muted-foreground">Sobra {pctText(sobra)} da renda.</span>}
            {ok && <span className="font-medium text-success">Distribuicao salva.</span>}
            {erro && <span className="font-medium text-destructive">{erro}</span>}
          </div>
        </div>
      </div>
    </Card>
  )
}
