import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp, HandCoins, AlertTriangle } from 'lucide-react'
import { useDados } from '@/hooks/useDados'
import { useApp } from '@/contexts/AppContext'
import { projecao, dividas } from '@/lib/calc'
import { money, moneyCompact, mesCurto, mesExtenso } from '@/lib/format'
import { Carregando, SecaoTitulo } from '@/components/Estados'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const HORIZONTES = [3, 6, 12]

export function FuturoPage() {
  const { salarioBase } = useApp()
  const { dados, isLoading } = useDados()
  const [meses, setMeses] = useState(6)
  if (isLoading) return <Carregando />

  const proj = projecao(dados, meses, new Date(), salarioBase)
  const dvs = dividas(dados.lancamentos).sort((a, b) => (a.ultimaParcelaMes < b.ultimaParcelaMes ? 1 : -1))
  const totalDevido = dvs.reduce((s, d) => s + d.totalDevido, 0)
  const chart = proj.map((p) => ({ mes: mesCurto(p.mesRef), saldo: Math.round(p.saldoAcumulado), saldoMes: Math.round(p.saldoMes) }))
  const minSaldo = Math.min(0, ...chart.map((c) => c.saldo))

  return (
    <div>
      <header className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-extrabold tracking-tight">Futuro</h1>
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {HORIZONTES.map((h) => (
            <button key={h} onClick={() => setMeses(h)} className={cn('rounded-lg px-3 py-1 text-xs font-medium', meses === h ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
              {h}m
            </button>
          ))}
        </div>
      </header>

      <Card className="p-4">
        <p className="text-sm text-muted-foreground mb-2">Saldo projetado acumulado (renda − fixos − parcelas)</p>
        <div className="h-48 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 5, right: 8, bottom: 0, left: 8 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={(v) => moneyCompact(v)} tick={{ fontSize: 11 }} width={52} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: number) => money(v)} labelClassName="text-foreground" contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {minSaldo < 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> Alguns meses ficam negativos no acumulado — atenção ao caixa.</p>
        )}
      </Card>

      <SecaoTitulo>Mês a mês</SecaoTitulo>
      <div className="space-y-2">
        {proj.map((p) => (
          <Card key={p.mesRef} className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{mesExtenso(p.mesRef)}</span>
              <span className={cn('font-bold tabular-nums', p.saldoMes >= 0 ? 'text-success' : 'text-destructive')}>{money(p.saldoMes)}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span>Entradas {money(p.entradas)}</span>
              <span>Saídas {money(p.saidas)}</span>
              {p.parcelas.length > 0 && <span>{p.parcelas.length} parcela{p.parcelas.length > 1 ? 's' : ''}</span>}
              <span>Acumulado <b className={p.saldoAcumulado >= 0 ? 'text-foreground' : 'text-destructive'}>{money(p.saldoAcumulado)}</b></span>
            </div>
          </Card>
        ))}
      </div>

      {dvs.length > 0 && (
        <>
          <SecaoTitulo>Dívidas</SecaoTitulo>
          <Card className="p-4 mb-2">
            <span className="text-sm text-muted-foreground">Total ainda devido</span>
            <p className="text-2xl font-extrabold text-destructive">{money(totalDevido)}</p>
          </Card>
          <div className="space-y-2">
            {dvs.map((d) => (
              <Card key={d.lancamento.id} className="p-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><HandCoins className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{d.lancamento.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {money(d.lancamento.valor)}/mês · faltam {d.faltam} · acaba {mesCurto(d.ultimaParcelaMes)}
                  </p>
                </div>
                <Badge variant="destructive">{money(d.totalDevido)}</Badge>
              </Card>
            ))}
          </div>
        </>
      )}
      <div className="h-4" />
    </div>
  )
}
